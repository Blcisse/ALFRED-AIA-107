"use client";

import React, { useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import {
  type AgentState,
  type ReceivedChatMessage,
  useRoomContext,
  useVoiceAssistant,
} from "@livekit/components-react";
import { toastAlert } from "@/components/alert-toast";
import { AgentControlBar } from "@/components/livekit/agent-control-bar/agent-control-bar";
import { ChatEntry } from "@/components/livekit/chat/chat-entry";
import { ChatMessageView } from "@/components/livekit/chat/chat-message-view";
import { MediaTiles } from "@/components/livekit/media-tiles";
import useChatAndTranscription from "@/hooks/useChatAndTranscription";
import { useDebugMode } from "@/hooks/useDebug";
import type { AppConfig } from "@/lib/types";
import { cn } from "@/lib/utils";

function isAgentAvailable(agentState: AgentState | string | undefined) {
  return agentState === "listening" || agentState === "thinking" || agentState === "speaking";
}

interface SessionViewProps {
  appConfig: AppConfig;
  disabled: boolean;
  sessionStarted: boolean;
}

export default function AlfredSessionView({
  appConfig,
  disabled,
  sessionStarted,
}: SessionViewProps) {
  const { state: agentState } = useVoiceAssistant();
  const [chatOpen, setChatOpen] = useState(false);
  const { messages = [], send } = useChatAndTranscription(); // defensive default
  const room = useRoomContext();
  const timeoutRef = useRef<number | null>(null);

  useDebugMode();

  async function handleSendMessage(message: string) {
    try {
      await send(message);
      // open chat if it's closed so user can see the reply
      setChatOpen(true);
    } catch (err) {
      console.error("Failed to send message:", err);
      toastAlert({ title: "Send failed", description: "Couldn't send message to agent." });
    }
  }

  // If the session is started but an agent never becomes available, warn and disconnect
  useEffect(() => {
    if (!sessionStarted) {
      if (timeoutRef.current) {
        window.clearTimeout(timeoutRef.current);
        timeoutRef.current = null;
      }
      return;
    }

    // only run this check once per start
    timeoutRef.current = window.setTimeout(() => {
      if (!isAgentAvailable(agentState)) {
        const reason =
          agentState === "connecting"
            ? "Agent did not join the room."
            : "Agent connected but did not finish initializing.";
        toastAlert({
          title: "Session ended",
          description: (
            <p className="w-full">
              {reason}{" "}
              <a
                target="_blank"
                rel="noopener noreferrer"
                href="https://docs.livekit.io/agents/start/voice-ai/"
                className="whitespace-nowrap underline"
              >
                See quickstart guide
              </a>
              .
            </p>
          ),
        });

        // Try to disconnect gracefully
        try {
          room?.disconnect();
        } catch (e) {
          console.warn("Error while disconnecting room after agent absent:", e);
        }
      }
    }, 10_000);

    return () => {
      if (timeoutRef.current) {
        window.clearTimeout(timeoutRef.current);
        timeoutRef.current = null;
      }
    };
    // We intentionally only depend on sessionStarted and agentState here
  }, [agentState, sessionStarted, room]);

  const { supportsChatInput, supportsVideoInput, supportsScreenShare } = appConfig;
  const capabilities = {
    supportsChatInput,
    supportsVideoInput,
    supportsScreenShare,
  };

  // Defensive rendering of messages (ReceivedChatMessage typing may vary at runtime)
  const safeMessages: ReceivedChatMessage[] = Array.isArray(messages) ? messages : [];

  return (
    <main
      // inert attribute isn't standard in React typings; keep as-is if your project supports it,
      // otherwise use aria-hidden or conditional className to block interactions when disabled.
      inert={disabled}
      className={cn(
        "min-h-svh flex flex-col items-center justify-center bg-[var(--lk-bg)] w-full h-full",
        !chatOpen && "overflow-hidden"
      )}
    >
      <ChatMessageView
        className={cn(
          "transition-all duration-300 ease-out w-full max-w-2xl",
          chatOpen ? "translate-y-0 opacity-100" : "translate-y-10 opacity-0"
        )}
      >
        <div className="space-y-4 text-lg font-medium text-gray-800 dark:text-gray-200">
          <AnimatePresence>
            {safeMessages.map((message: ReceivedChatMessage) => (
              <motion.div
                key={message.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -20 }}
                transition={{ duration: 0.45, ease: "easeOut" }}
              >
                <ChatEntry hideName key={message.id} entry={message} />
              </motion.div>
            ))}
          </AnimatePresence>
        </div>
      </ChatMessageView>

      {sessionStarted && <MediaTiles chatOpen={chatOpen} />}

      <div className="fixed bottom-0 left-0 right-0 z-50 px-6 py-4 md:px-12 md:py-8 bg-transparent">
        <motion.div
          key="control-bar"
          initial={{ opacity: 0, translateY: "100%" }}
          animate={{ opacity: sessionStarted ? 1 : 0, translateY: sessionStarted ? "0%" : "100%" }}
          transition={{ duration: 0.3, delay: sessionStarted ? 0.45 : 0, ease: "easeOut" }}
        >
          <div className="relative z-10 mx-auto w-full max-w-2xl">
            {appConfig.isPreConnectBufferEnabled && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{
                  opacity: sessionStarted && safeMessages.length === 0 ? 1 : 0,
                  transition: {
                    ease: "easeIn",
                    delay: safeMessages.length > 0 ? 0 : 0.8,
                    duration: safeMessages.length > 0 ? 0.2 : 0.5,
                  },
                }}
                aria-hidden={safeMessages.length > 0}
                className={cn(
                  "absolute inset-x-0 -top-12 text-center",
                  sessionStarted && safeMessages.length === 0 && "pointer-events-none"
                )}
              >
                <p className="animate-text-shimmer inline-block !bg-clip-text text-sm font-semibold text-transparent">
                  Agent is listening — ask it a question
                </p>
              </motion.div>
            )}

            <AgentControlBar
              capabilities={capabilities}
              onChatOpenChange={setChatOpen}
              onSendMessage={handleSendMessage}
              disabled={!sessionStarted || disabled}
            />
          </div>
        </motion.div>
      </div>
    </main>
  );
}

