#!/usr/bin/env bash
# 회귀 루프: index.html 재빌드 → 정적 서버 → 3개 화면 스모크 테스트 → JSON 출력.
# 전제: node, playwright-core(PW_CORE), Chromium 실행파일(PW_EXE) 필요.
#   PW_CORE: playwright-core 모듈 경로, PW_EXE: Chromium 실행파일 경로
# 사용: tools/regress/run.sh [포트]
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
PORT="${1:-8799}"
: "${PW_CORE:?PW_CORE(=playwright-core 경로) 가 필요합니다}"
: "${PW_EXE:?PW_EXE(=Chromium 실행파일 경로) 가 필요합니다}"

python3 "$ROOT/build/build.py" >/dev/null
pkill -f "regress/server.js" 2>/dev/null || true; sleep 0.4
node "$ROOT/tools/regress/server.js" "$ROOT" "$PORT" >/tmp/regress_srv.log 2>&1 &
SRV=$!; sleep 1.8
BASE="http://127.0.0.1:$PORT/" SHOT="${SHOT:-/tmp/regress_shots}" node "$ROOT/tools/regress/smoke.js"
kill $SRV 2>/dev/null || true
