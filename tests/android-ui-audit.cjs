// eslint-disable-next-line @typescript-eslint/no-require-imports
const assert = require("node:assert/strict");
// eslint-disable-next-line @typescript-eslint/no-require-imports
const { chromium } = require(process.env.POLYA_PLAYWRIGHT);

(async () => {
  const browser = await chromium.launch({ headless: true, executablePath: process.env.POLYA_CHROME });
  const page = await browser.newPage({ viewport: { width: 412, height: 915 }, isMobile: true, hasTouch: true });
  const errors = [];
  page.on("pageerror", (error) => errors.push(String(error)));
  await page.addInitScript(() => localStorage.clear());
  const base = (process.env.POLYA_URL || "http://127.0.0.1:5173/").split("?")[0];
  await page.goto(`${base}?editor&android-preview`, { waitUntil: "domcontentloaded", timeout: 15000 });
  await page.locator(".app-shell.platform-android").waitFor();

  assert(await page.locator(".canvas-area").isVisible(), "Document editor is hidden");
  assert(await page.locator(".mobile-bottom-nav").isVisible(), "Bottom navigation is missing");
  assert.equal(await page.locator(".mobile-bottom-nav button").count(), 4, "Bottom navigation must contain four sections");
  assert(!(await page.locator(".left-panel").isVisible()), "Desktop sidebar is visible over the document");
  assert(!(await page.locator(".right-inspector").isVisible()), "Desktop inspector is visible over the document");

  await page.locator(".mobile-bottom-nav button").filter({ hasText: "Оформление" }).click();
  assert(await page.locator(".left-panel.mobile-open").isVisible(), "Appearance screen did not open");
  assert((await page.locator(".style-cards button").count()) >= 9, "Handwriting choices are incomplete");
  await page.locator(".mobile-sheet-header button").click();

  await page.locator(".mobile-bottom-nav button").filter({ hasText: "Свойства" }).click();
  assert(await page.locator(".right-inspector.mobile-open").isVisible(), "Properties screen did not open");
  const fontInput = page.getByText("Высота текста", { exact: true }).locator("..").locator('input[type="number"]');
  await fontInput.fill("6");
  await fontInput.blur();
  await page.locator(".mobile-panel-close").click();
  assert(Number.parseFloat(await page.locator(".paper-line.body").first().evaluate((node) => getComputedStyle(node).fontSize)) > 12, "Mobile text size did not update");

  await page.locator(".mobile-overflow").click();
  assert(await page.locator(".mobile-action-sheet").isVisible(), "Document action sheet did not open");
  for (const action of ["Сохранить", "Системная печать Android", "Открыть через Epson", "Настройки приложения"]) {
    assert((await page.locator(".mobile-action-sheet").getByText(action, { exact: true }).count()) > 0, `${action} is missing`);
  }
  await page.locator(".mobile-action-sheet>header button").click();

  await page.locator('[title="Карандаш"]').click();
  const drawing = page.locator(".paper svg.drawing-layer");
  const box = await drawing.boundingBox();
  assert(box, "Drawing layer is missing");
  await page.touchscreen.tap(box.x + 60, box.y + 70);

  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - innerWidth);
  assert(overflow <= 2, "Phone layout has horizontal page overflow");
  assert.equal(errors.length, 0, `Runtime errors: ${errors.join(" | ")}`);
  console.log(JSON.stringify({ status: "PASS", viewport: "412x915", bottomSections: 4, runtimeErrors: 0 }));
  await browser.close();
})().catch((error) => { console.error(error); process.exit(1); });
