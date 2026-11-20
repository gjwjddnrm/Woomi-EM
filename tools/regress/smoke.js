// 회귀 스모크: 살아 있는 3개 화면이 콘솔 오류 없이 렌더되는지 확인.
const PC = process.env.PW_CORE; const { chromium } = require(PC);
const EXE = process.env.PW_EXE; const BASE = process.env.BASE || "http://127.0.0.1:8790/";
const SHOT = process.env.SHOT || "/tmp/smoke"; const PW = "smoketest12";
const fs = require("fs");

async function run() {
  const browser = await chromium.launch({ executablePath: EXE, headless: true, args: ["--no-sandbox"] });
  const ctx = await browser.newContext();
  const page = await ctx.newPage();
  const errors = [];
  page.on("pageerror", e => errors.push("PAGEERROR: " + e.message));
  page.on("console", m => { if (m.type() === "error") errors.push("CONSOLE: " + m.text().slice(0, 200)); });

  const result = { boot: [], screens: {} };
  await page.goto(BASE, { waitUntil: "load", timeout: 30000 });
  await page.waitForSelector("#wsecGo", { timeout: 20000 });
  // 최초 설정
  await page.fill("#wsecSite", "스모크현장"); await page.fill("#wsecManager", "김검증");
  await page.fill("#wsecPw", PW); await page.fill("#wsecPw2", PW);
  await page.click("#wsecGo");
  await page.waitForFunction(() => !document.documentElement.classList.contains("wsec-locked"), { timeout: 15000 });
  await page.waitForTimeout(800);
  result.boot = errors.slice();

  async function screen(hash, viewId, name) {
    const before = errors.length;
    await page.evaluate(h => { location.hash = h; }, hash);
    await page.waitForTimeout(900);
    let visible = false, detail = "";
    try {
      visible = await page.evaluate(id => {
        const el = document.getElementById(id);
        return !!el && !el.classList.contains("view-hidden");
      }, viewId);
    } catch (e) { detail = e.message; }
    fs.mkdirSync(SHOT, { recursive: true });
    await page.screenshot({ path: `${SHOT}/${name}.png`, fullPage: false });
    result.screens[name] = { hash, viewId, visible, newErrors: errors.slice(before), detail };
  }

  await screen("#form/byeolji-3-1", "b3CombinedView", "edu");
  await screen("#hotwork", "hotworkView", "hotwork");
  await screen("#form/byeolji-5", "b56CombinedView", "inspect");

  // 화기작업 iframe 내부도 로드되는지
  try {
    const fr = page.frames().find(f => f.name() === "hotworkFrame" || /hotwork/i.test(f.url()));
    result.hotworkFrameLoaded = !!(page.frames().length > 1);
  } catch (e) {}

  // XSS 가드: 정화기 우회 payload 가 실행되면 안 됨(0 이어야 안전)
  try {
    result.xssExecuted = await page.evaluate(() => new Promise(r => {
      window.__xss = 0;
      const mk = h => { const d = document.createElement("div"); d.innerHTML = h; document.body.appendChild(d); };
      mk('<img/src=x /onerror="window.__xss++">');
      mk('<details/open/ontoggle="window.__xss++"></details>');
      mk('<img src=x onerror="window.__xss++">');
      setTimeout(() => r(window.__xss), 500);
    }));
  } catch (e) { result.xssExecuted = "ERR:" + e.message; }

  await browser.close();
  console.log(JSON.stringify(result, null, 2));
}
run().catch(e => { console.error("FATAL", e); process.exit(1); });
