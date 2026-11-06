import base64, pathlib, sys

UP = pathlib.Path(__file__).resolve().parent.parent / "src"
HERE = pathlib.Path(__file__).parent
OUT = pathlib.Path(sys.argv[1]) if len(sys.argv) > 1 else pathlib.Path(__file__).resolve().parent.parent / "index.html"

A = (UP / "교육훈련_원본.html").read_text("utf-8")
B = (UP / "화기작업_원본.html").read_text("utf-8")
core = (HERE / "sec-core.js").read_text("utf-8")
ui = (HERE / "sec-ui.js").read_text("utf-8")
css = (HERE / "sec.css").read_text("utf-8")
lock_html = (HERE / "sec.html").read_text("utf-8")


def rep(s, old, new, count=1):
    n = s.count(old)
    if n != count:
        raise SystemExit(f"expected {count} match(es), found {n}: {old[:80]!r}")
    return s.replace(old, new)


CSP = ("default-src 'none'; "
       "script-src 'unsafe-inline' 'wasm-unsafe-eval' https://cdn.jsdelivr.net blob:; "
       "style-src 'unsafe-inline'; "
       "img-src data: blob:; font-src data:; media-src data: blob:; "
       "connect-src https://cdn.jsdelivr.net data: blob:; "
       "worker-src blob: https://cdn.jsdelivr.net; "
       "frame-src 'self' blob: data:; child-src 'self' blob:; "
       "object-src 'none'; base-uri 'none'; form-action 'none'")

# ---------------- B (화기작업) : 프레임용으로 가공 ----------------
B = rep(B, "<head>\n", "<head>\n<meta name=\"color-scheme\" content=\"only light\">\n<meta name=\"darkreader-lock\">\n<style>:root{ color-scheme: only light; } *:not(#wsec_n1):not(#wsec_n2):not(#wsec_n3), *:not(#wsec_n1):not(#wsec_n2):not(#wsec_n3)::before, *:not(#wsec_n1):not(#wsec_n2):not(#wsec_n3)::after{ filter:none !important; -webkit-filter:none !important; mix-blend-mode:normal !important; }</style>\n<script>/* WOOMI 보안 코어 연결 */ var WoomiSec = parent.WoomiSec; WoomiSec.installFrame(window);</script>\n")
B = rep(B, "const idbGet = async (k)=>", "const idbGetRaw = async (k)=>")
B = rep(B, "const idbSet = async (k, v)=>", "const idbSetRaw = async (k, v)=>")
B = rep(B, "let chain = Promise.resolve();\n",
        "const idbGet = async (k)=> WoomiSec.decVal(await idbGetRaw(k));   // 기록은 암호화해서 보관\n"
        "const idbSet = (k, v)=> WoomiSec.trackIdb((async ()=> idbSetRaw(k, await WoomiSec.encVal(v)))());\n"
        "let chain = Promise.resolve();\n")
# 화기작업 서명 진하게 보정
import importlib.util as _u2
_sp2 = _u2.spec_from_file_location("patch_hotwork_sig", HERE / "patch_hotwork_sig.py"); _m2 = _u2.module_from_spec(_sp2); _sp2.loader.exec_module(_m2)
for _o, _n in _m2.PAIRS: B = rep(B, _o, _n)
# PC 전용: 화면(프레임)이 좁아도 입력창·미리보기를 좌우로 유지
B = rep(B, "@media screen and (max-width:900px){", "@media screen and (max-width:0px){", count=2)
B_b64 = base64.b64encode(B.encode("utf-8")).decode("ascii")

# ---------------- A (소방안전교육·훈련) + 통합 ----------------
s = A
s = rep(s, '<meta name="viewport" content="width=device-width, initial-scale=1.0" />\n',
        '<meta name="viewport" content="width=device-width, initial-scale=1.0" />\n'
        f'<meta http-equiv="Content-Security-Policy" content="{CSP}" />\n'
        '<meta name="referrer" content="no-referrer" />\n'
        '<meta name="robots" content="noindex, nofollow" />\n'
        '<meta name="color-scheme" content="only light" />\n'   # 브라우저 강제 다크모드 끄기(서식은 항상 흰 종이)
        '<meta name="darkreader-lock" />\n'                      # 다크 리더 확장 프로그램 끄기
        '<style>:root{ color-scheme: only light; }</style>\n'
        f'<script>\n{core}</script>\n')
s = rep(s, "</head>", f"<style>\n{css}</style>\n</head>")

