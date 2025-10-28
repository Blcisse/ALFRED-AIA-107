# Developed By Balla Cisse.
# Alfred AIA
# Version 1.0.7
# src/agent107.py
# Version 1.0.7






import logging
import os
import asyncio
from pathlib import Path
from typing import Optional
import os, json, requests
from typing import Optional, Dict, Any, List






# ---- env/threading guards ----------------------------------------------------
os.environ.setdefault("TOKENIZERS_PARALLELISM", "false")
os.environ.setdefault("OMP_NUM_THREADS", "1")
os.environ.setdefault("MKL_NUM_THREADS", "1")

from dotenv import load_dotenv
load_dotenv(".env.local")
load_dotenv(os.path.join(os.path.dirname(__file__), "..", ".env.local"))

import traceback

# ---- LiveKit imports (original) ---------------------------------------------
from livekit.agents import (
    Agent,
    AgentSession,
    JobContext,
    JobProcess,
    RoomInputOptions,
    RoomOutputOptions,
    WorkerOptions,
    cli,
    metrics,
)
from livekit.agents.llm import function_tool
from livekit.agents.voice import MetricsCollectedEvent
from livekit.plugins import cartesia, deepgram, openai, silero

# ---- Query engine import (flexible) -----------------------------------------
try:
    from src import query_engine as query_engine  # package mode
except Exception:
    import query_engine  # fallback


MYBLOG_INGEST_URL = os.getenv("MYBLOG_INGEST_URL", "http://localhost:3000/api/myblog/ingest")
MYBLOG_INGEST_TOKEN = os.getenv("MYBLOG_INGEST_TOKEN", "")
# Import managers directly for tool wrappers
try:
    from .query_engine import (  # type: ignore
        add_task,
        list_tasks,
        delete_task,
        mark_task_complete,
        add_event,
        list_events,
        delete_event,
        add_folder,
        list_folders,
        delete_folder,
        rename_folder,
        add_note,
        list_notes,
        delete_note,
        rename_note,
        update_note_content,
        get_note,
        get_note_by_title,
        get_note_by_content,
        get_note_by_folder_id,

    )
   
except Exception:
    try:
        from query_engine import (  # type: ignore
            add_task,
            list_tasks,
            delete_task,
            mark_task_complete,
            add_event,
            list_events,
            delete_event,
            add_folder,
            list_folders,
            delete_folder,
            rename_folder,
            add_note,
            list_notes,
            delete_note,
            rename_note,
            update_note_content,
            get_note,
            get_note_by_title,
            get_note_by_content,
            get_note_by_folder_id,
            get_note_by_title_and_content,
            get_note_by_title_and_folder_id,

        )
    except Exception:
        add_task = list_tasks = delete_task = mark_task_complete = None  # type: ignore
        add_event = list_events = delete_event = None  # type: ignore
        add_folder = list_folders = delete_folder = rename_folder = None  # type: ignore
        add_note = list_notes = delete_note = rename_note = update_note_content = get_note = get_note_by_title = get_note_by_content = get_note_by_folder_id = get_note_by_title_and_content = get_note_by_title_and_folder_id = None  # type: ignore


# async search helper (if present)
search_documents = getattr(query_engine, "search_documents", None)

logger = logging.getLogger("agent")
logging.basicConfig(level=logging.INFO)


