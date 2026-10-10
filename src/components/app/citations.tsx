import { createContext, useContext, Fragment, useEffect, useState } from "react";
import { cn } from "@/lib/utils";

export const CitationContext = createContext<(id: number) => void>(() => {});

export function SourceChip({ id }: { id: number }) {
  const jump = useContext(CitationContext);
  return (
    <button
      type="button"
      onClick={() => jump(id)}
      className="mx-0.5 inline-flex items-center rounded-md border border-primary/20 bg-primary/10 px-1.5 py-px align-middle font-mono text-[10px] font-medium text-primary transition-all hover:-translate-y-px hover:bg-primary hover:text-primary-foreground"
    >
      msg {id}
    </button>
  );
}

export function SourceChips({ ids, className }: { ids: number[]; className?: string }) {
  if (!ids.length) return null;
  return (
    <span className={cn("inline-flex flex-wrap gap-1", className)}>
      {ids.map((i) => (
        <SourceChip key={i} id={i} />
      ))}
    </span>
  );
}

const CITE = /\[(\d+(?:\s*,\s*\d+)*)\]/g;

/** Renders text with inline [3,8] markers as clickable chips, and **bold** / "- " bullets. */
export function CitedText({ text }: { text: string }) {
  const paragraphs = text.split(/\n+/);
  return (
    <div className="space-y-3 leading-relaxed">
      {paragraphs.map((p, i) => {
        const bullet = /^\s*[-*•]\s+/.test(p);
        const content = <Inline text={p.replace(/^\s*[-*•]\s+/, "")} />;
        return bullet ? (
          <div key={i} className="flex gap-2 pl-1">
            <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-primary" />
            <p>{content}</p>
          </div>
        ) : (
          <p key={i}>{content}</p>
        );
      })}
    </div>
  );
}

function Inline({ text }: { text: string }) {
  const parts: React.ReactNode[] = [];
  let last = 0;
  for (const m of text.matchAll(CITE)) {
    parts.push(<Bold key={`t${last}`} text={text.slice(last, m.index)} />);
    const ids = (m[1] ?? "").split(",").map((s) => Number(s.trim()));
    parts.push(<SourceChips key={`c${m.index}`} ids={ids} />);
    last = (m.index ?? 0) + m[0].length;
  }
  parts.push(<Bold key="end" text={text.slice(last)} />);
  return <>{parts}</>;
}

function Bold({ text }: { text: string }) {
  return (
    <>
      {text.split(/(\*\*[^*]+\*\*)/).map((s, i) =>
        s.startsWith("**") ? (
          <strong key={i} className="font-semibold text-foreground">
            {s.slice(2, -2)}
          </strong>
        ) : (
          <Fragment key={i}>{s}</Fragment>
        ),
      )}
    </>
  );
}

/** Streaming-style reveal for freshly generated AI text. */
export function TypewriterCited({ text, animate }: { text: string; animate: boolean }) {
  const [n, setN] = useState(animate ? 0 : text.length);
  useEffect(() => {
    if (!animate) {
      setN(text.length);
      return;
    }
    setN(0);
    const step = Math.max(2, Math.ceil(text.length / 120));
    const t = setInterval(() => {
      setN((v) => {
        if (v >= text.length) {
          clearInterval(t);
          return v;
        }
        return v + step;
      });
    }, 16);
    return () => clearInterval(t);
  }, [text, animate]);
  const done = n >= text.length;
  if (done) return <CitedText text={text} />;
  return (
    <div className="leading-relaxed whitespace-pre-wrap text-foreground/90">
      {text.slice(0, n).replace(/\*\*/g, "")}
      <span className="animate-caret ml-0.5 inline-block h-4 w-1.5 translate-y-0.5 rounded-sm bg-primary" />
    </div>
  );
}
