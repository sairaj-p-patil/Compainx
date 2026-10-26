import re, pickle, pathlib, numpy as np
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.linear_model import LogisticRegression
from sklearn.metrics.pairwise import cosine_similarity

try:
    import spacy
    nlp = spacy.load("en_core_web_sm")
except Exception:
    nlp = None
try:
    from sentence_transformers import SentenceTransformer
    embedder = SentenceTransformer("all-MiniLM-L6-v2")
except Exception:
    embedder = None

SEED = {
    "Equipment": ["projector not working in lab", "computer is broken and will not start", "printer jammed and out of order", "microphone and speaker system dead", "smart board not turning on", "lab equipment damaged"],
    "Plumbing": ["water leaking from tap", "toilet is blocked and overflowing", "no water supply in washroom", "pipe burst near corridor", "drainage clogged", "geyser not heating water"],
    "Electrical": ["lights not working in classroom", "fan stopped working", "power outage in block", "socket sparking and unsafe", "ac not cooling in room", "exposed wires on switchboard"],
    "Network": ["wifi not connecting", "internet very slow all day", "router is down in library", "lan port not working", "cannot access portal server down", "no network in hostel"],
    "Cleanliness": ["washrooms are dirty", "garbage not collected for days", "dustbins overflowing", "classroom not cleaned", "bad smell in corridor", "pests in canteen"],
    "Safety": ["fire extinguisher missing", "stray dogs inside campus", "broken stairs railing may cause injury", "no security guard at gate", "emergency exit blocked", "slippery floor someone may fall"],
    "Other": ["parking space issue", "noise from construction", "need a new notice board", "timetable clash problem", "request for extra chairs", "staff behaviour concern"],
}
DEPT = {"Equipment": "IT & Lab Support", "Plumbing": "Maintenance", "Electrical": "Electrical Dept", "Network": "IT & Network", "Cleanliness": "Housekeeping", "Safety": "Security & Safety", "Other": "Administration"}
KEYS = {"Equipment": ["projector", "printer", "computer", "smart board", "microphone", "whiteboard", "elevator", "appliance"], "Plumbing": ["tap", "toilet", "pipe", "geyser", "drain", "leak", "water", "sewer"], "Electrical": ["socket", "fan", "light", "switch", "power", "wiring", "spark", "electric", "ac"], "Network": ["wifi", "wi-fi", "internet", "router", "lan", "server", "portal", "broadband"], "Cleanliness": ["garbage", "dustbin", "dirty", "smell", "clean", "pest", "rodent", "mold"], "Safety": ["fire", "security", "stray", "railing", "slippery", "unsafe", "hazard"]}
OBJECTS = ["projector", "wifi", "router", "internet", "computer", "printer", "ac", "fan", "light", "tap", "toilet", "washroom", "geyser", "pipe", "lift", "door", "socket", "switch", "microphone", "whiteboard", "garbage", "dustbin", "water", "power", "stairs", "server", "portal"]
FAULTS = [(r"not working|n'?t (?:been )?working|stopped working|dead|out of order", "failure"), (r"broken|damaged|cracked|burst", "damage"), (r"leak\w*", "leakage"), (r"block\w*|clog\w*", "blockage"), (r"slow", "slowness"), (r"dirty|smell\w*", "hygiene issue"), (r"no (?:water|power|network)|outage|down", "outage"), (r"spark\w*|exposed|unsafe", "safety hazard"), (r"missing", "missing item")]
LOC = re.compile(r"\b((?:hostel\s+)?(?:lab|room|hall|block|floor|building|ward|wing|flat)\s*(?:no\.?\s*)?(?:[A-Za-z]?-?\d+[A-Za-z]?|[A-Z]\b)|(?:the\s+)?(?:library|canteen|cafeteria|auditorium|parking|main gate|corridor))", re.I)
DEADLINE = re.compile(r"\b((?:practical|viva|final|mid-?term)?\s*(?:exam|test|interview|inspection|presentation|submission|deadline)s?\s*(?:is|are)?\s*(?:tomorrow|today|tonight|on \w+|next \w+|in \d+ days?)?|tomorrow|tonight|today|asap|immediately)\b", re.I)
DURATION = re.compile(r"\b(?:for|since|past|last)\s+(?:the\s+)?(?:last\s+)?(\d+|a|one|two|three|four|five|several)\s*(hours?|days?|weeks?|months?)\b|\bsince\s+(?:last|previous)\s+()(week|month)\b", re.I)
NEG = ["worst", "terrible", "horrible", "unacceptable", "angry", "frustrated", "fed up", "useless", "again", "still", "nobody", "ignored", "dangerous"]
CRIT = ["fire", "spark", "injury", "emergency", "electric shock", "gas leak", "flood", "burst", "exposed", "dangerous", "unsafe"]
PRESS = ["exam", "tomorrow", "tonight", "today", "asap", "immediately", "urgent", "deadline", "interview", "inspection", "viva"]
DAYS = {"hour": 0.05, "day": 1, "week": 7, "month": 30}
NUM = {"a": 1, "one": 1, "two": 2, "three": 3, "four": 4, "five": 5, "several": 4}

