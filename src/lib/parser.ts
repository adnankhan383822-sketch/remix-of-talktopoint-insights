import type { MaskItem, Message } from "./types";

const TIME = String.raw`\d{1,2}:\d{2}(?::\d{2})?\s?(?:[AaPp][Mm])?`;
// WhatsApp: "10/10/26, 14:02 - Name: msg" or "[10/10/26, 2:02 PM] Name: msg"
const WHATSAPP = new RegExp(
  String.raw`^\[?(\d{1,2}[/.]\d{1,2}[/.]\d{2,4}),?\s+(${TIME})\]?\s*[-–]?\s*([^:]{1,40}?):\s*(.*)$`,
);
// "[09:02] Name: msg" or "09:02 Name: msg"
const TIMED = new RegExp(String.raw`^\[?(${TIME})\]?\s*[-–]?\s*([^:\[\]]{1,40}?):\s*(.*)$`);
// "Name: msg" — any language/script (Urdu, Arabic, etc.), not just Latin capitals
const PLAIN = /^([^\s:0-9][^:]{0,39}?):\s+(.*)$/;

export function parseConversation(raw: string): Message[] {
  const out: Message[] = [];
  const lines = raw.replace(/\r/g, "").split("\n");
  for (const line of lines) {
    const t = line.trim();
    if (!t) continue;
    let speaker: string | null = null;
    let ts: string | null = null;
    let text = "";
    let m = t.match(WHATSAPP);
    if (m) {
      ts = m[2] ?? null;
      speaker = m[3] ?? null;
      text = m[4] ?? "";
    } else if ((m = t.match(TIMED))) {
      ts = m[1] ?? null;
      speaker = m[2] ?? null;
      text = m[3] ?? "";
    } else if ((m = t.match(PLAIN))) {
      speaker = m[1] ?? null;
      text = m[2] ?? "";
    }
    if (speaker) {
      out.push({ id: out.length + 1, speaker: speaker.trim(), timestamp: ts?.trim() ?? null, text });
    } else if (out.length) {
      out[out.length - 1]!.text += "\n" + t;
    } else {
      out.push({ id: 1, speaker: "Unknown", timestamp: null, text: t });
    }
  }
  return out;
}

const PATTERNS: { kind: MaskItem["kind"]; re: RegExp; label: string }[] = [
  { kind: "email", re: /[\w.+-]+@[\w-]+\.[\w.-]+/g, label: "EMAIL" },
  { kind: "card", re: /\b(?:\d[ -]?){12,15}\d\b/g, label: "CARD" },
  { kind: "phone", re: /(?:\+?\d{1,3}[\s.-]?)?\(?\d{3}\)?[\s.-]?\d{3}[\s.-]?\d{4}\b/g, label: "PHONE" },
];

/** Privacy shield: masks emails, cards and phone numbers before anything reaches the AI. */
export function maskMessages(messages: Message[]): { messages: Message[]; masked: MaskItem[] } {
  const masked: MaskItem[] = [];
  const counters: Record<string, number> = {};
  const result = messages.map((msg) => {
    let text = msg.text;
    for (const p of PATTERNS) {
      text = text.replace(p.re, (match) => {
        counters[p.kind] = (counters[p.kind] ?? 0) + 1;
        const token = `[${p.label} ${counters[p.kind]}]`;
        masked.push({ token, kind: p.kind, original: match });
        return token;
      });
    }
    return text === msg.text ? msg : { ...msg, text, original: msg.text };
  });
  return { messages: result, masked };
}
