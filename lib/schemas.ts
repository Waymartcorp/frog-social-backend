// lib/schemas.ts

export type EvidenceRef = {
  thread_id: string;
  message_id: string;
  quote: string;
  author_id?: string;
  ts?: string; // ISO date-time
  media_ids?: string[];
};

export type DraftOp =
  | { op: "set" | "merge" | "append"; path: string; value: any }
  | { op: "remove"; path: string };

export type DraftHighlight = {
  kind: "new_param" | "missing_info" | "risk" | "next_step" | "resolution_signal";
  text: string;
  evidence?: EvidenceRef;
};

export type CaseDraftDelta = {
  thread_id: string;
  case_id?: string | null;
  draft_revision: number;
  ops: DraftOp[];
  highlights?: DraftHighlight[];
};

export type Message = {
  id: string;
  thread_id: string;
  author: string;
  text: string;
  created_at: string; // ISO date-time
};

export type Thread = {
  id: string;
  title: string;
  created_at: string; // ISO date-time
};
