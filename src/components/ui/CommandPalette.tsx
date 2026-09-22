import { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useReactFlow } from '@xyflow/react';
import type { Node } from '@xyflow/react';
import { useDiagramStore } from '../../store/useDiagramStore';
import { useToast } from '../../context/ToastContext';
import { api } from '../../utils/api';
import { exportToSVG, downloadSVG } from '../../utils/svgExport';
import { exportNodesToPng, downloadDataUrl } from '../../utils/pngExport';
import { Search, CornerDownLeft } from 'lucide-react';

interface Command {
  id: string;
  group: 'Actions' | 'Nodes' | 'Templates';
  title: string;
  subtitle?: string;
  icon: string;
  keywords?: string;
  run: () => void;
}

/** Subsequence fuzzy match. Returns score (higher = better) or null. */
function fuzzyScore(query: string, text: string): number | null {
  const q = query.toLowerCase();
  const t = text.toLowerCase();
  if (!q) return 0;
  let qi = 0;
  let score = 0;
  let streak = 0;
  for (let ti = 0; ti < t.length && qi < q.length; ti++) {
    if (t[ti] === q[qi]) {
      streak++;
      score += 2 + streak + (ti === 0 ? 3 : 0);
      qi++;
    } else {
      streak = 0;
    }
  }
  return qi === q.length ? score : null;
}

