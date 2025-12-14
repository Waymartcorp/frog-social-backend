// lib/db.ts
import type { Message, Thread } from "./schemas";

const now = () => new Date().toISOString();

// Simple random ID generator
const id = () => crypto.randomUUID();

export const db = {
  threads: new Map<string, Thread>(),
  messages: new Map<string, Message[]>(),
  drafts: new Map<
    string,
    { revision: number; doc: any; deltas: any[] }
  >(),
};

// Make sure a thread exists; if not, create a demo one
export function ensureThread(threadId?: string) {
  const tid = threadId ?? id();
  if (!db.threads.has(tid)) {
    db.threads.set(tid, {
      id: tid,
      title: "Demo Thread",
      created_at: now(),
    });
    db.messages.set(tid, []);
    db.drafts.set(tid, {
      revision: 0,
      doc: { summary: "", extracted: {}, suggested_tags: [] },
      deltas: [],
    });
  }
  return tid;
}

export function addMessage(
  thread_id: string,
  author: string,
  text: string
): Message {
  const m: Message = {
    id: id(),
    thread_id,
    author,
    text,
    created_at: now(),
  };
  db.messages.get(thread_id)!.push(m);
  return m;
}
