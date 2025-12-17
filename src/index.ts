import express from "express";
import cors from "cors"; 
import { randomUUID } from "crypto";
import { ensureThread, db, addMessage, updateDraft } from "../lib/db";
import { generateDraftDelta } from "../lib/real_ai"; 
import { Pool } from "pg";

const app = express();
app.use(cors()); 
app.use(express.json({ limit: '50mb' })); 

// Connection for the Feed
const pool = new Pool({ connectionString: process.env.DATABASE_URL, ssl: true });

// ---------------------------------------------------------
// FRONTEND: COMMUNITY FEED UI
// ---------------------------------------------------------
const FROG_DEMO_HTML = `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <title>Frog Social – Community</title>
    <style>
      body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif; margin: 0; background: #f0f2f5; height: 100vh; display: flex; flex-direction: column; }
      
      /* HEADER */
      header { background: #2c3e50; color: white; padding: 15px 20px; display: flex; justify-content: space-between; align-items: center; }
      header h1 { margin: 0; font-size: 18px; font-weight: bold; }
      .tos-link { color: #bdc3c7; font-size: 12px; text-decoration: none; cursor: pointer; }
      .tos-link:hover { color: white; text-decoration: underline; }

      /* LAYOUT */
      .container { display: flex; flex: 1; overflow: hidden; }
      
      /* SIDEBAR (Feed) */
      .sidebar { width: 300px; background: #fff; border-right: 1px solid #ddd; display: flex; flex-direction: column; }
      .feed-header { padding: 15px; border-bottom: 1px solid #eee; background: #f8f9fa; font-weight: bold; color: #555; display: flex; justify-content: space-between; }
      .feed-list { flex: 1; overflow-y: auto; }
      .feed-item { padding: 15px; border-bottom: 1px solid #eee; cursor: pointer; transition: 0.2s; }
      .feed-item:hover { background: #eef2f5; }
      .feed-item.active { background: #e3f2fd; border-left: 4px solid #007bff; }
      .feed-date { font-size: 11px; color: #999; margin-top: 4px; }
      .new-btn { margin: 10px; padding: 10px; background: #007bff; color: white; border: none; border-radius: 6px; cursor: pointer; font-weight: bold; }

      /* MAIN CHAT AREA */
      .main { flex: 1; display: flex; flex-direction: column; background: #fff; }
      .chat-header { padding: 15px; border-bottom: 1px solid #ddd; background: #fff; }
      .messages-area { flex: 1; overflow-y: auto; padding: 20px; background: #f0f2f5; }
      .msg { max-width: 80%; margin-bottom: 15px; padding: 12px 16px; border-radius: 12px; font-size: 14px; line-height: 1.5; }
      .msg.user { background: #007bff; color: white; margin-left: auto; border-bottom-right-radius: 2px; }
      .msg.ai { background: #fff; border: 1px solid #ddd; border-bottom-left-radius: 2px; }
      
      /* REPORT CARD (The "Pretty" Output) */
      .report-card { background: #fff; border: 1px solid #e1e4e8; border-radius: 8px; margin-bottom: 20px; overflow: hidden; }
      .report-header { background: #f6f8fa; padding: 10px 15px; border-bottom: 1px solid #e1e4e8; font-weight: bold; color: #24292e; font-size: 13px; display: flex; align-items: center; gap: 8px; }
      .report-body { padding: 15px; }
      .warning-box { background: #fff3cd; color: #856404; padding: 10px; border-radius: 6px; font-size: 13px; margin-bottom: 10px; border: 1px solid #ffeeba; }

      /* INPUT AREA */
      .input-area { padding: 20px; background: #fff; border-top: 1px solid #ddd; display: flex; gap: 10px; align-items: center; }
      input[type="text"] { flex: 1; padding: 12px; border: 1px solid #ddd; border-radius: 20px; outline: none; }
      input[type="file"] { width: 100px; font-size: 12px; }
      button.send { background: #2ecc71; color: white; border: none; padding: 10px 20px; border-radius: 20px; font-weight: bold; cursor: pointer; }
    </style>
  </head>
  <body>
    <header>
      <h1>🐸 Frog Social</h1>
      <a href="#" onclick="alert('Terms of Service: Be kind to frogs. Don\'t post bad advice.')" class="tos-link">Terms of Service</a>
    </header>
    
    <div class="container">
      <div class="sidebar">
        <button class="new-btn" onclick="createNewThread()">+ New Case</button>
        <div class="feed-header">
          <span>Recent Cases</span>
          <span style="cursor:pointer" onclick="loadFeed()">🔄</span>
        </div>
        <div id="feedList" class="feed-list">Loading...</div>
      </div>

      <div class="main">
        <div class="chat-header">
          <h3 id="threadTitle" style="margin:0">Select a case...</h3>
          <div style="font-size: 11px; color: #999; margin-top:2px">ID: <span id="threadId">-</span></div>
        </div>
        
        <div id="messages" class="messages-area"></div>
        
        <div id="aiReport" style="padding: 0 20px; display: none;">
             <div class="report-card">
                <div class="report-header">🧬 Expert Protocol Analysis</div>
                <div class="report-body">
                    <div id="warningsArea"></div>
                    <p id="summaryText" style="color: #444; font-size: 14px; margin: 0;"></p>
                </div>
             </div>
        </div>

        <div class="input-area">
           <input type="file" id="fileInput" accept="image/*" />
           <input type="text" id="textInput" placeholder="Type a message or upload a photo..." />
           <button class="send" onclick="sendMessage()">Send</button>
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
          if(c.thread_id === currentThreadId) div.classList.add("active");
          
          const title = c.summary ? c.summary.substring(0, 35) + "..." : "Untitled Case";
          div.innerHTML = "<strong>" + title + "</strong><div class='feed-date'>" + new Date(c.created_at).toLocaleTimeString() + "</div>";
          div.onclick = () => loadThread(c.thread_id);
          list.appendChild(div);
        });
      }

      function loadThread(id) {
        currentThreadId = id;
        document.getElementById("threadId").textContent = id;
        document.getElementById("threadTitle").textContent = "Viewing Case";
        document.getElementById("messages").innerHTML = "<div style='text-align:center; color:#999; margin-top:20px'>History loaded from database...</div>";
        document.getElementById("aiReport").style.display = "none";
        loadFeed(); // highlight active
      }

      async function createNewThread() {
        const res = await fetch("/api/thread", { method: "POST" });
        const data = await res.json();
        loadThread(data.threadId);
        document.getElementById("threadTitle").textContent = "New Case";
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

      function renderReport(draft) {
         const reportDiv = document.getElementById("aiReport");
         const summaryText = document.getElementById("summaryText");
         const warningsArea = document.getElementById("warningsArea");
         
         reportDiv.style.display = "block";
         summaryText.textContent = draft.summary || "Analyzing...";
         
         // Turn protocol violations into warning badges
         warningsArea.innerHTML = "";
         if (draft.extracted && draft.extracted.protocol_violations) {
             draft.extracted.protocol_violations.forEach(v => {
                 const w = document.createElement("div");
                 w.className = "warning-box";
                 w.innerHTML = "⚠️ <strong>Protocol Alert:</strong> " + v;
                 warningsArea.appendChild(w);
             });
         }
      }

      async function sendMessage() {
        if (!currentThreadId) await createNewThread();
        
        const textInput = document.getElementById("textInput");
        const fileInput = document.getElementById("fileInput");
        const msgs = document.getElementById("messages");

        const text = textInput.value;
        const file = fileInput.files[0];
        let imageUrl = null;

        // 1. User Message bubble
        const msgDiv = document.createElement("div");
        msgDiv.className = "msg user";
        let content = text || "(Image)";
        if (file) {
           imageUrl = await convertToBase64(file);
           content += "<br><img src='" + imageUrl + "' style='max-height: 150px; border-radius: 8px; margin-top:5px'>";
        }
        msgDiv.innerHTML = content;
        msgs.appendChild(msgDiv);
        msgs.scrollTop = msgs.scrollHeight; // Auto scroll down
        
        textInput.value = "";
        fileInput.value = "";

        // 2. AI Thinking bubble
        const loadingDiv = document.createElement("div");
        loadingDiv.className = "msg ai";
        loadingDiv.innerText = "Thinking...";
        msgs.appendChild(loadingDiv);
        
        try {
          const res = await fetch("/api/thread/" + currentThreadId + "/message", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ author: "User", text, imageUrl }),
          });

          const data = await res.json();
          loadingDiv.remove(); // Remove "thinking"
          renderReport(data.draft || {}); // Show the pretty report
          loadFeed(); // Refresh sidebar
        } catch (e) {
          loadingDiv.innerText = "Error: " + e.message;
        }
      }
      
      // Start with a list
      loadFeed();
    </script>
  </body>
</html>`;

