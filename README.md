# NodeCraft 🚀

**NodeCraft** is an interactive, browser-based diagramming and mind-mapping platform inspired by **Lucid.app**. It features user authentication, a project dashboard, server-side document persistence with automatic debounced cloud-saving, free-form sketching, structured flowcharts, presentation mode, timelapse/undo history, and rich vector/image export capabilities.

---

## ✨ Features

### 🔐 User Authentication & Multi-User Support
- **Sign In & Register**: Secure account registration and login using `bcryptjs` password hashing and JWT sessions (7-day tokens).
- **Multi-User Isolation**: User documents are stored securely on disk under per-user directories (`server/projects/<username>/`).

### 📊 Lucid.app-Style Project Dashboard
- **Document Hub**: View, search, rename, and manage all your visual workspace documents.
- **One-Click Templates**: Instant starter setups for **Mind Maps**, **Flowcharts**, and **Database Schemas**.
- **Real-Time Auto-Save**: Changes automatically save to the cloud after 3 seconds of inactivity while editing, indicated by a live status badge (**Cloud Saved** / **Saving...**).

### 🎨 Visual Canvas & Editing Tools
- **Rich Shape Library**: Rectangles, Circles, Diamonds, Cylinders, Sticky Notes, Task Cards, Frames, Text Blocks, Images, Stickers, Drawings, and Portals.
- **Interactions**: Drag-and-drop from sidebar, handle resize, lasso selection (Shift+Drag), pan mode (hold Space), right-click context menu.
- **Freehand Pen & Laser Pointer**: Sketch freehand drawings or use the glowing laser pointer during walkthrough presentations.
- **Portals**: Nested circular sub-canvases to break complex diagrams into manageable sub-diagrams.
- **Presentation Mode**: Turn any diagram into a slide deck (Press `P`).
- **Timelapse & History Scrubber**: Visual undo/redo history timeline powered by `zundo`.
- **Export Options**: Export diagrams to high-res PNG, vector SVG, print PDF, or portable `.ncraft` JSON files.

---

## 🛠️ Tech Stack

| Component | Technology |
| :--- | :--- |
| **Frontend** | React 19, TypeScript, Vite 8, React Router 7 |
| **Diagram Engine** | `@xyflow/react` (React Flow 12) |
| **State Management** | Zustand 5 + `zundo` (temporal undo/redo middleware) |
| **Styling** | Tailwind CSS 3, Lucide Icons, Custom CSS Glassmorphism |
| **Backend API** | Node.js, Express.js 5 |
| **Data Persistence** | Pure JS File-based Database & per-user `.ncraft` JSON storage |
| **Authentication** | `bcryptjs`, `jsonwebtoken` (JWT) |

---

## 🚀 Quick Start

### Prerequisites
- [Node.js](https://nodejs.org/) (v18 or higher)
- [pnpm](https://pnpm.io/) (preferred) or `npm`

### 1. Install Dependencies
```bash
pnpm install
```

### 2. Start Development Server
Starts both the **Express API server** (port 3001) and **Vite frontend** (port 5173) concurrently:

```bash
pnpm dev
```

> **Windows users**: You can also double-click `start_server.bat` to launch the server automatically.

Open your browser at **`http://localhost:5173/`**.

---

## 📁 Project Structure

```
NodeCraft/
├── server/                       # Backend API & Database
│   ├── index.js                  # Express server entry point (Port 3001)
│   ├── db.js                     # File-based database manager (Users & Projects)
│   ├── auth.js                   # Authentication routes (/api/auth/*)
│   ├── projects.js               # Project CRUD routes (/api/projects/*)
│   ├── data/                     # Database files (users.json, projects.json)
│   └── projects/                 # Per-user diagram files (<username>/<id>.ncraft)
├── src/
│   ├── main.tsx                  # React entry point with BrowserRouter & ErrorBoundary
│   ├── App.tsx                   # Main routes (/login, /register, /dashboard, /project/:id)
│   ├── context/
│   │   ├── AuthContext.tsx       # Auth session provider
│   │   └── ToastContext.tsx      # Toast notification system
│   ├── pages/
│   │   ├── LoginPage.tsx         # Sign In page
│   │   ├── RegisterPage.tsx      # Create Account page
│   │   └── DashboardPage.tsx     # Lucid.app-style Project Dashboard
│   ├── components/
│   │   ├── ProjectEditor.tsx     # Cloud project loader wrapper
│   │   ├── canvas/               # React Flow canvas, shape renderers, toolbars
│   │   └── layout/               # TopNav (with Cloud save & Dashboard button), Sidebar
│   ├── store/
│   │   └── useDiagramStore.ts    # Zustand store with persistence & zundo history
│   └── utils/
│       ├── api.ts                # API client with automatic JWT header injection
│       └── svgExport.ts          # Pure vector SVG export generator
├── public/                       # Static public assets
├── package.json                  # Dependencies & scripts
└── vite.config.ts                # Vite config with API proxy to port 3001
```

---

## 🛰️ API Endpoints

### Auth Routes (`/api/auth`)
- `POST /api/auth/register` — Register a new account (`username`, `password`)
- `POST /api/auth/login` — Sign in (`username`, `password`)
- `GET /api/auth/me` — Fetch current user info (requires JWT header)

### Project Routes (`/api/projects`)
- `GET /api/projects` — List user's documents
- `POST /api/projects` — Create a new document (`name`, `template`)
- `GET /api/projects/:id` — Retrieve diagram JSON for a project
- `PUT /api/projects/:id` — Save/auto-save diagram JSON
- `PUT /api/projects/:id/rename` — Rename document
- `DELETE /api/projects/:id` — Delete document

---

## 📤 Uploading to GitHub

Follow these steps to publish your NodeCraft repository to GitHub:

```bash
# 1. Initialize git repository (if not already done)
git init

# 2. Add files
git add .

# 3. Commit changes
git commit -m "Initial commit: NodeCraft with Auth, Dashboard & Server Storage"

# 4. Set default branch to main
git branch -M main

# 5. Link your GitHub repository (replace with your repo URL)
git remote add origin https://github.com/YOUR_USERNAME/NodeCraft.git

# 6. Push to GitHub
git push -u origin main
```

---

## 📄 License

Provided under the MIT License. Feel free to modify and adapt for your own productivity projects.
