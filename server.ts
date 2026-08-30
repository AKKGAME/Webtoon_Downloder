import dns from 'dns';
dns.setDefaultResultOrder('ipv4first');

import express, { Request, Response } from 'express';
import path from 'path';
import { createServer as createViteServer } from 'vite';

const app = express();
const PORT = 3000;

app.use(express.json());

const ALLINONE_BASE = 'https://allinonemanga.com';
const MOBILE_UA = 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_6 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.6 Mobile/15E148 Safari/604.1';
const OKHTTP_UA = 'Aries Translation/1.0.0 (Linux; Android 14; Pixel 7) OkHttp (Mobile)';

// Helper for resilient fetch with timeout and retries
async function fetchWithRetry(
  url: string,
  options: RequestInit = {},
  retries = 2,
  timeoutMs = 15000
): Promise<globalThis.Response> {
  let lastError: any = null;

  for (let attempt = 0; attempt <= retries; attempt++) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);

    try {
      const mergedSignal = options.signal
        ? (AbortSignal as any).any
          ? (AbortSignal as any).any([options.signal, controller.signal])
          : controller.signal
        : controller.signal;

      const response = await fetch(url, {
        ...options,
        signal: mergedSignal,
      });

      clearTimeout(timer);
      return response;
    } catch (err: any) {
      clearTimeout(timer);
      lastError = err;
      if (attempt < retries) {
        await new Promise((r) => setTimeout(r, 600 * (attempt + 1)));
      }
    }
  }

  throw lastError || new Error(`Failed to fetch ${url} after ${retries + 1} attempts`);
}

// Safely parse JSON from a fetch Response, handling unexpected HTML/error pages
async function safeJsonParse(res: globalThis.Response): Promise<{ ok: boolean; data: any; text?: string }> {
  try {
    const text = await res.text();
    if (!text || text.trim().startsWith('<')) {
      return { ok: false, data: null, text: text.slice(0, 300) };
    }
    const data = JSON.parse(text);
    return { ok: true, data };
  } catch (err) {
    return { ok: false, data: null };
  }
}

// Helper to extract UUID or identifiers from various URL patterns
function extractIdentifier(input: string): { type: 'chapter' | 'manga' | 'unknown'; id: string } {
  const trimmed = input.trim();

  // 1. Direct UUID pattern
  const uuidMatch = trimmed.match(/[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}/);
  if (uuidMatch) {
    // If URL contains '/manga/', treat as manga ID, else chapter ID
    if (trimmed.includes('/manga/')) {
      return { type: 'manga', id: uuidMatch[0] };
    }
    return { type: 'chapter', id: uuidMatch[0] };
  }

  // 2. Parse URL patterns
  try {
    const urlObj = new URL(trimmed.startsWith('http') ? trimmed : `https://allinonemanga.com/${trimmed}`);
    const pathParts = urlObj.pathname.split('/').filter(Boolean);

    const readIdx = pathParts.indexOf('read');
    if (readIdx !== -1 && pathParts[readIdx + 1]) {
      return { type: 'chapter', id: pathParts[readIdx + 1] };
    }

    const mangaIdx = pathParts.indexOf('manga');
    if (mangaIdx !== -1 && pathParts[mangaIdx + 1]) {
      return { type: 'manga', id: pathParts[mangaIdx + 1] };
    }
  } catch {
    // Ignore URL parse error
  }

  return { type: 'unknown', id: trimmed };
}

