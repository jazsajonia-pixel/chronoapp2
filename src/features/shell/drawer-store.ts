import { useSyncExternalStore } from "react";
import { router } from "expo-router";

/** Open state of the app drawer (the signed-in navigation sidebar). */
let open = false;
const listeners = new Set<() => void>();
const set = (next: boolean) => {
  if (open === next) return;
  open = next;
  listeners.forEach((l) => l());
};

export const openDrawer = () => set(true);
export const closeDrawer = () => set(false);

export function useDrawerOpen(): boolean {
  return useSyncExternalStore(
    (l) => {
      listeners.add(l);
      return () => listeners.delete(l);
    },
    () => open,
  );
}

/** Top-level destinations reachable from the drawer. Home is the start destination. */
export const TOP_LEVEL = ["/home", "/projects", "/ai", "/settings"] as const;
export type TopLevel = (typeof TOP_LEVEL)[number];

/**
 * Go to a top-level destination and keep the back stack shallow and predictable:
 * Home stays at the bottom, at most one other destination sits on top of it, and
 * Back from that destination returns Home (Material "start destination" behaviour).
 */
export function goTopLevel(href: TopLevel, pathname: string): void {
  if (pathname === href) return;
  const fromTop = (TOP_LEVEL as readonly string[]).includes(pathname);
  if (href === "/home") router.dismissTo("/home");
  else if (pathname === "/home") router.push(href);
  else if (fromTop) router.replace(href);
  else router.dismissTo(href);
}
