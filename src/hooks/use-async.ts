import { useCallback, useEffect, useRef, useState } from "react";

export type AsyncState<T> =
  | { status: "loading"; data?: undefined; error?: undefined }
  | { status: "success"; data: T; error?: undefined }
  | { status: "error"; data?: undefined; error: unknown };

/**
 * Minimal data-loading hook with retry. Reruns when `deps` (primitives) change
 * and ignores results from stale runs.
 */
export function useAsync<T>(fn: () => Promise<T>, deps: readonly (string | number | boolean | null | undefined)[] = []) {
  const [state, setState] = useState<AsyncState<T>>({ status: "loading" });
  const [reloads, setReloads] = useState(0);
  const fnRef = useRef(fn);
  useEffect(() => {
    fnRef.current = fn;
  });

  // Switch back to loading in the same render the inputs change, not one frame later.
  const token = JSON.stringify(deps) + "#" + reloads;
  const [loadedFor, setLoadedFor] = useState(token);
  if (loadedFor !== token) {
    setLoadedFor(token);
    setState({ status: "loading" });
  }

  useEffect(() => {
    let live = true;
    fnRef.current().then(
      (data) => live && setState({ status: "success", data }),
      (error: unknown) => live && setState({ status: "error", error }),
    );
    return () => {
      live = false;
    };
  }, [token]);

  const retry = useCallback(() => setReloads((n) => n + 1), []);
  return { ...state, retry };
}
