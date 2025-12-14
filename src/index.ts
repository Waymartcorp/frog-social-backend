import express from "express";
import cors from "cors"; 
import { randomUUID } from "crypto";
import { ensureThread, db, addMessage } from "../lib/db";
// We import the new Multi-Agent Brain
import { generateDraftDelta } from "../lib/real_ai"; 

const app = express();

app.use(cors()); 
// INCREASED LIMIT: We need 50mb to allow sending photos!
app.use(express.json({ limit: '50mb' })); 

// ---------------------------------------------------------
// THE FRONTEND (UI)
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

      // Convert image file to Base64 string so we can send it as text
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

        // 1. Show local preview immediately
        const msgDiv = document.createElement("div");
        msgDiv.className = "msg";
        let content = "<strong>User:</strong> " + (text || "(Image Only)");
        
        if (file) {
           imageUrl = await convertToBase64(file);
           content += "<br><img src='" + imageUrl + "' style='max-height: 100px'>";
        }
        msgDiv.innerHTML = content;
        messagesDiv.appendChild(msgDiv);
        
        // Clear inputs
        textInput.value = "";
        fileInput.value = "";

        // 2. Send to Server
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

// --- 1. THE REDIRECT FIX ---
// If you visit the homepage "/", go straight to the demo
app.get("/", (req, res) => {
  res.redirect("/frog-demo");
});

// --- 2. SERVE THE DEMO ---
app.get(["/frog-demo", "/frog-demo.html"], (req, res) => res.send(FROG_DEMO_HTML));

app.post("/api/thread", (req, res) => {
  const threadId = ensureThread();
  res.json({ threadId });
});

app.post("/api/thread/:threadId/message", async (req, res) => {
  try {
    const threadId = ensureThread(req.params.threadId);
    const { author, text, imageUrl } = req.body;
    
    // Save message (Note: We are not saving the Base64 image in the simple DB to keep it light)
    const msg = addMessage(threadId, author, text); 
    const draftState = db.drafts.get(threadId);

    // CALL THE NEW BRAIN (With Banana Pro support)
    const aiResult = await generateDraftDelta(threadId, { ...msg, imageUrl }, {
      revision: draftState.revision,
      doc: draftState.doc,
    });

    const nextDoc = {
      summary: aiResult.summary || draftState.doc.summary,
      extracted: aiResult.extracted || draftState.doc.extracted,
      highlights: aiResult.highlights || draftState.doc.highlights,
    };

    draftState.revision = aiResult.draft_revision;
    draftState.doc = nextDoc;

    res.json({ draft: nextDoc });
  } catch (err: any) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

const PORT = Number(process.env.PORT) || 4000;
app.listen(PORT, "0.0.0.0", () => console.log(`✅ Vision Demo running on port ${PORT}`));
