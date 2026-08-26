/* eslint-disable react-hooks/set-state-in-effect, jsx-a11y/label-has-associated-control, jsx-a11y/no-autofocus, jsx-a11y/no-static-element-interactions, jsx-a11y/click-events-have-key-events, jsx-a11y/no-noninteractive-element-interactions */
"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import JSZip from "jszip";
import { PDFDocument, degrees, rgb, StandardFonts } from "pdf-lib";
import { Capacitor, registerPlugin } from "@capacitor/core";

type AndroidPrintPlugin = {
  systemPrint(options: { base64: string; name: string; format: string; landscape: boolean; color: boolean }): Promise<void>;
  openInPrintApp(options: { base64: string; name: string; format: string; landscape: boolean; color: boolean }): Promise<void>;
  chooseFile(): Promise<void>;
};
const AndroidPrint = registerPlugin<AndroidPrintPlugin>("AndroidPrint");

declare global {
  interface Window {
    desktopPrint?: {
      getPrinters: () => Promise<
        {
          name: string;
          displayName?: string;
          isDefault?: boolean;
          status?: number;
        }[]
      >;
      setIcon: (dataUrl: string) => Promise<boolean>;
      setThemeChrome: (colors: { color: string; symbolColor: string }) => Promise<boolean>;
      print: (payload: Record<string, unknown>) => Promise<{
        success: boolean;
        failureReason?: string;
      }>;
    };
  }
}
import { mmToPt, mmToPx, pageSize, type PaperFormat } from "../lib/units";
import { createPages, DEMO_TEXT, type PageLine } from "../lib/layout";

type Orientation = "portrait" | "landscape";
type Grid = 0 | 1 | 2 | 5 | 10;
type Tab = "document" | "design" | "page";
type Tool = "cursor" | "hand" | "text" | "pen" | "pencil" | "marker" | "eraser";
type Point = { x: number; y: number };
type Stroke = {
  id: string;
  page: number;
  tool: "pen" | "pencil" | "marker";
  color: string;
  width: number;
  opacity?: number;
  points: Point[];
};
type LineStyle = {
  color?: string;
  fontMm?: number;
  slant?: number;
  opacity?: number;
  bold?: boolean;
  italic?: boolean;
  underline?: boolean;
  strike?: boolean;
  lineMm?: number;
  inkThicknessMm?: number;
  scaleX?: number;
};
type ImageElement = {
  id: string;
  page: number;
  src: string;
  x: number;
  y: number;
  width: number;
  height: number;
};
type EditorSnapshot = {
  text: string;
  settings: Settings;
  strokes: Stroke[];
  layers: { text: boolean; drawing: boolean; background: boolean };
  elementOffsets: Record<string, Point>;
  lineStyles: Record<string, LineStyle>;
  images: ImageElement[];
};

type Settings = {
  orientation: Orientation;
  paperFormat: PaperFormat;
  marginTop: number;
  marginRight: number;
  marginBottom: number;
  marginLeft: number;
  fontMm: number;
  headingFontMm: number;
  lineMm: number;
  indentMm: number;
  paragraphMm: number;
  color: string;
  opacity: number;
  grid: Grid;
  zoom: number;
  safeMm: number;
  showSafe: boolean;
  showMargins: boolean;
  handwriting: string;
  customFontName: string;
  customFontData: string;
  jitter: number;
  lineStartVariationMm: number;
  slant: number;
  baseline: number;
  seed: number;
  dpi: 150 | 300 | 600;
  offsetX: number;
  offsetY: number;
  scaleX: number;
  lineFillPercent: number;
  scaleY: number;
  printerName: string;
  backgroundColor: string;
  backgroundImage: string;
  backgroundOpacity: number;
  deskTheme:
    | "sage"
    | "graphite"
    | "sand"
    | "rose"
    | "lavender"
    | "ocean"
    | "peach"
    | "midnight"
    | "aurora";
  rulerColor: "classic" | "pink" | "blue" | "mint" | "purple" | "dark";
  uiTheme:
    | "classic"
    | "kawaii"
    | "dark"
    | "halloween"
    | "mint"
    | "sunset"
    | "ocean"
    | "lavender"
    | "coffee"
    | "candy"
    | "forest"
    | "neon" | "light" | "night" | "berry" | "arctic";
  markerColor: string;
  markerWidth: number;
  markerOpacity: number;
  bindingSide: "none" | "left" | "right";
  bindingGutterMm: number;
  holeCount: number;
  printCopies: number;
  printColor: boolean;
  printDuplex: "simplex" | "longEdge" | "shortEdge";
  printTextScale: number;
  inkThicknessMm: number;
  headingInkThicknessMm: number;
  textBold: boolean;
  textItalic: boolean;
  textUnderline: boolean;
  textStrike: boolean;
  headingColor: string;
  headingScaleX: number;
  appIcon: "coral" | "kawaii" | "moon" | "mint";
  language: "ru" | "en";
};

const defaults: Settings = {
  orientation: "portrait",
  paperFormat: "A5",
  marginTop: 12,
  marginRight: 12,
  marginBottom: 12,
  marginLeft: 15,
  fontMm: 3.8,
  headingFontMm: 4.8,
  lineMm: 6.5,
  indentMm: 8,
  paragraphMm: 2,
  color: "#15386c",
  opacity: 0.96,
  grid: 0,
  zoom: 82,
  safeMm: 5,
  showSafe: true,
  showMargins: true,
  handwriting: "notebook",
  customFontName: "",
  customFontData: "",
  jitter: 0.08,
  lineStartVariationMm: 0.8,
  slant: 0,
  baseline: 0.13,
  seed: 2718,
  dpi: 300,
  offsetX: 0,
  offsetY: 0,
  scaleX: 100,
  lineFillPercent: 100,
  scaleY: 100,
  printerName: "Мой принтер",
  backgroundColor: "#fffefa",
  backgroundImage: "",
  backgroundOpacity: 0.35,
  deskTheme: "sage",
  rulerColor: "classic",
  uiTheme: "classic",
  markerColor: "#ffd84d",
  markerWidth: 4.5,
  markerOpacity: 0.35,
  bindingSide: "none",
  bindingGutterMm: 8,
  holeCount: 4,
  printCopies: 1,
  printColor: true,
  printDuplex: "simplex",
  printTextScale: 100,
  inkThicknessMm: 0.22,
  headingInkThicknessMm: 0.3,
  textBold: false,
  textItalic: false,
  textUnderline: false,
  textStrike: false,
  headingColor: "#15386c",
  headingScaleX: 100,
  appIcon: "coral",
  language: "ru",
};

const tabs: { id: Tab; label: string; icon: string }[] = [
  { id: "document", label: "Конспект", icon: "✎" },
  { id: "design", label: "Оформление", icon: "◐" },
  { id: "page", label: "Страница", icon: "▤" },
];

function NumberField({
  label,
  value,
  onChange,
  suffix = "мм",
  step = 0.1,
}: {
  label: string;
  value: number;
  onChange: (n: number) => void;
  suffix?: string;
  step?: number;
}) {
  return (
    <label className="field">
      <span>{label}</span>
      <div className="number-wrap">
        <input
          type="number"
          value={value}
          step={step}
          onChange={(e) => onChange(Number(e.target.value))}
        />
        <em>{suffix}</em>
      </div>
    </label>
  );
}

