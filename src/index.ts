// src/index.ts

import express from "express";
import cors from "cors"; 
import { randomUUID } from "crypto";

// ---------------------------------------------------------
// THESE IMPORTS CONNECT TO YOUR OTHER FILES
// ---------------------------------------------------------
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

// -----------------------------
// Middleware (Fixes connection issues)
// -----------------------------
app.use(cors()); 
app.use(express.json());

// -----------------------------
// INLINE FROG DEMO HTML (Your UI)
// -----------------------------
const FROG_DEMO_HTML = `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <title>Frog Social – Live Draft Demo</title>
    <style>
      body { font-family: system-ui, sans-serif; margin: 16px; background: #f5f5f5; }
      .layout { display: grid; grid-template-columns: 1.3fr 0.9fr; gap: 16px; }
      .card { background: #fff; border-radius: 12px; padding: 12px; border: 1px solid #ddd; }
      .msg { background: #f6f6f6; border-radius: 12px; padding: 8px 10px; margin-bottom: 6px; }
      input, button { font-family: inherit; font-size: 14px; border-radius: 10px; border: 1px solid #ddd; padding: 8px; }
      button { cursor: pointer; background: #eee; }
      button:hover { background: #ddd; }
      pre { background: #f6f6f6; border-radius: 12px; padding: 10px; overflow-x: auto; font-size: 12px; }
    </style>
  </head>
  <body>
    <h1>Frog Social – Live Draft Demo</h1>
    <div class="layout">
      <div class="card">
        <h2>Thread</h2>
        <div style="font-size: 12px; opacity: 0.7">Thread ID: <span id="threadId">…</span></div>
        <div style="margin: 10px 0;"><button id="newThreadBtn">New Thread</button></div>
        <div style="display: flex; gap: 8px; margin-bottom: 10px">
          <input id="authorInput" placeholder="author" style="width: 140px" value="robert" />
          <input id="textInput" placeholder="Message..." style="flex: 1" />
          <button id="sendBtn">Send</button>
        </div>
        <div id="messages"></div>
      </div>
      <div class="card">
        <h2>Live Case Draft</h2>
        <div style="font-size: 12px; opacity: 0.7">Summary</div>
        <div id="summaryBox" class="msg">—</div>
        <div style="font-size: 12px; opacity: 0.7">Extracted</div>
        <pre id="extractedBox">{}</pre>
        <div style="font-size: 12px; opacity: 0.7">Highlights</div>
        <div id="highlightsBox" class="msg">—</div>
      </div>
    </div>
    <script>
      const threadIdSpan = document.getElementById("threadId");
      const messagesDiv = document.getElementById("messages");
      const authorInput = document.getElementById("authorInput");
      const textInput = document.getElementById("textInput");
      const sendBtn = document.getElementById("sendBtn");
      const newThreadBtn = document.getElementById("newThreadBtn");
      
      let currentThreadId = null;
      let localMessages = [];

      function renderMessages() {
        messagesDiv.innerHTML = "";
        localMessages.forEach(msg => {
          const div = document.createElement("div");
          div.className = "msg";
          div.textContent = "[" + msg.author + "] " + msg.text;
          messagesDiv.appendChild(div);
        });
      }

      async function createThread() {
        try {
          const res = await fetch("/api/thread", { method: "POST" });
          const data = await res.json();
          currentThreadId = data.threadId || data.thread?.id;
          threadIdSpan.textContent = currentThreadId || "Error";
          localMessages = [];
          renderMessages();
          summaryBox.textContent = "—";
          extractedBox.textContent = "{}";
          highlightsBox.textContent = "—";
        } catch(e) { console.error(e); alert("Backend not running?"); }
      }

      async function sendMessage() {
        if (!currentThreadId) await createThread();
        const author = authorInput.value || "anon";
        const text = textInput.value || "";
        if (!text.trim()) return;

        localMessages.push({ author, text });
        renderMessages();
        textInput.value = "";

        const res = await fetch("/api/thread/" + currentThreadId + "/message", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ author, text }),
        });
        
        if(res.ok) {
          const data = await res.json();
          const draft = data.draft || {};
          summaryBox.textContent = draft.summary || "—";
          extractedBox.textContent = JSON.stringify(draft.extracted || {}, null, 2);
          highlightsBox.textContent = (draft.highlights || []).join(" | ");
        }
      }

      newThreadBtn.onclick = createThread;
      sendBtn.onclick = sendMessage;
      textInput.onkeydown = (e) => { if(e.key === "Enter") sendMessage(); };
      createThread();
    </script>
  </body>
</html>`;

