import { MAX_ITEMS, OLLAMA_API_KEY, OLLAMA_MODEL, SCOPE } from './config.ts';
import type { Story } from './hn.ts';

export interface Item {
  id: number;
  topic: string;
  summary: string;
}

export async function classify(stories: Story[]): Promise<Item[]> {
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

Chọn TỐI ĐA ${MAX_ITEMS} bài đáng đọc nhất. Số trong [..đ] là điểm vote trên Hacker News: ưu tiên bài điểm cao. Thà bỏ sót còn hơn chọn bài nhạt.

Với mỗi bài được chọn:
- "topic": tên chủ đề ngắn bằng tiếng Việt do bạn tự đặt theo nội dung, ví dụ "Lập trình web", "Thuật toán", "AI", "Bảo mật", "Startup". Các bài cùng chủ đề phải dùng đúng cùng một tên. Tổng cộng không quá 7 chủ đề.
- "summary": 1-2 câu tiếng Việt GIẢI THÍCH bài này nói về cái gì và vì sao đáng chú ý (công cụ/công ty/khái niệm đó là gì, bối cảnh). KHÔNG được chỉ dịch lại tiêu đề. Nếu không chắc nội dung, nói bài có khả năng bàn về điều gì, không bịa chi tiết. Giữ nguyên thuật ngữ kỹ thuật tiếng Anh.

Chỉ trả về JSON thuần, không bọc trong \`\`\`, đúng dạng: {"items":[{"id":123,"topic":"...","summary":"..."}]}`,
        },
        {
          role: 'user',
          content: stories
            .map((s) => `${s.id} [${s.score}đ]: ${s.title}${s.url ? ` (${new URL(s.url).hostname})` : ''}`)
            .join('\n'),
        },
      ],
    }),
  });
  if (!res.ok) throw new Error(`Ollama ${res.status}: ${await res.text()}`);
  const data = (await res.json()) as { message: { content: string } };
  return parseItems(data.message.content);
}

// Ollama Cloud không luôn tuân theo `format`: có lúc bọc ```json, có lúc đổi tên hoặc bỏ khoá "items"
export function parseItems(content: string): Item[] {
  const json: unknown = JSON.parse(content.replace(/^\s*```(?:json)?\s*|\s*```\s*$/g, ''));
  const items = Array.isArray(json)
    ? json
    : Object.values(json as Record<string, unknown>).find(Array.isArray);
  if (!items) throw new Error(`AI trả sai định dạng: ${content.slice(0, 200)}`);
  return items.filter(
    (i): i is Item => Number.isInteger(i?.id) && typeof i.topic === 'string' && typeof i.summary === 'string',
  );
}
