/*
 * End-to-end smoke audit for the editor. It is intentionally dependency-free:
 * set POLYA_PLAYWRIGHT to a local Playwright package before running it.
 */
// CommonJS keeps this optional audit runnable without adding Playwright to the app bundle.
// eslint-disable-next-line @typescript-eslint/no-require-imports
const assert = require("node:assert/strict");
// eslint-disable-next-line @typescript-eslint/no-require-imports
const { chromium } = require(process.env.POLYA_PLAYWRIGHT);

(async () => {
  const browser = await chromium.launch({
    headless: true,
    executablePath: process.env.POLYA_CHROME,
  });
  const page = await browser.newPage({ viewport: { width: 1600, height: 1000 } });
  const errors = [];
  const failedResources = [];
  page.on("pageerror", (error) => errors.push(String(error)));
  page.on("console", (message) => message.type() === "error" && errors.push(message.text()));
  page.on("response", (response) => response.status() >= 400 && failedResources.push(`${response.status()} ${response.url()}`));
  await page.addInitScript(() => localStorage.clear());
  await page.goto(process.env.POLYA_URL || "http://127.0.0.1:5173/?editor", {
    waitUntil: "domcontentloaded",
    timeout: 15000,
  });
  await page.locator(".app-shell").waitFor({ timeout: 10000 });

  if (await page.locator(".home-close").isVisible().catch(() => false)) {
    await page.locator(".home-close").click();
  }

  // Primary editor islands must not overlap each other.
  const left = await page.locator(".left-panel").boundingBox();
  const center = await page.locator(".canvas-area").boundingBox();
  const right = await page.locator(".right-inspector").boundingBox();
  assert(left && center && right, "Editor panels are missing");
  assert(left.x + left.width <= center.x + 2, "Left panel overlaps the canvas");
  assert(center.x + center.width <= right.x + 2, "Canvas overlaps the right panel");

  // All three left tabs open and keep their content inside the panel.
  for (const label of ["Конспект", "Оформление", "Страница"]) {
    await page.locator(".tabs button", { hasText: label }).click();
    assert(await page.locator(".left-panel").isVisible(), `${label} tab broke the panel`);
  }

  // File menu and every settings page.
  await page.getByRole("button", { name: "Файл", exact: true }).click();
  await page.locator(".file-dropdown button", { hasText: "Настройки" }).click();
  for (const label of ["Основные", "Темы", "Просмотр", "Документация"]) {
    await page.locator(".settings-shell nav button", { hasText: label }).click();
    assert(await page.locator(".settings-page").isVisible(), `${label} settings page is hidden`);
    if (label === "Основные") {
      assert.equal(await page.getByText("Виртуальный питомец", { exact: true }).count(), 0, "Virtual pet setting still exists");
    }
    if (label === "Темы") {
      const cards = await page.locator(".theme-set").evaluateAll((nodes) => nodes.map((node) => {
        const box = node.getBoundingClientRect();
        return { width: Math.round(box.width), height: Math.round(box.height) };
      }));
      assert(cards.length >= 4, "Theme choices are missing");
      assert(new Set(cards.map((card) => card.height)).size === 1, "Theme cards have unequal heights");
    }
  }
  assert.equal(await page.locator(".shortcut-grid kbd").count(), 9, "Shortcut documentation is incomplete");
  await page.locator(".modal>header button").click();

  // Tool popovers must remain reachable and each tool activates.
  for (const title of ["Карандаш", "Маркер", "Точечный ластик"]) {
    await page.locator(`[title="${title}"]`).click();
    assert(await page.locator(".tool-menu.open .tool-popover").isVisible(), `${title} options did not open`);
  }

  // Pencil, marker and point eraser use the top SVG layer of the active page.
  const drawing = page.locator(".paper svg.drawing-layer");
  await page.locator('[title="Карандаш"]').click();
  let box = await drawing.boundingBox();
  await page.mouse.move(box.x + 80, box.y + 100);
  await page.mouse.down();
  await page.mouse.move(box.x + 230, box.y + 130, { steps: 10 });
  await page.mouse.up();
  assert((await drawing.locator("path").count()) >= 1, "Pencil did not create a stroke");
  await page.locator('[title="Маркер"]').click();
  box = await drawing.boundingBox();
  await page.mouse.move(box.x + 90, box.y + 155);
  await page.mouse.down();
  await page.mouse.move(box.x + 240, box.y + 155, { steps: 10 });
  await page.mouse.up();
  const pathsBeforeErase = await drawing.locator("path").count();
  assert(pathsBeforeErase >= 2, "Marker did not create a stroke");
  await page.locator('[title="Точечный ластик"]').click();
  box = await drawing.boundingBox();
  await page.mouse.move(box.x + 160, box.y + 155);
  await page.mouse.down();
  await page.mouse.move(box.x + 180, box.y + 155, { steps: 5 });
  await page.mouse.up();
  const pathsAfterErase = await drawing.locator("path").count();
  assert(pathsAfterErase !== pathsBeforeErase, "Eraser did not split the marker stroke");
  await page.locator('[title="Отменить"]').click();
  assert.equal(await drawing.locator("path").count(), pathsBeforeErase, "Undo did not restore the complete drawing state");
  await page.locator('[title="Повторить последнее действие"]').click();
  assert.equal(await drawing.locator("path").count(), pathsAfterErase, "Redo did not restore the erased drawing state");

  // Every rendered text line must remain inside the effective margin box.
  const boundaryViolations = await page.evaluate(() => {
    const bounds = document.querySelector(".margins")?.getBoundingClientRect();
    if (!bounds) return ["margin box missing"];
    return [...document.querySelectorAll(".paper-line")].flatMap((line, index) => {
      const rect = line.getBoundingClientRect();
      return rect.left < bounds.left - 3 || rect.right > bounds.right + 3 || rect.top < bounds.top - 3 || rect.bottom > bounds.bottom + 3 ? [`line ${index}`] : [];
    });
  });
  assert.equal(boundaryViolations.length, 0, `Text crossed margins: ${boundaryViolations.join(", ")}`);

  // A global text change must be embedded in the newly generated print job.
  const globalFontInput = page.getByText("Высота текста", { exact: true }).locator("..").locator('input[type="number"]');
  await globalFontInput.fill("5.2");
  await globalFontInput.blur();
  if (!(await page.locator('.global-text-properties button[title="Жирный"]').getAttribute("class") || "").includes("active")) {
    await page.locator('.global-text-properties button[title="Жирный"]').click();
  }

  // Keyboard selection and zoom shortcuts.
  await page.keyboard.press("Control+A");
  assert((await page.locator(".paper-line.selected").count()) > 0, "Ctrl+A did not select page lines");
  const zoomBefore = await page.locator(".zoom b").innerText();
  await page.keyboard.press("Control++");
  const zoomAfter = await page.locator(".zoom b").innerText();
  assert.notEqual(zoomBefore, zoomAfter, "Ctrl++ did not change zoom");
  await page.keyboard.press("Control+-");

  // Print dialog renders both the preview and printer settings.
  await page.locator(".print-button").click();
  assert(await page.locator(".print-sheet-preview iframe").isVisible(), "Print preview is missing");
  assert(await page.locator(".print-basic-options").isVisible(), "Print settings are missing");
  const printFrame = page.frameLocator('.print-sheet-preview iframe');
  await printFrame.locator("body").waitFor();
  assert.equal(await printFrame.locator("body").getAttribute("data-print-font"), "5.2", "Print preview reused stale text size");
  assert.equal(await printFrame.locator("body").getAttribute("data-print-bold"), "true", "Print preview reused stale bold setting");
  await page.getByText("Какие страницы печатать", { exact: true }).locator("..").locator("select").selectOption("custom");
  await page.locator(".print-pages-field input").fill("1");
  assert((await page.locator(".print-now").innerText()).includes("1 стр."), "Custom print page selection is not applied");
  await page.locator(".modal>header button").click();

  // File menu remains reachable, then closes after the pointer leaves it.
  await page.getByRole("button", { name: "Файл", exact: true }).click();
  assert(await page.locator(".file-popover").isVisible(), "File menu did not open");
  await page.mouse.move(900, 500);
  await page.waitForTimeout(1400);
  assert(!(await page.locator(".file-popover").isVisible().catch(() => false)), "File menu did not close after mouse leave");

  // Autosave should persist the strokes created above.
  await page.keyboard.press("Control+S");
  await page.waitForTimeout(150);
  const savedStrokeCount = await page.evaluate(() => {
    return (JSON.parse(localStorage.getItem("a5-note-project") || "{}").strokes || []).length;
  });
  assert(savedStrokeCount > 0, "Autosave did not persist drawing strokes");

  // Desktop layouts at common smaller resolutions must stay inside the window.
  for (const viewport of [{ width: 1366, height: 768 }, { width: 1280, height: 720 }]) {
    await page.setViewportSize(viewport);
    await page.waitForTimeout(120);
    const overflow = await page.evaluate(() => ({
      horizontal: document.documentElement.scrollWidth - window.innerWidth,
      vertical: document.documentElement.scrollHeight - window.innerHeight,
    }));
    assert(overflow.horizontal <= 2, `Horizontal overflow at ${viewport.width}px`);
    assert(overflow.vertical <= 2, `Vertical overflow at ${viewport.height}px`);
  }

  // Vertical flow must use the same live text settings and drawing layer.
  const continuousUrl = `${(process.env.POLYA_URL || "http://127.0.0.1:5173/?editor").split("?")[0]}?editor&continuous`;
  await page.goto(continuousUrl, { waitUntil: "domcontentloaded" });
  await page.locator(".continuous-sheet").first().waitFor();
  const continuousLine = page.locator(".continuous-line.body").first();
  const continuousBefore = Number.parseFloat(await continuousLine.evaluate((node) => getComputedStyle(node).fontSize));
  const continuousFontInput = page.getByText("Высота текста", { exact: true }).locator("..").locator('input[type="number"]');
  await continuousFontInput.fill("7");
  await continuousFontInput.blur();
  const continuousAfter = Number.parseFloat(await continuousLine.evaluate((node) => getComputedStyle(node).fontSize));
  assert(continuousAfter > continuousBefore * 1.2, "Vertical flow ignored the global text size");
  const continuousDrawing = page.locator(".continuous-sheet svg.drawing-layer").first();
  const continuousPathsBefore = await continuousDrawing.locator("path").count();
  await page.locator('[title="Карандаш"]').click();
  const continuousBox = await continuousDrawing.boundingBox();
  assert(continuousBox, "Vertical drawing layer is missing");
  await page.mouse.move(continuousBox.x + 45, continuousBox.y + 45);
  await page.mouse.down();
  await page.mouse.move(continuousBox.x + 100, continuousBox.y + 80, { steps: 8 });
  await page.mouse.up();
  assert((await continuousDrawing.locator("path").count()) > continuousPathsBefore, "Pencil failed in vertical flow");

  assert.equal(failedResources.length, 0, `Failed resources: ${failedResources.join(" | ")}`);
  assert.equal(errors.filter((item)=>!item.includes("Failed to load resource")).length, 0, `Runtime errors: ${errors.join(" | ")}`);
  console.log(JSON.stringify({ status: "PASS", tabs: 3, settingsPages: 4, shortcuts: 9, runtimeErrors: 0, failedResources: 0 }));
  await browser.close();
})().catch((error) => {
  console.error(error);
  process.exit(1);
});
