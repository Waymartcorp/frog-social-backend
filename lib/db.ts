import { Pool } from "pg";

// 1. Connect to Neon using the secret key you just saved
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: true, 
});

// 2. Initialize the Database (Create tables if they don't exist)
// We do this automatically so you don't have to learn SQL yet.
const initDb = async () => {
  const client = await pool.connect();
  try {
    await client.query(`
      CREATE TABLE IF NOT EXISTS threads (
        id TEXT PRIMARY KEY,
        created_at TIMESTAMP DEFAULT NOW()
      );
      CREATE TABLE IF NOT EXISTS messages (
        id SERIAL PRIMARY KEY,
        thread_id TEXT REFERENCES threads(id),
        author TEXT,
        content TEXT,
        image_url TEXT,
        created_at TIMESTAMP DEFAULT NOW()
      );
      CREATE TABLE IF NOT EXISTS drafts (
        thread_id TEXT PRIMARY KEY REFERENCES threads(id),
        revision INT DEFAULT 0,
        summary TEXT,
        extracted JSONB,
        highlights TEXT[]
      );
    `);
    console.log("✅ Database initialized (Tables Ready)");
  } catch (err) {
    console.error("❌ Database Init Failed:", err);
  } finally {
    client.release();
  }
};

// Run initialization on startup
initDb();

// --- HELPER FUNCTIONS (The App uses these to talk to the DB) ---

export const db = {
  // We keep this structure to match your existing code, but now it calls SQL!
  drafts: {
    get: async (threadId: string) => {
      const res = await pool.query("SELECT * FROM drafts WHERE thread_id = $1", [threadId]);
      if (res.rows.length === 0) return null;
      const row = res.rows[0];
      return {
        revision: row.revision,
        doc: {
          summary: row.summary,
          extracted: row.extracted || {},
          highlights: row.highlights || []
        }
      };
    }
  }
};

export async function ensureThread(threadId?: string) {
  const id = threadId || crypto.randomUUID();
  // Try to find it, if not, create it
  const client = await pool.connect();
  try {
    const check = await client.query("SELECT id FROM threads WHERE id = $1", [id]);
    if (check.rows.length === 0) {
      await client.query("INSERT INTO threads (id) VALUES ($1)", [id]);
      // Also create an empty draft for it
      await client.query(
        "INSERT INTO drafts (thread_id, summary, extracted, highlights) VALUES ($1, '', '{}', '{}')", 
        [id]
      );
    }
    return id;
  } finally {
    client.release();
  }
}

export async function addMessage(threadId: string, author: string, text: string, imageUrl?: string) {
  const client = await pool.connect();
  try {
    await client.query(
      "INSERT INTO messages (thread_id, author, content, image_url) VALUES ($1, $2, $3, $4)",
      [threadId, author, text, imageUrl || null]
    );
    return { author, text, imageUrl };
  } finally {
    client.release();
  }
}

// We need to update the draft in the DB after AI runs
export async function updateDraft(threadId: string, newDraft: any) {
  await pool.query(
    `UPDATE drafts 
     SET revision = $1, summary = $2, extracted = $3, highlights = $4 
     WHERE thread_id = $5`,
    [
      newDraft.draft_revision,
      newDraft.summary,
      JSON.stringify(newDraft.extracted), // Save JSON as text
      newDraft.highlights,
      threadId
    ]
  );
}
