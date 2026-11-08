// Captures the how-to-use screenshots from the LOCAL dev app (localhost:3000) as the seeded demo owner.
// Usage: node capture.js <outDir>
const path = require("node:path");
const fs = require("node:fs");
const pw = require("/Users/aminabdirahman/profix/node_modules/playwright-core");

const OUT = process.argv[2];
const BASE = "http://localhost:3000";
const GOLDEN = "/Users/aminabdirahman/Desktop/loadlink.et/packages/extraction/golden";
fs.mkdirSync(OUT, { recursive: true });

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

(async () => {
  const browser = await pw.chromium.launch({ headless: true });
  const ctx = await browser.newContext({ viewport: { width: 1600, height: 1000 }, deviceScaleFactor: 1, colorScheme: "light", locale: "en-US", timezoneId: "America/Chicago" });
  await ctx.addInitScript(() => {
    try {
      localStorage.setItem("theme", "light");
      localStorage.setItem("sf.onboarding", JSON.stringify({ tourDoneAt: new Date().toISOString() }));
    } catch {}
  });
  const page = await ctx.newPage();
  page.setDefaultTimeout(45000);

  const shot = async (name, opts = {}) => {
    await sleep(opts.settle ?? 700);
    await page.screenshot({ path: path.join(OUT, `${name}.png`), fullPage: !!opts.fullPage });
    console.log("shot", name);
  };
  const settleNetwork = () => page.waitForLoadState("networkidle").catch(() => {});

  // 1. Sign in
  await page.goto(`${BASE}/auth/sign-in`);
  await settleNetwork();
  await shot("01-sign-in");
  await page.getByLabel("Email or phone").fill("owner@demofreight.test");
  await page.getByLabel("Password").fill("DemoFreight123!");
  await page.locator("form button[type=submit]").click();
  await page.waitForURL(/\/office(\?|$|\/)/);
  await settleNetwork();

  const steps = {};
  steps.home = async () => {
  await page.goto(`${BASE}/office`);
  await settleNetwork();
  await shot("02-home", { settle: 1200 });
  await shot("02-home-full", { fullPage: true, settle: 200 });

  };
  steps.inbox = async () => {
  await page.goto(`${BASE}/office/inbox`);
  await settleNetwork();
  await shot("03-inbox", { settle: 1200 });
  await shot("03-inbox-full", { fullPage: true, settle: 200 });
  await page.locator("button", { hasText: "g007.png" }).first().click();
  await page.getByText("How each value was read").or(page.getByText("Reading")).first().waitFor();
  await shot("04-inbox-document", { settle: 1200 });
  await page.keyboard.press("Escape");

  };
  steps.transactions = async () => {
  await page.goto(`${BASE}/office/transactions`);
  await settleNetwork();
  await shot("05-transactions", { settle: 1200 });
  await shot("05-transactions-full", { fullPage: true, settle: 200 });
  await page.locator("tr", { hasText: "Oct 2, 2026" }).filter({ hasText: "NORTHSTAR" }).first().click();
  await page.getByText("How each value was read").waitFor();
  await shot("06-transaction-detail", { settle: 1200 });
  await page.getByText("How each value was read").scrollIntoViewIfNeeded();
  await shot("06b-transaction-provenance", { settle: 600 });
  await page.keyboard.press("Escape");

  };
  steps.review = async () => {
  await page.goto(`${BASE}/office/review`);
  await settleNetwork();
  await shot("07-review-queue", { settle: 1200 });
  const queueItem = page.locator("button", { hasText: "BIG SKY" }).first();
  if (await queueItem.count()) {
    await queueItem.click();
    await page.getByText("Source document").first().waitFor();
    await shot("08-review-workspace", { settle: 1800 });
    await page.keyboard.press("Escape");
  } else {
    console.log("no BIG SKY item in queue; skipping workspace shot");
  }

  };
  steps.imports = async () => {
  await page.goto(`${BASE}/office/ifta`);
  await settleNetwork();
  await shot("09-ifta-before-imports", { settle: 1200 });

  // Page order: the ELD mileage import comes first, the fuel-card import second.
  const fileInputs = page.locator('input[type=file]');
  await page.getByText("Fuel card statement").first().scrollIntoViewIfNeeded();
  await fileInputs.nth(1).setInputFiles(path.join(GOLDEN, "demo-fuel-card-comdata.csv"));
  await page.getByRole("button", { name: /^Import$/ }).last().waitFor();
  await page.getByText("Fuel card statement").first().scrollIntoViewIfNeeded();
  await page.evaluate(() => window.scrollBy(0, -40));
  await shot("10-fuelcard-columns", { settle: 1000 });
  await page.getByRole("button", { name: /^Import$/ }).last().click();
  await page.getByText(/card rows imported/).waitFor();
  await page.getByText("Fuel card statement").first().scrollIntoViewIfNeeded();
  await page.evaluate(() => window.scrollBy(0, -40));
  await shot("11-fuelcard-imported", { settle: 1200 });

  await page.getByText("ELD mileage report").first().scrollIntoViewIfNeeded();
  await fileInputs.nth(0).setInputFiles(path.join(GOLDEN, "demo-eld-mileage-q4-2026.csv"));
  await page.getByRole("button", { name: /^Import$/ }).first().waitFor();
  await page.getByText("ELD mileage report").first().scrollIntoViewIfNeeded();
  await page.evaluate(() => window.scrollBy(0, -40));
  await shot("12-mileage-columns", { settle: 1000 });
  await page.getByRole("button", { name: /^Import$/ }).first().click();
  await page.getByText(/mileage rows imported/).waitFor();
  await page.getByText("ELD mileage report").first().scrollIntoViewIfNeeded();
  await page.evaluate(() => window.scrollBy(0, -40));
  await shot("13-mileage-imported", { settle: 1200 });

  };
  steps.ifta = async () => {
  await page.goto(`${BASE}/office/ifta`);
  await settleNetwork();
  await shot("14-ifta-summary", { settle: 1500 });
  await shot("14-ifta-full", { fullPage: true, settle: 200 });
  await page.getByText("IFTA worksheet").first().scrollIntoViewIfNeeded();
  await page.evaluate(() => window.scrollBy(0, -80));
  await shot("15-ifta-worksheet", { settle: 800 });

  };
  steps.reports = async () => {
  await page.goto(`${BASE}/office/reports`);
  await settleNetwork();
  await shot("16-reports", { settle: 1200 });
  const buttons = page.getByRole("button", { name: /^Generate$/ });
  const n = await buttons.count();
  for (let i = 0; i < n; i++) {
    await buttons.nth(i).click();
    await sleep(2500);
    await settleNetwork();
  }
  await shot("17-reports-generated", { settle: 1500 });
  await shot("17-reports-full", { fullPage: true, settle: 200 });

  };
  steps.setup = async () => {
  await page.goto(`${BASE}/office/vehicles`);
  await settleNetwork();
  await shot("18-vehicles", { settle: 1200 });
  await page.goto(`${BASE}/office/settings`);
  await settleNetwork();
  await shot("19-settings", { settle: 1200 });


  };

  const START = process.env.START || "home";
  const order = Object.keys(steps);
  for (const name of order.slice(order.indexOf(START))) { console.log("step", name); await steps[name](); }
  await browser.close();
  console.log("done");
})().catch((e) => { console.error("capture failed:", e); process.exit(1); });
