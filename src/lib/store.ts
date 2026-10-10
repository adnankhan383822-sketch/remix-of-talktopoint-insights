import { useEffect, useState, useCallback } from "react";
import { SAMPLES } from "@/data/samples";
import type { Conversation } from "./types";

const KEY = "ttp:conversations:v1";
const EVENT = "ttp:store";

function readSaved(): Record<string, Conversation> {
  if (typeof window === "undefined") return {};
  try {
    return JSON.parse(localStorage.getItem(KEY) ?? "{}");
  } catch {
    return {};
  }
}

export function listConversations(): Conversation[] {
  const saved = readSaved();
  const merged = new Map<string, Conversation>();
  for (const s of SAMPLES) merged.set(s.id, s);
  for (const c of Object.values(saved)) merged.set(c.id, c);
  return [...merged.values()].sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

export function getConversation(id: string): Conversation | undefined {
  return readSaved()[id] ?? SAMPLES.find((s) => s.id === id);
}

export function saveConversation(c: Conversation) {
  const saved = readSaved();
  saved[c.id] = c;
  localStorage.setItem(KEY, JSON.stringify(saved));
  window.dispatchEvent(new Event(EVENT));
}

export function deleteConversation(id: string) {
  const saved = readSaved();
  delete saved[id];
  localStorage.setItem(KEY, JSON.stringify(saved));
  window.dispatchEvent(new Event(EVENT));
}

/** Hydration-safe hook: samples on the server, samples + saved after mount. */
export function useConversations() {
  const [list, setList] = useState<Conversation[]>(() =>
    [...SAMPLES].sort((a, b) => b.createdAt.localeCompare(a.createdAt)),
  );
  useEffect(() => {
    const sync = () => setList(listConversations());
    sync();
    window.addEventListener(EVENT, sync);
    return () => window.removeEventListener(EVENT, sync);
  }, []);
  return list;
}

export function useConversation(id: string) {
  const [conv, setConv] = useState<Conversation | undefined>(() =>
    SAMPLES.find((s) => s.id === id),
  );
  const [loaded, setLoaded] = useState(false);
  useEffect(() => {
    const sync = () => {
      setConv(getConversation(id));
      setLoaded(true);
    };
    sync();
    window.addEventListener(EVENT, sync);
    return () => window.removeEventListener(EVENT, sync);
  }, [id]);
  const update = useCallback((c: Conversation) => saveConversation(c), []);
  return { conv, loaded, update };
}
