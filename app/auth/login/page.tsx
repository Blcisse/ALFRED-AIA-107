// app/auth/login/page.tsx
"use client";

import React, { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";

const GRADIENT1_FROM = "#3C9EEB";
const GRADIENT1_TO = "#15C7CB";

export default function LoginPage() {
  const router = useRouter();

  const [showSplash, setShowSplash] = useState(true);
  useEffect(() => {
    const t = setTimeout(() => setShowSplash(false), 5000);
    return () => clearTimeout(t);
  }, []);

  const [digits, setDigits] = useState(["", "", "", ""]);
  const inputs = useRef<Array<HTMLInputElement | null>>([null, null, null, null]);

  const [imgOk, setImgOk] = useState<boolean>(false);
  const [imgErr, setImgErr] = useState<string | null>(null);

  async function submitLogin(code: string) {
    if (!/^\d{4}$/.test(code)) return;
    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code }),
      });
      if (res.ok) {
        router.push("/");
      } else {
        alert("Invalid code");
      }
    } catch (e) {
      console.error("Login error:", e);
    }
  }

  const onChangeDigit = (idx: number, val: string) => {
    const v = val.replace(/\D/g, "").slice(0, 1);
    const next = [...digits];
    next[idx] = v;
    setDigits(next);

    if (v && idx < 3) inputs.current[idx + 1]?.focus();
    if (next.join("").length === 4) submitLogin(next.join(""));
  };

  const onKeyDownDigit = (idx: number, e: React.KeyboardEvent) => {
    if (e.key === "Backspace" && !digits[idx] && idx > 0) {
      inputs.current[idx - 1]?.focus();
    }
  };

  return (
    <main className="relative min-h-screen overflow-hidden">
      <header className="fixed top-0 left-0 right-0 z-30 flex items-center justify-center h-16">
        <div className="absolute right-4 top-1/2 -translate-y-1/2 text-white/80 text-xs sm:text-sm">
          {new Date().toLocaleString()}
        </div>
      </header>

      {showSplash && (
        <div className="fixed inset-0 z-50 splash-grid">
          <div className="absolute inset-0 splash-fade" />
          <img
            src="/alfredlogo2.png"
            alt="alfredlogo2"
            className="splash-logo"
            onLoad={() => setImgOk(true)}
            onError={() => setImgErr("Failed to load /alfredlogo.png")}
          />
          {imgErr && (
            <div className="absolute top-4 left-4 text-red-400 text-xs">
              {imgErr}
            </div>
          )}
        </div>
      )}

      <div className="flex items-center justify-center min-h-screen px-4">
        <div
          className="w-full max-w-md sm:max-w-lg md:max-w-xl mx-auto px-6 sm:px-8 py-8 sm:py-10 rounded-2xl"
          style={{
            marginTop: "4.5rem",
            backdropFilter: "blur(10px)",
            background: "rgba(10, 18, 35, 0.35)",
            border: `1px solid ${GRADIENT1_FROM}55`,
            boxShadow: "0 18px 60px rgba(0,0,0,0.45)",
          }}
        >
          <h1 className="text-center text-white/95 text-lg sm:text-xl font-semibold mb-3 sm:mb-5">
            Enter 4-digit authorization code
          </h1>

          <div className="flex items-center justify-center gap-3 sm:gap-4 mb-8 sm:mb-10">
            {digits.map((d, i) => (
              <input
                key={i}
                ref={(el) => (inputs.current[i] = el)}
                inputMode="numeric"
                pattern="\d*"
                maxLength={1}
                value={d}
                onChange={(e) => onChangeDigit(i, e.target.value)}
                onKeyDown={(e) => onKeyDownDigit(i, e)}
                className="text-center text-2xl sm:text-3xl font-bold text-white rounded-xl bg-white/5 border focus:outline-none focus:ring-2"
                style={{
                  width: "3.25rem",
                  height: "4rem",
                  borderColor: GRADIENT1_FROM,
                  boxShadow: `0 8px 24px ${GRADIENT1_FROM}22`,
                }}
              />
            ))}
          </div>

          <button
            onClick={() => submitLogin(digits.join(""))}
            className="w-full py-3 rounded-xl text-white font-semibold mb-4"
            style={{
              background: `linear-gradient(90deg, ${GRADIENT1_FROM}, ${GRADIENT1_TO})`,
              border: `1px solid ${GRADIENT1_FROM}`,
            }}
          >
            Continue
          </button>

          <div className="mt-3 text-center">
            <button
              onClick={() => router.push("/auth/signup")}
              className="text-white/85 underline decoration-white/40 underline-offset-4 hover:text-white"
            >
              Sign up
            </button>
          </div>
        </div>
      </div>

      <div className="login-grid absolute inset-0 -z-10" />

      <style jsx>{`
        .splash-grid {
          background: #000322;
          background-image:
            conic-gradient(from 90deg at 1px 1px, transparent 90deg, ${GRADIENT1_FROM}22 0),
            conic-gradient(from 90deg at 1px 1px, transparent 90deg, ${GRADIENT1_FROM}22 0);
          background-size: 45px 45px, 45px 45px;
          background-position: 0 0, 22.5px 22.5px;
        }
        .splash-fade {
          position: absolute;
          inset: 0;
          background: radial-gradient(320px 320px at 0% 100%, #000322, transparent 65%);
          pointer-events: none;
          z-index: 1;
        }
        .splash-logo {
          position: absolute;
          left: 50%;
          top: 46%;
          transform: translate(-50%, -50%);
          width: 190px;
          height: 160px;
          border-radius: 0px;
          z-index: 2;
          animation:
            floatUp 2.0s ease-out forwards 0.35s,
            splashOut 0.6s ease-in 4.4s forwards;
          box-shadow:
            0 18px 60px rgba(0, 0, 0, 0.5),
            0 0 0 1px ${GRADIENT1_FROM}88 inset;
        }
        @keyframes floatUp {
          0% {
            transform: translate(-50%, 30vh) scale(0.9);
            opacity: 0;
          }
          70% {
            transform: translate(-50%, -55%) scale(1.04);
            opacity: 1;
          }
          100% {
            transform: translate(-50%, -50%) scale(1);
          }
        }
        @keyframes splashOut {
          to {
            opacity: 0;
            visibility: hidden;
          }
        }
        .login-grid {
          background: #000322;
          background-image:
            conic-gradient(from 90deg at 1px 1px, transparent 90deg, ${GRADIENT1_FROM}22 0),
            conic-gradient(from 90deg at 1px 1px, transparent 90deg, ${GRADIENT1_FROM}22 0);
          background-size: 45px 45px, 45px 45px;
          background-position: 0 0, 22.5px 22.5px;
        }
      `}</style>
    </main>
  );
}
