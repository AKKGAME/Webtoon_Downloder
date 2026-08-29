import dns from 'dns';
try {
  dns.setDefaultResultOrder('ipv4first');
} catch {
  // ignore
}

import express from 'express';
import type { Request, Response } from 'express';
import path from 'path';

const app = express();
const PORT = 3000;

// Enable CORS
app.use((req, res, next) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS, PUT, PATCH, DELETE');
  res.setHeader('Access-Control-Allow-Headers', 'X-Requested-With,Content-Type,Authorization,Cookie');
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }
  next();
});

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
  } catch {
    return { ok: false, data: null };
  }
}

// Helper to extract UUID or identifiers from various URL patterns
function extractIdentifier(input: string): { type: 'chapter' | 'manga' | 'unknown'; id: string } {
  const trimmed = input.trim();

  // 1. Direct UUID pattern
  const uuidMatch = trimmed.match(/[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}/);
  if (uuidMatch) {
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

// Format and parse user-provided cookie or token string
export function parseAnyCookieInput(input?: string): string {
  if (!input || !input.trim()) return '';
  const lines = input.trim().split(/[\r\n]+/);
  const cookiePairs: string[] = [];

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) continue;

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

    if (trimmed.includes('=')) {
      const subParts = trimmed.split(';').map((s) => s.trim()).filter(Boolean);
      for (const sp of subParts) {
        if (sp.includes('=')) {
          cookiePairs.push(sp);
        }
      }
      continue;
    }

    if (trimmed.startsWith('Bearer ') || trimmed.startsWith('bearer ')) {
      const token = trimmed.replace(/^bearer\s+/i, '');
      cookiePairs.push(`session_token=${token}`);
      cookiePairs.push(`token=${token}`);
      continue;
    }

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
  };

  if (!auth || !auth.trim()) {
    return headers;
  }

  const cookieStr = parseAnyCookieInput(auth);
  if (cookieStr) {
    headers['Cookie'] = cookieStr;
  }

  const match = cookieStr.match(/(?:session_token|token)=([^;]+)/);
  if (match && match[1]) {
    headers['Authorization'] = `Bearer ${match[1].trim()}`;
  } else if (auth.trim().startsWith('eyJ') || (auth.trim().length > 30 && !auth.includes('='))) {
    headers['Authorization'] = `Bearer ${auth.trim()}`;
  }

  return headers;
}

