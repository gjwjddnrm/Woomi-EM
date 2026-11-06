# 화기작업 화면 개선
# 1) "신청서 입력"·"허가서 입력" 탭 아래쪽에도 저장 버튼 + 저장 결과 표시 (원래는 맨 위 머리글에만 있었음)
# 2) 허가번호 YY-MM-DD-NNN: 번호(NNN)를 날짜와 상관없이 이어서 매김
#    (저장된 기록 중 가장 큰 번호 + 1, 직접 9로 고쳐 저장하면 다음은 010)
#    허가일자를 고르면 허가번호가 비어 있을 때 자동으로 채우고, 이미 번호가 있으면 날짜 부분만 바꿈

SAVEBAR_CSS = """
.savebar{ position:sticky; bottom:-40px; z-index:3; margin:14px -14px 0; padding:10px 14px 12px; background:rgba(255,255,255,.96); border-top:1px solid var(--line); box-shadow:0 -4px 12px rgba(14,26,51,.06); }
.savebar .row{ margin:0; gap:8px; }
.savebar .btn{ flex:1; justify-content:center; white-space:nowrap; }
.savebar .sbmsg{ margin:6px 0 0; font-size:12px; color:var(--ok); min-height:16px; }
.savebar .sbmsg.dirty{ color:#b45309; }
"""

SAVEBAR_JS = r"""
<script>
/* ---- WOOMI: 입력 탭 아래 저장 버튼 ---- */
(function(){
  let dirty = false;
  function bar(){
    const d = document.createElement("div"); d.className = "savebar";
    d.innerHTML = '<div class="row"><button class="btn primary" type="button" data-sb="save">💾 저장</button><button class="btn" type="button" data-sb="new">➕ 새 기록으로 저장</button></div><p class="sbmsg"></p>';
    return d;
  }
  ["t2", "t3"].forEach(id => { const p = document.getElementById(id); if(p) p.appendChild(bar()); });
  window.refreshSaveBars = function(msg){
    document.querySelectorAll(".savebar").forEach(b => {
      const save = b.querySelector('[data-sb="save"]'), nw = b.querySelector('[data-sb="new"]'), m = b.querySelector(".sbmsg");
      save.textContent = editingId ? "💾 수정 저장 (덮어쓰기)" : "💾 새 기록으로 저장";
      nw.style.display = editingId ? "" : "none";
      if(msg != null){ m.textContent = msg; m.classList.remove("dirty"); }
      else if(dirty){ m.textContent = "● 저장하지 않은 변경 내용이 있어요"; m.classList.add("dirty"); }
    });
  };
  document.addEventListener("click", (e)=>{
    const b = e.target.closest && e.target.closest("[data-sb]"); if(!b) return;
    if(b.dataset.sb === "save" && editingId) document.getElementById("saveUpd").click();
    else document.getElementById("saveNew").click();
    dirty = false;
    const t = new Date(), hh = String(t.getHours()).padStart(2, "0"), mm = String(t.getMinutes()).padStart(2, "0");
    refreshSaveBars(`✅ ${hh}:${mm} 저장했어요. "기록 · 불러오기" 탭의 저장된 기록에 반영됐어요.`);
  });
  document.addEventListener("input", (e)=>{ if(e.target && e.target.closest && e.target.closest("#t2, #t3")){ dirty = true; refreshSaveBars(); } });
  document.addEventListener("change", (e)=>{ if(e.target && e.target.closest && e.target.closest("#t2, #t3")){ dirty = true; refreshSaveBars(); } });
  window.__sbClean = function(){ dirty = false; refreshSaveBars(""); };
  refreshSaveBars("");
})();
</script>
"""

NEXT_OLD = """function nextPermitNo(dateStr, taken){
  const m = /^(\\d{4})-(\\d{2})-(\\d{2})$/.exec(dateStr || ""); if(!m) return "";
  const prefix = `${m[1].slice(2)}-${m[2]}-${m[3]}-`;
  let max = 0;
  entries.forEach(e => { const n = String(e.data.permitNo || ""); if(n.startsWith(prefix)) max = Math.max(max, parseInt(n.slice(prefix.length), 10) || 0); });
  (taken || []).forEach(n => { if(String(n).startsWith(prefix)) max = Math.max(max, parseInt(String(n).slice(prefix.length), 10) || 0); });
  return prefix + String(max + 1).padStart(3, "0");
}"""
NEXT_NEW = """// (WOOMI) 번호(NNN)는 날짜와 상관없이 이어서 매김: 저장된 기록 중 가장 큰 번호 + 1
function permitSerialMax(taken){
  let max = 0;
  const rd = (n)=>{ const m = /^\\d{2}-\\d{2}-\\d{2}-(\\d+)$/.exec(String(n || "").trim()); if(m) max = Math.max(max, parseInt(m[1], 10) || 0); };
  entries.forEach(e => rd(e.data.permitNo)); (taken || []).forEach(rd);
  return max;
}
function nextPermitNo(dateStr, taken){
  const m = /^(\\d{4})-(\\d{2})-(\\d{2})$/.exec(dateStr || ""); if(!m) return "";
  const prefix = `${m[1].slice(2)}-${m[2]}-${m[3]}-`;
  return prefix + String(permitSerialMax(taken) + 1).padStart(3, "0");
}
// 허가일자를 고르면: 허가번호가 비어 있으면 다음 번호를 채우고, 이미 YY-MM-DD-NNN이면 날짜 부분만 바꿈
function autoPermitNo(){
  const m = /^(\\d{4})-(\\d{2})-(\\d{2})$/.exec(cur.permitDate || ""); if(!m) return;
  const prefix = `${m[1].slice(2)}-${m[2]}-${m[3]}-`, now = String(cur.permitNo || "").trim();
  const pm = /^\\d{2}-\\d{2}-\\d{2}-(\\d+)$/.exec(now);
  let no;
  if(!now) no = nextPermitNo(cur.permitDate, []);
  else if(pm) no = prefix + pm[1];
  else return;
  cur.permitNo = no; const el = document.querySelector('[data-k="permitNo"]'); if(el) el.value = no;
}"""

PAIRS = [
    ("</style>\n</head>", SAVEBAR_CSS + "</style>\n</head>"),
    (NEXT_OLD, NEXT_NEW),
    ('document.addEventListener("input", (e)=>{ const k = e.target && e.target.dataset && e.target.dataset.k; if(!k) return; cur[k] = e.target.value;',
     'document.addEventListener("input", (e)=>{ const k = e.target && e.target.dataset && e.target.dataset.k; if(!k) return; cur[k] = e.target.value; if(k === "permitDate") autoPermitNo();'),
    ('<div class="row"><div class="field"><label>허가번호</label><input type="text" data-k="permitNo"></div>',
     '<div class="row"><div class="field"><label>허가번호 <small style="font-weight:400">(허가일자를 고르면 다음 번호 자동)</small></label><input type="text" data-k="permitNo" placeholder="예) 26-11-04-010"></div>'),
    # 저장 버튼 상태(덮어쓰기/새 기록) 갱신
    ('  $("#saveUpd").style.display = editingId ? "flex" : "none";',
     '  $("#saveUpd").style.display = editingId ? "flex" : "none"; try{ refreshSaveBars(); }catch(e){}'),
    # 새로 작성하면 저장 표시 초기화
    ('cur = blank(); editingId = null; fillInputs(); render(); renderLog(); };',
     'cur = blank(); editingId = null; fillInputs(); render(); renderLog(); try{ __sbClean(); }catch(e){} };'),
    ("</body>", SAVEBAR_JS + "</body>"),
]
