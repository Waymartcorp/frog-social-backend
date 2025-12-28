import express from "express";
import cors from "cors"; 
import { randomUUID } from "crypto";
import { ensureThread, db, addMessage, updateDraft } from "../lib/db";
import { generateDraftDelta } from "../lib/real_ai"; 
import { Pool } from "pg";

const app = express();

// 1. UPDATED CORS: This allows your Vercel site to talk to this backend
const allowedOrigins = [
  'https://frogsocial.org', 
  'https://www.frogsocial.org'
];

const corsOptions: cors.CorsOptions = {
  origin: allowedOrigins,
  credentials: true,
};

app.use(cors(corsOptions));
app.use(express.json({ limit: '50mb' })); 

const pool = new Pool({ connectionString: process.env.DATABASE_URL, ssl: true });

// ---------------------------------------------------------
// FRONTEND: FEEDING & STRESS TEST EDITION (The Lab Portal)
// ---------------------------------------------------------
const FROG_DEMO_HTML = `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <title>Frog Social – Lab Portal</title>
    <style>
      body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif; margin: 0; background: #f0f2f5; height: 100vh; display: flex; flex-direction: column; }
      header { background: #2c3e50; color: white; padding: 15px 20px; display: flex; justify-content: space-between; align-items: center; }
      header h1 { margin: 0; font-size: 18px; font-weight: bold; }
      .tos-link { color: #bdc3c7; font-size: 12px; text-decoration: none; cursor: pointer; }
      .container { display: flex; flex: 1; overflow: hidden; }
      .sidebar { width: 300px; background: #fff; border-right: 1px solid #ddd; display: flex; flex-direction: column; }
      .action-buttons { padding: 15px; display: flex; gap: 10px; flex-direction: column; border-bottom: 1px solid #eee; }
      .btn-issue { padding: 12px; background: #e74c3c; color: white; border: none; border-radius: 6px; cursor: pointer; font-weight: bold; text-align: left; display: flex; align-items: center; gap: 10px; }
      .btn-issue:hover { background: #c0392b; }
      .btn-grade { padding: 12px; background: #27ae60; color: white; border: none; border-radius: 6px; cursor: pointer; font-weight: bold; text-align: left; display: flex; align-items: center; gap: 10px; }
      .btn-grade:hover { background: #219150; }
      
      .feed-list { flex: 1; overflow-y: auto; }
      .feed-item { padding: 15px; border-bottom: 1px solid #eee; cursor: pointer; display: flex; gap: 10px; }
      .feed-item:hover { background: #eef2f5; }
      .feed-icon { font-size: 20px; }
      .feed-text { overflow: hidden; }
      .main { flex: 1; display: flex; flex-direction: column; background: #fff; }
      .messages-area { flex: 1; overflow-y: auto; padding: 20px; background: #f0f2f5; }
      .msg { max-width: 80%; margin-bottom: 15px; padding: 12px 16px; border-radius: 12px; font-size: 14px; line-height: 1.5; }
      .msg.user { background: #007bff; color: white; margin-left: auto; }
      .msg.ai { background: #fff; border: 1px solid #ddd; }
      .msg.system { background: #ffeaa7; color: #d35400; font-size: 12px; text-align: center; margin: 0 auto 10px auto; width: fit-content; border: 1px solid #e1b12c; }
      .film-strip { display: flex; gap: 5px; margin-top: 8px; overflow-x: auto; }
      .film-strip img { height: 60px; border-radius: 4px; border: 1px solid rgba(255,255,255,0.5); }
      .report-card { background: #fff; border: 1px solid #e1e4e8; border-radius: 8px; margin-bottom: 20px; overflow: hidden; }
      .report-header { background: #f6f8fa; padding: 10px 15px; border-bottom: 1px solid #e1e4e8; font-weight: bold; color: #24292e; font-size: 13px; }
      .report-body { padding: 15px; }
      .warning-box { background: #fff3cd; color: #856404; padding: 10px; border-radius: 6px; font-size: 13px; margin-bottom: 10px; border: 1px solid #ffeeba; }
      .input-wrapper { background: #fff; border-top: 1px solid #ddd; padding: 20px; }
      .input-row { display: flex; gap: 10px; align-items: center; }
      input[type="text"] { flex: 1; padding: 12px; border: 1px solid #ddd; border-radius: 20px; outline: none; }
      button.send { background: #007bff; color: white; border: none; padding: 10px 25px; border-radius: 20px; font-weight: bold; cursor: pointer; }
      #videoProcessor { display: none; }
    </style>
  </head>
  <body>
    <header style="background: #2c3e50; color: white; padding: 12px 20px; display: flex; justify-content: space-between; align-items: center; border-bottom: 3px solid #27ae60;">
  <div style="display: flex; align-items: center; gap: 10px;">
    <span style="font-size: 20px;">🐸</span>
    <h1 style="margin: 0; font-size: 18px; letter-spacing: 0.5px;">FROG SOCIAL <span style="font-weight: normal; opacity: 0.7; font-size: 12px;">| LAB PORTAL</span></h1>
  </div>
  
  <nav style="display: flex; gap: 25px; align-items: center;">
    <a href="/" style="color: white; text-decoration: none; font-size: 13px; font-weight: 600; border-bottom: 2px solid #27ae60; padding-bottom: 2px;">🏠 Dashboard</a>
    <a href="/new-case" style="color: #bdc3c7; text-decoration: none; font-size: 13px; transition: 0.3s;" onmouseover="this.style.color='white'" onmouseout="this.style.color='#bdc3c7'">📝 New Case</a>
    <a href="/social" style="color: #bdc3c7; text-decoration: none; font-size: 13px; transition: 0.3s;" onmouseover="this.style.color='white'" onmouseout="this.style.color='#bdc3c7'">👥 Social</a>
  </nav>
</header>
    <div class="container">
      <div class="sidebar">
        <div class="action-buttons">
            <button class="btn-issue" onclick="startThread('issue')">
                <span>🚑 Report Emergency</span>
            </button>
            <button class="btn-grade" onclick="startThread('grade')">
                <span>🥑 Weekly Feeding & Stress Test</span>
            </button>
 <div style="margin-top: 15px; padding: 12px; background: #f0f9ff; border: 1px solid #bae6fd; border-radius: 10px;">
        <h3 style="margin: 0; font-size: 13px; color: #0369a1; display: flex; align-items: center; gap: 5px;">
          🧪 ROBUFFER™ <span style="font-weight: normal; font-size: 10px; color: #0c4a6e;">(Full GH)</span>
        </h3>
        <p style="font-size: 9px; color: #666; margin-bottom: 8px;">Target: 80% Instant Ocean base, then top-off with:</p>
        
        <div style="display: flex; align-items: center; gap: 8px; margin-bottom: 10px;">
          <input 
            type="number" 
            id="volInput" 
            value="100" 
            style="width: 55px; padding: 3px; border: 1px solid #7dd3fc; border-radius: 4px; font-size: 12px; text-align: center;"
            oninput="
              const v = this.value || 0;
              document.getElementById('k2_val').innerText = (v * 0.09).toFixed(2);
              document.getElementById('ca_val').innerText = (v * 0.065).toFixed(2);
              document.getElementById('mg_val').innerText = (v * 0.045).toFixed(2);
            "
          />
          <span style="font-size: 11px; font-weight: bold; color: #34495e;">Liters</span>
        </div>

        <div style="font-size: 10px; line-height: 1.5; color: #2c3e50; font-family: monospace;">
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

  <div style="font-size: 11px; line-height: 1.5; color: #2c3e50; font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;">
    <div style="display: flex; justify-content: space-between;">
      <span>Calcium Cl:</span><span style="font-weight: bold; color: #2980b9;"><span id="ca_val">5.00</span>g</span>
    </div>
    <div style="display: flex; justify-content: space-between;">
      <span>Epsom Salt:</span><span style="font-weight: bold; color: #2980b9;"><span id="mg_val">2.50</span>g</span>
    </div>
    <div style="display: flex; justify-content: space-between;">
      <span>Baking Soda:</span><span style="font-weight: bold; color: #2980b9;"><span id="na_val">3.50</span>g</span>
    </div>
  </div>
</div>
        </div>
        <div style="padding: 10px; font-size: 11px; color: #999; font-weight: bold; background: #f8f9fa;">RECENT ACTIVITY</div>
        <div id="feedList" class="feed-list">Loading...</div>
      </div>
      <div class="main">
        <div id="messages" class="messages-area"></div>
        <div id="aiReport" style="padding: 0 20px; display: none;">
             <div class="report-card">
                <div class="report-header">🧬 Protocol Analysis</div>
                <div class="report-body">
                    <div id="warningsArea"></div>
                    <p id="summaryText" style="color: #444; font-size: 14px; margin: 0;"></p>
                </div>
             </div>
        </div>
        <div class="input-wrapper">
           <div class="input-row">
               <input type="file" id="fileInput" accept="image/*,video/*" />
               <input type="text" id="textInput" placeholder="Select a mode above..." />
               <button class="send" onclick="sendMessage()">Send</button>
           </div>
        </div>
      </div>
    </div>
    <video id="videoProcessor" muted playsinline></video>
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
              div.className = "feed-item";
              if(c.thread_id === currentThreadId) div.classList.add("active");
              let icon = "📄";
              const lowerSum = (c.summary || "").toLowerCase();
              if (lowerSum.includes("density") || lowerSum.includes("grade") || lowerSum.includes("feeding")) icon = "🥑";
              else if (lowerSum.includes("bloat") || lowerSum.includes("red") || lowerSum.includes("lesion")) icon = "🚑";
              const title = c.summary ? c.summary.substring(0, 35) + "..." : "Untitled Case";
              div.innerHTML = "<div class='feed-icon'>" + icon + "</div><div class='feed-text'><strong>" + title + "</strong><div style='font-size:11px;color:#999'>" + new Date(c.created_at).toLocaleTimeString() + "</div></div>";
              div.onclick = () => loadThread(c.thread_id);
              list.appendChild(div);
            });
        } catch (e) { console.error("Feed error", e); }
      }
      function loadThread(id) {
        currentThreadId = id;
        document.getElementById("messages").innerHTML = "<div style='text-align:center; color:#999; margin-top:20px'>History loaded...</div>";
        document.getElementById("aiReport").style.display = "none";
        loadFeed(); 
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
            sysDiv.innerText = "🥑 SYSTEM AUDIT: Upload a 10s feeding video. We analyze reaction time to detect hidden stress or low density.";
            document.getElementById("textInput").placeholder = "Upload video for assesment...";
        } else {
            sysDiv.innerText = "🚑 EMERGENCY PROTOCOL: Please describe symptoms (e.g. Red Leg, Bloating) and upload photos.";
            document.getElementById("textInput").placeholder = "Describe the symptoms...";
        }
        msgs.appendChild(sysDiv);
        loadFeed();
      }
      function processFile(file) {
        return new Promise(async (resolve, reject) => {
          if (file.type.startsWith('image/')) {
            const reader = new FileReader();
            reader.onload = () => resolve({ type: 'image', data: [reader.result] });
            reader.readAsDataURL(file);
          } else if (file.type.startsWith('video/')) {
            const frames = [];
            const video = document.getElementById('videoProcessor');
            const url = URL.createObjectURL(file);
            video.src = url;
            await video.load();
            video.onloadeddata = async () => {
              const times = [0, video.duration / 2, Math.max(0, video.duration - 0.5)];
              const canvas = document.createElement('canvas');
              const ctx = canvas.getContext('2d');
              for (let t of times) {
                if (!isFinite(t)) t = 0;
                video.currentTime = t;
                await new Promise(r => video.onseeked = r);
                canvas.width = video.videoWidth / 4;
                canvas.height = video.videoHeight / 4;
                ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
                frames.push(canvas.toDataURL('image/jpeg', 0.6));
              }
              URL.revokeObjectURL(url);
              resolve({ type: 'video_frames', data: frames });
            };
            video.onerror = reject;
          }
        });
      }
      function renderReport(draft) {
          const reportDiv = document.getElementById("aiReport");
          const summaryText = document.getElementById("summaryText");
          const warningsArea = document.getElementById("warningsArea");
          reportDiv.style.display = "block";
          summaryText.textContent = draft.summary || "Analyzing...";
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
        if (!currentThreadId) await startThread('issue');
        const textInput = document.getElementById("textInput");
        const fileInput = document.getElementById("fileInput");
        const msgs = document.getElementById("messages");
        const text = textInput.value;
        const file = fileInput.files[0];
        let visualPayload = null;
        let htmlContent = "<strong>You:</strong> " + (text || "(Media)");
        if (file) {
           const result = await processFile(file);
           if (result.type === 'video_frames') {
              visualPayload = result.data[0]; 
              htmlContent += "<br><div class='film-strip'>";
              result.data.forEach(src => htmlContent += "<img src='" + src + "'>");
              htmlContent += "</div><div style='font-size:10px;color:#666'>Video processed into frames</div>";
           } else {
              visualPayload = result.data[0];
              htmlContent += "<br><img src='" + visualPayload + "' style='max-height: 150px; border-radius: 8px; margin-top:5px'>";
           }
        }
        const msgDiv = document.createElement("div");
        msgDiv.className = "msg user";
        msgDiv.innerHTML = htmlContent;
        msgs.appendChild(msgDiv);
        msgs.scrollTop = msgs.scrollHeight;
        textInput.value = "";
        fileInput.value = "";
        const loadingDiv = document.createElement("div");
        loadingDiv.className = "msg ai";
        loadingDiv.innerText = "Analyzing Stress Indicators..."; 
        msgs.appendChild(loadingDiv);
        try {
          const res = await fetch("/api/thread/" + currentThreadId + "/message", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ author: "User", text, imageUrl: visualPayload }),
          });
          const data = await res.json();
          loadingDiv.remove(); 
          renderReport(data.draft || {}); 
          loadFeed(); 
        } catch (e) {
          loadingDiv.innerText = "Error: " + e.message;
        }
      }
      loadFeed();
    </script>
  </body>
</html>`;

