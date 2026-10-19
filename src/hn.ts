import { LOOKBACK_HOURS, MIN_POINTS } from './config.ts';

export interface Story {
  id: number;
  title: string;
  url?: string;
  score: number;
  time: number; // giây unix
}

interface AlgoliaHit {
  objectID: string;
  title: string | null;
  url: string | null;
  points: number | null;
  created_at_i: number;
}

// Algolia HN Search lọc sẵn theo điểm: gồm cả bài top lẫn bài mới đủ điểm, chỉ tốn một request
export async function fetchStories(): Promise<Story[]> {
  const since = Math.floor(Date.now() / 1000) - LOOKBACK_HOURS * 3600;
  const res = await fetch(
    `https://hn.algolia.com/api/v1/search_by_date?tags=story&hitsPerPage=200` +
      `&numericFilters=points>=${MIN_POINTS},created_at_i>${since}`,
  );
  if (!res.ok) throw new Error(`Algolia ${res.status}: ${await res.text()}`);
  const { hits } = (await res.json()) as { hits: AlgoliaHit[] };
  return hits
    .filter((h) => h.title)
    .map((h) => ({
      id: Number(h.objectID),
      title: h.title!,
      url: h.url ?? undefined,
      score: h.points ?? 0,
      time: h.created_at_i,
    }))
    .sort((a, b) => b.score - a.score);
}

export const linkOf = (s: Story) => s.url ?? `https://news.ycombinator.com/item?id=${s.id}`;

export const fmtTime = (date: Date) =>
  date.toLocaleString('vi-VN', {
    timeZone: 'Asia/Ho_Chi_Minh',
    hour: '2-digit',
    minute: '2-digit',
    day: '2-digit',
    month: '2-digit',
  });

export const metaOf = (s: Story) => `⬆️ ${s.score} điểm · 🕒 ${fmtTime(new Date(s.time * 1000))}`;
