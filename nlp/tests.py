import sys, pathlib
sys.path.insert(0, str(pathlib.Path(__file__).parent))
from app import analyze

CASES = [
    ("The projector in Lab 4 hasn't been working for three days and our practical exam is tomorrow.", "Equipment"),
    ("WiFi router is down in the library, no internet since morning.", "Network"),
    ("Toilet in the boys washroom block B is blocked and overflowing.", "Plumbing"),
    ("Socket in room 203 is sparking and there are exposed wires on the switchboard.", "Electrical"),
    ("Dustbins on floor 2 are overflowing and there is a bad smell in the corridor.", "Cleanliness"),
    ("The broken staircase railing on the 3rd floor is dangerous and someone may fall.", "Safety"),
    ("We need extra chairs arranged for the seminar hall.", "Other"),
    ("The AC in Lab 2 stopped working two weeks ago and exams are tomorrow.", "Equipment"),
    ("Water is leaking from the pipe near the main gate corridor.", "Plumbing"),
    ("The internet is extremely slow and the portal server is down.", "Network"),
]

def run():
    passed = failed = 0
    for text, expected in CASES:
        r = analyze(text)
        got = r["category"]
        ok = got == expected
        status = "PASS" if ok else "FAIL"
        if ok:
            passed += 1
        else:
            failed += 1
        print(f"[{status}] expected={expected:12s} got={got:12s}  {text[:60]}")
    print(f"\n{passed}/{len(CASES)} passed")
    if failed:
        sys.exit(1)

if __name__ == "__main__":
    run()