# =============================================================================
# Assistant
# =============================================================================
class Assistant(Agent):
    def __init__(self) -> None:
        # Strong, explicit tool-first guidance with examples
        instructions = (
            "Your name is Alfred. Greet with: \"what's up B, it's Alfred.\"\n"
            "\n"
            "You are a hybrid assistant with two responsibilities:\n"
            "1) Knowledge queries via RAG (query_engine)\n"
            "2) App state management via tools (tasks & calendar)\n"
            "\n"
            "CRITICAL ROUTING RULES — ALWAYS FOLLOW IN THIS ORDER:\n"
            "• If the user mentions tasks/todos (e.g., list/add/complete/delete/prioritize), you MUST call one of:\n"
            "  list_tasks, add_task, toggle_task_complete, delete_task. Never claim you lack access; tools are your interface.\n"
            "• If the user mentions calendar/events/reminders/schedule, you MUST call one of:\n"
            "  list_events, add_event, delete_event. Never claim you lack access; tools are your interface.\n"
            "• Only when the user asks about external documents/knowledge (e.g., “search docs”, “what’s in X file”),\n"
            "  call search_documents (RAG) and incorporate results.\n"
            "• If the user mentions folders/notes/notes in folders, you MUST call one of:\n"
            "  list_folders, add_folder, delete_folder, rename_folder, list_notes, add_note, delete_note, rename_note, update_note_content, get_note, get_note_by_title, get_note_by_content, get_note_by_folder_id, get_note_by_title_and_content, get_note_by_title_and_folder_id. Never claim you lack access; tools are your interface.\n"
            "• If the user mentions notes in folders, you MUST call one of:\n"
            "  get_note_by_folder_id, get_note_by_title_and_folder_id. Never claim you lack access; tools are your interface.\n"
            "• If the user asks to refresh or update the news/blog feed, "
            "  call myblog.refresh with the current genres and desired cap.\n"
            "\n"
            "CALLABLE EXAMPLES:\n"
            "• “what are my tasks?” → list_tasks()\n"
            "• “add ‘prepare demo’ high priority” → add_task(text=\"prepare demo\", importance=\"high\")\n"
            "• “mark prepare demo done” → toggle_task_complete(text=\"prepare demo\")\n"
            "• “delete task #3” → delete_task(task_id=3)\n"
            "• “what’s on my calendar tomorrow?” → list_events()\n"
            "• “schedule doctor on 2025-10-01 at 14:00” → add_event(title=\"doctor\", date=\"2025-10-01\", time=\"14:00\")\n"
            "• “search my docs for onboarding details” → search_documents(query=\"onboarding details\", top_k=5)\n"
            "• “what are my folders?” → list_folders()\n"
            "• “add a folder called ‘work’” → add_folder(name=\"work\")\n"
            "• “delete folder #3” → delete_folder(folder_id=3)\n"
            "• “rename folder #3 to ‘personal’” → rename_folder(folder_id=3, name=\"personal\")\n"
            "• “what are my notes?” → list_notes()\n"
            "• “add a note called ‘meeting notes’ in folder #1” → add_note(title=\"meeting notes\", content=\"\", folder_id=1)\n"
            "• “delete note #3” → delete_note(note_id=3)\n"
            "• “rename note #3 to ‘meeting notes 2’” → rename_note(note_id=3, name=\"meeting notes 2\")\n"
            "• “update note #3 content to ‘meeting notes 2’” → update_note_content(note_id=3, content=\"meeting notes 2\")\n"
            "• “get note #3” → get_note(note_id=3)\n"
            "• “get note by title ‘meeting notes’” → get_note_by_title(title=\"meeting notes\")\n"
            "• “get note by content ‘meeting notes 2’” → get_note_by_content(content=\"meeting notes 2\")\n"
            "• “get note by folder id #1” → get_note_by_folder_id(folder_id=1)\n"
            "• “get note by title and content ‘meeting notes’ and ‘meeting notes 2’” → get_note_by_title_and_content(title=\"meeting notes\", content=\"meeting notes 2\")\n"
            "• “get note by title and folder id #1 and ‘meeting notes’” → get_note_by_title_and_folder_id(title=\"meeting notes\", folder_id=1)\n"
            "\n"
            "Tone: witty, concise, tech-savvy; add a light humorous twist. Avoid uncommon/unsafe topics unless the password 'alfred' is provided.\n"
            "When you use a tool, summarize results clearly for the user."
        )
        super().__init__(instructions=instructions)

    # ----------------------------- RAG TOOL -----------------------------------
    @function_tool(
        name="search_documents",
        description="Search documents from the local index. Args: query (str), top_k (int=5). Returns a list of hits or sources."
    )
    async def search_documents_tool(self, query: str, top_k: int = 5):
        logger.info("=== search_documents_tool called === query=%r top_k=%d", query, top_k)
        try:
            if search_documents is None:
                # Fallback: run run_rag_query in a thread and adapt to expected list format
                logger.warning("search_documents helper not available; falling back to run_rag_query")
                run_res = await asyncio.get_event_loop().run_in_executor(None, query_engine.run_rag_query, query)
                sources = run_res.get("sources", []) if isinstance(run_res, dict) else []
                return sources[:top_k]
            results = await search_documents(query=query, top_k=top_k)
            return results or []
        except Exception as e:
            logger.exception("search_documents_tool error: %s", e)
            return []

    # --------------------------- TASKS TOOLS ----------------------------------
    @function_tool(
        name="list_tasks",
        description="List all tasks from persistent storage. No args."
    )
    async def list_tasks_tool(self):
        if list_tasks is None:
            return []
        try:
            return list_tasks()
        except Exception as e:
            logger.exception("list_tasks_tool error: %s", e)
            return []

    @function_tool(
        name="add_task",
        description="Add a new task. Args: text (str), importance ('low'|'medium'|'high' = 'medium'), note (str='')."
    )
    async def add_task_tool(self, text: str, importance: str = "medium", note: str = ""):
        if add_task is None:
            return {"error": "add_task unavailable"}
        try:
            imp = (importance or "medium").lower()
            if imp not in ("low", "medium", "high"):
                imp = "medium"
            return add_task(text=text, importance=imp, note=note)
        except Exception as e:
            logger.exception("add_task_tool error: %s", e)
            return {"error": str(e)}

    @function_tool(
        name="toggle_task_complete",
        description="Toggle completion status of a task by id or exact text. Provide task_id (int) OR text (str)."
    )
    async def toggle_task_complete_tool(self, task_id: Optional[int] = None, text: Optional[str] = None):
        if mark_task_complete is None:
            return {"error": "toggle unavailable"}
        try:
            return mark_task_complete(task_id=task_id, text=text)
        except Exception as e:
            logger.exception("toggle_task_complete_tool error: %s", e)
            return {"error": str(e)}

    @function_tool(
        name="delete_task",
        description="Delete a task by id or exact text. Provide task_id (int) OR text (str)."
    )
    async def delete_task_tool(self, task_id: Optional[int] = None, text: Optional[str] = None):
        if delete_task is None:
            return {"deleted": False, "error": "delete_task unavailable"}
        try:
            ok = delete_task(task_id=task_id, text=text)
            return {"deleted": bool(ok)}
        except Exception as e:
            logger.exception("delete_task_tool error: %s", e)
            return {"deleted": False, "error": str(e)}

    # -------------------------- CALENDAR TOOLS --------------------------------
    @function_tool(
        name="list_events",
        description="List all calendar events from persistent storage. No args."
    )
    async def list_events_tool(self):
        if list_events is None:
            return []
        try:
            return list_events()
        except Exception as e:
            logger.exception("list_events_tool error: %s", e)
            return []

    @function_tool(
        name="add_event",
        description="Add a calendar event. Args: title (str), date (YYYY-MM-DD), time (HH:MM optional), note (str optional)."
    )
    async def add_event_tool(self, title: str, date: str, time: str = "", note: str = ""):
        if add_event is None:
            return {"error": "add_event unavailable"}
        try:
            return add_event(title=title, date=date, time=time, note=note)
        except Exception as e:
            logger.exception("add_event_tool error: %s", e)
            return {"error": str(e)}

    @function_tool(
        name="delete_event",
        description="Delete a calendar event by id (int)."
    )
    async def delete_event_tool(self, event_id: int):
        if delete_event is None:
            return {"deleted": False, "error": "delete_event unavailable"}
        try:
            ok = delete_event(event_id=event_id)
            return {"deleted": bool(ok)}
        except Exception as e:
            logger.exception("delete_event_tool error: %s", e)
            return {"deleted": False, "error": str(e)}


    # -------------------------- FOLDERS TOOLS --------------------------------
    @function_tool(
        name="list_folders",
        description="List all folders from persistent storage. No args."
    )
    async def list_folders_tool(self):
        if list_folders is None:
            return []
        try:
            return list_folders()
        except Exception as e:
            logger.exception("list_folders_tool error: %s", e)
            return []

    @function_tool(
        name="add_folder",
        description="Add a new folder. Args: name (str)."
    )
    async def add_folder_tool(self, name: str):
        if add_folder is None:
            return {"error": "add_folder unavailable"}
        try:
            return add_folder(name=name)
        except Exception as e:
            logger.exception("add_folder_tool error: %s", e)
            return {"error": str(e)}

    @function_tool(
        name="delete_folder",
        description="Delete a folder by id (int)."
    )
    async def delete_folder_tool(self, folder_id: int):
        if delete_folder is None:
            return {"deleted": False, "error": "delete_folder unavailable"}
        try:
            ok = delete_folder(folder_id=folder_id)
            return {"deleted": bool(ok)}
        except Exception as e:
            logger.exception("delete_folder_tool error: %s", e)
            return {"deleted": False, "error": str(e)}


    @function_tool(
        name="rename_folder",
        description="Rename a folder by id (int). Args: name (str)."
    )
    async def rename_folder_tool(self, folder_id: int, name: str):
        if rename_folder is None:
            return {"error": "rename_folder unavailable"}
        try:
            return rename_folder(folder_id=folder_id, name=name)
        except Exception as e:
            logger.exception("rename_folder_tool error: %s", e)
            return {"error": str(e)}


    # -------------------------- NOTES TOOLS --------------------------------
    @function_tool(
        name="list_notes",
        description="List all notes from persistent storage. No args."
    )
    async def list_notes_tool(self):
        if list_notes is None:
            return []
        try:
            return list_notes()
        except Exception as e:
            logger.exception("list_notes_tool error: %s", e)
            return []

    @function_tool(
        name="add_note",
        description="Add a new note. Args: title (str), content (str), folder_id (int)."
    )
    async def add_note_tool(self, title: str, content: str, folder_id: int):
        if add_note is None:
            return {"error": "add_note unavailable"}
        try:
            return add_note(title=title, content=content, folder_id=folder_id)
        except Exception as e:
            logger.exception("add_note_tool error: %s", e)
            return {"error": str(e)}

    @function_tool(
        name="delete_note",
        description="Delete a note by id (int)."
    )
    async def delete_note_tool(self, note_id: int):
        if delete_note is None:
            return {"deleted": False, "error": "delete_note unavailable"}
        try:
            ok = delete_note(note_id=note_id)
            return {"deleted": bool(ok)}
        except Exception as e:
            logger.exception("delete_note_tool error: %s", e)
            return {"deleted": False, "error": str(e)}

    @function_tool(
        name="rename_note",
        description="Rename a note by id (int). Args: name (str)."
    )
    async def rename_note_tool(self, note_id: int, name: str):
        if rename_note is None:
            return {"error": "rename_note unavailable"}
        try:
            return rename_note(note_id=note_id, name=name)
        except Exception as e:
            logger.exception("rename_note_tool error: %s", e)
            return {"error": str(e)}

    @function_tool(
        name="update_note_content",
        description="Update the content of a note by id (int). Args: content (str)."
    )
    async def update_note_content_tool(self, note_id: int, content: str):
        if update_note_content is None:
            return {"error": "update_note_content unavailable"}
        try:
            return update_note_content(note_id=note_id, content=content)
        except Exception as e:
            logger.exception("update_note_content_tool error: %s", e)
            return {"error": str(e)}


    @function_tool(
        name="get_note",
        description="Get a note by id (int)."
    )
    async def get_note_tool(self, note_id: int):
        if get_note is None:
            return {"error": "get_note unavailable"}
        try:
            return get_note(note_id=note_id)
        except Exception as e:
            logger.exception("get_note_tool error: %s", e)
            return {"error": str(e)}  
    
    @function_tool(
        name="get_note_by_title",
        description="Get a note by title (str)."
    )
    async def get_note_by_title_tool(self, title: str):
        if get_note_by_title is None:
            return {"error": "get_note_by_title unavailable"}
        try:
            return get_note_by_title(title=title)
        except Exception as e:
            logger.exception("get_note_by_title_tool error: %s", e)
            return {"error": str(e)}

    @function_tool(
        name="get_note_by_content",
        description="Get a note by content (str)."
    )
    async def get_note_by_content_tool(self, content: str):
        if get_note_by_content is None:
            return {"error": "get_note_by_content unavailable"}
        try:
            return get_note_by_content(content=content)
        except Exception as e:
            logger.exception("get_note_by_content_tool error: %s", e)
            return {"error": str(e)}
    
    @function_tool(
        name="get_note_by_folder_id",
        description="Get a note by folder id (int)."
    )
    async def get_note_by_folder_id_tool(self, folder_id: int):
        if get_note_by_folder_id is None:
            return {"error": "get_note_by_folder_id unavailable"}
        try:
            return get_note_by_folder_id(folder_id=folder_id)
        except Exception as e:
            logger.exception("get_note_by_folder_id_tool error: %s", e)
            return {"error": str(e)}  


    
    @function_tool(
        name="get_note_by_title_and_content",
        description="Get a note by title and content (str)."
    )
    async def get_note_by_title_and_content_tool(self, title: str, content: str):
        if get_note_by_title_and_content is None:
            return {"error": "get_note_by_title_and_content unavailable"}
        try:
            return get_note_by_title_and_content(title=title, content=content)
        except Exception as e:
            logger.exception("get_note_by_title_and_content_tool error: %s", e)
            return {"error": str(e)} 
    
  


    @function_tool(
        name="myblog_refresh",
        description=(
            "Refresh myBlog by fetching articles per genre and ingesting them into the Next.js API. "
            "Args: genres (list[str]), limit (int=25). Returns {ok, count}."
        ),
    )
    async def myblog_refresh_tool(self, genres: list[str], limit: int = 25):
        try:
            # Offload blocking I/O to thread
            loop = asyncio.get_event_loop()
            result = await loop.run_in_executor(
                None,
                query_engine.refresh_myblog,
                genres,
                limit,
                os.getenv("MYBLOG_INGEST_URL", MYBLOG_INGEST_URL),
                os.getenv("MYBLOG_INGEST_TOKEN", MYBLOG_INGEST_TOKEN),
            )
            return result
        except Exception as e:
            return {"ok": False, "error": str(e)}



  

      
