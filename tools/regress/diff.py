#!/usr/bin/env python3
# 기능 유실 탐지: 기준(baseline) functional.json 과 현재 결과를 비교한다.
#   - 인벤토리: 기준에 있던 버튼/입력/내비가 현재 사라졌으면 "기능 유실"로 보고(추가는 허용)
#   - 동작/보안: 보존·복원·암호화·XSS차단 등이 회귀했으면 보고
# 사용: python3 tools/regress/diff.py <baseline.json> <current.json>
# 종료코드: 0 = 유실/회귀 없음, 1 = 있음
import json, sys

def load(p):
    with open(p, encoding="utf-8") as f: return json.load(f)

def removed(base, cur):
    return [x for x in base if x not in set(cur)]

def main():
    if len(sys.argv) != 3:
        print("사용: diff.py <baseline.json> <current.json>"); sys.exit(2)
    base, cur = load(sys.argv[1]), load(sys.argv[2])
    problems = []

    # 1) 인벤토리(화면별 버튼·입력·내비) 유실
    for screen in base.get("inventory", {}):
        b = base["inventory"][screen]; c = cur.get("inventory", {}).get(screen, {})
        if c.get("MISSING"):
            problems.append(f"[화면유실] '{screen}' 화면/프레임이 사라짐"); continue
        for kind in ("buttons", "inputs", "nav"):
            gone = removed(b.get(kind, []), c.get(kind, []))
            if gone:
                problems.append(f"[기능유실] {screen}.{kind} 에서 {len(gone)}개 사라짐: " + ", ".join(map(repr, gone[:8])) + (" ..." if len(gone) > 8 else ""))

    # 2) 동작 회귀
    def behav(path, key, want, label):
        v = cur.get(path, {}).get(key)
        if isinstance(v, dict):
            for k, exp in want.items():
                if v.get(k) != exp: problems.append(f"[동작회귀] {label}.{k} = {v.get(k)} (기대 {exp})")
        elif v != want:
            problems.append(f"[동작회귀] {label} = {v} (기대 {want})")
    behav("behavior", "eduSave", {"persisted": True, "encryptedAtRest": True}, "교육일지 저장")
    behav("behavior", "backup", {"imported": True, "restored": True}, "백업 복원")

    # 3) 보안 회귀
    sec = cur.get("security", {})
    if sec.get("xssExecuted", 0) != 0:
        problems.append(f"[보안회귀] XSS 실행됨: {sec.get('xssExecuted')} (0이어야 함)")
    if not (sec.get("backupIterCap") or {}).get("rejected"):
        problems.append("[보안회귀] 조작된 백업(iter 과대)이 거부되지 않음")

    # 4) 부팅 오류 증가
    if cur.get("errors", {}).get("boot", 0) > base.get("errors", {}).get("boot", 0):
        problems.append(f"[오류증가] 부팅 콘솔 오류 {base['errors'].get('boot',0)} → {cur['errors'].get('boot')}")
    for k, v in cur.get("errors", {}).items():
        if k != "boot" and v:
            problems.append(f"[하네스오류] {k}: {v}")

    if problems:
        print("❌ 기능 유실/회귀 발견:")
        for p in problems: print("  - " + p)
        sys.exit(1)
    print("✅ 기능 유실/회귀 없음 (인벤토리·동작·보안 모두 기준 이상)")

if __name__ == "__main__":
    main()
