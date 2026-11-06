# 별지 8 허가서: 허가일자가 두 줄로 나뉘던 문제 → 칸 비율 조정(33/30/37 → 30/38/32) + 한 줄 고정
PAIRS = [
    ('<td style="width:33%">허가번호 : ${V(d.permitNo)}</td><td style="width:30%">허가일자 : ${V(fmtDate(d.permitDate))}</td>',
     '<td style="width:30%;white-space:nowrap">허가번호 : ${V(d.permitNo)}</td><td style="width:38%;white-space:nowrap">허가일자 : ${V(fmtDate(d.permitDate))}</td>'),
    # 별지 8 소방안전관리자 칸: 이름은 칸 정가운데, "(서명)"은 오른쪽 끝에 따로 두어 서명이 이름과 겹치지 않게 함
    ('<div class="rt" style="font-size:9pt;margin-top:.8mm">${V(d.safetyMgr || defMgr())} ${SG(d, "sigMgr", "(서명)", 5)}</div>',
     '<div style="font-size:9pt;margin-top:.8mm;position:relative;text-align:center">${V(d.safetyMgr || defMgr())}<span style="position:absolute;right:0;top:0">${SG(d, "sigMgr", "(서명)", 5, 12)}</span></div>'),
]
