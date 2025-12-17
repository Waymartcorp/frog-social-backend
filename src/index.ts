import express from "express";
import cors from "cors"; 
import { randomUUID } from "crypto";
import { ensureThread, db, addMessage, updateDraft } from "../lib/db";
import { generateDraftDelta } from "../lib/real_ai"; 
// We need this to read the list of threads from the DB
import { Pool } from "pg";

const app = express();
app.use(cors()); 
app.use(express.json({ limit: '50mb' })); 

// Quick access to DB for the feed
const pool = new Pool({ connectionString: process.env.DATABASE_URL, ssl: true });

// ---------------------------------------------------------
// FRONTEND: DASHBOARD & FEED
// ---------------------------------------------------------
const FROG_DEMO_HTML = `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <title>Frog Social – Community Feed</title>
    <style>
      body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif; margin: 0; background: #f0f2f5; height: 100vh; display: flex; flex-direction: column; }
      header { background: #2c3e50; color: white; padding: 15px; text-align: center; font-weight: bold; font-size: 18px; }
      .container { display: flex; flex: 1; overflow: hidden; }
      
      /* LEFT: THE FEED (Slack Sidebar) */
      .sidebar { width: 300px; background: #fff; border-right: 1px solid #ddd; overflow-y: auto; display: flex; flex-direction: column; }
      .feed-item { padding: 15px; border-bottom: 1px solid #eee; cursor: pointer; transition: 0.2s; }
      .feed-item:hover { background: #f9f9f9; }
      .feed-item h4 { margin: 0 0 5px 0; font-size: 14px; color: #333; }
      .feed-item p { margin: 0; font-size: 12px; color: #666; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
      .refresh-btn { margin: 10px; padding: 10px; background: #eee; border: none; cursor: pointer; border-radius: 6px; }

      /* RIGHT: THE CHAT */
      .main { flex: 1; display: flex; flex-direction: column; padding: 20px; overflow-y: auto; }
      .card { background: #fff; border-radius: 12px; padding: 20px; border: 1px solid #ddd; margin-bottom: 20px; box-shadow: 0 2px 5px rgba(0,0,0,0.05); }
      .msg { background: #f6f6f6; border-radius: 8px; padding: 12px; margin-bottom: 8px; font-size: 14px; }
      .controls { display: flex; gap: 10px; margin-top: 15px; }
      input[type="text"] { flex: 1; padding: 12px; border: 1px solid #ddd; border-radius: 8px; outline: none; }
      button.primary { background: #007bff; color: white; border: none; padding: 10px 20px; border-radius: 8px; font-weight: bold; cursor: pointer; }
      button.primary:hover { background: #0056b3; }
      
      /* DATA BOX */
      pre { background: #2d2d2d; color: #50ff50; padding: 15px; border-radius: 8px; overflow-x: auto; font-size: 12px; }
      img { max-width: 100%; border-radius: 8px; margin-top: 8px; }
      .badge { display: inline-block; padding: 4px 8px; border-radius: 12px; font-size: 10px; font-weight: bold; text-transform: uppercase; margin-right: 5px; }
      .badge-red { background: #ffebeb; color: #d63031; }
      .badge-green { background: #e6fffa; color: #00b894; }
    </style>
  </head>
  <body>
    <header>🐸 Frog Social: Expert Protocol Beta</header>
    <div class="container">
      
      <div class="sidebar">
        <button class="refresh-btn" onclick="loadFeed()">🔄 Refresh Feed</button>
        <div id="feedList">Loading cases...</div>
      </div>

      <div class="main">
        <div class="card">
          <h2 id="threadTitle">New Case</h2>
          <div style="font-size: 12px; color: #999; margin-bottom: 10px">Thread ID: <span id="threadId">...</span></div>
          
          <div id="messages" style="max-height: 400px; overflow-y: auto; margin-bottom: 15px;"></div>
          
          <div class="controls">
            <input type="text" id="textInput" placeholder="Describe symptoms (e.g. 'Bloated, temp 75F')..." />
          </div>
          <div class="controls">
             <input type="file" id="fileInput" accept="image/*" />
             <button class="primary" onclick="sendMessage()">Analyze Case</button>
          </div>
        </div>

        <div class="card">
          <h3>🧬 Expert Protocol Analysis</h3>
          <div id="summaryBox" style="margin-bottom: 10px; line-height: 1.5; color: #444;">—</div>
          <pre id="extractedBox">Waiting for data...</pre>
        </div>
      </div>
    </div>

    <script>
      let currentThreadId = null;

      // --- FEED LOGIC ---
      async function loadFeed() {
        const res = await fetch("/api/feed");
        const cases = await res.json();
        const list = document.getElementById("feedList");
        list.innerHTML = "";
        
        cases.forEach(c => {
          const div = document.createElement("div");
          div.className = "feed-item";
          // If there's a summary, show it, otherwise show thread ID
          const title = c.summary ? c.summary.substring(0, 40) + "..." : "Untitled Case";
          div.innerHTML = "<h4>" + title + "</h4><p>" + new Date(c.created_at).toLocaleString() + "</p>";
          div.onclick = () => loadThread(c.thread_id);
          list.appendChild(div);
        });
      }

      function loadThread(id) {
        currentThreadId = id;
        document.getElementById("threadId").textContent = id;
        document.getElementById("messages").innerHTML = "<div class='msg'><em>Loaded history... (Hidden for demo simplicity)</em></div>";
        document.getElementById("threadTitle").textContent = "Viewing Case";
        // In a real app, we would fetch the message history here
      }

      async function createNewThread() {
        const res = await fetch("/api/thread", { method: "POST" });
        const data = await res.json();
        currentThreadId = data.threadId;
        document.getElementById("threadId").textContent = currentThreadId;
        document.getElementById("threadTitle").textContent = "New Case";
        loadFeed(); // Refresh sidebar
      }

      // --- CHAT LOGIC ---
      function convertToBase64(file) {
        return new Promise((resolve, reject) => {
          const reader = new FileReader();
          reader.readAsDataURL(file);
          reader.onload = () => resolve(reader.result);
          reader.onerror = error => reject(error);
        });
      }

      async function sendMessage() {
        if (!currentThreadId) await createNewThread();
        
        const textInput = document.getElementById("textInput");
        const fileInput = document.getElementById("fileInput");
        const extractedBox = document.getElementById("extractedBox");
        const summaryBox = document.getElementById("summaryBox");
        const messagesDiv = document.getElementById("messages");

        const text = textInput.value;
        const file = fileInput.files[0];
        let imageUrl = null;

        // Local Preview
        const msgDiv = document.createElement("div");
        msgDiv.className = "msg";
        let content = "<strong>You:</strong> " + (text || "(Image Only)");
        if (file) {
           imageUrl = await convertToBase64(file);
           content += "<br><img src='" + imageUrl + "' style='max-height: 150px'>";
        }
        msgDiv.innerHTML = content;
        messagesDiv.appendChild(msgDiv);
        
        textInput.value = "";
        fileInput.value = "";
        extractedBox.textContent = "🔍 Applying 13-Point Protocol...";
        
        try {
          const res = await fetch("/api/thread/" + currentThreadId + "/message", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ author: "User", text, imageUrl }),
          });

          const data = await res.json();
          const draft = data.draft || {};
          
          summaryBox.textContent = draft.summary || "No summary available.";
          extractedBox.textContent = JSON.stringify(draft.extracted || {}, null, 2);
          
          // Refresh the feed to show the new summary in the sidebar!
          loadFeed(); 
        } catch (e) {
          extractedBox.textContent = "Error: " + e.message;
        }
      }
      
      // Init
      createNewThread();
    </script>
  </body>
</html>`;

