import { TELEGRAM_CHAT_ID, TELEGRAM_TOKEN } from './config.ts';

const api = (method: string) => `https://api.telegram.org/bot${TELEGRAM_TOKEN}/${method}`;

export interface Update {
  update_id: number;
  message?: { chat: { id: number }; text?: string };
}

export async function sendTelegram(text: string): Promise<void> {
  // Telegram giới hạn 4096 ký tự mỗi tin → tách theo đoạn
  const chunks: string[] = [];
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
    const res = await fetch(api('sendMessage'), {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ chat_id: TELEGRAM_CHAT_ID, text: chunk, link_preview_options: { is_disabled: true } }),
    });
    if (!res.ok) throw new Error(`Telegram ${res.status}: ${await res.text()}`);
  }
}

// Long polling: chờ tối đa 50 giây cho tới khi có tin nhắn mới
export async function getUpdates(offset: number): Promise<Update[]> {
  const res = await fetch(`${api('getUpdates')}?timeout=50&offset=${offset}`);
  if (!res.ok) throw new Error(`Telegram ${res.status}: ${await res.text()}`);
  return ((await res.json()) as { result: Update[] }).result;
}
