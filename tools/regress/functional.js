// 기능 회귀 하네스: 단계별로 "기능 유실"이 없는지 검증한다.
//  (1) 인벤토리: 각 화면의 버튼·입력 목록을 수집(다음 단계와 비교 → 사라진 기능 탐지)
//  (2) 동작: 입력→저장→재로그인 값 보존, 백업/복원, 암호화 at-rest, 보안 가드
// 사용: PW_CORE·PW_EXE·BASE 환경변수. JSON 을 stdout 으로 출력.
const { chromium } = require(process.env.PW_CORE);
const BASE = process.env.BASE || "http://127.0.0.1:8799/";
const EXE = process.env.PW_EXE;

const uniqSort = a => [...new Set(a)].sort();

async function newApp(browser, pw) {
  const ctx = await browser.newContext();
  const page = await ctx.newPage();
  const errors = [];
  page.on("pageerror", e => errors.push("ERR " + e.message));
  page.on("console", m => { if (m.type() === "error") errors.push("CON " + m.text().slice(0, 160)); });
  await page.goto(BASE, { waitUntil: "load", timeout: 30000 });
  await page.waitForSelector("#wsecGo", { timeout: 20000 });
  const isSetup = await page.evaluate(() => !window.WoomiSec.hasPassword());
  if (isSetup) { await page.fill("#wsecSite", "기능현장"); await page.fill("#wsecManager", "검증자"); await page.fill("#wsecPw", pw); await page.fill("#wsecPw2", pw); }
  else await page.fill("#wsecPw", pw);
  await page.click("#wsecGo");
  await page.waitForFunction(() => !document.documentElement.classList.contains("wsec-locked"), { timeout: 15000 });
  await page.waitForTimeout(600);
  return { ctx, page, errors };
}

async function unlock(page, pw) {
  await page.goto(BASE, { waitUntil: "load" }); await page.waitForSelector("#wsecGo");
  await page.fill("#wsecPw", pw); await page.click("#wsecGo");
  await page.waitForFunction(() => !document.documentElement.classList.contains("wsec-locked"), { timeout: 15000 });
  await page.waitForTimeout(500);
}

function collectDoc() {
  // 문서 안 모든 버튼 라벨 + 입력 종류(id/data-k/data-f/type) 수집
  const btn = [...document.querySelectorAll("button,[role=button],input[type=button],input[type=submit]")]
    .map(b => (b.textContent || b.value || "").trim().replace(/\s+/g, " ")).filter(Boolean);
  const inp = [...document.querySelectorAll("input,select,textarea")]
    .map(i => i.id || i.getAttribute("data-k") || i.getAttribute("data-f") || ("type:" + i.type)).filter(Boolean);
  const nav = [...document.querySelectorAll("#globalSidebar .gs-navlink")].map(a => a.textContent.trim().replace(/\s+/g, " "));
  return { buttons: btn, inputs: inp, nav };
}

