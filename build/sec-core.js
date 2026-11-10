/* =====================================================================
   WOOMI 보안 코어
   - 비밀번호 잠금 + 저장 자료 암호화 (PBKDF2-SHA256 → AES-256-GCM)
   - localStorage 의 "fireplan_*" 값, IndexedDB 기록(사진·서명 포함)을 모두 암호화해서 보관
   - 화면에 끼워 넣는 HTML 에서 스크립트 실행 요소 제거 (XSS 방어)
   - CDN 라이브러리 무결성 검사 (SRI)
   - 일정 시간 사용하지 않으면 자동 잠금
   자료는 이 컴퓨터(브라우저) 안에만 저장되며, 어떤 서버로도 전송되지 않습니다.
   ===================================================================== */
(function(){
  "use strict";
  if(window.WoomiSec) return;

  var META_KEY   = "woomi_sec_meta_v1";     // 암호 확인용 정보(솔트·반복횟수·검증값) – 비밀번호 자체는 저장하지 않음
  var IDLE_KEY   = "woomi_sec_idle_min";    // 자동 잠금 시간(분)
  var APP_PREFIX = "fireplan_";             // 두 앱이 쓰는 모든 저장 키의 접두어
  var ENV        = "WSEC1:";                // 암호문 표시
  var ITER       = 310000;                  // PBKDF2 반복 횟수 (OWASP 권장치)
  var MIN_PW     = 8;
  var IDB_NAMES  = ["fireplan_b3a_db", "fireplan_hotwork_db", "fireplan_b56_db"];

  var realLS = window.localStorage;
  var SP = Storage.prototype;
  var raw = { get:SP.getItem, set:SP.setItem, rm:SP.removeItem, key:SP.key };
  var lsLen = Object.getOwnPropertyDescriptor(SP, "length").get;
  var te = new TextEncoder(), td = new TextDecoder();
  var subtle = window.crypto && window.crypto.subtle;

  var KEY = null;                 // 메모리에만 있는 암호화 키 (추출 불가)
  var cache = new Map();          // 복호화된 값 (메모리)
  var ver = new Map();            // 키별 쓰기 버전
  var chain = Promise.resolve();  // 암호화 쓰기 순서 보장
  var pendingWrites = 0;

  /* ---------------- 공통 유틸 ---------------- */
  function b64(u8){ var s = "", C = 0x8000; for(var i = 0; i < u8.length; i += C) s += String.fromCharCode.apply(null, u8.subarray(i, i + C)); return btoa(s); }
  function unb64(s){ var b = atob(s), u = new Uint8Array(b.length); for(var i = 0; i < b.length; i++) u[i] = b.charCodeAt(i); return u; }
  function rnd(n){ var u = new Uint8Array(n); crypto.getRandomValues(u); return u; }
  function isAppKey(k){ return typeof k === "string" ? k.indexOf(APP_PREFIX) === 0 : String(k).indexOf(APP_PREFIX) === 0; }

  async function deriveKey(pw, salt, iter){
    var base = await subtle.importKey("raw", te.encode(pw), "PBKDF2", false, ["deriveKey"]);
    return subtle.deriveKey({ name:"PBKDF2", hash:"SHA-256", salt:salt, iterations:iter }, base,
      { name:"AES-GCM", length:256 }, false, ["encrypt", "decrypt"]);
  }
  async function encBytes(key, bytes){
    var iv = rnd(12);
    var ct = new Uint8Array(await subtle.encrypt({ name:"AES-GCM", iv:iv }, key, bytes));
    return { iv:iv, ct:ct };
  }
  async function decBytes(key, iv, ct){ return new Uint8Array(await subtle.decrypt({ name:"AES-GCM", iv:iv }, key, ct)); }
  async function encStr(key, str){
    var r = await encBytes(key, te.encode(str));
    var all = new Uint8Array(12 + r.ct.length); all.set(r.iv, 0); all.set(r.ct, 12);
    return ENV + b64(all);
  }
  async function decStr(key, env){
    var all = unb64(env.slice(ENV.length));
    return td.decode(await decBytes(key, all.subarray(0, 12), all.subarray(12)));
  }

  /* ---------------- localStorage 가로채기 ----------------
     앱 코드는 localStorage.getItem/setItem 을 그대로 쓰고,
     실제 저장소에는 암호문만 들어갑니다. */
  function queueWrite(k){
    var v = (ver.get(k) || 0) + 1; ver.set(k, v); pendingWrites++;
    chain = chain.then(async function(){
      try{
        if(ver.get(k) !== v) return;
        if(!cache.has(k)){ raw.rm.call(realLS, k); return; }
        var e = await encStr(KEY, cache.get(k));
        if(ver.get(k) !== v) return;
        raw.set.call(realLS, k, e);
      }catch(err){
        console.error(err);
        notify("⚠️ 저장 공간이 부족해 일부 내용을 저장하지 못했어요. 오래된 기록이나 사진을 정리해 주세요.");
      }finally{ pendingWrites--; }
    });
  }
  var PROBE_KEY = "woomi_sec_probe";
  function probeQuota(k, v){
    var need = ENV.length + Math.ceil((te.encode(v).length + 28) / 3) * 4;
    var cur = (raw.get.call(realLS, k) || "").length;
    var extra = need - cur;
    if(extra <= 0) return;
    try{ raw.set.call(realLS, PROBE_KEY, "x".repeat(extra)); }
    finally{ raw.rm.call(realLS, PROBE_KEY); }
  }
  function installStorage(win){
    var P = win.Storage.prototype, ls = win.localStorage;
    var g = P.getItem, s = P.setItem, r = P.removeItem;
    P.getItem = function(k){
      if(this === ls && isAppKey(k)){ k = String(k); return cache.has(k) ? cache.get(k) : null; }
      return g.call(this, k);
    };
    P.setItem = function(k, v){
      if(this === ls && isAppKey(k)){
        if(!KEY) throw new Error("잠금 상태에서는 저장할 수 없어요.");
        k = String(k); v = String(v);
        probeQuota(k, v);   // 공간이 부족하면 앱이 알 수 있게 즉시 QuotaExceededError
        cache.set(k, v); queueWrite(k); return;
      }
      return s.call(this, k, v);
    };
    P.removeItem = function(k){
      if(this === ls && isAppKey(k)){ k = String(k); cache.delete(k); if(KEY) queueWrite(k); return; }
      return r.call(this, k);
    };
  }

  /* ---------------- IndexedDB 값 암호화 (앱의 idbGet/idbSet 에서 호출) ---------------- */
  async function encVal(v){
    if(v === undefined) return v;
    if(!KEY) throw new Error("잠금 상태");
    var r = await encBytes(KEY, te.encode(JSON.stringify(v)));
    return { __wsec:1, iv:r.iv, ct:r.ct };
  }
  async function decValWith(key, x){
    if(x && x.__wsec === 1){
      return JSON.parse(td.decode(await decBytes(key, x.iv, x.ct)));
    }
    return x;  // 예전(암호화 전) 자료는 그대로 읽고, 다음 저장 때 암호화됨
  }
  function decVal(x){ return decValWith(KEY, x); }

  function idbOpen(name){
    return new Promise(function(res, rej){
      var rq = indexedDB.open(name, 1);
      rq.onupgradeneeded = function(){ if(!rq.result.objectStoreNames.contains("kv")) rq.result.createObjectStore("kv"); };
      rq.onsuccess = function(){ res(rq.result); }; rq.onerror = function(){ rej(rq.error); };
    });
  }
  async function idbAll(name){
    var db = await idbOpen(name);
    if(!db.objectStoreNames.contains("kv")){ db.close(); return []; }
    return new Promise(function(res, rej){
      var out = [], tx = db.transaction("kv"), st = tx.objectStore("kv"), cur = st.openCursor();
      cur.onsuccess = function(){ var c = cur.result; if(c){ out.push([c.key, c.value]); c.continue(); } };
      tx.oncomplete = function(){ db.close(); res(out); }; tx.onerror = function(){ db.close(); rej(tx.error); };
    });
  }
  async function idbPutAll(name, pairs, clearFirst){
    var db = await idbOpen(name);
    return new Promise(function(res, rej){
      var tx = db.transaction("kv", "readwrite"), st = tx.objectStore("kv");
      if(clearFirst) st.clear();
      pairs.forEach(function(p){ st.put(p[1], p[0]); });
      tx.oncomplete = function(){ db.close(); res(); }; tx.onerror = tx.onabort = function(){ db.close(); rej(tx.error); };
    });
  }
  // 예전 평문 기록이 남아 있으면 바로 암호화해서 덮어씀
  async function migrateIDB(){
    for(var i = 0; i < IDB_NAMES.length; i++){
      try{
        var all = await idbAll(IDB_NAMES[i]), out = [];
        for(var j = 0; j < all.length; j++){ var v = all[j][1]; if(!(v && v.__wsec === 1)) out.push([all[j][0], await encVal(v)]); }
        if(out.length) await idbPutAll(IDB_NAMES[i], out, false);
      }catch(e){ console.warn("IDB migrate", IDB_NAMES[i], e); }
    }
  }

  /* ---------------- HTML 정화 (XSS 방어) ----------------
     PDF/OCR 로 읽은 글자나 입력값에 <img onerror=…> 같은 코드가 섞여 있어도 실행되지 않게
     innerHTML 로 들어가는 내용에서 스크립트 실행 요소를 제거합니다. */
  var RISKY = /<\s*\/?\s*(script|iframe|frame|object|embed|base|meta|link|form|template|animate|set|svg|math|style)\b|\son[a-z]+\s*=|javascript:|vbscript:|srcdoc|data:text\/html/i;
  var BAD_TAGS = { SCRIPT:1, IFRAME:1, FRAME:1, FRAMESET:1, OBJECT:1, EMBED:1, BASE:1, META:1, LINK:1, FORM:1, TEMPLATE:1, ANIMATE:1, SET:1, ANIMATETRANSFORM:1, ANIMATEMOTION:1, NOSCRIPT:1, PORTAL:1 };
  // 앱 자체가 쓰는 인라인 클릭 처리기만 허용
  var SAFE_HANDLER = /^\s*(location\.hash\s*=\s*'#[\w\/.-]*'|downloadDeadlineICS\('[\w-]*'\))\s*;?\s*$/;
  var URL_ATTR = /^(href|src|action|formaction|xlink:href|poster|background|data|codebase)$/i;
  var BAD_URL = /^\s*(javascript|vbscript|data:(?!image\/(png|jpe?g|gif|webp|bmp);))/i;
  function sanitizeTree(root){
    var els = root.querySelectorAll("*");
    for(var i = 0; i < els.length; i++){
      var el = els[i], tn = el.tagName.toUpperCase();
      if(BAD_TAGS[tn]){ el.remove(); continue; }
      for(var j = el.attributes.length - 1; j >= 0; j--){
        var a = el.attributes[j], n = a.name.toLowerCase();
        if(n.indexOf("on") === 0){ if(!SAFE_HANDLER.test(a.value)) el.removeAttribute(a.name); }
        else if(n === "srcdoc" || n === "formaction") el.removeAttribute(a.name);
        else if(URL_ATTR.test(n) && BAD_URL.test(a.value.replace(/[\u0000- ]/g, ""))) el.removeAttribute(a.name);
      }
    }
  }
  function installSanitizer(win){
    var EP = win.Element.prototype;
    var d = Object.getOwnPropertyDescriptor(EP, "innerHTML");
    if(!d || !d.set) return;
    Object.defineProperty(EP, "innerHTML", {
      configurable:true, enumerable:d.enumerable, get:d.get,
      set:function(html){
        html = html == null ? "" : String(html);
        if(!RISKY.test(html)) return d.set.call(this, html);
        var t = win.document.createElement("template");
        d.set.call(t, html);
        sanitizeTree(t.content);
        return d.set.call(this, d.get.call(t));
      }
    });
  }

  /* ---------------- CDN 라이브러리 무결성 검사 (SRI) ---------------- */
  var SRI = {
    "https://cdn.jsdelivr.net/npm/pdfjs-dist@3.11.174/build/pdf.min.js":        "sha384-/1qUCSGwTur9vjf/z9lmu/eCUYbpOTgSjmpbMQZ1/CtX2v/WcAIKqRv+U1DUCG6e",
    "https://cdn.jsdelivr.net/npm/tesseract.js@5.1.1/dist/tesseract.min.js":   "sha384-GJqSu7vueQ9qN0E9yLPb3Wtpd7OrgK8KmYzC8T1IysG1bcvxvIO4qtYR/D3A991F",
    "https://cdn.jsdelivr.net/npm/html2canvas@1.4.1/dist/html2canvas.min.js":  "sha384-ZZ1pncU3bQe8y31yfZdMFdSpttDoPmOZg2wguVK9almUodir1PghgT0eY7Mrty8H",
    "https://cdn.jsdelivr.net/npm/jspdf@2.5.1/dist/jspdf.umd.min.js":          "sha384-JcnsjUPPylna1s1fvi1u12X5qjY5OL56iySh75FdtrwhO/SWXgMjoVqcKyIIWOLk",
    "https://cdn.jsdelivr.net/npm/jszip@3.10.1/dist/jszip.min.js":             "sha384-+mbV2IY1Zk/X1p/nWllGySJSUN8uMs+gUAN10Or95UBH0fpj6GfKgPmgC5EXieXG"
  };
  function installSRI(win){
    var NP = win.Node.prototype, ap = NP.appendChild, ib = NP.insertBefore;
    function fix(n){
      if(n && n.tagName === "SCRIPT" && n.src){
        if(SRI[n.src]){ n.integrity = SRI[n.src]; n.crossOrigin = "anonymous"; }
        else if(/^https?:/i.test(n.src)) console.warn("[보안] 검증 목록에 없는 외부 스크립트:", n.src);
      }
    }
    NP.appendChild = function(n){ fix(n); return ap.call(this, n); };
    NP.insertBefore = function(n, r){ fix(n); return ib.call(this, n, r); };
  }


  /* ---------------- 브라우저 강제 다크모드 감지·차단 ----------------
     서식은 흰 종이로 보여야 하고 그대로 인쇄됩니다. 브라우저·확장 프로그램이 색을 바꾸면
     1) 알려진 다크모드 스타일을 끄고, 2) 그래도 어두우면 화면 위에 끄는 방법을 안내합니다. */
  var DARK_SEL = 'style.darkreader,style[class*="darkreader"],link[class*="darkreader"],style[id*="nighteye"],style[class*="nighteye"],' +
                 'style[id*="dark-mode"],style[id*="darkmode"],style[class*="dark-mode"],style[class*="darkmode"],style[data-darkmode],style[id*="night-mode"],style[id*="nightmode"]';
  var DARK_ATTRS = ["data-darkreader-mode", "data-darkreader-scheme", "data-darkreader-proxy-injected", "nighteye", "data-nighteye", "dark-mode", "data-dark-mode"];
  function neutralizeDark(doc){
    try{
      doc.querySelectorAll(DARK_SEL).forEach(function(st){ st.media = "not all"; try{ st.disabled = true; }catch(e){} });
      var h = doc.documentElement;
      DARK_ATTRS.forEach(function(a){ if(h.hasAttribute(a)) h.removeAttribute(a); });
      h.style.setProperty("filter", "none", "important");
      h.style.setProperty("color-scheme", "only light", "important");
      if(doc.body) doc.body.style.setProperty("filter", "none", "important");
    }catch(e){}
  }
  function isDarkened(doc){
    if(!doc || !doc.body) return false;
    var p = doc.getElementById("wsecProbe");
    if(!p){
      p = doc.createElement("div"); p.id = "wsecProbe"; p.setAttribute("aria-hidden", "true");
      p.style.cssText = "position:fixed;left:-9999px;top:0;width:4px;height:4px;margin:0;background-color:#ffffff;color:#000000;";
      doc.body.appendChild(p);
    }
    var w = doc.defaultView, cs = w.getComputedStyle(p);
    var f1 = w.getComputedStyle(doc.documentElement).filter || "", f2 = w.getComputedStyle(doc.body).filter || "";
    return cs.backgroundColor !== "rgb(255, 255, 255)" || cs.color !== "rgb(0, 0, 0)" || /invert/.test(f1 + f2);
  }
  function darkDocs(){
    var out = [document], f = document.getElementById("hotworkFrame");
    try{ if(f && f.contentDocument && f.contentDocument.body) out.push(f.contentDocument); }catch(e){}
    return out;
  }
  function darkBanner(on){
    var b = document.getElementById("wsecDark");
    if(!on){ if(b) b.remove(); return; }
    if(b) return;
    b = document.createElement("div"); b.id = "wsecDark"; b.setAttribute("role", "alert");
    b.innerHTML = '<b>⚠️ 브라우저의 다크 모드가 서식을 검게 바꾸고 있어요. 이대로 인쇄하면 검게 나와요.</b>' +
      '<span>이 사이트에서는 다크 모드를 꺼 주세요. ① 주소창 오른쪽 <b>확장 프로그램(퍼즐 모양)</b> 중 다크 모드 확장 프로그램 → 이 사이트 끄기 ' +
      '② 크롬·엣지: 주소창에 <b>chrome://flags</b>(엣지는 <b>edge://flags</b>) → "<b>Auto Dark Mode for Web Contents</b>" → Disabled ' +
      '③ 웨일: 설정 → <b>다크 모드</b>에서 "웹 페이지에 적용" 끄기. 끈 뒤 <b>Ctrl+F5</b>로 새로고침하세요.</span>' +
      '<button type="button" aria-label="닫기">✕</button>';
    b.querySelector("button").onclick = function(){ b.remove(); darkDismissed = true; };
    document.body.appendChild(b);
  }
  var darkDismissed = false;
  function checkDark(){
    var docs = darkDocs(), dark = false;
    docs.forEach(function(d){ if(isDarkened(d)){ neutralizeDark(d); } });
    setTimeout(function(){
      docs.forEach(function(d){ if(isDarkened(d)) dark = true; });
      if(!dark) darkDismissed = false;
      darkBanner(dark && !darkDismissed);
    }, 300);
    return docs.some(isDarkened);
  }
  function guardPrint(){
    if(checkDark()) alert("⚠️ 브라우저의 다크 모드 때문에 서식이 검게 인쇄될 수 있어요.\n화면 위쪽 안내대로 이 사이트의 다크 모드를 끈 뒤 다시 인쇄해 주세요.");
  }

  function installAll(win){ installStorage(win); installSanitizer(win); installSRI(win); trackActivity(win);
    win.addEventListener("beforeprint", guardPrint); if(win !== window) win.addEventListener("load", function(){ setTimeout(checkDark, 500); }); }

  /* ---------------- 자동 잠금 ---------------- */
  var lastAct = Date.now();
  function trackActivity(win){
    ["pointerdown", "keydown", "wheel", "touchstart"].forEach(function(ev){
      win.addEventListener(ev, function(){ lastAct = Date.now(); }, { passive:true, capture:true });
    });
  }
  function idleMinutes(){ var m = parseInt(raw.get.call(realLS, IDLE_KEY), 10); return [5, 10, 30, 60, 120].indexOf(m) >= 0 ? m : 30; }
  setInterval(function(){ if(KEY && Date.now() - lastAct > idleMinutes() * 60000) lock(); }, 20000);

  async function flush(){ var c; do{ c = chain; await c; } while(c !== chain); }
  // IndexedDB 암호화 쓰기 추적 (잠그기 전에 모두 끝낼 때까지 기다리기 위해)
  var idbPending = new Set();
  function trackIdb(p){ idbPending.add(p); p.then(function(){ idbPending.delete(p); }, function(){ idbPending.delete(p); }); return p; }
  function tick(ms){ return new Promise(function(r){ setTimeout(r, ms || 30); }); }
  async function settle(){
    for(var round = 0; round < 50; round++){
      await tick();
      if(!idbPending.size && !pendingWrites) { await tick(60); if(!idbPending.size && !pendingWrites) return; }
      if(idbPending.size) await Promise.allSettled(Array.from(idbPending));
      await flush();
    }
  }
  var locking = false;
  async function lock(){
    if(locking) return; locking = true;
    if(KEY){
      // 앱의 "창 닫을 때 작성 중인 내용 기록으로 보관" 처리를 키가 살아 있을 때 먼저 실행
      try{ window.dispatchEvent(new Event("pagehide")); }catch(e){ console.error(e); }
      try{ await settle(); }catch(e){ console.error(e); }
    }
    KEY = null; cache.clear();
    location.reload();
  }
  // 앱 스크립트가 등록한 닫기 처리 "뒤에" 실행되도록 앱 시작 후 등록
  function guardUnload(){
    window.addEventListener("beforeunload", function(e){
      if(!locking && (pendingWrites > 0 || idbPending.size > 0)){ e.preventDefault(); e.returnValue = ""; }
    });
  }

  /* ---------------- 잠금 해제 / 최초 설정 ---------------- */
  function getMeta(){ try{ var m = JSON.parse(raw.get.call(realLS, META_KEY) || "null"); return m && m.salt && m.check ? m : null; }catch(e){ return null; } }
  function appKeys(){ var out = [], n = lsLen.call(realLS); for(var i = 0; i < n; i++){ var k = raw.key.call(realLS, i); if(k && isAppKey(k)) out.push(k); } return out; }

  async function loadAll(){
    cache.clear();
    var keys = appKeys(), legacy = [];
    for(var i = 0; i < keys.length; i++){
      var v = raw.get.call(realLS, keys[i]);
      if(v == null) continue;
      if(v.indexOf(ENV) === 0){
        try{ cache.set(keys[i], await decStr(KEY, v)); }catch(e){ console.warn("복호화 실패", keys[i]); }
      }else{ cache.set(keys[i], v); legacy.push(keys[i]); }   // 예전 평문 자료 → 암호화
    }
    legacy.forEach(queueWrite);
    await migrateIDB();
    await flush();
  }

  function clean(t){ return String(t == null ? "" : t).replace(/[\u0000-\u001f<>]/g, "").trim().slice(0, 40); }
  function getProfile(){ var m = getMeta(); return { site: m ? clean(m.site) : "", manager: m ? clean(m.manager) : "" }; }
  function setProfile(site, manager){
    if(!KEY) throw new Error("잠금 상태");
    var m = getMeta(); m.site = clean(site); m.manager = clean(manager);
    raw.set.call(realLS, META_KEY, JSON.stringify(m));
  }
  async function setupPassword(pw, profile){
    var salt = rnd(16);
    KEY = await deriveKey(pw, salt, ITER);
    var meta = { v:1, salt:b64(salt), iter:ITER, check: await encStr(KEY, "woomi-ok"), created:new Date().toISOString(),
      site: clean(profile && profile.site), manager: clean(profile && profile.manager) };
    raw.set.call(realLS, META_KEY, JSON.stringify(meta));
    await loadAll();
  }
  async function unlock(pw){
    var m = getMeta(); if(!m) throw new Error("no-meta");
    var k = await deriveKey(pw, unb64(m.salt), m.iter || ITER);
    try{ if(await decStr(k, m.check) !== "woomi-ok") throw 0; }catch(e){ return false; }
    KEY = k; await loadAll(); return true;
  }

  async function changePassword(oldPw, newPw){
    var m = getMeta();
    var k0 = await deriveKey(oldPw, unb64(m.salt), m.iter || ITER);
    try{ if(await decStr(k0, m.check) !== "woomi-ok") throw 0; }catch(e){ return false; }
    await flush();
    var idb = [];
    for(var i = 0; i < IDB_NAMES.length; i++){
      var all = await idbAll(IDB_NAMES[i]), dec = [];
      for(var j = 0; j < all.length; j++) dec.push([all[j][0], await decValWith(k0, all[j][1])]);
      idb.push(dec);
    }
    var salt = rnd(16), k1 = await deriveKey(newPw, salt, ITER);
    KEY = k1;
    for(var x = 0; x < IDB_NAMES.length; x++){
      var enc = [];
      for(var y = 0; y < idb[x].length; y++) enc.push([idb[x][y][0], await encVal(idb[x][y][1])]);
      if(enc.length) await idbPutAll(IDB_NAMES[x], enc, false);
    }
    var keys = Array.from(cache.keys());
    for(var z = 0; z < keys.length; z++) raw.set.call(realLS, keys[z], await encStr(k1, cache.get(keys[z])));
    raw.set.call(realLS, META_KEY, JSON.stringify({ v:1, salt:b64(salt), iter:ITER, check: await encStr(k1, "woomi-ok"), created:m.created, changed:new Date().toISOString(), site:m.site || "", manager:m.manager || "" }));
    return true;
  }

  /* ---------------- 암호화 백업 / 복원 ---------------- */
  async function exportBackup(pw){
    var m = getMeta();
    var kchk = await deriveKey(pw, unb64(m.salt), m.iter || ITER);
    try{ if(await decStr(kchk, m.check) !== "woomi-ok") throw 0; }catch(e){ return false; }
    await flush();
    var data = { app:"woomi", v:1, at:new Date().toISOString(), ls:{}, idb:{} };
    cache.forEach(function(v, k){ data.ls[k] = v; });
    for(var i = 0; i < IDB_NAMES.length; i++){
      var all = await idbAll(IDB_NAMES[i]), dec = [];
      for(var j = 0; j < all.length; j++) dec.push([all[j][0], await decVal(all[j][1])]);
      data.idb[IDB_NAMES[i]] = dec;
    }
    var salt = rnd(16), bk = await deriveKey(pw, salt, ITER);
    var r = await encBytes(bk, te.encode(JSON.stringify(data)));
    var blob = new Blob([JSON.stringify({ woomiBackup:1, salt:b64(salt), iter:ITER, iv:b64(r.iv) }), "\n", r.ct], { type:"application/octet-stream" });
    var a = document.createElement("a");
    var d = new Date(), p = function(n){ return String(n).padStart(2, "0"); };
    a.href = URL.createObjectURL(blob);
    a.download = "WOOMI_암호화백업_" + d.getFullYear() + p(d.getMonth() + 1) + p(d.getDate()) + "_" + p(d.getHours()) + p(d.getMinutes()) + ".woomi";
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(function(){ URL.revokeObjectURL(a.href); }, 5000);
    return true;
  }
  async function importBackup(file, pw){
    var buf = new Uint8Array(await file.arrayBuffer());
    var nl = buf.indexOf(10); if(nl < 0) throw new Error("백업 파일 형식이 아니에요.");
    var head = JSON.parse(td.decode(buf.subarray(0, nl)));
    if(!head.woomiBackup) throw new Error("백업 파일 형식이 아니에요.");
    var bk = await deriveKey(pw, unb64(head.salt), head.iter);
    var data;
    try{ data = JSON.parse(td.decode(await decBytes(bk, unb64(head.iv), buf.subarray(nl + 1)))); }
    catch(e){ return false; }
    // 기존 자료를 백업 내용으로 교체
    appKeys().forEach(function(k){ raw.rm.call(realLS, k); });
    cache.clear();
    Object.keys(data.ls || {}).forEach(function(k){ if(isAppKey(k)){ cache.set(k, data.ls[k]); queueWrite(k); } });
    await flush();
    for(var i = 0; i < IDB_NAMES.length; i++){
      var pairs = (data.idb && data.idb[IDB_NAMES[i]]) || [], enc = [];
      for(var j = 0; j < pairs.length; j++) enc.push([pairs[j][0], await encVal(pairs[j][1])]);
      await idbPutAll(IDB_NAMES[i], enc, true);
    }
    return true;
  }

  async function wipeAll(){
    appKeys().forEach(function(k){ raw.rm.call(realLS, k); });
    raw.rm.call(realLS, META_KEY);
    for(var i = 0; i < IDB_NAMES.length; i++){
      await new Promise(function(res){ var r = indexedDB.deleteDatabase(IDB_NAMES[i]); r.onsuccess = r.onerror = r.onblocked = function(){ res(); }; });
    }
  }

  /* ---------------- 알림 ---------------- */
  function notify(msg){
    var el = document.getElementById("wsecToast");
    if(!el){ el = document.createElement("div"); el.id = "wsecToast"; document.body.appendChild(el); }
    el.textContent = msg; el.classList.add("on");
    clearTimeout(notify._t); notify._t = setTimeout(function(){ el.classList.remove("on"); }, 6000);
  }

  // 메인 창 즉시 설치 (앱 스크립트보다 먼저 실행됨)
  if(subtle) installAll(window);

  window.WoomiSec = {
    supported: !!subtle,
    MIN_PW: MIN_PW,
    hasPassword: function(){ return !!getMeta(); },
    getProfile: getProfile, setProfile: setProfile,
    isUnlocked: function(){ return !!KEY; },
    setupPassword: setupPassword, unlock: unlock, lock: lock,
    changePassword: changePassword, exportBackup: exportBackup, importBackup: importBackup, wipeAll: wipeAll,
    encVal: encVal, decVal: decVal, trackIdb: trackIdb, guardUnload: guardUnload,
    installFrame: function(win){ installAll(win); },
    idleMinutes: idleMinutes,
    setIdleMinutes: function(m){ raw.set.call(realLS, IDLE_KEY, String(m)); },
    notify: notify,
    checkDark: checkDark
  };
  Object.freeze(window.WoomiSec);
})();
