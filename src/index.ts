import express from "express";
import cors from "cors"; 
import { randomUUID } from "crypto";
import { ensureThread, db, addMessage, updateDraft } from "../lib/db";
import { generateDraftDelta } from "../lib/real_ai"; 
import { Pool } from "pg";

const app = express();

const allowedOrigins = ['https://frogsocial.org', 'https://www.frogsocial.org'];
const corsOptions: cors.CorsOptions = { origin: allowedOrigins, credentials: true };

app.use(cors(corsOptions));
app.use(express.json({ limit: '50mb' })); 

const pool = new Pool({ connectionString: process.env.DATABASE_URL, ssl: true });

// ---------------------------------------------------------
// FRONTEND: THE LABORATORY PORTAL (v2.0)
// ---------------------------------------------------------
const FROG_DEMO_HTML = `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <title>Frog Social – Lab Portal</title>
    <style>
      body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif; margin: 0; background: #f0f2f5; height: 100vh; display: flex; flex-direction: column; }
      
      /* PRO NAVIGATION HEADER */
      header { background: #2c3e50; color: white; padding: 12px 20px; display: flex; justify-content: space-between; align-items: center; border-bottom: 3px solid #27ae60; }
      header h1 { margin: 0; font-size: 18px; letter-spacing: 0.5px; }
      nav { display: flex; gap: 20px; align-items: center; }
      nav a { color: #bdc3c7; text-decoration: none; font-size: 13px; font-weight: 500; transition: 0.2s; }
      nav a:hover { color: white; }
      nav a.active { color: white; border-bottom: 2px solid #27ae60; padding-bottom: 2px; }

      .container { display: flex; flex: 1; overflow: hidden; }
      .sidebar { width: 320px; background: #fff; border-right: 1px solid #ddd; display: flex; flex-direction: column; }
      .action-buttons { padding: 15px; display: flex; gap: 10px; flex-direction: column; border-bottom: 1px solid #eee; }
      
      /* GLOWING BUTTONS */
      .btn-issue { padding: 12px; background: #e74c3c; color: white; border: none; border-radius: 6px; cursor: pointer; font-weight: bold; text-align: left; display: flex; align-items: center; gap: 10px; transition: 0.2s; }
      .btn-issue:hover { background: #c0392b; box-shadow: 0 0 10px rgba(231, 76, 60, 0.4); }
      .btn-grade { padding: 12px; background: #27ae60; color: white; border: none; border-radius: 6px; cursor: pointer; font-weight: bold; text-align: left; display: flex; align-items: center; gap: 10px; transition: 0.2s; }
      .btn-grade:hover { background: #219150; box-shadow: 0 0 15px rgba(39, 174, 96, 0.5); }

      /* ROBUFFER TOOL */
      .calculator-box { margin-top: 5px; padding: 12px; background: #f0f9ff; border: 1px solid #bae6fd; border-radius: 10px; }
      .calc-input { width: 55px; padding: 3px; border: 1px solid #7dd3fc; border-radius: 4px; font-size: 12px; text-align: center; font-weight: bold; }
      
      .feed-list { flex: 1; overflow-y: auto; background: #fafafa; }
      .feed-item { padding: 12px 15px; border-bottom: 1px solid #eee; cursor: pointer; display: flex; gap: 10px; transition: 0.1s; }
      .feed-item:hover { background: #eef2f5; }
      .feed-item.active { background: #e8f4fd; border-left: 4px solid #3498db; }
      
      .main { flex: 1; display: flex; flex-direction: column; background: #fff; }
      .messages-area { flex: 1; overflow-y: auto; padding: 20px; background: #f0f2f5; }
      .msg { max-width: 80%; margin-bottom: 15px; padding: 12px 16px; border-radius: 12px; font-size: 14px; line-height: 1.5; }
      .msg.user { background: #007bff; color: white; margin-left: auto; border-bottom-right-radius: 2px; }
      .msg.ai { background: #fff; border: 1px solid #ddd; border-bottom-left-radius: 2px; }
      .msg.system { background: #fff3cd; color: #856404; font-size: 12px; text-align: center; margin: 0 auto 15px auto; padding: 8px 20px; border-radius: 20px; border: 1px solid #ffeeba; }

      .input-wrapper { background: #fff; border-top: 1px solid #ddd; padding: 20px; }
      .input-row { display: flex; gap: 10px; align-items: center; }
      input[type="text"] { flex: 1; padding: 12px 20px; border: 1px solid #ddd; border-radius: 25px; outline: none; transition: 0.2s; }
      input[type="text"]:focus { border-color: #3498db; box-shadow: 0 0 5px rgba(52, 152, 219, 0.2); }
      button.send { background: #007bff; color: white; border: none; padding: 10px 25px; border-radius: 20px; font-weight: bold; cursor: pointer; }
    </style>
  </head>
  <body>
    <header>
      <div style="display: flex; align-items: center; gap: 10px;">
        <span>🐸</span>
        <h1>FROG SOCIAL <span style="font-weight: normal; opacity: 0.7; font-size: 12px;">| LAB PORTAL</span></h1>
      </div>
      <nav>
        <a href="#" onclick="location.reload()" class="active">🏠 Dashboard</a>
        <a href="#" onclick="startThread('intake')">📝 New Case</a>
        <a href="#" onclick="alert('Social Feed coming soon')">👥 Social</a>
        <a href="https://xenopuswelfare.org" target="_blank" style="font-size: 11px; opacity: 0.6;">TOS</a>
      </nav>
    </header>

    <div class="container">
      <div class="sidebar">
        <div class="action-buttons">
          <button class="btn-issue" onclick="startThread('issue')">
            <span>🚑 Report Emergency</span>
          </button>
          <button class="btn-grade" onclick="startThread('grade')">
            <span>🥑 Weekly Stress Test</span>
          </button>

          <div class="calculator-box">
            <h3 style="margin: 0; font-size: 12px; color: #0369a1; display: flex; align-items: center; gap: 5px;">
              🧪 ROBUFFER™ <span style="font-weight: normal; font-size: 10px; color: #0c4a6e;">(Full GH)</span>
            </h3>
            <p style="font-size: 9px; color: #666; margin: 4px 0 8px 0;">80% Instant Ocean base, then top-off:</p>
            
            <div style="display: flex; align-items: center; gap: 8px; margin-bottom: 8px;">
              <input type="number" id="volInput" value="100" class="calc-input"
                oninput="
                  const v = this.value || 0;
                  document.getElementById('k2_val').innerText = (v * 0.09).toFixed(2);
                  document.getElementById('ca_val').innerText = (v * 0.065).toFixed(2);
                  document.getElementById('mg_val').innerText = (v * 0.045).toFixed(2);
                "
              />
              <span style="font-size: 11px; font-weight: bold; color: #34495e;">Liters</span>
            </div>

            <div style="font-size: 10px; line-height: 1.5; color: #2c3e50; font-family: monospace; background: white; padding: 6px; border-radius: 6px; border: 1px solid #e0f2fe;">
              <div style="display: flex; justify-content: space-between;">
                <span>K2SO4:</span><span style="font-weight: bold; color: #2980b9;"><span id="k2_val">9.00</span>g</span>
              </div>
              <div style="display: flex; justify-content: space-between;">
                <span>CaSO4:</span><span style="font-weight: bold; color: #2980b9;"><span id="ca_val">6.50</span>g</span>
              </div>
              <div style="display: flex; justify-content: space-between;">
                <span>MgSO4:</span><span style="font-weight: bold; color: #2980b9;"><span id="mg_val">4.50</span>g</span>
              </div>
            </div>
          </div>
        </div>
        
        <div style="padding: 10px 15px; font-size: 11px; color: #999; font-weight: bold; background: #f8f9fa; border-bottom: 1px solid #eee;">RECENT ACTIVITY</div>
        <div id="feedList" class="feed-list">Loading lab records...</div>
      </div>

      <div class="main">
        <div id="messages" class="messages-area"></div>
        
        <div id="aiReport" style="padding: 0 20px; display: none;">
             <div class="report-card" style="border-left: 5px solid #27ae60; background: #fff; margin-bottom: 15px; padding: 15px; border-radius: 8px; box-shadow: 0 2px 5px rgba(0,0,0,0.05);">
                <div style="font-weight: bold; color: #2c3e50; font-size: 13px; margin-bottom: 10px;">🧪 LAB ADVISORY</div>
                <div id="warningsArea"></div>
                <p id="summaryText" style="color: #444; font-size: 14px; margin: 0; line-height: 1.6;"></p>
             </div>
        </div>

        <div class="input-wrapper">
           <div class="input-row">
               <input type="file" id="fileInput" accept="image/*,video/*" style="display:none" onchange="handleFileSelect(this)"/>
               <button onclick="document.getElementById('fileInput').click()" style="background:none; border:none; font-size: 20px; cursor:pointer;">📎</button>
               <input type="text" id="textInput" placeholder="Select a mode or type a message..." />
               <button class="send" onclick="sendMessage()">Send</button>
           </div>
        </div>
      </div>
    </div>

    <video id="videoProcessor" style="display:none" muted playsinline></video>

    <script>
      let currentThreadId = null;
      let currentMode = 'issue';

      async function loadFeed() {
        try {
            const res = await fetch("/api/feed");
            const cases = await res.json();
            const list = document.getElementById("feedList");
            list.innerHTML = "";
            cases.forEach(c => {
              const div = document.createElement("div");
              div.className = "feed-item" + (c.thread_id === currentThreadId ? " active" : "");
              let icon = "📄";
              const lowerSum = (c.summary || "").toLowerCase();
              if (lowerSum.includes("density") || lowerSum.includes("grade") || lowerSum.includes("feeding")) icon = "🥑";
              else if (lowerSum.includes("bloat") || lowerSum.includes("emergency") || lowerSum.includes("red")) icon = "🚑";
              
              const title = c.summary ? c.summary.substring(0, 35) + "..." : "Untitled Assessment";
              div.innerHTML = "<div style='font-size:20px'>" + icon + "</div><div style='overflow:hidden'><strong>" + title + "</strong><div style='font-size:10px;color:#999'>" + new Date(c.created_at).toLocaleTimeString() + "</div></div>";
              div.onclick = () => loadThread(c.thread_id);
              list.appendChild(div);
            });
        } catch (e) { console.error(e); }
      }

      async function startThread(mode) {
        currentMode = mode;
        const res = await fetch("/api/thread", { method: "POST" });
        const data = await res.json();
        currentThreadId = data.threadId;
        
        const msgs = document.getElementById("messages");
        msgs.innerHTML = "";
        document.getElementById("aiReport").style.display = "none";
        
        const sysDiv = document.createElement("div");
        sysDiv.className = "msg system";
        
        if (mode === 'grade') {
            sysDiv.innerText = "🥑 FEEDING AUDIT: Upload a feeding video. Checking reaction time and stress density.";
        } else if (mode === 'intake') {
            sysDiv.innerText = "📝 NEW CASE INTAKE: Standing by for clinical observations. Please describe the primary issue.";
        } else {
            sysDiv.innerText = "🚑 EMERGENCY: Describe the symptoms and upload skin photos immediately.";
        }
        
        msgs.appendChild(sysDiv);
        loadFeed();
      }

      function handleFileSelect(input) {
        if(input.files[0]) document.getElementById('textInput').placeholder = "File attached: " + input.files[0].name;
      }

      async function sendMessage() {
        if (!currentThreadId) await startThread('issue');
        const textInput = document.getElementById("textInput");
        const fileInput = document.getElementById("fileInput");
        const msgs = document.getElementById("messages");
        const text = textInput.value;
        const file = fileInput.files[0];

        // UI Update
        const userDiv = document.createElement("div");
        userDiv.className = "msg user";
        userDiv.innerText = text || "Media Uploaded";
        msgs.appendChild(userDiv);
        msgs.scrollTop = msgs.scrollHeight;

        textInput.value = "";
        fileInput.value = "";
        textInput.placeholder = "Processing...";

        const loadingDiv = document.createElement("div");
        loadingDiv.className = "msg ai";
        loadingDiv.innerText = "Laboratory Analyzing...";
        msgs.appendChild(loadingDiv);

        try {
          const res = await fetch("/api/thread/" + currentThreadId + "/message", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ author: "User", text })
          });
          const data = await res.json();
          loadingDiv.remove();
          
          if(data.draft) {
             const aiDiv = document.createElement("div");
             aiDiv.className = "msg ai";
             aiDiv.innerText = data.draft.summary;
             msgs.appendChild(aiDiv);
             
             document.getElementById("aiReport").style.display = "block";
             document.getElementById("summaryText").innerText = data.draft.summary;
          }
          loadFeed();
        } catch (e) { loadingDiv.innerText = "Error: " + e.message; }
      }

      function loadThread(id) {
        currentThreadId = id;
        loadFeed();
        document.getElementById("messages").innerHTML = "<div class='msg system'>Reloading case history...</div>";
      }

      loadFeed();
    </script>
  </body>
</html>`;

app.get("/", (req, res) => res.send(FROG_DEMO_HTML));

app.get("/api/feed", async (req, res) => {
  const client = await pool.connect();
  const result = await client.query('SELECT t.id as thread_id, t.created_at, d.summary FROM threads t LEFT JOIN drafts d ON t.id = d.thread_id ORDER BY t.created_at DESC LIMIT 15');
  client.release();
  res.json(result.rows);
});

app.post("/api/thread", async (req, res) => {
  const threadId = await ensureThread();
  res.json({ threadId });
});

app.post("/api/thread/:threadId/message", async (req, res) => {
  const { author, text } = req.body;
  const threadId = req.params.threadId;
  await addMessage(threadId, author, text);
  const draftState = await db.drafts.get(threadId);
  const aiResult = await generateDraftDelta(threadId, { author, text }, { revision: draftState?.revision || 0, doc: draftState?.doc || { summary: "", extracted: {}, highlights: [] } });
  await updateDraft(threadId, aiResult);
  res.json({ draft: aiResult });
});

const PORT = process.env.PORT || 4000;
app.listen(PORT, () => console.log(`🚀 Lab Portal Active on ${PORT}`));
