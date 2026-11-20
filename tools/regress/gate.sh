#!/usr/bin/env bash
# 기능 유실 게이트: 재구성 각 단계 뒤에 돌려 "기능 유실·회귀"가 없는지 확인한다.
#   재빌드 → 정적 서버 → functional.js(기능 동작) → diff.py(기준선과 비교)
# 전제 환경변수:
#   PW_CORE : playwright-core 모듈 경로
#   PW_EXE  : Chromium 실행파일 경로(예: ms-playwright 의 Google Chrome for Testing)
# 사용: tools/regress/gate.sh [포트]
# 종료코드: 0 = 통과, 1 = 유실/회귀, 2 = 환경 미비
set -uo pipefail
ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
PORT="${1:-8899}"
: "${PW_CORE:?PW_CORE(=playwright-core 경로) 필요}"
: "${PW_EXE:?PW_EXE(=Chromium 실행파일) 필요}"

python3 "$ROOT/build/build.py" >/dev/null || { echo "빌드 실패"; exit 2; }
pkill -f "regress/server.js" 2>/dev/null || true; sleep 0.5
node "$ROOT/tools/regress/server.js" "$ROOT" "$PORT" >/tmp/regress_gate_srv.log 2>&1 &
SRV=$!; sleep 2.5
CUR="$(mktemp)"
BASE="http://127.0.0.1:$PORT/" node "$ROOT/tools/regress/functional.js" > "$CUR" 2>/tmp/regress_gate.log
RC=$?
kill $SRV 2>/dev/null || true
if [ $RC -ne 0 ]; then echo "functional 실행 실패:"; tail -3 /tmp/regress_gate.log; rm -f "$CUR"; exit 1; fi
python3 "$ROOT/tools/regress/diff.py" "$ROOT/tools/regress/baseline.func.json" "$CUR"
RC=$?
rm -f "$CUR"
exit $RC
