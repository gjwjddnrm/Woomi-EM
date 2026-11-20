#!/usr/bin/env python3
# 안전망 0단계: 빌드 일치 검사
#   1) src + build/patch_*.py 로 빌드한 결과가 커밋된 index.html 과 바이트 단위로 같은가
#   2) 산출물 안의 인라인 스크립트가 문법 오류 없이 파싱되는가 (node 있을 때)
# 사용: python3 tools/check_build.py
# 종료코드: 0 = 통과, 1 = 불일치/오류
import base64, pathlib, re, subprocess, sys, tempfile, shutil

ROOT = pathlib.Path(__file__).resolve().parent.parent
INDEX = ROOT / "index.html"
BUILD = ROOT / "build" / "build.py"

def fail(msg):
    print("❌ " + msg); sys.exit(1)

def main():
    if not INDEX.exists(): fail("index.html 이 없습니다.")
    if not BUILD.exists(): fail("build/build.py 가 없습니다.")

    with tempfile.TemporaryDirectory() as td:
        out = pathlib.Path(td) / "index_built.html"
        r = subprocess.run([sys.executable, str(BUILD), str(out)],
                           capture_output=True, text=True)
        if r.returncode != 0:
            fail("빌드 실패:\n" + (r.stderr or r.stdout))
        built = out.read_bytes()
        committed = INDEX.read_bytes()
        if built != committed:
            # 어디가 다른지 간단 요약
            a, b = built, committed
            i = next((k for k in range(min(len(a), len(b))) if a[k] != b[k]), min(len(a), len(b)))
            fail(f"빌드 결과가 커밋된 index.html 과 다릅니다. "
                 f"(빌드 {len(a)}B vs 커밋 {len(b)}B, 첫 차이 오프셋 {i})")
        print(f"✅ 빌드 일치: index.html == src+patches 빌드 결과 ({len(built)//1024} KB)")

    # 인라인 스크립트 문법 검사 (node 있을 때만)
    node = shutil.which("node")
    if not node:
        print("ℹ️  node 가 없어 스크립트 문법 검사는 건너뜀.")
        return
    html = INDEX.read_text("utf-8")
    blocks = re.findall(r'<script([^>]*)>(.*?)</script>', html, flags=re.S)
    checked = errors = 0
    with tempfile.TemporaryDirectory() as td:
        tdp = pathlib.Path(td)
        for i, (attrs, body) in enumerate(blocks):
            if "octet-stream" in attrs or "src=" in attrs:
                continue
            f = tdp / f"b{i}.js"; f.write_text(body, "utf-8")
            r = subprocess.run([node, "--check", str(f)], capture_output=True, text=True)
            checked += 1
            if r.returncode != 0:
                errors += 1
                print(f"❌ 스크립트 블록 {i} 문법 오류:\n   " +
                      (r.stderr.strip().splitlines()[-1] if r.stderr.strip() else "unknown"))
        # 내장 화기작업 프레임(base64) 도 검사
        m = re.search(r'id="woomiHotworkSrc">([^<]+)<', html)
        if m:
            hw = base64.b64decode(m.group(1)).decode("utf-8")
            for i, (attrs, body) in enumerate(re.findall(r'<script([^>]*)>(.*?)</script>', hw, flags=re.S)):
                if not body.strip(): continue
                f = tdp / f"hw{i}.js"; f.write_text(body, "utf-8")
                r = subprocess.run([node, "--check", str(f)], capture_output=True, text=True)
                checked += 1
                if r.returncode != 0:
                    errors += 1
                    print(f"❌ 화기작업 프레임 스크립트 {i} 문법 오류")
    if errors:
        fail(f"스크립트 문법 오류 {errors}건 (검사 {checked}개).")
    print(f"✅ 스크립트 문법 검사 통과 ({checked}개 블록).")

if __name__ == "__main__":
    main()
    print("🟢 0단계 빌드 안전망: 모두 통과.")