// Format and parse user-provided cookie or token string (supports DevTools tabbed copy, raw token, multiple lines)
export function parseAnyCookieInput(input?: string): string {
  if (!input || !input.trim()) return '';
  const lines = input.trim().split(/[\r\n]+/);
  const cookiePairs: string[] = [];

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) continue;

    // Check if tab-separated (from DevTools Cookies table copy)
    if (trimmed.includes('\t')) {
      const parts = trimmed.split('\t').map((s) => s.trim()).filter(Boolean);
      if (parts.length >= 2) {
        const name = parts[0];
        const val = parts[1];
        if (name && val) {
          cookiePairs.push(`${name}=${val}`);
        }
        continue;
      }
    }

    // Check if standard key=value; key2=value2
    if (trimmed.includes('=')) {
      const subParts = trimmed.split(';').map((s) => s.trim()).filter(Boolean);
      for (const sp of subParts) {
        if (sp.includes('=')) {
          cookiePairs.push(sp);
        }
      }
      continue;
    }

    // If it is a Bearer token
    if (trimmed.startsWith('Bearer ') || trimmed.startsWith('bearer ')) {
      const token = trimmed.replace(/^bearer\s+/i, '');
      cookiePairs.push(`session_token=${token}`);
      cookiePairs.push(`token=${token}`);
      continue;
    }

    // Raw token value
    cookiePairs.push(`session_token=${trimmed}`);
    cookiePairs.push(`token=${trimmed}`);
  }

  return cookiePairs.join('; ');
}

// Build authentication headers from user-provided auth/cookie string
function buildAuthHeaders(auth?: string): Record<string, string> {
  const headers: Record<string, string> = {
    'User-Agent': MOBILE_UA,
    'Referer': ALLINONE_BASE + '/',
    'Origin': ALLINONE_BASE,
    'X-Client-Type': 'WEB',
    'Accept': 'image/avif,image/webp,image/apng,image/svg+xml,image/*,*/*;q=0.8',
  };

  if (!auth || !auth.trim()) {
    return headers;
  }

  const cookieStr = parseAnyCookieInput(auth);
  if (cookieStr) {
    headers['Cookie'] = cookieStr;
  }

  // Also extract session_token or token for Authorization header if present
  const match = cookieStr.match(/(?:session_token|token|auth_token)=([^;]+)/i);
  if (match && match[1]) {
    headers['Authorization'] = `Bearer ${match[1].trim()}`;
  } else if (auth.trim().startsWith('eyJ') || (auth.trim().length > 20 && !auth.includes('='))) {
    headers['Authorization'] = `Bearer ${auth.trim().replace(/^bearer\s+/i, '')}`;
  }

  return headers;
}

