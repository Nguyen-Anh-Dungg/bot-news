// Bản tin Hacker News: lấy tiêu đề top bài → AI (Ollama Cloud) lọc, gom theo chủ đề và giải thích ngắn → gửi Telegram.
// Mỗi INTERVAL_HOURS kiểm tra một lần, chỉ gửi bài chưa từng gửi.
// Nhắn bot "stop AI" / "start AI" để tắt / bật AI (tắt thì gửi tiêu đề gốc).
// Chạy nền (pm2): node --env-file=.env index.mjs
// Chạy một lần:   node --env-file=.env index.mjs --now
import { readFile, writeFile } from 'node:fs/promises';
import { setTimeout as sleep } from 'node:timers/promises';

const { OLLAMA_API_KEY, OLLAMA_MODEL = 'gpt-oss:120b', TELEGRAM_TOKEN, TELEGRAM_CHAT_ID } = process.env;

const TOP_N = 30;
const INTERVAL_HOURS = 2;
const SEEN_FILE = new URL('seen.json', import.meta.url); // nằm cạnh script, deploy không ghi đè
const SEEN_MAX = 1000; // ponytail: chỉ nhớ 1000 id gần nhất, bài cũ hơn mà quay lại top sẽ bị gửi lại
const SETTINGS_FILE = new URL('settings.json', import.meta.url);

const COMMANDS = {
  stopai: { ai: false, reply: '⏸️ Đã tắt AI. Từ lần gửi sau bot gửi tiêu đề gốc.' },
  startai: { ai: true, reply: '▶️ Đã bật AI. Từ lần gửi sau bot lọc và giải thích tin bằng AI.' },
};

// Phạm vi tin cần lấy. Thêm lĩnh vực mới: thêm một dòng
const SCOPE = [
  'công nghệ: phần mềm, lập trình, AI, phần cứng, bảo mật, khoa học máy tính',
  'business: startup, công ty, gọi vốn, thị trường, kinh tế, sản phẩm',
];

const hn = (path) =>
  fetch(`https://hacker-news.firebaseio.com/v0/${path}.json`).then((r) => r.json());

const linkOf = (s) => s.url ?? `https://news.ycombinator.com/item?id=${s.id}`;

async function classify(stories) {
  const res = await fetch('https://ollama.com/api/chat', {
    method: 'POST',
    headers: { authorization: `Bearer ${OLLAMA_API_KEY}`, 'content-type': 'application/json' },
    body: JSON.stringify({
      model: OLLAMA_MODEL,
      stream: false,
      // gpt-oss suy nghĩ trước khi trả lời; việc lọc tiêu đề đơn giản nên để mức thấp cho đỡ tốn quota
      ...(OLLAMA_MODEL.startsWith('gpt-oss') && { think: 'low' }),
      format: {
        type: 'object',
        properties: {
          items: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                id: { type: 'integer' },
                topic: { type: 'string' },
                summary: { type: 'string' },
              },
              required: ['id', 'topic', 'summary'],
            },
          },
        },
        required: ['items'],
      },
      messages: [
        {
          role: 'system',
          content: `Bạn biên tập bản tin Hacker News cho một lập trình viên người Việt.
Chỉ chọn những bài thuộc phạm vi sau, bỏ qua bài khác:
${SCOPE.map((s) => `- ${s}`).join('\n')}

Với mỗi bài được chọn:
- "topic": tên chủ đề ngắn bằng tiếng Việt do bạn tự đặt theo nội dung, ví dụ "Lập trình web", "Thuật toán", "AI", "Bảo mật", "Startup". Các bài cùng chủ đề phải dùng đúng cùng một tên. Tổng cộng không quá 7 chủ đề.
- "summary": 1-2 câu tiếng Việt GIẢI THÍCH bài này nói về cái gì và vì sao đáng chú ý (công cụ/công ty/khái niệm đó là gì, bối cảnh). KHÔNG được chỉ dịch lại tiêu đề. Nếu không chắc nội dung, nói bài có khả năng bàn về điều gì, không bịa chi tiết. Giữ nguyên thuật ngữ kỹ thuật tiếng Anh.`,
        },
        {
          role: 'user',
          content: stories
            .map((s) => `${s.id}: ${s.title}${s.url ? ` (${new URL(s.url).hostname})` : ''}`)
            .join('\n'),
        },
      ],
    }),
  });
  if (!res.ok) throw new Error(`Ollama ${res.status}: ${await res.text()}`);
  return JSON.parse((await res.json()).message.content).items;
}

