# 화기작업(허가서 입력 탭) 소방안전관리자 서명: 화면 캡처를 Ctrl+V로 붙여넣기
# - "📋 화면 캡처 붙여넣기" 또는 서명 미리보기 칸을 누르면 붙여넣기 대기 → Ctrl+V
# - 파일 선택은 "📁 파일에서 찾기" 버튼으로 (바로 파일 창이 열리지 않게)

PAIRS = [
    ('<input type="file" id="mgrSigUp" accept="image/*"><p class="help" style="margin:6px 0 0">위 칸에 직접 서명하거나, 서명 사진을 올려도 돼요.</p></div>',
     '<div class="row" style="margin:2px 0 6px"><button class="btn sm" id="mgrPasteBtn" type="button">📋 화면 캡처 붙여넣기 (Ctrl+V)</button><button class="btn sm" id="mgrFileBtn" type="button">📁 파일에서 찾기</button></div>'
     '<div id="mgrPasteHint" style="display:none;margin:0 0 6px;padding:8px 10px;border:1.5px solid #2f55c9;border-radius:8px;background:#eef3fc;color:#1d2d52;font-size:12px">📋 <b>지금 Ctrl+V</b>를 누르면 복사한 서명 사진(화면 캡처)이 들어가요. <button class="btn sm" id="mgrPasteCancel" type="button" style="margin-left:4px">취소</button></div>'
     '<input type="file" id="mgrSigUp" accept="image/*" style="display:none"><p class="help" style="margin:6px 0 0">위 칸에 직접 서명하거나, 화면 캡처를 붙여넣거나(Ctrl+V), 서명 사진 파일을 올려도 돼요.</p></div>'),
    ('  $("#mgrSigUp").onchange = async (e)=>{',
     '''  // 화면 캡처 붙여넣기 (Ctrl+V)
  let mgrArmed = false;
  const mgrArm = (on)=>{ mgrArmed = on; $("#mgrPasteHint").style.display = on ? "" : "none"; $("#mgrSigTh").style.outline = on ? "2px solid #2f55c9" : ""; if(on) $("#mgrPasteHint").scrollIntoView({ block: "nearest" }); };
  $("#mgrPasteBtn").onclick = ()=> mgrArm(true);
  $("#mgrPasteCancel").onclick = ()=> mgrArm(false);
  $("#mgrFileBtn").onclick = ()=> $("#mgrSigUp").click();
  $("#mgrSigTh").style.cursor = "pointer"; $("#mgrSigTh").title = "누르고 Ctrl+V로 붙여넣기"; $("#mgrSigTh").addEventListener("click", ()=> mgrArm(true));
  window.addEventListener("paste", async (e)=>{
    if(!mgrArmed) return;
    const it = [...((e.clipboardData && e.clipboardData.items) || [])].find(x => x.kind === "file" && /^image\\//.test(x.type));
    if(!it){ alert("복사된 사진이 없어요. 화면 캡처(Print Screen, 또는 Windows+Shift+S)로 서명 부분을 복사한 뒤 다시 Ctrl+V 해주세요."); return; }
    e.preventDefault(); e.stopImmediatePropagation();
    try{ const sg = toSig(await fileToCanvas(it.getAsFile())); if(!sg){ alert("서명을 찾지 못했어요. 흰 바탕에 서명만 보이게 캡처해서 다시 넣어주세요."); return; } setMgrSig(sg); mgrArm(false); }catch(err){ alert(err.message || err); }
  }, true);
  $("#mgrSigUp").onchange = async (e)=>{'''),
]