// 2. UPDATED ROUTES: Logic to handle the /frog-demo map
app.get("/", (req, res) => res.redirect("/frog-demo"));
app.get(["/frog-demo", "/frog-demo.html"], (req, res) => res.send(FROG_DEMO_HTML));

app.get("/api/feed", async (req, res) => {
  try {
    const client = await pool.connect();
    const result = await client.query(`SELECT t.id as thread_id, t.created_at, d.summary FROM threads t LEFT JOIN drafts d ON t.id = d.thread_id ORDER BY t.created_at DESC LIMIT 15`);
    client.release();
    res.json(result.rows);
  } catch (err) { res.json([]); }
});

app.post("/api/thread", async (req, res) => {
  const threadId = await ensureThread(); 
  res.json({ threadId });
});

app.post("/api/thread/:threadId/message", async (req, res) => {
  try {
    const threadId = await ensureThread(req.params.threadId);
    const { author, text, imageUrl } = req.body;
    await addMessage(threadId, author, text, imageUrl); 
    const draftState = await db.drafts.get(threadId);
    const aiResult = await generateDraftDelta(threadId, { author, text, imageUrl }, { revision: draftState?.revision || 0, doc: draftState?.doc || { summary: "", extracted: {}, highlights: [] } });
    await updateDraft(threadId, { draft_revision: aiResult.draft_revision, ...aiResult, extracted: aiResult.extracted });
    res.json({ draft: aiResult });
  } catch (err: any) { res.status(500).json({ error: err.message }); }
});

const PORT = Number(process.env.PORT) || 4000;
app.listen(PORT, "0.0.0.0", () => console.log(`✅ Frog Social Dual-Mode running on port ${PORT}`));
