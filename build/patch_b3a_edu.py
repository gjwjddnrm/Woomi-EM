# 교육일지(안전보건교육일지) PDF 읽기 보완
# 1) "관리자 첨부 사진대지"의 파란 제목 띠를 사진으로 잘못 잡던 문제: 쪽 맨 위 제목 영역·아주 납작한 띠는 사진에서 뺌
# 2) 공종명 칸이 두 줄로 꺾이거나 글자가 깨져 "철거작", "06하이바그…" 같은 가짜 업체가 생기던 문제
#    - "공종/업체" 형식인 칸에서 "/"가 없는 조각(줄바꿈으로 잘린 공종명)은 업체로 보지 않음
#    - 숫자가 섞이거나 한글이 너무 적은 이름은 버림
#    - 이름이 비슷한 업체(예: "…이테크알파"와 "하이테크알파")는 같은 업체로 합침
#    - 참석확인서 명단을 읽은 교육은 공종명 칸 업체를 따로 더하지 않음(명단 인원이 일지 인원 이상일 때)

PAIRS = [
    # 1) 사진: 제목 띠 빼기
    ('          const blobs = b3aOcrDetectPhotoBlobs(pageCanvas, { firstSectionIndividual: !!photoPageInfo[pageNo].first, allIndividual: true });',
     '          const blobs = b3aOcrDetectPhotoBlobs(pageCanvas, { firstSectionIndividual: !!photoPageInfo[pageNo].first, allIndividual: true })\n'
     '            .filter(b => b.canvas || !(b.y1 <= 0.115 || ((b.x1 - b.x0) * pageCanvas.width) / Math.max(1, (b.y1 - b.y0) * pageCanvas.height) > 7));   // (WOOMI) 쪽 맨 위 제목 띠·납작한 띠는 사진이 아님'),
    # 2) 공종명 칸 → 업체 이름
    ('''    raw.split(/[,，]/).map(x=>x.trim()).filter(Boolean).forEach(part=>{
      const seg = part.includes("/") ? part.split("/").pop() : part;''',
     '''    const parts = raw.split(/[,，]/).map(x=>x.trim()).filter(Boolean);
    const slashForm = parts.some(p => p.includes("/"));
    parts.forEach(part=>{
      if(slashForm && !part.includes("/")) return;   // (WOOMI) 줄바꿈으로 잘린 공종명 조각("철거작" 등)은 업체가 아님
      const seg = part.includes("/") ? part.split("/").pop() : part;'''),
    ('      if(name && !out.includes(name)) out.push(name);',
     '      const hk = name.replace(/[^가-힣]/g, "");\n'
     '      if(/\\d/.test(name) || hk.length < 2 || hk.length > 14) return;   // (WOOMI) 글자가 깨진 이름은 버림\n'
     '      if(name && !out.includes(name)) out.push(name);'),
    # 비슷한 업체 이름은 하나로
    ('    const findCo = (nk)=> nk ? companies.find(c => c.nk === nk || (nk.length >= 2 && c.nk.length >= 2 && (c.nk.includes(nk) || nk.includes(c.nk)))) : null;',
     '''    // (WOOMI) 겹치는 한글이 4자 이상(짧은 이름은 이름 길이-1)이면 같은 업체로 봄: "아아라이테크알파" ≈ "하이테크알파"
    const commonLen = (a, b)=>{ let best = 0; for(let i = 0; i < a.length; i++) for(let j = 0; j < b.length; j++){ let k = 0; while(a[i+k] && a[i+k] === b[j+k]) k++; if(k > best) best = k; } return best; };
    const similar = (a, b)=> a.length >= 2 && b.length >= 2 && (a.includes(b) || b.includes(a) || commonLen(a, b) >= Math.min(4, Math.min(a.length, b.length) - 1));
    const findCo = (nk)=> nk ? (companies.find(c => c.nk === nk) || companies.find(c => similar(c.nk, nk))) : null;'''),
    ('      if(!(r.roster.length && r.roster.every(q => q.exact))) r.companies.forEach(n => getCo(n));   // 글자로 읽은 명단이 있으면 공종칸(문자인식)은 쓰지 않음',
     '      const rosterN = r.roster.filter(q => (q.name || "").trim()).length;\n'
     '      if(!(r.roster.length && r.roster.every(q => q.exact)) && !(rosterN && rosterN >= (Number(r.cnt) || 0))) r.companies.forEach(n => getCo(n));   // 명단을 다 읽었으면 공종칸(문자인식)은 쓰지 않음'),
    # 3) 참석확인서 표 선이 연한 회색이면 칸을 못 찾아 고정 위치로 읽다가 어긋나던 문제: 더 연한 선까지 보고 다시 찾기
    ('      dark[p] = (0.299*data[i] + 0.587*data[i+1] + 0.114*data[i+2]) < 170 ? 1 : 0;',
     '      dark[p] = (0.299*data[i] + 0.587*data[i+1] + 0.114*data[i+2]) < (canvas.__gridThr || 170) ? 1 : 0;'),
    ('          let rawGrid = b3aOcrDetectGrid(rcanvas);',
     '          let rawGrid = b3aOcrDetectGrid(rcanvas);\n'
     '          {   // (WOOMI) 연한 회색 표 선: 더 연한 선까지 보며 칸이 가장 많이 잡히는 값을 고르고, 선이 빠져 두 줄이 붙은 행은 나눔\n'
     '            const okN = (g)=> g.filter(r => r.cells.length === 8 || r.cells.length === 6).length;\n'
     '            if(okN(rawGrid) < 20){\n'
     '              for(const thr of [200, 215, 230]){ rcanvas.__gridThr = thr; const g2 = b3aOcrDetectGrid(rcanvas); rcanvas.__gridThr = 0; if(okN(g2) > okN(rawGrid)) rawGrid = g2; if(okN(g2) >= 20) break; }   // 덜 연한 값부터(머리글 회색 바탕이 선으로 잡히지 않게)\n'
     '            }\n'
     '            const hs = rawGrid.slice(1).filter(r => r.cells.length === 8 || r.cells.length === 6).map(r => r.y1 - r.y0).sort((a, b)=> a - b);\n'
     '            const med = hs.length ? hs[Math.floor(hs.length / 2)] : 0;\n'
     '            if(med){\n'
     '              const out = [];\n'
     '              rawGrid.forEach((r, i)=>{\n'
     '                const k = r.y1 - r.y0, n = (k / med >= 2.7 && k / med <= 3.3 ? 3 : (k / med >= 1.8 && k / med <= 2.3 ? 2 : 1));\n'
     '                for(let j = 0; j < n; j++) out.push({ y0: r.y0 + k * j / n, y1: r.y0 + k * (j + 1) / n, cells: r.cells });\n'
     '              });\n'
     '              rawGrid = out;\n'
     '            }\n'
     '          }'),
]
