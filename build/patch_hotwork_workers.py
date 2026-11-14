# 화기작업: 안전작업허가서 PDF의 "작업자 : 정지훈, 백승일, 정종님" 줄과
# "화기작업자 정종님 연락처 : 010-…" 줄을 읽어 신청서·허가서의 작업자 명단 / 화기작업자에 넣음
# (예전에는 이 줄을 읽지 않아 작업자 명단이 비어 있었고, 작업내용 뒤에 붙을 수도 있었음)

PAIRS = [
    # 작업내용은 "작업자 :" / "화기작업자" 줄 앞에서 멈춤
    ('  const stop = /작업구역설정|차량 등의|소화설비|비산불티|가스농도|밸브파단|추가유해위험요인|화재감시자\\s*:|전화번호\\s*:/;',
     '  const stop = /작업구역설정|차량 등의|소화설비|비산불티|가스농도|밸브파단|추가유해위험요인|화재감시자\\s*:|전화번호\\s*:|^\\s*작업자\\s*:|화기작업자/;'),
    ('  r.watcher = g(/화재감시자\\s*:\\s*(.+)/, blk.find(l => /화재감시자\\s*:/.test(l)) || "");',
     '  r.watcher = g(/화재감시자\\s*:\\s*(.+)/, blk.find(l => /화재감시자\\s*:/.test(l)) || "");\n'
     '  {   // (WOOMI) 작업자 명단 · 화기작업자\n'
     '    const wl = blk.find(l => /(^|[^기])작업자\\s*:/.test(l) && !/화기작업자/.test(l)) || "";\n'
     '    r.workers = wl.replace(/^.*?작업자\\s*:\\s*/, "").split(/[,，、\\/]|\\s{2,}/).map(x => x.trim()).filter(x => x && /[가-힣A-Za-z]/.test(x)).join(", ");\n'
     '    const hl = blk.find(l => /화기작업자/.test(l)) || "";\n'
     '    const hm = /화기작업자\\s*:?\\s*([가-힣A-Za-z]{2,10})/.exec(hl); r.hotWorkerName = hm && !/연락처/.test(hm[1]) ? hm[1] : "";\n'
     '    const pm2 = /연락처\\s*:?\\s*([\\d-]{9,})/.exec(hl); r.hotWorkerPhone = pm2 ? pm2[1] : "";\n'
     '  }'),
    # 저장할 때 신청서에 넣기 (화기작업자는 PDF에 적힌 사람, 없으면 예전처럼 업체 담당자)
    ('    d.company = r.company; d.leader = r.leader; d.hotWorker = r.leader;',
     '    d.company = r.company; d.leader = r.leader; d.hotWorker = r.hotWorkerName || r.leader;\n'
     '    if(r.workers) d.workers = r.workers;   // (WOOMI) 작업자 명단'),
    # 별지 7 신청인: "현장책임자" → "작업책임자", 초기대응체계 표에 "작업책임자" 줄이 있으면 그 사람(이름·연락처)으로
    ('const ROLES = ["현장책임자", "비상연락", "초기소화", "피난유도", "화재감시자", "화기작업자"];',
     'const ROLES = ["현장책임자", "비상연락", "초기소화", "피난유도", "화재감시자", "화기작업자", "작업책임자"];   // (WOOMI) 작업책임자 줄 추가'),
    ('    for(let i = 0; i <= 7; i++) hl.push(my + (c.height - 2 * my) * i / 7); for(let i = 0; i <= 4; i++) vl.push(mx + (c.width - 2 * mx) * i / 4);',
     '    { const NR = ROLES.length + 1; for(let i = 0; i <= NR; i++) hl.push(my + (c.height - 2 * my) * i / NR); } for(let i = 0; i <= 4; i++) vl.push(mx + (c.width - 2 * mx) * i / 4);'),
    ('  if(!crew) return; const R = crew.roles;',
     '  if(!crew) return; const R = crew.roles;\n'
     '  { const L = R["작업책임자"]; if(L && L.name){ d.leader = L.name; if(L.tel) d.phone = L.tel; } }   // (WOOMI) 신청인 = 작업책임자'),
    ('<td>현장책임자 : ${V(d.boss || d.leader)}</td>',
     '<td>작업책임자 : ${V(d.leader || d.boss)}</td>'),
    # 작업일시: 기간 전체 한 장 / 하루씩 나눠서
    (' 체크한 항목을 신청서 기록으로 저장</button></div>',
     ' 체크한 항목을 신청서 기록으로 저장</button></div>\n'
     '    <div class="row" id="impSplitRow" style="margin:6px 0 0;align-items:center;gap:8px"><label style="font-size:12.5px;font-weight:600;white-space:nowrap">작업일시</label>'
     '<select id="impSplit" style="flex:1;padding:7px 8px;border:1px solid #cfd6e5;border-radius:8px;font:inherit;font-size:13px"><option value="week">기간 전체를 한 장으로 (예: 11/16 ~ 11/21)</option><option value="day">하루씩 나눠서 날짜마다 한 장</option></select></div>'),
    ('  const taken = [];\n  sel2.forEach(r => {',
     '''  const taken = [];
  // (WOOMI) "하루씩 나눠서"면 작업 기간을 날짜마다 따로 신청서로 (허가일자·허가번호도 그 날짜로)
  const __split = (document.getElementById("impSplit") || {}).value === "day", __list = [];
  sel2.forEach(r => { const ds = __hwDays(r.workDate, r.workDateEnd); if(__split && ds.length > 1) ds.forEach(day => __list.push(Object.assign({}, r, { workDate: day, workDateEnd: "", srcDate: day.replace(/-/g, "") }))); else __list.push(r); });
  __list.forEach(r => {'''),
    # 이미 저장한 기간 기록도 하루씩 나누기
    ('<input type="date" data-k="workDateEnd"></div></div>',
     '<input type="date" data-k="workDateEnd"></div></div>\n'
     '    <div class="row" style="margin-top:2px"><button class="btn sm" id="splitDays" type="button">📅 이 기간을 하루씩 나눠서 따로 저장</button></div>'),
    ('$("#saveNew").onclick = ()=>{',
     '''// (WOOMI) 작업 기간 → 날짜 목록
function __hwDays(a, b){
  if(!a) return [];
  if(!b || b <= a) return [a];
  const out = [], d = new Date(a + "T00:00:00Z"), e = new Date(b + "T00:00:00Z");
  for(let i = 0; d <= e && i < 62; i++){ out.push(d.toISOString().slice(0, 10)); d.setUTCDate(d.getUTCDate() + 1); }
  return out;
}
$("#splitDays").onclick = ()=>{
  const days = __hwDays(cur.workDate, cur.workDateEnd);
  if(days.length < 2){ alert("작업일(시작일)과 종료일이 여러 날에 걸쳐 있을 때만 나눌 수 있어요."); return; }
  if(!confirm(`${days[0]} ~ ${days[days.length - 1]} (${days.length}일)을 날짜마다 따로 신청서로 저장할까요?\\n허가일자·허가번호도 날짜마다 새로 매겨져요.`)) return;
  const taken = [];
  days.forEach(day => {
    const d = JSON.parse(JSON.stringify(cur));
    d.workDate = day; d.workDateEnd = ""; d.permitDate = day; d.permitNo = nextPermitNo(day, taken); taken.push(d.permitNo);
    entries.push({ id: "h" + Date.now() + Math.random().toString(36).slice(2, 6), savedAt: new Date().toISOString(), data: d });
  });
  const old = editingId && entries.find(x => x.id === editingId);
  if(old && confirm("원래 기간(한 장짜리) 기록은 지울까요?\\n(취소하면 그대로 남겨 둬요)")){ entries = entries.filter(x => x !== old); editingId = null; }
  persist(); renderLog(); status(`✅ ${days.length}일치로 나눠 저장했어요.`);
};
$("#saveNew").onclick = ()=>{'''),
]
