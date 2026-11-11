# 소방안전 교육·훈련(별지 3-1·3-2) 화면에도 화기작업·안전점검 화면과 같은 상단 바
# - 새로 작성 · 인쇄 · PDF · 새 기록 저장
# - 왼쪽 입력칸과 오른쪽 미리보기가 따로 스크롤, 탭은 위에 고정

B3TOP_CSS = """
  @media screen{
    /* 화면 id를 [id=...]로 씀: 그 id 글자가 들어간 규칙은 인쇄용 보관함에도 복사되기 때문 */
    .app[id="b3CombinedView"]:not(.view-hidden){ display:grid !important; grid-template-columns:minmax(340px, 420px) minmax(0, 1fr) !important; grid-template-rows:58px minmax(0, 1fr) !important; height:100vh; min-height:0 !important; align-items:stretch !important; }
    #b3Top{ grid-column:1 / -1; display:flex; align-items:center; gap:10px; padding:0 18px; background:linear-gradient(180deg,#1d2d52,#14213d); color:#fff; box-shadow:0 2px 10px rgba(0,0,0,.25); z-index:5; }
    #b3Top .b56-logo{ width:34px; height:34px; border-radius:10px; background:linear-gradient(135deg,#ff8a4c,#e2562b); display:flex; align-items:center; justify-content:center; font-size:17px; flex:none; }
    #b3Top .b56-brand b{ display:block; font-size:15.5px; letter-spacing:-.2px; }
    #b3Top .b56-brand span{ display:block; font-size:11.5px; color:#9fb0d6; margin-top:1px; }
    #b3Top .sp{ flex:1; }
    #b3Top .tb{ display:flex; align-items:center; gap:6px; border:1px solid rgba(255,255,255,.22); background:rgba(255,255,255,.07); color:#fff; padding:8px 12px; border-radius:9px; font:inherit; font-size:13px; cursor:pointer; white-space:nowrap; }
    #b3Top .tb:hover{ background:rgba(255,255,255,.16); }
    #b3Top .tb.pri{ background:#e2562b; border-color:#e2562b; font-weight:700; }
    #b3Top .tb:disabled{ opacity:.6; cursor:default; }
    #b3cPanel{ position:relative !important; top:auto !important; height:auto !important; max-height:none !important; min-height:0; overflow-y:auto !important; align-self:stretch !important; padding-top:0 !important; }
    #b3cPanel #b3aTabs{ position:sticky; top:0; z-index:4; background:#fff; margin:0 -22px 12px; padding:6px 22px 0; }
    #b3cPanel .b3-head-hidden{ display:none !important; }
    #b3cMain{ min-height:0; height:auto; overflow:auto; padding-top:22px; padding-bottom:48px; }
    #b3cMain > .preview-toolbar{ display:none !important; }
  }
  @media print{ #b3Top{ display:none !important; } }
"""

