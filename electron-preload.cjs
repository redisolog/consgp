/* eslint-disable @typescript-eslint/no-require-imports */
const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("desktopPrint", {
  getPrinters: () => ipcRenderer.invoke("printers:list"),
  setIcon: (dataUrl) => ipcRenderer.invoke("app:set-icon", dataUrl),
  setThemeChrome: (colors) => ipcRenderer.invoke("app:set-theme-chrome", colors),
  print: (payload) => ipcRenderer.invoke("document:print", payload),
});
