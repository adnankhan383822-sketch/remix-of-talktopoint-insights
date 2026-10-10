export type MaskKind = "email" | "phone" | "card";
export interface MaskItem {
  token: string;
  kind: MaskKind;
  original: string;
}

export interface Message {
  id: number;
  speaker: string;
  timestamp: string | null;
  text: string; // masked text (what the AI sees)
  original?: string; // unmasked, local only
}

export type InsightType = "key_point" | "decision" | "risk" | "question";
export type Importance = "high" | "medium" | "low";
export type Priority = "high" | "medium" | "low";
export type ActionStatus = "todo" | "in_progress" | "done";

export interface Insight {
  type: InsightType;
  text: string;
  importance: Importance;
  confidence: number; // 0..1
  sources: number[];
}

export interface ActionItem {
  id: string;
  task: string;
  owner: string;
  due: string | null;
  priority: Priority;
  status: ActionStatus;
  confidence: number;
  sources: number[];
}

export type SummaryLevel = "tldr" | "standard" | "detailed";
export type SummaryRole = "executive" | "developer" | "customer";

export interface TimelineTopic {
  topic: string;
  start: string | null;
  end: string | null;
  sources: number[];
}

export interface SentimentData {
  overall: string;
  speakers: { name: string; score: number }[]; // -1 (negative) .. 1 (positive)
}

export interface Analysis {
  title: string;
  tags: string[];
  summaries: Partial<Record<`${SummaryLevel}:${SummaryRole}`, string>>;
  insights: Insight[];
  actions: ActionItem[];
  timeline?: TimelineTopic[];
  sentiment?: SentimentData;
}

export type SourceType = "paste" | "upload" | "sample";

export interface Conversation {
  id: string;
  title: string;
  createdAt: string;
  sourceType: SourceType;
  tags: string[];
  messages: Message[];
  masked: MaskItem[];
  status: "analyzing" | "ready" | "error";
  error?: string | undefined;
  analysis?: Analysis;
}
