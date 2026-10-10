import { useRef, useState } from "react";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { toast } from "sonner";
import { ChevronDown, FileText, MessageCircle, Sparkles as _unused, Trash2, UploadCloud, Wand2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { AppHeader } from "@/components/app/AppHeader";
import { SAMPLE_OPTIONS } from "@/data/samples";
import { maskMessages, parseConversation } from "@/lib/parser";
import { deleteConversation, saveConversation, useConversations } from "@/lib/store";
import type { Conversation, SourceType } from "@/lib/types";
import { cn } from "@/lib/utils";

void _unused;

export const Route = createFileRoute("/dashboard")({
  head: () => ({
    meta: [
      { title: "Dashboard — TalktoPoint" },
      { name: "description", content: "Paste, upload or load a sample conversation to analyze it with TalktoPoint." },
      { property: "og:title", content: "Dashboard — TalktoPoint" },
      { property: "og:description", content: "Start a new conversation analysis or revisit recent ones." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: Dashboard,
});

function Dashboard() {
  const navigate = useNavigate();
  const list = useConversations();
  const [text, setText] = useState("");
  const [drag, setDrag] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const create = (raw: string, sourceType: SourceType, name?: string) => {
    const parsed = parseConversation(raw);
    if (parsed.length < 2) {
      toast.error("We couldn't find a conversation there", {
        description: 'Use lines like "Name: message" or a WhatsApp export.',
      });
      return;
    }
    const { messages, masked } = maskMessages(parsed);
    const conv: Conversation = {
      id: crypto.randomUUID(),
      title: name ?? "Untitled conversation",
      createdAt: new Date().toISOString(),
      sourceType,
      tags: [],
      messages,
      masked,
      status: "analyzing",
    };
    saveConversation(conv);
    if (masked.length) toast.info(`${masked.length} sensitive item${masked.length > 1 ? "s" : ""} masked before analysis`);
    navigate({ to: "/c/$id", params: { id: conv.id } });
  };

  const onFile = async (file: File) => {
    if (!/\.txt$/i.test(file.name) && file.type !== "text/plain") {
      toast.error("Only .txt files for now", { description: "PDF and DOCX support is coming next." });
      return;
    }
    if (file.size > 2_000_000) return toast.error("File is too large (max 2 MB).");
    create(await file.text(), "upload", file.name.replace(/\.\w+$/, ""));
  };

  return (
    <div className="min-h-screen">
      <AppHeader />
      <main className="mx-auto max-w-6xl space-y-10 px-4 py-8 sm:px-6">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold">New conversation</h1>
            <p className="mt-1 text-muted-foreground">Drop a file, paste text, or start from a sample.</p>
          </div>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline">
                <Wand2 className="mr-1.5 h-4 w-4" /> Load sample conversation <ChevronDown className="ml-1 h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-72">
              {SAMPLE_OPTIONS.map((s) => (
                <DropdownMenuItem key={s.id} onClick={() => navigate({ to: "/c/$id", params: { id: s.id } })}>
                  <div>
                    <div className="font-medium">{s.label}</div>
                    <div className="text-xs text-muted-foreground">{s.hint}</div>
                  </div>
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>

        <div className="grid gap-5 lg:grid-cols-2">
          <div
            onDragOver={(e) => {
              e.preventDefault();
              setDrag(true);
            }}
            onDragLeave={() => setDrag(false)}
            onDrop={(e) => {
              e.preventDefault();
              setDrag(false);
              const f = e.dataTransfer.files[0];
              if (f) onFile(f);
            }}
            onClick={() => fileRef.current?.click()}
            className={cn(
              "flex min-h-64 cursor-pointer flex-col items-center justify-center gap-3 rounded-3xl border-2 border-dashed bg-card p-8 text-center transition-all",
              drag ? "scale-[1.01] border-primary bg-accent" : "hover:border-primary/50",
            )}
          >
            <div className="grid h-14 w-14 place-items-center rounded-2xl bg-gradient-primary text-primary-foreground shadow-glow">
              <UploadCloud className="h-6 w-6" />
            </div>
            <div className="font-display text-lg font-semibold">Drag & drop a conversation</div>
            <p className="text-sm text-muted-foreground">.txt chat exports, transcripts or tickets · or click to browse</p>
            <input
              ref={fileRef}
              type="file"
              accept=".txt,text/plain"
              className="hidden"
              onChange={(e) => e.target.files?.[0] && onFile(e.target.files[0])}
            />
          </div>

          <div className="flex flex-col rounded-3xl border bg-card p-4 shadow-card">
            <Textarea
              value={text}
              onChange={(e) => setText(e.target.value)}
              placeholder={"Paste your conversation here…\n\nMaya: Can we ship Friday?\nDev: Yes, if QA signs off by Thursday."}
              className="min-h-48 flex-1 resize-none border-0 bg-transparent font-mono text-sm shadow-none focus-visible:ring-0"
            />
            <div className="flex items-center justify-between border-t pt-3">
              <span className="text-xs text-muted-foreground">
                {text ? `${parseConversation(text).length} messages detected` : "Speakers & timestamps are auto-detected"}
              </span>
              <Button disabled={!text.trim()} onClick={() => create(text, "paste")} className="bg-gradient-primary">
                Analyze
              </Button>
            </div>
          </div>
        </div>

        <section>
          <h2 className="mb-4 text-xl font-semibold">Recent conversations</h2>
          {list.length === 0 ? (
            <div className="rounded-2xl border border-dashed p-10 text-center text-muted-foreground">
              Nothing here yet — paste your first conversation above.
            </div>
          ) : (
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {list.map((c) => (
                <Link
                  key={c.id}
                  to="/c/$id"
                  params={{ id: c.id }}
                  className="group relative rounded-2xl border bg-card p-5 shadow-card transition-all hover:-translate-y-0.5 hover:border-primary/40"
                >
                  <div className="flex items-start gap-3">
                    <div className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-accent text-accent-foreground">
                      {c.sourceType === "upload" ? <FileText className="h-4 w-4" /> : <MessageCircle className="h-4 w-4" />}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="truncate font-semibold group-hover:text-primary">{c.title}</div>
                      <div className="text-xs text-muted-foreground">
                        {new Date(c.createdAt).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" })} ·{" "}
                        {c.messages.length} messages
                      </div>
                    </div>
                    {c.sourceType !== "sample" && (
                      <button
                        aria-label="Delete"
                        onClick={(e) => {
                          e.preventDefault();
                          deleteConversation(c.id);
                          toast.success("Conversation deleted");
                        }}
                        className="rounded-md p-1 text-muted-foreground opacity-0 transition-opacity hover:text-destructive group-hover:opacity-100"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    )}
                  </div>
                  <div className="mt-3 flex flex-wrap gap-1.5">
                    {c.sourceType === "sample" && <Badge variant="secondary">sample</Badge>}
                    {c.status === "analyzing" && <Badge variant="outline">analyzing…</Badge>}
                    {c.status === "error" && <Badge variant="destructive">failed</Badge>}
                    {c.tags.map((t) => (
                      <Badge key={t} variant="outline" className="font-normal">
                        #{t}
                      </Badge>
                    ))}
                  </div>
                </Link>
              ))}
            </div>
          )}
        </section>
      </main>
    </div>
  );
}