s = rep(s, "<body>\n", "<body>\n" + lock_html)

s = rep(s,
        """<li><button class="gs-navlink" data-route="form/byeolji-3-1" onclick="location.hash='#form/byeolji-3-1'"><span class="gs-navicon">📝</span> 소방안전교육 및 훈련서류</button></li>\n""",
        """<li><button class="gs-navlink" data-route="form/byeolji-3-1" onclick="location.hash='#form/byeolji-3-1'"><span class="gs-navicon">📝</span> 소방안전교육 및 훈련서류</button></li>\n"""
        """    <li><button class="gs-navlink" data-route="hotwork" onclick="location.hash='#hotwork'"><span class="gs-navicon">🔥</span> 화기작업 신청서·허가서</button></li>\n""")
s = rep(s, '<div class="gs-footer">소방안전 교육 및 훈련 서류</div>\n',
        '<div class="gs-footer">소방안전 교육·훈련 · 화기작업 서류\n'
        '    <div class="gs-profile" id="gsProfile"></div>\n'
        '    <div class="gs-sec"><button type="button" data-wsec-settings>⚙️ 보안 설정</button><button type="button" data-wsec-lock>🔒 잠그기</button></div>\n'
        '  </div>\n')

# 앱 스크립트는 잠금 해제 후에 실행
app_marker = "<script>\n(function mergeB3(){"
s = rep(s, app_marker,
        '<!-- ============ 화기작업 신청서·허가서 (별지 7·8) ============ -->\n'
        '<div id="hotworkView" class="view-hidden"><iframe id="hotworkFrame" title="화기작업 신청서·허가서"></iframe></div>\n'
        f'<script type="application/octet-stream" id="woomiHotworkSrc">{B_b64}</script>\n'
        '<script type="text/x-woomi-app">\n(function mergeB3(){')
s = rep(s, "</script>\n<script>\n  /* ================= 화기작업 허가 캘린더",
        "</script>\n<script type=\"text/x-woomi-app\">\n  /* ================= 화기작업 허가 캘린더")

# 라우터: #hotwork 화면 추가
s = rep(s,
        """    if(hash !== "form/byeolji-3-1"){ hash = "form/byeolji-3-1"; history.replaceState(null,"","#"+hash); }\n""",
        """    if(hash !== "form/byeolji-3-1" && hash !== "hotwork"){ hash = "form/byeolji-3-1"; history.replaceState(null,"","#"+hash); }\n""")
s = rep(s,
        """    Object.values(FORM_VIEWS).forEach(viewId=>{\n      document.getElementById(viewId).classList.add("view-hidden");\n    });\n\n    if(hash.startsWith("form/")){""",
        """    Object.values(FORM_VIEWS).forEach(viewId=>{\n      document.getElementById(viewId).classList.add("view-hidden");\n    });\n"""
        """    const hotworkView = document.getElementById("hotworkView");\n"""
        """    hotworkView.classList.add("view-hidden");\n"""
        """    if(hash === "hotwork"){ hotworkView.classList.remove("view-hidden"); window.WoomiHotwork.show(); return; }\n\n"""
        """    if(hash.startsWith("form/")){""")
s = rep(s, """document.querySelectorAll("#globalSidebar .gs-navlink").forEach(el=>{""",
        """document.querySelectorAll("#globalSidebar .gs-navlink").forEach(el=>{""")

# IndexedDB 기록 암호화
s = rep(s, "  async function b3IdbGet(key){\n", "  async function b3IdbGet(key){ return WoomiSec.decVal(await b3IdbGetRaw(key)); }\n  function b3IdbSet(key, val){ return WoomiSec.trackIdb((async ()=> b3IdbSetRaw(key, await WoomiSec.encVal(val)))()); }\n  async function b3IdbGetRaw(key){\n")
s = rep(s, "  async function b3IdbSet(key, val){\n    const db", "  async function b3IdbSetRaw(key, val){\n    const db")

# 별지 3-1: 하루치 PDF도 적용 즉시 기록 저장
import importlib.util as _u
_sp = _u.spec_from_file_location("patch_b3a_ocr", HERE / "patch_b3a_ocr.py"); _m = _u.module_from_spec(_sp); _sp.loader.exec_module(_m)
for _o, _n in _m.PAIRS: s = rep(s, _o, _n)

s = rep(s, "</body>", f"<script>\n{ui}</script>\n</body>")

OUT.write_text(s, "utf-8")
print("ok", OUT, len(s.encode()) // 1024, "KB")