// Helper to scrape images from external Manga sites (WordPress Madara, MangaMango, etc.)
async function scrapeExternalMangaUrl(targetUrl: string) {
  try {
    const parsed = new URL(targetUrl);
    const res = await fetchWithRetry(targetUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Referer': `${parsed.origin}/`,
        'Origin': parsed.origin,
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8',
      },
    }, 2, 12000);

    if (!res.ok) {
      throw new Error(`Failed to load page (HTTP ${res.status})`);
    }

    const html = await res.text();

    let mangaTitle = 'Manga';
    let chapterTitle = 'Chapter';

    const ogMatch = html.match(/<meta property=["']og:title["'] content=["']([^"']+)["']/i) || html.match(/<title>([^<]+)<\/title>/i);
    if (ogMatch) {
      const fullTitle = ogMatch[1].replace(/&amp;/g, '&').replace(/&#8211;/g, '-').trim();
      const parts = fullTitle.split(/[-–|]/).map((s) => s.trim()).filter(Boolean);
      if (parts.length >= 2) {
        mangaTitle = parts[0];
        chapterTitle = parts[1];
      } else if (parts.length === 1) {
        mangaTitle = parts[0];
      }
    }

    const hiddenChapMatch = html.match(/id=["']wp-manga-current-chap["'][^>]*value=["']([^"']+)["']/i) ||
                             html.match(/value=["']([^"']+)["'][^>]*id=["']wp-manga-current-chap["']/i);
    if (hiddenChapMatch) {
      chapterTitle = hiddenChapMatch[1].replace(/[-_]/g, ' ').replace(/\b\w/g, (l) => l.toUpperCase());
    }

    const ogImgMatch = html.match(/<meta property=["']og:image["'] content=["']([^"']+)["']/i);
    const coverUrl = ogImgMatch ? ogImgMatch[1].trim() : null;

    const imgRegex = /<img[^>]+(?:src|data-src|data-lazy-src)=["']\s*(https?:\/\/[^"'\s<>]+)\s*["'][^>]*>/gi;
    const rawPageUrls: string[] = [];
    let m;
    while ((m = imgRegex.exec(html)) !== null) {
      const fullTag = m[0];
      const src = m[1].trim();

      const isMangaImg = fullTag.includes('wp-manga-chapter-img') ||
                         fullTag.includes('page-break') ||
                         fullTag.includes('reading-content') ||
                         fullTag.includes('chapter-img') ||
                         src.includes('/file/') ||
                         src.includes('/manga_') ||
                         src.includes('/chapters/') ||
                         src.includes('/uploads/manga/');

      if (isMangaImg && !src.includes('logo') && !src.includes('banner') && !src.includes('icon') && !src.includes('avatar') && !src.includes('favicon')) {
        rawPageUrls.push(src);
      }
    }

    if (rawPageUrls.length === 0) {
      const generalImgRegex = /(https?:\/\/[^\s"'<>]+\.(?:jpg|jpeg|png|webp|avif)(?:\?[^\s"'<>]*)?)/gi;
      let g;
      while ((g = generalImgRegex.exec(html)) !== null) {
        const u = g[1].trim();
        if (!u.includes('logo') && !u.includes('banner') && !u.includes('favicon') && !u.includes('wp-includes')) {
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

    return {
      chapterId: `web-${Date.now()}`,
      mangaTitle,
      mangaSlug: mangaTitle.toLowerCase().replace(/[^a-z0-9]+/g, '-'),
      mangaCoverUrl: coverUrl,
      chapterTitle,
      chapterNumber: 1,
      totalPages: formattedPages.length,
      pages: formattedPages,
      allChapters: [],
    };
  } catch (err) {
    console.error('scrapeExternalMangaUrl error:', err);
    return null;
  }
}

// Router for all API routes (mounted at both /api and /)
const apiRouter = express.Router();

// Health check
apiRouter.get('/health', (req: Request, res: Response) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Proxy image endpoint to prevent CORS & bypass restrictions
const handleProxyImage = async (req: Request, res: Response) => {
  try {
    const id = req.query.id as string;
    const url = req.query.url as string;
    const auth = (req.query.auth as string) || (req.headers['authorization'] as string) || (req.headers['cookie'] as string);

    let targetUrl = '';
    if (id) {
      targetUrl = `${ALLINONE_BASE}/api/v1/px/${id}`;
    } else if (url) {
      targetUrl = url.trim();
    } else {
      return res.status(400).send('Missing id or url parameter');
    }

    const authHeaders = buildAuthHeaders(auth);

    let customHeaders: Record<string, string> = {
      'User-Agent': MOBILE_UA,
      'Accept': 'image/avif,image/webp,image/apng,image/svg+xml,image/*,*/*;q=0.8',
      ...authHeaders,
    };

    try {
      if (targetUrl.startsWith('http')) {
        const parsedUrl = new URL(targetUrl);
        customHeaders['Referer'] = `${parsedUrl.origin}/`;
        customHeaders['Origin'] = parsedUrl.origin;
      }
    } catch {
      // ignore
    }

    const imageRes = await fetchWithRetry(targetUrl, {
      headers: customHeaders,
    }, 2, 15000);

    if (!imageRes.ok) {
      return res.status(imageRes.status).send(`Failed to proxy image: ${imageRes.statusText}`);
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

// Mount image proxy routes FIRST before parameterized /manga/:id
apiRouter.get('/manga/proxy-image', handleProxyImage);
apiRouter.get('/proxy/image', handleProxyImage);

// Direct in-app login to AllInOneManga
apiRouter.post('/auth/login', async (req: Request, res: Response) => {
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

    const bodyData = (json.ok && json.data) ? json.data : {};
    const token = bodyData.token || bodyData.sessionToken || bodyData.accessToken || bodyData.jwt || '';
    if (token) {
      extractedCookies.push(`session_token=${token}`);
      extractedCookies.push(`token=${token}`);
    }

    const finalCookieString = extractedCookies.join('; ');

    return res.json({
      success: true,
      data: {
        user: bodyData.user || { emailOrUsername },
        token: token,
        cookieString: finalCookieString,
      },
    });
  } catch (error: any) {
    console.error('Login error:', error);
    return res.status(500).json({
      success: false,
      error: error.message || 'Login request failed. Check server connection.',
    });
  }
});

// Search manga titles
apiRouter.post('/manga/search', async (req: Request, res: Response) => {
  try {
    const { query } = req.body;
    if (!query || typeof query !== 'string') {
      return res.status(400).json({ success: false, error: 'Query string is required' });
    }

    const encodedQuery = encodeURIComponent(query.trim());
    const searchUrl = `${ALLINONE_BASE}/api/v1/manga/search?q=${encodedQuery}`;

    const response = await fetchWithRetry(searchUrl, {
      headers: {
        'User-Agent': MOBILE_UA,
        'Referer': ALLINONE_BASE + '/',
        'Origin': ALLINONE_BASE,
      },
    });

    const json = await safeJsonParse(response);
    if (!response.ok || !json.ok) {
      return res.status(response.status || 500).json({
        success: false,
        error: json.data?.error || 'Failed to search manga on provider.',
      });
    }

    return res.json({
      success: true,
      data: json.data?.data || json.data || [],
    });
  } catch (error: any) {
    console.error('Error searching manga:', error);
    return res.status(500).json({ success: false, error: error.message || 'Internal server error' });
  }
});

// Get manga details
apiRouter.get('/manga/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const response = await fetchWithRetry(`${ALLINONE_BASE}/api/v1/manga/${id}`, {
      headers: {
        'User-Agent': MOBILE_UA,
        'Referer': ALLINONE_BASE + '/',
      },
    });

    const json = await safeJsonParse(response);
    if (!response.ok || !json.ok) {
      return res.status(response.status || 500).json({
        success: false,
        error: json.data?.error || 'Failed to fetch manga details.',
      });
    }

    return res.json({
      success: true,
      data: json.data?.data || json.data,
    });
  } catch (error: any) {
    return res.status(500).json({ success: false, error: error.message || 'Internal server error' });
  }
});

// Get chapters for manga
apiRouter.get('/manga/:id/chapters', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const response = await fetchWithRetry(`${ALLINONE_BASE}/api/v1/manga/${id}/chapters`, {
      headers: {
        'User-Agent': MOBILE_UA,
        'Referer': ALLINONE_BASE + '/',
      },
    });

    const json = await safeJsonParse(response);
    if (!response.ok || !json.ok) {
      return res.status(response.status || 500).json({
        success: false,
        error: json.data?.error || 'Failed to fetch chapters.',
      });
    }

    return res.json({
      success: true,
      data: json.data?.data || json.data || [],
    });
  } catch (error: any) {
    return res.status(500).json({ success: false, error: error.message || 'Internal server error' });
  }
});

// Unlock single chapter
apiRouter.post('/manga/chapter/:id/unlock', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { auth } = req.body;

    const authHeaders = buildAuthHeaders(auth);
    const unlockRes = await fetchWithRetry(`${ALLINONE_BASE}/api/v1/manga/chapter/${id}/unlock`, {
      method: 'POST',
      headers: {
        ...authHeaders,
        'Content-Type': 'application/json',
        'Accept': 'application/json',
      },
      body: JSON.stringify({}),
    });

    const json = await safeJsonParse(unlockRes);

    if (!unlockRes.ok) {
      return res.status(unlockRes.status).json({
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

// Resolve manga/chapter info and pages
apiRouter.post('/manga/resolve', async (req: Request, res: Response) => {
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

      const chaptersRes = await fetchWithRetry(`${ALLINONE_BASE}/api/v1/manga/${parsed.id}/chapters`, {
        headers: {
          'User-Agent': MOBILE_UA,
          'Referer': ALLINONE_BASE + '/',
        },
      });

      const chaptersJson = await safeJsonParse(chaptersRes);
      if (chaptersJson.ok && Array.isArray(chaptersJson.data?.data) && chaptersJson.data.data.length > 0) {
        chaptersList = chaptersJson.data.data;
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

// Mount router on both /api and / so it works seamlessly in standalone and serverless rewrite mode
app.use('/api', apiRouter);
app.use('/', apiRouter);

// Global JSON error handler
app.use((err: any, req: Request, res: Response, next: any) => {
  console.error('Unhandled server error:', err);
  if (req.path.startsWith('/api') || req.path.startsWith('/manga')) {
    return res.status(err.status || 500).json({
      success: false,
      error: err.message || 'Internal server error',
    });
  }
  next(err);
});

async function startServer() {
  if (process.env.NODE_ENV !== 'production') {
    // Dynamic import to prevent bundling Vite in production serverless runtime
    const { createServer: createViteServer } = await import('vite');
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

if (!process.env.VERCEL) {
  startServer();
}

export default app;