export function CommandPalette() {
  const navigate = useNavigate();
  const { showToast } = useToast();

  const [isOpen, setIsOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [activeIndex, setActiveIndex] = useState(0);
  const listRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const { screenToFlowPosition, fitView } = useReactFlow();
  // Only track count — avoids re-renders during node drags while keeping the
  // "Nodes" group fresh whenever shapes are added/removed.
  const nodeCount = useDiagramStore((s) => s.nodes.length);

  const open = useCallback(() => {
    if (useDiagramStore.getState().presentationMode) return;
    setQuery('');
    setActiveIndex(0);
    setIsOpen(true);
  }, []);

  // Global Ctrl+K / Cmd+K listener
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        e.stopPropagation();
        if (isOpen) setIsOpen(false);
        else open();
      }
    };
    window.addEventListener('keydown', onKey, true);
    return () => window.removeEventListener('keydown', onKey, true);
  }, [isOpen, open]);

  useEffect(() => {
    if (isOpen) requestAnimationFrame(() => inputRef.current?.focus());
  }, [isOpen]);

  const centerPosition = useCallback(() => {
    try {
      return screenToFlowPosition({ x: window.innerWidth / 2, y: window.innerHeight / 2 });
    } catch {
      return { x: 300, y: 300 };
    }
  }, [screenToFlowPosition]);

  const closePalette = useCallback(() => {
    setIsOpen(false);
    inputRef.current?.blur();
  }, []);

  // ---------- action implementations ----------
  const addShape = useCallback((shapeType: any, dataOverrides?: Record<string, unknown>) => {
    const pos = centerPosition();
    useDiagramStore.getState().addNode(shapeType, { x: pos.x - 80, y: pos.y - 40 }, dataOverrides as never);
    showToast(`${shapeType} added`, 'success');
  }, [centerPosition, showToast]);

  const jumpToNode = useCallback((node: Node) => {
    const rfInst = useDiagramStore.getState().reactFlowInstance;
    if (!rfInst) return;
    const allNodes = useDiagramStore.getState().nodes;
    let absX = node.position.x;
    let absY = node.position.y;
    let cur: any = node;
    const visited = new Set<string>([node.id]);
    while (cur.parentId) {
      if (visited.has(cur.parentId)) break;
      visited.add(cur.parentId);
      const parent = allNodes.find((n: any) => n.id === cur.parentId);
      if (!parent) break;
      absX += parent.position.x;
      absY += parent.position.y;
      cur = parent;
    }
    rfInst.setCenter(
      absX + (node.measured?.width || node.width || 150) / 2,
      absY + (node.measured?.height || node.height || 80) / 2,
      { zoom: 1.4, duration: 600 }
    );
    useDiagramStore.getState().selectNode(node.id);
  }, []);

  const exportSvgAction = useCallback(() => {
    const { nodes, edges, theme, canvasColor } = useDiagramStore.getState();
    if (nodes.length === 0) return showToast('Nothing to export', 'warning');
    const bg = canvasColor || (theme === 'dark' ? '#0f172a' : '#f8fafc');
    downloadSVG(exportToSVG(nodes, edges, { padding: 50, includeBackground: true, backgroundColor: bg }), 'nodecraft-diagram.svg');
    showToast('Exported SVG', 'success');
  }, [showToast]);

  const exportPngAction = useCallback(async () => {
    const { nodes, theme, canvasColor } = useDiagramStore.getState();
    if (nodes.length === 0) return showToast('Nothing to export', 'warning');
    const bg = canvasColor || (theme === 'dark' ? '#0f172a' : '#f8fafc');
    const result = await exportNodesToPng(nodes, { backgroundColor: bg });
    if (result.ok) {
      downloadDataUrl(result.dataUrl, 'nodecraft-diagram.png');
      showToast(result.pixelRatio < 1 ? 'Exported PNG (downscaled)' : 'Exported PNG', 'success');
    } else {
      showToast('PNG export failed', 'error');
    }
  }, [showToast]);

  const exportJsonAction = useCallback(() => {
    const state = useDiagramStore.getState();
    const blob = new Blob([JSON.stringify({
      version: '1.0.0', nodes: state.nodes, edges: state.edges, theme: state.theme,
      snapToGrid: state.snapToGrid, gridSize: state.gridSize, boardNotes: state.boardNotes,
      gridType: state.gridType, canvasColor: state.canvasColor,
    }, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${state.projectName || state.fileName || 'nodecraft-project'}.json`.replace(/[^a-zA-Z0-9._-]/g, '_');
    document.body.appendChild(a); a.click(); document.body.removeChild(a);
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    showToast('Exported JSON backup', 'success');
  }, [showToast]);

  const cloudSaveAction = useCallback(async () => {
    const store = useDiagramStore.getState();
    if (!store.projectId) return showToast('No cloud project open', 'warning');
    try {
      const st = useDiagramStore.getState();
      const snapshot = JSON.stringify({ nodes: st.nodes, edges: st.edges });
      await api.put(`/projects/${store.projectId}`, {
        data: { nodes: st.nodes, edges: st.edges, theme: st.theme, snapToGrid: st.snapToGrid,
          gridSize: st.gridSize, boardNotes: st.boardNotes, gridType: st.gridType, canvasColor: st.canvasColor },
        name: st.projectName || 'Untitled Diagram',
      });
      store.markSaved(snapshot);
      showToast('Saved to cloud', 'success');
    } catch (err: any) {
      showToast(err?.message || 'Save failed', 'error');
    }
  }, [showToast]);

  const loadTemplateAction = useCallback((name: 'mindmap' | 'flowchart' | 'database') => {
    const { nodes } = useDiagramStore.getState();
    if (nodes.length > 0 && !window.confirm(`Replace current canvas with the ${name} template?`)) return;
    useDiagramStore.getState().loadTemplate(name);
    setTimeout(() => fitView({ duration: 400, padding: 0.15 }), 60);
    showToast(`${name} template loaded`, 'success');
  }, [fitView, showToast]);

  // ---------- command registry ----------
  const commands = useMemo<Command[]>(() => {
    const { nodes } = useDiagramStore.getState();

    const actions: Command[] = [
      { id: 'act-rect', group: 'Actions', title: 'Add Rectangle', icon: '▭', run: () => addShape('rectangle') },
      { id: 'act-circle', group: 'Actions', title: 'Add Circle', icon: '◯', run: () => addShape('circle') },
      { id: 'act-diamond', group: 'Actions', title: 'Add Diamond', icon: '◇', run: () => addShape('diamond') },
      { id: 'act-sticky', group: 'Actions', title: 'Add Sticky Note', icon: '🗒', keywords: 'note postit memo', run: () => addShape('sticky', { label: 'Double click to edit', color: '#fef08a', borderColor: '#eab308' }) },
      { id: 'act-text', group: 'Actions', title: 'Add Text Block', icon: 'T', run: () => addShape('text', { label: 'Double click to edit' }) },
      { id: 'act-cylinder', group: 'Actions', title: 'Add Database Cylinder', icon: '🛢', keywords: 'db storage table', run: () => addShape('cylinder') },
      { id: 'act-card', group: 'Actions', title: 'Add Task Card', icon: '📋', keywords: 'jira todo ticket task', run: () => addShape('card') },
      { id: 'act-frame', group: 'Actions', title: 'Add Frame', icon: '🖼', keywords: 'section container area', run: () => addShape('frame') },
      { id: 'act-portal', group: 'Actions', title: 'Add Portal', icon: '🌀', keywords: 'subcanvas link', run: () => addShape('portal') },
      { id: 'act-fit', group: 'Actions', title: 'Fit View', icon: '⤢', keywords: 'zoom all overview', run: () => { fitView({ duration: 400, padding: 0.2 }); } },
      { id: 'act-theme', group: 'Actions', title: 'Toggle Dark/Light Theme', icon: '🌓', keywords: 'dark light mode appearance', run: () => useDiagramStore.getState().toggleTheme() },
      { id: 'act-snap', group: 'Actions', title: 'Toggle Snap to Grid', icon: '#', keywords: 'grid magnetic align', run: () => useDiagramStore.getState().toggleSnapToGrid() },
      { id: 'act-lock', group: 'Actions', title: 'Toggle Canvas Lock', icon: '🔒', keywords: 'readonly freeze protect', run: () => { const s = useDiagramStore.getState(); s.setIsLocked(!s.isLocked); showToast(s.isLocked ? 'Canvas unlocked' : 'Canvas locked'); } },
      { id: 'act-present', group: 'Actions', title: 'Enter Presentation Mode', icon: '🎬', keywords: 'slides present show', run: () => { useDiagramStore.getState().setPresentationMode(true); showToast('Presenting — press P to exit', 'info'); } },
      { id: 'act-help', group: 'Actions', title: 'Keyboard Shortcuts', icon: '?', keywords: 'help keys documentation', run: () => useDiagramStore.getState().setShowHelpModal(true) },
      { id: 'act-undo', group: 'Actions', title: 'Undo', icon: '↩', keywords: 'revert step back', run: () => useDiagramStore.temporal.getState().undo() },
      { id: 'act-redo', group: 'Actions', title: 'Redo', icon: '↪', keywords: 'repeat step forward', run: () => useDiagramStore.temporal.getState().redo() },
      { id: 'act-save', group: 'Actions', title: 'Save to Cloud', icon: '☁', keywords: 'sync persist upload save', run: () => { void cloudSaveAction(); } },
      { id: 'act-mermaid', group: 'Actions', title: 'Import from Mermaid…', icon: '🧩', keywords: 'mermaid flowchart paste convert import diagram', run: () => window.dispatchEvent(new Event('nodecraft-open-mermaid')) },
      { id: 'act-versions', group: 'Actions', title: 'Version History…', icon: '🕓', keywords: 'snapshot restore backup revisions history versions', run: () => window.dispatchEvent(new Event('nodecraft-open-versions')) },
      { id: 'act-exp-png', group: 'Actions', title: 'Export PNG', icon: '🖼', keywords: 'image raster download', run: () => { void exportPngAction(); } },
      { id: 'act-exp-svg', group: 'Actions', title: 'Export SVG', icon: '</>', keywords: 'vector download', run: exportSvgAction },
      { id: 'act-exp-json', group: 'Actions', title: 'Export JSON Backup', icon: '{ }', keywords: 'backup download save', run: exportJsonAction },
      { id: 'act-dashboard', group: 'Actions', title: 'Back to Dashboard', icon: '🏠', keywords: 'home documents exit leave close project', run: () => navigate('/dashboard') },
      { id: 'act-clear', group: 'Actions', title: 'Clear Canvas…', icon: '🗑', keywords: 'delete everything reset empty wipe', run: () => { if (!window.confirm('Clear the entire canvas? This cannot be undone.')) return; useDiagramStore.getState().clearCanvas(); showToast('Canvas cleared', 'success'); } },
    ];

    const nodeCommands: Command[] = nodes
      .filter(n => n.type === 'shape')
      .slice(0, 100)
      .map((n): Command => ({
        id: `node-${n.id}`,
        group: 'Nodes',
        title: `Go to: ${(n.data as any)?.label?.slice(0, 60) || 'Untitled shape'}`,
        subtitle: (n.data as any)?.shapeType,
        icon: '📍',
        keywords: 'jump goto find locate',
        run: () => jumpToNode(n),
      }));

    const templates: Command[] = [
      { id: 'tpl-mindmap', group: 'Templates', title: 'Mind Map Template', icon: '🧠', keywords: 'brainstorm branches', run: () => loadTemplateAction('mindmap') },
      { id: 'tpl-flowchart', group: 'Templates', title: 'Flowchart Template', icon: '⚡', keywords: 'process decision steps', run: () => loadTemplateAction('flowchart') },
      { id: 'tpl-database', group: 'Templates', title: 'Database Schema Template', icon: '🗄', keywords: 'er entities sql tables', run: () => loadTemplateAction('database') },
    ];

    return [...actions, ...templates, ...nodeCommands];
    // nodeCount keeps the Nodes group fresh without re-rendering during drags
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [addShape, jumpToNode, exportSvgAction, exportPngAction, exportJsonAction, cloudSaveAction, loadTemplateAction, fitView, navigate, showToast, nodeCount]);

  const filtered = useMemo(() => {
    if (!query.trim()) return commands.slice(0, 50);
    const scored = commands
      .map(cmd => {
        let s = fuzzyScore(query, cmd.title);
        if (s === null && cmd.keywords) s = fuzzyScore(query, `${cmd.title} ${cmd.keywords}`);
        if (s === null && cmd.subtitle) s = fuzzyScore(query, cmd.subtitle);
        return { cmd, s };
      })
      .filter((x): x is { cmd: Command; s: number } => x.s !== null)
      .sort((a, b) => b.s - a.s);
    return scored.slice(0, 50).map(x => x.cmd);
  }, [query, commands]);

  useEffect(() => {
    setActiveIndex(i => Math.min(i, Math.max(0, filtered.length - 1)));
  }, [filtered.length]);

  useEffect(() => {
    listRef.current?.querySelector('[data-active="true"]')?.scrollIntoView({ block: 'nearest' });
  }, [activeIndex]);

  const execute = useCallback((cmd: Command | undefined) => {
    if (!cmd) return;
    closePalette();
    cmd.run();
  }, [closePalette]);

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setActiveIndex(i => (i + 1) % Math.max(1, filtered.length));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setActiveIndex(i => (i - 1 + filtered.length) % Math.max(1, filtered.length));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      execute(filtered[activeIndex]);
    } else if (e.key === 'Escape') {
      e.preventDefault();
      closePalette();
    }
  };

  if (!isOpen) return null;

  let lastGroup = '';

  return (
    <div
      className="fixed inset-0 z-[10000] flex items-start justify-center pt-[12vh] bg-black/50 backdrop-blur-sm animate-fade-in"
      onMouseDown={closePalette}
    >
      <div
        className="w-full max-w-xl bg-white dark:bg-slate-800 rounded-2xl shadow-2xl border border-gray-200 dark:border-gray-700 overflow-hidden animate-scale-in"
        onMouseDown={(e) => e.stopPropagation()}
      >
        {/* Input */}
        <div className="flex items-center gap-3 px-4 py-3.5 border-b border-gray-200 dark:border-gray-700">
          <Search size={16} className="text-gray-400 shrink-0" />
          <input
            ref={inputRef}
            value={query}
            onChange={(e) => { setQuery(e.target.value); setActiveIndex(0); }}
            onKeyDown={onKeyDown}
            placeholder="Type a command or search nodes…"
            className="flex-1 text-sm bg-transparent outline-none text-gray-900 dark:text-white placeholder-gray-400"
            autoComplete="off"
            spellCheck={false}
          />
          <kbd className="px-1.5 py-0.5 text-[10px] font-mono bg-gray-100 dark:bg-slate-700 border border-gray-200 dark:border-gray-600 rounded text-gray-500">esc</kbd>
        </div>

        {/* Results */}
        <div ref={listRef} className="max-h-[50vh] overflow-y-auto py-2">
          {filtered.length === 0 && (
            <p className="px-4 py-8 text-center text-xs text-gray-400">No matching commands</p>
          )}
          {filtered.map((cmd, i) => {
            const showHeader = cmd.group !== lastGroup;
            lastGroup = cmd.group;
            const active = i === activeIndex;
            return (
              <div key={cmd.id}>
                {showHeader && (
                  <p className="px-4 pt-2 pb-1 text-[10px] font-bold uppercase tracking-wider text-gray-400 dark:text-gray-500">
                    {cmd.group}
                  </p>
                )}
                <button
                  data-active={active}
                  onMouseEnter={() => setActiveIndex(i)}
                  onClick={() => execute(cmd)}
                  className={`w-full flex items-center gap-3 px-4 py-2 text-left transition-colors ${
                    active
                      ? 'bg-blue-50 dark:bg-blue-900/30'
                      : 'hover:bg-gray-50 dark:hover:bg-slate-700/50'
                  }`}
                >
                  <span className="w-6 h-6 flex items-center justify-center text-xs rounded-md bg-gray-100 dark:bg-slate-700 text-gray-500 dark:text-gray-300 shrink-0">
                    {cmd.icon}
                  </span>
                  <span className="flex-1 min-w-0">
                    <span className="block text-xs font-medium text-gray-800 dark:text-gray-100 truncate">{cmd.title}</span>
                    {cmd.subtitle && (
                      <span className="block text-[10px] text-gray-400 capitalize">{cmd.subtitle}</span>
                    )}
                  </span>
                  {active && <CornerDownLeft size={13} className="text-blue-500 shrink-0" />}
                </button>
              </div>
            );
          })}
        </div>

        {/* Footer hints */}
        <div className="flex items-center gap-4 px-4 py-2 border-t border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-slate-900/50 text-[10px] text-gray-400">
          <span><kbd className="font-mono">↑↓</kbd> navigate</span>
          <span><kbd className="font-mono">↵</kbd> run</span>
          <span><kbd className="font-mono">esc</kbd> close</span>
        </div>
      </div>
    </div>
  );
}
