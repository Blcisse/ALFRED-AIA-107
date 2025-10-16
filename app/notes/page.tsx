// app/notes/page.tsx
"use client";

import React, { useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useNotes, type Note, type NoteFolder } from "@/hooks/useNotes";
import { Plus, Folder, PencilLine, Trash2, Check, X, Type, Bold, Italic, Underline, List, ListChecks, Code } from "lucide-react";

const G1_FROM = "#3C9EEB";
const G1_TO = "#15C7CB";

export default function NotesPage() {
  const {
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
  } = useNotes();

  const [renamingFolder, setRenamingFolder] = useState<string | null>(null);
  const [folderNameDraft, setFolderNameDraft] = useState("");

  const [renamingNote, setRenamingNote] = useState<string | null>(null);
  const [noteNameDraft, setNoteNameDraft] = useState("");

  const editorRef = useRef<HTMLDivElement | null>(null);
  const currentNotes = useMemo(
    () => notesByFolder[selectedFolderId || ""] || [],
    [notesByFolder, selectedFolderId]
  );

  const activeNote = useMemo<Note | undefined>(
    () => currentNotes.find(n => n.id === selectedNoteId),
    [currentNotes, selectedNoteId]
  );

  const applyCmd = (cmd: string) => {
    document.execCommand(cmd, false);
    editorRef.current?.focus();
  };

  const applyBlock = (tag: "h1" | "h2" | "p") => {
    document.execCommand("formatBlock", false, tag);
    editorRef.current?.focus();
  };

  const applyList = (ordered = false) => {
    document.execCommand(ordered ? "insertOrderedList" : "insertUnorderedList", false);
    editorRef.current?.focus();
  };

  const insertCode = () => {
    document.execCommand("formatBlock", false, "pre");
    editorRef.current?.focus();
  };

  return (
    <main className="relative min-h-[calc(100vh-7rem)]">
      {/* Use global background; content is glassed */}
      <div className="max-w-7xl mx-auto px-3 sm:px-6 py-4 sm:py-6 grid grid-cols-12 gap-3 sm:gap-4">
        {/* FOLDERS */}
        <aside className="col-span-12 sm:col-span-3 lg:col-span-3 space-y-3">
          <div className="glass rounded-2xl p-3 sm:p-4">
            <div className="flex items-center justify-between mb-2">
              <h2 className="text-white font-semibold">Folders</h2>
              <button
                onClick={() => createFolder("New Folder")}
                className="rounded-md px-2 py-1 text-sm text-white"
                style={{
                  background: `linear-gradient(90deg, ${G1_FROM}, ${G1_TO})`,
                  border: `1px solid ${G1_FROM}`,
                }}
                title="Create folder"
              >
                <Plus size={16} />
              </button>
            </div>

            <ul className="space-y-1">
              {folders.map((f) => {
                const isActive = f.id === selectedFolderId;
                const isRenaming = renamingFolder === f.id;
                return (
                  <li key={f.id}>
                    <div
                      className="group flex items-center justify-between rounded-xl px-3 py-2 hover:bg-white/5 transition"
                      style={{
                        border: isActive ? "1px solid white" : "1px solid transparent",
                        background: isActive ? "rgba(255,255,255,0.04)" : "transparent",
                      }}
                    >
                      <button
                        onClick={() => selectFolder(f.id)}
                        className="flex items-center gap-2 text-white/90"
                      >
                        <Folder size={16} />
                        {!isRenaming ? (
                          <span className="font-medium">{f.name}</span>
                        ) : (
                          <input
                            value={folderNameDraft}
                            onChange={(e) => setFolderNameDraft(e.target.value)}
                            className="bg-transparent border-b border-white/30 outline-none text-white px-1"
                            autoFocus
                          />
                        )}
                      </button>
                      <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition">
                        {!isRenaming ? (
                          <>
                            <button
                              onClick={() => { setRenamingFolder(f.id); setFolderNameDraft(f.name); }}
                              className="text-white/80 hover:text-white"
                              title="Rename"
                            >
                              <PencilLine size={16} />
                            </button>
                            <button
                              onClick={() => deleteFolder(f.id)}
                              className="text-white/80 hover:text-white"
                              title="Delete"
                            >
                              <Trash2 size={16} />
                            </button>
                          </>
                        ) : (
                          <>
                            <button
                              onClick={() => { renameFolder(f.id, folderNameDraft.trim() || f.name); setRenamingFolder(null); }}
                              className="text-white/80 hover:text-white"
                              title="Save"
                            >
                              <Check size={16} />
                            </button>
                            <button
                              onClick={() => setRenamingFolder(null)}
                              className="text-white/80 hover:text-white"
                              title="Cancel"
                            >
                              <X size={16} />
                            </button>
                          </>
                        )}
                      </div>
                    </div>
                  </li>
                );
              })}
            </ul>
          </div>
        </aside>

        {/* NOTES LIST */}
        <section className="col-span-12 sm:col-span-4 lg:col-span-3 space-y-3">
          <div className="glass rounded-2xl p-3 sm:p-4">
            <div className="flex items-center justify-between mb-2">
              <h2 className="text-white font-semibold">Notes</h2>
              <button
                onClick={() => createNote(selectedFolderId, "Untitled")}
                className="rounded-md px-2 py-1 text-sm text-white"
                style={{
                  background: `linear-gradient(90deg, ${G1_FROM}, ${G1_TO})`,
                  border: `1px solid ${G1_FROM}`,
                }}
                title="Create note"
                disabled={!selectedFolderId}
              >
                <Plus size={16} />
              </button>
            </div>

            {selectedFolderId ? (
              <ul className="space-y-1">
                {currentNotes.map((n) => {
                  const active = n.id === selectedNoteId;
                  const isRenaming = renamingNote === n.id;
                  return (
                    <li key={n.id}>
                      <div
                        className="group rounded-xl px-3 py-2 hover:bg-white/5 transition"
                        style={{
                          border: active ? "1px solid white" : "1px solid transparent",
                          background: active ? "rgba(255,255,255,0.04)" : "transparent",
                        }}
                      >
                        <div className="flex items-center justify-between gap-2">
                          <button
                            onClick={() => selectNote(n.id)}
                            className="truncate text-left flex-1 text-white/90"
                          >
                            {!isRenaming ? (
                              <span className="font-medium">{n.title || "Untitled"}</span>
                            ) : (
                              <input
                                value={noteNameDraft}
                                onChange={(e) => setNoteNameDraft(e.target.value)}
                                className="bg-transparent border-b border-white/30 outline-none text-white px-1 w-full"
                                autoFocus
                              />
                            )}
                          </button>
                          <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition">
                            {!isRenaming ? (
                              <>
                                <button
                                  onClick={() => { setRenamingNote(n.id); setNoteNameDraft(n.title); }}
                                  className="text-white/80 hover:text-white"
                                  title="Rename"
                                >
                                  <PencilLine size={16} />
                                </button>
                                <button
                                  onClick={() => deleteNote(n.id)}
                                  className="text-white/80 hover:text-white"
                                  title="Delete"
                                >
                                  <Trash2 size={16} />
                                </button>
                              </>
                            ) : (
                              <>
                                <button
                                  onClick={() => { renameNote(n.id, noteNameDraft.trim() || n.title); setRenamingNote(null); }}
                                  className="text-white/80 hover:text-white"
                                  title="Save"
                                >
                                  <Check size={16} />
                                </button>
                                <button
                                  onClick={() => setRenamingNote(null)}
                                  className="text-white/80 hover:text-white"
                                  title="Cancel"
                                >
                                  <X size={16} />
                                </button>
                              </>
                            )}
                          </div>
                        </div>
                        <p className="text-xs text-white/60 mt-1 truncate">
                          {new Date(n.updatedAt).toLocaleString()}
                        </p>
                      </div>
                    </li>
                  );
                })}
              </ul>
            ) : (
              <div className="text-white/60 text-sm">Select or create a folder to begin.</div>
            )}
          </div>
        </section>

        {/* EDITOR */}
        <section className="col-span-12 sm:col-span-5 lg:col-span-6 space-y-3">
          <div className="glass rounded-2xl p-3 sm:p-4">
            <div className="flex items-center justify-between mb-2">
              <h2 className="text-white font-semibold">Editor</h2>
              {activeNote && (
                <p className="text-xs text-white/60">
                  Last edited {new Date(activeNote.updatedAt).toLocaleString()}
                </p>
              )}
            </div>

            {/* Toolbar */}
            <div className="flex flex-wrap gap-2 mb-3">
              <button className="toolbar-btn" onClick={() => applyBlock("h1")} title="Heading 1"><Type size={16} /></button>
              <button className="toolbar-btn" onClick={() => applyBlock("h2")} title="Heading 2"><Type size={16} /></button>
              <button className="toolbar-btn" onClick={() => applyCmd("bold")} title="Bold"><Bold size={16} /></button>
              <button className="toolbar-btn" onClick={() => applyCmd("italic")} title="Italic"><Italic size={16} /></button>
              <button className="toolbar-btn" onClick={() => applyCmd("underline")} title="Underline"><Underline size={16} /></button>
              <button className="toolbar-btn" onClick={() => applyList(false)} title="Bulleted list"><List size={16} /></button>
              <button className="toolbar-btn" onClick={() => applyList(true)} title="Numbered list"><ListChecks size={16} /></button>
              <button className="toolbar-btn" onClick={insertCode} title="Code block"><Code size={16} /></button>
              <style jsx>{`
                .toolbar-btn {
                  padding: 6px 10px;
                  border-radius: 8px;
                  color: white;
                  background: linear-gradient(90deg, ${G1_FROM}11, ${G1_TO}11);
                  border: 1px solid ${G1_FROM}44;
                }
                .toolbar-btn:hover {
                  background: linear-gradient(90deg, ${G1_FROM}22, ${G1_TO}22);
                }
              `}</style>
            </div>

            {/* Editor area */}
            <div
              ref={editorRef}
              contentEditable
              suppressContentEditableWarning
              className="min-h-[40vh] max-h-[60vh] overflow-auto rounded-xl p-3 bg-white/5 text-white outline-none border border-white/10"
              onInput={(e) => {
                if (activeNote) {
                  updateNoteContent(activeNote.id, (e.target as HTMLDivElement).innerHTML);
                }
              }}
              dangerouslySetInnerHTML={{ __html: activeNote?.content || "<p class='text-white/60'>Start typing...</p>" }}
            />
          </div>
        </section>
      </div>
    </main>
  );
}
