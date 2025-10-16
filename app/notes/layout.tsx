// app/notes/layout.tsx
import type { Metadata } from "next";
import "../globals.css";

export const metadata: Metadata = {
  title: "Notes",
  description: "Your notes, organized by folders",
};

export default function NotesLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-transparent">{children}</div>
  );
}
