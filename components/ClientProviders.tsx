// components/ClientProviders.tsx
"use client";

import React, { useMemo, useEffect } from "react";
import { usePathname } from "next/navigation";
import { Room } from "livekit-client";
import { RoomContext, RoomAudioRenderer, StartAudio } from "@livekit/components-react";
import { QueryProvider } from "@/components/QueryProvider";
import TopBanner from "@/components/TopBanner";
import { MenuBar } from "@/components/MenuBar";
import { Toaster } from "@/components/ui/sonner";

interface Props { children: React.ReactNode; }

export default function ClientProviders({ children }: Props) {
  const room = useMemo(() => new Room(), []);
  const pathname = usePathname();
  const isAuthRoute = pathname?.startsWith("/auth");

  useEffect(() => {
    return () => { try { room.disconnect(); } catch {} };
  }, [room]);

  return (
    <RoomContext.Provider value={room}>
      {/* Audio plumbing always ok */}
      <RoomAudioRenderer />
      <StartAudio label="Start Audio" />

      <QueryProvider>
        {/* Only show TopBanner/MenuBar outside of auth */}
        {!isAuthRoute && <TopBanner />}
        <div className={!isAuthRoute ? "pt-16 pb-20 min-h-screen" : "min-h-screen"}>{children}</div>
        {!isAuthRoute && <MenuBar />}
        <Toaster />
      </QueryProvider>
    </RoomContext.Provider>
  );
}
