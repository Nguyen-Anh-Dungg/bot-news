import { classify } from './ai.ts';
import { MAX_ITEMS, SEEN_FILE, SEEN_MAX } from './config.ts';
import { fetchStories, fmtTime, linkOf, metaOf, type Story } from './hn.ts';
import { readJson, settings, writeJson } from './store.ts';
import { sendTelegram } from './telegram.ts';

const rawList = (stories: Story[]) =>
  stories.map((s) => `• ${s.title}\n  ${metaOf(s)}\n  ${linkOf(s)}`).join('\n\n');

export async function runDigest(): Promise<void> {
  const seen = await readJson<number[]>(SEEN_FILE, []);
  const seenSet = new Set(seen);
  const stories = (await fetchStories()).filter((s) => !seenSet.has(s.id)); // đã sắp theo điểm giảm dần
  if (!stories.length) return console.log('Không có bài mới');

  const byId = new Map(stories.map((s) => [s.id, s]));
  const now = fmtTime(new Date());
  // Bài đã đưa AI xét (kể cả bị loại) coi như đã xem
  let done = stories;

  let body: string;
  if (!settings.ai) {
    done = stories.slice(0, MAX_ITEMS); // bài bị cắt chưa đánh dấu, lần sau còn cơ hội
    body = `ℹ️ AI đang tắt (nhắn "start AI" để bật lại):\n\n${rawList(done)}`;
  } else {
    try {
      // AI không luôn tuân giới hạn trong prompt → chặn cứng, giữ bài điểm cao nhất
      const picked = (await classify(stories))
        .flatMap((i) => {
          const s = byId.get(i.id); // link lấy từ HN, không lấy từ AI
          return s ? [{ ...i, story: s }] : [];
        })
        .sort((a, b) => b.story.score - a.story.score)
        .slice(0, MAX_ITEMS);
      // Gom theo chủ đề, giữ thứ tự xuất hiện
      const topics = new Map<string, string[]>();
      for (const { topic, summary, story } of picked) {
        const key = topic.trim();
        if (!topics.has(key)) topics.set(key, []);
        topics.get(key)!.push(`• ${summary.trim()}\n  ${metaOf(story)}\n  ${linkOf(story)}`);
      }
      // Mỗi tin cách một dòng trống để sendTelegram tách được khi một chủ đề quá dài
      body = [...topics].map(([topic, lines]) => `📌 ${topic}\n\n${lines.join('\n\n')}`).join('\n\n');
    } catch (err) {
      // Ollama hết quota, lỗi mạng, trả sai định dạng... → gửi tiêu đề gốc
      console.error('AI lỗi, gửi tiêu đề gốc:', (err as Error).message);
      done = stories.slice(0, MAX_ITEMS);
      body = `⚠️ AI không khả dụng, đây là tiêu đề gốc:\n\n${rawList(done)}`;
    }
  }

  if (body) {
    await sendTelegram(`📰 Hacker News ${now}\n\n${body}`);
    console.log(`Đã gửi bản tin ${now}`);
  } else {
    console.log(`${stories.length} bài mới, không bài nào thuộc phạm vi`);
  }

  // Chỉ đánh dấu đã xem sau khi gửi thành công; gửi lỗi thì lần sau thử lại
  await writeJson(SEEN_FILE, [...seen, ...done.map((s) => s.id)].slice(-SEEN_MAX));
}
