export type TextSegment =
  | { type: 'text'; value: string }
  | { type: 'url'; value: string }
  | { type: 'phone'; value: string }
  | { type: 'link'; label: string; url: string };

export function parseLinksAndPhones(text: string): TextSegment[] {
  if (!text || !text.trim()) return [{ type: 'text', value: text }];
  const all: { index: number; end: number; seg: TextSegment }[] = [];
  let m: RegExpExecArray | null;

  const linkRe = /\[([^\]]*)\]\(([^)]*)\)/g;
  linkRe.lastIndex = 0;
  while ((m = linkRe.exec(text)) !== null) {
    const label = m[1] || m[2];
    const url = m[2].trim();
    if (url) all.push({ index: m.index, end: m.index + m[0].length, seg: { type: 'link', label, url } });
  }

  const urlRe = /https?:\/\/[^\s]+|www\.[^\s]+/gi;
  urlRe.lastIndex = 0;
  while ((m = urlRe.exec(text)) !== null) {
    if (!all.some((a) => a.index <= m!.index && a.end >= m!.index + m![0].length)) {
      all.push({ index: m.index, end: m.index + m[0].length, seg: { type: 'url', value: m[0] } });
    }
  }

  const phoneRe = /\+?[78][\s\-\(\)]*\d[\d\s\-\(\)]{9,}/g;
  phoneRe.lastIndex = 0;
  while ((m = phoneRe.exec(text)) !== null) {
    if (!all.some((a) => a.index <= m!.index && a.end >= m!.index + m![0].length)) {
      all.push({ index: m.index, end: m.index + m[0].length, seg: { type: 'phone', value: m[0] } });
    }
  }

  all.sort((a, b) => a.index - b.index);
  const segments: TextSegment[] = [];
  let last = 0;
  for (const { index, end, seg } of all) {
    if (index > last) segments.push({ type: 'text', value: text.slice(last, index) });
    segments.push(seg);
    last = end;
  }
  if (last < text.length) segments.push({ type: 'text', value: text.slice(last) });
  return segments.length ? segments : [{ type: 'text', value: text }];
}
