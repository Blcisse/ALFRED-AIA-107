// components/AuthTopBar.tsx
"use client";

import React, { useEffect, useState } from "react";

const GRADIENT1_FROM = "#3C9EEB";
const GRADIENT1_TO = "#15C7CB";

function DateTime() {
  const [now, setNow] = useState<string>(() => new Date().toLocaleString());
  useEffect(() => {
    const id = setInterval(() => setNow(new Date().toLocaleString()), 1000);
    return () => clearInterval(id);
  }, []);
  return (
    <span
      className="text-sm font-semibold tracking-wide"
      style={{
        backgroundImage: `linear-gradient(90deg, ${GRADIENT1_FROM}, ${GRADIENT1_TO})`,
        WebkitBackgroundClip: "text",
        backgroundClip: "text",
        color: "transparent",
        textShadow: "0 6px 18px rgba(0,0,0,0.35)",
      }}
    >
      {now}
    </span>
  );
}

export default function AuthTopBar() {
  return (
    <header className="fixed top-0 left-0 right-0 h-16 flex items-center justify-center z-50">
      {/* centered logo — reduced size to avoid overflow */}
      <img
        src="/alfredlogo.png"
        alt="Logo"
        className="rounded-full border-2 border-white/10 shadow-xl"
        style={{ width: "64px", height: "64px", objectFit: "cover" }}
      />
      {/* date/time at top-right with gradient text */}
      <div className="absolute top-3 right-4">
        <DateTime />
      </div>
    </header>
  );
}
