# 보안 점검(2026-11-19 레드팀 보고서) 대응 — 앱 쪽
# 1) PDF·OCR·입력 글자를 화면에 넣을 때 HTML 로 해석되지 않게 이스케이프 (XSS)
#    (보안 코어의 HTML 정화가 항상 동작하도록 바꾼 것과 함께 이중 방어)
# 6) 교육일지 기록 목록을 다 불러오기 전에 저장하면 목록이 통째로 덮어써지던 문제(앱 시작 경쟁 상태)

ESC = '(s => String(s == null ? "" : s).replace(/[&<>"\']/g, c => ({ "&":"&amp;", "<":"&lt;", ">":"&gt;", \'"\':"&quot;", "\'":"&#39;" })[c]))'

PAIRS = [
    # --- XSS: 저장된 기록 목록의 장소·주요내용 ---
    ('    const place = data["b3a-place"] || "";',
     '    const place = ' + ESC + '(data["b3a-place"] || "");   // (WOOMI) 화면에 넣기 전에 글자로'),
    ('    const main = (data["b3a-main"]||"").trim().replace(/\\s+/g," ").slice(0, 24);',
     '    const main = ' + ESC + '((data["b3a-main"]||"").trim().replace(/\\s+/g," ").slice(0, 24));'),
    # --- XSS: 대시보드 업체명(명단 OCR에서 옴) ---
    ('orgNames.map(org => `<tr><td>${org}</td><td>${counts[org]}명</td></tr>`).join("")',
     'orgNames.map(org => `<tr><td>${' + ESC + '(org)}</td><td>${Number(counts[org]) || 0}명</td></tr>`).join("")'),
    # --- 기록 유실: 목록을 다 불러온 뒤에만 저장, 저장할 때는 그 시점의 전체 목록으로 ---
    ('  let b3aLogLoaded = false;',
     '  let b3aLogLoaded = false; var b3aLogReady = Promise.resolve();   // (WOOMI) 기록 목록을 다 불러왔는지'),
    ('    b3IdbGet("entries").then(async (v)=>{',
     '    b3aLogReady = b3IdbGet("entries").then(async (v)=>{'),
    ('    b3aSaveChain = b3aSaveChain.then(()=> b3IdbSet("entries", snapshot)).then(()=>{',
     '    b3aSaveChain = b3aSaveChain.then(()=> b3aLogReady).then(()=> b3IdbSet("entries", b3aLogLoaded ? JSON.parse(JSON.stringify(b3aLogEntries)) : snapshot)).then(()=>{   // (WOOMI) 불러오기 전 일부 목록으로 덮어쓰지 않게'),
]
