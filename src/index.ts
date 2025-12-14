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
    userId: re