async function sendTelegram(text) {
  // Telegram giới hạn 4096 ký tự mỗi tin → tách theo đoạn
  const chunks = [];
  let cur = '';
  for (const part of text.split('\n\n')) {
    if (cur && (cur + '\n\n' + part).length > 4000) {
      chunks.push(cur);
      cur = part;
    } else {
      cur = cur ? `${cur}\n\n${part}` : part;
    }
  }
  if (cur) chunks.push(cur);

  for (const chunk of chunks) {
    const res = await fetch(`https://api.telegram.org/bot${TELEGRAM_TOKEN}/sendMessage`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ chat_id: TELEGRAM_CHAT_ID, text: chunk, link_preview_options: { is_disabled: true } }),
    });
    if (!res.ok) throw new Error(`Telegram ${res.status}: ${await res.text()}`);
  }
}

async function readJson(file, fallback) {
  try {
    return JSON.parse(await readFile(file, 'utf8'));
  } catch {
    return fallback; // lần chạy đầu: chưa có file
  }
}

const settings = await readJson(SETTINGS_FILE, { ai: true });

const rawList = (stories) => stories.map((s) => `• ${s.title}\n  ${linkOf(s)}`).join('\n\n');

// Long polling Telegram để nhận lệnh, chạy song song với vòng gửi tin
async function listenCommands() {
  let offset = 0;
  for (;;) {
    try {
      const res = await fetch(
        `https://api.telegram.org/bot${TELEGRAM_TOKEN}/getUpdates?timeout=50&offset=${offset}`,
      );
      if (!res.ok) throw new Error(`Telegram ${res.status}: ${await res.text()}`);
      for (const u of (await res.json()).result) {
        offset = u.update_id + 1;
        // Chỉ nhận lệnh từ chính chủ
        if (String(u.message?.chat.id) !== TELEGRAM_CHAT_ID) continue;
        const cmd = COMMANDS[u.message.text?.toLowerCase().replace(/[\s/]/g, '')];
        if (cmd) {
          settings.ai = cmd.ai;
          await writeFile(SETTINGS_FILE, JSON.stringify(settings));
        }
        await sendTelegram(
          cmd?.reply ??
            `Lệnh hỗ trợ:\n• stop AI: tắt AI, gửi tiêu đề gốc\n• start AI: bật lại AI\n\nAI hiện đang ${settings.ai ? 'bật' : 'tắt'}.`,
        );
      }
    } catch (err) {
      console.error('Nhận lệnh Telegram lỗi:', err.message);
      await sleep(5000);
    }
  }
}

async function run() {
  const seen = await readJson(SEEN_FILE, []);
  const seenSet = new Set(seen);
  const ids = (await hn('topstories')).slice(0, TOP_N).filter((id) => !seenSet.has(id));
  if (!ids.length) return console.log('Không có bài mới');

  const stories = (await Promise.all(ids.map((id) => hn(`item/${id}`)))).filter((s) => s?.title);
  const byId = new Map(stories.map((s) => [s.id, s]));
  const now = new Date().toLocaleString('vi-VN', {
    timeZone: 'Asia/Ho_Chi_Minh',
    hour: '2-digit',
    minute: '2-digit',
    day: '2-digit',
    month: '2-digit',
  });

  let body;
  if (!settings.ai) {
    body = `ℹ️ AI đang tắt (nhắn "start AI" để bật lại):\n\n${rawList(stories)}`;
  } else try {
    const items = await classify(stories);
    // Gom theo chủ đề, giữ thứ tự xuất hiện. Link lấy từ HN, không lấy từ AI
    const topics = new Map();
    for (const i of items) {
      const s = byId.get(i.id);
      if (!s) continue;
      const topic = i.topic.trim();
      if (!topics.has(topic)) topics.set(topic, []);
      topics.get(topic).push(`• ${i.summary.trim()}\n  ${linkOf(s)}`);
    }
    // Mỗi tin cách một dòng trống để sendTelegram tách được khi một chủ đề quá dài
    body = [...topics].map(([topic, lines]) => `📌 ${topic}\n\n${lines.join('\n\n')}`).join('\n\n');
  } catch (err) {
    // Ollama hết quota, lỗi mạng, trả sai định dạng... → gửi tiêu đề gốc
    console.error('AI lỗi, gửi tiêu đề gốc:', err.message);
    body = `⚠️ AI không khả dụng, đây là tiêu đề gốc:\n\n${rawList(stories)}`;
  }

  if (body) {
    await sendTelegram(`📰 Hacker News ${now}\n\n${body}`);
    console.log(`Đã gửi bản tin ${now}`);
  } else {
    console.log(`${ids.length} bài mới, không bài nào thuộc phạm vi`);
  }

  // Chỉ đánh dấu đã xem sau khi gửi thành công; gửi lỗi thì lần sau thử lại
  await writeFile(SEEN_FILE, JSON.stringify([...seen, ...ids].slice(-SEEN_MAX)));
}

if (process.argv.includes('--now')) {
  await run();
} else {
  listenCommands();
  for (;;) {
    await run().catch((err) => console.error('Chạy bản tin thất bại:', err));
    await sleep(INTERVAL_HOURS * 3_600_000);
  }
}
