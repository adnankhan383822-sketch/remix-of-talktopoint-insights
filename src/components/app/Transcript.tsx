import { useMemo } from "react";
import type { Message } from "@/lib/types";
import { cn } from "@/lib/utils";

const SPEAKER_TONES = [
  "bg-chart-1/15 text-chart-1",
  "bg-chart-2/15 text-chart-2",
  "bg-chart-3/15 text-chart-3",
  "bg-chart-4/20 text-chart-4",
  "bg-chart-5/15 text-chart-5",
];

export function speakerIndex(messages: Message[]) {
  const map = new Map<string, number>();
  for (const m of messages) if (!map.has(m.speaker)) map.set(m.speaker, map.size);
  return map;
}

function MaskedText({ text }: { text: string }) {
  return (
    <>
      {text.split(/(\[(?:EMAIL|PHONE|CARD) \d+\])/).map((s, i) =>
        /^\[(EMAIL|PHONE|CARD) \d+\]$/.test(s) ? (
          <span
            key={i}
            className="mx-0.5 rounded bg-warning/20 px-1 font-mono text-[11px] font-semibold text-foreground"
          >
            {s}
          </span>
        ) : (
          <span key={i}>{s}</span>
        ),
      )}
    </>
  );
}

export function Transcript({
  messages,
  highlight,
  flashKey,
  showOriginal,
}: {
  messages: Message[];
  highlight: number | null;
  flashKey: number;
  showOriginal: boolean;
}) {
  const speakers = useMemo(() => speakerIndex(messages), [messages]);
  const first = messages[0]?.speaker;
  return (
    <ol className="space-y-3">
      {messages.map((m, idx) => {
        const si = speakers.get(m.speaker) ?? 0;
        const mine = m.speaker === first;
        const sameAsPrev = messages[idx - 1]?.speaker === m.speaker;
        const active = highlight === m.id;
        return (
          <li
            key={m.id}
            id={`msg-${m.id}`}
            className={cn("flex scroll-mt-24 gap-3", mine ? "flex-row" : "flex-row-reverse")}
          >
            <div
              className={cn(
                "grid h-8 w-8 shrink-0 place-items-center rounded-full text-xs font-bold",
                SPEAKER_TONES[si % SPEAKER_TONES.length],
                sameAsPrev && "invisible",
              )}
            >
              {m.speaker.slice(0, 2).toUpperCase()}
            </div>
            <div className={cn("flex max-w-[85%] flex-col", mine ? "items-start" : "items-end")}>
              {!sameAsPrev && (
                <div className="mb-1 flex items-center gap-2 px-1 text-xs">
                  <span className="font-semibold">{m.speaker}</span>
                  {m.timestamp && <span className="font-mono text-muted-foreground">{m.timestamp}</span>}
                </div>
              )}
              <div
                key={active ? flashKey : undefined}
                className={cn(
                  "relative rounded-2xl border px-3.5 py-2.5 text-sm leading-relaxed transition-colors",
                  mine ? "rounded-tl-md bg-card" : "rounded-tr-md bg-secondary",
                  active && "animate-flash border-primary",
                )}
              >
                <span className="absolute -top-2 right-2 rounded bg-background px-1 font-mono text-[9px] text-muted-foreground">
                  #{m.id}
                </span>
                <p className="whitespace-pre-wrap">
                  {showOriginal && m.original ? m.original : <MaskedText text={m.text} />}
                </p>
              </div>
            </div>
          </li>
        );
      })}
    </ol>
  );
}
