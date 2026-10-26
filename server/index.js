import express from "express";
import mongoose from "mongoose";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import cors from "cors";
import "dotenv/config";

const { MONGO_URI, JWT_SECRET, NLP_URL = "http://127.0.0.1:8000", ADMIN_EMAIL, PORT = 5000 } = process.env;

const User = mongoose.model("User", new mongoose.Schema({
  institution: { type: String, required: true, trim: true },
  name: String,
  email: { type: String, unique: true, lowercase: true },
  password: String,
  role: { type: String, default: "user" }
}));

const Counter = mongoose.model("Counter", new mongoose.Schema({ _id: String, seq: { type: Number, default: 0 } }));

const CSchema = new mongoose.Schema({
  institution: String,
  user: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
  building: String, room: String, floor: String,
  text: String, nlpText: String,
  category: String, department: String, nlpLocation: String, issue: String,
  urgency: String, score: Number, sentiment: String, deadline: String, duration: String,
  dupOf: String, votes: { type: Number, default: 0 },
  contactName: String, contactEmail: String, contactPhone: String,
  receiptId: { type: String, unique: true, sparse: true },
  status: { type: String, default: "Submitted", enum: ["Submitted", "Assigned", "In Progress", "Resolved"] }
}, { timestamps: true });

CSchema.pre("save", async function (next) {
  if (this.isNew && !this.receiptId) {
    const year = new Date().getFullYear();
    const c = await Counter.findOneAndUpdate({ _id: `cx-${year}` }, { $inc: { seq: 1 } }, { upsert: true, new: true });
    this.receiptId = `CX-${year}-${String(c.seq).padStart(5, "0")}`;
  }
  next();
});

const Complaint = mongoose.model("Complaint", CSchema);

const nlp = async (text, institution) => {
  if (!NLP_URL) {
    console.error("NLP_URL not configured");
    throw new Error("NLP service not configured");
  }
  console.log("Calling NLP service", { snippet: text.slice(0, 100), institution });
  const open = await Complaint.find({ institution, status: { $ne: "Resolved" } }).sort({ createdAt: -1 }).limit(200);
  const existing = open.map(c => ({ id: String(c._id), text: c.nlpText || c.text, location: c.nlpLocation }));
  try {
    const r = await fetch(`${NLP_URL}/analyze`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text, existing })
    });
    if (!r.ok) {
      const errText = await r.text();
      console.error("NLP service error", r.status, errText);
      throw new Error("NLP service unavailable");
    }
    return await r.json();
  } catch (e) {
    console.error("Error calling NLP service:", e);
    throw new Error("NLP service unavailable");
  }
};

const nlpFields = a => ({
  category: a.category, department: a.department, nlpLocation: a.location, issue: a.issue,
  urgency: a.urgency, score: a.urgency_score, sentiment: a.sentiment, deadline: a.deadline_context, duration: a.duration
});

const sign = u => jwt.sign({ id: u._id, role: u.role, name: u.name, institution: u.institution }, JWT_SECRET, { expiresIn: "7d" });
const session = u => ({ token: sign(u), name: u.name, role: u.role, institution: u.institution });

const auth = (req, res, next) => {
  try { req.user = jwt.verify((req.headers.authorization || "").replace("Bearer ", ""), JWT_SECRET); next(); }
  catch { res.status(401).json({ error: "Please log in" }); }
};
const admin = (req, res, next) => req.user.role === "admin" ? next() : res.status(403).json({ error: "Admins only" });
const h = fn => (req, res) => fn(req, res).catch(e => res.status(500).json({ error: e.message }));

const app = express();
app.use(cors());
app.use(express.json());

app.post("/api/auth/register", h(async (req, res) => {
  const { institution, name, email, password } = req.body;
  if (!institution?.trim()) return res.status(400).json({ error: "Institution is required" });
  if (!name || !email || !password || password.length < 6) return res.status(400).json({ error: "Name, email and a 6+ char password required" });
  if (await User.findOne({ email: email.toLowerCase() })) return res.status(400).json({ error: "Email already registered" });
  const role = ADMIN_EMAIL && email.toLowerCase() === ADMIN_EMAIL.toLowerCase() ? "admin" : "user";
  const u = await User.create({ institution: institution.trim(), name, email, password: await bcrypt.hash(password, 10), role });
  res.json(session(u));
}));