// ---------------------------------------------------------
// SERVER ROUTES
// ---------------------------------------------------------

app.get("/", (req, res) => res.redirect("/frog-demo"));
app.get(["/frog-demo", "/frog-demo.html"], (req, res) => res.send(FROG_DEMO_HTML));

// --- API: FEED (New!) ---
app.get("/api/feed", async (req, res) => {
  try {
    // Get last 10 threads + their summaries
    const client = await pool.connect();
    const result = await client.query(`
      SELECT t.id as thread_id, t.created_at, d.summary 
      FROM threads t
      LEFT JOIN drafts d ON t.id = d.thread_id
      ORDER BY t.created_at DESC
      LIMIT 10
    `);
    client.release();
    res.json(result.rows);
  } catch (err) {
    console.error(err);
    res.json([]);
  }
});

app.post("/api/thread", async (req, res) => {
  try {
    const threadId = await ensureThread(); 
    res.json({ threadId });
  } catch (err: any) {
    res.status(500).json({ error: "DB Error" });
  }
});

app.post("/api/thread/:threadId/message", async (req, res) => {
  try {
    const threadId = await ensureThread(req.params.threadId);
    const { author, text, imageUrl } = req.body;
    
    await addMessage(threadId, author, text, imageUrl); 
    const draftState = await db.drafts.get(threadId);

    const aiResult = await generateDraftDelta(threadId, { ...msg: {author, text}, imageUrl }, {
      revision: draftState?.revision || 0,
      doc: draftState?.doc || { summary: "", extracted: {}, highlights: [] },
    });

    const nextDoc = {
      summary: aiResult.summary || "",
      extracted: aiResult.extracted || {},
      highlights: aiResult.highlights || [],
    };

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
app.listen(PORT, "0.0.0.0", () => console.log(`✅ Frog Social Feed running on port ${PORT}`));
