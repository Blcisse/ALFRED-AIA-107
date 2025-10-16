// components/App.tsx
"use client";

import { useEffect, useMemo, useState } from "react";
import { Room, RoomEvent } from "livekit-client";
import { motion } from "motion/react";
import { RoomAudioRenderer, RoomContext, StartAudio } from "@livekit/components-react";
import SessionView from "@/components/AlfredSessionView";
import { Toaster } from "@/components/ui/sonner";
import useConnectionDetails from "@/hooks/useConnectionDetails";
import type { AppConfig } from "@/lib/types";
import { QueryProvider } from "@/components/QueryProvider"; // ✅ Added import

const MotionSessionView = motion.create(SessionView);

interface AppProps {
  appConfig: AppConfig;
}

export function App({ appConfig }: AppProps) {
  const room = useMemo(() => new Room(), []);
  const [sessionStarted, setSessionStarted] = useState(false);
  const { connectionDetails, refreshConnectionDetails } = useConnectionDetails();

  useEffect(() => {
    const onDisconnected = () => {
      setSessionStarted(false);
      refreshConnectionDetails();
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

  useEffect(() => {
    let aborted = false;
    if (sessionStarted && room.state === "disconnected" && connectionDetails) {
      Promise.all([
        room.localParticipant.setMicrophoneEnabled(true, undefined, {
          preConnectBuffer: appConfig.isPreConnectBufferEnabled,
        }),
        room.connect(connectionDetails.serverUrl, connectionDetails.participantToken),
      ]).catch((error) => {
        if (aborted) return;
        console.error("There was an error connecting to the agent", error);
      });
    }
    return () => {
      aborted = true;
      room.disconnect();
    };
  }, [room, sessionStarted, connectionDetails, appConfig.isPreConnectBufferEnabled]);

  return (
    <RoomContext.Provider value={room}>
      <QueryProvider> {/*  Now QueryProvider wraps everything */}
        <RoomAudioRenderer />
        <StartAudio label="Start Audio" />
        <MotionSessionView
          key="session-view"
          appConfig={appConfig}
          disabled={!sessionStarted}
          sessionStarted={sessionStarted}
          initial={{ opacity: 0 }}
          animate={{ opacity: sessionStarted ? 1 : 0 }}
          transition={{ duration: 0.5, ease: "linear", delay: sessionStarted ? 0.5 : 0 }}
        />
        <Toaster />
      </QueryProvider>
    </RoomContext.Provider>
  );
}
