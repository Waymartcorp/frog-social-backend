// lib/fake_ai.ts
import type { CaseDraftDelta, Message } from "./schemas";

type DraftState = { revision: number; doc: any };

export function generateDraftDelta(
  thread_id: string,
  msg: Message,
  state: DraftState
): CaseDraftDelta {
  const nextRevision = state.revision + 1;

  const ops: CaseDraftDelta["ops"] = [];
  const highlights: CaseDraftDelta["highlights"] = [];

  const t = msg.text;

  // Very simple pattern matching, just to prove the flow works.
  const tempMatch = t.match(/temp(?:erature)?\s*[:=]?\s*(\d+(\.\d+)?)\s*(c|°c)?/i);
  if (tempMatch) {
    ops.push({
      op: "set",
      path: "/extracted/water/temp_c",
      value: Number(tempMatch[1]),
    });
    highlights!.push({
      kind: "new_param",
      text: `Extracted water temp: ${tempMatch[1]} °C`,
      evidence: {
        thread_id,
        message_id: msg.id,
        quote: msg.text.slice(0, 280),
      },
    });
  }

  const phMatch = t.match(/\bpH\s*[:=]?\s*(\d+(\.\d+)?)/i);
  if (phMatch) {
    ops.push({
      op: "set",
      path: "/extracted/water/ph",
      value: Number(phMatch[1]),
    });
    highlights!.push({
      kind: "new_param",
      text: `Extracted pH: ${phMatch[1]}`,
      evidence: {
        thread_id,
        message_id: msg.id,
        quote: msg.text.slice(0, 280),
      },
    });
  }

  // Keep a simple running summary for now
  ops.push({
    op: "set",
    path: "/summary",
    value: `Latest: ${msg.author} says: ${msg.text}`.slice(0, 200),
  });

  return {
    thread_id,
    draft_revision: nextRevision,
    ops,
    highlights: highlights && highlights.length ? highlights : undefined,
  };
}
