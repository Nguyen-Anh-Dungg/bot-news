function required(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`Thiếu biến môi trường ${name} (xem .env.example)`);
  return value;
}

export const OLLAMA_API_KEY = required('OLLAMA_API_KEY');
export const OLLAMA_MODEL = process.env.OLLAMA_MODEL || 'gpt-oss:120b';
export const TELEGRAM_TOKEN = required('TELEGRAM_TOKEN');
export const TELEGRAM_CHAT_ID = required('TELEGRAM_CHAT_ID');

export const MIN_POINTS = Number(process.env.MIN_POINTS) || 20; // bài dưới ngưỡng điểm chưa được lấy, đủ điểm thì lần sau lấy
export const MAX_ITEMS = Number(process.env.MAX_ITEMS) || 15; // số bài tối đa mỗi bản tin
export const LOOKBACK_HOURS = 24;
export const INTERVAL_HOURS = 2;
export const SEEN_MAX = 1000;

// Nằm ở thư mục gốc cạnh src/, deploy không ghi đè
export const SEEN_FILE = new URL('../seen.json', import.meta.url);
export const SETTINGS_FILE = new URL('../settings.json', import.meta.url);

// Phạm vi tin cần lấy. Thêm lĩnh vực mới: thêm một dòng
export const SCOPE = [
  'công nghệ: phần mềm, lập trình, AI, phần cứng, bảo mật, khoa học máy tính',
  'business: startup, công ty, gọi vốn, thị trường, kinh tế, sản phẩm',
];