_MODEL_PATH = pathlib.Path(__file__).parent / "model.pkl"

def _load_model():
    if _MODEL_PATH.exists():
        with open(_MODEL_PATH, "rb") as f:
            m = pickle.load(f)
        print("Loaded model.pkl")
        return m["vec"], m["clf"]
    print("model.pkl not found – using SEED classifier")
    texts = [t for v in SEED.values() for t in v]
    labels = [c for c, v in SEED.items() for _ in v]
    vec = TfidfVectorizer(ngram_range=(1, 2), sublinear_tf=True)
    clf = LogisticRegression(max_iter=1000, C=10).fit(vec.fit_transform(texts), labels)
    return vec, clf

_vec, _clf = _load_model()

def classify(text):
    p = _clf.predict_proba(_vec.transform([text]))[0].copy()
    low = f" {text.lower()} "
    for i, c in enumerate(_clf.classes_):
        p[i] += 0.35 * min(2, sum(k in low for k in KEYS.get(c, [])))
    p /= p.sum()
    i = int(np.argmax(p))
    return str(_clf.classes_[i]), float(p[i])

def issue(text):
    low = text.lower()
    obj = next((o for o in OBJECTS if re.search(rf"\b{o}\b", low)), None)
    fault = next((f for pat, f in FAULTS if re.search(pat, low)), None)
    return " ".join(x for x in (obj and obj.title(), fault) if x) or "General issue"

def entities(text):
    loc = [m.group(0).strip().title() for m in LOC.finditer(text)]
    if nlp:
        loc += [e.text for e in nlp(text).ents if e.label_ in ("FAC", "LOC")]
    dl = [m.group(0).strip() for m in DEADLINE.finditer(text) if m.group(0).strip()]
    du = DURATION.search(text)
    return (loc[0] if loc else None), (dl[0] if dl else None), du

def sentiment(text):
    s = -sum(w in text.lower() for w in NEG) / 3
    s = max(-1.0, min(1.0, s))
    return s, "negative" if s < -0.15 else "neutral"

def urgency(text, cat, deadline, du):
    low, score = text.lower(), 0.15
    if cat == "Safety" or any(w in low for w in CRIT):
        score += 0.55
    if deadline or any(w in low for w in PRESS):
        score += 0.35
    if du:
        g = [x for x in du.groups() if x is not None]
        n = g[0].lower() if len(g) > 1 and g[0] else "1"
        n = int(n) if n.isdigit() else NUM.get(n, 1)
        days = n * DAYS.get(g[-1].lower().rstrip("s"), 1)
        score += min(0.25, days / 30 + (0.1 if days >= 2 else 0))
    score += max(0, -sentiment(text)[0]) * 0.15 + 0.05 * (cat in ("Network", "Equipment", "Electrical"))
    score = min(1.0, score)
    return round(score, 2), "Critical" if score >= 0.75 else "High" if score >= 0.5 else "Medium" if score >= 0.3 else "Low"

def similarities(query, corpus):
    if not corpus:
        return []
    if embedder:
        e = embedder.encode([query] + corpus, normalize_embeddings=True)
        return (e[1:] @ e[0]).tolist()
    X = TfidfVectorizer(ngram_range=(1, 2), stop_words="english", sublinear_tf=True).fit_transform(corpus + [query])
    return cosine_similarity(X[-1], X[:-1])[0].tolist()

def duplicates(text, existing, location):
    th = 0.7 if embedder else 0.3
    key = issue(text).split()[0]
    out = []
    for e, s in zip(existing, similarities(text, [x["text"] for x in existing])):
        same = bool(location and e.get("location") and e["location"].lower() == location.lower())
        s = min(1.0, s + 0.1 * same + 0.3 * (same and key == issue(e["text"]).split()[0]))
        if s >= th:
            out.append({"id": e["id"], "text": e["text"], "similarity": round(s, 3)})
    return sorted(out, key=lambda d: -d["similarity"])

def analyze(text, existing=()):
    cat, conf = classify(text)
    loc, deadline, du = entities(text)
    u_score, u_label = urgency(text, cat, deadline, du)
    s_score, s_label = sentiment(text)
    return {"category": cat, "confidence": round(conf, 3), "department": DEPT[cat], "location": loc, "issue": issue(text),
            "urgency": u_label, "urgency_score": u_score, "sentiment": s_label, "sentiment_score": round(s_score, 2),
            "deadline_context": deadline, "duration": du.group(0) if du else None, "duplicates": duplicates(text, list(existing), loc)}

class Existing(BaseModel):
    id: str
    text: str
    location: str | None = None

class Req(BaseModel):
    text: str
    existing: list[Existing] = []

app = FastAPI()
app.add_middleware(CORSMiddleware, allow_origins=["*"], allow_methods=["*"], allow_headers=["*"])

@app.post("/analyze")
def analyze_route(r: Req):
    return analyze(r.text, [e.model_dump() for e in r.existing])
