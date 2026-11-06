# 별지 3-1 PDF 사진 색 반전 문제:
# 원본에는 "어두운 바탕으로 저장된 PDF 쪽을 흰 바탕으로 뒤집는" 기능이 있는데,
# 사진이 빽빽한 쪽(관리자 첨부 사진대지 등)을 어두운 쪽으로 잘못 판단해서 사진 영역을 뒤집었고,
# 되돌리는 범위가 달라 일부 사진이 필름처럼 반전된 채 남았습니다.
# → 진짜 어두운 쪽은 바탕이 한 가지 색으로 고르게 넓으므로, 가장 흔한 밝기가 차지하는 비율이
#   충분히 클 때(바탕이 고를 때)만 뒤집도록 조건을 추가합니다.
PAIRS = [
    ("""      let bgv = 0, best = -1; for(let v = 0; v < 256; v++) if(hist[v] > best){ best = hist[v]; bgv = v; }
      const k = 255 / Math.max(20, 255 - bgv);""",
     """      let bgv = 0, best = -1; for(let v = 0; v < 256; v++) if(hist[v] > best){ best = hist[v]; bgv = v; }
      { let near = 0; for(let v = Math.max(0, bgv - 3); v <= Math.min(255, bgv + 3); v++) near += hist[v];
        if(near / Math.max(1, n) < 0.35) return false; }   // 바탕이 고르지 않음 = 사진이 많은 쪽 → 뒤집지 않음
      const k = 255 / Math.max(20, 255 - bgv);"""),
]