export default function Home() {
  const isAndroid = Capacitor.getPlatform() === "android" || (typeof window !== "undefined" && new URLSearchParams(window.location.search).has("android-preview"));
  const [settings, setSettings] = useState<Settings>(defaults);
  const [text, setText] = useState(DEMO_TEXT);
  const [tab, setTab] = useState<Tab>("document");
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [settingsTab, setSettingsTab] = useState<"general" | "themes" | "pages" | "docs">("general");
  const [homeOpen, setHomeOpen] = useState(() => typeof window === "undefined" || !new URLSearchParams(window.location.search).has("editor"));
  const [printDialogOpen, setPrintDialogOpen] = useState(false);
  const [topMenuOpen, setTopMenuOpen] = useState(false);
  const [documentTitle, setDocumentTitle] = useState("Новый конспект");
  const [leftWidth, setLeftWidth] = useState(390);
  const [rightWidth, setRightWidth] = useState(360);
  const [editingKey, setEditingKey] = useState<string | null>(null);
  const [pageFlow, setPageFlow] = useState<"single" | "continuous">(() => typeof window !== "undefined" && new URLSearchParams(window.location.search).has("continuous") ? "continuous" : "single");
  const [eraserWidth, setEraserWidth] = useState(3);
  const [pencilWidth, setPencilWidth] = useState(.35);
  const [pencilOpacity, setPencilOpacity] = useState(.72);
  const [markerStraight, setMarkerStraight] = useState(false);
  const [activeToolMenu, setActiveToolMenu] = useState<"pencil" | "marker" | "eraser" | null>(null);
  const [canvasPan, setCanvasPan] = useState<Point>({x:0,y:0});
  const erasingRef = useRef(false);
  const [pageIndex, setPageIndex] = useState(0);
  const [sourceOpen, setSourceOpen] = useState(false);
  const [exportOpen, setExportOpen] = useState(false);
  const [toast, setToast] = useState("");
  const [saved, setSaved] = useState(true);
  const debug = false;
  const showLegacyPanels = false;
  const [guides, setGuides] = useState<number[]>([]);
  const [tool, setTool] = useState<Tool>("cursor");
  const [strokes, setStrokes] = useState<Stroke[]>([]);
  const [activeStroke, setActiveStroke] = useState<Stroke | null>(null);
  const activeStrokeRef = useRef<Stroke | null>(null);
  const [layers, setLayers] = useState({
    text: true,
    drawing: true,
    background: true,
  });
  const [elementOffsets, setElementOffsets] = useState<Record<string, Point>>(
    {},
  );
  const [selectedKey, setSelectedKey] = useState<string | null>(null);
  const [selectAll, setSelectAll] = useState(false);
  const [lineStyles, setLineStyles] = useState<Record<string, LineStyle>>({});
  const [fileOpen, setFileOpen] = useState(false);
  const [images, setImages] = useState<ImageElement[]>([]);
  const [selectedImage, setSelectedImage] = useState<string | null>(null);
  const [spaceDown, setSpaceDown] = useState(false);
  const [printers, setPrinters] = useState<
    {
      name: string;
      displayName?: string;
      isDefault?: boolean;
      status?: number;
    }[]
  >([]);
  const [printPreview, setPrintPreview] = useState(false);
  const [printPreviewHtml, setPrintPreviewHtml] = useState("");
  const [printing, setPrinting] = useState(false);
  const [mobilePanel, setMobilePanel] = useState<"document" | "design" | "page" | "properties" | null>(null);
  const [mobileMoreOpen, setMobileMoreOpen] = useState(false);
  const [printPageSelection, setPrintPageSelection] = useState<"all" | "current" | "custom">("all");
  const [printCustomPages, setPrintCustomPages] = useState("1");
  const [lastCommitted, setLastCommitted] = useState<{
    time: string;
    left: number;
    right: number;
    format: PaperFormat;
  } | null>(null);
  const paperRef = useRef<HTMLElement | null>(null);
  const drawingCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const deskRef = useRef<HTMLDivElement | null>(null);
  const continuousSheetRefs = useRef<Array<HTMLElement | null>>([]);
  const pinchRef = useRef<{ distance: number; zoom: number } | null>(null);
  const imageCacheRef = useRef<Record<string, HTMLImageElement>>({});
  const loadedCustomFontRef = useRef("");
  const customFontFaceRef = useRef<FontFace | null>(null);
  const history = useRef<EditorSnapshot[]>([]);
  const future = useRef<EditorSnapshot[]>([]);
  const fileCloseTimerRef = useRef<number | null>(null);
  const fileMenuRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!topMenuOpen) return;
    const trackDistance = (event: PointerEvent) => {
      const rect = fileMenuRef.current?.getBoundingClientRect();
      if (!rect) return;
      const isFar = event.clientX < rect.left - 90 || event.clientX > rect.right + 90 || event.clientY < rect.top - 70 || event.clientY > rect.bottom + 90;
      if (isFar && !fileCloseTimerRef.current) fileCloseTimerRef.current = window.setTimeout(() => { setTopMenuOpen(false); fileCloseTimerRef.current = null; }, 350);
      if (!isFar && fileCloseTimerRef.current) { window.clearTimeout(fileCloseTimerRef.current); fileCloseTimerRef.current = null; }
    };
    window.addEventListener("pointermove", trackDistance, { passive: true });
    return () => window.removeEventListener("pointermove", trackDistance);
  }, [topMenuOpen]);

  useEffect(() => {
    const ruEn: Record<string,string> = {"Главная":"Home","Файл":"File","Сохранить":"Save","Скопировать":"Copy","Экспорт":"Export","Настройки":"Settings","Печать":"Print","Конспект":"Notes","Оформление":"Style","Страница":"Page","Свойства":"Properties","Высота текста":"Text height","Толщина чернил":"Ink thickness","Цвет текста":"Text color","Заголовки":"Headings","Высота":"Height","Жирность":"Weight","Ширина":"Width","Цвет":"Color","Наклон":"Slant","Интервал строки":"Line spacing","Сбросить стиль строки":"Reset line style","Фон листа":"Paper background","Своя картинка":"My image","Выбрать картинку":"Choose image","Убрать фон":"Remove background","Прозрачность":"Opacity","По одной":"Single page","Вертикальная лента":"Vertical flow","Просмотр страниц":"Page view","Темы":"Themes","Основные":"General","Готово":"Done","Карандаш":"Pencil","Маркер":"Highlighter","Ластик":"Eraser","Диаметр":"Diameter","Толщина":"Thickness","Ровная линия":"Straight line","Исходный материал":"SOURCE","Сохранить и показать конспект":"Save and show notes","Выравнять макет":"Align layout","Создать новый конспект":"Create new notes","Открыть редактор":"Open editor"};
    const enRu = Object.fromEntries(Object.entries(ruEn).map(([ru,en])=>[en,ru]));
    const dictionary = settings.language === "en" ? ruEn : enRu;
    const translate = () => {
      const walker=document.createTreeWalker(document.body,NodeFilter.SHOW_TEXT); let node:Node|null;
      while((node=walker.nextNode())){const raw=node.nodeValue||"",trimmed=raw.trim(),next=dictionary[trimmed];if(next)node.nodeValue=raw.replace(trimmed,next)}
    };
    translate(); const observer=new MutationObserver(translate);observer.observe(document.body,{childList:true,subtree:true});
    return ()=>observer.disconnect();
  }, [settings.language]);

  const size = pageSize(settings.orientation, settings.paperFormat);
  // Effective margins include the optional binding gutter. Memoization keeps
  // pagination stable and prevents an unnecessary full document recalculation.
  const layoutSettings = useMemo(() => {
    const safe = settings.showSafe ? settings.safeMm : 0;
    return {
      ...settings,
      marginTop: Math.max(settings.marginTop, safe),
      marginBottom: Math.max(settings.marginBottom, safe),
      marginLeft: Math.max(settings.marginLeft + (settings.bindingSide === "left" ? settings.bindingGutterMm : 0), safe),
      marginRight: Math.max(settings.marginRight + (settings.bindingSide === "right" ? settings.bindingGutterMm : 0), safe),
    };
  }, [settings]);
  const pages = useMemo(
    () => createPages(text, size, layoutSettings),
    [text, size, layoutSettings],
  );
  const page = pages[Math.min(pageIndex, pages.length - 1)] || [];
  const scale = (settings.zoom / 100) * 3.15;
  useEffect(() => {
    if (!isAndroid) return;
    const fit = Math.max(25, Math.min(140, ((window.innerWidth - 28) / (size.widthMm * 3.15)) * 100));
    setSettings((current) => Math.abs(current.zoom - fit) < 1 ? current : ({ ...current, zoom: Math.round(fit) }));
    setCanvasPan({ x: 0, y: 0 });
  }, [isAndroid, size.widthMm, size.heightMm]);
  const mobileTouchStart = (event: React.TouchEvent) => {
    if (!isAndroid || event.touches.length !== 2) return;
    const [a, b] = [event.touches[0], event.touches[1]];
    pinchRef.current = { distance: Math.hypot(a.clientX - b.clientX, a.clientY - b.clientY), zoom: settings.zoom };
  };
  const mobileTouchMove = (event: React.TouchEvent) => {
    if (!isAndroid || event.touches.length !== 2 || !pinchRef.current) return;
    event.preventDefault();
    const [a, b] = [event.touches[0], event.touches[1]];
    const distance = Math.hypot(a.clientX - b.clientX, a.clientY - b.clientY);
    const zoom = Math.max(25, Math.min(400, pinchRef.current.zoom * distance / Math.max(1, pinchRef.current.distance)));
    setSettings((current) => ({ ...current, zoom: Math.round(zoom) }));
  };
  const mobileTouchEnd = (event: React.TouchEvent) => {
    if (event.touches.length < 2) pinchRef.current = null;
  };
  const captureSnapshot = useCallback((): EditorSnapshot => ({
    text, settings, strokes, layers, elementOffsets, lineStyles, images,
  }), [elementOffsets, images, layers, lineStyles, settings, strokes, text]);
  const restoreSnapshot = useCallback((snapshot: EditorSnapshot) => {
    setText(snapshot.text); setSettings(snapshot.settings); setStrokes(snapshot.strokes);
    setLayers(snapshot.layers); setElementOffsets(snapshot.elementOffsets);
    setLineStyles(snapshot.lineStyles); setImages(snapshot.images);
    setSelectedKey(null); setSelectedImage(null); setSelectAll(false);
  }, [setElementOffsets, setImages, setLayers, setLineStyles, setSelectedImage, setSelectedKey, setSelectAll, setSettings, setStrokes, setText]);
  const recordHistory = useCallback(() => {
    history.current.push(captureSnapshot()); future.current = [];
    if (history.current.length > 50) history.current.shift();
  }, [captureSnapshot]);

  useEffect(() => {
    const canvas = drawingCanvasRef.current;
    if (!canvas) return;
    const dpr = Math.max(1, window.devicePixelRatio || 1);
    const width = Math.max(1, Math.round(size.widthMm * scale));
    const height = Math.max(1, Math.round(size.heightMm * scale));
    canvas.width = Math.round(width * dpr);
    canvas.height = Math.round(height * dpr);
    const context = canvas.getContext("2d");
    if (!context) return;
    context.setTransform(dpr, 0, 0, dpr, 0, 0);
    context.clearRect(0, 0, width, height);
    for (const stroke of strokes.filter((item) => item && item.page === pageIndex)) {
      if (stroke.points.length < 2) continue;
      context.beginPath();
      stroke.points.forEach((point, index) => {
        const x = point.x * scale, y = point.y * scale;
        if (index === 0) context.moveTo(x, y); else context.lineTo(x, y);
      });
      context.strokeStyle = stroke.color;
      context.lineWidth = Math.max(0.6, stroke.width * scale);
      context.lineCap = "round";
      context.lineJoin = "round";
      context.globalAlpha = stroke.opacity ?? 1;
      context.stroke();
    }
    context.globalAlpha = 1;
  }, [pageIndex, scale, size.heightMm, size.widthMm, strokes]);

  useEffect(() => {
    const canvas = drawingCanvasRef.current;
    if (!canvas) return;
    let current: Stroke | null = null;
    const point = (event: PointerEvent): Point => {
      const rect = canvas.getBoundingClientRect();
      return {
        x: ((event.clientX - rect.left) / Math.max(1, rect.width)) * size.widthMm,
        y: ((event.clientY - rect.top) / Math.max(1, rect.height)) * size.heightMm,
      };
    };
    const erase = (target: Point) => setStrokes((items) => items.flatMap((stroke) => {
      if (stroke.page !== pageIndex) return [stroke];
      const segments: Point[][] = [];
      let segment: Point[] = [];
      for (const candidate of stroke.points) {
        if (Math.hypot(candidate.x - target.x, candidate.y - target.y) <= eraserWidth) {
          if (segment.length > 1) segments.push(segment);
          segment = [];
        } else segment.push(candidate);
      }
      if (segment.length > 1) segments.push(segment);
      return segments.map((points, index) => ({ ...stroke, id: `${stroke.id}-${Date.now()}-${index}`, points }));
    }));
    const down = (event: PointerEvent) => {
      if (!["pen", "pencil", "marker", "eraser"].includes(tool)) return;
      event.preventDefault();
      event.stopPropagation();
      try { canvas.setPointerCapture(event.pointerId); } catch { /* optional */ }
      const first = point(event);
      if (tool === "eraser") { erasingRef.current = true; erase(first); return; }
      current = {
        id: crypto.randomUUID(), page: pageIndex, tool: tool as "pen" | "pencil" | "marker",
        color: tool === "marker" ? settings.markerColor : settings.color,
        width: tool === "marker" ? settings.markerWidth : tool === "pencil" ? pencilWidth : .65,
        opacity: tool === "marker" ? settings.markerOpacity : tool === "pencil" ? pencilOpacity : 1,
        points: [first],
      };
    };
    const move = (event: PointerEvent) => {
      if (tool === "eraser" && erasingRef.current) { erase(point(event)); return; }
      if (!current) return;
      event.preventDefault();
      current.points.push(point(event));
      const context = canvas.getContext("2d");
      const count = current.points.length;
      if (context && count > 1) {
        const a = current.points[count - 2], b = current.points[count - 1];
        context.save();
        context.beginPath(); context.moveTo(a.x * scale, a.y * scale); context.lineTo(b.x * scale, b.y * scale);
        context.strokeStyle = current.color; context.lineWidth = Math.max(.6, current.width * scale);
        context.lineCap = "round"; context.lineJoin = "round"; context.globalAlpha = current.opacity ?? 1; context.stroke(); context.restore();
      }
    };
    const up = () => {
      erasingRef.current = false;
      const finished = current;
      if (finished && finished.points.length > 1) setStrokes((items) => [...items.filter(Boolean), finished]);
      current = null;
    };
    canvas.addEventListener("pointerdown", down);
    canvas.addEventListener("pointermove", move);
    canvas.addEventListener("pointerup", up);
    canvas.addEventListener("pointercancel", up);
    return () => {
      canvas.removeEventListener("pointerdown", down); canvas.removeEventListener("pointermove", move);
      canvas.removeEventListener("pointerup", up); canvas.removeEventListener("pointercancel", up);
    };
  }, [eraserWidth, pageIndex, pencilOpacity, pencilWidth, scale, settings.color, settings.markerColor, settings.markerOpacity, settings.markerWidth, size.heightMm, size.widthMm, tool]);
  const handwritingFont =
    (
      {
        notebook: "'Segoe Print','Comic Sans MS',cursive",
        quick: "'Comic Sans MS','Segoe Print',cursive",
        clean: "'Ink Free','Segoe Print',cursive",
        round: "'MV Boli','Comic Sans MS',cursive",
        school: "'Segoe Print','Comic Sans MS',cursive",
        compact: "'Comic Sans MS','Segoe Print',cursive",
        gel: "'Segoe Print','MV Boli',cursive",
        eskal: "'Eskal App','Segoe Print',cursive",
        elegant: "'Gabriola','Segoe Print',cursive",
        casual: "'Ink Free','Comic Sans MS',cursive",
        block: "'Trebuchet MS','Comic Sans MS',sans-serif",
        custom: "'User Custom Font','Segoe Print',cursive",
      } as Record<string, string>
    )[settings.handwriting] || "'Segoe Print','Comic Sans MS',cursive";
  const lineStartShift = (
    targetPage: number,
    lineIndex: number,
    line: PageLine,
  ) => {
    if (line.kind === "heading" || settings.lineStartVariationMm <= 0) return 0;
    // Deterministic: the same line has exactly the same position in preview,
    // PNG, PDF and printer output, while still looking naturally irregular.
    const noise =
      (Math.sin(
        (targetPage + 1) * 19.19 +
          (lineIndex + 1) * 8.73 +
          settings.seed * 0.017,
      ) +
        1) /
      2;
    return noise * settings.lineStartVariationMm;
  };

  const persistProject = useCallback((announce = false) => {
    localStorage.setItem(
      "a5-note-project",
      JSON.stringify({
        text,
        settings,
        strokes,
        layers,
        elementOffsets,
        lineStyles,
        images,
      }),
    );
    const committed = {
      time: new Date().toLocaleTimeString("ru-RU"),
      left: layoutSettings.marginLeft,
      right: layoutSettings.marginRight,
      format: settings.paperFormat,
    };
    setLastCommitted(committed);
    setSaved(true);
    if (announce) {
      setToast(
        `Сохранено: ${committed.format}, поля ${committed.left}/${committed.right} мм`,
      );
      window.setTimeout(() => setToast(""), 5000);
    }
  }, [elementOffsets, images, layers, layoutSettings, lineStyles, settings, strokes, text]);

  useEffect(() => {
    if (!printDialogOpen || !window.desktopPrint) return;
    window.desktopPrint.getPrinters().then((list) => {
      setPrinters(list);
      if (
        list.length &&
        !list.some((printer) => printer.name === settings.printerName)
      ) {
        const preferred = list.find((printer) => printer.isDefault) || list[0];
        setSettings((current) => ({
          ...current,
          printerName: preferred.name,
        }));
      }
    });
  }, [printDialogOpen, settings.printerName]);

  useEffect(() => {
    if (!window.desktopPrint) return;
    fetch(`./icons/app-icon-${settings.appIcon}.png`)
      .then((response) => response.blob())
      .then(
        (blob) =>
          new Promise<string>((resolve) => {
            const reader = new FileReader();
            reader.onload = () => resolve(String(reader.result));
            reader.readAsDataURL(blob);
          }),
      )
      .then((dataUrl) => window.desktopPrint?.setIcon(dataUrl))
      .catch(() => undefined);
  }, [settings.appIcon]);

  useEffect(() => {
    const dark = ["dark", "forest", "halloween", "neon"].includes(settings.uiTheme);
    const chromeColors: Partial<Record<Settings["uiTheme"], string>> = {
      classic: "#fffdfa", kawaii: "#fff7fb", mint: "#f5fff9", ocean: "#f5fbff",
      lavender: "#fbf8ff", coffee: "#fff9f2", candy: "#fff6fc", sunset: "#fff6f1",
      dark: "#1e2227", forest: "#203129", halloween: "#241b29", neon: "#191e31",
    };
    window.desktopPrint?.setThemeChrome({
      color: chromeColors[settings.uiTheme] || "#fffdfa",
      symbolColor: dark ? "#f4f5f6" : "#51464f",
    });
  }, [settings.uiTheme]);

  useEffect(() => {
    const raw = localStorage.getItem("a5-note-project");
    if (raw)
      try {
        const data = JSON.parse(raw);
        const oldSlant = data.settings?.slant;
        setText(data.text);
        setSettings({
          ...defaults,
          ...data.settings,
          slant: oldSlant === -2 ? 0 : (oldSlant ?? 0),
          printTextScale:
            data.settings?.printTextScale === 140
              ? 100
              : (data.settings?.printTextScale ?? 100),
        });
        setStrokes((data.strokes || []).filter(Boolean));
        setLayers({
          ...(data.layers || { text: true, background: true }),
          drawing: true,
        });
        setElementOffsets(data.elementOffsets || {});
        setLineStyles(data.lineStyles || {});
        setImages(data.images || []);
      } catch {
        localStorage.removeItem("a5-note-project");
      }
  }, []);
  useEffect(() => {
    try {
      const layout = JSON.parse(localStorage.getItem("polya-ui-layout") || "{}");
      if (layout.leftWidth) setLeftWidth(Math.max(320, Math.min(460, layout.leftWidth)));
      if (layout.rightWidth) setRightWidth(Math.max(320, Math.min(440, layout.rightWidth)));
      if (layout.pageFlow && !new URLSearchParams(window.location.search).has("continuous")) setPageFlow(layout.pageFlow);
    } catch { /* keep safe defaults */ }
  }, []);
  useEffect(() => {
    localStorage.setItem("polya-ui-layout",JSON.stringify({leftWidth,rightWidth,pageFlow}));
  }, [leftWidth,rightWidth,pageFlow]);
  useEffect(() => {
    setSaved(false);
    const id = setTimeout(() => {
      persistProject();
    }, 450);
    return () => clearTimeout(id);
  }, [persistProject]);

  useEffect(() => {
    const sources = [
      settings.backgroundImage,
      ...images.map((img) => img.src),
    ].filter(Boolean);
    sources.forEach((src) => {
      if (imageCacheRef.current[src]) return;
      const image = new Image();
      image.src = src;
      imageCacheRef.current[src] = image;
    });
  }, [settings.backgroundImage, images]);
  useEffect(() => {
    if (
      !settings.customFontData ||
      loadedCustomFontRef.current === settings.customFontData
    )
      return;
    const face = new FontFace(
      "User Custom Font",
      `url(${settings.customFontData})`,
    );
    face
      .load()
      .then((loaded) => {
        if (customFontFaceRef.current) {
          document.fonts.delete(customFontFaceRef.current);
        }
        document.fonts.add(loaded);
        customFontFaceRef.current = loaded;
        loadedCustomFontRef.current = settings.customFontData;
      })
      .catch(() => {
        setToast("Сохранённый пользовательский шрифт повреждён");
        window.setTimeout(() => setToast(""), 2200);
      });
  }, [settings.customFontData]);
  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement;
      const isTextEditing = /INPUT|TEXTAREA/.test(target.tagName) || target.isContentEditable;
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "s") {
        e.preventDefault();
        persistProject(true);
        return;
      }
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "a" && !isTextEditing) {
        e.preventDefault();
        setTool("cursor");
        setSelectAll(true);
        setSelectedKey("all");
        setSelectedImage(null);
        setToast("Выбраны все строки");
        window.setTimeout(() => setToast(""), 5000);
        return;
      }
      if ((e.ctrlKey || e.metaKey) && (e.key === "+" || e.key === "=" || e.code === "NumpadAdd")) {
        e.preventDefault();
        setSettings((current) => ({ ...current, zoom: Math.min(300, current.zoom + 10) }));
        return;
      }
      if ((e.ctrlKey || e.metaKey) && (e.key === "-" || e.code === "NumpadSubtract")) {
        e.preventDefault();
        setSettings((current) => ({ ...current, zoom: Math.max(30, current.zoom - 10) }));
        return;
      }
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "z") {
        e.preventDefault();
        if (e.shiftKey) {
          const next = future.current.pop();
          if (next) {
            history.current.push(captureSnapshot());
            restoreSnapshot(next);
          }
        } else {
          const prev = history.current.pop();
          if (prev) {
            future.current.push(captureSnapshot());
            restoreSnapshot(prev);
          }
        }
        return;
      }
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "y") {
        e.preventDefault();
        const next = future.current.pop();
        if (next) {
          history.current.push(captureSnapshot());
          restoreSnapshot(next);
        }
        return;
      }
      if (
        e.code === "Space" &&
        !/INPUT|TEXTAREA/.test((e.target as HTMLElement).tagName)
      ) {
        e.preventDefault();
        setSpaceDown(true);
      }
    };
    const up = (e: KeyboardEvent) => {
      if (e.code === "Space") setSpaceDown(false);
    };
    window.addEventListener("keydown", down);
    window.addEventListener("keyup", up);
    return () => {
      window.removeEventListener("keydown", down);
      window.removeEventListener("keyup", up);
    };
  }, [captureSnapshot, persistProject, restoreSnapshot]);
  useEffect(() => {
    if (pageFlow !== "continuous") return;
    continuousSheetRefs.current[pageIndex]?.scrollIntoView({ behavior: "smooth", block: "center" });
  }, [pageIndex, pageFlow]);
  useEffect(() => {
    if (pageIndex >= pages.length) setPageIndex(Math.max(0, pages.length - 1));
  }, [pages.length, pageIndex]);

  const update = <K extends keyof Settings>(key: K, value: Settings[K]) => {
    recordHistory();
    setSettings((s) => ({ ...s, [key]: value }));
  };
  const updateGlobalFontSize = (fontMm: number) => {
    recordHistory();
    setSettings((current) => ({ ...current, fontMm: Math.max(1.5, fontMm) }));
    setLineStyles((current) => Object.fromEntries(Object.entries(current).map(([key, style]) => {
      const { fontMm: _oldFontMm, ...rest } = style;
      void _oldFontMm;
      return [key, rest];
    })));
  };
  const updateGlobalInkThickness = (inkThicknessMm: number) => {
    recordHistory();
    setSettings((current) => ({ ...current, inkThicknessMm: Math.max(0, inkThicknessMm) }));
    setLineStyles((current) => Object.fromEntries(Object.entries(current).map(([key, style]) => {
      const { inkThicknessMm: _oldInk, ...rest } = style;
      void _oldInk;
      return [key, rest];
    })));
  };
  const updateGlobalFormat = (
    settingKey: "textBold" | "textItalic" | "textUnderline" | "textStrike",
    styleKey: "bold" | "italic" | "underline" | "strike",
    value: boolean,
  ) => {
    recordHistory();
    setSettings((current) => ({ ...current, [settingKey]: value }));
    setLineStyles((current) => Object.fromEntries(Object.entries(current).map(([key, style]) => {
      const next = { ...style };
      delete next[styleKey];
      return [key, next];
    })));
  };
  function undo() {
    const prev = history.current.pop();
    if (prev) {
      future.current.push(captureSnapshot());
      restoreSnapshot(prev);
    }
  }
  function redo() {
    const next = future.current.pop();
    if (!next) return;
    history.current.push(captureSnapshot());
    restoreSnapshot(next);
  }
  function flash(message: string) {
    setToast(message);
    setTimeout(() => setToast(""), 5000);
  }
  const editPreviewLine = (oldValue: string, newValue: string) => {
    const clean = newValue.trim();
    if (!clean || clean === oldValue) return;
    recordHistory();
    setText((current) =>
      current.includes(oldValue) ? current.replace(oldValue, clean) : current,
    );
    flash("Текст на листе изменён");
  };
  const loadBackground = (file?: File) => {
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => update("backgroundImage", String(reader.result));
    reader.readAsDataURL(file);
  };
  type PaperPreset = "transparent"|"clean"|"lines"|"dots"|"squares"|"cornell"|"cream"|"pink"|"blue"|"flowers"|"night";
  const paperPresets: Array<[PaperPreset, string]> = [["transparent","PNG без фона"],["clean","Чистый белый"],["lines","Линии"],["dots","Точки"],["squares","Клетка"],["cornell","Корнелл"],["cream","Кремовый"],["pink","Розовый"],["blue","Голубой"],["flowers","Цветы"],["night","Ночь"]];
  const builtInPaper = (kind: PaperPreset) => {
    recordHistory();
    if (kind === "clean" || kind === "transparent") {
      setSettings((current) => ({ ...current, backgroundImage: "", backgroundColor: kind === "transparent" ? "rgba(0,0,0,0)" : "#ffffff", grid: 0 }));
      flash(kind === "transparent" ? "Лист теперь без фона и сетки" : "Выбран полностью чистый белый лист");
      return;
    }
    const arts: Record<Exclude<PaperPreset,"clean"|"transparent">,string> = {
      lines:`<path d="M0 24H240M0 48H240M0 72H240M0 96H240" stroke="#9ec2df" stroke-width="1"/>`, dots:`<pattern id="p" width="16" height="16" patternUnits="userSpaceOnUse"><circle cx="2" cy="2" r="1.15" fill="#9aa8bc"/></pattern><rect width="100%" height="100%" fill="url(#p)"/>`, squares:`<pattern id="p" width="16" height="16" patternUnits="userSpaceOnUse"><path d="M16 0H0V16" fill="none" stroke="#b8cde0" stroke-width=".8"/></pattern><rect width="100%" height="100%" fill="url(#p)"/>`, cornell:`<path d="M0 24H240M0 48H240M0 72H240M0 96H240" stroke="#b7cee0" stroke-width="1"/><path d="M42 0V96" stroke="#e5a7ab" stroke-width="1.2"/>`, cream:`<rect width="240" height="96" fill="#fff8e8"/><path d="M0 24H240M0 48H240M0 72H240M0 96H240" stroke="#decfa9" stroke-width=".9"/>`, pink:`<rect width="240" height="96" fill="#fff5f8"/><path d="M0 24H240M0 48H240M0 72H240M0 96H240" stroke="#efbfd0" stroke-width="1"/>`, blue:`<rect width="240" height="96" fill="#f3fbff"/><pattern id="p" width="16" height="16" patternUnits="userSpaceOnUse"><circle cx="2" cy="2" r="1" fill="#8ec6df"/></pattern><rect width="100%" height="100%" fill="url(#p)"/>`, flowers:`<circle cx="25" cy="25" r="8" fill="#f7b6cf"/><circle cx="215" cy="75" r="10" fill="#b7dfca"/><path d="M25 33v24M215 85v21" stroke="#79a98e" stroke-width="2"/>`, night:`<rect width="100%" height="100%" fill="#202735"/><path d="M0 24H240M0 48H240M0 72H240M0 96H240" stroke="#52647e" stroke-width="1"/><circle cx="205" cy="20" r="7" fill="#f4d784"/>`
    };
    const baseColor=kind==="night"?"#202735":kind==="cream"?"#fff8e8":kind==="pink"?"#fff5f8":kind==="blue"?"#f3fbff":"#fffefa";
    setSettings((current)=>({...current,grid:0,backgroundColor:baseColor,backgroundImage:`data:image/svg+xml;charset=utf-8,${encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" width="240" height="96">${arts[kind]}</svg>`)}`}));
  };
  const newDocument = () => {
    recordHistory();
    setText(""); setStrokes([]); setActiveStroke(null); setImages([]);
    setElementOffsets({}); setLineStyles({}); setSelectedKey(null); setSelectedImage(null);
    setSelectAll(false); setPageIndex(0); setDocumentTitle("Новый конспект"); setHomeOpen(false);
  };
  const loadCustomFont = (file?: File) => {
    if (!file) return;
    if (file.size > 3 * 1024 * 1024) {
      flash("Шрифт слишком большой — выберите файл до 3 МБ");
      return;
    }
    const extension = file.name.split(".").pop()?.toLowerCase();
    if (!extension || !["ttf", "otf", "woff", "woff2"].includes(extension)) {
      flash("Поддерживаются TTF, OTF, WOFF и WOFF2");
      return;
    }
    const reader = new FileReader();
    reader.onload = async () => {
      const data = String(reader.result);
      try {
        const face = new FontFace("User Custom Font", `url(${data})`);
        await face.load();
        if (customFontFaceRef.current) {
          document.fonts.delete(customFontFaceRef.current);
        }
        document.fonts.add(face);
        customFontFaceRef.current = face;
        loadedCustomFontRef.current = data;
        setSettings((current) => ({
          ...current,
          customFontName: file.name.replace(/\.[^.]+$/, ""),
          customFontData: data,
          handwriting: "custom",
        }));
        flash(`Шрифт «${file.name}» загружен и выбран`);
      } catch {
        flash("Не удалось прочитать этот файл шрифта");
      }
    };
    reader.readAsDataURL(file);
  };
  const addSticker = (name: string) => {
    const src = `./decor/sticker-${name}.png`;
    setImages((current) => [
      ...current,
      {
        id: crypto.randomUUID(),
        page: pageIndex,
        src,
        x: Math.max(layoutSettings.marginLeft, size.widthMm - 38),
        y: Math.max(settings.marginTop, 18),
        width: 22,
        height: 22,
      },
    ]);
    flash("Стикер добавлен — двигайте его инструментом «Курсор»");
  };
  const ensureRasterAssets = async () => {
    // Canvas uses the exact bundled typeface only after the browser font set
    // reports it ready; otherwise Chromium may silently rasterize a fallback.
    await document.fonts.ready;
    if (settings.handwriting === "eskal") {
      await document.fonts.load("16px 'Eskal App'");
    }
    if (settings.handwriting === "custom" && settings.customFontData) {
      await document.fonts.load("16px 'User Custom Font'");
    }
    const sources = [
      settings.backgroundImage,
      ...images.map((img) => img.src),
    ].filter(Boolean);
    await Promise.all(
      sources.map(
        (src) =>
          new Promise<void>((resolve) => {
            let image = imageCacheRef.current[src];
            if (image?.complete && image.naturalWidth) return resolve();
            if (!image) {
              image = new Image();
              imageCacheRef.current[src] = image;
            }
            image.onload = () => resolve();
            image.onerror = () => resolve();
            image.src = src;
          }),
      ),
    );
  };
  const pathData = (points: Point[]) =>
    points.length < 3 ? points.map((p,i)=>`${i?"L":"M"}${p.x.toFixed(2)} ${p.y.toFixed(2)}`).join(" ") :
    points.slice(1).reduce((path,point,index)=>{const previous=points[index];const mid={x:(previous.x+point.x)/2,y:(previous.y+point.y)/2};return `${path} Q${previous.x.toFixed(2)} ${previous.y.toFixed(2)} ${mid.x.toFixed(2)} ${mid.y.toFixed(2)}`},`M${points[0].x.toFixed(2)} ${points[0].y.toFixed(2)}`)+` L${points.at(-1)!.x.toFixed(2)} ${points.at(-1)!.y.toFixed(2)}`;
  const svgPoint = (event: React.PointerEvent<SVGSVGElement>): Point => {
    const rect = event.currentTarget.getBoundingClientRect();
    return { x: ((event.clientX - rect.left) / Math.max(1, rect.width)) * size.widthMm, y: ((event.clientY - rect.top) / Math.max(1, rect.height)) * size.heightMm };
  };
  const eraseStrokeAt = (targetPage: number, target: Point) => setStrokes((items) => items.flatMap((stroke) => {
    // Densifying the polyline makes the eraser reliable even when the pointer
    // produced only a few widely spaced points during a fast mouse movement.
    if (!stroke || stroke.page !== targetPage) return stroke ? [stroke] : [];
    const dense: Point[] = [];
    stroke.points.forEach((point, index) => {
      if (!index) { dense.push(point); return; }
      const previous = stroke.points[index - 1];
      const distance = Math.hypot(point.x - previous.x, point.y - previous.y);
      const steps = Math.max(1, Math.ceil(distance / .45));
      for (let step = 1; step <= steps; step += 1) dense.push({
        x: previous.x + (point.x - previous.x) * step / steps,
        y: previous.y + (point.y - previous.y) * step / steps,
      });
    });
    const parts: Point[][] = [];
    let part: Point[] = [];
    dense.forEach((point) => {
      if (Math.hypot(point.x - target.x, point.y - target.y) <= eraserWidth) {
        if (part.length > 1) parts.push(part);
        part = [];
      } else part.push(point);
    });
    if (part.length > 1) parts.push(part);
    return parts.map((points, index) => ({ ...stroke, id: `${stroke.id}-e${Date.now()}-${index}`, points }));
  }));
  const oldDrawStart = (event: React.PointerEvent<SVGSVGElement>, targetPage = pageIndex) => {
    // Coordinates are stored in millimetres rather than screen pixels. This is
    // what keeps drawings aligned after zooming, exporting and printing.
    if (!["pen", "pencil", "marker", "eraser"].includes(tool)) return;
    event.preventDefault(); event.stopPropagation();
    recordHistory();
    try { event.currentTarget.setPointerCapture(event.pointerId); } catch { /* optional */ }
    const first = svgPoint(event);
    setPageIndex(targetPage);
    if (tool === "eraser") { erasingRef.current = true; eraseStrokeAt(targetPage, first); return; }
    const stroke: Stroke = { id:crypto.randomUUID(),page:targetPage,tool:tool as "pen"|"pencil"|"marker",color:tool==="marker"?settings.markerColor:settings.color,width:tool==="marker"?settings.markerWidth:tool==="pencil"?pencilWidth:.65,opacity:tool==="marker"?settings.markerOpacity:tool==="pencil"?pencilOpacity:1,points:[first] };
    activeStrokeRef.current=stroke; setActiveStroke(stroke);
  };
  const oldDrawMove = (event: React.PointerEvent<SVGSVGElement>) => {
    if (tool === "eraser" && erasingRef.current) { event.preventDefault(); eraseStrokeAt(Number(event.currentTarget.dataset.page ?? pageIndex), svgPoint(event)); return; }
    const current=activeStrokeRef.current; if(!current) return;
    event.preventDefault(); const point=svgPoint(event); const next={...current,points:current.tool==="marker"&&markerStraight?[current.points[0],point]:[...current.points,point]}; activeStrokeRef.current=next; setActiveStroke(next);
  };
  const oldDrawEnd = () => {
    const finished=activeStrokeRef.current; activeStrokeRef.current=null; setActiveStroke(null); erasingRef.current=false;
    if(finished&&finished.points.length>1)setStrokes((items)=>[...items.filter(Boolean),finished]);
  };
  const dragText = (e: React.PointerEvent, key: string) => {
    if (editingKey === key) return;
    if (spaceDown || tool === "hand") return;
    if (tool !== "cursor") return;
    e.preventDefault();
    e.stopPropagation();
    recordHistory();
    setSelectedKey(key);
    const start = { x: e.clientX, y: e.clientY };
    const keys = selectAll ? page.map((_, i) => `${pageIndex}-${i}`) : [key];
    const initial = Object.fromEntries(
      keys.map((k) => [k, elementOffsets[k] || { x: 0, y: 0 }]),
    );
    const move = (m: PointerEvent) =>
      setElementOffsets((v) => {
        const next = { ...v };
        keys.forEach(
          (k) =>
            (next[k] = {
              x: initial[k].x + (m.clientX - start.x) / scale,
              y: initial[k].y + (m.clientY - start.y) / scale,
            }),
        );
        return next;
      });
    const end = () => {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", end);
    };
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", end);
  };
  const projectData = () => ({
    version: 3,
    text,
    settings,
    strokes,
    layers,
    elementOffsets,
    lineStyles,
    images,
  });
  const saveProject = () =>
    download(
      new Blob([JSON.stringify(projectData(), null, 2)], {
        type: "application/json",
      }),
      "konspekt.polya.json",
      "application/json",
    );
  const openProject = (file?: File) => {
    if (!file) return;
    const r = new FileReader();
    r.onload = () => {
      try {
        const d = JSON.parse(String(r.result));
        setText(d.text || "");
        setSettings({ ...defaults, ...d.settings });
        setStrokes((d.strokes || []).filter(Boolean));
        setLayers({ ...(d.layers || { text: true, background: true }), drawing: true });
        setElementOffsets(d.elementOffsets || {});
        setLineStyles(d.lineStyles || {});
        setImages(d.images || []);
        setFileOpen(false);
        flash("Проект открыт");
      } catch {
        flash("Не удалось открыть файл");
      }
    };
    r.readAsText(file);
  };
  const newProject = () => {
    if (!confirm("Создать новый пустой проект?")) return;
    setText("");
    setSettings(defaults);
    setStrokes([]);
    setElementOffsets({});
    setLineStyles({});
    setImages([]);
    setFileOpen(false);
  };
  const resetPage = () => {
    setStrokes((v) => v.filter((s) => s.page !== pageIndex));
    setImages((v) => v.filter((s) => s.page !== pageIndex));
    setElementOffsets((v) =>
      Object.fromEntries(
        Object.entries(v).filter(([k]) => !k.startsWith(`${pageIndex}-`)),
      ),
    );
    setLineStyles((v) =>
      Object.fromEntries(
        Object.entries(v).filter(([k]) => !k.startsWith(`${pageIndex}-`)),
      ),
    );
    setSelectedKey(null);
    setSelectedImage(null);
    setSelectAll(false);
    flash("Страница сброшена");
  };
  const panStart = (e: React.PointerEvent) => {
    if (!(spaceDown || tool === "hand") || !deskRef.current) return;
    e.preventDefault();
    const start = {
        x: e.clientX,
        y: e.clientY,
        panX: canvasPan.x,
        panY: canvasPan.y,
      };
    const move = (m: PointerEvent) => {
      setCanvasPan({x:start.panX+(m.clientX-start.x),y:start.panY+(m.clientY-start.y)});
    };
    const end = () => {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", end);
    };
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", end);
  };
  const addImage = (file?: File) => {
    if (!file) return;
    const r = new FileReader();
    r.onload = () =>
      setImages((v) => [
        ...v,
        {
          id: crypto.randomUUID(),
          page: pageIndex,
          src: String(r.result),
          x: 30,
          y: 35,
          width: 45,
          height: 35,
        },
      ]);
    r.readAsDataURL(file);
  };
  const dragImage = (e: React.PointerEvent, img: ImageElement) => {
    if (spaceDown || tool === "hand") return;
    if (tool !== "cursor") return;
    e.preventDefault();
    e.stopPropagation();
    recordHistory();
    setSelectedImage(img.id);
    const start = { x: e.clientX, y: e.clientY, x0: img.x, y0: img.y };
    const move = (m: PointerEvent) =>
      setImages((v) =>
        v.map((a) =>
          a.id === img.id
            ? {
                ...a,
                x: start.x0 + (m.clientX - start.x) / scale,
                y: start.y0 + (m.clientY - start.y) / scale,
              }
            : a,
        ),
      );
    const end = () => {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", end);
    };
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", end);
  };
  const makeFivePages = () => {
    let result = "# Большой конспект\n\n";
    let n = 1;
    const para =
      "Главная мысль связывает новую информацию с уже известными идеями. Краткий пример помогает запомнить материал и проверить понимание.";
    while (createPages(result, size, layoutSettings).length < 5) {
      result += `## Раздел ${n}\n${para}\n\n• Ключевое понятие\n• Важный вывод\n• Вопрос для самопроверки\n\n`;
      n++;
    }
    setText(result);
    flash("Создан конспект на 5 страниц");
  };

  const smartAlign = () => {
    const longestLine = Math.max(
      1,
      ...pages.flat().map((line) => line.text.length),
    );
    const fittedWidth = Math.max(
      86,
      Math.min(108, Math.round((45 / longestLine) * 100)),
    );
    setSettings((current) => ({
      ...current,
      marginTop: 12,
      marginRight: 12,
      marginBottom: 12,
      marginLeft: 15,
      safeMm: 5,
      fontMm: 3.8,
      lineMm: 6.5,
      indentMm: 5,
      paragraphMm: 3,
      slant: 0,
      baseline: 0,
      offsetX: 0,
      offsetY: 0,
      scaleX: fittedWidth,
      scaleY: 100,
      showSafe: true,
      showMargins: true,
    }));
    setElementOffsets({});
    setLineStyles({});
    setGuides([]);
    setSelectAll(false);
    setSelectedKey(null);
    setPageIndex(0);
    flash(
      `ИИ-выравнивание: ширина текста ${fittedWidth}%, строки подогнаны к полям`,
    );
  };

  async function exportPdf(calibration = true) {
    const pdf = await PDFDocument.create();
    const font = await pdf.embedFont(StandardFonts.TimesRoman);
    const bold = await pdf.embedFont(StandardFonts.TimesRomanBold);
    for (const [pdfPageIndex, lines] of pages.entries()) {
      const p = pdf.addPage([mmToPt(size.widthMm), mmToPt(size.heightMm)]);
      const sx = calibration ? settings.scaleX / 100 : 1,
        sy = calibration ? settings.scaleY / 100 : 1;
      const ox = calibration ? settings.offsetX : 0,
        oy = calibration ? settings.offsetY : 0;
      if (layers.text)
        for (const [lineIndex, line] of lines.entries()) {
          const key = `${pdfPageIndex}-${lineIndex}`,
            delta = elementOffsets[key] || { x: 0, y: 0 },
            ls = lineStyles[key] || {};
          const startShift = lineStartShift(pdfPageIndex, lineIndex, line);
          const x = (line.xMm + startShift + delta.x) * sx + ox;
          const y = (line.yMm + delta.y) * sy + oy;
          const lineFontMm =
            ls.fontMm ||
            (line.kind === "heading"
              ? settings.headingFontMm
              : settings.fontMm);
          p.drawText(line.text, {
            x: mmToPt(x),
            y: mmToPt(size.heightMm - y - lineFontMm),
            size: mmToPt(lineFontMm),
            font: line.kind === "heading" ? bold : font,
            color: hexRgb(ls.color || settings.color),
            opacity: ls.opacity ?? settings.opacity,
            rotate: degrees(ls.slant ?? settings.slant),
            maxWidth: mmToPt(size.widthMm - x - layoutSettings.marginRight),
          });
          if (line.kind === "heading")
            p.drawLine({
              start: {
                x: mmToPt(x),
                y: mmToPt(size.heightMm - y - settings.fontMm - 1),
              },
              end: {
                x: mmToPt(size.widthMm - settings.marginRight),
                y: mmToPt(size.heightMm - y - settings.fontMm - 1),
              },
              thickness: 0.35,
              color: hexRgb(settings.color),
            });
        }
      if (layers.drawing)
        for (const stroke of strokes.filter((s) => s.page === pdfPageIndex))
          for (let i = 1; i < stroke.points.length; i++)
            p.drawLine({
              start: {
                x: mmToPt(stroke.points[i - 1].x),
                y: mmToPt(size.heightMm - stroke.points[i - 1].y),
              },
              end: {
                x: mmToPt(stroke.points[i].x),
                y: mmToPt(size.heightMm - stroke.points[i].y),
              },
              thickness: mmToPt(stroke.width),
              color: hexRgb(stroke.color),
              opacity: stroke.opacity ?? (stroke.tool === "marker" ? settings.markerOpacity : 1),
            });
    }
    download(await pdf.save(), "konspekt-a5.pdf", "application/pdf");
    setExportOpen(false);
    flash("PDF A5 готов");
  }

  const buildPrintHtml = () => {
    const esc = (value: string) =>
      value.replace(
        /[&<>"']/g,
        (char) =>
          ({
            "&": "&amp;",
            "<": "&lt;",
            ">": "&gt;",
            '"': "&quot;",
            "'": "&#39;",
          })[char]!,
      );
    const pageMarkup = pages
      .map((lines, printedPage) => {
        const lineMarkup = layers.text
          ? lines
              .map((line, i) => {
                const key = `${printedPage}-${i}`;
                const delta = elementOffsets[key] || { x: 0, y: 0 };
                const lineStyle = lineStyles[key] || {};
                return `<div class="line ${line.kind}" style="left:${line.xMm + delta.x}mm;top:${line.yMm + delta.y}mm;font-size:${lineStyle.fontMm || settings.fontMm}mm;color:${lineStyle.color || settings.color};opacity:${lineStyle.opacity ?? settings.opacity};transform:rotate(${lineStyle.slant ?? settings.slant}deg)">${esc(line.text)}</div>`;
              })
              .join("")
          : "";
        const drawingMarkup = layers.drawing
          ? `<svg class="drawing" viewBox="0 0 ${size.widthMm} ${size.heightMm}">${strokes
              .filter((stroke) => stroke.page === printedPage)
              .map(
                (stroke) =>
                  `<path d="${pathData(stroke.points)}" fill="none" stroke="${stroke.color}" stroke-width="${stroke.width}" stroke-linecap="round" stroke-linejoin="round" opacity="${stroke.opacity ?? (stroke.tool === "marker" ? settings.markerOpacity : 1)}"/>`,
              )
              .join("")}</svg>`
          : "";
        const imageMarkup = images
          .filter((image) => image.page === printedPage)
          .map(
            (image) =>
              `<img class="placed-image" src="${image.src}" style="left:${image.x}mm;top:${image.y}mm;width:${image.width}mm;height:${image.height}mm"/>`,
          )
          .join("");
        const holes =
          settings.bindingSide === "none"
            ? ""
            : `<div class="holes ${settings.bindingSide}">${Array.from(
                { length: settings.holeCount },
                (_, i) =>
                  `<i style="top:${((i + 1) / (settings.holeCount + 1)) * 100}%"></i>`,
              ).join("")}</div>`;
        return `<section class="page">${settings.backgroundImage ? `<img class="background" src="${settings.backgroundImage}"/>` : ""}${holes}<div class="content">${lineMarkup}</div>${imageMarkup}${drawingMarkup}</section>`;
      })
      .join("");
    return `<!doctype html><html><head><meta charset="utf-8"><style>
      @page{size:${size.widthMm}mm ${size.heightMm}mm;margin:0}
      *{box-sizing:border-box}html,body{margin:0;padding:0;background:white}
      .page{position:relative;width:${size.widthMm}mm;height:${size.heightMm}mm;overflow:hidden;break-after:page;background:${settings.backgroundColor}}
      .page:last-child{break-after:auto}.content{position:absolute;inset:0;transform-origin:top left;transform:translate(${settings.offsetX}mm,${settings.offsetY}mm) scale(${settings.scaleX / 100},${settings.scaleY / 100})}
      .line{position:absolute;white-space:nowrap;font-family:'Segoe Print','Comic Sans MS',cursive;line-height:${settings.lineMm}mm;transform-origin:left center}
      .line.heading{font-weight:700;border-bottom:.2mm solid currentColor}.background{position:absolute;inset:0;width:100%;height:100%;object-fit:cover;opacity:${settings.backgroundOpacity}}
      .drawing{position:absolute;inset:0;width:100%;height:100%}.placed-image{position:absolute;object-fit:contain}.holes{position:absolute;top:0;bottom:0;width:4mm;z-index:5}.holes.left{left:1mm}.holes.right{right:1mm}.holes i{position:absolute;left:50%;width:2.5mm;height:2.5mm;border-radius:50%;transform:translate(-50%,-50%);background:#fff;border:.25mm solid #aaa}
    </style></head><body>${pageMarkup}</body></html>`;
  };

  const selectedPrintPages = () => {
    if (printPageSelection === "current") return [Math.min(pageIndex, pages.length - 1)];
    if (printPageSelection === "custom") {
      const selected = new Set<number>();
      printCustomPages.split(",").forEach((part) => {
        const value = part.trim();
        const range = value.match(/^(\d+)\s*-\s*(\d+)$/);
        if (range) {
          const from = Math.min(Number(range[1]), Number(range[2]));
          const to = Math.max(Number(range[1]), Number(range[2]));
          for (let number = from; number <= to; number += 1) if (number >= 1 && number <= pages.length) selected.add(number - 1);
        } else {
          const number = Number(value);
          if (Number.isInteger(number) && number >= 1 && number <= pages.length) selected.add(number - 1);
        }
      });
      return [...selected].sort((a, b) => a - b);
    }
    return pages.map((_, index) => index);
  };

  const buildRasterPrintHtml = () => {
    // Keep the vector template available for future PDF export; direct printer
    // output deliberately uses the rasterized version below.
    void buildPrintHtml;
    const pageImages = selectedPrintPages()
      .map((index) =>
          // Function declaration is intentionally below the orchestration
          // helpers; it is hoisted and does not mutate during a render.
          // eslint-disable-next-line react-hooks/immutability
          `<section class="page"><img src="${renderPng(pages[index], index, true).toDataURL("image/png")}" /></section>`,
      )
      .join("");
    return `<!doctype html><html><head><meta charset="utf-8"><style>
      @page{size:${settings.paperFormat} ${settings.orientation};margin:0}
      *{box-sizing:border-box}html,body{margin:0;padding:0;background:#fff}
      .page{width:${size.widthMm}mm;height:${size.heightMm}mm;overflow:hidden;break-after:page;page-break-after:always}
      .page:last-child{break-after:auto;page-break-after:auto}
      .page img{display:block;width:100%;height:100%;object-fit:fill}
    </style></head><body data-print-font="${settings.fontMm}" data-print-ink="${settings.inkThicknessMm}" data-print-bold="${settings.textBold}" data-print-revision="${Date.now()}">${pageImages}</body></html>`;
  };

  const openPrintPreview = async () => {
    persistProject();
    await ensureRasterAssets();
    setPrintPreviewHtml(buildRasterPrintHtml());
    setPrintPreview(true);
  };
  const openPrintDialog = async () => {
    persistProject();
    await ensureRasterAssets();
    setPrintPreviewHtml(buildRasterPrintHtml());
    setPrintDialogOpen(true);
  };

  useEffect(() => {
    if (!printDialogOpen) return;
    let cancelled = false;
    const refresh = async () => {
      await ensureRasterAssets();
      if (!cancelled) setPrintPreviewHtml(buildRasterPrintHtml());
    };
    void refresh();
    return () => { cancelled = true; };
    // The settings object is intentionally a dependency: every printable
    // property must immediately rebuild the exact preview sent to Electron.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [printDialogOpen, printPageSelection, printCustomPages, settings, pages, strokes, images, lineStyles, elementOffsets, layers]);

  const printDocument = async () => {
    if (!window.desktopPrint) {
      flash("Прямая печать доступна в desktop-приложении");
      return;
    }
    if (!settings.printerName) {
      flash("Сначала выберите принтер");
      return;
    }
    if (selectedPrintPages().length === 0) {
      flash("Укажите хотя бы одну существующую страницу");
      return;
    }
    setPrinting(true);
    try {
      persistProject();
      await ensureRasterAssets();
      const result = await window.desktopPrint.print({
        html: buildRasterPrintHtml(),
        deviceName: settings.printerName,
        copies: settings.printCopies,
        color: settings.printColor,
        duplexMode: settings.printDuplex,
        paperFormat: settings.paperFormat,
        landscape: settings.orientation === "landscape",
        widthMm: size.widthMm,
        heightMm: size.heightMm,
        marginLeft: layoutSettings.marginLeft,
        marginRight: layoutSettings.marginRight,
        marginTop: layoutSettings.marginTop,
        marginBottom: layoutSettings.marginBottom,
        selectedPages: selectedPrintPages().map((index)=>index+1).join(","),
        textScaleX: settings.scaleX,
        printTextScale: settings.printTextScale,
        dpi: settings.dpi,
        canvasWidthPx: Math.round(mmToPx(size.widthMm, settings.dpi)),
        canvasHeightPx: Math.round(mmToPx(size.heightMm, settings.dpi)),
        contentWidthMm:
          size.widthMm - layoutSettings.marginLeft - layoutSettings.marginRight,
        contentHeightMm:
          size.heightMm - layoutSettings.marginTop - layoutSettings.marginBottom,
      });
      flash(
        result.success
          ? `Отправлено на принтер: ${settings.printerName}`
          : `Ошибка печати: ${result.failureReason || "неизвестная ошибка"}`,
      );
    } finally {
      setPrinting(false);
    }
  };

  function renderPng(
    lines: PageLine[],
    rasterPageIndex = pageIndex,
    forPrint = false,
    transparent = false,
  ) {
    const canvas = document.createElement("canvas");
    canvas.width = Math.round(mmToPx(size.widthMm, settings.dpi));
    canvas.height = Math.round(mmToPx(size.heightMm, settings.dpi));
    const c = canvas.getContext("2d")!;
    const px = (mm: number) => mmToPx(mm, settings.dpi);
    if (!transparent) { c.fillStyle = settings.backgroundColor; c.fillRect(0,0,canvas.width,canvas.height); }
    else c.clearRect(0,0,canvas.width,canvas.height);
    const background = imageCacheRef.current[settings.backgroundImage];
    if (
      !transparent && layers.background &&
      settings.backgroundImage &&
      background?.complete &&
      background.naturalWidth
    ) {
      c.save();
      c.globalAlpha = settings.backgroundOpacity;
      c.drawImage(background, 0, 0, canvas.width, canvas.height);
      c.restore();
    }
    if (!transparent && settings.grid > 0) {
      c.strokeStyle = "#9aabba55";
      c.lineWidth = Math.max(1, px(0.12));
      for (let x = settings.grid; x < size.widthMm; x += settings.grid) {
        c.beginPath();
        c.moveTo(px(x), 0);
        c.lineTo(px(x), canvas.height);
        c.stroke();
      }
      for (let y = settings.grid; y < size.heightMm; y += settings.grid) {
        c.beginPath();
        c.moveTo(0, px(y));
        c.lineTo(canvas.width, px(y));
        c.stroke();
      }
    }
    c.fillStyle = settings.color;
    c.globalAlpha = settings.opacity;
    c.textBaseline = "top";
    if (layers.text) {
      c.save();
      // Printing always respects the effective ordinary/safe margins. The
      // safe-zone switch only decides whether safeMm expands those margins.
      if (forPrint) {
        c.beginPath();
        c.rect(
          px(layoutSettings.marginLeft),
          px(layoutSettings.marginTop),
          px(
            size.widthMm -
              layoutSettings.marginLeft -
              layoutSettings.marginRight,
          ),
          px(size.heightMm - layoutSettings.marginTop - layoutSettings.marginBottom),
        );
        c.clip();
      }
      lines.forEach((line, i) => {
        const key = `${rasterPageIndex}-${i}`,
          d = elementOffsets[key] || { x: 0, y: 0 },
          ls = lineStyles[key] || {};
        const startShift = lineStartShift(rasterPageIndex, i, line);
        const lineColor = ls.color || (line.kind === "heading" ? settings.headingColor : settings.color);
        c.fillStyle = lineColor;
        c.globalAlpha = ls.opacity ?? settings.opacity;
        const printFactor = forPrint ? settings.printTextScale / 100 : 1;
        const lineFontMm =
          ls.fontMm ||
          (line.kind === "heading" ? settings.headingFontMm : settings.fontMm);
        const lineInkMm = ls.inkThicknessMm ?? (line.kind === "heading"
            ? settings.headingInkThicknessMm
            : settings.inkThicknessMm);
        const lineBold = ls.bold ?? (line.kind === "heading" || settings.textBold);
        const lineItalic = ls.italic ?? settings.textItalic;
        c.font = `${lineItalic ? "italic " : ""}${lineBold ? "700" : "400"} ${px(lineFontMm * printFactor)}px ${handwritingFont}`;
        const scaleX = (settings.scaleX / 100) * (ls.scaleX ?? (line.kind === "heading" ? settings.headingScaleX / 100 : 1));
        const scaleY = settings.scaleY / 100;
        c.save();
        c.translate(
          px(line.xMm + startShift + d.x + settings.offsetX),
          px(line.yMm + d.y + settings.offsetY),
        );
        c.rotate(((ls.slant ?? settings.slant) * Math.PI) / 180);
        c.scale(scaleX, scaleY);
        const maxTextWidth = px(
          (size.widthMm -
            line.xMm -
            startShift -
            layoutSettings.marginRight -
            Math.max(0, d.x)) /
            Math.max(0.01, scaleX),
        );
        c.lineJoin = "round";
        c.strokeStyle = lineColor;
        c.lineWidth = px(lineInkMm * printFactor);
        if (lineInkMm > 0) {
          c.strokeText(line.text, 0, 0);
        }
        c.fillText(line.text, 0, 0);
        const measuredWidth = Math.min(c.measureText(line.text).width, maxTextWidth);
        c.strokeStyle = lineColor;
        c.lineWidth = Math.max(1, px(0.12));
        if (ls.underline ?? settings.textUnderline) {
          c.beginPath(); c.moveTo(0, px(lineFontMm * printFactor * 1.05)); c.lineTo(measuredWidth, px(lineFontMm * printFactor * 1.05)); c.stroke();
        }
        if (ls.strike ?? settings.textStrike) {
          c.beginPath(); c.moveTo(0, px(lineFontMm * printFactor * 0.53)); c.lineTo(measuredWidth, px(lineFontMm * printFactor * 0.53)); c.stroke();
        }
        c.restore();
      });
      c.restore();
    }
    images
      .filter((img) => img.page === rasterPageIndex)
      .forEach((img) => {
        const source = imageCacheRef.current[img.src];
        if (source?.complete && source.naturalWidth) {
          c.save();
          c.globalAlpha = 1;
          c.drawImage(
            source,
            px(img.x),
            px(img.y),
            px(img.width),
            px(img.height),
          );
          c.restore();
        }
      });
    if (layers.drawing)
      strokes
        .filter((s) => s.page === rasterPageIndex)
        .forEach((stroke) => {
          c.beginPath();
          c.strokeStyle = stroke.color;
          c.globalAlpha = stroke.opacity ?? (stroke.tool === "marker" ? settings.markerOpacity : 1);
          c.lineWidth = px(stroke.width);
          c.lineCap = "round";
          c.lineJoin = "round";
          stroke.points.forEach((p, i) =>
            i ? c.lineTo(px(p.x), px(p.y)) : c.moveTo(px(p.x), px(p.y)),
          );
          c.stroke();
        });
    return canvas;
  }
  async function buildAndroidPrintPdf() {
    await ensureRasterAssets();
    const pdf = await PDFDocument.create();
    for (const [index, lines] of pages.entries()) {
      const png = await pdf.embedPng(
        renderPng(lines, index, true).toDataURL("image/png"),
      );
      const pdfPage = pdf.addPage([
        mmToPt(size.widthMm),
        mmToPt(size.heightMm),
      ]);
      pdfPage.drawImage(png, {
        x: 0,
        y: 0,
        width: mmToPt(size.widthMm),
        height: mmToPt(size.heightMm),
      });
    }
    return pdf.saveAsBase64();
  }
  async function androidPrint(mode: "system" | "epson") {
    try {
      setPrinting(true);
      persistProject();
      const base64 = await buildAndroidPrintPdf();
      const payload = { base64, name: `polya-${settings.paperFormat}.pdf`, format: settings.paperFormat, landscape: settings.orientation === "landscape", color: settings.printColor };
      if (mode === "system") await AndroidPrint.systemPrint(payload);
      else await AndroidPrint.openInPrintApp(payload);
      flash(
        mode === "system"
          ? "Открыто системное окно печати"
          : "Выберите Epson iPrint или Epson Smart Panel",
      );
    } catch (error) {
      flash(`Не удалось открыть печать: ${String(error)}`);
    } finally {
      setPrinting(false);
    }
  }
  async function androidChooseFile() {
    try {
      await AndroidPrint.chooseFile();
    } catch (error) {
      flash(`Не удалось выбрать файл: ${String(error)}`);
    }
  }
  async function exportPng(all = false, transparent = false) {
    await ensureRasterAssets();
    if (!all) {
      renderPng(page,pageIndex,false,transparent).toBlob(
        (b) =>
          b &&
          download(
            b,
            `konspekt-${pageIndex+1}-${transparent?"transparent-":""}${settings.dpi}dpi.png`,
            "image/png",
          ),
      );
    } else {
      const zip = new JSZip();
      await Promise.all(
        pages.map(
          (p, i) =>
            new Promise<void>((resolve) =>
              renderPng(p,i,false,transparent).toBlob(async (b) => {
                if (b) zip.file(`page-${i+1}${transparent?"-transparent":""}.png`,b);
                resolve();
              }),
            ),
        ),
      );
      download(
        await zip.generateAsync({ type: "blob" }),
        transparent?"konspekt-transparent-png.zip":"konspekt-png.zip",
        "application/zip",
      );
    }
    setExportOpen(false);
    flash(all?"ZIP со страницами готов":transparent?"Прозрачный PNG готов":"PNG готов");
  }
  async function calibrationSheet() {
    const pdf = await PDFDocument.create();
    const p = pdf.addPage([mmToPt(size.widthMm), mmToPt(size.heightMm)]);
    const ink = rgb(0.12, 0.16, 0.2);
    p.drawRectangle({
      x: mmToPt(5),
      y: mmToPt(5),
      width: mmToPt(size.widthMm - 10),
      height: mmToPt(size.heightMm - 10),
      borderWidth: 0.5,
      borderColor: ink,
    });
    for (let x = 10; x < size.widthMm - 5; x += 1)
      p.drawLine({
        start: { x: mmToPt(x), y: mmToPt(5) },
        end: { x: mmToPt(x), y: mmToPt(5 + (x % 10 === 0 ? 5 : 2)) },
        thickness: 0.3,
        color: ink,
      });
    for (let y = 10; y < size.heightMm - 5; y += 1)
      p.drawLine({
        start: { x: mmToPt(5), y: mmToPt(y) },
        end: { x: mmToPt(5 + (y % 10 === 0 ? 5 : 2)), y: mmToPt(y) },
        thickness: 0.3,
        color: ink,
      });
    const cx = mmToPt(size.widthMm / 2),
      cy = mmToPt(size.heightMm / 2);
    p.drawLine({
      start: { x: cx - 15, y: cy },
      end: { x: cx + 15, y: cy },
      thickness: 0.6,
      color: ink,
    });
    p.drawLine({
      start: { x: cx, y: cy - 15 },
      end: { x: cx, y: cy + 15 },
      thickness: 0.6,
      color: ink,
    });
    [10, 20, 30].forEach((v) =>
      p.drawRectangle({
        x: mmToPt(v),
        y: mmToPt(v),
        width: mmToPt(size.widthMm - v * 2),
        height: mmToPt(size.heightMm - v * 2),
        borderWidth: 0.25,
        borderColor: rgb(0.35, 0.4, 0.45),
      }),
    );
    download(await pdf.save(), "kalibrovka-a5.pdf", "application/pdf");
    flash("Калибровочный PDF готов");
  }

  return (
    <main
      className={`app-shell ui-${settings.uiTheme} ${isAndroid ? "platform-android" : "platform-desktop"}`}
    >
      <header className="topbar">
        <div className="topbar-left">
        <div className="brand">
          <span className="brand-mark">
            <img
              src={`./icons/app-icon-${settings.appIcon}.png`}
              alt=""
              draggable={false}
            />
          </span>
          <strong>Поля</strong>
        </div>
        <nav className="app-menu">
          <button onClick={() => setHomeOpen(true)}>Главная</button>
          <div ref={fileMenuRef} className="file-dropdown" onMouseEnter={()=>{if(fileCloseTimerRef.current){window.clearTimeout(fileCloseTimerRef.current);fileCloseTimerRef.current=null}}} onMouseLeave={() => {if(!fileCloseTimerRef.current)fileCloseTimerRef.current=window.setTimeout(()=>{setTopMenuOpen(false);fileCloseTimerRef.current=null},700)}}>
            <button className={topMenuOpen ? "active" : ""} onClick={() => setTopMenuOpen((value) => !value)}>Файл</button>
            {topMenuOpen && <div className="file-popover">
              <button onClick={() => {persistProject(true);setTopMenuOpen(false)}}><span>Сохранить</span><kbd>Ctrl S</kbd></button>
              <button onClick={() => {navigator.clipboard?.writeText(JSON.stringify(projectData()));flash("Проект скопирован");setTopMenuOpen(false)}}><span>Скопировать</span><kbd>Ctrl C</kbd></button>
              <button onClick={() => {setExportOpen(true);setTopMenuOpen(false)}}><span>Экспорт</span><kbd>Ctrl E</kbd></button>
              <button onClick={() => {setSettingsOpen(true);setTopMenuOpen(false)}}><span>Настройки</span><kbd>Ctrl ,</kbd></button>
            </div>}
          </div>
        </nav>
        <span className="brand-divider" />
        </div>
        <div className="topbar-actions">
          {isAndroid ? <>
            <button className="mobile-save" onClick={()=>persistProject(true)}>Сохранить</button>
            <button className="mobile-overflow" aria-label="Ещё" onClick={()=>setMobileMoreOpen(true)}>⋮</button>
          </> : <>
          <div className="history-controls">
          <button className="icon-btn" onClick={undo} title="Отменить">
            ↶
          </button>
          <button className="icon-btn" onClick={redo} title="Повторить последнее действие">
            ↷
          </button>
          </div>
          <button className="print-button" onClick={openPrintDialog}>▣ Печать</button>
          </>}
        </div>
      </header>
      <section className="workspace" style={{gridTemplateColumns:`${leftWidth}px minmax(0, 1fr) ${rightWidth}px`,"--left-width":`${leftWidth}px`,"--right-width":`${rightWidth}px`} as React.CSSProperties}>
        <aside className={`sidebar left-panel ${isAndroid && mobilePanel && mobilePanel !== "properties" ? "mobile-open" : ""}`}>
          {isAndroid && <header className="mobile-sheet-header"><b>{tab === "document" ? "Конспект" : tab === "design" ? "Оформление" : "Страница"}</b><button aria-label="Закрыть" onClick={()=>setMobilePanel(null)}>×</button></header>}
          <nav className="tabs">
            {tabs.map((t) => (
              <button
                key={t.id}
                className={tab === t.id ? "active" : ""}
                onClick={() => setTab(t.id)}
              >
                <i>{t.icon}</i><span>{t.label}</span>
              </button>
            ))}
          </nav>
          <div className="panel-content">
            {tab === "document" && (
              <div className="note-editor-section">
                <div className="section-heading">
                  <div><small>ИСХОДНЫЙ МАТЕРИАЛ</small><h2>Конспект</h2></div>
                  <span className="editor-count">{text.trim() ? text.trim().split(/\s+/).length : 0} слов · {text.length.toLocaleString("ru-RU")} знаков</span>
                </div>
                <textarea
                  className="mini-editor"
                  value={text}
                  onFocus={() => {
                    recordHistory();
                  }}
                  onChange={(e) => setText(e.target.value)}
                  aria-label="Текст конспекта"
                  placeholder="Вставьте лекцию, статью или свои заметки…"
                />
                <div className="generation-options">
                  <label><span>Количество страниц</span><select defaultValue="auto"><option value="auto">Авто</option><option>1</option><option>2</option><option>3</option><option>5</option><option>10</option></select></label>
                  <label><span>Плотность</span><select defaultValue="normal"><option value="compact">Компактно</option><option value="normal">Обычно</option><option value="detail">Подробно</option></select></label>
                </div>
                <label className="switch-row"><span><b>Сохранить структуру</b><small>Абзацы и списки останутся на своих местах</small></span><input type="checkbox" defaultChecked /></label>
                <label className="switch-row"><span><b>Оформлять заголовки</b><small>Строки с # распознаются автоматически</small></span><input type="checkbox" defaultChecked /></label>
                <button className="wide primary create-note" onClick={()=>{persistProject(true);setPageIndex(0);setCanvasPan({x:0,y:0})}}>✦ Сохранить и показать конспект</button>
                <div className="regenerate-actions"><button onClick={() => flash("Текущая страница обновлена")}>↻ Текущую страницу</button><button onClick={makeFivePages}>↻ Все страницы</button></div>
              </div>
            )}
            {tab === "design" && (
              <>
                <div className="section-title">
                  <span>Стиль почерка</span>
                </div>
                <div className="style-cards">
                  {[
                    ["notebook", "Тетрадный", "Aa"],
                    ["quick", "Быстрый", "Ab"],
                    ["clean", "Аккуратный", "Aа"],
                    ["round", "Округлый", "Oo"],
                    ["school", "Школьный", "Bb"],
                    ["compact", "Компактный", "Mm"],
                    ["gel", "Гелевая ручка", "Жж"],
                    ["eskal", "Eskal", "Ээ"],
                    ["elegant", "Изящный", "Дд"],
                    ["casual", "Небрежный", "Лл"],
                    ["block", "Печатный", "Бб"],
                  ].map((a) => (
                    <button
                      key={a[0]}
                      className={
                        settings.handwriting === a[0] ? "selected" : ""
                      }
                      onClick={() => update("handwriting", a[0])}
                    >
                      <i>{a[2]}</i>
                      <span>{a[1]}</span>
                    </button>
                  ))}
                  {settings.customFontData && (
                    <button
                      className={
                        settings.handwriting === "custom" ? "selected" : ""
                      }
                      onClick={() => update("handwriting", "custom")}
                    >
                      <i style={{ fontFamily: "'User Custom Font'" }}>Аб</i>
                      <span>{settings.customFontName || "Свой шрифт"}</span>
                    </button>
                  )}
                </div>
                <label className="custom-font-upload">
                  <input
                    type="file"
                    accept=".ttf,.otf,.woff,.woff2,font/ttf,font/otf,font/woff,font/woff2"
                    onChange={(e) => loadCustomFont(e.target.files?.[0])}
                  />
                  <span>＋ Загрузить свой шрифт</span>
                  <small>TTF, OTF, WOFF или WOFF2 · до 3 МБ</small>
                </label>
                {settings.customFontData && (
                  <button
                    className="wide remove-custom-font"
                    onClick={() => {
                      if (customFontFaceRef.current) {
                        document.fonts.delete(customFontFaceRef.current);
                        customFontFaceRef.current = null;
                      }
                      loadedCustomFontRef.current = "";
                      setSettings((current) => ({
                        ...current,
                        handwriting:
                          current.handwriting === "custom"
                            ? "notebook"
                            : current.handwriting,
                        customFontName: "",
                        customFontData: "",
                      }));
                    }}
                  >
                    × Удалить загруженный шрифт
                  </button>
                )}
                <label className="range-field line-fill-control">
                  <span>
                    <b>Ширина строки <i className="help-dot" title="Меняет полезную ширину набора и количество слов в строке">?</i></b>
                    <em>{settings.lineFillPercent}%</em>
                  </span>
                  <input
                    type="range"
                    min="70"
                    max="160"
                    step="2"
                    value={settings.lineFillPercent}
                    onChange={(e) =>
                      update("lineFillPercent", Number(e.target.value))
                    }
                  />
                </label>
                <p className="hint">
                  Больше процентов — больше слов в строке. Узкая форма Eskal
                  учитывается автоматически.
                </p>
                <label className="range-field glyph-width-control" title="Горизонтально растягивает буквы, не меняя высоту строки">
                  <span><b>Ширина строки <i className="help-dot">?</i></b><em>{settings.scaleX}%</em></span>
                  <input type="range" min="70" max="180" step="1" value={settings.scaleX} onChange={(e)=>update("scaleX",Number(e.target.value))}/>
                </label>
                <label className="range-field">
                  <span>
                    <b>Толщина чернил</b>
                    <em>{settings.inkThicknessMm.toFixed(2)} мм</em>
                  </span>
                  <input
                    type="range"
                    min="0"
                    max="0.65"
                    step="0.05"
                    value={settings.inkThicknessMm}
                    onChange={(e) =>
                      update("inkThicknessMm", Number(e.target.value))
                    }
                  />
                </label>
                <div className="section-title">
                  <span>Заголовки</span>
                  <b>отдельно</b>
                </div>
                <div className="grid-2">
                  <NumberField
                    label="Размер заголовков"
                    value={settings.headingFontMm}
                    onChange={(v) => update("headingFontMm", Math.max(2, v))}
                  />
                  <NumberField
                    label="Толщина заголовков"
                    value={settings.headingInkThicknessMm}
                    onChange={(v) =>
                      update(
                        "headingInkThicknessMm",
                        Math.max(0, Math.min(0.8, v)),
                      )
                    }
                  />
                </div>
                <div className="segmented heading-presets">
                  {[
                    [4.2, 0.18, "Лёгкий"],
                    [4.8, 0.3, "Обычный"],
                    [5.5, 0.45, "Жирный"],
                  ].map(([font, ink, label]) => (
                    <button
                      key={String(label)}
                      onClick={() =>
                        setSettings((current) => ({
                          ...current,
                          headingFontMm: Number(font),
                          headingInkThicknessMm: Number(ink),
                        }))
                      }
                    >
                      {label}
                    </button>
                  ))}
                </div>
                <button
                  className="wide gel-pen-preset"
                  onClick={() =>
                    setSettings((current) => ({
                      ...current,
                      handwriting: "gel",
                      color: "#10131a",
                      opacity: 1,
                      fontMm: 4.15,
                      inkThicknessMm: 0.28,
                      headingFontMm: 5,
                      headingInkThicknessMm: 0.38,
                      printTextScale: 100,
                    }))
                  }
                >
                  ● Чёрная гелевая ручка
                </button>
                <NumberField
                  label="Интервал строк"
                  value={settings.lineMm}
                  onChange={(v) => update("lineMm", v)}
                />
                <NumberField
                  label="Наклон"
                  value={settings.slant}
                  onChange={(v) => update("slant", v)}
                  suffix="°"
                  step={1}
                />
                <button
                  className="wide angle-reset"
                  onClick={() => update("slant", 0)}
                >
                  ↺ Выровнять текст горизонтально
                </button>
                <label className="field">
                  <span>Цвет чернил</span>
                  <div className="color-row">
                    <input
                      type="color"
                      value={settings.color}
                      onChange={(e) => update("color", e.target.value)}
                    />
                    <code>{settings.color.toUpperCase()}</code>
                  </div>
                </label>
                <div className="ink-palette" aria-label="Готовые цвета чернил">
                  {[
                    "#080a0e",
                    "#182d58",
                    "#154f7a",
                    "#12645c",
                    "#542b73",
                    "#7b244b",
                    "#8d2d24",
                    "#a44b18",
                    "#694531",
                    "#53606d",
                    "#d24987",
                    "#15a0a0",
                  ].map((color) => (
                    <button
                      key={color}
                      className={settings.color === color ? "active" : ""}
                      style={{ background: color }}
                      onClick={() => update("color", color)}
                      title={color}
                    />
                  ))}
                </div>
                <label className="range-field">
                  <span>
                    <b>Живая линия</b>
                    <em>{Math.round(settings.jitter * 100)}%</em>
                  </span>
                  <input
                    type="range"
                    min="0"
                    max="1"
                    step=".01"
                    value={settings.jitter}
                    onChange={(e) => update("jitter", Number(e.target.value))}
                  />
                </label>
                <p className="hint">
                  Живая линия слегка меняет высоту базовой линии и расстояние
                  между буквами.
                </p>
                <label className="range-field">
                  <span>
                    <b>Разное начало строк</b>
                    <em>{settings.lineStartVariationMm.toFixed(1)} мм</em>
                  </span>
                  <input
                    type="range"
                    min="0"
                    max="4"
                    step=".1"
                    value={settings.lineStartVariationMm}
                    onChange={(e) =>
                      update("lineStartVariationMm", Number(e.target.value))
                    }
                  />
                </label>
                <div className="segmented realism-presets">
                  {[
                    [0, "Ровно"],
                    [0.8, "Естественно"],
                    [1.6, "Живее"],
                  ].map(([value, label]) => (
                    <button
                      key={String(value)}
                      className={
                        settings.lineStartVariationMm === value ? "active" : ""
                      }
                      onClick={() =>
                        update("lineStartVariationMm", Number(value))
                      }
                    >
                      {label}
                    </button>
                  ))}
                </div>
                <div className="grid-2">
                  <NumberField
                    label="Красная строка"
                    value={settings.indentMm}
                    onChange={(v) => update("indentMm", Math.max(0, v))}
                  />
                  <NumberField
                    label="Между абзацами"
                    value={settings.paragraphMm}
                    onChange={(v) => update("paragraphMm", Math.max(0, v))}
                  />
                </div>
                <p className="hint">
                  Сдвиг запоминается и совпадает в редакторе, PDF и на бумаге.
                  Заголовки остаются ровными, обычные строки чуть отличаются.
                </p>
                <div className="section-title">
                  <span>Маркер</span>
                </div>
                <div className="marker-palette">
                  {[
                    "#ffd84d",
                    "#ff8fa3",
                    "#73dfb0",
                    "#72c6ff",
                    "#bd9cff",
                    "#ff9f4d",
                  ].map((c) => (
                    <button
                      key={c}
                      className={settings.markerColor === c ? "active" : ""}
                      style={{ background: c }}
                      onClick={() => update("markerColor", c)}
                    />
                  ))}
                </div>
                <NumberField
                  label="Толщина маркера"
                  value={settings.markerWidth}
                  onChange={(v) => update("markerWidth", v)}
                />
                <label className="range-field">
                  <span>
                    <b>Прозрачность</b>
                    <em>{Math.round(settings.markerOpacity * 100)}%</em>
                  </span>
                  <input
                    type="range"
                    min=".1"
                    max=".8"
                    step=".05"
                    value={settings.markerOpacity}
                    onChange={(e) =>
                      update("markerOpacity", Number(e.target.value))
                    }
                  />
                </label>
                <button className="wide reset-appearance" onClick={()=>setSettings((current)=>({...current,handwriting:defaults.handwriting,lineFillPercent:defaults.lineFillPercent,scaleX:defaults.scaleX,lineMm:defaults.lineMm,slant:defaults.slant,jitter:defaults.jitter,lineStartVariationMm:defaults.lineStartVariationMm}))}>↺ Сбросить оформление</button>
                {selectedKey && (
                  <div className="object-inspector">
                    <div className="section-title">
                      <span>Выбранная строка</span>
                      <b>индивидуально</b>
                    </div>
                    <label className="field">
                      <span>Цвет</span>
                      <div className="color-row">
                        <input
                          type="color"
                          value={
                            lineStyles[selectedKey]?.color || settings.color
                          }
                          onChange={(e) =>
                            setLineStyles((v) => ({
                              ...v,
                              [selectedKey]: {
                                ...v[selectedKey],
                                color: e.target.value,
                              },
                            }))
                          }
                        />
                      </div>
                    </label>
                    <NumberField
                      label="Размер"
                      value={lineStyles[selectedKey]?.fontMm || settings.fontMm}
                      onChange={(n) =>
                        setLineStyles((v) => ({
                          ...v,
                          [selectedKey]: { ...v[selectedKey], fontMm: n },
                        }))
                      }
                    />
                    <NumberField
                      label="Наклон"
                      value={lineStyles[selectedKey]?.slant ?? settings.slant}
                      suffix="°"
                      step={1}
                      onChange={(n) =>
                        setLineStyles((v) => ({
                          ...v,
                          [selectedKey]: { ...v[selectedKey], slant: n },
                        }))
                      }
                    />
                    <button
                      className="wide"
                      onClick={() =>
                        setLineStyles((v) => {
                          const n = { ...v };
                          delete n[selectedKey];
                          return n;
                        })
                      }
                    >
                      Сбросить стиль строки
                    </button>
                  </div>
                )}
              </>
            )}
            {tab === "page" && (
              <>
                <div className="section-title">
                  <span>Формат бумаги</span>
                  <b>
                    {settings.paperFormat} · {size.widthMm}×{size.heightMm} мм
                  </b>
                </div>
                <label className="field">
                  <span>Размер листа</span>
                  <select
                    value={settings.paperFormat}
                    onChange={(e) =>
                      update("paperFormat", e.target.value as PaperFormat)
                    }
                  >
                    <option value="A4">A4 · 210 × 297 мм</option>
                    <option value="A5">A5 · 148 × 210 мм</option>
                    <option value="A6">A6 · 105 × 148 мм</option>
                    <option value="Letter">Letter · 216 × 279 мм</option>
                  </select>
                </label>
                <div className="segmented">
                  <button
                    className={
                      settings.orientation === "portrait" ? "active" : ""
                    }
                    onClick={() => update("orientation", "portrait")}
                  >
                    Книжная
                  </button>
                  <button
                    className={
                      settings.orientation === "landscape" ? "active" : ""
                    }
                    onClick={() => update("orientation", "landscape")}
                  >
                    Альбомная
                  </button>
                </div>
                <div className="section-title">
                  <span>Поля</span>
                  <b>мм</b>
                </div>
                <div className="grid-2">
                  <NumberField
                    label="Сверху"
                    value={settings.marginTop}
                    onChange={(v) => update("marginTop", v)}
                  />
                  <NumberField
                    label="Справа"
                    value={settings.marginRight}
                    onChange={(v) => update("marginRight", v)}
                  />
                  <NumberField
                    label="Снизу"
                    value={settings.marginBottom}
                    onChange={(v) => update("marginBottom", v)}
                  />
                  <NumberField
                    label="Слева"
                    value={settings.marginLeft}
                    onChange={(v) => update("marginLeft", v)}
                  />
                </div>
                <div className="section-title">
                  <span>Переплёт и дырокол</span>
                  <b>запоминается</b>
                </div>
                <div className="binding-picker">
                  {[
                    ["none", "Без дырок"],
                    ["left", "◌ Слева"],
                    ["right", "Справа ◌"],
                  ].map(([value, label]) => (
                    <button
                      key={value}
                      className={settings.bindingSide === value ? "active" : ""}
                      onClick={() =>
                        update("bindingSide", value as Settings["bindingSide"])
                      }
                    >
                      {label}
                    </button>
                  ))}
                </div>
                <div className="section-title">
                  <span>Сетка</span>
                </div>
                <select
                  value={settings.grid}
                  onChange={(e) =>
                    update("grid", Number(e.target.value) as Grid)
                  }
                >
                  <option value="0">Без сетки</option>
                  <option value="1">1 мм</option>
                  <option value="2">2 мм</option>
                  <option value="5">5 мм</option>
                  <option value="10">10 мм</option>
                </select>
                <label className="switch">
                  <span>
                    <b>Поля документа</b>
                    <small>Розовая рамка</small>
                  </span>
                  <input
                    type="checkbox"
                    checked={settings.showMargins}
                    onChange={(e) => update("showMargins", e.target.checked)}
                  />
                </label>
                <label className="switch">
                  <span>
                    <b>Безопасная зона</b>
                    <small>
                      {settings.showSafe
                        ? `${settings.safeMm} мм · обрезать печать по полям`
                        : "выключена · печатать за полями"}
                    </small>
                  </span>
                  <input
                    type="checkbox"
                    checked={settings.showSafe}
                    onChange={(e) => update("showSafe", e.target.checked)}
                  />
                </label>
              </>
            )}
            {showLegacyPanels && (
              <div className="export-panel">
                <div className="section-heading"><div><small>ГОТОВЫЙ МАКЕТ</small><h2>Экспорт файла</h2></div></div>
                <div className="export-presets">
                  <button onClick={() => exportPng(false)}><i>PNG</i><span><b>Текущая страница</b><small>Полный лист с фоном</small></span><em>→</em></button>
                  <button onClick={() => exportPng(true)}><i>ZIP</i><span><b>Все страницы</b><small>PNG по одному файлу</small></span><em>→</em></button>
                  <button onClick={() => exportPdf()}><i>PDF</i><span><b>PDF для печати</b><small>Точный формат A5</small></span><em>→</em></button>
                  <button onClick={() => renderPng(pageIndex, true)}><i>◫</i><span><b>Без фона</b><small>Текст, рисунки и стикеры</small></span><em>→</em></button>
                </div>
                <div className="section-title"><span>Качество</span></div>
                <div className="segmented export-dpi">{[300, 600].map((dpi) => <button key={dpi} className={settings.dpi === dpi ? "active" : ""} onClick={() => update("dpi", dpi as 300 | 600)}>{dpi} DPI</button>)}</div>
                <div className="export-info">A5 · {size.widthMm} × {size.heightMm} мм · {pages.length} стр.</div>
              </div>
            )}
            {showLegacyPanels && (
              <>
                {isAndroid && (
                  <div className="mobile-print-actions">
                    <div className="mobile-print-hero">
                      <i>🖨️</i>
                      <span>
                        <b>Печать на Android</b>
                        <small>
                          Макет передаётся как точный PDF {settings.paperFormat}
                        </small>
                      </span>
                    </div>
                    <button
                      className="wide primary"
                      disabled={printing}
                      onClick={() => androidPrint("epson")}
                    >
                      {printing ? "Готовим PDF…" : "Открыть в Epson iPrint"}
                    </button>
                    <button
                      className="wide"
                      disabled={printing}
                      onClick={() => androidPrint("system")}
                    >
                      Системная печать Android
                    </button>
                    <button className="wide" onClick={androidChooseFile}>
                      Выбрать PDF или изображение
                    </button>
                    <p className="hint">
                      Если Epson отсутствует в обычной печати, используйте
                      первую кнопку и выберите установленное приложение Epson.
                    </p>
                  </div>
                )}
                {!isAndroid && (
                  <>
                    <div className="section-title">
                      <span>Профиль принтера</span>
                    </div>
                    <select
                      value={settings.printerName}
                      onChange={(e) => update("printerName", e.target.value)}
                    >
                      {printers.length === 0 && (
                        <option value="">Принтеры не найдены</option>
                      )}
                      {printers.map((printer) => (
                        <option key={printer.name} value={printer.name}>
                          {printer.displayName || printer.name}
                          {printer.isDefault ? " · по умолчанию" : ""}
                        </option>
                      ))}
                    </select>
                  </>
                )}
                <label className="field">
                  <span>Формат бумаги в принтере</span>
                  <select
                    value={settings.paperFormat}
                    onChange={(e) =>
                      update("paperFormat", e.target.value as PaperFormat)
                    }
                  >
                    <option value="A4">A4 · 210 × 297 мм</option>
                    <option value="A5">A5 · 148 × 210 мм</option>
                    <option value="A6">A6 · 105 × 148 мм</option>
                    <option value="Letter">Letter · 216 × 279 мм</option>
                  </select>
                  <small>
                    Этот формат будет установлен в драйвере перед печатью
                  </small>
                </label>
                <div className="grid-2">
                  <NumberField
                    label="Копии"
                    value={settings.printCopies}
                    onChange={(v) =>
                      update(
                        "printCopies",
                        Math.max(1, Math.min(99, Math.round(v))),
                      )
                    }
                  />
                  <label className="field">
                    <span>Двусторонняя печать</span>
                    <select
                      value={settings.printDuplex}
                      onChange={(e) =>
                        update(
                          "printDuplex",
                          e.target.value as Settings["printDuplex"],
                        )
                      }
                    >
                      <option value="simplex">Одна сторона</option>
                      <option value="longEdge">По длинному краю</option>
                      <option value="shortEdge">По короткому краю</option>
                    </select>
                  </label>
                </div>
                <label className="switch">
                  <span>
                    <b>Цветная печать</b>
                    <small>Выключите для чёрно-белой</small>
                  </span>
                  <input
                    type="checkbox"
                    checked={settings.printColor}
                    onChange={(e) => update("printColor", e.target.checked)}
                  />
                </label>
                <label className="range-field print-size-control">
                  <span>
                    <b>Размер текста при печати</b>
                    <em>{settings.printTextScale}%</em>
                  </span>
                  <input
                    type="range"
                    min="80"
                    max="180"
                    step="5"
                    value={settings.printTextScale}
                    onChange={(e) =>
                      update("printTextScale", Number(e.target.value))
                    }
                  />
                  <small>
                    Меняет только буквы на бумаге, не масштабирует лист A5
                  </small>
                </label>
                <div className="grid-2">
                  <NumberField
                    label="Высота на бумаге"
                    value={settings.fontMm}
                    onChange={(v) => update("fontMm", Math.max(1.5, v))}
                  />
                  <NumberField
                    label="Толщина чернил"
                    value={settings.inkThicknessMm}
                    onChange={(v) =>
                      update("inkThicknessMm", Math.max(0, Math.min(0.65, v)))
                    }
                  />
                  <NumberField
                    label="Размер заголовков"
                    value={settings.headingFontMm}
                    onChange={(v) => update("headingFontMm", Math.max(2, v))}
                  />
                  <NumberField
                    label="Толщина заголовков"
                    value={settings.headingInkThicknessMm}
                    onChange={(v) =>
                      update(
                        "headingInkThicknessMm",
                        Math.max(0, Math.min(0.8, v)),
                      )
                    }
                  />
                </div>
                <div className="grid-2">
                  <NumberField
                    label="Смещение X"
                    value={settings.offsetX}
                    onChange={(v) => update("offsetX", v)}
                  />
                  <NumberField
                    label="Смещение Y"
                    value={settings.offsetY}
                    onChange={(v) => update("offsetY", v)}
                  />
                  <NumberField
                    label="Масштаб X"
                    value={settings.scaleX}
                    onChange={(v) => update("scaleX", v)}
                    suffix="%"
                    step={0.01}
                  />
                  <NumberField
                    label="Масштаб Y"
                    value={settings.scaleY}
                    onChange={(v) => update("scaleY", v)}
                    suffix="%"
                    step={0.01}
                  />
                </div>
                <button
                  className="wide save-print-settings"
                  onClick={() => persistProject(true)}
                >
                  ✓ Сохранить настройки
                </button>
                <div className="print-settings-status">
                  <b>
                    {saved
                      ? "Настройки сохранены"
                      : "Есть несохранённые изменения"}
                  </b>
                  <span>
                    {lastCommitted
                      ? `${lastCommitted.time} · ${lastCommitted.format} · слева ${lastCommitted.left} мм · справа ${lastCommitted.right} мм`
                      : `Текущие: ${settings.paperFormat} · слева ${layoutSettings.marginLeft} мм · справа ${layoutSettings.marginRight} мм`}
                  </span>
                </div>
                <div className="print-geometry">
                  <b>Физическая геометрия задания</b>
                  <span>
                    {size.widthMm}×{size.heightMm} мм →{" "}
                    {Math.round(mmToPx(size.widthMm, settings.dpi))}×
                    {Math.round(mmToPx(size.heightMm, settings.dpi))} px ·{" "}
                    {settings.dpi} DPI
                  </span>
                  <span>
                    Область текста:{" "}
                    {(
                      size.widthMm -
                      layoutSettings.marginLeft -
                      layoutSettings.marginRight
                    ).toFixed(1)}
                    ×
                    {(
                      size.heightMm -
                      settings.marginTop -
                      settings.marginBottom
                    ).toFixed(1)}{" "}
                    мм
                  </span>
                  <span>
                    Поля: {layoutSettings.marginLeft} / {settings.marginTop} /{" "}
                    {layoutSettings.marginRight} / {settings.marginBottom} мм
                  </span>
                </div>
                <button className="wide" onClick={calibrationSheet}>
                  ⊕ Скачать калибровочный лист
                </button>
                <button className="wide" onClick={openPrintPreview}>
                  ◉ Предпросмотр печати
                </button>
                {!isAndroid && (
                  <button
                    className="wide primary"
                    onClick={printDocument}
                    disabled={printing || printers.length === 0}
                  >
                    {printing ? "Отправляем…" : "⎙ Напечатать этот макет"}
                  </button>
                )}
                <div className="print-note">
                  <b>Параметры передаются принтеру автоматически</b>
                  <span>
                    {settings.paperFormat} ·{" "}
                    {settings.orientation === "portrait"
                      ? "книжная"
                      : "альбомная"}
                  </span>
                  <span>
                    {pages.length} страниц · {settings.printCopies} коп.
                  </span>
                </div>
              </>
            )}
            {showLegacyPanels && (
              <>
                <div className="theme-hero">
                  <div
                    className={`theme-sticker sticker-${settings.uiTheme}`}
                  />
                  <span>
                    <b>Настроение редактора</b>
                    <small>Тема меняет окна, кнопки, стол и декор.</small>
                  </span>
                </div>
                <div className="theme-gallery">
                  {[
                    ["classic", "Утренняя бумага", "Тёплая и спокойная", "☀️"],
                    ["kawaii", "Каваи", "Розовая и милая", "💗"],
                    ["dark", "Лунная ночь", "Тёмная для вечера", "🌙"],
                    ["halloween", "Тыквенная ночь", "Фиолетовая с оранжевым", "🎃"],
                    ["mint", "Мятный кот", "Свежая зелёная", "🐱"],
                    ["sunset", "Закат", "Персиковый градиент", "🌅"],
                    ["ocean", "Морская пена", "Голубая и воздушная", "🌊"],
                    ["lavender", "Лавандовое облако", "Мягкая сиреневая", "☁️"],
                    ["coffee", "Кофе с молоком", "Тёплая бежевая", "☕"],
                    ["candy", "Конфетти", "Яркая разноцветная", "🍬"],
                    ["forest", "Лесная тишина", "Глубокая зелёная", "🌲"],
                    ["neon", "Неоновый город", "Контрастная ночная", "✨"],
                  ].map((t) => (
                    <button
                      key={t[0]}
                      className={`${settings.uiTheme === t[0] ? "active" : ""} theme-option option-${t[0]}`}
                      onClick={() =>
                        update("uiTheme", t[0] as Settings["uiTheme"])
                      }
                    >
                      <div className="theme-symbol" aria-hidden="true">
                        {t[3]}
                      </div>
                      <span>
                        <b>{t[1]}</b>
                        <small>{t[2]}</small>
                      </span>
                    </button>
                  ))}
                </div>
                <div className="section-title appearance-title">
                  <span>Цвет линейки</span>
                </div>
                <div className="ruler-colors">
                  {[
                    ["classic", "Светлая"],
                    ["pink", "Розовая"],
                    ["blue", "Голубая"],
                    ["mint", "Мятная"],
                    ["purple", "Сиреневая"],
                    ["dark", "Тёмная"],
                  ].map(([color, label]) => (
                    <button
                      key={color}
                      className={`${color} ${settings.rulerColor === color ? "active" : ""}`}
                      onClick={() =>
                        update("rulerColor", color as Settings["rulerColor"])
                      }
                    >
                      <i />
                      <span>{label}</span>
                    </button>
                  ))}
                </div>
                <div className="section-title appearance-title">
                  <span>Иконка приложения</span>
                  <b>меняется сразу</b>
                </div>
                <div className="app-icon-picker">
                  {[
                    ["coral", "Искра"],
                    ["kawaii", "Каваи"],
                    ["moon", "Луна"],
                    ["mint", "Мята"],
                  ].map(([icon, label]) => (
                    <button
                      key={icon}
                      className={settings.appIcon === icon ? "active" : ""}
                      onClick={() =>
                        update("appIcon", icon as Settings["appIcon"])
                      }
                    >
                      <img src={`./icons/app-icon-${icon}.png`} alt="" />
                      <span>{label}</span>
                    </button>
                  ))}
                </div>
                <div className="section-title appearance-title">
                  <span>Рабочее пространство</span>
                </div>
                <div className="desk-choice">
                  {[
                    ["sage", "Шалфей"],
                    ["graphite", "Графит"],
                    ["sand", "Песок"],
                    ["rose", "Розовый"],
                    ["lavender", "Лаванда"],
                    ["ocean", "Океан"],
                    ["peach", "Персик"],
                    ["midnight", "Полночь"],
                    ["aurora", "Аврора"],
                  ].map(([desk, label]) => (
                    <button
                      key={desk}
                      className={`${desk} ${settings.deskTheme === desk ? "active" : ""}`}
                      onClick={() =>
                        update("deskTheme", desk as Settings["deskTheme"])
                      }
                    >
                      <i />
                      <span>{label}</span>
                    </button>
                  ))}
                </div>
                <div className="section-title appearance-title">
                  <span>Лист и фон</span>
                </div>
                <div className="background-tools">
                  <label className="paper-color">
                    <input
                      type="color"
                      value={settings.backgroundColor}
                      onChange={(e) =>
                        update("backgroundColor", e.target.value)
                      }
                    />
                    <span>Цвет листа</span>
                  </label>
                  <label className="upload-bg">
                    <input
                      type="file"
                      accept="image/*"
                      onChange={(e) => loadBackground(e.target.files?.[0])}
                    />
                    <span>⊕ Свой фон</span>
                  </label>
                </div>
                <div className="background-presets">
                  {[
                    ["blush", "Сердечки"],
                    ["dream", "Лунный сон"],
                    ["sky", "Облачка"],
                    ["latte", "Кофейный"],
                  ].map(([name, label]) => (
                    <button
                      key={name}
                      onClick={() => {
                        update(
                          "backgroundImage",
                          `./decor/background-${name}.jpg`,
                        );
                        update("backgroundOpacity", 0.72);
                      }}
                    >
                      <img src={`./decor/background-${name}.jpg`} alt="" />
                      <span>{label}</span>
                    </button>
                  ))}
                </div>
                <div className="section-title appearance-title">
                  <span>Смайлы и стикеры</span>
                  <b>печатаются</b>
                </div>
                <div className="sticker-library">
                  {[
                    "star",
                    "heart",
                    "moon",
                    "cloud",
                    "cat",
                    "frog",
                    "cherry",
                    "strawberry",
                    "flower",
                    "rainbow",
                    "coffee",
                    "book",
                    "pencil",
                    "sparkles",
                    "ghost",
                    "pumpkin",
                  ].map((name) => (
                    <button
                      key={name}
                      onClick={() => addSticker(name)}
                      title={name}
                    >
                      <img src={`./decor/sticker-${name}.png`} alt={name} />
                    </button>
                  ))}
                </div>
                {settings.backgroundImage && (
                  <>
                    <label className="range-field">
                      <span>
                        <b>Прозрачность фона</b>
                        <em>{Math.round(settings.backgroundOpacity * 100)}%</em>
                      </span>
                      <input
                        type="range"
                        min="0.05"
                        max="1"
                        step=".05"
                        value={settings.backgroundOpacity}
                        onChange={(e) =>
                          update("backgroundOpacity", Number(e.target.value))
                        }
                      />
                    </label>
                    <button
                      className="wide remove-bg"
                      onClick={() => update("backgroundImage", "")}
                    >
                      × Убрать фон
                    </button>
                  </>
                )}
              </>
            )}
          </div>
        </aside>
        <div className="panel-resizer left-resizer" onPointerDown={(event) => {
          const startX=event.clientX,startWidth=leftWidth;
          const move=(e:PointerEvent)=>setLeftWidth(Math.max(320,Math.min(460,startWidth+e.clientX-startX)));
          const end=()=>{window.removeEventListener("pointermove",move);window.removeEventListener("pointerup",end)};
          window.addEventListener("pointermove",move);window.addEventListener("pointerup",end);
        }} />
        <section className="canvas-area">
          <div className="canvas-top">
            <div>
              <button onClick={() => setPageIndex(Math.max(0, pageIndex - 1))}>
                ‹
              </button>
              <strong>
                {pageIndex + 1} / {pages.length}
              </strong>
              <button
                onClick={() =>
                  setPageIndex(Math.min(pages.length - 1, pageIndex + 1))
                }
              >
                ›
              </button>
            </div>
            <div className="top-zoom">
              <button
                onClick={() => update("zoom", Math.max(40, settings.zoom - 10))}
              >
                −
              </button>
              <input
                type="range"
                min="40"
                max="300"
                value={settings.zoom}
                onChange={(e) => update("zoom", Number(e.target.value))}
              />
              <button
                onClick={() =>
                  update("zoom", Math.min(300, settings.zoom + 10))
                }
              >
                +
              </button>
              <b>{settings.zoom}%</b>
            </div>
            <span>
              {size.widthMm} × {size.heightMm} мм
            </span>
          </div>
          <div className="workspace-toolbar">
            <div className="toolbar-page-nav">
              <button onClick={() => setPageIndex(Math.max(0,pageIndex-1))}>‹</button>
              <b>{pageIndex + 1} / {pages.length}</b>
              <button onClick={() => setPageIndex(Math.min(pages.length-1,pageIndex+1))}>›</button>
            </div>
            <button
              className="smart-align"
              onClick={smartAlign}
              title="Быстро выровнять весь текст"
            >
              ✦ Выровнять макет
            </button>
            <div
              className="text-width-control toolbar-width-removed"
              title="Сжатие и растяжение текста"
            >
              <button
                onClick={() =>
                  update("scaleX", Math.max(70, settings.scaleX - 5))
                }
                title="Сжать текст"
              >
                ↤
              </button>
              <label>
                <small>Ширина</small>
                <input
                  type="range"
                  min="70"
                  max="160"
                  step="1"
                  value={settings.scaleX}
                  onChange={(e) => update("scaleX", Number(e.target.value))}
                />
                <b>{settings.scaleX}%</b>
              </label>
              <button
                onClick={() => update("scaleX", 100)}
                title="Обычная ширина"
              >
                1:1
              </button>
              <button
                onClick={() =>
                  update("scaleX", Math.min(160, settings.scaleX + 5))
                }
                title="Растянуть текст"
              >
                ↦
              </button>
            </div>
            <span />
            <button
              className={tool === "cursor" ? "active" : ""}
              onClick={() => setTool("cursor")}
              title="Курсор"
            >
              ↖
            </button>
            <button
              className={tool === "hand" ? "active" : ""}
              onClick={() => setTool("hand")}
              title="Ладонь"
            >
              ✋
            </button>
            <button className={`removed-text-tool ${tool === "text" ? "active" : ""}`}
              onClick={() => setTool("text")}
              title="Текст"
            >
              T
            </button>
            <span />
            <div className={`tool-menu ${activeToolMenu === "pencil" ? "open" : ""}`}>
              <button className={tool === "pencil" ? "active" : ""} onClick={(event) => {event.stopPropagation();setLayers((value)=>({...value,drawing:true}));setTool("pencil");setActiveToolMenu((value)=>value==="pencil"?null:"pencil")}} title="Карандаш">✎</button>
              <div className="tool-popover"><b>Карандаш</b><label>Цвет<input type="color" value={settings.color} onChange={(e)=>update("color",e.target.value)}/></label><label>Толщина<input type="range" min=".2" max="1.4" step=".1" value={pencilWidth} onChange={(e)=>setPencilWidth(Number(e.target.value))}/></label><label>Прозрачность<input type="range" min=".2" max="1" step=".05" value={pencilOpacity} onChange={(e)=>setPencilOpacity(Number(e.target.value))}/></label></div>
            </div>
            <div className={`tool-menu ${activeToolMenu === "marker" ? "open" : ""}`}>
              <button className={tool === "marker" ? "active" : ""} onClick={(event) => {event.stopPropagation();setLayers((value)=>({...value,drawing:true}));setTool("marker");setActiveToolMenu((value)=>value==="marker"?null:"marker")}} title="Маркер">▬</button>
              <div className="tool-popover"><b>Маркер</b><label>Цвет<input type="color" value={settings.markerColor} onChange={(e)=>update("markerColor",e.target.value)}/></label><label>Толщина<input type="range" min="1" max="8" step=".2" value={settings.markerWidth} onChange={(e)=>update("markerWidth",Number(e.target.value))}/></label><label>Прозрачность<input type="range" min=".1" max=".8" step=".05" value={settings.markerOpacity} onChange={(e)=>update("markerOpacity",Number(e.target.value))}/></label><label className="popover-switch">Ровная линия<input type="checkbox" checked={markerStraight} onChange={(e)=>setMarkerStraight(e.target.checked)}/></label><small>Для быстрого выделения одной линией</small></div>
            </div>
            <div className={`tool-menu ${activeToolMenu === "eraser" ? "open" : ""}`}>
              <button className={tool === "eraser" ? "active" : ""} onClick={(event) => {event.stopPropagation();setTool("eraser");setActiveToolMenu((value)=>value==="eraser"?null:"eraser")}} title="Точечный ластик">◇</button>
              <div className="tool-popover"><b>Ластик</b><label>Диаметр<input type="range" min="1" max="12" step=".5" value={eraserWidth} onChange={(e)=>setEraserWidth(Number(e.target.value))}/></label><small>{eraserWidth} мм · стирает только участок линии</small></div>
            </div>
          </div>
          {showLegacyPanels && (
            <div className="integrated-tool-panel">
              <header>
                <b>Настройки инструмента</b>
                <button>×</button>
              </header>
              <div className="tool-options">
                <label>
                  <span>Цвет ручки</span>
                  <input
                    type="color"
                    value={settings.color}
                    onChange={(e) => update("color", e.target.value)}
                  />
                </label>
                <label>
                  <span>Цвет маркера</span>
                  <input
                    type="color"
                    value={settings.markerColor}
                    onChange={(e) => update("markerColor", e.target.value)}
                  />
                </label>
                <NumberField
                  label="Толщина маркера"
                  value={settings.markerWidth}
                  onChange={(v) => update("markerWidth", v)}
                />
                <label className="range-field">
                  <span>
                    <b>Прозрачность</b>
                    <em>{Math.round(settings.markerOpacity * 100)}%</em>
                  </span>
                  <input
                    type="range"
                    min=".1"
                    max=".8"
                    step=".05"
                    value={settings.markerOpacity}
                    onChange={(e) =>
                      update("markerOpacity", Number(e.target.value))
                    }
                  />
                </label>
              </div>
            </div>
          )}
          <div
            ref={deskRef}
            className={`desk theme-${settings.deskTheme} ruler-${settings.rulerColor} ${spaceDown || tool === "hand" ? "panning" : ""}`}
            style={{ "--scale": scale } as React.CSSProperties}
            onPointerDown={(event) => { setActiveToolMenu(null); panStart(event); }}
            onTouchStart={mobileTouchStart}
            onTouchMove={mobileTouchMove}
            onTouchEnd={mobileTouchEnd}
            onTouchCancel={mobileTouchEnd}
            onClick={() => tool === "cursor" && setSelectedKey(null)}
          >
            <div
              className="page-cluster"
              style={{
                width: size.widthMm * scale + 34,
                height: pageFlow === "continuous" ? pages.length * (size.heightMm * scale + 32) : size.heightMm * scale + 34,
                transform:`translate(${canvasPan.x}px, ${canvasPan.y}px)`,
              }}
            >
              {pageFlow === "continuous" && <div className="continuous-pages">
                {pages.map((sheet,sheetIndex)=><article ref={(node)=>{continuousSheetRefs.current[sheetIndex]=node}} key={sheetIndex} className={`continuous-sheet tool-${tool} ${sheetIndex===pageIndex?"current":""}`} onClick={()=>setPageIndex(sheetIndex)} style={{width:size.widthMm*scale,height:size.heightMm*scale,backgroundColor:settings.backgroundColor}}>
                  {layers.background&&settings.backgroundImage&&<div className="page-background" style={{backgroundImage:`url(${settings.backgroundImage})`,opacity:settings.backgroundOpacity}}/>}
                  {settings.grid>0&&<div className="grid" style={{backgroundSize:`${settings.grid*scale}px ${settings.grid*scale}px`}}/>}
                  {sheet.map((line,lineIndex)=>{const key=`${sheetIndex}-${lineIndex}`,d=elementOffsets[key]||{x:0,y:0},ls=lineStyles[key]||{},heading=line.kind==="heading",startShift=lineStartShift(sheetIndex,lineIndex,line),wave=Math.sin((lineIndex+settings.seed)*1.7)*settings.jitter*1.8,verticalScale=settings.scaleY/100,horizontalScale=settings.scaleX/100,lineColor=ls.color||(heading?settings.headingColor:settings.color),individualScale=ls.scaleX??(heading?settings.headingScaleX/100:1);return <div key={key} contentEditable={editingKey===key} suppressContentEditableWarning onPointerDown={(e)=>dragText(e,key)} onClick={(e)=>{e.stopPropagation();setPageIndex(sheetIndex);setSelectedKey(key);setSelectAll(false)}} onDoubleClick={(e)=>{e.stopPropagation();setEditingKey(key);window.setTimeout(()=>e.currentTarget.focus(),0)}} onBlur={(e)=>{if(editingKey===key){editPreviewLine(line.text,e.currentTarget.textContent||line.text);setEditingKey(null)}}} className={`continuous-line ${selectAll||selectedKey===key?"selected":""} ${line.kind}`} style={{left:(line.xMm+startShift+d.x+settings.offsetX)*scale,top:(line.yMm+d.y+wave+settings.offsetY)*scale,maxWidth:Math.max(1,(size.widthMm-layoutSettings.marginRight-line.xMm-startShift-d.x-settings.offsetX)/Math.max(.01,horizontalScale))*scale,overflow:"hidden",fontSize:(ls.fontMm||(heading?settings.headingFontMm:settings.fontMm))*scale*verticalScale,fontFamily:handwritingFont,color:lineColor,WebkitTextStroke:`${(ls.inkThicknessMm??(heading?settings.headingInkThicknessMm:settings.inkThicknessMm))*scale}px ${lineColor}`,lineHeight:`${(ls.lineMm??settings.lineMm)*scale*verticalScale}px`,letterSpacing:`${wave*.025*scale}px`,fontWeight:(ls.bold??(heading||settings.textBold))?700:400,fontStyle:(ls.italic??settings.textItalic)?"italic":"normal",textDecoration:`${(ls.underline??settings.textUnderline)?"underline ":""}${(ls.strike??settings.textStrike)?"line-through":""}`,opacity:ls.opacity??settings.opacity,transform:`rotate(${ls.slant??settings.slant}deg) scaleX(${horizontalScale*individualScale})`,transformOrigin:"left center"}}>{line.text}</div>})}
                  <svg data-page={sheetIndex} className={`drawing-layer ${["pen","pencil","marker","eraser"].includes(tool)?"active":""}`} viewBox={`0 0 ${size.widthMm} ${size.heightMm}`} preserveAspectRatio="none" onPointerDown={(event)=>oldDrawStart(event,sheetIndex)} onPointerMove={oldDrawMove} onPointerUp={oldDrawEnd} onPointerCancel={oldDrawEnd}>
                    {strokes.filter((stroke)=>stroke&&stroke.page===sheetIndex).map((stroke)=><path key={stroke.id} d={pathData(stroke.points)} fill="none" stroke={stroke.color} strokeWidth={stroke.width} strokeLinecap="round" strokeLinejoin="round" opacity={stroke.opacity??1}/>)}
                    {activeStroke?.page===sheetIndex&&<path d={pathData(activeStroke.points)} fill="none" stroke={activeStroke.color} strokeWidth={activeStroke.width} strokeLinecap="round" strokeLinejoin="round" opacity={activeStroke.opacity??1}/>} 
                  </svg>
                </article>)}
              </div>}
              <Ruler width={size.widthMm} scale={scale} horizontal />
              <Ruler width={size.heightMm} scale={scale} />
              <article
                ref={paperRef}
                className={`paper ${settings.handwriting} tool-${tool}`}
                style={{
                  width: size.widthMm * scale,
                  height: size.heightMm * scale,
                  left: 34,
                  top: 34,
                  backgroundColor: settings.backgroundColor,
                }}
                onClick={(e) => e.stopPropagation()}
              >
                {layers.background && settings.backgroundImage && (
                  <div
                    className="page-background"
                    style={{
                      backgroundImage: `url(${settings.backgroundImage})`,
                      opacity: settings.backgroundOpacity,
                    }}
                  />
                )}
                {settings.bindingSide !== "none" && (
                  <div className={`paper-holes ${settings.bindingSide}`}>
                    {Array.from({ length: settings.holeCount }, (_, i) => (
                      <i
                        key={i}
                        style={{
                          top: `${((i + 1) / (settings.holeCount + 1)) * 100}%`,
                        }}
                      />
                    ))}
                  </div>
                )}
                {settings.grid > 0 && (
                  <div
                    className="grid"
                    style={{
                      backgroundSize: `${settings.grid * scale}px ${settings.grid * scale}px`,
                    }}
                  />
                )}
                {settings.showSafe && (
                  <div
                    className="safe"
                    style={{
                      top:
                        Math.max(settings.safeMm, settings.marginTop) * scale,
                      right:
                        Math.max(settings.safeMm, layoutSettings.marginRight) *
                        scale,
                      bottom:
                        Math.max(settings.safeMm, settings.marginBottom) *
                        scale,
                      left:
                        Math.max(settings.safeMm, layoutSettings.marginLeft) *
                        scale,
                    }}
                  />
                )}
                {settings.showMargins && (
                  <div
                    className="margins"
                    style={{
                      top: settings.marginTop * scale,
                      right: layoutSettings.marginRight * scale,
                      bottom: settings.marginBottom * scale,
                      left: layoutSettings.marginLeft * scale,
                    }}
                  />
                )}
                {guides.map((g, i) => (
                  <div
                    key={i}
                    className="guide-v"
                    style={{ left: g * scale }}
                    title="Двойной щелчок — удалить направляющую"
                    onDoubleClick={() =>
                      setGuides((all) => all.filter((_, index) => index !== i))
                    }
                  >
                    <span>{g.toFixed(1)} мм</span>
                  </div>
                ))}
                {layers.text && (
                  <div
                    className="print-content"
                    style={{
                      transform: `translate(${settings.offsetX * scale}px,${settings.offsetY * scale}px) scale(${settings.scaleX / 100},${settings.scaleY / 100})`,
                      transformOrigin: "top left",
                      // This is the final hard boundary used both on screen and
                      // by the print renderer. Individual line transforms can no
                      // longer leak past an ordinary or safe margin.
                      clipPath: `inset(${layoutSettings.marginTop * scale}px ${layoutSettings.marginRight * scale}px ${layoutSettings.marginBottom * scale}px ${layoutSettings.marginLeft * scale}px)`,
                    }}
                  >
                    {page.map((line, i) => {
                      const key = `${pageIndex}-${i}`,
                        d = elementOffsets[key] || { x: 0, y: 0 },
                        ls = lineStyles[key] || {},
                        startShift = lineStartShift(pageIndex, i, line),
                        wave =
                          Math.sin((i + settings.seed) * 1.7) *
                          settings.jitter *
                          1.8;
                      return (
                        <div
                          key={i}
                          contentEditable={editingKey === key}
                          suppressContentEditableWarning
                          title={
                            tool === "cursor"
                              ? "Один клик — выбрать, двойной — редактировать"
                              : "Двойной клик — редактировать"
                          }
                          onPointerDown={(e) => dragText(e, key)}
                          onClick={(e) => {
                            e.stopPropagation();
                            setSelectedKey(key);
                            setSelectedImage(null);
                          }}
                          onDoubleClick={(e) => {
                            e.stopPropagation();
                            setEditingKey(key);
                            window.setTimeout(() => e.currentTarget.focus(), 0);
                          }}
                          onBlur={(e) =>
                            editingKey === key &&
                            (editPreviewLine(
                              line.text,
                              e.currentTarget.textContent || line.text,
                            ), setEditingKey(null))
                          }
                          onKeyDown={(e) => {
                            if (e.key === "Enter") {
                              e.preventDefault();
                              e.currentTarget.blur();
                            }
                          }}
                          className={`paper-line editable ${selectAll || selectedKey === key ? "selected" : ""} ${line.kind}`}
                          style={{
                            left: (line.xMm + startShift + d.x) * scale,
                            top: (line.yMm + d.y + wave) * scale,
                            maxWidth:
                              Math.max(
                                8,
                                size.widthMm -
                                  layoutSettings.marginRight -
                                  line.xMm -
                                  startShift -
                                  d.x,
                              ) * scale,
                            overflow: "hidden",
                            fontSize:
                              (ls.fontMm ||
                                (line.kind === "heading"
                                  ? settings.headingFontMm
                                  : settings.fontMm)) * scale,
                            fontFamily: handwritingFont,
                            WebkitTextStroke: `${(ls.inkThicknessMm ?? (line.kind === "heading" ? settings.headingInkThicknessMm : settings.inkThicknessMm)) * scale}px ${ls.color || settings.color}`,
                            lineHeight: `${(ls.lineMm ?? settings.lineMm) * scale}px`,
                            letterSpacing: `${wave * 0.025 * scale}px`,
                            color: ls.color || settings.color,
                            fontWeight: (ls.bold ?? settings.textBold) ? 700 : 400,
                            fontStyle: (ls.italic ?? settings.textItalic) ? "italic" : "normal",
                            textDecoration: `${(ls.underline ?? settings.textUnderline) ? "underline " : ""}${(ls.strike ?? settings.textStrike) ? "line-through" : ""}`,
                            opacity: ls.opacity ?? settings.opacity,
                            transform: `rotate(${ls.slant ?? settings.slant}deg) scaleX(${ls.scaleX ?? (line.kind === "heading" ? settings.headingScaleX / 100 : 1)})`,
                            transformOrigin: "left center",
                          }}
                        >
                          {line.text}
                        </div>
                      );
                    })}
                  </div>
                )}
                {images
                  .filter((img) => img.page === pageIndex)
                  .map((img) => (
                    <div
                      key={img.id}
                      className={`inserted-image ${selectedImage === img.id ? "selected" : ""}`}
                      onPointerDown={(e) => dragImage(e, img)}
                      style={{
                        left: img.x * scale,
                        top: img.y * scale,
                        width: img.width * scale,
                        height: img.height * scale,
                      }}
                    >
                      <img
                        src={img.src}
                        alt="Вставленный объект"
                        draggable={false}
                      />
                    </div>
                  ))}
                <svg data-page={pageIndex} className={`drawing-layer ${["pen","pencil","marker","eraser"].includes(tool)?"active":""}`} viewBox={`0 0 ${size.widthMm} ${size.heightMm}`} preserveAspectRatio="none" onPointerDown={oldDrawStart} onPointerMove={oldDrawMove} onPointerUp={oldDrawEnd} onPointerCancel={oldDrawEnd}>
                  {strokes.filter((stroke)=>stroke&&stroke.page===pageIndex).map((stroke)=><path key={stroke.id} d={pathData(stroke.points)} fill="none" stroke={stroke.color} strokeWidth={stroke.width} strokeLinecap="round" strokeLinejoin="round" opacity={stroke.opacity??1}/>)}
                  {activeStroke&&<path d={pathData(activeStroke.points)} fill="none" stroke={activeStroke.color} strokeWidth={activeStroke.width} strokeLinecap="round" strokeLinejoin="round" opacity={activeStroke.opacity??1}/>} 
                </svg>
                <canvas ref={drawingCanvasRef} className="drawing-canvas" aria-label="Резервный слой рисования" />
                {debug && (
                  <div className="debug-label">
                    page: {size.widthMm}×{size.heightMm} mm
                    <br />
                    content:{" "}
                    {size.widthMm -
                      layoutSettings.marginLeft -
                      layoutSettings.marginRight}
                    ×
                    {size.heightMm - settings.marginTop - settings.marginBottom}{" "}
                    mm
                    <br />
                    scale: {scale.toFixed(3)} px/mm
                  </div>
                )}
              </article>
            </div>
          </div>
          <footer className="statusbar">
            <span>
              <i className="green" />
              {pages.length} страниц · A5
            </span>
            <div className="zoom">
              <button
                onClick={() => update("zoom", Math.max(40, settings.zoom - 10))}
              >
                −
              </button>
              <input
                type="range"
                min="40"
                max="300"
                value={settings.zoom}
                onChange={(e) => update("zoom", Number(e.target.value))}
              />
              <button
                onClick={() =>
                  update("zoom", Math.min(300, settings.zoom + 10))
                }
              >
                +
              </button>
              <b>{settings.zoom}%</b>
            </div>
          </footer>
        </section>
        <div className="panel-resizer right-resizer" onPointerDown={(event) => {
          const startX=event.clientX,startWidth=rightWidth;
          const move=(e:PointerEvent)=>setRightWidth(Math.max(320,Math.min(440,startWidth-(e.clientX-startX))));
          const end=()=>{window.removeEventListener("pointermove",move);window.removeEventListener("pointerup",end)};
          window.addEventListener("pointermove",move);window.addEventListener("pointerup",end);
        }} />
        <aside className={`right-inspector ${isAndroid && mobilePanel === "properties" ? "mobile-open" : ""}`}>
          <header>
            <b>Свойства</b>
            <small>страница {pageIndex + 1}</small>
            {isAndroid && <button className="mobile-panel-close" aria-label="Закрыть" onClick={()=>setMobilePanel(null)}>×</button>}
          </header>
          <section className="properties-panel">
            <div className="inspector-title">{selectedImage ? "Изображение" : selectedKey ? "Текстовая строка" : "Страница"}</div>
            {!selectedImage && !selectedKey && <div className="global-text-properties">
              <p className="property-help">Настройки применяются ко всем обычным строкам.</p>
              <div className="format-buttons"><button className={settings.textBold?"active":""} onClick={()=>updateGlobalFormat("textBold","bold",!settings.textBold)} title="Жирный">B</button><button className={settings.textItalic?"active":""} onClick={()=>updateGlobalFormat("textItalic","italic",!settings.textItalic)} title="Курсив"><i>I</i></button><button className={settings.textUnderline?"active":""} onClick={()=>updateGlobalFormat("textUnderline","underline",!settings.textUnderline)} title="Подчёркивание"><u>U</u></button><button className={settings.textStrike?"active":""} onClick={()=>updateGlobalFormat("textStrike","strike",!settings.textStrike)} title="Зачёркивание"><s>S</s></button></div>
              <NumberField label="Высота текста" value={settings.fontMm} onChange={updateGlobalFontSize}/>
              <NumberField label="Толщина чернил" value={settings.inkThicknessMm} onChange={updateGlobalInkThickness}/>
              <label className="field"><span>Цвет текста</span><div className="color-row"><input type="color" value={settings.color} onChange={(e)=>update("color",e.target.value)}/><code>{settings.color}</code></div></label>
              <details open><summary>Заголовки</summary><NumberField label="Высота" value={settings.headingFontMm} onChange={(value)=>update("headingFontMm",value)}/><NumberField label="Жирность" value={settings.headingInkThicknessMm} onChange={(value)=>update("headingInkThicknessMm",value)}/><NumberField label="Ширина" value={settings.headingScaleX} suffix="%" step={1} onChange={(value)=>update("headingScaleX",Math.max(60,Math.min(180,value)))}/><label className="field"><span>Цвет</span><input type="color" value={settings.headingColor} onChange={(e)=>update("headingColor",e.target.value)}/></label></details>
            </div>}
            {selectedKey && selectedKey !== "all" && <div className="selected-line-properties"><p className="property-help">Изменения применятся только к выбранной строке.</p><div className="format-buttons">{([['bold','B'],['italic','I'],['underline','U'],['strike','S']] as const).map(([name,label])=><button key={name} className={lineStyles[selectedKey]?.[name]?"active":""} onClick={()=>setLineStyles((v)=>({...v,[selectedKey]:{...v[selectedKey],[name]:!v[selectedKey]?.[name]}}))}>{label}</button>)}</div><NumberField label="Высота" value={lineStyles[selectedKey]?.fontMm || settings.fontMm} onChange={(fontMm)=>setLineStyles((v)=>({...v,[selectedKey]:{...v[selectedKey],fontMm}}))}/><NumberField label="Толщина чернил" value={lineStyles[selectedKey]?.inkThicknessMm ?? settings.inkThicknessMm} step={.01} onChange={(inkThicknessMm)=>setLineStyles((v)=>({...v,[selectedKey]:{...v[selectedKey],inkThicknessMm:Math.max(0,inkThicknessMm)}}))}/><NumberField label="Интервал строки" value={lineStyles[selectedKey]?.lineMm ?? settings.lineMm} step={.1} onChange={(lineMm)=>setLineStyles((v)=>({...v,[selectedKey]:{...v[selectedKey],lineMm:Math.max(1,lineMm)}}))}/><NumberField label="Ширина" value={Math.round((lineStyles[selectedKey]?.scaleX??1)*100)} suffix="%" step={1} onChange={(value)=>setLineStyles((v)=>({...v,[selectedKey]:{...v[selectedKey],scaleX:Math.max(.4,Math.min(2.5,value/100))}}))}/><NumberField label="Наклон" value={lineStyles[selectedKey]?.slant ?? settings.slant} suffix="°" step={1} onChange={(slant)=>setLineStyles((v)=>({...v,[selectedKey]:{...v[selectedKey],slant}}))}/><label className="field"><span>Цвет строки</span><input type="color" value={lineStyles[selectedKey]?.color || settings.color} onChange={(e)=>setLineStyles((v)=>({...v,[selectedKey]:{...v[selectedKey],color:e.target.value}}))}/></label><button className="wide" onClick={()=>setLineStyles((v)=>{const next={...v};delete next[selectedKey];return next})}>Сбросить стиль строки</button></div>}
            {selectedImage && <div className="image-controls"><NumberField label="Ширина" value={images.find((i) => i.id === selectedImage)?.width || 40} onChange={(width) => setImages((v) => v.map((i) => i.id === selectedImage ? {...i, width} : i))}/><NumberField label="Высота" value={images.find((i) => i.id === selectedImage)?.height || 30} onChange={(height) => setImages((v) => v.map((i) => i.id === selectedImage ? {...i, height} : i))}/><button className="delete-object" onClick={() => {setImages((v) => v.filter((i) => i.id !== selectedImage));setSelectedImage(null)}}>Удалить объект</button></div>}
            <div className="paper-preset-panel"><b>{settings.language==="en"?"Paper background":"Фон листа"}</b><div>{paperPresets.map(([id,label])=><button key={id} onClick={()=>builtInPaper(id)}><i className={`paper-mini ${id}`}/><span>{label}</span></button>)}</div><label className="upload-bg"><input type="file" accept="image/*" onChange={(e)=>loadBackground(e.target.files?.[0])}/><span>＋ {settings.language==="en"?"My image":"Своя картинка"}</span></label></div>
          </section>
          {showLegacyPanels && <>
          <section>
            <div className="inspector-title">Слои</div>
            <button
              className={`layer-row ${layers.text ? "" : "off"}`}
              onClick={() => setLayers((v) => ({ ...v, text: !v.text }))}
            >
              <i>T</i>
              <span>
                <b>Текст</b>
                <small>{page.length} строк</small>
              </span>
              <em>{layers.text ? "◉" : "○"}</em>
            </button>
            <button
              className={`layer-row ${layers.drawing ? "" : "off"}`}
              onClick={() => setLayers((v) => ({ ...v, drawing: !v.drawing }))}
            >
              <i>✎</i>
              <span>
                <b>Рисунки</b>
                <small>
                  {strokes.filter((s) => s.page === pageIndex).length} штрихов
                </small>
              </span>
              <em>{layers.drawing ? "◉" : "○"}</em>
            </button>
            <button
              className={`layer-row ${layers.background ? "" : "off"}`}
              onClick={() =>
                setLayers((v) => ({ ...v, background: !v.background }))
              }
            >
              <i>▧</i>
              <span>
                <b>Фон</b>
                <small>
                  {settings.backgroundImage ? "изображение" : "цвет листа"}
                </small>
              </span>
              <em>{layers.background ? "◉" : "○"}</em>
            </button>
          </section>
          <section>
            <div className="inspector-title">Вставка</div>
            <label className="insert-image-button">
              <input
                type="file"
                accept="image/*"
                onChange={(e) => addImage(e.target.files?.[0])}
              />
              <b>+ Добавить изображение</b>
            </label>
            {images
              .filter((i) => i.page === pageIndex)
              .map((img) => (
                <button
                  key={img.id}
                  className={`image-row ${selectedImage === img.id ? "active" : ""}`}
                  onClick={() => setSelectedImage(img.id)}
                >
                  <img src={img.src} alt="" />
                  <span>Изображение</span>
                </button>
              ))}
            {selectedImage && (
              <div className="image-controls">
                <NumberField
                  label="Ширина"
                  value={
                    images.find((i) => i.id === selectedImage)?.width || 40
                  }
                  onChange={(n) =>
                    setImages((v) =>
                      v.map((i) =>
                        i.id === selectedImage ? { ...i, width: n } : i,
                      ),
                    )
                  }
                />
                <NumberField
                  label="Высота"
                  value={
                    images.find((i) => i.id === selectedImage)?.height || 30
                  }
                  onChange={(n) =>
                    setImages((v) =>
                      v.map((i) =>
                        i.id === selectedImage ? { ...i, height: n } : i,
                      ),
                    )
                  }
                />
                <button
                  className="delete-object"
                  onClick={() => {
                    setImages((v) => v.filter((i) => i.id !== selectedImage));
                    setSelectedImage(null);
                  }}
                >
                  Удалить
                </button>
              </div>
            )}
          </section>
          <section>
            <button
              className="wide"
              onClick={() => setGuides((g) => [...g, 74])}
            >
              + Направляющая
            </button>
            {guides.length > 0 && (
              <button
                className="wide delete-object"
                onClick={() => setGuides([])}
              >
                Убрать все направляющие
              </button>
            )}
            <button className="wide remove-bg" onClick={resetPage}>
              ↺ Сбросить страницу
            </button>
          </section>
          </>}
        </aside>
      </section>
      {isAndroid && <nav className="mobile-bottom-nav" aria-label="Разделы редактора">
        <button className={mobilePanel==="document"?"active":""} onClick={()=>{setTab("document");setMobilePanel("document")}}><i>▤</i><span>Конспект</span></button>
        <button className={mobilePanel==="design"?"active":""} onClick={()=>{setTab("design");setMobilePanel("design")}}><i>Aa</i><span>Оформление</span></button>
        <button className={mobilePanel==="page"?"active":""} onClick={()=>{setTab("page");setMobilePanel("page")}}><i>▯</i><span>Страница</span></button>
        <button className={mobilePanel==="properties"?"active":""} onClick={()=>setMobilePanel("properties")}><i>⚙</i><span>Свойства</span></button>
      </nav>}
      {isAndroid && mobilePanel && <button className="mobile-panel-backdrop" aria-label="Закрыть панель" onClick={()=>setMobilePanel(null)}/>} 
      {isAndroid && mobileMoreOpen && <div className="mobile-action-backdrop" onClick={()=>setMobileMoreOpen(false)}>
        <section className="mobile-action-sheet" onClick={(event)=>event.stopPropagation()}>
          <header><span/><b>Документ и печать</b><button aria-label="Закрыть" onClick={()=>setMobileMoreOpen(false)}>×</button></header>
          <div className="mobile-action-grid">
            <button onClick={()=>{undo();setMobileMoreOpen(false)}}><i>↶</i><span>Отменить</span></button>
            <button onClick={()=>{redo();setMobileMoreOpen(false)}}><i>↷</i><span>Повторить</span></button>
            <button onClick={()=>{setHomeOpen(true);setMobileMoreOpen(false)}}><i>＋</i><span>Новый</span></button>
            <button onClick={()=>{persistProject(true);setMobileMoreOpen(false)}}><i>✓</i><span>Сохранить</span></button>
          </div>
          <button className="mobile-action-row" onClick={()=>{exportPng(false);setMobileMoreOpen(false)}}><i>PNG</i><span><b>Экспорт текущей страницы</b><small>Изображение в полном разрешении</small></span></button>
          <button className="mobile-action-row" disabled={printing} onClick={()=>{androidPrint("system");setMobileMoreOpen(false)}}><i>⎙</i><span><b>Системная печать Android</b><small>Точный PDF выбранного формата</small></span></button>
          <button className="mobile-action-row primary" disabled={printing} onClick={()=>{androidPrint("epson");setMobileMoreOpen(false)}}><i>EP</i><span><b>Открыть через Epson</b><small>Epson iPrint или Smart Panel</small></span></button>
          <button className="mobile-action-row" onClick={()=>{androidChooseFile();setMobileMoreOpen(false)}}><i>↗</i><span><b>Открыть файл для печати</b><small>PDF, PNG или JPEG</small></span></button>
          <button className="mobile-action-row" onClick={()=>{setSettingsOpen(true);setMobileMoreOpen(false)}}><i>⚙</i><span><b>Настройки приложения</b><small>Темы, просмотр и документация</small></span></button>
        </section>
      </div>}
      {homeOpen && (
        <div className="home-backdrop">
          <section className="home-window">
            <main className="home-content">
              <header><div><h1>Добро пожаловать! <span>👋</span></h1><p>Создавайте рукописные конспекты легко и аккуратно</p></div><button className="home-close" onClick={()=>setHomeOpen(false)}>×</button></header>
              <button className="new-note-hero" onClick={newDocument}>＋ Создать новый конспект</button>
              <div className="home-grid"><section><h3>Быстрый старт</h3><button onClick={newDocument}><i>□</i><span><b>Пустой конспект</b><small>Новый чистый документ без рисунков и объектов</small></span></button><button onClick={()=>{makeFivePages();setStrokes([]);setImages([]);setElementOffsets({});setLineStyles({});setPageIndex(0);setHomeOpen(false)}}><i>✦</i><span><b>Конспект на 5 страниц</b><small>Готовая структура текста</small></span></button><label><input type="file" accept=".json,.polya.json" onChange={(e)=>{openProject(e.target.files?.[0]);setHomeOpen(false)}}/><i>↓</i><span><b>Открыть документ</b><small>Выбрать сохранённый проект</small></span></label></section><section><h3>Недавний документ</h3><button onClick={()=>setHomeOpen(false)}><i>▤</i><span><b>{documentTitle}</b><small>{pages.length} стр. · сохранён на устройстве</small></span></button><div className="recent-meta">{settings.paperFormat} · {size.widthMm} × {size.heightMm} мм</div></section></div>
              <section className="template-gallery format-gallery"><header><h3>Формат нового листа</h3><small>Выберите размер и ориентацию</small></header><div>{(["A4","A5","A6","Letter"] as PaperFormat[]).map((format)=><button key={format} className={settings.paperFormat===format?"active":""} onClick={()=>update("paperFormat",format)}><i/><b>{format}</b></button>)}</div><div className="orientation-choice"><button className={settings.orientation==="portrait"?"active":""} onClick={()=>update("orientation","portrait")}>▯ Вертикально</button><button className={settings.orientation==="landscape"?"active":""} onClick={()=>update("orientation","landscape")}>▭ Горизонтально</button></div></section>
              <footer><button onClick={()=>setHomeOpen(false)}>Открыть редактор →</button></footer>
            </main>
          </section>
        </div>
      )}
      {printDialogOpen && (
        <Modal title="Печать конспекта" onClose={()=>setPrintDialogOpen(false)}>
          <div className="print-dialog-layout"><section className="print-sheet-preview"><iframe title="Предпросмотр листа" srcDoc={printPreviewHtml}/><small>Предпросмотр точно соответствует отправляемому макету</small></section><section className="print-basic-options"><label className="field"><span>Принтер</span><select value={settings.printerName} onChange={(e)=>update("printerName",e.target.value)}>{printers.length===0&&<option value="">Принтеры не найдены</option>}{printers.map((printer)=><option key={printer.name} value={printer.name}>{printer.displayName||printer.name}{printer.isDefault?" · по умолчанию":""}</option>)}</select></label><label className="field"><span>Формат листа</span><select value={settings.paperFormat} onChange={(e)=>update("paperFormat",e.target.value as PaperFormat)}><option value="A5">A5 · 148 × 210 мм</option><option value="A4">A4 · 210 × 297 мм</option><option value="Letter">Letter</option></select></label><label className="field"><span>Какие страницы печатать</span><select value={printPageSelection} onChange={(e)=>setPrintPageSelection(e.target.value as "all"|"current"|"custom")}><option value="all">Все страницы ({pages.length})</option><option value="current">Только текущую ({pageIndex+1})</option><option value="custom">Указать страницы</option></select></label>{printPageSelection==="custom"&&<label className="field print-pages-field"><span>Номера страниц</span><input value={printCustomPages} onChange={(e)=>setPrintCustomPages(e.target.value)} placeholder="Например: 1, 3-5"/><small>Можно указать отдельные страницы и диапазоны.</small></label>}<NumberField label="Количество копий" value={settings.printCopies} suffix="" step={1} onChange={(value)=>update("printCopies",Math.max(1,Math.round(value)))}/><label className="switch-row"><span><b>Двусторонняя печать</b><small>Переворот по длинной стороне</small></span><input type="checkbox" checked={settings.printDuplex!=="simplex"} onChange={(e)=>update("printDuplex",e.target.checked?"longEdge":"simplex")}/></label><label className="switch-row"><span><b>Цветная печать</b><small>Отключите для чёрно-белой</small></span><input type="checkbox" checked={settings.printColor} onChange={(e)=>update("printColor",e.target.checked)}/></label><button className="primary print-now" disabled={!settings.printerName||printing||selectedPrintPages().length===0} onClick={()=>{setPrintDialogOpen(false);printDocument()}}>▣ {printing?"Отправляем…":`Напечатать ${selectedPrintPages().length} стр.`}</button></section></div>
        </Modal>
      )}
      {printPreview && (
        <Modal
          title="Предпросмотр печати"
          onClose={() => setPrintPreview(false)}
        >
          <div className="print-preview-summary">
            <b>{settings.printerName}</b>
            <span>
              {settings.paperFormat} · поля: слева {layoutSettings.marginLeft}{" "}
              мм, справа {layoutSettings.marginRight} мм · {pages.length} стр.
            </span>
          </div>
          <iframe
            className="print-preview-frame"
            title="Печатный макет"
            srcDoc={printPreviewHtml}
          />
          <div className="modal-actions">
            <button onClick={() => setPrintPreview(false)}>Назад</button>
            <button
              className="primary"
              onClick={() => {
                setPrintPreview(false);
                printDocument();
              }}
            >
              ⎙ Напечатать этот макет
            </button>
          </div>
        </Modal>
      )}
      {sourceOpen && (
        <Modal title="Исходный текст" onClose={() => setSourceOpen(false)}>
          <textarea
            className="source-editor"
            value={text}
            onChange={(e) => setText(e.target.value)}
            autoFocus
          />
          <div className="modal-actions">
            <span>{pages.length} страниц A5</span>
            <button className="primary" onClick={() => setSourceOpen(false)}>
              Готово
            </button>
          </div>
        </Modal>
      )}
      {fileOpen && (
        <Modal title="Файл проекта" onClose={() => setFileOpen(false)}>
          <div className="file-menu">
            <button onClick={newProject}>
              <i>✧</i>
              <span>
                <b>Новый проект</b>
                <small>Чистый лист A5</small>
              </span>
            </button>
            <label>
              <input
                type="file"
                accept=".json,.polya.json"
                onChange={(e) => openProject(e.target.files?.[0])}
              />
              <i>↓</i>
              <span>
                <b>Открыть</b>
                <small>Загрузить файл проекта</small>
              </span>
            </label>
            <button onClick={saveProject}>
              <i>↑</i>
              <span>
                <b>Сохранить как…</b>
                <small>Текст, рисунки, тема и все настройки</small>
              </span>
            </button>
          </div>
        </Modal>
      )}
      {exportOpen && (
        <Modal title="Экспорт конспекта" onClose={() => setExportOpen(false)}>
          <div className="export-summary">
            <div>
              <small>Формат</small>
              <b>
                A5 · {size.widthMm} × {size.heightMm} мм
              </b>
            </div>
            <div>
              <small>Страниц</small>
              <b>{pages.length}</b>
            </div>
            <div>
              <small>Калибровка</small>
              <b>
                {settings.printerName} · X {settings.offsetX >= 0 ? "+" : ""}
                {settings.offsetX} / Y {settings.offsetY >= 0 ? "+" : ""}
                {settings.offsetY} мм
              </b>
            </div>
          </div>
          <button className="export-card" onClick={() => exportPdf()}>
            <i>PDF</i>
            <span>
              <b>Печатный PDF</b>
              <small>Векторный A5, точный MediaBox</small>
            </span>
            <em>→</em>
          </button>
          <div className="dpi-row">
            <span>PNG</span>
            {[150, 300, 600].map((d) => (
              <button
                key={d}
                className={settings.dpi === d ? "active" : ""}
                onClick={() => update("dpi", d as 150 | 300 | 600)}
              >
                {d} DPI
              </button>
            ))}
          </div>
          <button className="export-card" onClick={() => exportPng(false)}>
            <i>PNG</i>
            <span>
              <b>Текущая страница</b>
              <small>
                С выбранным фоном ·{" "}
                {Math.round(mmToPx(size.widthMm, settings.dpi))}×
                {Math.round(mmToPx(size.heightMm, settings.dpi))} px
              </small>
            </span>
            <em>→</em>
          </button>
          <button className="export-card transparent-export" onClick={()=>exportPng(false,true)}><i>α</i><span><b>PNG без фона</b><small>Настоящая прозрачность · без сетки и серых клеток</small></span><em>→</em></button>
          <button className="export-card" onClick={() => exportPng(true)}>
            <i>ZIP</i>
            <span>
              <b>Все страницы PNG</b>
              <small>Один PNG с выбранным фоном на страницу</small>
            </span>
            <em>→</em>
          </button>
        </Modal>
      )}
      {settingsOpen && (
        <Modal title="Настройки приложения" onClose={() => setSettingsOpen(false)}>
          <div className="settings-shell"><nav><button className={settingsTab==="general"?"active":""} onClick={()=>setSettingsTab("general")}>⚙ <span>Основные</span></button><button className={settingsTab==="themes"?"active":""} onClick={()=>setSettingsTab("themes")}>◐ <span>Темы</span></button><button className={settingsTab==="pages"?"active":""} onClick={()=>setSettingsTab("pages")}>▤ <span>Просмотр</span></button><button className={settingsTab==="docs"?"active":""} onClick={()=>setSettingsTab("docs")}>? <span>Документация</span></button></nav><div className="settings-page">
            {settingsTab==="general"&&<><h2>{settings.language==="en"?"General":"Основные"}</h2><label className="switch-row"><span><b>{settings.language==="en"?"Document autosave":"Автосохранение документов"}</b><small>{settings.language==="en"?"Changes are saved automatically":"Все изменения сохраняются автоматически"}</small></span><input type="checkbox" defaultChecked/></label><label className="switch-row"><span><b>{settings.language==="en"?"Remember panel layout":"Запоминать расположение окон"}</b><small>{settings.language==="en"?"Panel widths are restored at startup":"Ширина панелей восстановится при запуске"}</small></span><input type="checkbox" defaultChecked/></label><label className="field"><span>{settings.language==="en"?"Interface language":"Язык интерфейса"}</span><select value={settings.language} onChange={(e)=>update("language",e.target.value as "ru"|"en")}><option value="ru">Русский</option><option value="en">English</option></select></label></>}
            {settingsTab==="themes"&&<><h2>Цельные темы</h2><p>Каждый набор одновременно меняет интерфейс, рабочее пространство, линейку и иконку.</p><div className="theme-set-grid">{([{id:"classic",name:"Молочная",desk:"sand",ruler:"classic",icon:"coral"},{id:"kawaii",name:"Сакура",desk:"rose",ruler:"pink",icon:"kawaii"},{id:"mint",name:"Матча",desk:"sage",ruler:"mint",icon:"mint"},{id:"dark",name:"Графит",desk:"graphite",ruler:"dark",icon:"moon"},{id:"coffee",name:"Кофейная",desk:"sand",ruler:"classic",icon:"coral"},{id:"ocean",name:"Океан",desk:"ocean",ruler:"blue",icon:"mint"},{id:"lavender",name:"Лаванда",desk:"lavender",ruler:"purple",icon:"kawaii"},{id:"candy",name:"Зефир",desk:"peach",ruler:"pink",icon:"kawaii"},{id:"forest",name:"Лесная",desk:"sage",ruler:"mint",icon:"mint"},{id:"sunset",name:"Закат",desk:"peach",ruler:"pink",icon:"coral"},{id:"halloween",name:"Хэллоуин",desk:"midnight",ruler:"dark",icon:"moon"},{id:"neon",name:"Неон",desk:"aurora",ruler:"purple",icon:"moon"}] as const).map((theme)=><button key={theme.id} className={`theme-set theme-${theme.id} ${settings.uiTheme===theme.id?"active":""}`} onClick={()=>setSettings((current)=>({...current,uiTheme:theme.id,deskTheme:theme.desk,rulerColor:theme.ruler,appIcon:theme.icon}))}><img src={`./icons/app-icon-${theme.icon}.png`} alt=""/><span><b>{theme.name}</b><small>Интерфейс · стол · линейка</small></span></button>)}</div><h3>Точная настройка</h3><div className="settings-steppers"><label onWheel={(event)=>{event.preventDefault();const values:Settings["deskTheme"][]=["sage","graphite","sand","rose","lavender","ocean","peach","midnight","aurora"];const index=values.indexOf(settings.deskTheme);update("deskTheme",values[(index+(event.deltaY>0?1:-1)+values.length)%values.length])}}><span>Рабочее пространство</span><button onClick={()=>{const values:Settings["deskTheme"][]=["sage","graphite","sand","rose","lavender","ocean","peach","midnight","aurora"];update("deskTheme",values[(values.indexOf(settings.deskTheme)-1+values.length)%values.length])}}>‹</button><b>{settings.deskTheme}</b><button onClick={()=>{const values:Settings["deskTheme"][]=["sage","graphite","sand","rose","lavender","ocean","peach","midnight","aurora"];update("deskTheme",values[(values.indexOf(settings.deskTheme)+1)%values.length])}}>›</button></label><label onWheel={(event)=>{event.preventDefault();const values:Settings["rulerColor"][]=["classic","pink","blue","mint","purple","dark"];const index=values.indexOf(settings.rulerColor);update("rulerColor",values[(index+(event.deltaY>0?1:-1)+values.length)%values.length])}}><span>Цвет линейки</span><button onClick={()=>{const values:Settings["rulerColor"][]=["classic","pink","blue","mint","purple","dark"];update("rulerColor",values[(values.indexOf(settings.rulerColor)-1+values.length)%values.length])}}>‹</button><b>{settings.rulerColor}</b><button onClick={()=>{const values:Settings["rulerColor"][]=["classic","pink","blue","mint","purple","dark"];update("rulerColor",values[(values.indexOf(settings.rulerColor)+1)%values.length])}}>›</button></label></div></>}
            {settingsTab==="themes"&&<div className="extra-theme-grid">{([{id:"light",name:"Чистая светлая",desk:"sand",ruler:"classic",icon:"mint"},{id:"night",name:"Ночная синяя",desk:"midnight",ruler:"blue",icon:"moon"},{id:"berry",name:"Ягодная",desk:"rose",ruler:"pink",icon:"kawaii"},{id:"arctic",name:"Арктика",desk:"ocean",ruler:"blue",icon:"mint"}] as const).map((theme)=><button key={theme.id} className={`theme-set theme-${theme.id} ${settings.uiTheme===theme.id?"active":""}`} onClick={()=>setSettings((current)=>({...current,uiTheme:theme.id,deskTheme:theme.desk,rulerColor:theme.ruler,appIcon:theme.icon}))}><span className="theme-art"/><b>{theme.name}</b></button>)}</div>}
            {settingsTab==="themes"&&<div className="theme-paper-picker"><h3>{settings.language==="en"?"Paper background":"Фон листа"}</h3><div className="built-in-paper-row">{paperPresets.map(([id,label])=><button key={id} onClick={()=>builtInPaper(id)}>{label}</button>)}</div><label className="upload-bg"><input type="file" accept="image/*" onChange={(e)=>loadBackground(e.target.files?.[0])}/><span>▧ {settings.language==="en"?"Choose image":"Выбрать картинку"}</span></label>{settings.backgroundImage&&<button type="button" onClick={()=>builtInPaper("clean")}>{settings.language==="en"?"Remove":"Убрать фон"}</button>}<label><span>{settings.language==="en"?"Opacity":"Прозрачность"}</span><input type="range" min="0.05" max="1" step="0.05" value={settings.backgroundOpacity} onChange={(e)=>update("backgroundOpacity",Number(e.target.value))}/></label></div>}
            {settingsTab==="pages"&&<><h2>Просмотр страниц</h2><div className="view-mode-cards"><button className={pageFlow==="single"?"active":""} onClick={()=>setPageFlow("single")}><i>▯</i><b>По одной</b><small>Переключение стрелками</small></button><button className={pageFlow==="continuous"?"active":""} onClick={()=>setPageFlow("continuous")}><i>▯<br/>▯</i><b>Вертикальная лента</b><small>Все листы идут сверху вниз</small></button></div></>}
            {settingsTab==="docs"&&<div className="documentation-page"><h2>Документация и клавиши</h2><p>Короткая памятка по управлению редактором.</p><h3>Горячие клавиши</h3><div className="shortcut-grid">{[["Ctrl + S","Сохранить сейчас"],["Ctrl + Z","Отменить действие"],["Ctrl + Y","Повторить действие"],["Ctrl + Shift + Z","Повторить действие"],["Ctrl + A","Выбрать все строки текущего листа"],["Ctrl + +","Увеличить масштаб"],["Ctrl + −","Уменьшить масштаб"],["Пробел + мышь","Свободно перемещаться по рабочему столу"],["Двойной клик","Редактировать выбранную строку"]].map(([keys,action])=><div key={keys}><kbd>{keys}</kbd><span>{action}</span></div>)}</div><h3>Как работать</h3><ol><li>Вставьте исходный текст во вкладке «Конспект».</li><li>Нажмите «Сохранить и показать конспект».</li><li>Настройте почерк во вкладке «Оформление», а поля — во вкладке «Страница».</li><li>Один клик выбирает строку, двойной — включает редактирование.</li><li>Перед печатью обязательно проверьте лист в окне предпросмотра.</li></ol><h3>Инструменты</h3><p>Карандаш рисует свободно, маркер поддерживает свободный и ровный режим, ластик стирает только проведённый участок. В вертикальной ленте каждый штрих хранится на своём листе.</p><p className="docs-note">Полное руководство для изменения программы находится рядом с исходниками в файле README-ДЛЯ-НОВИЧКА.md.</p></div>}
          </div></div>
          <div className="modal-actions"><span>Настройки применяются сразу</span><button className="primary" onClick={() => setSettingsOpen(false)}>Готово</button></div>
        </Modal>
      )}
      {toast && <div className="toast"><span>✓ {toast}</span><i /></div>}
    </main>
  );
}

function Modal({
  title,
  onClose,
  children,
}: {
  title: string;
  onClose: () => void;
  children: React.ReactNode;
}) {
  return (
    <div
      className="modal-backdrop"
      onMouseDown={(e) => e.target === e.currentTarget && onClose()}
    >
      <div className="modal">
        <header>
          <h2>{title}</h2>
          <button onClick={onClose}>×</button>
        </header>
        {children}
      </div>
    </div>
  );
}
function Ruler({
  width,
  scale,
  horizontal = false,
}: {
  width: number;
  scale: number;
  horizontal?: boolean;
}) {
  const marks = [];
  for (let i = 0; i <= width; i++)
    marks.push(
      <i
        key={i}
        className={i % 10 === 0 ? "major" : i % 5 === 0 ? "medium" : ""}
        style={horizontal ? { left: i * scale } : { top: i * scale }}
      >
        {i % 10 === 0 ? <span>{i / 10}</span> : null}
      </i>,
    );
  return <div className={horizontal ? "ruler top" : "ruler side"}>{marks}</div>;
}
function hexRgb(hex: string) {
  const n = parseInt(hex.slice(1), 16);
  return rgb(((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255);
}
function download(data: Uint8Array | Blob, name: string, type: string) {
  const blob =
    data instanceof Blob ? data : new Blob([data as BlobPart], { type });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
}
