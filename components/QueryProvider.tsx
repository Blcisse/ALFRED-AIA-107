// components/QueryProvider.tsx
"use client";

import React, {
  createContext,
  useContext,
  useState,
  useRef,
  ReactNode,
  useCallback
} from "react";

export type AgentResponseShape = {
  reply?: string;
  action?: { type: string; payload?: any } | null;
  [k: string]: any;
};

type QueryContextPayload = Record<string, any> | undefined;

type SendQueryFn = (
  tool: string,
  prompt: string,
  context?: QueryContextPayload
) => Promise<AgentResponseShape | null>;

interface QueryContextValue {
  sendQuery: SendQueryFn;
  response: string | null;
  lastStructured: AgentResponseShape | null;
  isProcessing: boolean;
  lastError: string | null;
  cancelInFlight: () => void;
}

const QueryContext = createContext<QueryContextValue | undefined>(undefined);

/**
 * QueryProvider
 * - Posts to /api/assistant (Next proxy). That endpoint should forward to your FastAPI agent (or your Python agent).
 * - If backend returns structured JSON like { reply, action }, we set lastStructured and dispatch a window event 'agent:action'
 *   so UI code can respond to server-side actions (persisted changes, etc).
 */
export function QueryProvider({ children }: { children: ReactNode }) {
  const [response, setResponse] = useState<string | null>(null);
  const [lastStructured, setLastStructured] = useState<AgentResponseShape | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [lastError, setLastError] = useState<string | null>(null);

  const abortRef = useRef<AbortController | null>(null);

  const cancelInFlight = useCallback(() => {
    if (abortRef.current) {
      try {
        abortRef.current.abort();
      } catch (e) {
        /* ignore */
      }
      abortRef.current = null;
      setIsProcessing(false);
    }
  }, []);

  const sendQuery: SendQueryFn = useCallback(
    async (tool, prompt, context = {}) => {
      setResponse(null);
      setLastStructured(null);
      setLastError(null);
      setIsProcessing(true);

      // Abort previous
      if (abortRef.current) {
        try {
          abortRef.current.abort();
        } catch (e) {
          /* ignore */
        }
      }
      const ac = new AbortController();
      abortRef.current = ac;

      try {
        const res = await fetch("/api/assistant", {
          method: "POST",
          signal: ac.signal,
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ tool, prompt, context }),
        });

        if (!res.ok) {
          const txt = await res.text();
          throw new Error(`Agent responded ${res.status}: ${txt}`);
        }

        const contentType = res.headers.get("content-type") || "";

        if (contentType.includes("application/json")) {
          const data = await res.json();
          // normalized structured response expected: { reply, action?, ... }
          const structured: AgentResponseShape = data as AgentResponseShape;
          setLastStructured(structured);
          // set plain text response if available
          if (structured.reply) setResponse(String(structured.reply));
          else setResponse(JSON.stringify(structured));

          // Dispatch a window-level event so UI can listen for actions
          if (structured.action) {
            try {
              const ev = new CustomEvent("agent:action", { detail: structured.action });
              window.dispatchEvent(ev);
            } catch (e) {
              console.warn("Failed to dispatch agent:action event", e);
            }
          }
          return structured;
        } else {
          const txt = await res.text();
          setResponse(txt);
          return { reply: txt };
        }
      } catch (err: any) {
        if (err?.name === "AbortError") {
          setLastError("Request aborted");
        } else {
          console.error("sendQuery error:", err);
          setLastError(err?.message ?? String(err));
        }
        return null;
      } finally {
        setIsProcessing(false);
        abortRef.current = null;
      }
    },
    []
  );

  return (
    <QueryContext.Provider
      value={{ sendQuery, response, lastStructured, isProcessing, lastError, cancelInFlight }}
    >
      {children}
    </QueryContext.Provider>
  );
}

export function useQuery() {
  const ctx = useContext(QueryContext);
  if (!ctx) {
    throw new Error("useQuery must be used within a QueryProvider. Wrap your app with <QueryProvider />");
  }
  return ctx;
}

/**
 * Example usage in a page (listen to actions):
 *
 * useEffect(() => {
 *   function onAction(e: CustomEvent) {
 *     const action = e.detail; // { type: 'task_add', payload: {...} }
 *     // handle the action locally - e.g., update state, call a GET endpoint to re-sync, etc.
 *   }
 *   window.addEventListener('agent:action', onAction as EventListener);
 *   return () => window.removeEventListener('agent:action', onAction as EventListener);
 * }, []);
 *
 * Or use the provider's lastStructured to read the returned action directly.
 */