// ---------------------------------------------------------
// SERVER ROUTES
// ---------------------------------------------------------

app.get("/", (req, res) => res.redirect("/frog-demo"));
app.get(["/frog-demo", "/frog-demo.html"], (req, res) => res.send(FROG_DEMO_HTML));

// API: FEED
app.get("/api/feed", async (req, res) => {
  try {
    const client = await pool.connect();
    // Fetch last 15 active threads
    const result = await client.query(`
      SELECT t.id as thread_id, t.created_at, d.summary 
      FROM threads t
      LEFT JOIN drafts d ON t.id = d.thread_id
      ORDER BY t.created_at DESC
      LIMIT 15
    `);
    client.release();
    res.json(result.rows);
  } catch (err) {
    console.error(err);
    res.json([]);
  }
});

// THREAD CREATION
app.post("/api/thread", async (req, res) => {
  try {
    const threadId = await ensureThread(); 
    res.json({ threadId });
  } catch (err: any) {
    res.status(500).json({ error: "DB Error" });
  }
});

// MESSAGE HANDLING
app.post("/api/thread/:threadId/message", async (req, res) => {
  try {
    const threadId = await ensureThread(req.params.threadId);
    const { author, text, imageUrl } = req.body;
    
    await addMessage(threadId, author, text, imageUrl); 
    const draftState = await db.drafts.get(threadId);

    const aiResult = await generateDraftDelta(threadId, { ...{author, text}, imageUrl }, {
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
app.listen(PORT, "0.0.0.0", () => console.log(`✅ Frog Social Community Feed running on port ${PORT}`));
