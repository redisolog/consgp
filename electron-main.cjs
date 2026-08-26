/* eslint-disable @typescript-eslint/no-require-imports */
const { app, BrowserWindow, ipcMain, nativeImage } = require("electron");
const path = require("path");
const fs = require("fs");
const { pathToFileURL } = require("url");
const { execFileSync } = require("child_process");

function createWindow() {
  const win = new BrowserWindow({
    width: 1440,
    height: 920,
    minWidth: 1040,
    minHeight: 680,
    title: "Поля — A5 конспекты",
    icon: path.join(__dirname, "desktop-dist", "icons", "app-icon-coral.png"),
    backgroundColor: "#e7e9e5",
    titleBarStyle: "hidden",
    titleBarOverlay: {
      color: "#00000000",
      symbolColor: "#51464f",
      height: 32,
    },
    autoHideMenuBar: true,
    webPreferences: {
      contextIsolation: true,
      sandbox: true,
      preload: path.join(__dirname, "electron-preload.cjs"),
    },
  });
  win.loadFile(path.join(__dirname, "desktop-dist", "index.html"));
}

ipcMain.handle("printers:list", async (event) => {
  return event.sender.getPrintersAsync();
});

ipcMain.handle("app:set-icon", async (event, dataUrl) => {
  const win = BrowserWindow.fromWebContents(event.sender);
  const icon = nativeImage.createFromDataURL(dataUrl);
  if (win && !icon.isEmpty()) win.setIcon(icon);
  return !icon.isEmpty();
});

ipcMain.handle("app:set-theme-chrome", async (event, colors) => {
  const win = BrowserWindow.fromWebContents(event.sender);
  if (!win || !colors) return false;
  win.setTitleBarOverlay({
    color: String(colors.color || "#00000000"),
    symbolColor: String(colors.symbolColor || "#51464f"),
    height: 32,
  });
  return true;
});

ipcMain.handle("document:print", async (_event, payload) => {
  const printer = String(payload.deviceName).replace(/'/g, "''");
  const paper = ["A4", "A5", "A6", "Letter"].includes(payload.paperFormat)
    ? payload.paperFormat
    : "A5";
  try {
    execFileSync(
      "powershell.exe",
      [
        "-NoProfile",
        "-NonInteractive",
        "-Command",
        `Set-PrintConfiguration -PrinterName '${printer}' -PaperSize ${paper} -ErrorAction Stop; $actual=(Get-PrintConfiguration -PrinterName '${printer}').PaperSize; if ([string]$actual -ne '${paper}') { throw "Драйвер оставил формат $actual" }`,
      ],
      { windowsHide: true, encoding: "utf8" },
    );
  } catch (error) {
    return {
      success: false,
      failureReason: `Не удалось установить формат ${paper} в драйвере: ${error.message}`,
    };
  }
  const logPath = path.join(app.getPath("userData"), "print-debug.log");
  fs.appendFileSync(
    logPath,
    `${new Date().toISOString()} printer=${payload.deviceName} paper=${paper} pages=${payload.selectedPages || "all"} physical=${payload.widthMm}x${payload.heightMm}mm raster=${payload.canvasWidthPx}x${payload.canvasHeightPx}px@${payload.dpi}dpi content=${payload.contentWidthMm}x${payload.contentHeightMm}mm orientation=${payload.landscape ? "landscape" : "portrait"} margins=${payload.marginLeft},${payload.marginTop},${payload.marginRight},${payload.marginBottom} scaleX=${payload.textScaleX} textScale=${payload.printTextScale}\n`,
    "utf8",
  );
  const jobId = `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
  const tempPath = path.join(app.getPath("temp"), `polya-a5-print-${jobId}.html`);
  fs.writeFileSync(tempPath, payload.html, "utf8");
  const printWindow = new BrowserWindow({
    show: false,
    title: `Поля — печать ${jobId}`,
    webPreferences: { sandbox: true, contextIsolation: true },
  });
  await printWindow.webContents.session.clearCache();
  await printWindow.loadURL(`${pathToFileURL(tempPath).href}?printJob=${jobId}`);
  printWindow.setDocumentEdited(false);
  await printWindow.webContents.executeJavaScript(`Promise.all([
    document.fonts ? document.fonts.ready : Promise.resolve(),
    ...Array.from(document.images).map(img => img.complete ? Promise.resolve() : new Promise(resolve => { img.onload=resolve; img.onerror=resolve; }))
  ]).then(() => true)`);
  await new Promise((resolve) => setTimeout(resolve, 250));
  const result = await new Promise((resolve) => {
    printWindow.webContents.print(
      {
        silent: true,
        deviceName: payload.deviceName,
        printBackground: true,
        color: payload.color,
        copies: payload.copies,
        landscape: payload.landscape,
        duplexMode: payload.duplexMode,
        margins: { marginType: "none" },
        pageSize: paper,
      },
      (success, failureReason) => resolve({ success, failureReason }),
    );
  });
  printWindow.destroy();
  try { fs.unlinkSync(tempPath); } catch { /* temporary file cleanup is best-effort */ }
  return result;
});

app.whenReady().then(createWindow);
app.on("activate", () => {
  if (BrowserWindow.getAllWindows().length === 0) createWindow();
});
app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit();
});
