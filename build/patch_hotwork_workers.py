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
]
