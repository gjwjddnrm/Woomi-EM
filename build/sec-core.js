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
  var ITER       = 600000;                  // PBKDF2 반복 횟수 (OWASP 2023 권장치, 예전 자료는 31만)
  var ITER_MIN   = 100000, ITER_MAX = 2000000;   // 백업·저장값의 반복 횟수는 이 범위만 허용 (조작된 파일로 멈춤 방지)
  var MIN_PW     = 10;                       // 새로 정하는 비밀번호 최소 길이 (예전 비밀번호는 그대로 열림)
  var TRY_KEY    = "woomi_sec_tries_v1";     // 틀린 횟수·대기 시각 (보안 코어가 직접 지킴)
  var TAB_LOCK   = "woomi-app-tab";          // 한 번에 한 창(탭)만 열기
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
  var FROZEN = false;             // 복원·전체삭제 뒤 다시 불러올 때까지 어떤 저장도 하지 않음
  var PROFILE = { site:"", manager:"" };   // 현장명·관리자 이름 (잠금이 풀린 뒤에만, 메모리)
  var BROKEN = false;             // 저장된 자료 일부를 풀지 못함 → 빈 목록으로 덮어쓰지 않게 저장 금지

  /* ---------------- 공통 유틸 ---------------- */
  function b64(u8){ var s = "", C = 0x8000; for(var i = 0; i < u8.length; i += C) s += String.fromCharCode.apply(null, u8.subarray(i, i + C)); return btoa(s); }
  function unb64(s){ var b = atob(s), u = new Uint8Array(b.length); for(var i = 0; i < b.length; i++) u[i] = b.charCodeAt(i); return u; }
  function rnd(n){ var u = new Uint8Array(n); crypto.getRandomValues(u); return u; }
  function isAppKey(k){ return typeof k === "string" ? k.indexOf(APP_PREFIX) === 0 : String(k).indexOf(APP_PREFIX) === 0; }

  function safeIter(n){ n = Number(n); if(!(n >= ITER_MIN && n <= ITER_MAX) || Math.floor(n) !== n) throw new Error("파일 형식이 올바르지 않아요."); return n; }
  async function deriveKey(pw, salt, iter){
    iter = safeIter(iter);
    var base = await subtle.importKey("raw", te.encode(pw), "PBKDF2", false, ["deriveKey"]);
    return subtle.deriveKey({ name:"PBKDF2", hash:"SHA-256", salt:salt, iterations:iter }, base,
      { name:"AES-GCM", length:256 }, false, ["encrypt", "decrypt"]);
  }
  // 자료 키(DEK): 무작위 32바이트. 비밀번호에서 만든 키(KEK)로 감싸서 보관 → 비밀번호를 바꿔도 자료는 다시 암호화하지 않음
  function importDek(raw){ return subtle.importKey("raw", raw, { name:"AES-GCM" }, false, ["encrypt", "decrypt"]); }
  // 예전(v1) 자료: 비밀번호에서 바로 만든 키 = 같은 PBKDF2 결과 32바이트를 자료 키로 그대로 이어 씀
  async function deriveRaw(pw, salt, iter){
    iter = safeIter(iter);
    var base = await subtle.importKey("raw", te.encode(pw), "PBKDF2", false, ["deriveBits"]);
    return new Uint8Array(await subtle.deriveBits({ name:"PBKDF2", hash:"SHA-256", salt:salt, iterations:iter }, base, 256));
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
    if(FROZEN) return;
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
        if(BROKEN) throw new Error("일부 자료를 열지 못해 저장을 멈췄어요.");
        if(FROZEN) return;
        if(!KEY) throw new Error("잠금 상태에서는 저장할 수 없어요.");
        k = String(k); v = String(v);
        probeQuota(k, v);   // 공간이 부족하면 앱이 알 수 있게 즉시 QuotaExceededError
        cache.set(k, v); queueWrite(k); return;
      }
      return s.call(this, k, v);
    };
    P.removeItem = function(k){
      if(this === ls && isAppKey(k)){ if(BROKEN) return; k = String(k); cache.delete(k); if(KEY) queueWrite(k); return; }
      return r.call(this, k);
    };
  }

  /* ---------------- IndexedDB 값 암호화 (앱의 idbGet/idbSet 에서 호출) ---------------- */
  async function encVal(v){
    if(v === undefined) return v;
    if(BROKEN) throw new Error("일부 자료를 열지 못해 저장을 멈췄어요.");
    if(FROZEN) throw new Error("다시 불러오는 중");
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
  // 풀지 못하면(키가 다름·손상) 빈 목록으로 보고 덮어쓰는 일이 없게 저장을 막고 알림
  function decVal(x){ return decValWith(KEY, x).catch(function(e){ markBroken(); throw e; }); }
  function markBroken(){
    if(BROKEN) return; BROKEN = true;
    console.error("[보안] 저장된 자료를 풀지 못했어요. 저장을 멈춥니다.");
    try{ alert("⚠️ 저장된 자료 일부를 열지 못했어요.\n\n자료를 지키기 위해 이 화면에서는 저장을 멈췄어요. 화면을 다시 불러온 뒤에도 같으면 백업 파일로 복원해 주세요."); }catch(e){}
  }

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
        if(BROKEN) return;
        if(out.length) await idbPutAll(IDB_NAMES[i], out, false);
      }catch(e){ console.warn("IDB migrate", IDB_NAMES[i], e); }
    }
  }

  /* ---------------- HTML 정화 (XSS 방어) ----------------
     PDF/OCR 로 읽은 글자나 입력값에 <img onerror=…> 같은 코드가 섞여 있어도 실행되지 않게
     innerHTML 로 들어가는 내용에서 스크립트 실행 요소를 제거합니다. */
  var RISKY = /<\s*\/?\s*(script|iframe|frame|object|embed|base|meta|link|form|template|animate|set|svg|math|style)\b|\son[a-z]+\s*=|javascript:|vbscript:|srcdoc|data:text\/html/i;
  var BAD_TAGS = { SCRIPT:1, IFRAME:1, FRAME:1, FRAMESET:1, OBJECT:1, EMBED:1, BASE:1, META:1, LINK:1, FORM:1, TEMPLATE:1, ANIMATE:1, SET:1, ANIMATETRANSFORM:1, ANIMATEMOTION:1, NOSCRIPT:1, PORTAL:1,
                   STYLE:1, XMP:1, NOEMBED:1, NOFRAMES:1, PLAINTEXT:1 };   // 끼워 넣은 <style> 로 화면·인쇄물을 바꾸는 것(CSS 주입)도 막음
  // 그림 주소(src 속성)에 넣는 값: 그림 자료(data:image·blob:)만 통과시키고 따옴표 등을 글자로 바꿈 → 따옴표로 속성을 빠져나가 태그·스타일을 끼워 넣는 위조 차단
  var IMG_OK = /^(data:image\/(png|jpe?g|gif|webp|bmp|svg\+xml);base64,[A-Za-z0-9+\/=\s]*|blob:[\w:\/.%-]+)$/i;
  function safeSrc(v){
    if(v == null || v === "") return "";
    v = String(v);
    if(!IMG_OK.test(v)){ console.warn("[보안] 그림이 아닌 주소를 막았어요:", v.slice(0, 60)); return ""; }
    return v.replace(/[&"'<>]/g, function(c){ return { "&":"&amp;", '"':"&quot;", "'":"&#39;", "<":"&lt;", ">":"&gt;" }[c]; });
  }
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
    var EP = win.Element.prototype, XHTML = "http://www.w3.org/1999/xhtml";
    var d = Object.getOwnPropertyDescriptor(EP, "innerHTML");
    if(!d || !d.set) return;
    var RAWTEXT = { STYLE:1, TEXTAREA:1, TITLE:1, SCRIPT:1, XMP:1, NOSCRIPT:1, IFRAME:1, NOEMBED:1, NOFRAMES:1, PLAINTEXT:1 };
    // 정화한 결과를 다시 글자로 바꾸지 않고 "노드 그대로" 붙임 → 다시 해석되며 구조가 바뀌는 변형 XSS(mXSS) 차단
    function frag(html){
      var t = win.document.createElement("template");
      d.set.call(t, html);
      sanitizeTree(t.content);
      return t.content;
    }
    function needs(html){ return html.indexOf("<") >= 0 || RISKY.test(html); }
    function str(html){ return html == null ? "" : String(html); }
    function cleanStr(html){   // 글자로 돌려줘야 하는 곳(SVG 안 등)만: 정화 후 두 번 해석해도 같은지 확인
      var f = frag(html), t = win.document.createElement("template"); t.content.appendChild(f);
      var once = d.get.call(t), t2 = win.document.createElement("template"); d.set.call(t2, once); sanitizeTree(t2.content);
      var t3 = win.document.createElement("template"); t3.content.appendChild(t2.content); var twice = d.get.call(t3);
      return once === twice ? once : t3.content.textContent;   // 해석할 때마다 달라지면(수상함) 글자만 남김
    }
    Object.defineProperty(EP, "innerHTML", {
      configurable:true, enumerable:d.enumerable, get:d.get,
      set:function(html){
        html = str(html);
        if(!needs(html) || RAWTEXT[this.tagName]) return d.set.call(this, html);
        if(this.namespaceURI !== XHTML || this.tagName === "TEMPLATE") return d.set.call(this, cleanStr(html));
        var f = frag(html);
        while(this.firstChild) this.removeChild(this.firstChild);
        this.appendChild(f);
      }
    });
    var iah = EP.insertAdjacentHTML;
    if(iah) EP.insertAdjacentHTML = function(pos, html){
      html = str(html); if(!needs(html)) return iah.call(this, pos, html);
      var f = frag(html), p = String(pos).toLowerCase();
      if(p === "beforebegin"){ if(this.parentNode) this.parentNode.insertBefore(f, this); }
      else if(p === "afterbegin") this.insertBefore(f, this.firstChild);
      else if(p === "beforeend") this.appendChild(f);
      else if(p === "afterend"){ if(this.parentNode) this.parentNode.insertBefore(f, this.nextSibling); }
      else return iah.call(this, pos, "");
    };
    var od = Object.getOwnPropertyDescriptor(EP, "outerHTML");
    if(od && od.set) Object.defineProperty(EP, "outerHTML", { configurable:true, enumerable:od.enumerable, get:od.get, set:function(html){
      html = str(html); if(!needs(html)) return od.set.call(this, html);
      if(!this.parentNode) return od.set.call(this, "");
      this.parentNode.replaceChild(frag(html), this);
    } });
    var RP = win.Range && win.Range.prototype, ccf = RP && RP.createContextualFragment;
    if(ccf) RP.createContextualFragment = function(html){ html = str(html); return needs(html) ? frag(html) : ccf.call(this, html); };
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
    var w = doc.defaultView; if(!w) return false;   // 프레임이 바뀌는 중이면 건너뜀
    var cs = w.getComputedStyle(p);
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

  /* ---------------- 작업용 파일(워커·글자인식 엔진) 무결성 검사 ----------------
     PDF 읽기·글자 인식은 별도 작업 스레드(워커)에서 돌아가는데, 이 파일들은 <script> 가 아니라서 위의 SRI 가 닿지 않아요.
     그래서 직접 받아서 지문(SHA-384)을 확인한 뒤, 확인된 사본(blob:)으로만 실행합니다. 지문이 다르면 실행하지 않아요. */
  var WORKER_SRI = {
    "https://cdn.jsdelivr.net/npm/pdfjs-dist@3.11.174/build/pdf.worker.min.js":                  "sha384-SnzOobpRMLXZ52iJvZm/C0fYw0OQemTXzTjIsdsfMcrCtCEe9qgzxTd3RSklO5x2",
    "https://cdn.jsdelivr.net/npm/tesseract.js@5.1.1/dist/worker.min.js":                        "sha384-zxn+VqofFzXpH99dUb3fa4ywoSBQJPy6/6oEaJHPlblZXr53a0g1Jl6720vgSzB7",
    "https://cdn.jsdelivr.net/npm/tesseract.js-core@5.1.1/tesseract-core-simd-lstm.wasm.js":     "sha384-YM1G+zaWYy9VSRP2C101LCgzh7n3Hqb6OEm9qDoZYgCADsni3nnECskC3WialQB7",
    "https://cdn.jsdelivr.net/npm/tesseract.js-core@5.1.1/tesseract-core-lstm.wasm.js":          "sha384-EKWY5JDwphQoyxhvYU7eaCcyQ0EdV6fZK3L2vzfZcv2ichRdNd6pSnyWPNv6fMuR"
  };
  var TESS_WORKER = "https://cdn.jsdelivr.net/npm/tesseract.js@5.1.1/dist/worker.min.js";
  var bufCache = {}, urlCache = {};
  function verifiedBuf(url){
    if(!WORKER_SRI[url]) return Promise.reject(new Error("검증 목록에 없는 파일: " + url));
    return bufCache[url] = bufCache[url] || fetch(url, { integrity: WORKER_SRI[url], credentials:"omit", cache:"no-store" })
      .then(function(r){ if(!r.ok) throw new Error("HTTP " + r.status); return r.arrayBuffer(); })
      .catch(function(e){
        delete bufCache[url];
        console.error("[보안] 작업용 파일 확인 실패:", url, e);
        throw new Error("글자 인식·PDF 처리용 파일을 확인하지 못했어요(인터넷 연결 또는 파일 변조). 잠시 뒤 다시 해 주세요.");
      });
  }
  // 확인된 사본(blob:) 주소. 여러 파일은 하나로 이어 붙임 (파일로 열었을 때 작업 스레드 안에서 다른 blob 을 다시 불러올 수 없어서)
  function verified(){
    var urls = Array.prototype.slice.call(arguments), key = urls.join("|");
    if(urlCache[key]) return urlCache[key];
    return urlCache[key] = Promise.all(urls.map(verifiedBuf)).then(function(bufs){
      var parts = []; bufs.forEach(function(b){ parts.push(b, "\n;\n"); });
      return URL.createObjectURL(new Blob(parts, { type:"application/javascript" }));
    }, function(e){ delete urlCache[key]; throw e; });
  }
  function simdOk(){ try{ return WebAssembly.validate(new Uint8Array([0,97,115,109,1,0,0,0,1,5,1,96,0,1,123,3,2,1,0,10,10,1,8,0,65,0,253,15,253,98,11])); }catch(e){ return false; } }
  function guardPdfjs(lib){
    if(!lib || lib.__wsec || typeof lib.getDocument !== "function") return lib;
    var og = lib.getDocument, orig = lib;
    lib = Object.create(orig);   // pdf.js 의 내보내기 객체는 바꿀 수 없어서, 감싼 객체를 대신 돌려줌
    Object.defineProperty(lib, "getDocument", { value: function(src){
      src = (src && typeof src === "object" && !(src instanceof Uint8Array) && !(src instanceof ArrayBuffer)) ? Object.assign({}, src) : { data: src };
      src.isEvalSupported = false;   // 악성 PDF 로 코드 실행(CVE-2024-4367) 막기
      var task = null, ws = lib.GlobalWorkerOptions && lib.GlobalWorkerOptions.workerSrc;
      var ready = WORKER_SRI[ws] ? verified(ws).then(function(b){ lib.GlobalWorkerOptions.workerSrc = b; }) : Promise.resolve();
      var p = ready.then(function(){ task = og.call(orig, src); return task.promise; });
      return { promise: p, destroy: function(){ return p.then(function(){ return task && task.destroy(); }, function(){}); } };
    } });
    try{ Object.defineProperty(lib, "__wsec", { value:true }); }catch(e){}
    return lib;
  }
  function guardTess(T){
    if(!T || T.__wsec || typeof T.createWorker !== "function") return T;
    var oc = T.createWorker;
    T.createWorker = function(langs, oem, opts){
      var rest = Array.prototype.slice.call(arguments, 3);
      var core = "https://cdn.jsdelivr.net/npm/tesseract.js-core@5.1.1/tesseract-core-" + (simdOk() ? "simd-" : "") + "lstm.wasm.js";
      // 엔진(core)을 작업 코드 앞에 붙인 한 파일로 실행 → 작업 스레드가 다른 파일을 더 불러오지 않음
      return verified(core, TESS_WORKER).then(function(u){
        var o = Object.assign({}, opts || {}, { workerPath: u, corePath: "", workerBlobURL: false, cacheMethod: "none" });   // 학습 파일은 저장해 두지 않음(오염된 사본이 남지 않게)
        return oc.apply(T, [langs, oem, o].concat(rest));
      });
    };
    try{ Object.defineProperty(T, "__wsec", { value:true }); }catch(e){}
    return T;
  }
  function installLibGuards(win){
    [["pdfjsLib", guardPdfjs], ["Tesseract", guardTess]].forEach(function(x){
      var cur = win[x[0]], val = cur ? x[1](cur) : undefined;
      try{
        Object.defineProperty(win, x[0], { configurable:true, enumerable:true,
          get: function(){ return val; }, set: function(v){ val = x[1](v); } });
      }catch(e){ console.warn("lib guard", x[0], e); }
    });
  }

  function installAll(win){ installStorage(win); installSanitizer(win); installSRI(win); installLibGuards(win); trackActivity(win);
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
    if(KEY && !FROZEN){
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
  // 잠금 정보가 조작·손상됐는지 (비밀번호가 틀린 것과 구분해서 알려 주기 위해)
  function metaOk(m){
    try{
      if(unb64(m.salt).length !== 16) return false;
      safeIter(m.iter || 310000);
      if(typeof m.check !== "string" || m.check.indexOf(ENV) !== 0) return false;
      if(m.wk != null && (typeof m.wk !== "string" || m.wk.indexOf(ENV) !== 0)) return false;
      return true;
    }catch(e){ return false; }
  }
  function corrupt(){ var e = new Error("잠금 정보가 손상됐어요."); e.code = "meta-corrupt"; return e; }

  /* 비밀번호 대입 막기: 틀릴수록 기다리는 시간이 늘어남 (화면이 아니라 이 코어가 지킴) */
  function tries(){ try{ var t = JSON.parse(raw.get.call(realLS, TRY_KEY) || "{}"); return { f: +t.f || 0, w: +t.w || 0 }; }catch(e){ return { f:0, w:0 }; } }
  function waitSeconds(){ var w = tries().w - Date.now(); return w > 0 ? Math.ceil(w / 1000) : 0; }
  function failed(){ var t = tries(); t.f++; if(t.f >= 5) t.w = Date.now() + Math.min(900, 15 * Math.pow(2, t.f - 5)) * 1000; raw.set.call(realLS, TRY_KEY, JSON.stringify(t)); }
  function passed(){ raw.rm.call(realLS, TRY_KEY); }
  function tooSoon(){ var s = waitSeconds(); if(s){ var e = new Error("잠시 후 다시 시도해 주세요. (" + s + "초)"); e.code = "wait"; e.wait = s; throw e; } }

  /* 비밀번호를 확인하고 자료 키(32바이트)를 꺼냄. 틀리면 null */
  async function openRaw(m, pw){
    if(m.wk){
      var kek = await deriveKey(pw, unb64(m.salt), m.iter || ITER);
      try{ return unb64(await decStr(kek, m.wk)); }catch(e){ return null; }
    }
    var r = await deriveRaw(pw, unb64(m.salt), m.iter || 310000);   // 예전 형식
    try{ if(await decStr(await importDek(r), m.check) !== "woomi-ok") return null; }catch(e){ return null; }
    return r;
  }
  async function checkPw(m, pw){
    if(!metaOk(m)) throw corrupt();
    tooSoon();
    var r = await openRaw(m, pw);
    if(!r){ failed(); return null; }
    passed(); return r;
  }
  async function wrapMeta(rawDek, pw, base){
    var salt = rnd(16), kek = await deriveKey(pw, salt, ITER);
    var m = { v:2, salt:b64(salt), iter:ITER, wk: await encStr(kek, b64(rawDek)), check: base.check, created: base.created || new Date().toISOString() };
    if(base.changed) m.changed = base.changed;
    if(base.prof) m.prof = base.prof;
    return m;
  }

  // 새 비밀번호 규칙 (처음 설정·변경할 때만. 예전 비밀번호로 여는 것은 그대로 됨)
  var WEAK = ["password", "passwd", "qwer", "asdf", "zxcv", "123456", "234567", "345678", "456789", "987654", "abcdef", "iloveyou", "admin", "woomi", "1q2w3e", "q1w2e3"];
  function pwProblem(pw){
    pw = String(pw || "");
    if(pw.length < MIN_PW) return "비밀번호는 " + MIN_PW + "자 이상이어야 해요.";
    var kinds = (/[a-zA-Z]/.test(pw) ? 1 : 0) + (/[0-9]/.test(pw) ? 1 : 0) + (/[^a-zA-Z0-9]/.test(pw) ? 1 : 0);
    if(kinds < 2 && pw.length < 16) return "영문·숫자·특수문자 중 2가지 이상을 섞어 주세요. (16자 이상이면 한 가지도 괜찮아요)";
    if(/^(.)\1+$/.test(pw)) return "같은 글자만 반복한 비밀번호는 쓸 수 없어요.";
    var low = pw.toLowerCase();
    for(var i = 0; i < WEAK.length; i++) if(low.indexOf(WEAK[i]) >= 0) return "\"" + WEAK[i] + "\"처럼 흔한 글자가 들어간 비밀번호는 쓸 수 없어요.";
    return "";
  }

  async function loadAll(){
    cache.clear();
    var keys = appKeys(), legacy = [];
    for(var i = 0; i < keys.length; i++){
      var v = raw.get.call(realLS, keys[i]);
      if(v == null) continue;
      if(v.indexOf(ENV) === 0){
        try{ cache.set(keys[i], await decStr(KEY, v)); }catch(e){ console.warn("복호화 실패", keys[i]); markBroken(); }
      }else{ cache.set(keys[i], v); legacy.push(keys[i]); }   // 예전 평문 자료 → 암호화
    }
    if(!BROKEN) legacy.forEach(queueWrite);
    await migrateIDB();
    await flush();
  }

  function clean(t){ return String(t == null ? "" : t).replace(/[\u0000-\u001f<>]/g, "").trim().slice(0, 40); }
  // 현장명·관리자 이름은 암호화해서 보관하고, 잠금이 풀린 뒤에만 보여 줌 (잠긴 화면·저장소에 실명이 남지 않게)
  function getProfile(){ return KEY ? { site: PROFILE.site, manager: PROFILE.manager } : { site:"", manager:"" }; }
  async function writeProfile(m, key){ m.prof = await encStr(key, JSON.stringify(PROFILE)); delete m.site; delete m.manager; }
  async function setProfile(site, manager){
    if(!KEY) throw new Error("잠금 상태");
    PROFILE = { site: clean(site), manager: clean(manager) };
    var m = getMeta(); await writeProfile(m, KEY);
    raw.set.call(realLS, META_KEY, JSON.stringify(m));
  }
  async function readProfile(m, key){
    if(m.prof){ try{ var p = JSON.parse(await decStr(key, m.prof)); PROFILE = { site: clean(p.site), manager: clean(p.manager) }; }catch(e){ PROFILE = { site:"", manager:"" }; } return false; }
    PROFILE = { site: clean(m.site), manager: clean(m.manager) };
    if(m.site || m.manager){ await writeProfile(m, key); return true; }   // 예전 평문 → 암호화
    return false;
  }
  async function setupPassword(pw, profile){
    var bad = pwProblem(pw); if(bad) throw new Error(bad);
    if(!(await tabReady())) throw new Error("다른 창(탭)에 WOOMI가 열려 있어요.");
    var r = rnd(32);
    KEY = await importDek(r);
    PROFILE = { site: clean(profile && profile.site), manager: clean(profile && profile.manager) };
    var meta = await wrapMeta(r, pw, { check: await encStr(KEY, "woomi-ok") });
    r.fill(0);
    await writeProfile(meta, KEY);
    raw.set.call(realLS, META_KEY, JSON.stringify(meta));
    await loadAll();
  }
  async function unlock(pw){
    var m = getMeta(); if(!m) throw new Error("no-meta");
    if(!(await tabReady())) throw new Error("다른 창(탭)에 WOOMI가 열려 있어요.");
    var r = await checkPw(m, pw);
    if(!r) return false;
    var k = await importDek(r);
    try{ if(await decStr(k, m.check) !== "woomi-ok") throw 0; }catch(e){ r.fill(0); throw corrupt(); }
    var changed = await readProfile(m, k);
    if(!m.wk){ m = await wrapMeta(r, pw, m); changed = true; }   // 예전 형식 → 자료 키를 감싸는 형식 (자료는 그대로, 잠금 정보만 한 번에 바꿈)
    r.fill(0);
    if(changed) raw.set.call(realLS, META_KEY, JSON.stringify(m));
    KEY = k; await loadAll(); return true;
  }

  // 자료 키는 그대로 두고 감싸는 비밀번호만 바꿈 → 잠금 정보 한 번 쓰기로 끝(중간에 끊겨도 자료 손실 없음, 다른 창에도 영향 없음)
  async function changePassword(oldPw, newPw){
    var bad = pwProblem(newPw); if(bad) throw new Error(bad);
    var m = getMeta();
    var r = await checkPw(m, oldPw);
    if(!r) return false;
    var nm = await wrapMeta(r, newPw, { check:m.check, created:m.created, prof:m.prof, changed:new Date().toISOString() });
    r.fill(0);
    raw.set.call(realLS, META_KEY, JSON.stringify(nm));
    return true;
  }

  /* ---------------- 한 번에 한 창(탭)만 ----------------
     두 창에서 같이 고치면 나중에 저장한 쪽이 다른 쪽 기록을 덮어써요. 그래서 WOOMI는 한 창에서만 열려요.
     다른 창에서 "이 창에서 열기"를 누르면 먼저 열린 창은 저장을 마치고 잠깁니다. */
  var tabHeld = null, tabWaiter = null, bc = null;
  try{ bc = new BroadcastChannel("woomi-tab"); bc.onmessage = function(ev){ if(ev.data === "takeover" && tabHeld) lock(); }; }catch(e){}
  function holdTab(wait){
    if(!(navigator.locks && navigator.locks.request)) return Promise.resolve(true);   // 지원하지 않는 브라우저는 막지 않음
    if(tabHeld) return tabHeld;
    var ctl = window.AbortController ? new AbortController() : null;
    var got = new Promise(function(res){
      var opt = ctl ? { signal: ctl.signal } : {};
      navigator.locks.request(TAB_LOCK, opt, function(){ res(true); return new Promise(function(){}); })   // 창을 닫을 때까지 쥐고 있음
        .catch(function(){ res(false); });
      if(ctl) setTimeout(function(){ ctl.abort(); }, wait);
    });
    return got.then(function(ok){ if(ok) tabHeld = Promise.resolve(true); return ok; });
  }
  function tabReady(){ return tabHeld || (tabWaiter = tabWaiter || holdTab(2500).then(function(ok){ tabWaiter = null; return ok; })); }
  function takeover(){
    try{ if(bc) bc.postMessage("takeover"); }catch(e){}
    return holdTab(20000);
  }

  /* ---------------- 암호화 백업 / 복원 ---------------- */
  async function exportBackup(pw){
    var m = getMeta();
    var r0 = await checkPw(m, pw); if(!r0) return false; r0.fill(0);
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
    var data;
    if(head.woomiRaw){   // 전체삭제 직전에 저장한 "암호화 보관 파일": 그때 쓰던 비밀번호로 풀어서 되살림
      if(!metaOk(head.meta)) throw new Error("파일 형식이 올바르지 않아요.");
      var rr = await openRaw(head.meta, pw); if(!rr) return false;
      var rk = await importDek(rr); rr.fill(0);
      try{ if(await decStr(rk, head.meta.check) !== "woomi-ok") throw 0; }catch(e){ return false; }
      var body = JSON.parse(td.decode(buf.subarray(nl + 1)));
      data = { ls:{}, idb:{} };
      for(var lk in (body.ls || {})){ if(isAppKey(lk)) try{ data.ls[lk] = await decStr(rk, body.ls[lk]); }catch(e){} }
      for(var dn in (body.idb || {})){
        if(IDB_NAMES.indexOf(dn) < 0) continue; data.idb[dn] = [];
        for(var q = 0; q < body.idb[dn].length; q++){
          var it = body.idb[dn][q], val = it[1];
          if(val && val.__wsec === 1){ try{ val = JSON.parse(td.decode(await decBytes(rk, unb64(val.iv), unb64(val.ct)))); }catch(e){ continue; } }
          data.idb[dn].push([it[0], val]);
        }
      }
    }else{
      if(!head.woomiBackup) throw new Error("백업 파일 형식이 아니에요.");
      var bk = await deriveKey(pw, unb64(head.salt), head.iter);
      try{ data = JSON.parse(td.decode(await decBytes(bk, unb64(head.iv), buf.subarray(nl + 1)))); }
      catch(e){ return false; }
    }
    if(!data || typeof data !== "object") throw new Error("파일 형식이 올바르지 않아요.");
    // 기존 자료를 백업 내용으로 교체 (풀지 못한 자료가 있던 상태도 복원으로 바로잡을 수 있게)
    BROKEN = false;
    appKeys().forEach(function(k){ raw.rm.call(realLS, k); });
    cache.clear();
    Object.keys(data.ls || {}).forEach(function(k){ if(isAppKey(k)){ cache.set(k, data.ls[k]); queueWrite(k); } });
    await flush();
    for(var i = 0; i < IDB_NAMES.length; i++){
      var pairs = (data.idb && data.idb[IDB_NAMES[i]]) || [], enc = [];
      for(var j = 0; j < pairs.length; j++) enc.push([pairs[j][0], await encVal(pairs[j][1])]);
      await idbPutAll(IDB_NAMES[i], enc, true);
    }
    FROZEN = true;   // 복원한 내용을 화면 닫기 처리가 덮어쓰지 않게, 다시 불러올 때까지 저장 멈춤
    return true;
  }
  // 전체삭제 직전 "암호화 보관 파일": 저장된 암호문을 그대로 묶어 내려받음 (비밀번호가 생각나면 복원 가능)
  async function exportRaw(){
    var m = getMeta(); if(!m) return false;
    var body = { ls:{}, idb:{} };
    appKeys().forEach(function(k){ body.ls[k] = raw.get.call(realLS, k); });
    for(var i = 0; i < IDB_NAMES.length; i++){
      try{
        var all = await idbAll(IDB_NAMES[i]);
        body.idb[IDB_NAMES[i]] = all.map(function(p){ var v = p[1]; return [p[0], (v && v.__wsec === 1) ? { __wsec:1, iv:b64(new Uint8Array(v.iv)), ct:b64(new Uint8Array(v.ct)) } : v]; });
      }catch(e){}
    }
    var head = { woomiRaw:1, meta:{ salt:m.salt, iter:m.iter || 310000, check:m.check }, saved:new Date().toISOString() };
    if(m.wk) head.meta.wk = m.wk;
    var blob = new Blob([JSON.stringify(head), "\n", JSON.stringify(body)], { type:"application/octet-stream" });
    var a = document.createElement("a"), d = new Date(), p = function(n){ return String(n).padStart(2, "0"); };
    a.href = URL.createObjectURL(blob);
    a.download = "WOOMI_삭제전_암호화보관_" + d.getFullYear() + p(d.getMonth() + 1) + p(d.getDate()) + "_" + p(d.getHours()) + p(d.getMinutes()) + ".woomi";
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(function(){ URL.revokeObjectURL(a.href); }, 5000);
    return true;
  }

  async function wipeAll(){
    FROZEN = true;
    // 기록 DB를 먼저 지움: 다른 탭이 열려 있어 막히면 "실패"로 알리고 아무것도 지우지 않은 것처럼 멈춤
    for(var i = 0; i < IDB_NAMES.length; i++){
      await new Promise(function(res, rej){
        var r = indexedDB.deleteDatabase(IDB_NAMES[i]), done = false;
        r.onsuccess = function(){ done = true; res(); };
        r.onerror = function(){ done = true; rej(new Error("기록 저장소를 지우지 못했어요.")); };
        r.onblocked = function(){ setTimeout(function(){ if(!done) rej(new Error("다른 창이나 탭에 WOOMI가 열려 있어서 지우지 못했어요. 다른 WOOMI 창을 모두 닫고 다시 해 주세요.")); }, 1500); };
      });
    }
    try{ indexedDB.deleteDatabase("keyval-store"); }catch(e){}   // 예전에 저장해 둔 글자 인식 학습 파일
    appKeys().forEach(function(k){ raw.rm.call(realLS, k); });
    raw.rm.call(realLS, META_KEY); raw.rm.call(realLS, TRY_KEY);
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
  window.__wsrc = safeSrc;
  // 인라인 onclick 대신: data-wroute="#화면" / data-wics="키" (CSP 에서 인라인 코드를 막아도 동작)
  document.addEventListener("click", function(e){
    var t = e.target && e.target.closest ? e.target.closest("[data-wroute],[data-wics]") : null; if(!t) return;
    var r = t.getAttribute("data-wroute");
    if(r != null){ if(/^#[\w\/.-]*$/.test(r)) location.hash = r; return; }
    var k = t.getAttribute("data-wics");
    if(k != null && typeof window.downloadDeadlineICS === "function") window.downloadDeadlineICS(k);
  }, true);
  // 직접 넣는 큰 사진은 줄여서 저장 (원본 그대로 넣으면 저장 공간이 금방 차요)
  window.__wshrink = function(url){
    return new Promise(function(res){
      if(typeof url !== "string" || url.length < 700000 || !/^data:image\/(png|jpe?g|webp|bmp)/i.test(url)) return res(url);
      var img = new Image();
      img.onload = function(){
        try{
          var k = Math.min(1, 1600 / Math.max(img.width, img.height)), c = document.createElement("canvas");
          c.width = Math.max(1, Math.round(img.width * k)); c.height = Math.max(1, Math.round(img.height * k));
          var g = c.getContext("2d"); g.fillStyle = "#fff"; g.fillRect(0, 0, c.width, c.height); g.drawImage(img, 0, 0, c.width, c.height);
          var out = c.toDataURL("image/jpeg", 0.85); res(out.length < url.length ? out : url);
        }catch(e){ res(url); }
      };
      img.onerror = function(){ res(url); };
      img.src = url;
    });
  };

  window.WoomiSec = {
    supported: !!subtle,
    MIN_PW: MIN_PW,
    hasPassword: function(){ return !!getMeta(); },
    getProfile: getProfile, setProfile: setProfile,
    isUnlocked: function(){ return !!KEY; },
    setupPassword: setupPassword, unlock: unlock, lock: lock,
    changePassword: changePassword, exportBackup: exportBackup, importBackup: importBackup, wipeAll: wipeAll, exportRaw: exportRaw,
    encVal: encVal, decVal: decVal, trackIdb: trackIdb, guardUnload: guardUnload,
    src: safeSrc,
    pwProblem: pwProblem, waitSeconds: waitSeconds, tabReady: tabReady, takeover: takeover, isBroken: function(){ return BROKEN; },
    installFrame: function(win){ installAll(win); },
    idleMinutes: idleMinutes,
    setIdleMinutes: function(m){ raw.set.call(realLS, IDLE_KEY, String(m)); },
    notify: notify,
    checkDark: checkDark
  };
  Object.freeze(window.WoomiSec);
})();
