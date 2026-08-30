import JSZip from 'jszip';
import { jsPDF } from 'jspdf';
import confetti from 'canvas-confetti';
import { MangaPage, DownloadProgress } from '../types';

// Robust filename sanitizer that supports Burmese and all Unicode characters while stripping illegal OS/URL chars
export function sanitizeFilename(name: string): string {
  if (!name) return 'manga_chapter';
  const clean = name
    .replace(/[/\\?%*:|"<>#`\x00-\x1f\x7f-\x9f]/g, '_')
    .replace(/\s+/g, ' ')
    .trim();
  return clean || 'manga_chapter';
}

export function formatPageFilename(
  prefix: string,
  pageNumber: number,
  paddingDigits: number = 3,
  ext: string = 'jpg'
): string {
  const pad = String(pageNumber).padStart(paddingDigits, '0');
  const cleanPrefix = sanitizeFilename(prefix);
  return cleanPrefix ? `${cleanPrefix}_${pad}.${ext}` : `${pad}.${ext}`;
}

export function triggerBlobDownload(blob: Blob, filename: string) {
  const cleanName = sanitizeFilename(filename.replace(/\.zip$/i, '')) + (filename.toLowerCase().endsWith('.zip') ? '.zip' : '');
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = cleanName || filename;
  document.body.appendChild(a);
  a.click();
  setTimeout(() => {
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }, 3000);
}

const AUTH_STORAGE_KEY = 'manga_downloader_auth_token_v1';

// Fetch a single page image as Blob with retries and auth header support
export async function fetchPageBlob(
  page: MangaPage,
  signal?: AbortSignal,
  maxRetries = 3,
  authToken?: string
): Promise<{ blob: Blob; ext: string }> {
  // Resolve effective auth token from prop or localStorage
  const effectiveAuth = authToken || (typeof localStorage !== 'undefined' ? localStorage.getItem(AUTH_STORAGE_KEY) || '' : '');
  
  let baseProxy = page.proxyUrl || `/api/manga/proxy-image?id=${encodeURIComponent(page.id)}`;
  
  // Only attach auth query parameter if this is an AllInOne proxy or if user explicitly provided one
  const isExternalUrl = baseProxy.includes('/api/proxy/image');
  if (effectiveAuth && !isExternalUrl && !baseProxy.includes('auth=')) {
    const separator = baseProxy.includes('?') ? '&' : '?';
    baseProxy = `${baseProxy}${separator}auth=${encodeURIComponent(effectiveAuth)}`;
  }

  const reqHeaders: Record<string, string> = {};
  if (effectiveAuth && !isExternalUrl) {
    const cleanToken = effectiveAuth.replace(/^bearer\s+/i, '').trim();
    reqHeaders['Authorization'] = `Bearer ${cleanToken}`;
    reqHeaders['X-Auth-Token'] = cleanToken;
  }

  let lastErr: any = null;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    if (signal?.aborted) {
      throw new Error('Download cancelled');
    }

    try {
      const response = await fetch(baseProxy, {
        headers: reqHeaders,
        signal,
      });

      if (!response.ok) {
        if (response.status === 401) {
          throw new Error('HTTP 401: Unauthorized. This chapter requires an active AllInOneManga login session or coin unlock.');
        }
        if (response.status === 403) {
          throw new Error('HTTP 403: Forbidden / Chapter locked. Please unlock the chapter.');
        }
        if (response.status === 404) {
          throw new Error('HTTP 404: Page image not found or expired.');
        }
        const statusText = response.statusText ? `: ${response.statusText}` : '';
        throw new Error(`HTTP ${response.status}${statusText}`);
      }

      const contentType = response.headers.get('content-type') || 'image/jpeg';
      if (contentType.includes('text/html') || contentType.includes('application/json')) {
        throw new Error('Server returned an error document instead of an image.');
      }

      let ext = 'jpg';
      if (contentType.includes('png')) ext = 'png';
      else if (contentType.includes('webp')) ext = 'webp';
      else if (contentType.includes('avif')) ext = 'avif';

      const blob = await response.blob();
      if (blob.size === 0) {
        throw new Error('Received empty image response');
      }

      return { blob, ext };
    } catch (err: any) {
      lastErr = err;
      if (signal?.aborted) {
        throw new Error('Download cancelled');
      }
      // If unauthorized, do not retry blindly; fail fast
      if (err?.message?.includes('401') || err?.message?.includes('403')) {
        break;
      }
      if (attempt < maxRetries) {
        await new Promise((r) => setTimeout(r, 600 * (attempt + 1)));
      }
    }
  }

  throw new Error(`Failed to download page ${page.pageNumber}: ${lastErr?.message || 'Network error'}`);
}

// Parallel Batch download as ZIP with sequential naming
export async function downloadAsZip({
  pages,
  prefix,
  paddingDigits = 3,
  onProgress,
  signal,
  authToken,
  concurrency = 4,
}: {
  pages: MangaPage[];
  prefix: string;
  paddingDigits?: number;
  onProgress?: (progress: DownloadProgress) => void;
  signal?: AbortSignal;
  authToken?: string;
  concurrency?: number;
}): Promise<void> {
  const zip = new JSZip();
  const total = pages.length;
  let downloadedCount = 0;
  const startTime = Date.now();
  let totalBytes = 0;
  const failedPages: number[] = [];

  // Array to hold ordered downloaded results
  const results: Array<{ page: MangaPage; blob: Blob; ext: string } | null> = new Array(total).fill(null);

  // Worker pool for fast parallel downloading
  let currentIndex = 0;

  async function worker() {
    while (currentIndex < total) {
      if (signal?.aborted) {
        throw new Error('Download cancelled');
      }

      const index = currentIndex++;
      const page = pages[index];
      const filename = formatPageFilename(prefix, page.pageNumber, paddingDigits);

      try {
        const { blob, ext } = await fetchPageBlob(page, signal, 3, authToken);
        results[index] = { page, blob, ext };
        totalBytes += blob.size;
        downloadedCount++;

        const elapsedSec = (Date.now() - startTime) / 1000;
        const speedMB = elapsedSec > 0 ? (totalBytes / (1024 * 1024) / elapsedSec).toFixed(1) + ' MB/s' : '';

        onProgress?.({
          status: 'downloading',
          current: downloadedCount,
          total,
          percent: Math.round((downloadedCount / total) * 88),
          currentFilename: filename,
          speed: speedMB,
          message: `Downloading: ${downloadedCount}/${total} (${speedMB})`,
        });
      } catch (err: any) {
        console.error(`Page ${page.pageNumber} download failed:`, err);
        failedPages.push(page.pageNumber);
        if (signal?.aborted) {
          throw new Error('Download cancelled');
        }
      }
    }
  }

  // Launch concurrent workers
  const actualConcurrency = Math.min(concurrency, total, 6);
  const workers = Array.from({ length: actualConcurrency }, () => worker());
  await Promise.all(workers);

  if (signal?.aborted) {
    throw new Error('Download cancelled');
  }

  // Insert successful pages into ZIP in strictly sequential order
  let validBlobsCount = 0;
  for (let i = 0; i < total; i++) {
    const item = results[i];
    if (item) {
      const pageNum = item.page.pageNumber;
      const actualFilename = formatPageFilename(prefix, pageNum, paddingDigits, item.ext);
      zip.file(actualFilename, item.blob);
      validBlobsCount++;
    }
  }

  if (validBlobsCount === 0) {
    throw new Error('Could not download any images from this chapter. Please check the link or unlock status.');
  }

  // Fast ZIP generation with STORE compression (images are already compressed, takes <200ms)
  onProgress?.({
    status: 'zipping',
    current: total,
    total,
    percent: 92,
    message: 'Compressing into ZIP archive...',
  });

  const zipBlob = await zip.generateAsync(
    {
      type: 'blob',
      compression: 'STORE',
    },
    (metadata) => {
      onProgress?.({
        status: 'zipping',
        current: total,
        total,
        percent: 90 + Math.round(metadata.percent * 0.09),
        message: `Compressing ZIP: ${Math.round(metadata.percent)}%`,
      });
    }
  );

  const cleanZipName = `${sanitizeFilename(prefix || 'manga_chapter')}.zip`;
  triggerBlobDownload(zipBlob, cleanZipName);

  const completionMsg =
    failedPages.length > 0
      ? `Completed! ${validBlobsCount}/${total} pages saved (${failedPages.length} skipped).`
      : 'ZIP downloaded successfully!';

  onProgress?.({
    status: 'completed',
    current: total,
    total,
    percent: 100,
    currentFilename: cleanZipName,
    message: completionMsg,
  });

  try {
    confetti({ particleCount: 80, spread: 60, origin: { y: 0.8 } });
  } catch {
    // ignore
  }
}

// Download images sequentially one by one
export async function downloadSequentiallyIndividual({
  pages,
  prefix,
  paddingDigits = 3,
  delayMs = 250,
  onProgress,
  signal,
  authToken,
}: {
  pages: MangaPage[];
  prefix: string;
  paddingDigits?: number;
  delayMs?: number;
  onProgress?: (progress: DownloadProgress) => void;
  signal?: AbortSignal;
  authToken?: string;
}): Promise<void> {
  const total = pages.length;

  for (let i = 0; i < pages.length; i++) {
    if (signal?.aborted) {
      throw new Error('Download cancelled');
    }

    const page = pages[i];
    const { blob, ext } = await fetchPageBlob(page, signal, 2, authToken);
    const filename = formatPageFilename(prefix, page.pageNumber, paddingDigits, ext);

    triggerBlobDownload(blob, filename);

    onProgress?.({
      status: 'downloading',
      current: i + 1,
      total,
      percent: Math.round(((i + 1) / total) * 100),
      currentFilename: filename,
      message: `Downloaded page ${i + 1} of ${total}`,
    });

    if (i < pages.length - 1 && delayMs > 0) {
      await new Promise((resolve) => setTimeout(resolve, delayMs));
    }
  }

  onProgress?.({
    status: 'completed',
    current: total,
    total,
    percent: 100,
    message: 'All images downloaded successfully!',
  });

  try {
    confetti({ particleCount: 80, spread: 60, origin: { y: 0.8 } });
  } catch {
    // ignore
  }
}

// Helper to convert blob to data URL
function blobToDataURL(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}

// Helper to get image natural dimensions
function getImageDimensions(dataUrl: string): Promise<{ width: number; height: number }> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve({ width: img.naturalWidth || 800, height: img.naturalHeight || 1200 });
    img.onerror = reject;
    img.src = dataUrl;
  });
}

