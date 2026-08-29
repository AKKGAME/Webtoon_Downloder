import JSZip from 'jszip';
import { jsPDF } from 'jspdf';
import confetti from 'canvas-confetti';
import { MangaPage, DownloadProgress, DownloadFormat } from '../types';

export function sanitizeFilename(name: string): string {
  return name.replace(/[/\\?%*:|"<>]/g, '_').trim() || 'manga_chapter';
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
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  setTimeout(() => {
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }, 2000);
}

// Fetch a single page image as Blob with retries
export async function fetchPageBlob(
  page: MangaPage,
  signal?: AbortSignal,
  maxRetries = 2
): Promise<{ blob: Blob; ext: string }> {
  const proxyUrl = page.proxyUrl || `/api/manga/proxy-image?id=${encodeURIComponent(page.id)}`;

  let lastErr: any = null;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    if (signal?.aborted) {
      throw new Error('Download cancelled');
    }

    try {
      const response = await fetch(proxyUrl, { signal });
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const contentType = response.headers.get('content-type') || 'image/jpeg';
      if (contentType.includes('text/html') || contentType.includes('application/json')) {
        throw new Error('Server returned an error page instead of an image.');
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
      if (attempt < maxRetries) {
        await new Promise((r) => setTimeout(r, 800 * (attempt + 1)));
      }
    }
  }

  throw new Error(`Failed to download page ${page.pageNumber}: ${lastErr?.message || 'Network error'}`);
}

// Batch download as ZIP with sequential naming
export async function downloadAsZip({
  pages,
  prefix,
  paddingDigits = 3,
  onProgress,
  signal,
}: {
  pages: MangaPage[];
  prefix: string;
  paddingDigits?: number;
  onProgress?: (progress: DownloadProgress) => void;
  signal?: AbortSignal;
}): Promise<void> {
  const zip = new JSZip();
  const total = pages.length;
  let downloadedCount = 0;
  const startTime = Date.now();
  let totalBytes = 0;

  for (let i = 0; i < pages.length; i++) {
    if (signal?.aborted) {
      throw new Error('Download cancelled');
    }

    const page = pages[i];
    const filename = formatPageFilename(prefix, page.pageNumber, paddingDigits);

    onProgress?.({
      status: 'downloading',
      current: i + 1,
      total,
      percent: Math.round(((i) / total) * 90),
      currentFilename: filename,
      message: `Fetching image ${i + 1} of ${total}...`,
    });

    const { blob, ext } = await fetchPageBlob(page, signal);
    totalBytes += blob.size;
    
    // update filename with actual ext if needed
    const actualFilename = formatPageFilename(prefix, page.pageNumber, paddingDigits, ext);
    zip.file(actualFilename, blob);

    downloadedCount++;
    const elapsedSec = (Date.now() - startTime) / 1000;
    const speedMB = elapsedSec > 0 ? (totalBytes / (1024 * 1024) / elapsedSec).toFixed(1) + ' MB/s' : '';

    onProgress?.({
      status: 'downloading',
      current: downloadedCount,
      total,
      percent: Math.round((downloadedCount / total) * 85),
      currentFilename: actualFilename,
      speed: speedMB,
    });
  }

  // Compress to ZIP
  onProgress?.({
    status: 'zipping',
    current: total,
    total,
    percent: 90,
    message: 'Compressing into ZIP archive...',
  });

  const zipBlob = await zip.generateAsync(
    {
      type: 'blob',
      compression: 'DEFLATE',
      compressionOptions: { level: 6 },
    },
    (metadata) => {
      onProgress?.({
        status: 'zipping',
        current: total,
        total,
        percent: 90 + Math.round(metadata.percent * 0.1),
        message: `Compressing ZIP: ${Math.round(metadata.percent)}%`,
      });
    }
  );

  const zipFilename = `${sanitizeFilename(prefix) || 'manga_chapter'}.zip`;
  triggerBlobDownload(zipBlob, zipFilename);

  onProgress?.({
    status: 'completed',
    current: total,
    total,
    percent: 100,
    message: 'ZIP downloaded successfully!',
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
  delayMs = 300,
  onProgress,
  signal,
}: {
  pages: MangaPage[];
  prefix: string;
  paddingDigits?: number;
  delayMs?: number;
  onProgress?: (progress: DownloadProgress) => void;
  signal?: AbortSignal;
}): Promise<void> {
  const total = pages.length;

  for (let i = 0; i < pages.length; i++) {
    if (signal?.aborted) {
      throw new Error('Download cancelled');
    }

    const page = pages[i];
    const { blob, ext } = await fetchPageBlob(page, signal);
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
}: {
  pages: MangaPage[];
  prefix: string;
  paddingDigits?: number;
  onProgress?: (progress: DownloadProgress) => void;
  signal?: AbortSignal;
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

    const { blob } = await fetchPageBlob(page, signal);
    const dataUrl = await blobToDataURL(blob);
    const { width, height } = await getImageDimensions(dataUrl);

    // Standard A4 aspect or match image aspect
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
