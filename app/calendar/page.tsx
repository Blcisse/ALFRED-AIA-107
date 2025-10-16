// app/calendar/page.tsx
"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { CaretLeft, CaretRight } from "@phosphor-icons/react";

interface Event {
  id: number;
  title: string;
  date: string;
  time: string;
  note: string;
}

export default function CalendarPage() {
  const [events, setEvents] = useState<Event[]>([]);
  const [selectedDate, setSelectedDate] = useState("");
  const [newTitle, setNewTitle] = useState("");
  const [newTime, setNewTime] = useState("");
  const [newNote, setNewNote] = useState("");
  const [currentMonth, setCurrentMonth] = useState(new Date().getMonth());
  const [currentYear, setCurrentYear] = useState(new Date().getFullYear());
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [busy, setBusy] = useState(false);

  async function refresh() {
    const res = await fetch("/api/events", { cache: "no-store" });
    const data = await res.json();
    setEvents(data.events || []);
  }

  useEffect(() => {
    refresh();
  }, []);

  async function addEvent() {
    if (!newTitle.trim() || !selectedDate) return;
    setBusy(true);
    try {
      await fetch("/api/events", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: newTitle.trim(),
          date: selectedDate,
          time: newTime,
          note: newNote,
        }),
      });
      setNewTitle("");
      setNewTime("");
      setNewNote("");
      setIsDialogOpen(false);
      await refresh();
    } finally {
      setBusy(false);
    }
  }

  async function deleteEvent(id: number) {
    setBusy(true);
    try {
      await fetch(`/api/events/${id}`, { method: "DELETE" });
      await refresh();
    } finally {
      setBusy(false);
    }
  }

  const months = [
    "January","February","March","April","May","June",
    "July","August","September","October","November","December"
  ];
  const daysInMonth = (m: number, y: number) => new Date(y, m + 1, 0).getDate();
  const firstDayOfMonth = (m: number, y: number) => new Date(y, m, 1).getDay();

  const renderCalendar = () => {
    const days = [];
    const totalDays = daysInMonth(currentMonth, currentYear);
    const firstDay = firstDayOfMonth(currentMonth, currentYear);
    for (let i = 0; i < firstDay; i++) days.push(<div key={`e-${i}`} />);
    for (let day = 1; day <= totalDays; day++) {
      const dateStr = `${currentYear}-${String(currentMonth + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
      days.push(
        <div
          key={day}
          role="button"
          tabIndex={0}
          onClick={() => { setSelectedDate(dateStr); setIsDialogOpen(true); }}
          onKeyDown={(e) => {
            if (e.key === "Enter" || e.key === " ") { setSelectedDate(dateStr); setIsDialogOpen(true); }
          }}
          className="day p-2 border cursor-pointer text-center bg-transparent text-white hover:bg-gradient-to-r from-[#3C9EEB] to-[#15C7CB]"
        >
          {day}
        </div>
      );
    }
    return days;
  };

  return (
    <main className="flex flex-col items-center justify-start min-h-screen pt-16 bg-transparent">
      <h1 className="text-2xl font-bold mb-4 text-white">Calendar</h1>
      <div className="w-full max-w-4xl bg-transparent rounded-lg shadow-md p-4">
        <div className="flex justify-between mb-4">
          <Button onClick={() => setCurrentMonth((m) => (m + 11) % 12)} className="bg-gradient-to-r from-[#3C9EEB] to-[#15C7CB] text-white">
            <CaretLeft />
          </Button>
          <h2 className="text-white">{months[currentMonth]} {currentYear}</h2>
          <Button onClick={() => setCurrentMonth((m) => (m + 1) % 12)} className="bg-gradient-to-r from-[#3C9EEB] to-[#15C7CB] text-white">
            <CaretRight />
          </Button>
        </div>

        <div className="grid grid-cols-7 gap-1 text-white">
          {["Sun","Mon","Tue","Wed","Thu","Fri","Sat"].map((d) => (
            <div key={d} className="text-center font-bold">{d}</div>
          ))}
          {renderCalendar()}
        </div>

        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogContent className="bg-transparent text-white border-white">
            <DialogHeader>
              <DialogTitle>Add Event for {selectedDate || "(pick a date)"}</DialogTitle>
            </DialogHeader>
            <Input
              value={newTitle}
              onChange={(e) => setNewTitle(e.target.value)}
              className="p-2 border rounded bg-transparent text-white placeholder-white"
              placeholder="Event Title"
            />
            <Input
              type="time"
              value={newTime}
              onChange={(e) => setNewTime(e.target.value)}
              className="p-2 border rounded bg-transparent text-white placeholder-white"
              placeholder="Time"
            />
            <Textarea
              value={newNote}
              onChange={(e) => setNewNote(e.target.value)}
              className="p-2 border rounded bg-transparent text-white placeholder-white"
              placeholder="Note"
            />
            <Button onClick={addEvent} disabled={busy} className="bg-gradient-to-r from-[#3C9EEB] to-[#15C7CB] text-white">
              {busy ? "Saving..." : "Add Event"}
            </Button>
          </DialogContent>
        </Dialog>

        <ul className="mt-4 space-y-2">
          {events.map((event) => (
            <li key={event.id} className="p-2 bg-transparent rounded border border-white text-white">
              {event.title} on {event.date} {event.time ? `at ${event.time}` : ""}
              <p>{event.note}</p>
              <Button
                variant="destructive"
                onClick={() => deleteEvent(event.id)}
                className="mt-2 bg-gradient-to-r from-[#3C9EEB] to-[#15C7CB] text-white"
              >
                Delete
              </Button>
            </li>
          ))}
        </ul>
      </div>
    </main>
  );
}
