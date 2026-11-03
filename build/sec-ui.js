/* =====================================================================
   WOOMI 잠금 화면 · 보안 설정 · 앱 시작 순서
   잠금이 풀린 뒤에야 앱 스크립트를 실행하므로, 잠긴 상태에서는 어떤 자료도 화면에 나오지 않습니다.
   ===================================================================== */
(function(){
  "use strict";
  var S = window.WoomiSec;
  var $ = function(id){ return document.getElementById(id); };

  /* ---------- 앱 시작 (잠금 해제 후 1회) ---------- */
  var booted = false;
  function bootApp(){
    if(booted) return; booted = true;
    document.documentElement.classList.remove("wsec-locked");
    var list = document.querySelectorAll('script[type="text/x-woomi-app"]');
    for(var i = 0; i < list.length; i++){
      var s = document.createElement("script");
      s.textContent = list[i].textContent;
      list[i].replaceWith(s);              // 순서대로 즉시 실행
    }
    if(document.readyState === "complete") window.dispatchEvent(new Event("load"));
    S.guardUnload();
  }

  /* ---------- 화기작업(별지 7·8) 화면: 같은 파일 안의 격리된 프레임 ---------- */
  var hwLoaded = false;
  window.WoomiHotwork = {
    show: function(){
      if(hwLoaded) return; hwLoaded = true;
      var src = $("woomiHotworkSrc").textContent.trim();
      var bin = atob(src), u = new Uint8Array(bin.length);
      for(var i = 0; i < bin.length; i++) u[i] = bin.charCodeAt(i);
      $("hotworkFrame").srcdoc = new TextDecoder().decode(u);
    }
  };

  /* ---------- 잠금 화면 ---------- */
  var fails = 0, waitUntil = 0;
  function msg(t, ok){ var m = $("wsecMsg"); m.textContent = t || ""; m.className = "wsec-msg" + (ok ? " ok" : ""); }

  function renderProfile(){
    var p = S.getProfile(), box = $("wsecProfile"), side = $("gsProfile");
    box.textContent = ""; if(side) side.textContent = "";
    if(!p.site && !p.manager){ box.classList.remove("on"); return; }
    var b = document.createElement("b"); b.textContent = p.site || "현장명 미입력";
    var sp = document.createElement("span"); sp.textContent = p.manager ? "소방안전관리자 " + p.manager : "";
    box.append(b, sp); box.classList.add("on");
    if(side){ var b2 = b.cloneNode(true), s2 = document.createElement("span"); s2.textContent = p.manager || ""; side.append(b2, s2); }
  }
  function renderLock(){
    var setup = !S.hasPassword();
    $("wsecProfileRow").style.display = setup ? "" : "none";
    renderProfile();
    $("wsecTitle").textContent = setup ? "처음 사용 · 비밀번호 설정" : "잠금 해제";
    $("wsecDesc").innerHTML = setup
      ? "이 컴퓨터에 저장되는 현장 자료(이름·연락처·서명·사진)를 <b>암호화</b>할 비밀번호를 정해 주세요. <b>" + S.MIN_PW + "자 이상</b>이어야 해요."
      : "이 컴퓨터에 저장된 현장 자료는 암호화되어 있어요. 비밀번호를 입력하면 열려요.";
    $("wsecPw2Row").style.display = setup ? "" : "none";
    $("wsecWarn").style.display = setup ? "" : "none";
    $("wsecGo").textContent = setup ? "비밀번호 설정하고 시작" : "잠금 해제";
    $("wsecForgotRow").style.display = setup ? "none" : "";
    $("wsecPw").autocomplete = setup ? "new-password" : "current-password";
    setTimeout(function(){ (setup ? $("wsecSite") : $("wsecPw")).focus(); }, 50);
  }

  async function onSubmit(e){
    e.preventDefault();
    var pw = $("wsecPw").value, btn = $("wsecGo");
    if(Date.now() < waitUntil){ msg("잠시 후 다시 시도해 주세요. (" + Math.ceil((waitUntil - Date.now()) / 1000) + "초)"); return; }
    if(!S.hasPassword()){
      if(!$("wsecSite").value.trim() || !$("wsecManager").value.trim()){ msg("현장명과 소방안전관리자 이름을 입력해 주세요."); return; }
      if(pw.length < S.MIN_PW){ msg("비밀번호는 " + S.MIN_PW + "자 이상이어야 해요."); return; }
      if(pw !== $("wsecPw2").value){ msg("두 비밀번호가 서로 달라요."); return; }
      btn.disabled = true; msg("암호화 설정 중...", true);
      try{ await S.setupPassword(pw, { site:$("wsecSite").value, manager:$("wsecManager").value }); renderProfile(); }catch(err){ console.error(err); btn.disabled = false; msg("설정에 실패했어요: " + err.message); return; }
      $("wsecPw").value = $("wsecPw2").value = "";
      bootApp(); return;
    }
    btn.disabled = true; msg("확인 중...", true);
    var ok = false;
    try{ ok = await S.unlock(pw); }catch(err){ console.error(err); }
    btn.disabled = false;
    if(ok){ $("wsecPw").value = ""; msg(""); bootApp(); return; }
    fails++;
    if(fails >= 5) waitUntil = Date.now() + Math.min(300, 15 * Math.pow(2, fails - 5)) * 1000;
    msg("비밀번호가 맞지 않아요." + (fails >= 5 ? " 잠시 기다린 뒤 다시 시도해 주세요." : ""));
    $("wsecPw").select();
  }

  async function onForgot(){
    var t = prompt("비밀번호를 잊으면 암호화된 자료는 누구도 복구할 수 없어요.\n\n이 컴퓨터의 WOOMI 자료를 모두 삭제하고 새로 시작하려면 아래에 \"전체삭제\"라고 입력하세요.\n(암호화 백업 파일이 있다면, 새 비밀번호를 정한 뒤 [보안 설정 → 백업 가져오기]로 되살릴 수 있어요.)");
    if(t !== "전체삭제") return;
    await S.wipeAll();
    location.reload();
  }

  /* ---------- 보안 설정 창 ---------- */
  function openSettings(){
    $("wsecIdle").value = String(S.idleMinutes());
    var p = S.getProfile(); $("wsecSetSite").value = p.site; $("wsecSetManager").value = p.manager;
    $("wsecSetMsg").textContent = "";
    $("wsecSettings").classList.add("on");
  }
  function closeSettings(){ $("wsecSettings").classList.remove("on"); ["wsecOld","wsecNew","wsecNew2","wsecBkPw","wsecImpPw"].forEach(function(id){ $(id).value = ""; }); $("wsecImpFile").value = ""; }
  function setMsg(t){ $("wsecSetMsg").textContent = t; }

  async function onChangePw(){
    var o = $("wsecOld").value, n = $("wsecNew").value, n2 = $("wsecNew2").value;
    if(n.length < S.MIN_PW) return setMsg("새 비밀번호는 " + S.MIN_PW + "자 이상이어야 해요.");
    if(n !== n2) return setMsg("새 비밀번호 두 개가 서로 달라요.");
    setMsg("모든 자료를 새 비밀번호로 다시 암호화하는 중...");
    try{ if(!(await S.changePassword(o, n))) return setMsg("현재 비밀번호가 맞지 않아요."); }
    catch(e){ console.error(e); return setMsg("변경 실패: " + e.message); }
    $("wsecOld").value = $("wsecNew").value = $("wsecNew2").value = "";
    setMsg("✅ 비밀번호를 바꿨어요.");
  }
  async function onExport(){
    var pw = $("wsecBkPw").value;
    if(!pw) return setMsg("현재 비밀번호를 입력해 주세요.");
    setMsg("백업 파일을 만드는 중...");
    try{ if(!(await S.exportBackup(pw))) return setMsg("비밀번호가 맞지 않아요."); }
    catch(e){ console.error(e); return setMsg("백업 실패: " + e.message); }
    $("wsecBkPw").value = "";
    setMsg("✅ 암호화 백업 파일을 저장했어요. 이 파일은 백업할 때 쓴 비밀번호로만 열려요.");
  }
  async function onImport(){
    var f = $("wsecImpFile").files[0], pw = $("wsecImpPw").value;
    if(!f) return setMsg("백업 파일(.woomi)을 골라 주세요.");
    if(!pw) return setMsg("백업을 만들 때 쓴 비밀번호를 입력해 주세요.");
    if(!confirm("지금 이 컴퓨터에 있는 WOOMI 자료를 백업 파일 내용으로 바꿀까요?\n(현재 자료는 지워집니다)")) return;
    setMsg("복원하는 중...");
    try{ if(!(await S.importBackup(f, pw))) return setMsg("백업 비밀번호가 맞지 않거나 파일이 손상됐어요."); }
    catch(e){ console.error(e); return setMsg("복원 실패: " + e.message); }
    alert("복원했어요. 화면을 다시 불러온 뒤 비밀번호를 입력해 주세요.");
    S.lock();
  }

  function init(){
    document.documentElement.classList.add("wsec-locked");
    if(!S || !S.supported){
      $("wsecTitle").textContent = "이 환경에서는 열 수 없어요";
      $("wsecDesc").innerHTML = "보안(암호화) 기능을 쓸 수 없는 환경이에요. <b>최신 크롬·엣지·사파리</b>에서, 파일을 직접 열거나 <b>https://</b> 주소로 열어 주세요.";
      $("wsecForm").style.display = "none"; return;
    }
    $("wsecForm").addEventListener("submit", onSubmit);
    $("wsecForgot").addEventListener("click", onForgot);
    document.querySelectorAll("[data-wsec-lock]").forEach(function(b){ b.addEventListener("click", function(){ S.lock(); }); });
    document.querySelectorAll("[data-wsec-settings]").forEach(function(b){ b.addEventListener("click", openSettings); });
    $("wsecClose").addEventListener("click", closeSettings);
    $("wsecSettings").addEventListener("click", function(e){ if(e.target === this) closeSettings(); });
    $("wsecIdle").addEventListener("change", function(){ S.setIdleMinutes(parseInt(this.value, 10)); setMsg("✅ 자동 잠금 시간을 바꿨어요."); });
    $("wsecChangeBtn").addEventListener("click", onChangePw);
    $("wsecProfileBtn").addEventListener("click", function(){
      if(!$("wsecSetSite").value.trim() || !$("wsecSetManager").value.trim()) return setMsg("현장명과 이름을 모두 입력해 주세요.");
      S.setProfile($("wsecSetSite").value, $("wsecSetManager").value); renderProfile(); setMsg("✅ 현장 정보를 저장했어요.");
    });
    $("wsecExportBtn").addEventListener("click", onExport);
    $("wsecImportBtn").addEventListener("click", onImport);
    renderLock();
  }
  init();
})();