def handle_tool_call(name: str, arguments: Dict[str, Any]) -> str:
    logger.info(f"[TOOL CALL] {name} invoked with args: {arguments}")
    # keep your original dispatcher logic here
    return json.dumps({"ok": True})  # replace with your existing return
  

def handle_tool_call(name: str, arguments: Dict[str, Any]) -> str:
    if name == "myblog_refresh":
        # arguments: {"genres": [...], "limit": 25}
        return json.dumps({"called": "myblog.refresh", "args": arguments})
    # keep existing branches...
    return json.dumps({"ok": True})

# =============================================================================
# Worker lifecycle (original)
# =============================================================================
def prewarm(proc: JobProcess):
    try:
        proc.userdata["vad"] = None

        async def _load_vad_bg():
            try:
                loop = asyncio.get_running_loop()
                vad = await loop.run_in_executor(None, silero.VAD.load)
                proc.userdata["vad"] = vad
                logger.info("VAD loaded in background")
            except Exception as e:
                logger.exception("VAD background load failed: %s", e)

        try:
            loop = asyncio.get_event_loop()
            if loop.is_running():
                loop.create_task(_load_vad_bg())
        except RuntimeError:
            pass

        logger.info("VAD background load scheduled")
    except Exception:
        logger.exception("VAD prewarm scheduling failed; will lazy-load at first use")
        proc.userdata["vad"] = None