async function run() {
  const browser = await chromium.launch({ executablePath: EXE, headless: true, args: ["--no-sandbox"] });
  const out = { inventory: {}, behavior: {}, security: {}, errors: {} };
  const PW = "func-test-123";

  // ---------- 인벤토리 + 화면 오류 ----------
  try {
    const { ctx, page, errors } = await newApp(browser, PW);
    out.errors.boot = errors.length;
    // 교육훈련
    await page.evaluate(() => location.hash = "#form/byeolji-3-1"); await page.waitForTimeout(700);
    out.inventory.main = await page.evaluate(collectDoc);
    // 화기작업(iframe)
    await page.evaluate(() => location.hash = "#hotwork"); await page.waitForTimeout(1000);
    const fr = page.frames().find(f => /hotwork/i.test(f.url()) || f.name() === "hotworkFrame") ||
               (await page.$("#hotworkFrame")) ? await (await page.$("#hotworkFrame")).contentFrame() : null;
    out.inventory.hotwork = fr ? await fr.evaluate(() => {
      const btn = [...document.querySelectorAll("button")].map(b => b.textContent.trim().replace(/\s+/g, " ")).filter(Boolean);
      const inp = [...document.querySelectorAll("input,select,textarea")].map(i => i.id || i.getAttribute("data-k") || ("type:" + i.type)).filter(Boolean);
      return { buttons: btn, inputs: inp };
    }) : { buttons: [], inputs: [], MISSING: true };
    // 안전점검
    await page.evaluate(() => location.hash = "#form/byeolji-5"); await page.waitForTimeout(800);
    out.inventory.inspect = await page.evaluate(collectDoc);
    for (const k of ["main", "hotwork", "inspect"]) {
      if (out.inventory[k].buttons) out.inventory[k].buttons = uniqSort(out.inventory[k].buttons);
      if (out.inventory[k].inputs) out.inventory[k].inputs = uniqSort(out.inventory[k].inputs);
    }
    await ctx.close();
  }

  catch(e){ out.errors.inventory = e.message; }

  // ---------- 동작: 교육일지 저장 라운드트립(신규·수정·삭제) ----------
  async function b3aCount(page) {
    return page.evaluate(async () => {
      const raw = await new Promise(res => { const r = indexedDB.open("fireplan_b3a_db", 1); r.onsuccess = () => { const g = r.result.transaction("kv").objectStore("kv").get("entries"); g.onsuccess = () => res(g.result); }; r.onerror = () => res(null); });
      const v = await window.WoomiSec.decVal(raw); return Array.isArray(v) ? v : [];
    });
  }
  try {
    const { ctx, page } = await newApp(browser, PW);
    await page.evaluate(() => location.hash = "#form/byeolji-3-1"); await page.waitForTimeout(600);
    await page.evaluate(() => { document.getElementById("b3a-date").value = "2026-05-05"; document.getElementById("b3a-place").value = "기능검증현장"; document.getElementById("b3a-main").value = "교육내용"; ["b3a-date", "b3a-place", "b3a-main"].forEach(id => document.getElementById(id).dispatchEvent(new Event("input", { bubbles: true }))); document.getElementById("b3aSaveLogBtn").click(); });
    await page.waitForTimeout(900);
    await unlock(page, PW); await page.evaluate(() => location.hash = "#form/byeolji-3-1"); await page.waitForTimeout(800);
    const recs = await b3aCount(page);
    const saved = recs.find(r => r.data && r.data["b3a-place"] === "기능검증현장");
    // 암호화 at-rest 확인
    const encrypted = await page.evaluate(async () => {
      const raw = await new Promise(res => { const r = indexedDB.open("fireplan_b3a_db", 1); r.onsuccess = () => { const g = r.result.transaction("kv").objectStore("kv").get("entries"); g.onsuccess = () => res(g.result); }; });
      return !!(raw && raw.__wsec === 1);   // 평문이 아니라 암호문이어야
    });
    out.behavior.eduSave = { persisted: !!saved, count: recs.length, encryptedAtRest: encrypted };
    await ctx.close();
  }

  catch(e){ out.errors.eduSave = e.message; }

  // ---------- 동작: 백업 내보내기 → 전체삭제 → 복원 ----------
  try {
    const { ctx, page } = await newApp(browser, PW);
    await page.evaluate(() => location.hash = "#form/byeolji-3-1"); await page.waitForTimeout(500);
    await page.evaluate(() => { document.getElementById("b3a-date").value = "2026-06-06"; document.getElementById("b3a-place").value = "백업대상현장"; document.getElementById("b3a-main").value = "x"; ["b3a-date", "b3a-place", "b3a-main"].forEach(id => document.getElementById(id).dispatchEvent(new Event("input", { bubbles: true }))); document.getElementById("b3aSaveLogBtn").click(); });
    await page.waitForTimeout(900);
    // (1) 백업 내보내기 캡처
    const b64 = await page.evaluate(async (pw) => {
      let blob = null; const oc = URL.createObjectURL; URL.createObjectURL = b => { blob = b; return "blob:x"; };
      const ocl = HTMLAnchorElement.prototype.click; HTMLAnchorElement.prototype.click = function () { };
      try { await window.WoomiSec.exportBackup(pw); } finally { URL.createObjectURL = oc; HTMLAnchorElement.prototype.click = ocl; }
      const bbuf = new Uint8Array(await blob.arrayBuffer());
      return btoa(String.fromCharCode.apply(null, bbuf));
    }, PW);
    await page.waitForTimeout(200);
    // (2) 기록을 비움(자료 손실 상황) — DB 는 두고 entries 만 비워 복원이 되살리는지 본다
    const wiped = await page.evaluate(async () => {
      await new Promise(res => { const r = indexedDB.open("fireplan_b3a_db", 1); r.onsuccess = () => { const tx = r.result.transaction("kv", "readwrite"); tx.objectStore("kv").delete("entries"); tx.oncomplete = res; }; });
      const raw = await new Promise(res => { const r = indexedDB.open("fireplan_b3a_db", 1); r.onsuccess = () => { const g = r.result.transaction("kv").objectStore("kv").get("entries"); g.onsuccess = () => res(g.result); }; });
      return raw == null;
    });
    const result = { b64: b64, wiped: wiped };
    await page.reload({ waitUntil: "load" }); await page.waitForSelector("#wsecGo");
    await page.fill("#wsecPw", PW); await page.click("#wsecGo");
    await page.waitForFunction(() => !document.documentElement.classList.contains("wsec-locked"), { timeout: 15000 }); await page.waitForTimeout(500);
    const restored = await page.evaluate(async ({ b64, pw }) => {
      const bin = atob(b64); const u = new Uint8Array(bin.length); for (let i = 0; i < bin.length; i++) u[i] = bin.charCodeAt(i);
      const f = new File([u], "x.woomi");
      const ok = await window.WoomiSec.importBackup(f, pw);
      const raw = await new Promise(res => { const r = indexedDB.open("fireplan_b3a_db", 1); r.onsuccess = () => { const g = r.result.transaction("kv").objectStore("kv").get("entries"); g.onsuccess = () => res(g.result); }; });
      const v = await window.WoomiSec.decVal(raw);
      return { imported: ok, hasRecord: Array.isArray(v) && v.some(r => r.data && r.data["b3a-place"] === "백업대상현장") };
    }, { b64: result.b64, pw: PW });
    out.behavior.backup = { wiped: result.wiped, imported: restored.imported, restored: restored.hasRecord };
    await ctx.close();
  }

  catch(e){ out.errors.backup = e.message; }

  // ---------- 보안 가드 ----------
  try {
    const { ctx, page } = await newApp(browser, PW);
    out.security.xssExecuted = await page.evaluate(() => new Promise(r => {
      window.__x = 0; const mk = h => { const d = document.createElement("div"); d.innerHTML = h; document.body.appendChild(d); };
      mk('<img/src=x /onerror="window.__x++">'); mk('<details/open/ontoggle="window.__x++"></details>'); mk('<img src=x onerror="window.__x++">');
      setTimeout(() => r(window.__x), 400);
    }));
    out.security.backupIterCap = await page.evaluate(async () => {
      const head = JSON.stringify({ woomiBackup: 1, salt: btoa("0123456789abcdef"), iter: 1e9, iv: btoa("0123456789ab") });
      const enc = new TextEncoder().encode(head); const buf = new Uint8Array(enc.length + 1 + 4); buf.set(enc, 0); buf[enc.length] = 10; buf.set([1, 2, 3, 4], enc.length + 1);
      const t0 = performance.now();
      try { await window.WoomiSec.importBackup(new File([buf], "x.woomi"), "func-test-123"); return { rejected: false }; }
      catch (e) { return { rejected: true, ms: Math.round(performance.now() - t0) }; }
    });
    await ctx.close();
  } catch(e){ out.errors.security = e.message; }

  await browser.close();
  console.log(JSON.stringify(out, null, 2));
}
run().catch(e => { console.error("FATAL", e.message); process.exit(1); });
