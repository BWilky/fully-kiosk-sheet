// Reproduces Mushroom's real order: chip elements exist (with hass set) BEFORE the card module
// defines them; Mushroom's whenDefined().then() calls setConfig only after the upgrade.
import { chromium } from "/opt/node-tools/node_modules/playwright/index.mjs";
const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true });
const p = await ctx.newPage();
const errors = [];
p.on("pageerror", (e) => errors.push(e.message));
p.on("console", (m) => { if (m.type() === "error") errors.push(m.text()); });
await p.addInitScript(() => {
  window.__prefixes = ["tabletkitchen"];
  window.__late = true;
});
await p.goto("http://127.0.0.1:8765/test/harness.html");
await p.waitForFunction(() => window.__ready && window.fullyTabletSheet && window.__lateConfigured);
await p.waitForTimeout(400);
const before = await p.evaluate(() => document.querySelector("#late .chip, #late > *")?.shadowRoot?.querySelector(".tx")?.textContent);
await p.locator("#late > *").first().locator(".chip").tap();
await p.waitForTimeout(700);
const after = await p.evaluate(() => ({ text: document.querySelector("#late > *").shadowRoot.querySelector(".tx")?.textContent, sheets: document.querySelectorAll("fully-tablet-sheet").length }));
console.log("late-upgrade chip before tap:", before, "| after tap:", JSON.stringify(after), "| errors:", errors.length ? errors.join(" || ") : "none");
await browser.close();
