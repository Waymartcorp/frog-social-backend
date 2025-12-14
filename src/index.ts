// src/index.ts
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

// serve static files from /public (like frog-demo.html)
app.use(express.static(path.join(__dirname, "..", "public")));
app.use(bodyParser.json());

// explicit route for the demo page
app.get("/frog-demo.html", (req, res) => {
  res.sendFile(path.join(__dirname, "..", "public", "frog-demo.html"));
});

// Health check
app.get("/api/health", (req, res) => {
  res.json({ ok: true, status: "Frog Social backend running" });
});

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
app.get("/api/cases", (req, res) => {
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

// --- Frog Social core API ---

// Create or return a thread
app.post("/api/thread", (req, res) => {
  const threadId = ensureThread();
  const thread = db.threads.get(threadId)!;
  res.json(thread);
});

// Post a message to a thread and update the live draft
app.post("/api/thread/:threadId/message", (req, res) => {
  const threadId = ensureThread(req.params.threadId);
  const { author = "anon", text = "" } = req.body ?? {};

  const trimmed = String(text).trim();
  if (!trimmed) {
    return res.status(400).json({ error: "Empty message" });
  }

  const msg = addMessage(threadId, String(author), trimmed);

  const draftState = db.drafts.get(threadId)!;
  const delta = generateDraftDelta(threadId, msg, {
    revision: draftState.revision,
    doc: draftState.doc,
  });

  const nextDoc = applyDelta(draftState.doc, delta);
  draftState.revision = delta.draft_revision;
  draftState.doc = nextDoc;
  draftState.deltas.push(delta);

  res.json({
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

// --- Start the HTTP server ---
const PORT = Number(process.env.PORT) || 4000;

app.listen(PORT, () => {
  console.log(`Frog Social backend listening on port ${PORT}`);
});

// Keep Node's event loop alive even if something strange happens.
// (We can remove this once everything is stable.)
setInterval(() => {
  // no-op
}, 1_000_000_000);
