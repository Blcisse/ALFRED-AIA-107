// app/auth/signup/page.tsx
"use client";

import React, { useState } from "react";
import { useRouter } from "next/navigation";
import AuthTopBar from "@/components/AuthTopBar";

const GRADIENT1_FROM = "#3C9EEB";
const GRADIENT1_TO = "#15C7CB";

export default function SignupPage() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [code, setCode] = useState("");

  async function submit() {
    if (!/^\d{4}$/.test(code)) {
      alert("Code must be exactly 4 digits");
      return;
    }
    const res = await fetch("/api/auth/signup", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, code }),
    });
    if (res.ok) {
      alert("Sign up complete");
      router.push("/");
    } else {
      const j = await res.json().catch(() => ({}));
      alert(j?.error || "Failed to sign up");
    }
  }

  return (
    <main className="relative min-h-screen bg-transparent">
      <AuthTopBar />
      <div className="flex items-center justify-center min-h-screen px-4">
        <div
          className="glass w-full max-w-md sm:max-w-lg md:max-w-xl mx-auto px-6 sm:px-8 py-8 sm:py-10 rounded-2xl"
          style={{ marginTop: "4.5rem" }} /* below fixed header */
        >
          <h1 className="text-center text-white/95 text-lg sm:text-xl font-semibold mb-6">
            Create your access
          </h1>

          <label className="block text-white/80 mb-2">Name</label>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="w-full mb-4 h-11 px-3 rounded-xl bg-white/5 text-white border border-white/15 focus:outline-none focus:ring-2"
            placeholder="Your name"
          />

          <label className="block text-white/80 mb-2">4-digit authorization code</label>
          <input
            value={code}
            onChange={(e) => setCode(e.target.value.replace(/\D/g, "").slice(0, 4))}
            inputMode="numeric"
            className="w-full mb-6 h-11 px-3 rounded-xl bg-white/5 text-white border border-white/15 focus:outline-none focus:ring-2"
            placeholder="0000"
          />

          <button
            onClick={submit}
            className="w-full py-3 rounded-xl text-white font-semibold"
            style={{
              background: `linear-gradient(90deg, ${GRADIENT1_FROM}, ${GRADIENT1_TO})`,
              border: `1px solid ${GRADIENT1_FROM}`,
            }}
          >
            Sign up
          </button>

          <div className="mt-6 text-center">
            <button
              onClick={() => router.push("/auth/login")}
              className="text-white/85 underline decoration-white/40 underline-offset-4 hover:text-white"
            >
              Back to login
            </button>
          </div>
        </div>
      </div>
    </main>
  );
}
