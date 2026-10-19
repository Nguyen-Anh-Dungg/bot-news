import { setTimeout as sleep } from 'node:timers/promises';
import { TELEGRAM_CHAT_ID } from './config.ts';
import { saveSettings, settings } from './store.ts';
import { getUpdates, sendTelegram } from './telegram.ts';

const COMMANDS: Record<string, { ai: boolean; reply: string }> = {
  stopai: { ai: false, reply: '⏸️ Đã tắt AI. Từ lần gửi sau bot gửi tiêu đề gốc.' },
  startai: { ai: true, reply: '▶️ Đã bật AI. Từ lần gửi sau bot lọc và giải thích tin bằng AI.' },
};

// Nhận lệnh Telegram, chạy song song với vòng gửi tin
export async function listenCommands(): Promise<never> {
  let offset = 0;
  for (;;) {
    try {
      for (const u of await getUpdates(offset)) {
        offset = u.update_id + 1;
        // Chỉ nhận lệnh từ chính chủ
        if (!u.message || String(u.message.chat.id) !== TELEGRAM_CHAT_ID) continue;
        const cmd = COMMANDS[u.message.text?.toLowerCase().replace(/[\s/]/g, '') ?? ''];
        if (cmd) {
          settings.ai = cmd.ai;
          await saveSettings();
        }
        await sendTelegram(
          cmd?.reply ??
            `Lệnh hỗ trợ:\n• stop AI: tắt AI, gửi tiêu đề gốc\n• start AI: bật lại AI\n\nAI hiện đang ${settings.ai ? 'bật' : 'tắt'}.`,
        );
      }
    } catch (err) {
      console.error('Nhận lệnh Telegram lỗi:', (err as Error).message);
      await sleep(5000);
    }
  }
}
