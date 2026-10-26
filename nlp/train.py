import pickle, pathlib, io
import numpy as np
import pandas as pd
from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.linear_model import LogisticRegression
from sklearn.model_selection import train_test_split
from sklearn.metrics import classification_report, accuracy_score

NYC_URL = (
    "https://data.cityofnewyork.us/resource/erm2-nwe9.csv"
    "?$select=complaint_type,descriptor&$limit=50000&$where=complaint_type+IS+NOT+NULL"
)

MAPPING = {
    "HEAT/HOT WATER": "Plumbing",
    "PLUMBING": "Plumbing",
    "Water System": "Plumbing",
    "Sewer": "Plumbing",
    "WATER LEAK": "Plumbing",
    "Boiler": "Plumbing",
    "Water Quality": "Plumbing",
    "GENERAL": "Other",
    "ELECTRIC": "Electrical",
    "Electrical": "Electrical",
    "Electric": "Electrical",
    "PAINT/PLASTER": "Other",
    "ELEVATOR": "Equipment",
    "Elevator": "Equipment",
    "DOOR/WINDOW": "Equipment",
    "APPLIANCE": "Equipment",
    "Street Light Condition": "Electrical",
    "Traffic Signal Condition": "Electrical",
    "Broken Muni Meter": "Equipment",
    "Noise - Residential": "Other",
    "Noise - Commercial": "Other",
    "Noise - Street/Sidewalk": "Other",
    "Noise": "Other",
    "NOISE": "Other",
    "Blocked Driveway": "Other",
    "Illegal Parking": "Other",
    "ILLEGAL PARKING": "Other",
    "Street Condition": "Other",
    "Sidewalk Condition": "Safety",
    "Building/Use": "Other",
    "UNSAFE BUILDING": "Safety",
    "Emergency Response Team (ERT)": "Safety",
    "Non-Emergency Police Matter": "Safety",
    "Fire Safety Director - F58": "Safety",
    "Rodent": "Cleanliness",
    "PEST CONTROL": "Cleanliness",
    "Dirty Conditions": "Cleanliness",
    "Sanitation Condition": "Cleanliness",
    "GARBAGE COLLECTION": "Cleanliness",
    "Dirty": "Cleanliness",
    "MISSED COLLECTION": "Cleanliness",
    "Derelict Vehicles": "Cleanliness",
    "Overflowing Litter Baskets": "Cleanliness",
    "Unsanitary Condition": "Cleanliness",
    "Indoor Air Quality": "Cleanliness",
    "Mold": "Cleanliness",
    "Internet": "Network",
    "Wifi": "Network",
    "Broadband": "Network",
    "Telecommunications": "Network",
    "Cable TV": "Network",
    "CABLE": "Network",
}

SEED = {
    "Equipment": ["projector not working in lab", "computer is broken and will not start",
                  "printer jammed and out of order", "microphone and speaker system dead",
                  "smart board not turning on", "lab equipment damaged",
                  "elevator is stuck between floors", "appliance broken in room",
                  "the door won't open and the lock is jammed"],
    "Plumbing": ["water leaking from tap", "toilet is blocked and overflowing",
                 "no water supply in washroom", "pipe burst near corridor",
                 "drainage clogged", "geyser not heating water",
                 "hot water not working in the building", "sewer blocked outside"],
    "Electrical": ["lights not working in classroom", "fan stopped working",
                   "power outage in block", "socket sparking and unsafe",
                   "ac not cooling in room", "exposed wires on switchboard",
                   "street light is out", "electric shock from outlet"],
    "Network": ["wifi not connecting", "internet very slow all day",
                "router is down in library", "lan port not working",
                "cannot access portal server down", "no network in hostel",
                "broadband cable cut", "no internet in the building"],
    "Cleanliness": ["washrooms are dirty", "garbage not collected for days",
                    "dustbins overflowing", "classroom not cleaned",
                    "bad smell in corridor", "pests in canteen",
                    "rodents spotted in the kitchen", "mold growing on walls",
                    "unsanitary conditions in the washroom"],
    "Safety": ["fire extinguisher missing", "stray dogs inside campus",
               "broken stairs railing may cause injury", "no security guard at gate",
               "emergency exit blocked", "slippery floor someone may fall",
               "unsafe building structure", "no fire safety equipment"],
    "Other": ["parking space issue", "noise from construction",
              "need a new notice board", "timetable clash problem",
              "request for extra chairs", "staff behaviour concern",
              "illegal parking blocking driveway", "loud noise from neighbours"],
}


def fetch_nyc() -> pd.DataFrame:
    print("Downloading NYC 311 sample (50 k rows)…")
    try:
        df = pd.read_csv(NYC_URL)
        df = df.dropna(subset=["complaint_type"])
        df["label"] = df["complaint_type"].map(MAPPING)
        df = df.dropna(subset=["label"])
        text_col = "descriptor" if "descriptor" in df.columns else "complaint_type"
        df["text"] = df["complaint_type"].str.strip() + " " + df[text_col].fillna("").str.strip()
        df = df[["text", "label"]]
        print(f"  NYC rows after mapping: {len(df)}")
        return df
    except Exception as e:
        print(f"  NYC download failed ({e}); using SEED only.")
        return pd.DataFrame(columns=["text", "label"])


def seed_df() -> pd.DataFrame:
    rows = [(t, c) for c, ts in SEED.items() for t in ts]
    return pd.DataFrame(rows, columns=["text", "label"])


def train():
    nyc = fetch_nyc()
    base = seed_df()
    df = pd.concat([base, nyc], ignore_index=True).sample(frac=1, random_state=42)

    X, y = df["text"].tolist(), df["label"].tolist()
    X_tr, X_te, y_tr, y_te = train_test_split(X, y, test_size=0.15, random_state=42, stratify=y)

    vec = TfidfVectorizer(ngram_range=(1, 2), sublinear_tf=True, min_df=1)
    clf = LogisticRegression(max_iter=2000, C=10, class_weight="balanced")
    clf.fit(vec.fit_transform(X_tr), y_tr)

    preds = clf.predict(vec.transform(X_te))
    print(f"\nAccuracy: {accuracy_score(y_te, preds):.3f}")
    print(classification_report(y_te, preds))

    out = pathlib.Path(__file__).parent / "model.pkl"
    with open(out, "wb") as f:
        pickle.dump({"vec": vec, "clf": clf}, f)
    print(f"Saved model → {out}")


if __name__ == "__main__":
    train()
