import { useCallback, useEffect, useRef, useState } from "react";
import { listProviders } from "./api";
import { useSession } from "@/stores/session";
import type { ProvidersResponse } from "@/types/ai";

export type ProvidersState =
  | { status: "loading" }
  | { status: "error"; error: unknown }
  | { status: "ready"; data: ProvidersResponse };

/** Loads the signed-in user's provider settings. */
export function useProviders() {
  const [state, setState] = useState<ProvidersState>({ status: "loading" });

  const reload = useCallback(() => {
    setState((s) => (s.status === "ready" ? s : { status: "loading" }));
    listProviders().then(
      (data) => setState({ status: "ready", data }),
      (error: unknown) => setState({ status: "error", error }),
    );
  }, []);

  useEffect(() => {
    // State starts as "loading", so the first fetch needs no synchronous update.
    listProviders().then(
      (data) => setState({ status: "ready", data }),
      (error: unknown) => setState({ status: "error", error }),
    );
  }, []);

  // Fetch again once a lost connection comes back, so "Couldn't load providers" clears by itself.
  const { reconnecting } = useSession();
  const wasReconnecting = useRef(reconnecting);
  useEffect(() => {
    const back = wasReconnecting.current && !reconnecting;
    wasReconnecting.current = reconnecting;
    if (!back) return;
    listProviders().then(
      (data) => setState({ status: "ready", data }),
      (error: unknown) => setState({ status: "error", error }),
    );
  }, [reconnecting]);

  /** Mutations return the full new list — apply it without refetching. */
  const apply = useCallback((data: ProvidersResponse) => setState({ status: "ready", data }), []);
  return { state, reload, apply };
}
