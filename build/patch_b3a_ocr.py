# 별지 3-1 PDF 자동 채우기: 하루치도 "적용" 즉시 기록으로 저장
# (틀린 곳은 "직접 작성" 탭에서 고친 뒤 "새 기록으로 저장" → 방금 만든 기록이 갱신됨)

OLD_SINGLE = """  function b3aOcrApplySingle(){
    b3aOcrSaveDayEdits();
    const rosterAppliedCount = b3aOcrApplyToForm();
    document.getElementById("b3a-ocr-review").style.display = "none";
"""
NEW_SINGLE = """  function b3aOcrApplySingle(){
    b3aOcrSaveDayEdits();
    if(b3aEditingId){ applyB3aFormData(getB3aBlankTemplate()); b3aApplyRoster([]); }   // 다른 기록을 고치던 중이면 빈 양식에서 시작
    b3aEditingId = null;                                                              // PDF로 읽은 내용은 항상 새 기록
    const rosterAppliedCount = b3aOcrApplyToForm();
    document.getElementById("b3a-ocr-review").style.display = "none";
    const before = b3aLogEntries.length;
    b3aSilentSave = true; b3aLastSaveOk = true;
    const archived = b3aArchiveCurrent();
    b3aSilentSave = false;
    if(archived && !b3aLastSaveOk){ b3aLogEntries.length = before; b3aEditingId = null; }
    renderB3a(); renderB3aLogList();
    if(archived && b3aLastSaveOk){
      alert(`기록으로 저장했어요.${rosterAppliedCount ? ` (별지 3-2 이수자 ${rosterAppliedCount}명 포함)` : ""}\\n\\n인원수·날짜·사진 등 틀린 곳이 있으면 "직접 작성" 탭에서 고친 뒤 "💾 새 기록으로 저장"을 누르세요. 방금 저장한 이 기록이 고친 내용으로 갱신돼요.`);
      return;
    }
    if(archived){ alert('저장 공간이 부족해서 기록으로 저장하지 못했어요. 내용은 "직접 작성" 탭에 채워 두었어요.'); return; }
"""

PAIRS = [
    (OLD_SINGLE, NEW_SINGLE),
    ('document.getElementById("b3a-ocr-batch-btn").textContent = "선택한 날짜 1일치만 폼에 적용";',
     'document.getElementById("b3a-ocr-batch-btn").textContent = "선택한 날짜 1일치만 기록으로 저장";'),
    ('"일치 날짜별로 각각 저장" : "✅ 이 값으로 폼에 적용";',
     '"일치 날짜별로 각각 저장" : "✅ 이 값으로 기록 저장";'),
    ('id="b3a-ocr-apply-btn" style="flex:1">✅ 이 값으로 폼에 적용</button>',
     'id="b3a-ocr-apply-btn" style="flex:1">✅ 이 값으로 기록 저장</button>'),
]
