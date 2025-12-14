import { NextResponse } from "next/server";
import { db, ensureThread, addMessage } from "@/lib/db";
import { generateDraftDelta } from "@/lib/fake_ai";
import { applyDelta } from "@/lib/apply_delta";

export async function POST(
  req: Request,
  { params }: { params: { threadId: string } }
) {
  const threadId = ensureThread(params.threadId);
  const body = await req.json();

  const author = (body.author ?? "anon").toString();
  const text = (body.text ?? "").toString().trim();

  if (!text) {
    return NextResponse.json({ error: "Empty message" }, { status: 400 });
  }

  const msg = addMessage(threadId, author, text);

  const draftState = db.drafts.get(threadId)!;
  const delta = generateDraftDelta(threadId, msg, {
    revision: draftState.revision,
    doc: draftState.doc,
  });

  const nextDoc = applyDelta(draftState.doc, delta);
  draftState.revision = delta.draft_revision;
  draftState.doc = nextDoc;
  draftState.deltas.push(delta);

  return NextResponse.json({
    message: msg,
    delta,
    draft: nextDoc,
  });
}
