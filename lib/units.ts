export const MM_PER_INCH = 25.4;
export const A5 = { widthMm: 148, heightMm: 210 } as const;
export type PaperFormat = "A4" | "A5" | "A6" | "Letter";
export const PAPER_SIZES: Record<
  PaperFormat,
  { widthMm: number; heightMm: number }
> = {
  A4: { widthMm: 210, heightMm: 297 },
  A5: { widthMm: 148, heightMm: 210 },
  A6: { widthMm: 105, heightMm: 148 },
  Letter: { widthMm: 215.9, heightMm: 279.4 },
};
export function mmToPx(mm: number, dpi: number) {
  return (mm / MM_PER_INCH) * dpi;
}
export function pxToMm(px: number, dpi: number) {
  return (px / dpi) * MM_PER_INCH;
}
export function mmToPt(mm: number) {
  return (mm / MM_PER_INCH) * 72;
}
export function ptToMm(pt: number) {
  return (pt / 72) * MM_PER_INCH;
}
export function pageSize(
  orientation: "portrait" | "landscape",
  format: PaperFormat = "A5",
) {
  const paper = PAPER_SIZES[format];
  return orientation === "portrait"
    ? paper
    : { widthMm: paper.heightMm, heightMm: paper.widthMm };
}