async def entrypoint(ctx: JobContext):
    logger.info("Starting entrypoint...")
    ctx.log_context_fields = {"room": ctx.room.name}

    vad_instance = ctx.proc.userdata.get("vad")

    session = AgentSession(
        llm=openai.LLM(model="gpt-4o-mini"),
        stt=deepgram.STT(model="nova-3", language="multi"),
        tts=cartesia.TTS(voice=os.environ.get("CARTESIA_TTS_VOICE_ID") or "c99d36f3-5ffd-4253-803a-535c1bc9c306"),
        vad=ctx.proc.userdata.get("vad"),
    )
    logger.info("Session created")

    if vad_instance is None:
        async def lazy_vad_load():
            try:
                loop = asyncio.get_running_loop()
                vad = await loop.run_in_executor(None, silero.VAD.load)
                ctx.proc.userdata["vad"] = vad
                logger.info("Lazy-loaded VAD")
            except Exception as e:
                logger.exception("Lazy VAD load failed: %s", e)
        try:
            asyncio.create_task(lazy_vad_load())
        except RuntimeError:
            logger.warning("No event loop available for VAD loading")

    usage_collector = metrics.UsageCollector()

    @session.on("metrics_collected")
    def _on_metrics_collected(ev: MetricsCollectedEvent):
        metrics.log_metrics(ev.metrics)
        usage_collector.collect(ev.metrics)

    async def log_usage():
        summary = usage_collector.get_summary()
        logger.info(f"Usage: {summary}")

    ctx.add_shutdown_callback(log_usage)

    await session.start(
        agent=Assistant(),
        room=ctx.room,
        room_input_options=RoomInputOptions(),
        room_output_options=RoomOutputOptions(transcription_enabled=True),
    )
    logger.info("Session started")

    await ctx.connect()
    logger.info("Connected to room")