app.post("/api/auth/login", h(async (req, res) => {
  const { institution, email, password } = req.body;
  if (!institution?.trim()) return res.status(400).json({ error: "Institution is required" });
  const u = await User.findOne({ email: (email || "").toLowerCase() });
  if (!u || !(await bcrypt.compare(password || "", u.password))) return res.status(400).json({ error: "Wrong email or password" });
  if (!u.institution || u.institution.toLowerCase() !== institution.trim().toLowerCase()) return res.status(400).json({ error: "Wrong institution" });
  res.json(session(u));
}));

app.post("/api/complaints/analyze", auth, h(async (req, res) => {
  if (!req.body.text?.trim()) return res.status(400).json({ error: "Write your complaint first" });
  res.json(await nlp(req.body.text, req.user.institution));
}));

app.post("/api/complaints", auth, h(async (req, res) => {
  const { building, room, floor, text, nlpText, contactName, contactEmail, contactPhone } = req.body;
  if (!text?.trim()) return res.status(400).json({ error: "Complaint text is required" });
  let extra = {};
  try { const a = await nlp(nlpText || text, req.user.institution); extra = { ...nlpFields(a), dupOf: a.duplicates?.[0]?.id }; } catch {}
  const c = await Complaint.create({
    institution: req.user.institution, user: req.user.id,
    building, room, floor, text, nlpText,
    contactName: contactName || req.user.name, contactEmail, contactPhone,
    ...extra
  });
  res.json(c);
}));

app.get("/api/complaints", auth, h(async (req, res) => {
  const { category, status, page = 1, limit = 20 } = req.query;
  const q = { institution: req.user.institution };
  if (req.user.role !== "admin") q.user = req.user.id;
  if (category) q.category = category;
  if (status) q.status = status;
  const total = await Complaint.countDocuments(q);
  const p = Math.max(1, +page);
  const data = await Complaint.find(q).populate("user", "name").sort({ score: -1, createdAt: -1 }).skip((p - 1) * +limit).limit(+limit);
  res.json({ data, total, page: p, pages: Math.ceil(total / +limit) });
}));

app.get("/api/complaints/:id", auth, h(async (req, res) => {
  const c = await Complaint.findOne({ _id: req.params.id, institution: req.user.institution }).populate("user", "name");
  if (!c) return res.status(404).json({ error: "Not found" });
  res.json(c);
}));

app.post("/api/complaints/:id/upvote", auth, h(async (req, res) => {
  const c = await Complaint.findOne({ _id: req.params.id, institution: req.user.institution });
  if (!c) return res.status(404).json({ error: "Not found" });
  c.votes += 1; c.score = Math.min(1, +(c.score + 0.05).toFixed(2));
  await c.save(); res.json(c);
}));

app.patch("/api/complaints/:id/status", auth, admin, h(async (req, res) => {
  const c = await Complaint.findOneAndUpdate({ _id: req.params.id, institution: req.user.institution }, { status: req.body.status }, { new: true, runValidators: true });
  res.json(c);
}));

app.get("/api/analytics", auth, admin, h(async (req, res) => {
  const all = await Complaint.find({ institution: req.user.institution });
  const count = key => all.reduce((m, c) => ((m[c[key]] = (m[c[key]] || 0) + 1), m), {});
  const done = all.filter(c => c.status === "Resolved");
  const hours = done.length ? done.reduce((s, c) => s + (c.updatedAt - c.createdAt) / 36e5, 0) / done.length : 0;
  res.json({ total: all.length, byCategory: count("category"), byStatus: count("status"), byUrgency: count("urgency"), avgResolutionHours: +hours.toFixed(1) });
}));

mongoose.connect(MONGO_URI).then(() => app.listen(PORT, () => console.log(`API on :${PORT}`))).catch(e => { console.error(e.message); process.exit(1); });
