// hooks/useNotes.ts
"use client";

import { useEffect, useMemo, useState } from "react";

export interface NoteFolder {
  id: string;
  name: string;
  createdAt: string;
}
export interface Note {
  id: string;
  folderId: string;
  title: string;
  content: string; // HTML string
  createdAt: string;
  updatedAt: string;
}

const LS_FOLDERS = "notes.folders.v1";
const LS_NOTES = "notes.items.v1";

function uid() {
  return crypto.randomUUID();
}

export function useNotes() {
  const [folders, setFolders] = useState<NoteFolder[]>([]);
  const [notes, setNotes] = useState<Note[]>([]);
  const [selectedFolderId, setSelectedFolderId] = useState<string | null>(null);
  const [selectedNoteId, setSelectedNoteId] = useState<string | null>(null);

  // Load from localStorage
  useEffect(() => {
    try {
      const f = JSON.parse(localStorage.getItem(LS_FOLDERS) || "[]");
      const n = JSON.parse(localStorage.getItem(LS_NOTES) || "[]");
      setFolders(f);
      setNotes(n);
      if (f[0]) setSelectedFolderId(f[0].id);
    } catch {}
  }, []);

  // Persist to localStorage
  useEffect(() => {
    localStorage.setItem(LS_FOLDERS, JSON.stringify(folders));
  }, [folders]);
  useEffect(() => {
    localStorage.setItem(LS_NOTES, JSON.stringify(notes));
  }, [notes]);

  const notesByFolder = useMemo(() => {
    const map: Record<string, Note[]> = {};
    for (const n of notes) {
      if (!map[n.folderId]) map[n.folderId] = [];
      map[n.folderId].push(n);
    }
    // sort notes in each folder by updatedAt desc
    for (const k of Object.keys(map)) {
      map[k].sort((a, b) => (new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()));
    }
    return map;
  }, [notes]);

  // Folder ops
  function createFolder(name: string) {
    const f: NoteFolder = { id: uid(), name: name || "New Folder", createdAt: new Date().toISOString() };
    setFolders((prev) => [f, ...prev]);
    setSelectedFolderId(f.id);
  }
  function renameFolder(id: string, name: string) {
    setFolders((prev) => prev.map((f) => (f.id === id ? { ...f, name } : f)));
  }
  function deleteFolder(id: string) {
    setFolders((prev) => prev.filter((f) => f.id !== id));
    setNotes((prev) => prev.filter((n) => n.folderId !== id));
    if (selectedFolderId === id) setSelectedFolderId(null);
  }

  // Note ops
  function createNote(folderId: string | null, title: string) {
    if (!folderId) return;
    const n: Note = {
      id: uid(),
      folderId,
      title: title || "Untitled",
      content: "",
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    setNotes((prev) => [n, ...prev]);
    setSelectedNoteId(n.id);
  }
  function renameNote(id: string, title: string) {
    setNotes((prev) =>
      prev.map((n) => (n.id === id ? { ...n, title: title || "Untitled", updatedAt: new Date().toISOString() } : n))
    );
  }
  function deleteNote(id: string) {
    setNotes((prev) => prev.filter((n) => n.id !== id));
    if (selectedNoteId === id) setSelectedNoteId(null);
  }
  function updateNoteContent(id: string, content: string) {
    setNotes((prev) =>
      prev.map((n) => (n.id === id ? { ...n, content, updatedAt: new Date().toISOString() } : n))
    );
  }

  // Selectors
  function selectFolder(id: string) { setSelectedFolderId(id); }
  function selectNote(id: string) { setSelectedNoteId(id); }

  return {
    folders,
    notesByFolder,
    selectedFolderId,
    selectedNoteId,
    selectFolder,
    selectNote,
    createFolder,
    renameFolder,
    deleteFolder,
    createNote,
    renameNote,
    deleteNote,
    updateNoteContent,
  };
}