# =============================================================================
# Optional FastAPI surface (AGENT_HTTP=1 to enable)
# =============================================================================
HTTP_ENABLED = os.getenv("AGENT_HTTP", "0") in ("1", "true", "True")

if HTTP_ENABLED:
    from fastapi import FastAPI, Request, UploadFile, File, HTTPException, Body, Path as FastAPIPath
    from fastapi.responses import JSONResponse
    from fastapi.middleware.cors import CORSMiddleware

    try:
        from src import query_engine as http_query_engine  # type: ignore
    except Exception:
        import query_engine as http_query_engine  # type: ignore

    app = FastAPI(title="Agent107 HTTP (query)")

    allow_origins = os.getenv("AGENT_CORS_ORIGINS", "*")
    origins = ["*"] if allow_origins == "*" else [o.strip() for o in allow_origins.split(",") if o.strip()]

    app.add_middleware(
        CORSMiddleware,
        allow_origins=origins,
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )

    @app.get("/health")
    async def _health():
        return {"status": "ok", "mode": "agent107-http"}

    @app.post("/query")
    async def _query(req: Request):
        try:
            payload = await req.json()
        except Exception:
            raise HTTPException(status_code=400, detail="Invalid JSON payload")
        if not isinstance(payload, dict):
            raise HTTPException(status_code=400, detail="Payload must be an object")
        try:
            resp = http_query_engine.handle_query_payload(payload)
            return JSONResponse(content=resp)
        except Exception as e:
            logger.exception("HTTP /query error: %s", e)
            raise HTTPException(status_code=500, detail=str(e))

    @app.post("/search_documents")
    async def _search_documents(req: Request):
        try:
            body = await req.json()
        except Exception:
            raise HTTPException(status_code=400, detail="Invalid JSON body")
        q = body.get("query")
        top_k = int(body.get("top_k", 5))
        if not q:
            raise HTTPException(status_code=400, detail="Missing 'query' field")
        if hasattr(http_query_engine, "search_documents"):
            try:
                results = await http_query_engine.search_documents(q, top_k=top_k)
                return JSONResponse(content={"results": results})
            except Exception as e:
                logger.exception("search_documents helper error: %s", e)
                raise HTTPException(status_code=500, detail=str(e))
        else:
            loop = asyncio.get_event_loop()
            run_res = await loop.run_in_executor(None, http_query_engine.run_rag_query, q)
            sources = run_res.get("sources", []) if isinstance(run_res, dict) else []
            return JSONResponse(content={"results": sources[:top_k]})

    @app.post("/audio")
    async def _audio(file: UploadFile = File(...)):
        content = await file.read()
        proc = getattr(http_query_engine, "process_audio", None) or globals().get("process_audio", None)
        if proc is None:
            raise HTTPException(status_code=501, detail="No server-side audio processing function available.")
        try:
            result = proc(content)
            return JSONResponse(content={"ok": True, "result": result})
        except Exception as e:
            logger.exception("Audio processing error: %s", e)
            raise HTTPException(status_code=500, detail=str(e))

    # ---- Optional convenience REST for tasks/events (dev/debug) --------------
    @app.get("/tasks")
    async def get_tasks():
        try:
            return JSONResponse(content={"tasks": http_query_engine.list_tasks()})
        except Exception as e:
            logger.exception("GET /tasks error: %s", e)
            raise HTTPException(status_code=500, detail=str(e))

    @app.post("/tasks")
    async def create_task(payload: dict = Body(...)):
        text = payload.get("text")
        if not text:
            raise HTTPException(status_code=400, detail="Missing 'text'")
        importance = payload.get("importance", "medium")
        note = payload.get("note", "")
        try:
            task = http_query_engine.add_task(text=text, importance=importance, note=note)
            return JSONResponse(content={"task": task})
        except Exception as e:
            logger.exception("POST /tasks error: %s", e)
            raise HTTPException(status_code=500, detail=str(e))

    @app.put("/tasks/{task_id}")
    async def update_task(task_id: int = FastAPIPath(...), payload: dict = Body(...)):
        try:
            tasks = http_query_engine.list_tasks()
            updated = None
            for t in tasks:
                if t.get("id") == task_id:
                    if "text" in payload: t["text"] = payload["text"]
                    if "importance" in payload: t["importance"] = payload["importance"]
                    if "note" in payload: t["note"] = payload["note"]
                    if "completed" in payload: t["completed"] = bool(payload["completed"])
                    updated = t
                    break
            if not updated:
                raise HTTPException(status_code=404, detail="Task not found")
            http_query_engine._write_json(http_query_engine.TASKS_FILE, tasks)
            return JSONResponse(content={"task": updated})
        except HTTPException:
            raise
        except Exception as e:
            logger.exception("PUT /tasks error: %s", e)
            raise HTTPException(status_code=500, detail=str(e))

    @app.delete("/tasks/{task_id}")
    async def delete_task_endpoint(task_id: int = FastAPIPath(...)):
        try:
            ok = http_query_engine.delete_task(task_id=task_id)
            return JSONResponse(content={"deleted": bool(ok)})
        except Exception as e:
            logger.exception("DELETE /tasks error: %s", e)
            raise HTTPException(status_code=500, detail=str(e))

    @app.get("/events")
    async def get_events():
        try:
            return JSONResponse(content={"events": http_query_engine.list_events()})
        except Exception as e:
            logger.exception("GET /events error: %s", e)
            raise HTTPException(status_code=500, detail=str(e))

    @app.post("/events")
    async def create_event(payload: dict = Body(...)):
        title = payload.get("title")
        date = payload.get("date")
        if not title or not date:
            raise HTTPException(status_code=400, detail="Missing 'title' or 'date'")
        time = payload.get("time", "")
        note = payload.get("note", "")
        try:
            ev = http_query_engine.add_event(title=title, date=date, time=time, note=note)
            return JSONResponse(content={"event": ev})
        except Exception as e:
            logger.exception("POST /events error: %s", e)
            raise HTTPException(status_code=500, detail=str(e))

    @app.delete("/events/{event_id}")
    async def delete_event_endpoint(event_id: int = FastAPIPath(...)):
        try:
            ok = http_query_engine.delete_event(event_id=event_id)
            return JSONResponse(content={"deleted": bool(ok)})
        except Exception as e:
            logger.exception("DELETE /events error: %s", e)
            raise HTTPException(status_code=500, detail=str(e))


    @app.get("/folders")
    async def get_folders():
        try:
            return JSONResponse(content={"folders": http_query_engine.list_folders()})
        except Exception as e:
            logger.exception("GET /folders error: %s", e)
            raise HTTPException(status_code=500, detail=str(e))

    @app.post("/folders")
    async def create_folder(payload: dict = Body(...)):
        name = payload.get("name")
        if not name:
            raise HTTPException(status_code=400, detail="Missing 'name'")
        try:
            folder = http_query_engine.add_folder(name=name)
            return JSONResponse(content={"folder": folder})
        except Exception as e:
            logger.exception("POST /folders error: %s", e)
            raise HTTPException(status_code=500, detail=str(e))

    @app.delete("/folders/{folder_id}")
    async def delete_folder_endpoint(folder_id: int = FastAPIPath(...)):
        try:
            ok = http_query_engine.delete_folder(folder_id=folder_id)
            return JSONResponse(content={"deleted": bool(ok)})
        except Exception as e:
            logger.exception("DELETE /folders error: %s", e)
            raise HTTPException(status_code=500, detail=str(e))

    @app.put("/folders/{folder_id}")
    async def update_folder(folder_id: int = FastAPIPath(...), payload: dict = Body(...)):
        try:
            folders = http_query_engine.list_folders()
            updated = None
            for f in folders:
                if f.get("id") == folder_id:
                    if "name" in payload: f["name"] = payload["name"]
                    updated = f
                    break
            if not updated:
                raise HTTPException(status_code=404, detail="Folder not found")
            http_query_engine._write_json(http_query_engine.FOLDERS_FILE, folders)
            return JSONResponse(content={"folder": updated})
        except HTTPException:
            raise
        except Exception as e:
            logger.exception("PUT /folders error: %s", e)
            raise HTTPException(status_code=500, detail=str(e))

    @app.get("/notes")
    async def get_notes():
        try:
            return JSONResponse(content={"notes": http_query_engine.list_notes()})
        except Exception as e:
            logger.exception("GET /notes error: %s", e)
            raise HTTPException(status_code=500, detail=str(e))
            
    @app.post("/notes")
    async def create_note(payload: dict = Body(...)):
        title = payload.get("title")
        content = payload.get("content")
        folder_id = payload.get("folder_id")
        if not title or not content or not folder_id:
            raise HTTPException(status_code=400, detail="Missing 'title', 'content' or 'folder_id'")
        try:
            note = http_query_engine.add_note(title=title, content=content, folder_id=folder_id)
            return JSONResponse(content={"note": note})
        except Exception as e:
            logger.exception("POST /notes error: %s", e)
            raise HTTPException(status_code=500, detail=str(e))
            
    @app.delete("/notes/{note_id}")
    async def delete_note_endpoint(note_id: int = FastAPIPath(...)):
        try:
            ok = http_query_engine.delete_note(note_id=note_id)
            return JSONResponse(content={"deleted": bool(ok)})
        except Exception as e:
            logger.exception("DELETE /notes error: %s", e)
            raise HTTPException(status_code=500, detail=str(e))
            
    @app.put("/notes/{note_id}")
    async def update_note(note_id: int = FastAPIPath(...), payload: dict = Body(...)):
        try:
            notes = http_query_engine.list_notes()
            updated = None
            for n in notes:
                if n.get("id") == note_id:
                    if "title" in payload: n["title"] = payload["title"]
                    if "content" in payload: n["content"] = payload["content"]
                    if "folder_id" in payload: n["folder_id"] = payload["folder_id"]
                    updated = n
                    break
            if not updated:
                raise HTTPException(status_code=404, detail="Note not found")
            http_query_engine._write_json(http_query_engine.NOTES_FILE, notes)
            return JSONResponse(content={"note": updated})
        except HTTPException:
            raise
        except Exception as e:
            logger.exception("PUT /notes error: %s", e)
            raise HTTPException(status_code=500, detail=str(e))
            
    @app.get("/notes/{note_id}")
    async def get_note_endpoint(note_id: int = FastAPIPath(...)):
        try:
            return JSONResponse(content={"note": http_query_engine.get_note(note_id=note_id)})
        except Exception as e:
            logger.exception("GET /notes error: %s", e)
            raise HTTPException(status_code=500, detail=str(e))
    
    @app.get("/notes/{note_id}")
    async def get_note_endpoint(note_id: int = FastAPIPath(...)):
        try:
            return JSONResponse(content={"note": http_query_engine.get_note(note_id=note_id)})
        except Exception as e:
            logger.exception("GET /notes error: %s", e)
            raise HTTPException(status_code=500, detail=str(e))


    @app.post("/myblog/refresh")
    async def http_myblog_refresh(payload: dict = Body(...)):
        genres = payload.get("genres", [])
        limit = int(payload.get("limit", 25))
        try:
            res = query_engine.refresh_myblog(
               genres=genres,
               limit=limit,
               ingest_url=os.getenv("MYBLOG_INGEST_URL", "http://127.0.0.1:3000/api/myblog/ingest"),
               ingest_token=os.getenv("MYBLOG_INGEST_TOKEN", ""),
        )
            return JSONResponse(content=res)
        except Exception as e:
            logger.exception("HTTP myblog.refresh error: %s", e)
            raise HTTPException(status_code=500, detail=str(e))

    
    

# =============================================================================
# Main
# =============================================================================
if __name__ == "__main__":
    try:
        cli.run_app(WorkerOptions(entrypoint_fnc=entrypoint, prewarm_fnc=prewarm))
    except Exception:
        logger.exception("Fatal error running LiveKit worker:")
        traceback.print_exc()
