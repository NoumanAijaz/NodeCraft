# Bug-Focused Code Review Report

## 1. Summary
- **Scope Reviewed:** Entire project codebase (NodeCraft frontend and backend), prioritizing entry points, I/O and parsing, external calls, concurrency, auth/security, and coordinate/data-processing math.
- **Files Covered:**
  - Backend: `server/index.js`, `server/auth.js`, `server/db.js`, `server/projects.js`, `server/reset-password.mjs`
  - Frontend Core & State: `src/store/useDiagramStore.ts`, `src/utils/diagram.ts`, `src/utils/api.ts`, `src/utils/mermaid.ts`, `src/utils/svgExport.ts`
  - Canvas & Interaction: `src/components/canvas/Canvas.tsx`, `src/components/canvas/ContextToolbar.tsx`, `src/components/canvas/CanvasContextMenu.tsx`, `src/components/canvas/nodes/ShapeNode.tsx`, `src/components/canvas/edges/SmartEdge.tsx`, `src/components/layout/Sidebar.tsx`, `src/components/layout/TopNav.tsx`
- **Files Skipped:** Pure styling files (`tailwind.config.js`), static assets, and third-party lockfiles.
- **Test Results Before & After:**
  - Baseline linter (`oxlint`): 0 errors, 0 warnings.
  - Baseline build (`tsc -b && vite build`): Succeeded (0 errors).
  - Regression test suite (`node test-regressions.mjs`): 19/19 checks PASSED.
  - Mermaid integration suite (`node --experimental-strip-types repro-mermaid.mjs`): 18/18 checks PASSED.
  - End-to-end backend regression suite (`node repro-bugs.mjs`): 10/10 checks PASSED against ephemeral backend.

---

## 2. Bugs Fixed

### Critical

#### 1. Server Concurrent File Save Race Condition (Data Loss / Process Crash)
- **File & Function:** `server/projects.js` (`atomicWriteFileSync`), `server/db.js` (`saveUsers`, `saveProjects`), `server/reset-password.mjs`
- **What was wrong:** File writes used a hardcoded temporary file path (e.g. `${filePath}.tmp`).
- **Triggering Scenario:** Overlapping requests for autosave or user registration simultaneously wrote to `${filePath}.tmp`. On Windows/Linux, concurrent access resulted in file corruption or unhandled `EBUSY` / `EPERM` exceptions crashing the server process.
- **Fix:**
```javascript
// Before
const tmpPath = `${filePath}.tmp`;

// After
const tmpPath = `${filePath}.${uuidv4()}.tmp`;
```
- **Severity:** Critical | **Confidence:** High

#### 2. Path Traversal & Root Dotfile Access on Non-Alphanumeric Project/User IDs
- **File & Function:** `server/projects.js` (`getProjectPath`, `getVersionsDir`)
- **What was wrong:** When `projectId` or `username` contained only non-alphanumeric characters (such as `$$$`, `???`, `///`), `sanitizePath` stripped all characters to `""`. `path.join(projectsDir, cleanUser, `${cleanId}.ncraft`)` resolved to `server/projects/<user>/.ncraft` or `server/projects/.ncraft`, bypassing path validation and allowing access to unintended hidden dotfiles.
- **Triggering Scenario:** An HTTP request like `GET /api/projects/$$$` or `GET /api/projects/$$$/versions` accessed `.ncraft` or `.versions` dotfiles in the server root.
- **Fix:**
```javascript
// Before
const cleanUser = sanitizePath(username);
const cleanId = sanitizePath(projectId);
const full = path.join(projectsDir, cleanUser, `${cleanId}.ncraft`);

// After
const cleanUser = sanitizePath(username);
const cleanId = sanitizePath(projectId);
if (!cleanUser || !cleanId) throw new Error('Invalid project path');
const full = path.join(projectsDir, cleanUser, `${cleanId}.ncraft`);
```
- **Severity:** Critical | **Confidence:** High

---

### Major

