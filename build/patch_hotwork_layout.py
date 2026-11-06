# 별지 8 허가서: 허가일자가 두 줄로 나뉘던 문제 → 칸 비율 조정(33/30/37 → 30/38/32) + 한 줄 고정
PAIRS = [
    ('<td style="width:33%">허가번호 : ${V(d.permitNo)}</td><td style="width:30%">허가일자 : ${V(fmtDate(d.permitDate))}</td>',
     '<td style="width:30%;white-space:nowrap">허가번호 : ${V(d.permitNo)}</td><td style="width:38%;white-space:nowrap">허가일자 : ${V(fmtDate(d.permitDate))}</td>'),
]
