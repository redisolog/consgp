export type PageLine = {
  text: string;
  xMm: number;
  yMm: number;
  kind: "body" | "heading" | "list";
};
type LayoutSettings = {
  marginTop: number;
  marginRight: number;
  marginBottom: number;
  marginLeft: number;
  fontMm: number;
  headingFontMm?: number;
  handwriting?: string;
  lineFillPercent?: number;
  scaleX?: number;
  lineMm: number;
  indentMm: number;
  paragraphMm: number;
};
export function createPages(
  source: string,
  size: { widthMm: number; heightMm: number },
  s: LayoutSettings,
): PageLine[][] {
  const maxWidth = size.widthMm - s.marginLeft - s.marginRight;
  // Handwriting fonts are much wider than a typical UI font. Measuring by
  // character count made Cyrillic lines escape the right margin. This
  // conservative metric mirrors Segoe Print/Comic Sans and keeps 2 mm spare.
  const textWidthMm = (value: string, heading = false) => {
    const em = [...value].reduce((width, char) => {
      if (char === " ") return width + 0.34;
      if (/[МШЩЖФЫЮW]/u.test(char)) return width + 0.9;
      if (/[A-ZА-ЯЁ0-9]/u.test(char)) return width + 0.78;
      if (/[.,:;!|'il]/u.test(char)) return width + 0.34;
      return width + 0.65;
    }, 0);
    const fontMm = heading ? (s.headingFontMm ?? s.fontMm) : s.fontMm;
    const handwritingFactor =
      s.handwriting === "eskal"
        ? 0.68
        : s.handwriting === "custom"
          ? 0.84
          : s.handwriting === "compact"
            ? 0.82
            : 1;
    const fillFactor = 100 / Math.max(50, s.lineFillPercent ?? 100);
    const horizontalScale = (s.scaleX ?? 100) / 100;
    return (
      em *
      fontMm *
      (heading ? 1.06 : 1) *
      handwritingFactor *
      fillFactor *
      horizontalScale
    );
  };
  const maxY = size.heightMm - s.marginBottom;
  const pages: PageLine[][] = [[]];
  let y = s.marginTop;
  let first = true;
  const add = (text: string, kind: PageLine["kind"], indent = 0) => {
    const lineHeight = Math.max(
      s.lineMm,
      (kind === "heading" ? (s.headingFontMm ?? s.fontMm) : s.fontMm) * 1.25,
    );
    if (y + lineHeight > maxY) {
      pages.push([]);
      y = s.marginTop;
    }
    pages.at(-1)!.push({ text, xMm: s.marginLeft + indent, yMm: y, kind });
    y += lineHeight;
  };
  for (const raw of source.replace(/\r/g, "").split("\n")) {
    const clean = raw.trim();
    if (!clean) {
      y += s.paragraphMm;
      first = true;
      continue;
    }
    const heading = /^#{1,3}\s/.test(clean);
    const list = /^(?:[-*•] |\d+[.)] )/.test(clean);
    const value = heading ? clean.replace(/^#{1,3}\s*/, "") : clean;
    const words = value.split(/\s+/);
    let line = "";
    let lineNo = 0;
    for (const word of words) {
      const candidate = (line + " " + word).trim();
      const indent =
        !heading && !list && first && lineNo === 0 ? s.indentMm : 0;
      // Keep a generous handwriting reserve: glyph widths vary considerably
      // between installed Windows cursive fonts, especially in Cyrillic.
      // Wrapping one word earlier is preferable to crossing the print margin.
      const reserve = s.handwriting === "eskal" ? 2.5 : 8;
      const availableWidth = maxWidth - indent - reserve;
      if (textWidthMm(candidate, heading) > availableWidth && line) {
        add(
          line,
          heading ? "heading" : list ? "list" : "body",
          !heading && !list && first && lineNo === 0 ? s.indentMm : 0,
        );
        line = word;
        lineNo++;
      } else line = candidate;
    }
    if (line)
      add(
        line,
        heading ? "heading" : list ? "list" : "body",
        !heading && !list && first && lineNo === 0 ? s.indentMm : 0,
      );
    y += heading ? s.paragraphMm * 1.4 : s.paragraphMm;
    first = false;
  }
  return pages.filter((p) => p.length);
}
export const DEMO_TEXT = `# Как память создаёт знание
Память — это не склад фактов, а живой процесс реконструкции. Каждое воспоминание собирается заново из смысла, контекста и эмоций.

## Три этапа
1. Кодирование — новая информация связывается с уже известным.
2. Консолидация — след укрепляется во время отдыха и сна.
3. Извлечение — активное воспроизведение усиливает след.

## Эффект интервалов
Повторение работает лучше, когда между подходами есть пауза. Лёгкое забывание делает следующее извлечение более трудным и потому более полезным.

• Повторить через день
• Затем через три дня
• Затем через неделю

## Метод активного вызова
Закройте конспект и попробуйте восстановить основную мысль своими словами. После этого сверьте ответ с источником и отметьте пробелы.

# Практика
Хороший конспект не копирует источник. Он выделяет связи, сжимает формулировки и оставляет место для собственных вопросов.

## Шаблон заметки
— Главная идея
— Три ключевых термина
— Один пример
— Один вопрос к теме

Самопроверка: могу ли я объяснить тему без подсказки?`;