#### 3. Portal Sub-Canvas State Lost on Node Creation & Pasting
- **File & Function:** `src/store/useDiagramStore.ts` (`addNode`, `addChildNode`, `addSiblingNode`, `pasteImage`, `pasteSelection`, `groupNodes`)
- **What was wrong:** Newly created, pasted, or grouped nodes did not inherit or assign `portalId`. Because `Canvas.tsx` filters visible nodes via `n.data.portalId === activeCanvasId`, any shape created while in an active portal immediately vanished from the screen and attached to the root canvas.
- **Triggering Scenario:** Enter a portal canvas. Add any shape via sidebar, press `Tab` (add child) or `Enter` (add sibling), group nodes, or paste an image/selection. All created elements immediately vanished.
- **Fix:** Propagate `portalId: get().activeCanvasId || undefined` in `addNode`, `pasteImage`, and `pasteSelection`; propagate from target node in `addChildNode` and `addSiblingNode`; and set `groupNode.data.portalId` to match grouped children.
- **Severity:** Major | **Confidence:** High

#### 4. Tree Layout Coordinate Space Corruption for Grouped Nodes
- **File & Function:** `src/store/useDiagramStore.ts` (`arrangeSelectedNodesAsTree`)
- **What was wrong:** Used raw relative coordinates for `startX`/`startY` and assigned computed layout positions directly into `n.position` without converting back to parent coordinate space for nodes with `parentId`.
- **Triggering Scenario:** Selecting a tree of connected nodes inside a group/frame and clicking "Arrange as Tree" caused child nodes to fly hundreds of pixels outside their parent frame.
- **Fix:** Computed tree origin using `getAbsolutePosition(roots[0], nodes)` and subtracted `parentAbs` for any node with `parentId` before updating positions.
- **Severity:** Major | **Confidence:** High

#### 5. Presentation Mode & Outline Navigation Coordinate Space Mismatch
- **File & Function:** `src/components/canvas/Canvas.tsx` (`presentationNodes`, slide 0 centering), `src/components/layout/Sidebar.tsx` (`frameNodes`, `handleFrameClick`)
- **What was wrong:** Nodes were sorted comparing raw `a.position.x` vs `b.position.x`. For grouped children, `position` is relative to parent, causing grouped nodes visually on the right to be presented before earlier ungrouped nodes. In outline navigation, `fitBounds` used relative coordinates, centering away from the frame.
- **Triggering Scenario:** Presentation mode with grouped and ungrouped shapes jumped erratically across the canvas in the wrong visual order.
- **Fix:** Sorted `presentationNodes` and `frameNodes` by `getAbsolutePosition`, and used `getAbsolutePosition` for camera centering and bounding boxes.
- **Severity:** Major | **Confidence:** High

#### 6. Broken Node Alignment Across Nested Groups
- **File & Function:** `src/store/useDiagramStore.ts` (`alignSelectedNodes`)
- **What was wrong:** Compared raw relative coordinates across nodes in different grouping hierarchies.
- **Triggering Scenario:** Selecting nodes across different groups and aligning Left/Center/Right caused grouped nodes to jump relative to their parent origin.
- **Fix:** Translated positions to absolute coordinates before alignment and mapped back to parent relative positions.
- **Severity:** Major | **Confidence:** High

#### 7. Broken Node Distribution Across Nested Groups
- **File & Function:** `src/store/useDiagramStore.ts` (`distributeSelectedNodes`)
- **What was wrong:** Gap math compared raw relative coordinates of nodes.
- **Triggering Scenario:** Selecting 3+ nodes spanning groups and distributing horizontally/vertically caused erratic spacing.
- **Fix:** Calculated spacing using absolute coordinates and converted back to parent coordinates.
- **Severity:** Major | **Confidence:** High

#### 8. Node Position Loss on Clipboard Copy/Paste of Grouped Nodes
- **File & Function:** `src/store/useDiagramStore.ts` (`copySelection`)
- **What was wrong:** Copying a child node without its parent preserved relative coordinates but stripped the parent reference on paste.
- **Triggering Scenario:** Copying a grouped child and pasting it spawned it near `(30, 30)` at the canvas origin rather than near the original node.
- **Fix:** Converted isolated child positions to absolute coordinates before placing into clipboard.
- **Severity:** Major | **Confidence:** High

#### 9. Node Position Loss on Duplicate of Grouped Nodes
- **File & Function:** `src/store/useDiagramStore.ts` (`duplicateSelectedNodes`)
- **What was wrong:** Duplicating a grouped child without its parent preserved relative coordinates without a `parentId`.
- **Triggering Scenario:** Pressing `Ctrl+D` on a child node spawned the duplicate at top-left origin.
- **Fix:** Converted isolated child duplicate positions to absolute canvas coordinates.
- **Severity:** Major | **Confidence:** High

