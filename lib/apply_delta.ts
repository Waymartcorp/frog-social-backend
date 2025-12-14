// lib/apply_delta.ts
import type { CaseDraftDelta } from "./schemas";

function pointerSet(obj: any, path: string, value: any) {
  const parts = path.replace(/^\//, "").split("/");
  let cur = obj;
  for (let i = 0; i < parts.length - 1; i++) {
    const k = parts[i];
    if (cur[k] == null || typeof cur[k] !== "object") {
      cur[k] = {};
    }
    cur = cur[k];
  }
  cur[parts[parts.length - 1]] = value;
}

function pointerRemove(obj: any, path: string) {
  const parts = path.replace(/^\//, "").split("/");
  let cur = obj;
  for (let i = 0; i < parts.length - 1; i++) {
    const k = parts[i];
    if (cur[k] == null) return;
    cur = cur[k];
  }
  delete cur[parts[parts.length - 1]];
}

export function applyDelta(doc: any, delta: CaseDraftDelta) {
  const out = structuredClone(doc);
  for (const op of delta.ops) {
    if (op.op === "remove") {
      pointerRemove(out, op.path);
    } else {
      pointerSet(out, op.path, op.value);
    }
  }
  return out;
}
