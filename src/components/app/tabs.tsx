import { useMemo, useRef, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { AlertTriangle, CheckCircle2, CircleHelp, Clock3, Gavel, Lightbulb, MessageCircleQuestion, RefreshCw, Send, Smile, Users } from "lucide-react";
import { Bar, BarChart, Cell, ReferenceLine, ResponsiveContainer, XAxis, YAxis } from "recharts";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { askConversation, extractTimelineSentiment, summarizeFor } from "@/lib/ai.functions";
import type { ActionStatus, Conversation, InsightType, SummaryLevel, SummaryRole } from "@/lib/types";
import { cn } from "@/lib/utils";
import { SourceChips, TypewriterCited } from "./citations";

export function AnalysisSkeleton() {
  return (
    <div className="space-y-3">
      <Skeleton className="h-4 w-1/3" />
      <Skeleton className="h-4 w-full" />
      <Skeleton className="h-4 w-11/12" />
      <Skeleton className="h-4 w-4/5" />
      <Skeleton className="mt-6 h-16 w-full" />
      <Skeleton className="h-16 w-full" />
    </div>
  );
}

/* ---------------- Summary ---------------- */
const LEVELS: { v: SummaryLevel; l: string }[] = [
  { v: "tldr", l: "TL;DR" },
  { v: "standard", l: "Standard" },
  { v: "detailed", l: "Detailed" },
];

export function SummaryTab({ conv, onUpdate }: { conv: Conversation; onUpdate: (c: Conversation) => void }) {
  const [level, setLevel] = useState<SummaryLevel>("standard");
  const [role, setRole] = useState<SummaryRole>("executive");
  const [loading, setLoading] = useState(false);
  const [fresh, setFresh] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const summarize = useServerFn(summarizeFor);
  const key = `${level}:${role}` as const;
  const text = conv.analysis?.summaries[key];

  const generate = async () => {
    setLoading(true);
    setError(null);
    const res = await summarize({
      data: { messages: conv.messages.map(({ id, speaker, text }) => ({ id, speaker, text })), level, role },
    }).catch(() => ({ ok: false as const, error: "Network error — please retry." }));
    setLoading(false);
    if (!res.ok) {
      setError(res.error);
      toast.error(res.error);
      return;
    }
    setFresh(key);
    onUpdate({ ...conv, analysis: { ...conv.analysis!, summaries: { ...conv.analysis!.summaries, [key]: res.text } } });
  };

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="inline-flex rounded-xl bg-muted p-1">
          {LEVELS.map((x) => (
            <button
              key={x.v}
              onClick={() => setLevel(x.v)}
              className={cn(
                "rounded-lg px-3 py-1.5 text-sm font-medium transition-all",
                level === x.v ? "bg-card text-foreground shadow-card" : "text-muted-foreground hover:text-foreground",
              )}
            >
              {x.l}
            </button>
          ))}
        </div>
        <div className="flex items-center gap-2 text-sm">
          <span className="text-muted-foreground">Summarize for</span>
          <Select value={role} onValueChange={(v) => setRole(v as SummaryRole)}>
            <SelectTrigger className="h-9 w-36">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="executive">Executive</SelectItem>
              <SelectItem value="developer">Developer</SelectItem>
              <SelectItem value="customer">Customer</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="min-h-40 rounded-2xl border bg-card p-5 text-[15px] shadow-card">
        {loading ? (
          <AnalysisSkeleton />
        ) : text ? (
          <TypewriterCited text={text} animate={fresh === key} />
        ) : (
          <div className="flex flex-col items-center gap-3 py-8 text-center">
            <p className="text-sm text-muted-foreground">
              {error ?? `No ${LEVELS.find((l) => l.v === level)?.l} summary for a ${role} audience yet.`}
            </p>
            <Button onClick={generate} size="sm" className="bg-gradient-primary">
              <RefreshCw className="mr-1.5 h-3.5 w-3.5" /> {error ? "Retry" : "Generate with AI"}
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}

/* ---------------- Key points ---------------- */
const TYPE_META: Record<InsightType, { label: string; icon: typeof Gavel; cls: string }> = {
  decision: { label: "Decision", icon: Gavel, cls: "bg-primary/10 text-primary" },
  key_point: { label: "Key point", icon: Lightbulb, cls: "bg-chart-3/15 text-chart-3" },
  risk: { label: "Risk", icon: AlertTriangle, cls: "bg-destructive/10 text-destructive" },
  question: { label: "Open question", icon: CircleHelp, cls: "bg-chart-4/20 text-foreground" },
};
const IMP_RANK = { high: 0, medium: 1, low: 2 };
const IMP_CLS = {
  high: "border-destructive/30 bg-destructive/10 text-destructive",
  medium: "border-warning/40 bg-warning/15 text-foreground",
  low: "border-border bg-muted text-muted-foreground",
};

export function ConfidenceBar({ value }: { value: number }) {
  const pct = Math.round(value * 100);
  const tone = value >= 0.85 ? "bg-success" : value >= 0.65 ? "bg-warning" : "bg-destructive";
  return (
    <div className="flex items-center gap-2" title="Verified against source messages">
      <div className="h-1.5 w-16 overflow-hidden rounded-full bg-muted">
        <div className={cn("h-full rounded-full", tone)} style={{ width: `${pct}%` }} />
      </div>
      <span className="font-mono text-[11px] text-muted-foreground">{pct}%</span>
    </div>
  );
}

export function KeyPointsTab({ conv }: { conv: Conversation }) {
  const items = [...(conv.analysis?.insights ?? [])].sort(
    (a, b) => IMP_RANK[a.importance] - IMP_RANK[b.importance] || b.confidence - a.confidence,
  );
  if (!items.length) return <Empty text="No key points were found in this conversation." />;
  return (
    <ol className="space-y-3">
      {items.map((ins, i) => {
        const meta = TYPE_META[ins.type];
        const Icon = meta.icon;
        return (
          <li
            key={i}
            className="group flex gap-4 rounded-2xl border bg-card p-4 shadow-card transition-all hover:-translate-y-0.5 hover:border-primary/30"
          >
            <span className="font-display text-2xl font-bold text-muted-foreground/40">{String(i + 1).padStart(2, "0")}</span>
            <div className="min-w-0 flex-1 space-y-2">
              <div className="flex flex-wrap items-center gap-2">
                <span className={cn("inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-xs font-medium", meta.cls)}>
                  <Icon className="h-3 w-3" /> {meta.label}
                </span>
                <Badge variant="outline" className={cn("capitalize", IMP_CLS[ins.importance])}>
                  {ins.importance}
                </Badge>
              </div>
              <p className="font-medium leading-snug">{ins.text}</p>
              <div className="flex flex-wrap items-center justify-between gap-2">
                <SourceChips ids={ins.sources} />
                <ConfidenceBar value={ins.confidence} />
              </div>
            </div>
          </li>
        );
      })}
    </ol>
  );
}

/* ---------------- Actions ---------------- */
const PRIO_CLS = {
  high: "border-destructive/30 bg-destructive/10 text-destructive",
  medium: "border-warning/40 bg-warning/15 text-foreground",
  low: "border-border bg-muted text-muted-foreground",
};
const STATUS_LABEL: Record<ActionStatus, string> = { todo: "To do", in_progress: "In progress", done: "Done" };

export function ActionsTab({ conv, onUpdate }: { conv: Conversation; onUpdate: (c: Conversation) => void }) {
  const actions = conv.analysis?.actions ?? [];
  if (!actions.length) return <Empty text="No action items — nobody committed to anything here." />;
  const setStatus = (id: string, status: ActionStatus) => {
    onUpdate({
      ...conv,
      analysis: { ...conv.analysis!, actions: actions.map((a) => (a.id === id ? { ...a, status } : a)) },
    });
    toast.success(`Marked as ${STATUS_LABEL[status].toLowerCase()}`);
  };
  return (
    <div className="overflow-hidden rounded-2xl border bg-card shadow-card">
      <Table>
        <TableHeader>
          <TableRow className="bg-muted/50">
            <TableHead>Task</TableHead>
            <TableHead>Owner</TableHead>
            <TableHead>Due</TableHead>
            <TableHead>Priority</TableHead>
            <TableHead>Status</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {actions.map((a) => (
            <TableRow key={a.id} className={cn(a.status === "done" && "opacity-60")}>
              <TableCell className="max-w-64">
                <div className={cn("font-medium", a.status === "done" && "line-through")}>{a.task}</div>
                <SourceChips ids={a.sources} className="mt-1.5" />
              </TableCell>
              <TableCell>
                <span className="inline-flex items-center gap-1.5 whitespace-nowrap">
                  <span className="grid h-6 w-6 place-items-center rounded-full bg-accent text-[10px] font-bold text-accent-foreground">
                    {a.owner.slice(0, 2).toUpperCase()}
                  </span>
                  {a.owner}
                </span>
              </TableCell>
              <TableCell className="whitespace-nowrap font-mono text-xs">
                {a.due ? new Date(a.due + "T00:00:00").toLocaleDateString(undefined, { month: "short", day: "numeric" }) : "—"}
              </TableCell>
              <TableCell>
                <Badge variant="outline" className={cn("capitalize", PRIO_CLS[a.priority])}>
                  {a.priority}
                </Badge>
              </TableCell>
              <TableCell>
                <Select value={a.status} onValueChange={(v) => setStatus(a.id, v as ActionStatus)}>
                  <SelectTrigger className="h-8 w-32 text-xs">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {Object.entries(STATUS_LABEL).map(([v, l]) => (
                      <SelectItem key={v} value={v}>
                        {l}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}

export function Empty({ text, icon }: { text: string; icon?: React.ReactNode }) {
  return (
    <div className="flex flex-col items-center gap-3 rounded-2xl border border-dashed p-10 text-center">
      <div className="grid h-12 w-12 place-items-center rounded-2xl bg-accent text-accent-foreground">
        {icon ?? <CheckCircle2 className="h-5 w-5" />}
      </div>
      <p className="max-w-xs text-sm text-muted-foreground">{text}</p>
    </div>
  );
}

/* ---------------- Timeline ---------------- */
function timeRange(start: string | null, end: string | null, sources: number[]) {
  if (start && end) return start === end ? start : `${start} – ${end}`;
  if (start) return `${start} →`;
  if (end) return `→ ${end}`;
  if (sources.length) {
    const min = Math.min(...sources);
    const max = Math.max(...sources);
    return min === max ? `msg ${min}` : `msg ${min}–${max}`;
  }
  return null;
}

export function TimelineTab({ conv, onUpdate }: { conv: Conversation; onUpdate: (c: Conversation) => void }) {
  const [loading, setLoading] = useState(false);
  const extract = useServerFn(extractTimelineSentiment);
  const items = conv.analysis?.timeline;

  const generate = async () => {
    setLoading(true);
    const res = await extract({
      data: { messages: conv.messages.map(({ id, speaker, text, timestamp }) => ({ id, speaker, text, timestamp })) },
    }).catch(() => ({ ok: false as const, error: "Network error — please retry." }));
    setLoading(false);
    if (!res.ok) {
      toast.error(res.error);
      return;
    }
    onUpdate({
      ...conv,
      analysis: { ...conv.analysis!, timeline: res.timeline, sentiment: conv.analysis!.sentiment ?? res.sentiment },
    });
    toast.success("Timeline ready");
  };

  if (!items?.length) {
    return loading ? (
      <AnalysisSkeleton />
    ) : (
      <Empty
        icon={<Clock3 className="h-5 w-5" />}
        text="No topic timeline yet."
      />
    );
  }
  return (
    <div className="relative ml-3 space-y-5 border-l border-border/70 pl-6">
      {items.map((t, i) => {
        const range = timeRange(t.start, t.end, t.sources);
        return (
          <div key={i} className="relative">
            <span
              className={cn(
                "absolute -left-[31px] top-1 h-3 w-3 rounded-full border-2 border-card",
                i === 0 ? "bg-primary ring-4 ring-primary/15" : "bg-muted-foreground/40",
              )}
            />
            {range && (
              <div className="mb-1 inline-flex items-center gap-1.5 rounded-md bg-muted px-2 py-0.5 font-mono text-[11px] text-muted-foreground">
                <Clock3 className="h-3 w-3" /> {range}
              </div>
            )}
            <p className="font-medium leading-snug">{t.topic}</p>
            <SourceChips ids={t.sources} className="mt-1.5" />
          </div>
        );
      })}
    </div>
  );
}

/* ---------------- Sentiment ---------------- */
export function SentimentTab({ conv, onUpdate }: { conv: Conversation; onUpdate: (c: Conversation) => void }) {
  const [loading, setLoading] = useState(false);
  const extract = useServerFn(extractTimelineSentiment);
  const data = conv.analysis?.sentiment;

  const generate = async () => {
    setLoading(true);
    const res = await extract({
      data: { messages: conv.messages.map(({ id, speaker, text, timestamp }) => ({ id, speaker, text, timestamp })) },
    }).catch(() => ({ ok: false as const, error: "Network error — please retry." }));
    setLoading(false);
    if (!res.ok) {
      toast.error(res.error);
      return;
    }
    onUpdate({
      ...conv,
      analysis: { ...conv.analysis!, sentiment: res.sentiment, timeline: conv.analysis!.timeline ?? res.timeline },
    });
    toast.success("Sentiment ready");
  };

  // Talk-time computed locally from message length — no AI needed.
  const talk = useMemo(() => {
    const totals = new Map<string, number>();
    for (const m of conv.messages) totals.set(m.speaker, (totals.get(m.speaker) ?? 0) + m.text.length);
    const total = [...totals.values()].reduce((a, b) => a + b, 0) || 1;
    return [...totals.entries()]
      .map(([name, chars]) => ({ name, pct: Math.max(1, Math.round((chars / total) * 100)) }))
      .sort((a, b) => b.pct - a.pct);
  }, [conv.messages]);

  if (!data) {
    return loading ? <AnalysisSkeleton /> : <Empty icon={<Smile className="h-5 w-5" />} text="No sentiment analysis yet." />;
  }
  const speakers = [...data.speakers].sort((a, b) => b.score - a.score);
  return (
    <div className="space-y-5">
      <div className="flex items-start gap-3 rounded-2xl border bg-card p-4 shadow-card">
        <div className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-accent text-accent-foreground">
          <Smile className="h-4.5 w-4.5" />
        </div>
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Overall tone</p>
          <p className="mt-0.5 text-sm leading-relaxed">{data.overall}</p>
        </div>
      </div>

      <div className="rounded-2xl border bg-card p-4 shadow-card">
        <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Sentiment by speaker</p>
        <div className="h-52 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={speakers} layout="vertical" margin={{ left: 0, right: 16, top: 4, bottom: 4 }}>
              <XAxis
                type="number"
                domain={[-1, 1]}
                ticks={[-1, 0, 1]}
                tick={{ fontSize: 11, fill: "var(--muted-foreground)" }}
                axisLine={false}
                tickLine={false}
              />
              <YAxis
                type="category"
                dataKey="name"
                width={96}
                tick={{ fontSize: 12, fill: "var(--foreground)" }}
                axisLine={false}
                tickLine={false}
              />
              <ReferenceLine x={0} stroke="var(--border)" />
              <Bar dataKey="score" radius={[4, 4, 4, 4]} barSize={16}>
                {speakers.map((s, i) => (
                  <Cell key={i} fill={s.score >= 0 ? "var(--chart-5)" : "var(--destructive)"} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
        <div className="mt-1 flex justify-between px-1 text-[10px] text-muted-foreground">
          <span>Negative</span>
          <span>Neutral</span>
          <span>Positive</span>
        </div>
      </div>

      <div className="rounded-2xl border bg-card p-4 shadow-card">
        <p className="mb-3 inline-flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          <Users className="h-3.5 w-3.5" /> Talk time
        </p>
        <div className="space-y-2.5">
          {talk.map((t) => (
            <div key={t.name} className="flex items-center gap-3">
              <span className="w-28 shrink-0 truncate text-xs font-medium">{t.name}</span>
              <div className="h-2 flex-1 overflow-hidden rounded-full bg-muted">
                <div className="h-full rounded-full bg-gradient-primary transition-all" style={{ width: `${t.pct}%` }} />
              </div>
              <span className="w-9 text-right font-mono text-[11px] text-muted-foreground">{t.pct}%</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

/* ---------------- Ask AI ---------------- */
const STARTERS = ["What was decided?", "What are the deadlines?", "Who owns what?", "What risks were raised?"];

export function AskAITab({ conv }: { conv: Conversation }) {
  const [chat, setChat] = useState<{ role: "user" | "assistant"; content: string }[]>([]);
  const [q, setQ] = useState("");
  const [loading, setLoading] = useState(false);
  const ask = useServerFn(askConversation);
  const bottom = useRef<HTMLDivElement>(null);

  const send = async (question: string) => {
    const text = question.trim();
    if (!text || loading) return;
    setQ("");
    const history = chat.slice(-6);
    setChat((c) => [...c, { role: "user", content: text }, { role: "assistant", content: "" }]);
    setLoading(true);
    const res = await ask({
      data: {
        messages: conv.messages.map(({ id, speaker, text }) => ({ id, speaker, text })),
        question: text,
        history,
      },
    }).catch(() => ({ ok: false as const, error: "Network error — please retry." }));
    setLoading(false);
    if (!res.ok) toast.error(res.error);
    setChat((c) => {
      const next = [...c];
      next[next.length - 1] = { role: "assistant", content: res.ok ? res.answer : res.error };
      return next;
    });
  };

  return (
    <div className="flex flex-col rounded-2xl border bg-card shadow-card">
      <div className="max-h-[26rem] min-h-56 space-y-4 overflow-y-auto p-4">
        {chat.length === 0 ? (
          <div className="flex flex-col items-center gap-4 py-6 text-center">
            <div className="grid h-12 w-12 place-items-center rounded-2xl bg-accent text-accent-foreground">
              <MessageCircleQuestion className="h-5 w-5" />
            </div>
            <p className="max-w-xs text-sm text-muted-foreground">
              Ask anything about this conversation — every answer cites the exact messages it came from.
            </p>
            <div className="flex flex-wrap justify-center gap-2">
              {STARTERS.map((s) => (
                <button
                  key={s}
                  onClick={() => send(s)}
                  className="rounded-full border bg-muted/60 px-3 py-1.5 text-xs font-medium text-foreground transition-colors hover:border-primary/40 hover:bg-primary/10"
                >
                  {s}
                </button>
              ))}
            </div>
          </div>
        ) : (
          chat.map((m, i) =>
            m.role === "user" ? (
              <div key={i} className="flex justify-end">
                <div className="max-w-[85%] rounded-2xl rounded-br-md bg-primary/10 px-3.5 py-2 text-sm font-medium">
                  {m.content}
                </div>
              </div>
            ) : m.content ? (
              <div key={i} className="max-w-[95%] text-sm">
                <CitedText text={m.content} />
              </div>
            ) : (
              <div key={i} className="flex items-center gap-1.5 pl-1">
                {[0, 1, 2].map((d) => (
                  <span
                    key={d}
                    className="h-2 w-2 animate-bounce rounded-full bg-primary/60"
                    style={{ animationDelay: `${d * 150}ms` }}
                  />
                ))}
              </div>
            ),
          )
        )}
        <div ref={bottom} />
      </div>
      <div className="flex gap-2 border-t p-3">
        <Input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && send(q)}
          placeholder="Ask about this conversation…"
          disabled={loading}
        />
        <Button size="icon" className="shrink-0 bg-gradient-primary" onClick={() => send(q)} disabled={loading || !q.trim()} aria-label="Send question">
          <Send className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}
