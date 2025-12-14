import { NextResponse } from "next/server";
import { db, ensureThread } from "@/lib/db";

export async function GET(
  _req: Request,
  { params }: { params: { threadId: string } }
) {
  const threadId = ensureThread(params.threadId);
  const draft = db.drafts.get(threadId)!;

  return NextResponse.json({
    thread_id: threadId,
    revision: draft.revision,
    doc: draft.doc,
    recent_deltas: draft.deltas.slice(-10),
  });
}
