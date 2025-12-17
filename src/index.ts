import express from "express";
import cors from "cors"; 
import { randomUUID } from "crypto";

// 1. Import the new DB functions (including updateDraft)
import { ensureThread, db, addMessage, updateDraft } from "../lib/db";
import { generateDraftDelta } from "../lib/real_ai"; 

const app = express();
app.use(cors()); 
app.use(express.json({ limit: '50mb' })); 

// ---------------------------------------------------------
// FRONTEND (No changes here, just keeping it working)
// ---------------------------------------------------------
const FROG_DEMO_HTML = `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <title>Frog Social – Banana Pro Integration</title>
    <style>
      body { font-family: system-ui, sans-serif; margin: 16px; background: #f0f2f5; }
      .layout { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; max-width: 1000px; margin: 0 auto; }
      .card { background: #fff; border-radius: 12px; padding: 16px; border: 1px solid #ddd; }
      .msg { background: #f6f6f6; border-radius: 8px; padding: 10px; margin-bottom: 8px; font-size: 14px; }
      .controls { display: flex; gap: 8px; margin-top: 10px; }
      input, button { padding: 10px; border-radius: 8px; border: 1px solid #ccc; }
      button { background: #007bff; color: white; border: none; cursor: pointer; font-weight: bold; }
      button:hover { background: #0056b3; }
      pre { background: #2d2d2d; color: #50ff50; padding: 12px; border-radius: 8px; overflow-x: auto; font-size: 12px; }
      img { max-width: 100%; border-radius: 8px; margin-top: 5px; }
    </style>
  </head>
  <body>
    <h1 style="text-align:center">🐸 Frog Social + 🍌 Banana Pro</h1>
    <div class="layout">
      <div class="card">
        <h2>Thread</h2>
        <div style="font-size: 12px; opacity: 0.7; margin-bottom: 10px">Thread ID: <span id="threadId">...</span></div>
        <div id="messages" style="height: 300px; overflow-y: auto; border: 1px solid #eee; padding: 10px; border-radius: 8px; margin-bottom: 10px;"></div>
        
        <div class="controls">
           <input type="text" id="textInput" placeholder="Describe the issue..." style="flex: 1" />
        </div>
        <div class="controls">
           <input type="file" id="fileInput" accept="image/*" />
           <button id="sendBtn" onclick="sendMessage()">Analyze Frog</button>
        </div>
      </div>

      <div class="card">
        <h2>AI Diagnosis</h2>
        <div style="font-size: 12px; opacity: 0.7">Extracted Medical Data</div>
        <pre id="extractedBox">Ready for data...</pre>
        <div style="font-size: 12px; opacity: 0.7; margin-top: 10px">Summary</div>
        <div id="summaryBox" class="msg">—</div>
      </div>
    </div>

    <script>
      const threadIdSpan = document.getElementById("threadId");
      const messagesDiv = document.getElementById("messages");
      const textInput = document.getElementById("textInput");
      const fileInput = document.getElementById("fileInput");
      const summaryBox = document.getElementById("summaryBox");
      const extractedBox = document.getElementById("extractedBox");
      
      let currentThreadId = null;

      async function createThread() {
        const res = await fetch("/api/thread", { method: "POST" });
        const data = await res.json();
        currentThreadId = data.threadId;
        threadIdSpan.textContent = currentThreadId;
      }

      function convertToBase64(file) {
        return new Promise((resolve, reject) => {
          const reader = new FileReader();
          reader.readAsDataURL(file);
          reader.onload = () => resolve(reader.result);
          reader.onerror = error => reject(error);
        });
      }

      async function sendMessage() {
        if (!currentThreadId) await createThread();
        
        const text = textInput.value;
        const file = fileInput.files[0];
        let imageUrl = null;

        const msgDiv = document.createElement("div");
        msgDiv.className = "msg";
        let content = "<strong>User:</strong> " + (text || "(Image Only)");
        if (file) {
           imageUrl = await convertToBase64(file);
           content += "<br><img src='" + imageUrl + "' style='max-height: 100px'>";
        }
        msgDiv.innerHTML = content;
        messagesDiv.appendChild(msgDiv);
        
        textInput.value = "";
        fileInput.value = "";
        extractedBox.textContent = "🍌 Banana Pro is analyzing pixels...";
        
        try {
          const res = await fetch("/api/thread/" + currentThreadId + "/message", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ author: "User", text, imageUrl }),
          });

          const data = await res.json();
          const draft = data.draft || {};
          summaryBox.textContent = draft.summary || "No summary";
          extractedBox.textContent = JSON.stringify(draft.extracted || {}, null, 2);
        } catch (e) {
          extractedBox.textContent = "Error: " + e.message;
        }
      }
      createThread();
    </script>
  </body>
</html>`;

// ---------------------------------------------------------
// SERVER ROUTES
// ---------------------------------------------------------

app.get("/", (req, res) => {
  res.redirect("/frog-demo");
});

app.get(["/frog-demo", "/frog-demo.html"], (req, res) => res.send(FROG_DEMO_HTML));

// --- 2. ASYNC THREAD CREATION ---
app.post("/api/thread", async (req, res) => {
  try {
    const threadId = await ensureThread(); // Waited for DB
    res.json({ threadId });
  } catch (err: any) {
    console.error(err);
    res.status(500).json({ error: "DB Error" });
  }
});

// --- 3. ASYNC MESSAGE HANDLING ---
app.post("/api/thread/:threadId/message", async (req, res) => {
  try {
    const threadId = await ensureThread(req.params.threadId); // Wait for DB
    const { author, text, imageUrl } = req.body;
    
    // Save message to Neon DB
    const msg = await addMessage(threadId, author, text, imageUrl); 
    
    // Get current draft from Neon DB
    const draftState = await db.drafts.get(threadId);

    // Call the AI (Brain + Vision)
    const aiResult = await generateDraftDelta(threadId, { ...msg, imageUrl }, {
      revision: draftState?.revision || 0,
      doc: draftState?.doc || { summary: "", extracted: {}, highlights: [] },
    });

    const nextDoc = {
      summary: aiResult.summary || "",
      extracted: aiResult.extracted || {},
      highlights: aiResult.highlights || [],
    };

    // Save the new diagnosis back to Neon DB
    await updateDraft(threadId, {
      draft_revision: aiResult.draft_revision,
      ...nextDoc
    });

    res.json({ draft: nextDoc });
  } catch (err: any) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

const PORT = Number(process.env.PORT) || 4000;
app.listen(PORT, "0.0.0.0", () => console.log(`✅ Vision + Database running on port ${PORT}`));
