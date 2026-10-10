import { useCallback, useEffect, useRef, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import {
  ArrowLeft, Clock, Copy, Download, Eye, EyeOff, Mail, MessageSquareText, RefreshCw, ShieldCheck, Smile,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { AppHeader } from "@/components/app/AppHeader";
import { CitationContext } from "@/components/app/citations";
import { Transcript } from "@/components/app/Transcript";
import { ActionsTab, AnalysisSkeleton, Empty, KeyPointsTab, SummaryTab } from "@/components/app/tabs";
import { analyzeConversation } from "@/lib/ai.functions";
import { toEmail, toMarkdown } from "@/lib/export";
import { useConversation } from "@/lib/store";
import type { Conversation } from "@/lib/types";

export const Route = createFileRoute("/c/$id")({
  head: () => ({
    meta: [
      { title: "Conversation — TalktoPoint" },
      { name: "description", content: "Summary, key points and action items with citations to every source message." },
      { property: "og:title", content: "Conversation analysis — TalktoPoint" },
      { property: "og:description", content: "AI summary, decisions and action items, each linked to its source message." },
      { property: "og:type", content: "article" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: ConversationPage,
});

const STAGES = ["Masking private data", "Splitting into chunks", "Extracting insights", "Verifying against sources"];

function ConversationPage() {
  const { id } = Route.useParams();
  const { conv, loaded, update } = useConversation(id);
  const [highlight, setHighlight] = useState<number | null>(null);
  const [flashKey, setFlashKey] = useState(0);
  const [showOriginal, setShowOriginal] = useState(false);
  const [stage, setStage] = useState(0);
  const analyze = useServerFn(analyzeConversation);
  const started = useRef(false);

  const jump = useCallback((mid: number) => {
    setHighlight(mid);
    setFlashKey((k) => k + 1);
    document.getElementById(`msg-${mid}`)?.scrollIntoView({ behavior: "smooth", block: "center" });
  }, []);

  const run = useCallback(
    async (c: Conversation) => {
      update({ ...c, status: "analyzing", error: undefined });
      setStage(0);
      const timer = setInterval(() => setStage((s) => Math.min(s + 1, STAGES.length - 1)), 1400);
      const res = await analyze({
        data: { messages: c.messages.map(({ id, speaker, text }) => ({ id, speaker, text })) },
      }).catch(() => ({ ok: false as const, error: "Network error — check your connection and retry." }));
      clearInterval(timer);
      if (!res.ok) {
        update({ ...c, status: "error", error: res.error });
        toast.error("Analysis failed", { description: res.error });
        return;
      }
      update({ ...c, status: "ready", title: res.analysis.title, tags: res.analysis.tags, analysis: res.analysis });
      toast.success("Analysis ready");
    },
    [analyze, update],
  );

  useEffect(() => {
    if (conv?.status === "analyzing" && !conv.analysis && !started.current) {
      started.current = true;
      run(conv);
    }
  }, [conv, run]);

  if (!conv) {
    return (
      <div className="min-h-screen">
        <AppHeader />
        <div className="mx-auto max-w-md p-10">
          {loaded ? (
            <Empty text="This conversation doesn't exist or was deleted." />
          ) : (
            <AnalysisSkeleton />
          )}
          <div className="mt-6 text-center">
            <Button asChild variant="outline"><Link to="/dashboard">Back to dashboard</Link></Button>
          </div>
        </div>
      </div>
    );
  }

  const copy = async (text: string, label: string) => {
    await navigator.clipboard.writeText(text);
    toast.success(`${label} copied to clipboard`);
  };
  const ready = conv.status === "ready" && conv.analysis;

  return (
    <CitationContext.Provider value={jump}>
      <div className="min-h-screen">
        <AppHeader>
          {ready && (
            <div className="no-print hidden items-center gap-1 md:flex">
              <Button size="sm" variant="ghost" onClick={() => copy(toMarkdown(conv), "Markdown")}>
                <Copy className="mr-1.5 h-3.5 w-3.5" /> Markdown
              </Button>
              <Button size="sm" variant="ghost" onClick={() => copy(toEmail(conv), "Email")}>
                <Mail className="mr-1.5 h-3.5 w-3.5" /> Email
              </Button>
              <Button size="sm" variant="ghost" onClick={() => window.print()}>
                <Download className="mr-1.5 h-3.5 w-3.5" /> PDF
              </Button>
            </div>
          )}
        </AppHeader>

        <main className="mx-auto max-w-7xl px-4 py-6 sm:px-6">
          <div className="mb-5 flex flex-wrap items-center gap-3">
            <Button asChild variant="ghost" size="icon" className="no-print">
              <Link to="/dashboard" aria-label="Back"><ArrowLeft className="h-4 w-4" /></Link>
            </Button>
            <div className="min-w-0 flex-1">
              <h1 className="truncate text-2xl font-bold">{conv.title}</h1>
              <div className="mt-1 flex flex-wrap items-center gap-1.5 text-xs text-muted-foreground">
                <span>{new Date(conv.createdAt).toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" })}</span>
                <span>·</span>
                <span>{conv.messages.length} messages</span>
                {conv.tags.map((t) => <Badge key={t} variant="outline" className="font-normal">#{t}</Badge>)}
              </div>
            </div>
            {conv.masked.length > 0 && (
              <button
                onClick={() => setShowOriginal((v) => !v)}
                className="no-print inline-flex items-center gap-2 rounded-full border border-success/30 bg-success/10 px-3 py-1.5 text-xs font-medium text-success transition-colors hover:bg-success/20"
                title="These were masked before being sent to the AI"
              >
                <ShieldCheck className="h-3.5 w-3.5" />
                {conv.masked.length} item{conv.masked.length > 1 ? "s" : ""} masked
                {showOriginal ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
              </button>
            )}
          </div>

          <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.15fr)]">
            {/* Transcript */}
            <section className="rounded-3xl border bg-muted/30 lg:sticky lg:top-20 lg:h-[calc(100vh-7rem)]">
              <div className="flex items-center gap-2 border-b px-5 py-3 text-sm font-semibold">
                <MessageSquareText className="h-4 w-4 text-primary" /> Transcript
              </div>
              <div className="p-5 lg:h-[calc(100%-3rem)] lg:overflow-y-auto">
                <Transcript messages={conv.messages} highlight={highlight} flashKey={flashKey} showOriginal={showOriginal} />
              </div>
            </section>

            {/* Insights */}
            <section className="min-w-0">
              {conv.status === "analyzing" ? (
                <div className="rounded-3xl border bg-card p-6 shadow-card">
                  <div className="mb-5 space-y-2">
                    {STAGES.map((s, i) => (
                      <div key={s} className="flex items-center gap-3 text-sm">
                        <span className={`h-2 w-2 rounded-full ${i < stage ? "bg-success" : i === stage ? "animate-pulse bg-primary" : "bg-muted"}`} />
                        <span className={i <= stage ? "text-foreground" : "text-muted-foreground"}>{s}</span>
                      </div>
                    ))}
                  </div>
                  <AnalysisSkeleton />
                </div>
              ) : conv.status === "error" || !conv.analysis ? (
                <div className="rounded-3xl border bg-card p-8 text-center shadow-card">
                  <p className="font-semibold">We couldn't analyze this conversation</p>
                  <p className="mx-auto mt-1 max-w-sm text-sm text-muted-foreground">{conv.error ?? "Something went wrong."}</p>
                  <Button className="mt-5 bg-gradient-primary" onClick={() => run(conv)}>
                    <RefreshCw className="mr-1.5 h-4 w-4" /> Retry analysis
                  </Button>
                </div>
              ) : (
                <Tabs defaultValue="summary">
                  <TabsList className="no-print mb-4 h-auto w-full flex-wrap justify-start gap-1 rounded-2xl bg-muted p-1">
                    {[
                      ["summary", "Summary"], ["points", "Key Points"], ["actions", "Actions"],
                      ["timeline", "Timeline"], ["sentiment", "Sentiment"], ["ask", "Ask AI"],
                    ].map(([v, l]) => (
                      <TabsTrigger key={v} value={v} className="rounded-xl px-3.5 py-1.5">
                        {l}
                        {v === "actions" && <span className="ml-1.5 rounded-full bg-primary/15 px-1.5 text-[10px] text-primary">{conv.analysis!.actions.length}</span>}
                      </TabsTrigger>
                    ))}
                  </TabsList>
                  <TabsContent value="summary"><SummaryTab conv={conv} onUpdate={update} /></TabsContent>
                  <TabsContent value="points"><KeyPointsTab conv={conv} /></TabsContent>
                  <TabsContent value="actions"><ActionsTab conv={conv} onUpdate={update} /></TabsContent>
                  <TabsContent value="timeline"><Empty icon={<Clock className="h-5 w-5" />} text="Topic timeline is coming in the next update." /></TabsContent>
                  <TabsContent value="sentiment"><Empty icon={<Smile className="h-5 w-5" />} text="Sentiment and talk-time charts are coming in the next update." /></TabsContent>
                  <TabsContent value="ask"><Empty icon={<MessageSquareText className="h-5 w-5" />} text="Ask AI with cited answers is coming in the next update." /></TabsContent>
                </Tabs>
              )}
            </section>
          </div>
        </main>
      </div>
    </CitationContext.Provider>
  );
}
