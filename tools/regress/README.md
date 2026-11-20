# 회귀 테스트 (tools/regress)

재구성 각 단계에서 **기능이 사라지거나 깨지지 않았는지** 자동으로 확인하는 하네스.

## 구성
- `server.js` — 저장소를 서빙하는 읽기 전용 정적 서버(GET 전용)
- `smoke.js` — 가벼운 스모크: 3개 화면이 콘솔/페이지 오류 없이 뜨는지 + XSS 가드
- `functional.js` — 기능 동작 검증:
  - **인벤토리**: 각 화면(교육훈련·화기작업·안전점검)의 버튼·입력 목록 수집 → 다음 단계와 비교해 **사라진 기능 탐지**
  - **동작**: 교육일지 입력→저장→재로그인 값 보존(+암호화 at-rest), 백업 내보내기→기록 손실→복원 복구
  - **보안**: XSS 우회 payload 차단(0회), 조작된 백업(iter 과대) 즉시 거부
- `diff.py` — 기준선(`baseline.func.json`)과 현재 결과를 비교해 유실·회귀 보고
- `gate.sh` — 재빌드→서버→functional→diff 를 한 번에 (단계별 게이트)
- `baseline.func.json` — 기준 스냅샷 (기능 추가 시 갱신)
- `run.sh` — smoke 만 빠르게

## 전제
Node + Playwright(브라우저 자동화)용 Chromium 이 필요하다. 환경변수로 경로를 준다:
```
export PW_CORE="$(ls -d ~/.npm/_npx/*/node_modules/playwright-core | head -1)"
export PW_EXE="$HOME/Library/Caches/ms-playwright/chromium-1208/chrome-mac-arm64/Google Chrome for Testing.app/Contents/MacOS/Google Chrome for Testing"
```
(경로는 환경에 맞게. Playwright 미설치 시 `npx playwright install chromium` 한 번.)

## 사용
```
# 단계별 기능 유실 게이트 (가장 많이 씀)
tools/regress/gate.sh

# 기준선 갱신(의도적으로 기능을 추가/변경했을 때만)
BASE="http://127.0.0.1:8899/" node tools/regress/functional.js > tools/regress/baseline.func.json
#   (서버를 먼저 띄운 뒤) — 또는 gate.sh 로 current 를 뽑아 교체

# 결과물 바이트 일치 검사(패치 반영 등 결과 불변 작업용)
python3 tools/check_build.py
```

## 원칙
- **결과를 바꾸지 않는 작업**(패치 병합 등): `tools/check_build.py` 로 바이트 일치 확인.
- **결과를 바꾸는 작업**(죽은 코드 제거·보안 수정·모듈화): `gate.sh` 로 기능 유실/회귀 0 확인.
- 기준선을 올릴 때는 "무엇을/왜 바꿨는지" 커밋 메시지에 남긴다.
- 공격용 레드팀 payload 는 공개 저장소에 두지 않는다(여기 있는 건 양성 기능 검증만).
