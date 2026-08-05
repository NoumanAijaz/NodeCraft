# NodeCraft 🎨

[![React 19](https://img.shields.io/badge/React-19.0-blue.svg)](https://react.dev/)
[![TypeScript](https://img.shields.io/badge/TypeScript-6.0-blue.svg)](https://www.typescriptlang.org/)
[![Vite](https://img.shields.io/badge/Vite-8.0-646CFF.svg)](https://vitejs.dev/)
[![Tailwind CSS](https://img.shields.io/badge/Tailwind_CSS-3.4-38B2AC.svg)](https://tailwindcss.com/)
[![License: AGPL v3](https://img.shields.io/badge/License-AGPL_v3-blue.svg)](LICENSE)

**NodeCraft** is an interactive, browser-based diagramming and mind-mapping platform. Built with **React 19**, **TypeScript**, and **Express**, it offers user authentication, a project dashboard, auto-saving cloud document storage, freehand drawing, nested canvas portals, slide presentation mode, and rich export options.

---

## ✨ Features

### 🔐 User Accounts & Cloud Storage
- **Authentication**: User registration and login powered by `bcryptjs` password hashing and JWT sessions.
- **Cloud Auto-Save**: Diagrams auto-save to the server after 3 seconds of inactivity, with live status indicators (**Cloud Saved** / **Saving...**).
- **Multi-User Isolation**: User documents are stored securely on disk under isolated per-user directories.

### 📊 Dashboard & Starter Templates
- **Document Hub**: Search, open, inline-rename, or delete your visual workspace files.
- **One-Click Templates**: Built-in starter templates for **Mind Maps**, **Flowcharts**, and **Database Schemas**.

### 🎨 Interactive Editor & Canvas
- **Rich Shape Palette**: Rectangles, Circles, Diamonds, Cylinders, Sticky Notes, Task Cards, Frames, Text Blocks, Images, Stickers, Drawings, and Portals.
- **Canvas Portals**: Sub-canvases that open isolated sub-diagrams inside circular portal nodes.
- **Presentation Mode**: Convert any diagram into an interactive slideshow presentation (press `P`).
- **Timelapse & History Scrubber**: Visual undo/redo timeline powered by `zundo`.
- **Freehand Pen & Laser Pointer**: Sketch freehand drawings or present with a glowing laser pointer.
- **Mind-Map Shortcuts**: Press `Tab` for child nodes, `Enter` for sibling nodes, `N` for sticky notes.

### 📤 Vector & Raster Exports
- Export diagrams instantly to **PNG**, vector **SVG**, print-friendly **PDF**, or portable **`.ncraft` JSON** files.

---

## 🛠️ Tech Stack

| Layer | Technology |
| :--- | :--- |
| **Frontend** | React 19, TypeScript, Vite 8, React Router 7 |
| **Diagram Engine** | `@xyflow/react` (React Flow 12) |
| **State & History** | Zustand 5 + `zundo` (temporal undo/redo middleware) |
| **Styling** | Tailwind CSS 3, Lucide Icons |
| **Backend API** | Node.js, Express.js 5 |
| **Database & Auth** | File-based JSON Database, `bcryptjs`, `jsonwebtoken` |

---

## 🚀 Quick Start

### Prerequisites
- [Node.js](https://nodejs.org/) (v18 or higher)
- [pnpm](https://pnpm.io/) (recommended) or `npm`

### Installation

```bash
# 1. Clone repository
git clone https://github.com/NoumanAijaz/NodeCraft.git
cd NodeCraft

# 2. Install dependencies
pnpm install

# 3. Start local server (runs Express API on :3001 and Vite frontend on :5173 concurrently)
pnpm dev
```

> **Windows users**: You can also double-click `start_server.bat` to launch the server automatically.

Open **`http://localhost:5173/`** in your browser to start crafting.

---

## 📁 Repository Overview

```
NodeCraft/
├── server/               # Express backend API & Database
│   ├── index.js          # Express entry point
│   ├── db.js             # User & project database manager
│   ├── auth.js           # Auth routes (/api/auth/*)
│   └── projects.js       # Project storage routes (/api/projects/*)
├── src/
│   ├── pages/            # Login, Register, and Dashboard pages
│   ├── components/       # Canvas, Shape Node renderers, Toolbars, TopNav
│   ├── store/            # Zustand diagram store & history middleware
│   ├── context/          # Auth & Toast context providers
│   └── utils/            # API client & SVG exporter
├── package.json          # Dependencies & scripts
└── vite.config.ts        # Vite configuration & API proxy
```

---

## 📜 License

This project is licensed under the GNU Affero General Public License v3.0 - see the [LICENSE](LICENSE) file for details.