#### 10. Lax Version Sequence Parsing Allowing String Injection
- **File & Function:** `server/projects.js` (`parseVersionSeq`, `DELETE /:id/versions/:seq`, `GET /:id/versions/:seq`)
- **What was wrong:** `parseInt(req.params.seq)` converted `'1abc'` to `1`, causing malformed requests to delete or fetch version `1`.
- **Triggering Scenario:** `DELETE /api/projects/:id/versions/1abc` deleted snapshot `v1` rather than returning a 400 validation error.
- **Fix:** Added strict `parseVersionSeq` regex check (`/^\d+$/` and `Number.isSafeInteger`).
- **Severity:** Major | **Confidence:** High

#### 11. Unhandled 500 Crash on Non-String Project Rename
- **File & Function:** `server/projects.js` (`PUT /:id/rename`)
- **What was wrong:** Directly called `name.trim()` without checking `typeof name === 'string'`.
- **Triggering Scenario:** `PUT /api/projects/:id/rename` with `{ "name": 12345 }` threw `name.trim is not a function`, returning a 500 error.
- **Fix:** Added `typeof name !== 'string'` check returning 400 Bad Request JSON.
- **Severity:** Major | **Confidence:** High

#### 12. Server Crash on Empty Body POST `/api/projects`
- **File & Function:** `server/projects.js` (`POST /`)
- **What was wrong:** Destructured `const { name, template } = req.body` when `req.body` was undefined.
- **Triggering Scenario:** `POST /api/projects` with empty body crashed with `Cannot destructure property 'name' of req.body`.
- **Fix:** Added nullish coalescing fallback: `const { name, template } = req.body ?? {}`.
- **Severity:** Major | **Confidence:** High

---

### Minor

#### 13. Mermaid Parser Multi-Node Arrow Chaining Parsing Error
- **File & Function:** `src/utils/mermaid.ts` (`parseMermaid`)
- **What was wrong:** Definitions like `A --> B --> C` only parsed `A --> B`, skipping remaining connections or failing syntax parsing.
- **Triggering Scenario:** Importing standard Mermaid chaining diagrams.
- **Fix:** Supported multi-arrow statement tokenization into pairwise edges `(A, B)` and `(B, C)`.
- **Severity:** Minor | **Confidence:** High

#### 14. SVG Export Font Fallback and Parent Position Truncation
- **File & Function:** `src/utils/svgExport.ts` (`exportToSvg`)
- **What was wrong:** Grouped nodes exported with relative coordinates in raw SVG bounding calculations.
- **Triggering Scenario:** Exporting SVG containing grouped nodes resulted in misplaced shapes.
- **Fix:** Computed absolute element coordinates using `getAbsolutePosition` during SVG node rendering.
- **Severity:** Minor | **Confidence:** High

#### 15. Context Menu Delete Dangling Edges & Active Portal Trap
- **File & Function:** `src/components/canvas/CanvasContextMenu.tsx` (`handleDelete`)
- **What was wrong:** Deleting a node from the canvas context menu did not reset `activeCanvasId` if that node was the active portal, trapping the user inside an orphaned sub-canvas.
- **Triggering Scenario:** Right-clicking and deleting the active portal node.
- **Fix:** Reset `activeCanvasId` to null if `activeCanvasId === targetId`, and pruned connected edges.
- **Severity:** Minor | **Confidence:** High

---

## 3. Flagged but Not Changed
1. **In-Memory Rate Limiting (`server/index.js`):** The Express rate limiters maintain counters in memory maps. Server restarts reset client rate limit quotas. Left unchanged as it matches the lightweight architectural design.
2. **Version Restore Overwrite (`server/projects.js`):** Snapshot restore overwrites the live `.ncraft` file after validating schema. Left unchanged because schema validation (`validateDiagramData`) provides sufficient protection against corruption.
3. **Zundo Undo/Redo Limit (`src/store/useDiagramStore.ts`):** Store temporal history is capped at 100 entries. Left unchanged as 100 provides ample undo history without excessive memory usage.

---

## 4. Not Verified
- Live multi-user WebSocket synchronization in production deployments (tested locally with single-client and automated curl/fetch harnesses).
- Edge routing curved Bezier calculations on touch devices (verified desktop pointer and mouse interactions).

---

## 5. Suggested Follow-Ups
1. **Adopt Vitest / Jest in CI:** Move regression scripts into a standardized test runner configured in `package.json` (`pnpm test`).
2. **Database Engine Migration:** Migrate SQLite / JSON file storage to a WAL-mode SQLite database or PostgreSQL if higher write concurrency is required.