// -----------------------------
// Routes
// -----------------------------

app.get("/", (_req, res) => {
  res.send("Frog Social backend is running. Go to <a href='/frog-demo'>/frog-demo</a>");
});

app.get(["/frog-demo", "/frog-demo.html"], (_req, res) => {
  res.type("html").send(FROG_DEMO_HTML);
});

app.get("/api/health", (_req, res) => {
  res.json({ ok: true, status: "Frog Social backend running" });
});

// --- CASE API ---

app.post("/api/messages", (req, res) => {
  if (!req.body.content) return res.status(400).json({ error: "No content" });
  
  const now = new Date();
  const message: ForumMessage = {
    id: randomUUID(),
    userId: req.body.userId || "demo-user",
    facilityId: req.body.facilityId,
    threadId: req.body.threadId || randomUUID(),
    content: req.body.content,
    createdAt: now,
  };

  const frogCase = handleNewMessage(message);
  res.json({ ok: true, frogCase });
});

app.get("/api/cases", (_req, res) => {
  res.json(listCases());
});

app.get("/api/cases/:id", (req, res) => {
  const frogCase = getCaseById(req.params.id);
  if (!frogCase) return res.status(404).json({ error: "Case not found" });
  res.json(frogCase);
});

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

// --- THREAD / DRAFT API ---

app.post("/api/thread", (_req, res) => {
  try {
    const threadId = ensureThread();
    const thread = db.threads.get(threadId);
    if (!thread) throw new Error("Thread creation failed");
    res.status(201).json({ threadId, thread });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

app.post("/api/thread/:threadId/message", (req, res) => {
  try {
    const threadId = ensureThread(req.params.threadId);
    const { author = "anon", text = "" } = req.body ?? {};
    const trimmed = String(text).trim();

    if (!trimmed) return res.status(400).json({ error: "Empty message" });

    const msg = addMessage(threadId, String(author), trimmed);
    const draftState = db.drafts.get(threadId);

    if (!draftState) return res.status(404).json({ error: "Draft state missing" });

    const delta = generateDraftDelta(threadId, msg, {
      revision: draftState.revision,
      doc: draftState.doc,
    });

    const nextDoc = applyDelta(draftState.doc, delta);
    draftState.revision = delta.draft_revision;
    draftState.doc = nextDoc;
    draftState.deltas.push(delta);

    res.status(201).json({ message: msg, delta, draft: nextDoc });
  } catch (err: any) {
    console.error(err);
    res.status(500).json({ error: "Internal Server Error" });
  }
});

app.get("/api/thread/:threadId/draft", (req, res) => {
  const threadId = ensureThread(req.params.threadId);
  const draft = db.drafts.get(threadId);
  if (!draft) return res.status(404).json({ error: "Draft not found" });

  res.json({
    thread_id: threadId,
    revision: draft.revision,
    doc: draft.doc,
    recent_deltas: draft.deltas.slice(-10),
  });
});

// -----------------------------
// Start Server
// -----------------------------
const PORT = Number(process.env.PORT) || 4000;

app.listen(PORT, "0.0.0.0", () => {
  console.log(`✅ Frog Social backend listening on http://localhost:${PORT}`);
});
