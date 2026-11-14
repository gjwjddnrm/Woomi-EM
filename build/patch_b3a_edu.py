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
     '            .filter(b => !(kinds && kinds[pageNo] === "photo" && !b.canvas && b.y0 >= 0.455))   // (WOOMI) 사진대지 아래 "신분증,이수증" 칸은 개인정보라 가져오지 않음\n            .filter(b => b.canvas || !(b.y1 <= 0.115 || ((b.x1 - b.x0) * pageCanvas.width) / Math.max(1, (b.y1 - b.y0) * pageCanvas.height) > 7));   // (WOOMI) 쪽 맨 위 제목 띠·납작한 띠는 사진이 아님'),
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
    # 4) 사진대지가 없는 교육(예: 사진 없이 일지·참석확인서·문진표만 있는 날)에서 문진표의 "혈액형·수술여부" 칸을 사진으로 잡던 문제:
    #    쪽 종류(일지·교육내용·참석확인서 등)를 하나라도 알아본 교육이면 "사진대지 없음 = 사진 없음"으로 보고, 앞쪽을 훑지 않음
    ('        else for(let pn = P0 + 1; pn <= Math.min(P1, P0 + 3); pn++){ photoPages.push(pn); photoPageInfo[pn] = { first: pn === P0 + 1 }; }',
     '        else if(![...Array(Math.max(0, P1 - P0)).keys()].some(i => kinds && kinds[P0 + 1 + i] && kinds[P0 + 1 + i] !== "other"))   // (WOOMI) 예전 스캔본(쪽 종류를 하나도 못 알아봄)일 때만\n'
     '          for(let pn = P0 + 1; pn <= Math.min(P1, P0 + 3); pn++){ photoPages.push(pn); photoPageInfo[pn] = { first: pn === P0 + 1 }; }'),
    # 5) 사진대지가 없어 사진을 못 넣은 날은 "인식 실패"처럼 보이지 않게 안내 문구 표시
    ('        for(const pageNo of photoPages){',
     '        var __woomiNoPhotoPage = photoPages.length === 0;   // (WOOMI) 이 교육에는 사진대지 쪽이 없음\n'
     '        for(const pageNo of photoPages){'),
    ('      gubun: detectedGubun, photos, roster,',
     '      gubun: detectedGubun, photos, roster, noPhotoPage: typeof __woomiNoPhotoPage !== "undefined" ? __woomiNoPhotoPage : false,'),
    ('      names: [...new Set(results.map(r => r.name))], gubun,',
     '      names: [...new Set(results.map(r => r.name))], gubun, noPhoto: !photos.length && results.every(r => r.noPhotoPage),'),
    ('<option value="${i}">${esc3a(d.date || "날짜 미확인")} · 이수자 ${d.rosterRows.length}명 · 사진 ${d.photos.length}장</option>',
     '<option value="${i}">${esc3a(d.date || "날짜 미확인")} · 이수자 ${d.rosterRows.length}명 · ${d.noPhoto ? "사진 없음(관리자 첨부 사진 없음)" : "사진 " + d.photos.length + "장"}</option>'),
    ('      <input type="hidden" id="b3a-workers" />',
     '      <input type="hidden" id="b3a-workers" />\n      <input type="hidden" id="b3a-photo-note" />'),
    ('    "b3a-time-start","b3a-time-end","b3a-workers",',
     '    "b3a-time-start","b3a-time-end","b3a-workers","b3a-photo-note",'),
    ('      const all = b3aOcrSelected.slice();',
     '      { const dd = b3aOcrDays && b3aOcrDays[b3aOcrDayIdx]; const pn = document.getElementById("b3a-photo-note"); if(pn) pn.value = (dd && dd.noPhoto) ? "PDF에 관리자 첨부 사진대지가 없어 첨부할 사진이 없어요" : ""; }   // (WOOMI)\n'
     '      const all = b3aOcrSelected.slice();'),
    ('      : `<div class="photo-box"><span class="photo-placeholder">사진 ${n} 첨부란</span></div>`;',
     '      : (n === 1 && !all.length && (document.getElementById("b3a-photo-note") || {}).value\n'
     '        ? `<div class="photo-box b3a-nophoto"><span class="photo-placeholder">📷 사진 없음<br><small>${esc3a(document.getElementById("b3a-photo-note").value)}</small></span></div>`\n'
     '        : `<div class="photo-box"><span class="photo-placeholder">사진 ${n} 첨부란</span></div>`);'),
    # 6) "날짜 미입력" 원인 표시 + 가능하면 사진대지·참석확인서 맨 위 날짜로 채우기
    ('  async function b3aOcrProcessSession(pdf, file, fileIdx, total, P0, P1, sIdx, sTotal, kinds){',
     """  // (WOOMI) 교육일지 날짜를 못 읽은 묶음: 사진대지("교육일자: …")·참석확인서("2026 년 10 월 31 일") 맨 위에서 날짜 찾기
  async function b3aOcrFindSessionDate(pdf, P0, P1, kinds){
    const label = (k)=> k === "roster" ? "참석확인서" : k === "admin" ? "관리자 첨부 사진대지" : "사진대지";
    for(let pn = P0; pn <= P1; pn++){
      const k = kinds && kinds[pn]; if(!/^(photo|admin|roster)$/.test(k || "")) continue;
      const m = kinds.meta && kinds.meta[pn]; if(m && m.date) return { date: m.date, from: label(k), page: pn };
    }
    for(let pn = P0; pn <= P1; pn++){
      const k = kinds && kinds[pn]; if(!/^(photo|admin|roster)$/.test(k || "")) continue;
      try{
        const tc = await (await pdf.getPage(pn)).getTextContent();
        const d0 = b3aOcrParseDate(tc.items.map(i => i.str).join(" ").slice(0, 400));
        if(d0) return { date: d0, from: label(k), page: pn };
      }catch(e){}
      try{
        await b3aOcrEnsureWorker();
        const page = await pdf.getPage(pn), vp0 = page.getViewport({ scale: 1 }), vp = page.getViewport({ scale: Math.min(2.5, 1600 / vp0.width) });
        const c = document.createElement("canvas"); c.width = vp.width; c.height = vp.height;
        await page.render({ canvasContext: c.getContext("2d"), viewport: vp }).promise; b3aOcrNormalizeDark(c);
        const x0 = Math.round(c.width * 0.55), y0 = Math.round(c.height * 0.05), w = c.width - x0, h = Math.round(c.height * 0.08);
        const t = document.createElement("canvas"); t.width = w; t.height = h; t.getContext("2d").drawImage(c, x0, y0, w, h, 0, 0, w, h);
        await b3aOcrWorker.setParameters({ tessedit_pageseg_mode: "6" });
        const txt = await b3aOcrRecognizeCanvas(b3aOcrPad(t));
        await b3aOcrWorker.setParameters({ tessedit_pageseg_mode: "7" });
        const mm = String(txt || "").replace(/\\s+/g, "").match(/(20\\d{2})\\D{0,2}(\\d{1,2})\\D{0,2}(\\d{1,2})/);
        if(mm && +mm[2] >= 1 && +mm[2] <= 12 && +mm[3] >= 1 && +mm[3] <= 31) return { date: `${mm[1]}-${mm[2].padStart(2, "0")}-${mm[3].padStart(2, "0")}`, from: label(k), page: pn };
      }catch(e){ console.warn("묶음 날짜 찾기 실패", pn, e); }
    }
    return null;
  }
  async function b3aOcrProcessSession(pdf, file, fileIdx, total, P0, P1, sIdx, sTotal, kinds){"""),
    ("""    const trade = b3aOcrSanitize(fields.trade);
    return {
      name: file.name,
      date: b3aOcrParseDate(fields.date), time: b3aOcrParseTime(fields.time),
      cnt: b3aOcrParseCount(fields.targetCnt),
      place: b3aOcrCleanText(b3aOcrSanitize(fields.place)),
      tradeRaw: trade, companies: b3aOcrTradeCompanies(trade),""",
     """    // (WOOMI) 교육일지 첫 장이 없는 묶음이면 일지 칸(장소·인원·공종)은 엉뚱한 쪽을 읽은 것이라 비움
    const __noLog = !!(kinds && /^(photo|admin|roster)$/.test(kinds[P0] || ""));
    const trade = __noLog ? "" : b3aOcrSanitize(fields.trade);
    let __date = __noLog ? "" : b3aOcrParseDate(fields.date || ""), __dateNote = "";
    if(!__date){
      __dateNote = __noLog ? `PDF ${P0}~${P1}쪽 묶음에 교육일지 첫 장(안전보건교육일지)이 없어요` : `교육일지(${P0}쪽)의 교육일자 칸을 읽지 못했어요`;
      try{ const fd = await b3aOcrFindSessionDate(pdf, P0, P1, kinds); if(fd){ __date = fd.date; __dateNote += ` → ${fd.from}(${fd.page}쪽)의 날짜로 넣었어요`; } }catch(e){}
    }
    return {
      name: file.name, dateNote: __dateNote,
      date: __date, time: b3aOcrParseTime(fields.time || ""),
      cnt: __noLog ? "" : b3aOcrParseCount(fields.targetCnt),
      place: __noLog ? "" : b3aOcrCleanText(b3aOcrSanitize(fields.place)),
      tradeRaw: trade, companies: b3aOcrTradeCompanies(trade),"""),
    ('      names: [...new Set(results.map(r => r.name))], gubun, noPhoto:',
     '      names: [...new Set(results.map(r => r.name))], gubun, dateNote: [...new Set(results.map(r => r.dateNote).filter(Boolean))].join(" / "), noPhoto:'),
    ('<option value="${i}">${esc3a(d.date || "날짜 미확인")} · ',
     '<option value="${i}">${esc3a(d.date || "날짜 미확인")}${d.dateNote ? " ⚠️" : ""} · '),
    ('    b3aOcrDayIdx = i;',
     """    b3aOcrDayIdx = i;
    {   // (WOOMI) 날짜를 못 읽었거나 다른 쪽에서 가져왔으면 이유 표시
      const sel = document.getElementById("b3a-ocr-day-sel"); let nt = document.getElementById("b3a-ocr-date-note");
      if(!nt && sel){ nt = document.createElement("p"); nt.id = "b3a-ocr-date-note"; nt.className = "save-note"; nt.style.cssText = "margin:6px 0 0;border-color:#f0c36d;background:#fff8e6;color:#7a5200"; sel.parentNode.insertBefore(nt, sel.nextSibling); }
      if(nt){ nt.textContent = d.dateNote ? "⚠️ 날짜: " + d.dateNote + (d.date ? "" : " 날짜를 직접 입력해 주세요.") : ""; nt.style.display = d.dateNote ? "" : "none"; }
    }"""),
    ('      <input type="hidden" id="b3a-photo-note" />',
     '      <input type="hidden" id="b3a-photo-note" />\n      <input type="hidden" id="b3a-date-note" />'),
    ('"b3a-workers","b3a-photo-note",', '"b3a-workers","b3a-photo-note","b3a-date-note",'),
    ('if(pn) pn.value = (dd && dd.noPhoto) ?',
     'const dn = document.getElementById("b3a-date-note"); if(dn) dn.value = (dd && !dd.date && dd.dateNote) ? dd.dateNote : ""; if(pn) pn.value = (dd && dd.noPhoto) ?'),
    ('        const label = [date || "날짜 미입력", place].filter(Boolean).join(" · ");',
     '        const label = [date || ("날짜 미입력" + (entry.data && entry.data["b3a-date-note"] ? " ⚠️ " + String(entry.data["b3a-date-note"]).replace(/[<>&]/g, "") : "")), place].filter(Boolean).join(" · ");'),
    # 7) PDF 맨 앞이 교육일지가 아닌 쪽(다른 교육의 사진대지·참석확인서 등)이면, 첫 교육일지를 1쪽으로 바꿔 써서
    #    앞쪽 묶음과 다음 교육이 합쳐지던 문제(→ "날짜 미입력", 명단 섞임): 1쪽 묶음을 따로 앞에 둠
    ('    if(!starts.length) starts.push(1);\n    starts[0] = 1;',
     '    if(!starts.length) starts.push(1);\n    if(starts[0] !== 1) starts.unshift(1);   // (WOOMI) 첫 교육일지를 덮어쓰지 않음'),
    # 8) 교육일지 첫 장이 없는 묶음은 1쪽(사진대지)부터 사진을 찾고, 일지 날짜와 비교하지 않음
    ('        for(let pn = P0 + 1; pn <= P1; pn++){',
     '        for(let pn = (kinds && /^(photo|admin|roster)$/.test(kinds[P0] || "")) ? P0 : P0 + 1; pn <= P1; pn++){   // (WOOMI)'),
    ('          const sdate = b3aOcrParseDate(fields.date);',
     '          const sdate = (kinds && /^(photo|admin|roster)$/.test(kinds[P0] || "")) ? "" : b3aOcrParseDate(fields.date || "");   // (WOOMI)'),
    # 9) PDF를 읽고 나서 "확인이 필요한 곳"을 한곳에 모아 보여 줌 (검토 화면 · 저장된 기록 · 직접 작성 탭)
    ('    const gubun = [...new Set(results.flatMap(r => r.gubun))];',
     """    const gubun = [...new Set(results.flatMap(r => r.gubun))];
    // (WOOMI) 확인이 필요한 곳
    const warns = [];
    results.forEach(r => { if(r.dateNote) warns.push("날짜: " + r.dateNote + (r.date ? "" : " — 날짜를 직접 입력해 주세요.")); });
    results.forEach(r => { if(!(r.roster || []).some(q => (q.name || "").trim())) warns.push(`명단: 교육일지${r.cnt ? "(근로자수 " + r.cnt + "명)" : ""}${r.time ? " " + r.time : ""}에 맞는 참석확인서 명단을 찾지 못했어요 — 별지 3-2 명단을 직접 확인해 주세요.`); });
    const logCnt = results.reduce((a, r)=> a + (Number(r.cnt) || 0), 0);
    if(logCnt && rosterRows.length && logCnt !== rosterRows.length) warns.push(`인원: 교육일지 근로자수 합계 ${logCnt}명인데 참석확인서 명단은 ${rosterRows.length}명이에요.`);
    const odd = rosterRows.filter(p => { const n = String(p.name || "").trim(), k = n.replace(/\\s/g, ""); return /[0-9~!@#$%^&*_=+\\[\\]{}|\\\\;:"<>?\\/]/.test(n) || k.length < 2 || (/^[가-힣]+$/.test(k) && k.length > 5); });
    if(odd.length) warns.push("이름: " + odd.map(p => `"${p.name}"`).join(", ") + " — 글자가 이상하게 읽혔을 수 있어요.");
    const noSig = rosterRows.filter(p => !p.sig);
    if(noSig.length) warns.push("서명: " + noSig.map(p => p.name).join(", ") + " — 서명을 찾지 못했어요.");
    if(!photos.length && results.every(r => r.noPhotoPage)) warns.push("사진: PDF에 관리자 첨부 사진대지가 없어 사진을 넣지 않았어요 — 필요하면 직접 넣어 주세요.");
    if(/확인필요/.test(tradeText)) warns.push("업체: 대상공종에 \\"(확인필요)\\"로 표시된 업체가 있어요 — 인원을 확인해 주세요.");"""),
    ('      names: [...new Set(results.map(r => r.name))], gubun, dateNote:',
     '      names: [...new Set(results.map(r => r.name))], gubun, warns, dateNote:'),
    ('${d.dateNote ? " ⚠️" : ""} · ',
     '${(d.warns || []).length ? " ⚠️" + d.warns.length : ""} · '),
    ('      if(nt){ nt.textContent = d.dateNote ? "⚠️ 날짜: " + d.dateNote + (d.date ? "" : " 날짜를 직접 입력해 주세요.") : ""; nt.style.display = d.dateNote ? "" : "none"; }',
     '      const ws = (d.warns || []).slice();\n'
     '      if(nt){ const wn = (d.warns || []).length; nt.innerHTML = ws.length ? "<details><summary style=cursor:pointer;font-weight:700>" + (wn ? "⚠️ 확인할 곳 " + wn + "건" : "✅ 확인할 곳 없음") + " <span style=font-weight:400>(저장하면 기록 목록에 표시돼요 · 눌러서 보기)</span></summary>" + ws.map(w => "· " + esc3a(w)).join("<br>") + "</details>" : "<b>✅ 확인할 곳 없음</b>"; nt.style.display = ""; nt.style.background = wn ? "#fff8e6" : "#eefaf1"; nt.style.color = wn ? "#7a5200" : "#1f6b3a"; }'),
    # 저장할 때 기록에 함께 보관
    ('      <input type="hidden" id="b3a-date-note" />',
     '      <input type="hidden" id="b3a-date-note" />\n      <input type="hidden" id="b3a-check-note" />'),
    ('"b3a-photo-note","b3a-date-note",', '"b3a-photo-note","b3a-date-note","b3a-check-note",'),
    ('const dn = document.getElementById("b3a-date-note");',
     'const cn = document.getElementById("b3a-check-note"); if(cn) cn.value = (dd && dd.warns && dd.warns.length) ? dd.warns.join("\\n") : ""; setTimeout(()=>{ try{ b3aShowCheckBox(); }catch(e){} }, 0); const dn = document.getElementById("b3a-date-note");'),
    # 저장된 기록 목록에 ⚠️ 표시
    ('        const label = [date || ("날짜 미입력"',
     '        const __cw = String((entry.data && entry.data["b3a-check-note"]) || "").split("\\n").filter(Boolean).length;\n'
     '        const label = (__cw ? "⚠️" + __cw + " " : "") + [date || ("날짜 미입력"'),
    # 직접 작성 탭 맨 위: 확인할 곳 목록 + "확인했어요" 버튼
    ('    <div class="b3a-pane" id="b3aPane2">',
     '    <div class="b3a-pane" id="b3aPane2">\n'
     '    <div id="b3a-check-box" class="save-note" style="display:none;margin:0 0 12px;background:#fff8e6;color:#7a5200;border-color:#f0c36d"></div>'),
    ('    const editingNote = document.getElementById("b3a-editing-note");',
     '    setTimeout(()=>{ try{ b3aShowCheckBox(); }catch(e){} }, 0);   // (WOOMI) 기록을 열거나 저장하면 확인할 곳 상자도 다시\n    const editingNote = document.getElementById("b3a-editing-note");'),
    ('  async function b3aOcrFindSessionDate(pdf, P0, P1, kinds){',
     """  // (WOOMI) 직접 작성 탭 맨 위: PDF에서 읽을 때 확인이 필요했던 곳
  function b3aShowCheckBox(){
    const box = document.getElementById("b3a-check-box"), f = document.getElementById("b3a-check-note"); if(!box || !f) return;
    const ws = String(f.value || "").split("\\n").filter(Boolean);
    if(!ws.length){ box.style.display = "none"; box.innerHTML = ""; return; }
    box.innerHTML = "<b>⚠️ PDF에서 읽을 때 확인이 필요했던 곳 " + ws.length + "건</b><br>" + ws.map(w => "· " + esc3a(w)).join("<br>")
      + '<div style="margin-top:8px"><button type="button" class="reset-btn" id="b3a-check-done" style="width:auto;padding:6px 12px">✔ 확인했어요 (표시 지우기)</button></div>';
    box.style.display = "";
    document.getElementById("b3a-check-done").onclick = ()=>{ f.value = ""; b3aShowCheckBox(); try{ saveB3a(); }catch(e){} alert('표시를 지웠어요. 저장된 기록에도 반영하려면 "새 기록으로 저장"을 눌러 주세요.'); };
  }
  async function b3aOcrFindSessionDate(pdf, P0, P1, kinds){"""),
    # 10) 저장된 기록 목록에서 문제점을 바로 보이게 (항목마다 짧게, 전체 문장은 마우스를 올리면)
    ('            <div class="b3a-log-item-snip">${main || "(주요내용 없음)"}</div>',
     '            <div class="b3a-log-item-snip">${main || "(주요내용 없음)"}</div>\n'
     '            ${String((entry.data && entry.data["b3a-check-note"]) || "").split("\\n").filter(Boolean).map(w => { const t = String(w).replace(/[<>&"]/g, ""); const short = t.replace(/\\s*—.*$/, "").replace(/\\s*→.*$/, ""); return `<div class="b3a-log-warn" title="${t}">⚠️ ${short}</div>`; }).join("")}'),
    ('  .b3a-log-item-main{ flex:1; min-width:0; cursor:pointer; }',
     '  .b3a-log-item-main{ flex:1; min-width:0; cursor:pointer; }\n'
     '  .b3a-log-warn{ margin-top:3px; padding:3px 6px; border-radius:5px; background:#fff4dc; color:#8a5a00; font-size:11.5px; line-height:1.4; white-space:normal; word-break:keep-all; }'),
    # 11) 관리자 첨부 사진(교육 전경)이 없어 사진대지의 개인 교육사진을 넣었으면 알려 줌
    ('        const adminList = Object.keys(adminPage).filter(k => adminPage[k]).map(Number);',
     '        const adminList = Object.keys(adminPage).filter(k => adminPage[k]).map(Number);\n        var __woomiAdminPhotos = adminList.length > 0;   // (WOOMI)'),
    ('noPhotoPage: typeof __woomiNoPhotoPage !== "undefined" ? __woomiNoPhotoPage : false,',
     'noPhotoPage: typeof __woomiNoPhotoPage !== "undefined" ? __woomiNoPhotoPage : false, adminPhotos: typeof __woomiAdminPhotos !== "undefined" ? __woomiAdminPhotos : false,'),
    ('    if(!photos.length && results.every(r => r.noPhotoPage)) warns.push(',
     '    if(photos.length && !results.some(r => r.adminPhotos)) warns.push("사진: 관리자 첨부 사진(교육 전경)이 없어 사진대지의 개인 교육사진을 넣었어요 — 맞는지 확인해 주세요.");\n'
     '    if(!photos.length && results.every(r => r.noPhotoPage)) warns.push('),
    # 12) 사진은 "관리자 첨부 사진대지"에서만 가져옴 (일반 사진대지의 개인 사진·신분증·이수증은 가져오지 않음)
    ('        else if(anyTitle) Object.keys(photoPageInfo).forEach(k => photoPages.push(Number(k)));',
     '        else if(false && anyTitle) Object.keys(photoPageInfo).forEach(k => photoPages.push(Number(k)));   // (WOOMI) 관리자 첨부 사진이 아니면 가져오지 않음'),
]
