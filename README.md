🧠 Alfred AIA – Voice Assistant Platform
A modern AI-powered voice assistant web app built with Next.js (App Router), LiveKit, Three.js, and a Python FastAPI backend.
It integrates real-time audio communication, task + calendar management, and a 3D audio-reactive visualizer, all wrapped in a sleek gradient-themed UI.

🚀 Features
🗣 AI Voice Assistant
Real-time voice sessions via LiveKit (@livekit/components-react, livekit-client)
Automatic microphone enable / disable and reconnection
QueryProvider connects the frontend to your FastAPI agent (/api/assistant)
Handles structured responses like { reply, action } and dispatches agent:action events to the UI
🌐 3D Visualizer
Built with Three.js (AVS3D102.tsx)
Reactive morphing sphere that pulses with bass + frequency data
Custom GLSL shaders and layered neon wireframes for a futuristic look
📅 Productivity Modules
Tasks Page – CRUD interface for to-dos with priority and notes
Calendar Page – Monthly view with event add/edit/delete dialogs
Both interact with /api/tasks and /api/events endpoints
🧩 Unified UI Layout
TopBanner (navigation drawer) and MenuBar (bottom nav)
Gradient brand colors #3C9EEB → #15C7CB
Global ClientProviders wraps every page with:
LiveKit RoomContext
QueryProvider
Toaster notifications
Shared Layout & Audio Renderer
💫 Visual / Theme Layer
Tailwind + tw-animate-css setup
globals.css defines full light/dark CSS variables
Smooth gradients, shimmer text, and float-up animations

🧰 Tech Stack
Category	Stack
Framework	Next.js 14 (App Router)
Styling	Tailwind CSS + tw-animate + custom themes
Voice/RTC	LiveKit Cloud (React Components + SDK)
Backend AI	FastAPI + Python Agent (LLM / RAG via LlamaIndex)
3D Engine	Three.js
Icons	@phosphor-icons/react
Notifications	sonner toast
State Mgmt	React Context (QueryProvider)

🧑‍💻 Developed by Balla Cisse (B)
Modern AI and 3D Web Applications for the 21st Century
© 2025 All Rights Reserved.