// Compile chapter into PDF
export async function downloadAsPdf({
  pages,
  prefix,
  paddingDigits = 3,
  onProgress,
  signal,
  authToken,
}: {
  pages: MangaPage[];
  prefix: string;
  paddingDigits?: number;
  onProgress?: (progress: DownloadProgress) => void;
  signal?: AbortSignal;
  authToken?: string;
}): Promise<void> {
  const total = pages.length;
  let pdf: jsPDF | null = null;

  for (let i = 0; i < pages.length; i++) {
    if (signal?.aborted) {
      throw new Error('Download cancelled');
    }

    const page = pages[i];
    onProgress?.({
      status: 'pdf',
      current: i + 1,
      total,
      percent: Math.round(((i + 1) / total) * 90),
      message: `Processing page ${i + 1} for PDF...`,
    });

    const { blob } = await fetchPageBlob(page, signal, 2, authToken);
    const dataUrl = await blobToDataURL(blob);
    const { width, height } = await getImageDimensions(dataUrl);

    const orientation = width > height ? 'landscape' : 'portrait';
    
    if (i === 0) {
      pdf = new jsPDF({
        orientation,
        unit: 'pt',
        format: [width, height],
      });
      pdf.addImage(dataUrl, 'JPEG', 0, 0, width, height);
    } else if (pdf) {
      pdf.addPage([width, height], orientation);
      pdf.addImage(dataUrl, 'JPEG', 0, 0, width, height);
    }
  }

  if (pdf) {
    onProgress?.({
      status: 'pdf',
      current: total,
      total,
      percent: 95,
      message: 'Saving PDF file...',
    });

    const pdfFilename = `${sanitizeFilename(prefix) || 'manga_chapter'}.pdf`;
    pdf.save(pdfFilename);

    onProgress?.({
      status: 'completed',
      current: total,
      total,
      percent: 100,
      message: 'PDF exported successfully!',
    });

    try {
      confetti({ particleCount: 80, spread: 60, origin: { y: 0.8 } });
    } catch {
      // ignore
    }
  }
}
