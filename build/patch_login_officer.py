# 소방안전관리자 = 잠금 화면에서 로그인한 관리자 이름 (보안 설정의 "관리자 이름")
# - 교육·훈련(별지 3-1) 교육/훈련 실시자 성명
# - 안전점검(별지 5 점검자 · 별지 6 확인자)
# (화기작업 허가서의 소방안전관리자는 patch_hotwork_workers.py)

LOGIN_JS = '(function(){ try{ return (window.WoomiSec && WoomiSec.getProfile && WoomiSec.getProfile().manager || "").trim(); }catch(e){ return ""; } })()'

PAIRS = [
    # 안전점검: 고정 이름 대신 로그인한 관리자
    ('  const B5_FIXED_INSPECTOR = "허정욱";   // 점검자(소방안전관리자) 고정',
     '  const B5_FIXED_INSPECTOR = ' + LOGIN_JS + ';   // (WOOMI) 점검자·확인자(소방안전관리자) = 로그인한 관리자'),
    # 교육·훈련: 실시자 성명이 비어 있으면 로그인한 관리자로 (저장된 기록을 열 때는 그 기록의 이름 그대로)
    ('''    if(!nameEl.value.trim()){
      try{ nameEl.value = (JSON.parse(localStorage.getItem(B3A_SIGNER_DEFAULT_KEY) || "{}").name) || ""; }catch(e){}''',
     '''    if(!nameEl.value.trim()){
      nameEl.value = ''' + LOGIN_JS + ''';   // (WOOMI) 로그인한 관리자
      if(!nameEl.value) try{ nameEl.value = (JSON.parse(localStorage.getItem(B3A_SIGNER_DEFAULT_KEY) || "{}").name) || ""; }catch(e){}'''),
    # 로그인한 관리자가 있으면 이름 칸을 잠그고 "담당자 변경" 대신 안내
    ('    try{ saved = (JSON.parse(localStorage.getItem(B3A_SIGNER_DEFAULT_KEY) || "{}").name) || ""; }catch(e){}',
     '    try{ saved = (JSON.parse(localStorage.getItem(B3A_SIGNER_DEFAULT_KEY) || "{}").name) || ""; }catch(e){}\n'
     '    const __login = ' + LOGIN_JS + ';\n'
     '    if(__login){   // (WOOMI) 로그인한 관리자 기준: 이름은 보안 설정에서 바꿈\n'
     '      const el0 = document.getElementById("b3a-officer-name"); el0.readOnly = true; el0.style.background = "#f2f4f7"; el0.title = "로그인한 관리자 이름이에요. 바꾸려면 왼쪽 아래 \\"보안 설정\\"에서 관리자 이름을 고쳐 주세요.";\n'
     '      document.getElementById("b3a-officer-unlock").style.display = "none"; return;\n'
     '    }'),
]
