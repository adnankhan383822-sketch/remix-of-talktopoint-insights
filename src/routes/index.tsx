import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowRight, Quote, ListChecks, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Logo } from "@/components/app/AppHeader";
import { ThemeToggle } from "@/components/app/theme";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "TalktoPoint — Stop re-reading long conversations" },
      { name: "description", content: "Paste a chat, meeting or ticket. Get summaries, decisions and action items — every insight cited to the exact message." },
      { property: "og:title", content: "TalktoPoint — Stop re-reading long conversations" },
      { property: "og:description", content: "AI conversation intelligence with citations to every source message." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Landing,
});

const FEATURES = [
  { icon: Quote, title: "Every insight is cited", body: "Click any source chip to jump straight to the message it came from." },
  { icon: ListChecks, title: "Actions, owners, deadlines", body: "Tasks are pulled out automatically and ready for your board." },
  { icon: ShieldCheck, title: "Privacy shield", body: "Emails, phone and card numbers are masked before the AI ever sees them." },
];

function Landing() {
  return (
    <div className="relative min-h-screen overflow-hidden">
      <div className="pointer-events-none absolute inset-0 bg-gradient-hero" />
      <header className="relative mx-auto flex h-16 max-w-6xl items-center px-4 sm:px-6">
        <Logo />
        <div className="ml-auto flex items-center gap-2">
          <ThemeToggle />
          <Button asChild variant="ghost">
            <Link to="/dashboard">Sign in</Link>
          </Button>
        </div>
      </header>

      <main className="relative mx-auto max-w-6xl px-4 pb-24 pt-16 sm:px-6 sm:pt-24">
        <div className="mx-auto max-w-3xl text-center">
          <span className="inline-flex items-center gap-2 rounded-full border bg-card/70 px-3 py-1 text-xs font-medium text-muted-foreground shadow-card backdrop-blur">
            <span className="h-1.5 w-1.5 rounded-full bg-success" /> Summaries · Decisions · Actions · Citations
          </span>
          <h1 className="mt-6 text-4xl font-extrabold leading-[1.05] sm:text-6xl">
            Stop re-reading <span className="text-gradient">long conversations</span>
          </h1>
          <p className="mx-auto mt-5 max-w-xl text-lg text-muted-foreground">
            Paste a team chat, meeting transcript or support ticket. Get the point in seconds — with proof.
          </p>
          <div className="mt-8 flex flex-wrap justify-center gap-3">
            <Button asChild size="lg" className="bg-gradient-primary shadow-glow transition-transform hover:-translate-y-0.5">
              <Link to="/c/$id" params={{ id: "sample-startup" }}>
                Try demo <ArrowRight className="ml-1 h-4 w-4" />
              </Link>
            </Button>
            <Button asChild size="lg" variant="outline">
              <Link to="/dashboard">Sign in</Link>
            </Button>
          </div>
        </div>

        {/* Product glimpse */}
        <div className="mx-auto mt-16 max-w-4xl rounded-3xl border bg-card/80 p-3 shadow-card backdrop-blur">
          <div className="grid gap-3 rounded-2xl bg-muted/50 p-4 sm:grid-cols-2">
            <div className="space-y-2.5">
              {[
                ["Leo", "For Pro I propose $29/month flat.", "6"],
                ["Dev", "Flat is simplest to build. Per-seat adds a week.", "7"],
                ["Maya", "Decision: Pro is $29/month flat. Let's go.", "8"],
              ].map(([s, t, n]) => (
                <div key={n} className={`rounded-2xl border bg-card px-3 py-2 text-sm ${n === "8" ? "border-primary ring-2 ring-primary/20" : ""}`}>
                  <div className="mb-0.5 text-xs font-semibold">{s} <span className="font-mono text-muted-foreground">#{n}</span></div>
                  {t}
                </div>
              ))}
            </div>
            <div className="rounded-2xl border bg-card p-4">
              <div className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Decision</div>
              <p className="mt-1 font-semibold">Pro plan priced at $29/month flat</p>
              <div className="mt-2 flex gap-1">
                {["6", "8"].map((n) => (
                  <span key={n} className="rounded-md bg-primary/10 px-1.5 font-mono text-[10px] text-primary">msg {n}</span>
                ))}
              </div>
              <div className="mt-4 h-1.5 w-full rounded-full bg-muted">
                <div className="h-full w-[97%] rounded-full bg-success" />
              </div>
              <div className="mt-1 text-right font-mono text-[11px] text-muted-foreground">97% verified</div>
            </div>
          </div>
        </div>

        <div className="mt-20 grid gap-5 sm:grid-cols-3">
          {FEATURES.map((f) => (
            <div key={f.title} className="rounded-2xl border bg-card p-6 shadow-card transition-all hover:-translate-y-1">
              <div className="grid h-10 w-10 place-items-center rounded-xl bg-accent text-accent-foreground">
                <f.icon className="h-5 w-5" />
              </div>
              <h3 className="mt-4 text-lg font-semibold">{f.title}</h3>
              <p className="mt-1.5 text-sm text-muted-foreground">{f.body}</p>
            </div>
          ))}
        </div>
      </main>
    </div>
  );
}
