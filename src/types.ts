export interface MangaPage {
  id: string;
  pageNumber: number;
  formattedIndex: string; // e.g. "001", "002"
  rawUrl: string;
  proxyUrl: string;
  format: string;
  contentType: string;
  width?: number | null;
  height?: number | null;
}

export interface ChapterSummary {
  id: string;
  number: number;
  chapterNumber: string;
  title: string;
  date: string;
  isLocked: boolean;
}

export interface ChapterData {
  chapterId: string;
  mangaTitle: string;
  mangaSlug: string;
  mangaCoverUrl: string | null;
  chapterTitle: string;
  chapterNumber: number | string;
  totalPages: number;
  pages: MangaPage[];
  allChapters: ChapterSummary[];
}

export interface DownloadProgress {
  status: 'idle' | 'fetching' | 'downloading' | 'zipping' | 'pdf' | 'completed' | 'error';
  current: number;
  total: number;
  percent: number;
  currentFilename?: string;
  message?: string;
  speed?: string;
}

export type DownloadFormat = 'zip' | 'individual' | 'pdf';

export interface HistoryItem {
  id: string;
  url: string;
  mangaTitle: string;
  chapterTitle: string;
  totalPages: number;
  coverUrl?: string | null;
  timestamp: number;
}
