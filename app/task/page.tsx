// app/tasks/page.tsx
"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { TrashIcon } from "@phosphor-icons/react";

type Importance = "low" | "medium" | "high";

interface Task {
  id: number;
  text: string;
  completed: boolean;
  note: string;
  importance: Importance;
}

export default function TasksPage() {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [newTask, setNewTask] = useState("");
  const [newNote, setNewNote] = useState("");
  const [newImportance, setNewImportance] = useState<Importance>("medium");
  const [busy, setBusy] = useState(false);

  async function refresh() {
    const res = await fetch("/api/tasks", { cache: "no-store" });
    const data = await res.json();
    setTasks(data.tasks || []);
  }

  useEffect(() => {
    refresh();
  }, []);

  async function addTask() {
    if (!newTask.trim()) return;
    setBusy(true);
    try {
      const res = await fetch("/api/tasks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: newTask.trim(), importance: newImportance, note: newNote }),
      });
      if (res.ok) {
        setNewTask("");
        setNewNote("");
        setNewImportance("medium");
        await refresh();
      }
    } finally {
      setBusy(false);
    }
  }

  async function toggleComplete(task: Task) {
    setBusy(true);
    try {
      await fetch(`/api/tasks/${task.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ completed: !task.completed }),
      });
      await refresh();
    } finally {
      setBusy(false);
    }
  }

  async function updateNote(task: Task, note: string) {
    await fetch(`/api/tasks/${task.id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ note }),
    });
  }

  async function deleteTask(task: Task) {
    setBusy(true);
    try {
      await fetch(`/api/tasks/${task.id}`, { method: "DELETE" });
      await refresh();
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="flex flex-col items-center justify-start min-h-screen pt-16 bg-transparent">
      <h1 className="text-2xl font-bold mb-4 text-white">Tasks</h1>
      <div className="w-full max-w-2xl p-4 bg-transparent rounded-lg shadow-md">
        <div className="flex flex-col gap-2 mb-4">
          <Input
            value={newTask}
            onChange={(e) => setNewTask(e.target.value)}
            className="flex-1 p-2 border rounded bg-transparent text-white placeholder-white"
            placeholder="Add a new task..."
          />
          <Textarea
            value={newNote}
            onChange={(e) => setNewNote(e.target.value)}
            className="flex-1 p-2 border rounded bg-transparent text-white placeholder-white"
            placeholder="Add a note..."
          />
          <Select
            value={newImportance}
            onValueChange={(value) => setNewImportance(value as Importance)}
            className="p-2 border rounded bg-transparent text-white"
          >
            <option value="low">Low</option>
            <option value="medium">Medium</option>
            <option value="high">High</option>
          </Select>
          <Button onClick={addTask} disabled={busy} className="bg-gradient-to-r from-[#3C9EEB] to-[#15C7CB] text-white">
            {busy ? "Saving..." : "Add Task"}
          </Button>
        </div>

        <ul className="space-y-2">
          {tasks.map((task) => (
            <li key={task.id} className="flex gap-2 items-start p-2 bg-transparent rounded border border-white text-white">
              <Checkbox checked={task.completed} onCheckedChange={() => toggleComplete(task)} />
              <div className="flex-1">
                <div className="flex items-center justify-between">
                  <span>{task.text} ({task.importance})</span>
                  <Button variant="destructive" onClick={() => deleteTask(task)} className="bg-gradient-to-r from-[#3C9EEB] to-[#15C7CB] text-white">
                    <TrashIcon size={16} />
                  </Button>
                </div>
                <Textarea
                  value={task.note || ""}
                  onChange={(e) => updateNote(task, e.target.value)}
                  className="mt-2 p-1 bg-transparent text-white placeholder-white"
                  placeholder="Add note"
                />
              </div>
            </li>
          ))}
        </ul>
      </div>
    </main>
  );
}
