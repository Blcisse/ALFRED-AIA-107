// app/page.tsx
"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import AVS3D102Button from "@/components/AVS3D102Button";
import {
  CalendarBlank,
  ListChecks,
  Envelope,
  NotePencil,
  Newspaper,      // ⬅️ NEW: icon for myBlog
  CaretLeft,
  CaretRight,
} from "@phosphor-icons/react";

type Counts = {
  tasks: number;
  events: number;
  emails?: number;
  notes?: number;
  myblog?: number; // ⬅️ NEW
};

// Gradient 1 (from MenuBar)
const GRADIENT1_FROM = "#3C9EEB";
const GRADIENT1_TO = "#15C7CB";

export default function Home() {
  const router = useRouter();
  const [sizeRem, setSizeRem] = useState<number>(20);
  const [counts, setCounts] = useState<Counts>({ tasks: 0, events: 0 });
  const scrollerRef = useRef<HTMLDivElement | null>(null);

  const widgets = useMemo(
    () => [
      {
        key: "task",
        title: "Task",
        href: "/task",
        icon: <ListChecks size={28} color="#ffffff" />,
        count: counts.tasks,
      },
      {
        key: "calendar",
        title: "Calendar",
        href: "/calendar",
        icon: <CalendarBlank size={28} color="#ffffff" />,
        count: counts.events,
      },
      // ⬇️ NEW: myBlog widget with red bubble showing today's article count
      {
        key: "myblog",
        title: "myBlog",
        href: "/myblog",
        icon: <Newspaper size={28} color="#ffffff" />,
        count: counts.myblog ?? 0,
      },
      // placeholders to wire later
      {
        key: "email",
        title: "Email",
        href: "/email",
        icon: <Envelope size={28} color="#ffffff" />,
        count: counts.emails ?? 0,
      },
      {
        key: "notes",
        title: "Notes",
        href: "/notes",
        icon: <NotePencil size={28} color="#ffffff" />,
        count: 0, // you can wire up a count by reading localStorage if you like
      },
    ],
    [counts]
  );

  const handleStartCall = () => router.push("/alfred");

  useEffect(() => {
    const computeSize = () => {
      const vh = window.innerHeight || 800;
      const desiredRem = Math.max(10, Math.min(30, (vh * 0.42) / 16));
      setSizeRem(desiredRem);
    };
    computeSize();
    window.addEventListener("resize", computeSize);
    return () => window.removeEventListener("resize", computeSize);
  }, []);

  // Fetch live counts for notification bubbles
  useEffect(() => {
    let aborted = false;
    (async () => {
      try {
        const [tasksRes, eventsRes, blogRes] = await Promise.all([
          fetch("/api/tasks", { cache: "no-store" }),
          fetch("/api/events", { cache: "no-store" }),
          fetch("/api/myblog?limit=50", { cache: "no-store" }), // ⬅️ get today's articles (capped)
        ]);

        const [tasksJson, eventsJson, blogJson] = await Promise.all([
          tasksRes.json(),
          eventsRes.json(),
          blogRes.json(),
        ]);

        if (!aborted) {
          setCounts({
            tasks: (tasksJson?.tasks || []).length,
            events: (eventsJson?.events || []).length,
            myblog: (blogJson?.articles || []).length, // ⬅️ show the count badge
            emails: 0,
            notes: 0,
          });
        }
      } catch {
        /* ignore for now */
      }
    })();
    return () => {
      aborted = true;
    };
  }, []);

  const scrollByAmount = (delta: number) => {
    const el = scrollerRef.current;
    if (!el) return;
    el.scrollBy({ left: delta, behavior: "smooth" });
  };

  return (
    <main
      aria-label="Home"
      className="avs-home-root w-full min-h-screen flex flex-col items-center relative px-4 pb-20"
      style={{ background: "transparent" }}
    >
      {/* Top large button area (approx 40vh) */}
      <div className="w-full flex flex-col items-center justify-center" style={{ height: "40vh" }}>
        {/* Greeting text placed above button */}
        <div
          className="button-greeting mb-3 text-center"
          style={{
            color: "#eaf4ff",
            fontWeight: 700,
            textShadow: "0 8px 20px rgba(0,0,0,0.45)",
            fontSize: "1.25rem",
            pointerEvents: "none",
          }}
        >
          Hi b,&nbsp;Let’s Work
        </div>

        <div
          className="avs-btn-wrapper relative flex items-center justify-center"
          style={{
            width: `${sizeRem}rem`,
            height: `${sizeRem}rem`,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}
          onClick={handleStartCall}
        >
          <AVS3D102Button sizeRem={sizeRem} href="/alfred" />
        </div>
      </div>

      {/* Horizontal scroll widgets */}
      <section aria-label="Widgets" className="w-full max-w-5xl mt-4 relative" style={{ zIndex: 2, marginTop: "2.5vh" }}>
        {/* Left / Right scroll buttons (Gradient 1) */}

        {/* Scroll container (extra horizontal padding so text doesn’t overlap buttons) */}
        <div
          ref={scrollerRef}
          className="no-scrollbar relative flex gap-4 overflow-x-auto px-14 py-5"
          style={{
            scrollSnapType: "x mandatory",
            WebkitOverflowScrolling: "touch",
          }}
        >
          {/* Edge fade masks */}
          <div
            aria-hidden
            className="pointer-events-none absolute left-0 top-0 h-full w-12 z-20"
            style={{
              background: "linear-gradient(90deg, rgba(0,0,0,0.45), rgba(0,0,0,0))",
            }}
          />
          <div
            aria-hidden
            className="pointer-events-none absolute right-0 top-0 h-full w-12 z-20"
            style={{
              background: "linear-gradient(270deg, rgba(0,0,0,0.45), rgba(0,0,0,0))",
            }}
          />

          {widgets.map((w) => (
            <Link
              key={w.key}
              href={w.href}
              className="relative shrink-0 scroll-snap-align-start"
              style={{ scrollSnapAlign: "start" }}
            >
              <div
                className="widget-card glass hover:scale-105 transition-all"
                style={{
                  width: 140,
                  height: 140,
                  borderRadius: 1000, // circle/oval
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  position: "relative",
                  boxShadow: "0 10px 30px rgba(20, 40, 70, 0.3)",
                  // Outer border = first color in Gradient 1
                  border: `1px solid ${GRADIENT1_FROM}`,
                }}
              >
                {/* Icon bubble – background = Gradient 1 */}
                <div
                  className="flex items-center justify-center rounded-full"
                  style={{
                    width: 64,
                    height: 64,
                    background: `linear-gradient(180deg, ${GRADIENT1_FROM}, ${GRADIENT1_TO})`,
                    border: `1px solid ${GRADIENT1_FROM}`,
                  }}
                >
                  {w.icon}
                </div>

                {/* Title */}
                <div
                  style={{
                    position: "absolute",
                    bottom: 14,
                    left: 0,
                    right: 0,
                    textAlign: "center",
                    color: "#e8eef7",
                    fontWeight: 600,
                    fontSize: 14,
                    textShadow: "0 6px 16px rgba(0,0,0,0.45)",
                    paddingInline: 8,
                  }}
                >
                  {w.title}
                </div>

                {/* Notification bubble (small red) */}
                {typeof w.count === "number" && w.count > 0 && (
                  <div
                    aria-live="polite"
                    className="absolute -top-1 -right-1 flex items-center justify-center"
                    style={{
                      width: 22,
                      height: 22,
                      borderRadius: 999,
                      background: "#e11d48",
                      color: "white",
                      fontSize: 12,
                      fontWeight: 800,
                      border: "2px solid rgba(255,255,255,0.85)",
                      boxShadow: "0 6px 16px rgba(0,0,0,0.4)",
                      lineHeight: "1",
                    }}
                  >
                    {w.count}
                  </div>
                )}
              </div>
            </Link>
          ))}
        </div>
      </section>

      <div style={{ height: 96 }} />

      <style jsx>{`
        .avs-btn-wrapper {
          transition: transform 220ms cubic-bezier(0.2, 0.9, 0.2, 1),
            box-shadow 220ms cubic-bezier(0.2, 0.9, 0.2, 1);
          will-change: transform, box-shadow;
          border-radius: 9999px;
        }
        .avs-btn-wrapper:hover,
        .avs-btn-wrapper:focus-within {
          transform: scale(1.04);
          box-shadow:
            0 10px 30px rgba(20, 40, 70, 0.45),
            0 0 28px 4px rgba(60, 158, 235, 0.1);
        }
        .avs-btn-wrapper::after {
          content: "";
          position: absolute;
          inset: -4px;
          border-radius: 9999px;
          pointer-events: none;
          transition: opacity 250ms ease, transform 250ms ease;
          opacity: 0;
          transform: scale(0.98);
          box-shadow: 0 0 0 3px rgba(60, 158, 235, 0.08);
        }
        .avs-btn-wrapper:hover::after,
        .avs-btn-wrapper:focus-within::after {
          opacity: 1;
          transform: scale(1);
        }
        .button-greeting {
          font-size: 0.95rem;
        }
        @media (min-width: 640px) {
          .button-greeting {
            font-size: 1.05rem;
          }
        }

        /* hide scrollbars visually but keep scrolling */
        .no-scrollbar {
          scrollbar-width: none; /* Firefox */
        }
        .no-scrollbar::-webkit-scrollbar {
          display: none; /* Chrome/Safari */
        }
      `}</style>
    </main>
  );
}
