// components/TopBanner.tsx
"use client";

import React, { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";

const GRADIENT1_FROM = "#3C9EEB";
const GRADIENT1_TO = "#15C7CB";

const NAV_ITEMS = [
  { href: "home", label: "Home" },
  { href: "/task", label: "Task" },
  { href: "/alfred", label: "Alfred" },
  { href: "/calendar", label: "Calendar" },
  { href: "/notes", label: "Notes" }, 
  { href: "/myblog", label: "myBlog" }, 
  { href: "/settings", label: "Settings" },
];


export default function TopBanner() {
  const [open, setOpen] = useState(false);
  const pathname = usePathname();

  return (
    <>
      <div className="fixed top-0 left-0 right-0 h-16 flex items-center justify-center px-4 z-50">
        {/* Left toggle (hamburger) */}
        <button
          onClick={() => setOpen(true)}
          className="absolute left-4 top-1/2 -translate-y-1/2 w-10 h-10 rounded-md border border-white/20 text-white/90 hover:text-white"
          aria-label="Open menu"
        >
          {/* simple hamburger */}
          <span className="block h-0.5 w-6 bg-white rounded mb-1 mx-auto" />
          <span className="block h-0.5 w-6 bg-white rounded mb-1 mx-auto" />
          <span className="block h-0.5 w-6 bg-white rounded mx-auto" />
        </button>

        {/* Centered logo (normal size on app pages) */}
        <img
          src="/alfredlogo2.png"
          alt="Alfred Logo"
          className="w-15 h-15 object-cover border-0 border-white/10 shadow-lg"
          style={{ width: "5rem", height: "6rem", marginTop: "45px" }}
        />
      </div>

      {/* Slide-in panel */}
      {open && (
        <div className="fixed inset-0 z-50" aria-modal="true" role="dialog">
          {/* backdrop */}
          <div
            className="absolute inset-0 bg-black/40"
            onClick={() => setOpen(false)}
            aria-hidden
          />
          {/* panel */}
          <aside className="absolute left-0 top-0 bottom-0 w-72 p-4 bg-black/35 backdrop-blur-md border-r border-white/15">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-white/90 font-semibold">Navigation</h2>
              <button
                onClick={() => setOpen(false)}
                className="text-white/80 hover:text-white"
                aria-label="Close menu"
              >
                ✕
              </button>
            </div>

            <nav className="flex flex-col gap-3">
              {NAV_ITEMS.map((item) => {
                const active = pathname === item.href;
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    onClick={() => setOpen(false)}
                    className="group block"
                  >
                    <div
                      className="rounded-xl px-4 py-3 text-white"
                      style={{
                        // gradient frame container with transparent inner
                        background: `linear-gradient(90deg, ${GRADIENT1_FROM}, ${GRADIENT1_TO})`,
                        padding: 2,
                      }}
                    >
                      <div
                        className="rounded-[10px]"
                        style={{
                          background: "transparent",
                          border: active ? "2px solid white" : "2px solid transparent",
                        }}
                      >
                        <div className="px-4 py-2 text-sm font-semibold">{item.label}</div>
                      </div>
                    </div>
                  </Link>
                );
              })}
            </nav>
          </aside>
        </div>
      )}
    </>
  );
}