B3TOP_JS = r"""
  /* ---- 교육·훈련 화면 상단 바 (화기작업·안전점검 화면과 같은 모양) ---- */
  (function b3TopBar(){
    const view = document.getElementById("b3CombinedView"), panel = document.getElementById("b3cPanel");
    if(!view || !panel || document.getElementById("b3Top")) return;
    // 입력칸 맨 위 제목(별지 3-1 …)은 상단 바로 옮겼으니 숨김
    const tabs = document.getElementById("b3aTabs");
    if(tabs){ let e = tabs.previousElementSibling; while(e){ if(e.matches(".step-label, .step-title, .step-desc")) e.classList.add("b3-head-hidden"); e = e.previousElementSibling; } }
    const I = d => `<svg class="b56-i" viewBox="0 0 24 24">${d}</svg>`;
    const top = document.createElement("header"); top.id = "b3Top";
    top.innerHTML = `<div class="b56-logo">📝</div><div class="b56-brand"><b>소방안전 교육 및 훈련 서류</b><span>별지 3-1 결과 보고서 · 별지 3-2 이수자 명단 작성</span></div><div class="sp"></div>`
      + `<button class="tb" id="b3TopNew" type="button">${I('<path d="M12 5v14M5 12h14"/>')} 새로 작성</button>`
      + `<button class="tb" id="b3TopPrint" type="button">${I('<path d="M7 9V3h10v6M7 17H5a2 2 0 0 1-2-2v-4a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2v4a2 2 0 0 1-2 2h-2"/><rect x="7" y="14" width="10" height="7" rx="1"/>')} 인쇄</button>`
      + `<button class="tb" id="b3TopPdf" type="button">${I('<path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z"/><path d="M14 3v5h5M9 14h6M9 17h4"/>')} PDF</button>`
      + `<button class="tb pri" id="b3TopSave" type="button">${I('<path d="M5 3h11l4 4v13a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1z"/><path d="M8 3v5h7V3M8 21v-7h8v7"/>')} 새 기록 저장</button>`;
    view.insertBefore(top, view.firstChild);
    const click = id => { const b = document.getElementById(id); if(b) b.click(); };
    document.getElementById("b3TopNew").addEventListener("click", ()=> click("b3aNewLogBtn"));
    document.getElementById("b3TopPrint").addEventListener("click", ()=> click("b3aPrintBtn"));
    document.getElementById("b3TopSave").addEventListener("click", ()=> click("b3aSaveLogBtn"));
    document.getElementById("b3TopPdf").addEventListener("click", async (e)=>{
      const btn = e.currentTarget, main = document.getElementById("b3cMain");
      const all = [...main.querySelectorAll(".ch1-paper, .b3b-page")].filter(el => el.offsetHeight > 0 && getComputedStyle(el).display !== "none");
      const pages = all.filter(el => !all.some(o => o !== el && o.contains(el)));
      if(!pages.length) return;
      const old = btn.innerHTML; btn.disabled = true; btn.textContent = "⏳ PDF 만드는 중...";
      try{
        await b3EnsurePdfLibs();
        const { jsPDF } = window.jspdf; const pdf = new jsPDF({ orientation: "p", unit: "mm", format: "a4", compress: true });
        for(let k = 0; k < pages.length; k++){
          btn.textContent = `⏳ PDF ${k + 1}/${pages.length}쪽`;
          const cv = await window.html2canvas(pages[k], { scale: 2, backgroundColor: "#ffffff", useCORS: true, logging: false });
          if(k > 0) pdf.addPage();
          pdf.addImage(cv.toDataURL("image/jpeg", 0.92), "JPEG", 0, 0, 210, Math.min(297, cv.height / cv.width * 210), undefined, "FAST");
        }
        const d = (document.getElementById("b3a-date") || {}).value || "날짜없음";
        b3DownloadBlob(pdf.output("blob"), `소방안전교육훈련_별지3_${d}.pdf`);
      }catch(err){ console.error(err); alert("PDF 저장 중 문제가 생겼어요: " + (err && err.message || err)); }
      finally{ btn.disabled = false; btn.innerHTML = old; }
    });
  })();
"""

PAIRS = [
    ('<style>\n  /* 화면 미리보기도 인쇄와 똑같이: A4 한 장씩 따로, 같은 여백 */',
     '<style>' + B3TOP_CSS + '</style>\n<style>\n  /* 화면 미리보기도 인쇄와 똑같이: A4 한 장씩 따로, 같은 여백 */'),
    ('  load();\n  wireHomeCoverInputs();', B3TOP_JS + '  load();\n  wireHomeCoverInputs();'),
    # 체크한 기록 인쇄·PDF 순서: 날짜가 빠른 것부터 (빈 날짜는 맨 뒤)
    ('''      .sort((x, y)=> String(x.data["b3a-date"] || "").localeCompare(String(y.data["b3a-date"] || "")) || String(x.savedAt).localeCompare(String(y.savedAt)));''',
     '''      .sort((x, y)=> b3NormDate(x.data["b3a-date"]).localeCompare(b3NormDate(y.data["b3a-date"])) || String(x.savedAt).localeCompare(String(y.savedAt)));'''),
    ('  function b3SelectedEntries(){', '  function b3NormDate(v){ const m = String(v || "").match(/(\\d{4})\\D+(\\d{1,2})\\D+(\\d{1,2})/); return m ? m[1] + "-" + m[2].padStart(2, "0") + "-" + m[3].padStart(2, "0") : "9999-99-99"; }\n  function b3SelectedEntries(){'),
]
