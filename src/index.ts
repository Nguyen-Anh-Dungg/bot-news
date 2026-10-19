// Bản tin Hacker News: lấy bài đủ điểm trong 24h → AI (Ollama Cloud) lọc, gom theo chủ đề và giải thích ngắn → gửi Telegram.
// Mỗi INTERVAL_HOURS kiểm tra một lần, chỉ gửi bài chưa từng gửi.
// Nhắn bot "stop AI" / "start AI" để tắt / bật AI (tắt thì gửi tiêu đề gốc).
// Chạy nền (pm2): pm2 start ecosystem.config.cjs
// Chạy một lần:   npm run now
import { setTimeout as sleep } from 'node:timers/promises';
import { listenCommands } from './commands.ts';
import { INTERVAL_HOURS } from './config.ts';
import { runDigest } from './digest.ts';

if (process.argv.includes('--now')) {
  await runDigest();
} else {
  listenCommands();
  for (;;) {
    await runDigest().catch((err) => console.error('Chạy bản tin thất bại:', err));
    await sleep(INTERVAL_HOURS * 3_600_000);
  }
}
