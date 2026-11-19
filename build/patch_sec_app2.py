# 보안 2차 점검(레드팀) 대응 — 앱 쪽 (교육일지 PDF 적용 패치 뒤에 적용)
# --- 저장이 실제로 끝난 뒤에만 "저장했어요" (저장 공간이 부족하면 실패만 알림) ---
PAIRS = [
    ('    b3aLastSaveOk = true;\n    const snapshot = JSON.parse(JSON.stringify(b3aLogEntries));',
     '    b3aLastSaveOk = true; const __silent = b3aSilentSave;   // (WOOMI) 한꺼번에 저장할 때는 부른 쪽이 알림\n    const snapshot = JSON.parse(JSON.stringify(b3aLogEntries));'),
    ('    }).catch(()=>{\n      alert("기록 저장에 실패했어요. 컴퓨터(폰)의 저장 공간이 부족할 수 있어요.");\n    });\n  }\n  let b3aSilentSave',
     '    }).catch((e)=>{\n      console.error(e); b3aLastSaveOk = false;\n      if(!__silent) alert("기록 저장에 실패했어요. 컴퓨터(폰)의 저장 공간이 부족할 수 있어요.");\n    });\n    return b3aSaveChain.then(()=> b3aLastSaveOk);\n  }\n  let b3aSilentSave'),
    ('    saveB3aLogEntries();\n    renderB3a();\n    renderB3aLogList();\n    alert("기록으로 저장했어요. 목록에서 다시 불러올 수 있어요.");',
     '    const __sv = saveB3aLogEntries();\n    renderB3a();\n    renderB3aLogList();\n    __sv.then(ok => { if(ok) alert("기록으로 저장했어요. 목록에서 다시 불러올 수 있어요."); });'),
    ('  function b3aOcrApplySingle(){', '  async function b3aOcrApplySingle(){'),
    ('    const archived = b3aArchiveCurrent();\n    b3aSilentSave = false;',
     '    const archived = b3aArchiveCurrent();\n    b3aSilentSave = false; if(archived) await b3aSaveChain;   // (WOOMI) 저장이 끝난 뒤 결과 확인'),
    ('      const ok = b3aArchiveCurrent();\n      b3aSilentSave = false;',
     '      const ok = b3aArchiveCurrent();\n      b3aSilentSave = false; if(ok) await b3aSaveChain;'),
    # 안전점검 기록
    ('    })()).catch(e => { console.error(e); alert("점검 기록 저장에 실패했어요. 저장 공간이 부족할 수 있어요."); });',
     '    })()).then(()=> true, e => { console.error(e); alert("점검 기록 저장에 실패했어요. 저장 공간이 부족할 수 있어요."); return false; });'),
    ('b56Persist(); b56RenderRecs(); alert("저장했어요.");', 'b56RenderRecs(); b56Persist().then(ok => { if(ok) alert("저장했어요."); });'),
    ('b56Persist(); b56RenderRecs(); alert("새 기록으로 저장했어요.");', 'b56RenderRecs(); b56Persist().then(ok => { if(ok) alert("새 기록으로 저장했어요."); });'),
    # 직접 넣는 사진 줄이기
    ('    reader.onload = ()=>{\n      if(num === 1) b3aPhoto1 = reader.result; else b3aPhoto2 = reader.result;\n      renderB3a();\n    };',
     '    reader.onload = ()=>{\n      window.__wshrink(reader.result).then(u => {   // (WOOMI) 큰 사진은 줄여서 저장\n        if(num === 1) b3aPhoto1 = u; else b3aPhoto2 = u;\n        renderB3a();\n      });\n    };'),
    ('      const url = await new Promise(res=>{ const r = new FileReader(); r.onload = ()=> res(r.result); r.readAsDataURL(f); });\n      b3aPhotoMore.push(url);',
     '      const url = await window.__wshrink(await new Promise(res=>{ const r = new FileReader(); r.onload = ()=> res(r.result); r.readAsDataURL(f); }));\n      b3aPhotoMore.push(url);'),
]

# --- 다시 열 때 "작성 중이던 내용"을 보관하는 일: 기록 목록을 다 불러온 뒤, 이미 있는 기록과 똑같으면 보관하지 않음 (같은 기록 두 개 방지) ---
PAIRS += [
    ('  (function startFresh(){\n    b3aArchiveCurrent();                 // 비정상 종료로 남은 작업이 있으면 먼저 기록으로 보관',
     '''  (function startFresh(){
    (function(){   // (WOOMI) 비정상 종료로 남은 작업은 기록 목록을 다 불러온 뒤 보관 (이미 같은 기록이 있으면 건너뜀)
      let d0 = null; try{ d0 = getB3aFormData(); }catch(e){}
      b3aLogReady.then(()=>{ try{
        if(!d0) return;
        const ro = (d0._roster || []).filter(r => r.name || r.org || r.sig || r.nameImg || r.orgImg);
        if(!b3aHasContent(d0, ro)) return;
        d0._roster = ro;
        const nz = d => JSON.stringify(Object.assign({}, d, { _roster: ((d && d._roster) || []).filter(r => r && (r.name || r.org || r.sig || r.nameImg || r.orgImg)) }));
        const j = nz(d0);
        if(b3aLogEntries.some(e => nz(e.data) === j)) return;
        b3aLogEntries.push({ id: "b3a_" + Date.now() + "_" + Math.random().toString(36).slice(2,7), savedAt: new Date().toISOString(), data: d0 });
        saveB3aLogEntries(); renderB3aLogList();
      }catch(e){ console.error(e); } });
    })();'''),
]
