import express from "express";
import bodyParser from "body-parser";
import { randomUUID } from "crypto";
import path from "path";

import {
  handleNewMessage,
  listCases,
  getCaseById,
  submitCaseResolution,
  type ForumMessage,
  type ResolutionInput,
} from "./frogCases";

import { ensureThread, db, addMessage } from "../lib/db";
import { generateDraftDelta } from "../lib/fake_ai";
import { applyDelta } from "../lib/apply_delta";

const app = express();

// 🔴 THIS LINE IS CRITICAL 🔴
// Serve everything in /public (frog-demo.html, etc.)
app.use(express.static(path.join(process.cwd(), "public")));

// Parse JSON bodies for API routes
app.use(bodyParser.json());

// -----------------------------
// Demo page routes
// -----------------------------

// Use process.cwd() so this works the same with ts-node
const demoPath = path.join(process.cwd(), "public", "frog-demo.html");

app.get("/", (_req, res) => {
  res.send("Frog Social backend is running. Try /frog-demo or /frog-demo.html");
});

app.get("/frog-demo", (_req, res) => {
  res.sendFile(demoPath);
});

app.get("/frog-demo.html", (_req, res) => {
  res.sendFile(demoPath);
});

// -----------------------------
// Health check
// -----------------------------

app.get("/api/health", (_req, res) => {
  res.json({ ok: true, status: "Frog Social backend running" });
});

// -----------------------------
// Legacy case + message API
// -----------------------------

// "Describe a problem" → create message + maybe new case
app.post("/api/messages", (req, res) => {
  const now = new Date();

  const message: ForumMessage = {
    id: randomUUID(),
    userId: req.body.userId || "demo-user",
    facilityId: req.body.facilityId,
    threadId: req.body.threadId || randomUUID(), // new thread if none provided
    content: req.body.content,
    createdAt: now,
  };

  const frogCase = handleNewMessage(message);
  res.json({ ok: true, frogCase });
});

// List cases
app.get("/api/cases", (_req, res) => {
  const cases = listCases();
  res.json(cases);
});

// Single case
app.get("/api/cases/:id", (req, res) => {
  const frogCase = getCaseById(req.params.id);
  if (!frogCase) return res.status(404).json({ error: "Case not found" });
  res.json(frogCase);
});

// Submit resolution
app.post("/api/cases/:id/resolution", (req, res) => {
  const input: ResolutionInput = {
    caseId: req.params.id,
    userId: req.body.userId || "demo-user",
    outcome: req.body.outcome,
    freeText: req.body.freeText,
  };

  const updated = submitCaseResolution(input);
  if (!updated) return res.status(404).json({ error: "Case not found" });
  res.json(updated);
});

// -----------------------------
// Frog Social thread/draft API
// -----------------------------

// Create a thread (or return a new one) – returns both threadId and thread
app.post("/api/thread", (_req, res) => {
  const threadId = ensureThread();
  const thread = db.threads.get(threadId)!;
  res.status(201).json({ threadId, thread });
});

// Post a message to a thread and update the live draft
app.post("/api/thread/:threadId/message", (req, res) => {
  const threadId = ensureThread(req.params.threadId);
  const { author = "anon", text = "" } = req.body ?? {};

  const trimmed = String(text).trim();
  if (!trimmed) {
    return res.status(400).json({ error: "Empty message" });
  }

  // store the message in our in-memory DB
  const msg = addMessage(threadId, String(author), trimmed);

  const draftState = db.drafts.get(threadId)!;

  // generate a delta using your fake_ai module
  const delta = generateDraftDelta(threadId, msg, {
    revision: draftState.revision,
    doc: draftState.doc,
  });

  const nextDoc = applyDelta(draftState.doc, delta);
  draftState.revision = delta.draft_revision;
  draftState.doc = nextDoc;
  draftState.deltas.push(delta);

  res.status(201).json({
    message: msg,
    delta,
    draft: nextDoc,
  });
});

// Get the current live draft for a thread
app.get("/api/thread/:threadId/draft", (req, res) => {
  const threadId = ensureThread(req.params.threadId);
  const draft = db.drafts.get(threadId)!;

  res.json({
    thread_id: threadId,
    revision: draft.revision,
    doc: draft.doc,
    recent_deltas: draft.deltas.slice(-10),
  });
});

// -----------------------------
// Start the HTTP server
// -----------------------------

const PORT = Number(process.env.PORT) || 4000;

app.listen(PORT, () => {
  console.log(`Frog Social backend listening on port ${PORT}`);
});

// Keep Node alive even if something odd happens with listeners.
// We can remove this later once everything is stable.
setInterval(() => {
  // no-op
}, 1_000_000_000);
