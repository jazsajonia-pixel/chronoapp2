/** Tiny event bus (replaces window.dispatchEvent / CustomEvent from the website). */
type Handler = (detail?: unknown) => void;
const handlers = new Map<string, Set<Handler>>();

export function emit(name: string, detail?: unknown): void {
  for (const h of handlers.get(name) ?? []) h(detail);
}

export function on(name: string, h: Handler): () => void {
  let set = handlers.get(name);
  if (!set) handlers.set(name, (set = new Set()));
  set.add(h);
  return () => set!.delete(h);
}
