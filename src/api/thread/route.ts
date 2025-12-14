import { NextResponse } from "next/server";
import { ensureThread, db } from "@/lib/db";

export async function POST() {
  const threadId = ensureThread();
  const thread = db.threads.get(threadId)!;
  return NextResponse.json(thread);
}
