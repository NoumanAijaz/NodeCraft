import { useEffect, useRef } from 'react';
import {
  Copy,
  CopyPlus,
  Lock,
  Unlock,
  BringToFront,
  SendToBack,
  Trash2,
  Clipboard,
  CheckSquare,
  Maximize,
  RotateCcw,
} from 'lucide-react';
import { useDiagramStore } from '../../store/useDiagramStore';
import { useReactFlow } from '@xyflow/react';

interface CanvasContextMenuProps {
  x: number;
  y: number;
  type: 'node' | 'edge' | 'pane';
  targetId?: string;
  isLocked?: boolean;
  onClose: () => void;
}

export function CanvasContextMenu({
  x,
  y,
  type,
  targetId,
  isLocked,
  onClose,
}: CanvasContextMenuProps) {
  const menuRef = useRef<HTMLDivElement>(null);
  const reactFlow = useReactFlow();

  const copySelection = useDiagramStore((s) => s.copySelection);
  const pasteSelection = useDiagramStore((s) => s.pasteSelection);
  const duplicateSelectedNodes = useDiagramStore((s) => s.duplicateSelectedNodes);
  const bringToFront = useDiagramStore((s) => s.bringToFront);
  const sendToBack = useDiagramStore((s) => s.sendToBack);
  const updateNodeData = useDiagramStore((s) => s.updateNodeData);
  const onNodesChange = useDiagramStore((s) => s.onNodesChange);
  const onEdgesChange = useDiagramStore((s) => s.onEdgesChange);
  const clearCanvas = useDiagramStore((s) => s.clearCanvas);
  const clipboard = useDiagramStore((s) => s.clipboard);
  const nodes = useDiagramStore((s) => s.nodes);

  const hasClipboard = Boolean(clipboard?.nodes && clipboard.nodes.length > 0);

  // Close on outside click or Escape
  useEffect(() => {
    const handlePointerDown = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        onClose();
      }
    };

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };

    document.addEventListener('pointerdown', handlePointerDown);
    document.addEventListener('keydown', handleKeyDown);

    return () => {
      document.removeEventListener('pointerdown', handlePointerDown);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [onClose]);

  // Clamp position within viewport
  const menuWidth = 190;
  const menuHeight = type === 'node' ? 240 : type === 'pane' ? 180 : 80;
  const clampedX = Math.max(10, Math.min(x, window.innerWidth - menuWidth - 10));
  const clampedY = Math.max(10, Math.min(y, window.innerHeight - menuHeight - 10));

  return (
    <div
      ref={menuRef}
      role="menu"
      aria-label="Canvas context menu"
      className="fixed z-[9999] bg-white/95 dark:bg-slate-800/95 backdrop-blur-md border border-gray-200 dark:border-gray-700/80 rounded-xl shadow-2xl py-1.5 w-[190px] text-xs text-gray-700 dark:text-gray-200 select-none animate-in fade-in zoom-in-95 duration-100"
      style={{ left: `${clampedX}px`, top: `${clampedY}px` }}
      onClick={(e) => e.stopPropagation()}
      onContextMenu={(e) => e.preventDefault()}
    >
      {type === 'node' && targetId && (
        <>
          <button
            onClick={() => {
              copySelection();
              onClose();
            }}
            className="w-full text-left px-3 py-1.5 hover:bg-blue-50 dark:hover:bg-slate-700/70 hover:text-blue-600 dark:hover:text-blue-400 flex items-center justify-between transition-colors"
          >
            <span className="flex items-center gap-2">
              <Copy size={13} className="text-gray-400 dark:text-gray-500" />
              Copy
            </span>
            <kbd className="text-[10px] text-gray-400 font-mono">Ctrl+C</kbd>
          </button>

          <button
            onClick={() => {
              duplicateSelectedNodes();
              onClose();
            }}
            className="w-full text-left px-3 py-1.5 hover:bg-blue-50 dark:hover:bg-slate-700/70 hover:text-blue-600 dark:hover:text-blue-400 flex items-center justify-between transition-colors"
          >
            <span className="flex items-center gap-2">
              <CopyPlus size={13} className="text-gray-400 dark:text-gray-500" />
              Duplicate
            </span>
            <kbd className="text-[10px] text-gray-400 font-mono">Ctrl+D</kbd>
          </button>

          <div className="h-px bg-gray-150 dark:bg-gray-700/60 my-1" />

          <button
            onClick={() => {
              bringToFront(targetId);
              onClose();
            }}
            className="w-full text-left px-3 py-1.5 hover:bg-blue-50 dark:hover:bg-slate-700/70 hover:text-blue-600 dark:hover:text-blue-400 flex items-center justify-between transition-colors"
          >
            <span className="flex items-center gap-2">
              <BringToFront size={13} className="text-gray-400 dark:text-gray-500" />
              Bring to Front
            </span>
            <kbd className="text-[10px] text-gray-400 font-mono">Ctrl+]</kbd>
          </button>

          <button
            onClick={() => {
              sendToBack(targetId);
              onClose();
            }}
            className="w-full text-left px-3 py-1.5 hover:bg-blue-50 dark:hover:bg-slate-700/70 hover:text-blue-600 dark:hover:text-blue-400 flex items-center justify-between transition-colors"
          >
            <span className="flex items-center gap-2">
              <SendToBack size={13} className="text-gray-400 dark:text-gray-500" />
              Send to Back
            </span>
            <kbd className="text-[10px] text-gray-400 font-mono">Ctrl+[</kbd>
          </button>

          <button
            onClick={() => {
              const store = useDiagramStore.getState();
              const selected = store.nodes.filter((n) => n.selected).map((n) => n.id);
              if (targetId && selected.includes(targetId) && selected.length > 1) {
                store.updateNodesData(selected, { locked: !isLocked });
              } else {
                updateNodeData(targetId, { locked: !isLocked });
              }
              onClose();
            }}
            className="w-full text-left px-3 py-1.5 hover:bg-blue-50 dark:hover:bg-slate-700/70 hover:text-blue-600 dark:hover:text-blue-400 flex items-center justify-between transition-colors"
          >
            <span className="flex items-center gap-2">
              {isLocked ? (
                <Unlock size={13} className="text-amber-500" />
              ) : (
                <Lock size={13} className="text-gray-400 dark:text-gray-500" />
              )}
              {isLocked ? 'Unlock' : 'Lock'}
            </span>
          </button>

          <div className="h-px bg-gray-150 dark:bg-gray-700/60 my-1" />

          <button
            onClick={() => {
              if (targetId) {
                const store = useDiagramStore.getState();
                const selected = store.nodes.filter((n) => n.selected).map((n) => n.id);
                if (selected.includes(targetId) && selected.length > 1) {
                  store.deleteNodes(selected);
                } else {
                  store.deleteNode(targetId);
                }
              }
              onClose();
            }}
            className="w-full text-left px-3 py-1.5 hover:bg-red-50 dark:hover:bg-red-950/40 text-red-600 dark:text-red-400 flex items-center justify-between transition-colors"
          >
            <span className="flex items-center gap-2">
              <Trash2 size={13} />
              Delete
            </span>
            <kbd className="text-[10px] text-red-400 font-mono">Del</kbd>
          </button>
        </>
      )}

      {type === 'edge' && targetId && (
        <button
          onClick={() => {
            onEdgesChange([{ id: targetId, type: 'remove' }]);
            onClose();
          }}
          className="w-full text-left px-3 py-1.5 hover:bg-red-50 dark:hover:bg-red-950/40 text-red-600 dark:text-red-400 flex items-center justify-between transition-colors"
        >
          <span className="flex items-center gap-2">
            <Trash2 size={13} />
            Delete Connection
          </span>
          <kbd className="text-[10px] text-red-400 font-mono">Del</kbd>
        </button>
      )}

      {type === 'pane' && (
        <>
          <button
            onClick={() => {
              if (hasClipboard) {
                pasteSelection();
                onClose();
              }
            }}
            disabled={!hasClipboard}
            className={`w-full text-left px-3 py-1.5 flex items-center justify-between transition-colors ${
              hasClipboard
                ? 'hover:bg-blue-50 dark:hover:bg-slate-700/70 hover:text-blue-600 dark:hover:text-blue-400 cursor-pointer'
                : 'opacity-40 cursor-not-allowed'
            }`}
          >
            <span className="flex items-center gap-2">
              <Clipboard size={13} className="text-gray-400 dark:text-gray-500" />
              Paste
            </span>
            <kbd className="text-[10px] text-gray-400 font-mono">Ctrl+V</kbd>
          </button>

          <button
            onClick={() => {
              // Mirror the Ctrl+A handler in Canvas.tsx: only nodes on the active
              // canvas are selectable, otherwise Delete wipes every other canvas.
              const activeCanvasId = useDiagramStore.getState().activeCanvasId;
              const visibleIds = new Set(
                nodes
                  .filter((n) => {
                    const portalId = (n.data as { portalId?: string }).portalId;
                    return activeCanvasId ? portalId === activeCanvasId : !portalId;
                  })
                  .map((n) => n.id)
              );
              onNodesChange(
                nodes.map((n) => ({ id: n.id, type: 'select', selected: visibleIds.has(n.id) }))
              );
              onClose();
            }}
            className="w-full text-left px-3 py-1.5 hover:bg-blue-50 dark:hover:bg-slate-700/70 hover:text-blue-600 dark:hover:text-blue-400 flex items-center justify-between transition-colors"
          >
            <span className="flex items-center gap-2">
              <CheckSquare size={13} className="text-gray-400 dark:text-gray-500" />
              Select All
            </span>
            <kbd className="text-[10px] text-gray-400 font-mono">Ctrl+A</kbd>
          </button>

          <button
            onClick={() => {
              reactFlow.fitView({ padding: 0.2, duration: 400 });
              onClose();
            }}
            className="w-full text-left px-3 py-1.5 hover:bg-blue-50 dark:hover:bg-slate-700/70 hover:text-blue-600 dark:hover:text-blue-400 flex items-center justify-between transition-colors"
          >
            <span className="flex items-center gap-2">
              <Maximize size={13} className="text-gray-400 dark:text-gray-500" />
              Zoom to Fit
            </span>
            <kbd className="text-[10px] text-gray-400 font-mono">Shift+1</kbd>
          </button>

          <div className="h-px bg-gray-150 dark:bg-gray-700/60 my-1" />

          <button
            onClick={() => {
              clearCanvas();
              onClose();
            }}
            className="w-full text-left px-3 py-1.5 hover:bg-red-50 dark:hover:bg-red-950/40 text-red-600 dark:text-red-400 flex items-center justify-between transition-colors"
          >
            <span className="flex items-center gap-2">
              <RotateCcw size={13} />
              Clear Canvas
            </span>
          </button>
        </>
      )}
    </div>
  );
}
