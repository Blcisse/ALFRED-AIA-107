// app/alfred/page.tsx
"use client";

import React, { useEffect, useMemo, useState, useRef } from "react";
import { Room, RoomEvent } from "livekit-client";
import {
  RoomAudioRenderer,
  RoomContext,
  StartAudio,
} from "@livekit/components-react";
import AlfredSessionView from "@/components/AlfredSessionView";
import { Toaster } from "@/components/ui/sonner";
import useConnectionDetails from "@/hooks/useConnectionDetails";
import type { AppConfig } from "@/lib/types";

const DEFAULT_APP_CONFIG = {
  supportsChatInput: true,
  supportsVideoInput: false,
  supportsScreenShare: false,
  isPreConnectBufferEnabled: true,
} as unknown as AppConfig;

export default function AlfredPageRoute() {
  const room = useMemo(() => new Room(), []);
  const [sessionStarted, setSessionStarted] = useState(false);
  const { connectionDetails, refreshConnectionDetails } = useConnectionDetails();
  const [debugRoomState, setDebugRoomState] = useState(room.state);
  const [isConnecting, setIsConnecting] = useState(false);
  const [micGranted, setMicGranted] = useState<boolean | null>(null); // null = not attempted
  const abortRef = useRef(false);

  // Keep debug room state updated
  useEffect(() => {
    const onStateChange = () => setDebugRoomState(room.state);
    room.on(RoomEvent.Disconnected, onStateChange);
    room.on(RoomEvent.ParticipantConnected, onStateChange);
    room.on(RoomEvent.ParticipantDisconnected, onStateChange);
    room.on(RoomEvent.Connected, onStateChange);
    return () => {
      room.off(RoomEvent.Disconnected, onStateChange);
      room.off(RoomEvent.ParticipantConnected, onStateChange);
      room.off(RoomEvent.ParticipantDisconnected, onStateChange);
      room.off(RoomEvent.Connected, onStateChange);
    };
  }, [room]);

  // Clean up on unmount
  useEffect(() => {
    return () => {
      abortRef.current = true;
      try {
        room.disconnect();
      } catch {
        /* ignore */
      }
    };
  }, [room]);

  // Auto-request microphone permission on mount
  useEffect(() => {
    (async () => {
      try {
        // Try to prompt for mic permission. This returns a stream or throws.
        await navigator.mediaDevices.getUserMedia({ audio: true });
        setMicGranted(true);
        setSessionStarted(true); // automatic start
      } catch (err) {
        // Permission denied or blocked
        console.warn("Microphone permission not granted automatically:", err);
        setMicGranted(false);
        // We do not set sessionStarted here — show fallback button
      }
    })();
  }, []);

  // If sessionStarted is true and connection details exist, attempt to connect
  useEffect(() => {
    let localAborted = false;
    const start = async () => {
      if (!sessionStarted || !connectionDetails) return;
      if (room.state !== "disconnected") return;

      setIsConnecting(true);
      try {
        // Use pre-connect approach if configured: set microphone enabled then connect
        await Promise.all([
          room.localParticipant.setMicrophoneEnabled(true, undefined, {
            preConnectBuffer: DEFAULT_APP_CONFIG.isPreConnectBufferEnabled,
          }),
          room.connect(connectionDetails.serverUrl, connectionDetails.participantToken),
        ]);
        console.log("Connected to room:", connectionDetails.roomName);
      } catch (err) {
        if (localAborted || abortRef.current) return;
        console.error("Error connecting to room:", err);
        // optionally refresh token and retry
        refreshConnectionDetails();
      } finally {
        if (!localAborted) setIsConnecting(false);
      }
    };

    start();

    return () => {
      localAborted = true;
    };
  }, [sessionStarted, connectionDetails, room, refreshConnectionDetails]);

  // Listeners for device errors and disconnection -> keep state coherent
  useEffect(() => {
    const onDisconnected = () => {
      setSessionStarted(false);
      refreshConnectionDetails();
      console.log("Room disconnected — sessionStarted set to false");
    };
    const onMediaDevicesError = (error: Error) => {
      console.error("Media devices error", error);
    };
    room.on(RoomEvent.MediaDevicesError, onMediaDevicesError);
    room.on(RoomEvent.Disconnected, onDisconnected);
    return () => {
      room.off(RoomEvent.Disconnected, onDisconnected);
      room.off(RoomEvent.MediaDevicesError, onMediaDevicesError);
    };
  }, [room, refreshConnectionDetails]);

  function stopSession() {
    setSessionStarted(false);
    try {
      room.disconnect();
    } catch (err) {
      console.warn("Error disconnecting room:", err);
    }
  }

  async function handleManualEnableMicAndStart() {
    // Called when automatic mic permission was blocked and user clicks fallback button
    try {
      await navigator.mediaDevices.getUserMedia({ audio: true });
      setMicGranted(true);
      setSessionStarted(true);
    } catch (err) {
      console.error("User refused or microphone unavailable:", err);
      setMicGranted(false);
    }
  }

  return (
    <RoomContext.Provider value={room}>
      <RoomAudioRenderer />
      {/* StartAudio provides a small button if browser requires a gesture to start audio */}
      <StartAudio label="Enable Audio" />

      {/* Outer container: keep page styling consistent (transparent main) */}
      <div className="flex flex-col min-h-screen bg-transparent text-white">
        {/* Top bar simplified — keep Stop button so developer can quickly stop session */}
        <header className="flex items-center justify-between p-4">
          <h1 className="text-lg font-semibold">Alfred — Live Session</h1>
          <div className="flex items-center gap-2">
            {sessionStarted ? (
              <button
                onClick={stopSession}
                className="px-3 py-1 rounded bg-red-600 hover:bg-red-500 text-white"
                aria-label="Stop session"
              >
                Stop Session
              </button>
            ) : (
              // If mic permission was blocked, show fallback button to let user enable mic (user gesture)
              micGranted === false && (
                <button
                  onClick={handleManualEnableMicAndStart}
                  className="px-3 py-1 rounded bg-blue-600 hover:bg-blue-500 text-white"
                >
                  Enable Mic & Start Session
                </button>
              )
            )}
          </div>
        </header>

        {/* Main content area: auto-starts */}
        <main className="flex-1 overflow-hidden bg-transparent">
          <AlfredSessionView
            appConfig={DEFAULT_APP_CONFIG}
            disabled={!sessionStarted}
            sessionStarted={sessionStarted}
          />
        </main>

        {/* Optional debug footer */}
        <footer className="p-2 text-xs">
          Room state: <strong>{debugRoomState}</strong>
          <div className="mt-1">
            {connectionDetails ? (
              <pre className="whitespace-pre-wrap text-xs">{JSON.stringify(connectionDetails, null, 2)}</pre>
            ) : (
              <span className="text-xs opacity-70">Waiting for connection details...</span>
            )}
          </div>
        </footer>
      </div>

      <Toaster />
    </RoomContext.Provider>
  );
}