// Health check
app.get('/api/health', (req: Request, res: Response) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Direct in-app login to AllInOneManga
app.post('/api/auth/login', async (req: Request, res: Response) => {
  try {
    const { emailOrUsername, password } = req.body;
    if (!emailOrUsername || !password) {
      return res.status(400).json({
        success: false,
        error: 'Email or Username and Password are required',
      });
    }

    const loginRes = await fetchWithRetry(`${ALLINONE_BASE}/api/v1/auth/login`, {
      method: 'POST',
      headers: {
        'User-Agent': MOBILE_UA,
        'Content-Type': 'application/json',
        'Origin': ALLINONE_BASE,
        'Referer': `${ALLINONE_BASE}/login`,
        'Accept': 'application/json',
      },
      body: JSON.stringify({
        emailOrUsername: String(emailOrUsername).trim(),
        password: String(password),
      }),
    });

    // Extract cookies from response
    const setCookieHeaders = typeof (loginRes.headers as any).getSetCookie === 'function'
      ? (loginRes.headers as any).getSetCookie()
      : [loginRes.headers.get('set-cookie')].filter(Boolean);

    const extractedCookies: string[] = [];
    for (const cookieItem of setCookieHeaders) {
      if (typeof cookieItem === 'string') {
        const firstPart = cookieItem.split(';')[0];
        if (firstPart) extractedCookies.push(firstPart.trim());
      }
    }

    const json = await safeJsonParse(loginRes);

    if (!loginRes.ok || (json.ok && json.data && json.data.success === false)) {
      let errMsg = 'Login failed';
      if (json.ok && json.data) {
        if (typeof json.data.error === 'string') {
          errMsg = json.data.error;
        } else if (json.data.error?.message) {
          errMsg = json.data.error.message;
        } else if (json.data.message) {
          errMsg = json.data.message;
        }
      }
      return res.status(loginRes.status || 401).json({
        success: false,
        error: errMsg,
      });
    }

    // Capture token if present in JSON body
    const bodyData = (json.ok && json.data) ? json.data : {};
    const token = bodyData.token || bodyData.sessionToken || bodyData.accessToken || bodyData.jwt || '';
    if (token) {
      extractedCookies.push(`session_token=${token}`);
      extractedCookies.push(`token=${token}`);
    }

    const authString = extractedCookies.length > 0 ? extractedCookies.join('; ') : (token ? `token=${token}` : '');

    return res.json({
      success: true,
      authString: authString || token,
      token: token,
      user: bodyData.user || bodyData.profile || null,
      message: 'Login successful!',
    });
  } catch (err: any) {
    return res.status(500).json({
      success: false,
      error: err.message || 'Login error occurred',
    });
  }
});

// Verify Auth Token / Session
app.post('/api/auth/verify', async (req: Request, res: Response) => {
  try {
    const { auth } = req.body;
    if (!auth || !auth.trim()) {
      return res.status(400).json({ success: false, error: 'No auth credentials provided' });
    }

    const headers = {
      ...buildAuthHeaders(auth),
      'Accept': 'application/json',
    };

    const meRes = await fetchWithRetry(`${ALLINONE_BASE}/api/v1/auth/me`, {
      headers,
    });

    const json = await safeJsonParse(meRes);
    if (meRes.ok && json.ok && json.data && json.data.success !== false) {
      return res.json({
        success: true,
        valid: true,
        user: json.data.user || json.data,
      });
    }

    return res.json({
      success: true,
      valid: meRes.status !== 401 && meRes.status !== 403,
      status: meRes.status,
    });
  } catch (err: any) {
    return res.status(500).json({ success: false, error: err.message });
  }
});

// Unlock Chapter Endpoint
app.post('/api/manga/unlock', async (req: Request, res: Response) => {
  try {
    const { chapterId, auth } = req.body;
    if (!chapterId) {
      return res.status(400).json({ success: false, error: 'Chapter ID is required' });
    }

    const headers = {
      ...buildAuthHeaders(auth),
      'Content-Type': 'application/json',
      'Accept': 'application/json',
    };

    const unlockRes = await fetchWithRetry(`${ALLINONE_BASE}/api/v1/manga/chapter/${chapterId}/unlock`, {
      method: 'POST',
      headers,
      body: JSON.stringify({}),
    });

    const json = await safeJsonParse(unlockRes);
    if (!unlockRes.ok || (json.ok && json.data && json.data.success === false)) {
      return res.status(unlockRes.status || 400).json({
        success: false,
        error: json.data?.error || `Unlock failed (${unlockRes.status})`,
      });
    }

    return res.json({
      success: true,
      data: json.data || { unlocked: true },
    });
  } catch (err: any) {
    return res.status(500).json({ success: false, error: err.message || 'Unlock error' });
  }
});

// Helper to decode HTML entities in titles and strings
function decodeHtmlEntities(str: string): string {
  if (!str) return '';
  return str
    .replace(/&amp;/g, '&')
    .replace(/&#038;/g, '&')
    .replace(/&#8211;/g, '-')
    .replace(/&#8212;/g, '—')
    .replace(/&#8216;/g, "'")
    .replace(/&#8217;/g, "'")
    .replace(/&#8220;/g, '"')
    .replace(/&#8221;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&#(\d+);/g, (_, code) => String.fromCharCode(Number(code)))
    .replace(/&#x([a-fA-F0-9]+);/g, (_, hex) => String.fromCharCode(parseInt(hex, 16)))
    .trim();
}

// Helper to scrape images from external Manga sites (WordPress Madara, MangaMango, etc.)
async function scrapeExternalMangaUrl(targetUrl: string) {
  try {
    let cleanTarget = targetUrl.trim();
    const parsed = new URL(cleanTarget);
    const origin = parsed.origin;

    // Check if target is a manga series overview page (e.g. .../manga/slug/) rather than a chapter/episode
    const isOverviewPage =
      (cleanTarget.includes('/manga/') || cleanTarget.includes('/series/')) &&
      !cleanTarget.includes('episode') &&
      !cleanTarget.includes('chapter') &&
      !cleanTarget.includes('read') &&
      !cleanTarget.includes('ch-');

    let allChapters: Array<{ id: string; number: number; chapterNumber: number; title: string; date: string; isLocked: boolean; url?: string }> = [];

    if (isOverviewPage) {
      // Attempt to query Madara /ajax/chapters/ or get chapter links
      try {
        const ajaxChapterUrl = `${cleanTarget.replace(/\/+$/, '')}/ajax/chapters/`;
        const ajaxRes = await fetchWithRetry(ajaxChapterUrl, {
          method: 'POST',
          headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
            'Referer': cleanTarget,
            'Origin': origin,
          },
        }, 1, 8000);

        if (ajaxRes.ok) {
          const ajaxHtml = await ajaxRes.text();
          const chapRegex = /<li[^>]*class=["'][^"']*wp-manga-chapter[^"']*["'][^>]*>[\s\S]*?<a[^>]+href=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi;
          let cm;
          let idx = 0;
          while ((cm = chapRegex.exec(ajaxHtml)) !== null) {
            const chapLink = cm[1].trim();
            const rawTitle = cm[2].replace(/<[^>]+>/g, '').trim();
            const cleanTitle = decodeHtmlEntities(rawTitle);
            const numMatch = cleanTitle.match(/\b\d+(\.\d+)?\b/);
            const chapNum = numMatch ? parseFloat(numMatch[0]) : idx + 1;
            allChapters.push({
              id: chapLink,
              url: chapLink,
              number: chapNum,
              chapterNumber: chapNum,
              title: cleanTitle || `Episode ${chapNum}`,
              date: '',
              isLocked: false,
            });
            idx++;
          }
        }
      } catch (err) {
        console.log('Error fetching overview chapters:', err);
      }

      // If we found chapters from the overview page, redirect scraping to the latest/first chapter!
      if (allChapters.length > 0) {
        cleanTarget = allChapters[0].url || cleanTarget;
      }
    }

    const res = await fetchWithRetry(cleanTarget, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Referer': `${origin}/`,
        'Origin': origin,
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8',
      },
    }, 2, 12000);

    if (!res.ok) {
      throw new Error(`Failed to load page (HTTP ${res.status})`);
    }

    const html = await res.text();

    let mangaTitle = 'Manga';
    let chapterTitle = 'Chapter';

    // 1. Extract Manga & Chapter title
    const ogMatch = html.match(/<meta property=["']og:title["'] content=["']([^"']+)["']/i) || html.match(/<title>([^<]+)<\/title>/i);
    if (ogMatch) {
      const fullTitle = decodeHtmlEntities(ogMatch[1]);
      const parts = fullTitle.split(/[-–|—]/).map((s) => s.trim()).filter(Boolean);
      if (parts.length >= 2) {
        mangaTitle = parts[0];
        chapterTitle = parts[1];
      } else if (parts.length === 1) {
        mangaTitle = parts[0];
      }
    }

    // Try hidden input for chapter title (Madara theme)
    const hiddenChapMatch = html.match(/id=["']wp-manga-current-chap["'][^>]*value=["']([^"']+)["']/i) ||
                             html.match(/value=["']([^"']+)["'][^>]*id=["']wp-manga-current-chap["']/i);
    if (hiddenChapMatch) {
      chapterTitle = decodeHtmlEntities(hiddenChapMatch[1].replace(/[-_]/g, ' ').replace(/\b\w/g, (l) => l.toUpperCase()));
    }

    // Cover image
    const ogImgMatch = html.match(/<meta property=["']og:image["'] content=["']([^"']+)["']/i);
    const coverUrl = ogImgMatch ? ogImgMatch[1].trim() : null;

    // 2. Extract manga pages (support data-src, data-lazy-src, data-original, src)
    const rawPageUrls: string[] = [];
    const imgTagRegex = /<img\b([^>]*)>/gi;
    let tagMatch;

    while ((tagMatch = imgTagRegex.exec(html)) !== null) {
      const tagAttrs = tagMatch[1];
      
      // Extract real image URL, prioritizing lazy-loading attributes over 1x1 placeholder src
      const dataSrcMatch = tagAttrs.match(/(?:data-src|data-lazy-src|data-original|data-full-url|data-url)=["']\s*(https?:\/\/[^"'\s<>]+)\s*["']/i);
      const srcMatch = tagAttrs.match(/\bsrc=["']\s*(https?:\/\/[^"'\s<>]+)\s*["']/i);
      
      const candidateUrl = dataSrcMatch ? dataSrcMatch[1].trim() : (srcMatch ? srcMatch[1].trim() : null);
      if (!candidateUrl) continue;

      // Filter out non-manga graphics (WordPress emojis, logos, gravatars, icons, banners)
      if (
        candidateUrl.includes('s.w.org/images/core/emoji') ||
        candidateUrl.includes('gravatar.com') ||
        candidateUrl.includes('/emoji/') ||
        candidateUrl.includes('favicon') ||
        candidateUrl.includes('logo') ||
        candidateUrl.includes('avatar')
      ) {
        continue;
      }

      // Check if it matches typical manga reading patterns or image CDN extensions
      const isManga =
        tagAttrs.includes('wp-manga-chapter-img') ||
        tagAttrs.includes('page-break') ||
        tagAttrs.includes('reading-content') ||
        tagAttrs.includes('chapter-img') ||
        candidateUrl.includes('/file/') ||
        candidateUrl.includes('/manga_') ||
        candidateUrl.includes('/chapters/') ||
        candidateUrl.includes('/uploads/manga/') ||
        /\.(jpg|jpeg|png|webp|avif)(?:\?|$)/i.test(candidateUrl);

      if (isManga) {
        rawPageUrls.push(candidateUrl);
      }
    }

    // Fallback: if no pages matched the attributes loop, search general image patterns
    if (rawPageUrls.length === 0) {
      const generalImgRegex = /(https?:\/\/[^\s"'<>]+\.(?:jpg|jpeg|png|webp|avif)(?:\?[^\s"'<>]*)?)/gi;
      let g;
      while ((g = generalImgRegex.exec(html)) !== null) {
        const u = g[1].trim();
        if (
          !u.includes('logo') &&
          !u.includes('banner') &&
          !u.includes('favicon') &&
          !u.includes('wp-includes') &&
          !u.includes('s.w.org')
        ) {
          rawPageUrls.push(u);
        }
      }
    }

    const unique = Array.from(new Set(rawPageUrls));
    if (unique.length === 0) {
      return null;
    }

    const formattedPages = unique.map((imgUrl, index) => {
      const pageNum = index + 1;
      const padIndex = String(pageNum).padStart(3, '0');
      const pageId = `web-page-${pageNum}`;
      const proxyUrl = `/api/proxy/image?url=${encodeURIComponent(imgUrl)}`;
      const extMatch = imgUrl.match(/\.(jpg|jpeg|png|webp|avif|gif)(?:\?|$)/i);
      const ext = extMatch ? extMatch[1].toLowerCase() : 'jpg';

      return {
        id: pageId,
        pageNumber: pageNum,
        formattedIndex: padIndex,
        rawUrl: imgUrl,
        proxyUrl: proxyUrl,
        format: ext.toUpperCase(),
        contentType: `image/${ext === 'jpg' ? 'jpeg' : ext}`,
        width: null,
        height: null,
      };
    });

    const numMatch = chapterTitle.match(/\b\d+(\.\d+)?\b/);
    const chapterNumber = numMatch ? parseFloat(numMatch[0]) : 1;

    return {
      chapterId: `web-${Date.now()}`,
      mangaTitle: decodeHtmlEntities(mangaTitle),
      mangaSlug: mangaTitle.toLowerCase().replace(/[^a-z0-9]+/g, '-'),
      mangaCoverUrl: coverUrl,
      chapterTitle: decodeHtmlEntities(chapterTitle),
      chapterNumber: chapterNumber,
      totalPages: formattedPages.length,
      pages: formattedPages,
      allChapters: allChapters,
    };
  } catch (err) {
    console.error('scrapeExternalMangaUrl error:', err);
    return null;
  }
}

// Resolve manga/chapter info and pages
app.post('/api/manga/resolve', async (req: Request, res: Response) => {
  try {
    const { url, auth } = req.body;
    if (!url || typeof url !== 'string' || !url.trim()) {
      return res.status(400).json({ success: false, error: 'URL or Chapter ID is required' });
    }

    const trimmedUrl = url.trim();

    // Check if it is an external web link (e.g. mangamangomyanmar.com or any https:// link outside allinonemanga)
    const isExternalWebUrl = trimmedUrl.startsWith('http://') || trimmedUrl.startsWith('https://');
    const isAllInOneDomain = trimmedUrl.includes('allinonemanga.com');

    if (isExternalWebUrl && !isAllInOneDomain) {
      const externalData = await scrapeExternalMangaUrl(trimmedUrl);
      if (externalData && externalData.pages.length > 0) {
        return res.json({
          success: true,
          data: externalData,
        });
      }
    }

    const parsed = extractIdentifier(trimmedUrl);
    let targetChapterId = '';

    let mangaInfo: any = null;
    let chaptersList: any[] = [];

    // If a manga slug or manga UUID was provided instead of a direct chapter
    if (parsed.type === 'manga') {
      const mangaRes = await fetchWithRetry(`${ALLINONE_BASE}/api/v1/manga/${parsed.id}`, {
        headers: {
          'User-Agent': MOBILE_UA,
          'Referer': ALLINONE_BASE + '/',
          'Origin': ALLINONE_BASE,
        },
      });

      const mangaJson = await safeJsonParse(mangaRes);
      if (mangaJson.ok && mangaJson.data?.data) {
        mangaInfo = mangaJson.data.data;
      }

      // Fetch chapters list for this manga
      const chaptersRes = await fetchWithRetry(`${ALLINONE_BASE}/api/v1/manga/${parsed.id}/chapters`, {
        headers: {
          'User-Agent': MOBILE_UA,
          'Referer': ALLINONE_BASE + '/',
        },
      });

      const chaptersJson = await safeJsonParse(chaptersRes);
      if (chaptersJson.ok && Array.isArray(chaptersJson.data?.data) && chaptersJson.data.data.length > 0) {
        chaptersList = chaptersJson.data.data;
        // Select the first chapter by default
        targetChapterId = chaptersList[0].id;
      }
    } else {
      targetChapterId = parsed.id;
    }

    if (!targetChapterId) {
      return res.status(400).json({
        success: false,
        error: 'Could not detect a valid Chapter ID or Manga URL from the provided link.',
      });
    }

    // 1. Fetch chapter info & chapters list
    const infoRes = await fetchWithRetry(`${ALLINONE_BASE}/api/v1/manga/chapter/${targetChapterId}/info`, {
      headers: {
        'User-Agent': MOBILE_UA,
        'Referer': ALLINONE_BASE + '/',
        'Origin': ALLINONE_BASE,
        'Content-Type': 'application/json',
      },
    });

    let chapterData: any = null;

    if (infoRes.ok) {
      const infoJson = await safeJsonParse(infoRes);
      if (infoJson.ok && infoJson.data?.success && infoJson.data.data) {
        chapterData = infoJson.data.data.chapter || null;
        if (!mangaInfo) {
          mangaInfo = infoJson.data.data.manga || null;
        }
        if (chaptersList.length === 0) {
          chaptersList = infoJson.data.data.chapters || [];
        }
      }
    }

    const authHeaders = buildAuthHeaders(auth);

    // If auth is provided, try unlocking first in case it is locked
    if (auth && auth.trim()) {
      try {
        await fetchWithRetry(`${ALLINONE_BASE}/api/v1/manga/chapter/${targetChapterId}/unlock`, {
          method: 'POST',
          headers: {
            ...authHeaders,
            'Content-Type': 'application/json',
            'Accept': 'application/json',
          },
          body: JSON.stringify({}),
        }, 1, 6000);
      } catch {
        // Continue to pages fetch
      }
    }

    // 2. Fetch chapter pages
    const pagesRes = await fetchWithRetry(`${ALLINONE_BASE}/api/v1/manga/chapter/${targetChapterId}/pages`, {
      headers: {
        ...authHeaders,
        'Accept': 'application/json',
      },
    });

    const pagesJson = await safeJsonParse(pagesRes);

    if (!pagesRes.ok || (pagesJson.ok && pagesJson.data?.locked)) {
      const isLocked = pagesRes.status === 403 || pagesJson.data?.locked || (pagesJson.data?.error && String(pagesJson.data.error).toLowerCase().includes('lock'));
      const errMsg = pagesJson.data?.error || `This chapter is locked. Please log in to unlock it.`;

      let coverUrl: string | null = null;
      if (mangaInfo?.coverUrl) {
        coverUrl = mangaInfo.coverUrl.startsWith('http')
          ? mangaInfo.coverUrl
          : `${ALLINONE_BASE}/${mangaInfo.coverUrl.replace(/^\/+/, '')}`;
      }

      // Return 200 with locked payload so client UI handles the unlock prompt gracefully
      return res.json({
        success: false,
        locked: isLocked,
        chapterId: targetChapterId,
        mangaTitle: mangaInfo?.title || 'Manga',
        chapterTitle: chapterData?.title || `Chapter ${chapterData?.number || chapterData?.chapterNumber || ''}`,
        chapterNumber: chapterData?.number || chapterData?.chapterNumber || 1,
        mangaCoverUrl: coverUrl,
        allChapters: chaptersList.map((ch) => ({
          id: ch.id,
          number: ch.number || ch.chapterNumber,
          chapterNumber: ch.chapterNumber || ch.number,
          title: ch.title || `Chapter ${ch.number || ch.chapterNumber}`,
          date: ch.date || '',
          isLocked: Boolean(ch.isLocked),
        })),
        error: errMsg,
      });
    }
    if (!pagesJson.ok || !pagesJson.data) {
      return res.status(502).json({
        success: false,
        error: 'Invalid response from manga server. Please check the link or try again.',
      });
    }

    const rawPages = Array.isArray(pagesJson.data.data) ? pagesJson.data.data : [];

    if (rawPages.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'No pages found in this chapter or chapter is restricted/locked.',
      });
    }

    // Sort sequentially by pageNumber
    const sortedPages = [...rawPages].sort((a, b) => (a.pageNumber || 0) - (b.pageNumber || 0));

    const formattedPages = sortedPages.map((p, index) => {
      const pageNum = p.pageNumber || index + 1;
      const padIndex = String(pageNum).padStart(3, '0');
      const pageId = p.id;
      const rawImageUrl = `${ALLINONE_BASE}/api/v1/px/${pageId}`;
      const proxyAuthSuffix = auth ? `&auth=${encodeURIComponent(auth)}` : '';
      const proxyUrl = `/api/manga/proxy-image?id=${encodeURIComponent(pageId)}${proxyAuthSuffix}`;

      return {
        id: pageId,
        pageNumber: pageNum,
        formattedIndex: padIndex,
        rawUrl: rawImageUrl,
        proxyUrl: proxyUrl,
        format: p.format || 'JPEG',
        contentType: p.contentType || 'image/jpeg',
        width: p.width || null,
        height: p.height || null,
      };
    });

    const mangaTitle = mangaInfo?.title || 'Manga';
    const chapterTitle = chapterData?.title || `Chapter ${chapterData?.number || chapterData?.chapterNumber || ''}`;
    const chapterNumber = chapterData?.number || chapterData?.chapterNumber || 1;

    let coverUrl: string | null = null;
    if (mangaInfo?.coverUrl) {
      coverUrl = mangaInfo.coverUrl.startsWith('http')
        ? mangaInfo.coverUrl
        : `${ALLINONE_BASE}/${mangaInfo.coverUrl.replace(/^\/+/, '')}`;
    }

    return res.json({
      success: true,
      data: {
        chapterId: targetChapterId,
        mangaTitle: mangaTitle,
        mangaSlug: mangaInfo?.slug || '',
        mangaCoverUrl: coverUrl,
        chapterTitle: chapterTitle,
        chapterNumber: chapterNumber,
        totalPages: formattedPages.length,
        pages: formattedPages,
        allChapters: chaptersList.map((ch) => ({
          id: ch.id,
          number: ch.number || ch.chapterNumber,
          chapterNumber: ch.chapterNumber || ch.number,
          title: ch.title || `Chapter ${ch.number || ch.chapterNumber}`,
          date: ch.date || '',
          isLocked: Boolean(ch.isLocked),
        })),
      },
    });
  } catch (error: any) {
    console.error('Error resolving manga chapter:', error);
    return res.status(500).json({
      success: false,
      error: error.message || 'Internal server error while resolving manga.',
    });
  }
});

// Proxy image endpoint to prevent CORS & bypass restrictions
const handleProxyImage = async (req: Request, res: Response) => {
  try {
    const id = req.query.id as string;
    const url = req.query.url as string;
    const auth =
      (req.query.auth as string) ||
      (req.headers['authorization'] as string) ||
      (req.headers['x-auth-token'] as string) ||
      (req.headers['cookie'] as string);

    let targetUrl = '';
    const isAllInOne = Boolean(id) || (Boolean(url) && url.includes('allinonemanga.com'));

    if (id) {
      targetUrl = `${ALLINONE_BASE}/api/v1/px/${id}`;
    } else if (url) {
      targetUrl = url.trim();
    } else {
      return res.status(400).send('Missing id or url parameter');
    }

    let customHeaders: Record<string, string>;

    if (isAllInOne) {
      customHeaders = buildAuthHeaders(auth);
    } else {
      // Clean headers for external manga CDNs (MangaMango, deep.mmnew.site, WordPress Madara, etc.)
      customHeaders = {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'image/avif,image/webp,image/apng,image/svg+xml,image/*,*/*;q=0.8',
      };

      try {
        if (targetUrl.startsWith('http')) {
          const parsedUrl = new URL(targetUrl);
          // Set Referer to host or parent domain
          customHeaders['Referer'] = `${parsedUrl.origin}/`;
        }
      } catch {
        // ignore
      }
    }

    let imageRes = await fetchWithRetry(targetUrl, {
      headers: customHeaders,
    }, 2, 16000);

    // Fallback: If 403 / 401 on external image, try without Referer or with Mobile UA
    if ((imageRes.status === 401 || imageRes.status === 403) && !isAllInOne) {
      try {
        const fallbackRes = await fetchWithRetry(targetUrl, {
          headers: {
            'User-Agent': MOBILE_UA,
            'Accept': '*/*',
          },
        }, 1, 10000);
        if (fallbackRes.ok) {
          imageRes = fallbackRes;
        }
      } catch {
        // preserve original response
      }
    }

    if (!imageRes.ok) {
      const statusText = imageRes.statusText || (imageRes.status === 401 ? 'Unauthorized - Chapter requires login/unlock' : 'Forbidden');
      return res.status(imageRes.status).send(`Failed to proxy image (${imageRes.status}): ${statusText}`);
    }

    const contentType = imageRes.headers.get('content-type') || 'image/jpeg';
    const contentLength = imageRes.headers.get('content-length');

    res.setHeader('Content-Type', contentType);
    if (contentLength) {
      res.setHeader('Content-Length', contentLength);
    }
    res.setHeader('Cache-Control', 'public, max-age=86400, stale-while-revalidate=604800');
    res.setHeader('Access-Control-Allow-Origin', '*');

    const buffer = await imageRes.arrayBuffer();
    res.send(Buffer.from(buffer));
  } catch (error: any) {
    console.error('Image proxy error:', error);
    res.status(500).send('Error proxying image');
  }
};

app.get('/api/manga/proxy-image', handleProxyImage);
app.get('/api/proxy/image', handleProxyImage);

// Explicit 404 handler for any unhandled /api requests to prevent Vite from returning index.html
app.all('/api/*', (req: Request, res: Response) => {
  res.status(404).json({
    success: false,
    error: `API route not found: ${req.method} ${req.path}`,
  });
});

// Global JSON error handler for /api
app.use((err: any, req: Request, res: Response, next: any) => {
  console.error('Unhandled server error:', err);
  if (req.path.startsWith('/api')) {
    return res.status(err.status || 500).json({
      success: false,
      error: err.message || 'Internal server error',
    });
  }
  next(err);
});

async function startServer() {
  // Vite middleware in development
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req: Request, res: Response) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Manga Downloader Server running on http://localhost:${PORT}`);
  });
}

startServer();
