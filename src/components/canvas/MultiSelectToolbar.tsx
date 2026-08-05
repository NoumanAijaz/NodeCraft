import { useState } from 'react';
import { Panel } from '@xyflow/react';
import { useDiagramStore } from '../../store/useDiagramStore';
import { AlignLeft, AlignCenter, AlignRight, AlignStartVertical, AlignEndVertical, Trash2, LayoutGrid, Copy, AlignHorizontalSpaceAround, GripVertical } from 'lucide-react';

export function MultiSelectToolbar() {
  const nodes = useDiagramStore((state) => state.nodes);
  const selectedNodes = nodes.filter((n) => n.selected);
  const presentationMode = useDiagramStore((state) => state.presentationMode);
  const [showAlignLabel, setShowAlignLabel] = useState(false);
  const [showDistLabel, setShowDistLabel] = useState(false);

  const portalNode = selectedNodes.find(n => (n.data as any).shapeType === 'portal');
  const nodesToMove = selectedNodes.filter(n => n.id !== portalNode?.id);
  const canMoveToPortal = !!portalNode && nodesToMove.length > 0;

  if (presentationMode || selectedNodes.length < 2) {
    return null;
  }

  const alignNodes = (alignment: 'left' | 'center' | 'right' | 'top' | 'middle' | 'bottom') => {
    useDiagramStore.getState().alignSelectedNodes(alignment);
  };

  const duplicateSelected = () => {
    useDiagramStore.getState().duplicateSelectedNodes();
  };

  return (
    <Panel position="top-center" className="glass-panel border border-gray-200/60 dark:border-gray-700/40 rounded-2xl shadow-2xl p-1.5 flex items-center gap-0.5 z-50 animate-dropdown-in mt-4 select-none">
      {/* Selection Count Badge */}
      <div className="flex items-center gap-1.5 px-2.5 py-1 mr-1 bg-blue-50 dark:bg-blue-900/30 rounded-lg border border-blue-100 dark:border-blue-800/50">
        <div className="flex -space-x-1">
          <div className="w-4 h-4 rounded-full bg-blue-400 border-2 border-white dark:border-slate-800" />
          <div className="w-4 h-4 rounded-full bg-emerald-400 border-2 border-white dark:border-slate-800" />
          <div className="w-4 h-4 rounded-full bg-amber-400 border-2 border-white dark:border-slate-800 flex items-center justify-center text-[8px] font-bold text-white">
            {selectedNodes.length > 2 ? '+' : ''}
          </div>
        </div>
        <span className="text-[11px] font-bold text-blue-700 dark:text-blue-300 tabular-nums">{selectedNodes.length}</span>
      </div>

      <div className="w-px h-7 bg-gray-200/80 dark:bg-gray-700/60 mx-0.5" />

      {/* Alignment Section */}
      <div 
        className="flex items-center gap-0.5 relative"
        onMouseEnter={() => setShowAlignLabel(true)}
        onMouseLeave={() => setShowAlignLabel(false)}
      >
        <span className={`absolute -top-5 left-1/2 -translate-x-1/2 text-[9px] font-bold text-gray-400 dark:text-gray-500 uppercase tracking-wider transition-opacity duration-150 pointer-events-none ${showAlignLabel ? 'opacity-100' : 'opacity-0'}`}>
          Align
        </span>
        <button 
          onClick={() => alignNodes('left')}
          className="toolbar-btn p-1.5 rounded-lg text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-slate-700 hover:text-gray-900 dark:hover:text-gray-100 transition-all"
          title="Align Left"
        >
          <AlignLeft size={16} />
        </button>
        <button 
          onClick={() => alignNodes('center')}
          className="toolbar-btn p-1.5 rounded-lg text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-slate-700 hover:text-gray-900 dark:hover:text-gray-100 transition-all"
          title="Align Center Horizontally"
        >
          <AlignCenter size={16} />
        </button>
        <button 
          onClick={() => alignNodes('right')}
          className="toolbar-btn p-1.5 rounded-lg text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-slate-700 hover:text-gray-900 dark:hover:text-gray-100 transition-all"
          title="Align Right"
        >
          <AlignRight size={16} />
        </button>
        <div className="w-px h-4 bg-gray-200/60 dark:bg-gray-700/40 mx-0.5" />
        <button 
          onClick={() => alignNodes('top')}
          className="toolbar-btn p-1.5 rounded-lg text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-slate-700 hover:text-gray-900 dark:hover:text-gray-100 transition-all"
          title="Align Top"
        >
          <AlignStartVertical size={16} />
        </button>
        <button 
          onClick={() => alignNodes('middle')}
          className="toolbar-btn p-1.5 rounded-lg text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-slate-700 hover:text-gray-900 dark:hover:text-gray-100 transition-all"
          title="Align Center Vertically"
        >
          <AlignHorizontalSpaceAround size={16} className="rotate-90" />
        </button>
        <button 
          onClick={() => alignNodes('bottom')}
          className="toolbar-btn p-1.5 rounded-lg text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-slate-700 hover:text-gray-900 dark:hover:text-gray-100 transition-all"
          title="Align Bottom"
        >
          <AlignEndVertical size={16} />
        </button>
      </div>

      <div className="w-px h-7 bg-gray-200/80 dark:bg-gray-700/60 mx-0.5" />

      {/* Distribution & Layout Section */}
      <div 
        className="flex items-center gap-0.5 relative"
        onMouseEnter={() => setShowDistLabel(true)}
        onMouseLeave={() => setShowDistLabel(false)}
      >
        <span className={`absolute -top-5 left-1/2 -translate-x-1/2 text-[9px] font-bold text-gray-400 dark:text-gray-500 uppercase tracking-wider transition-opacity duration-150 pointer-events-none ${showDistLabel ? 'opacity-100' : 'opacity-0'}`}>
          Layout
        </span>
        <button 
          onClick={() => useDiagramStore.getState().distributeSelectedNodes('horizontal')}
          disabled={selectedNodes.length < 3}
          className="toolbar-btn p-1.5 rounded-lg text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-slate-700 hover:text-gray-900 dark:hover:text-gray-100 transition-all disabled:opacity-30 disabled:cursor-not-allowed disabled:hover:bg-transparent disabled:hover:text-gray-500 dark:disabled:hover:text-gray-400"
          title="Distribute Horizontally (needs 3+ nodes)"
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <line x1="4" y1="21" x2="4" y2="3" />
            <line x1="20" y1="21" x2="20" y2="3" />
            <rect x="9" y="6" width="6" height="12" rx="1" />
          </svg>
        </button>
        <button 
          onClick={() => useDiagramStore.getState().distributeSelectedNodes('vertical')}
          disabled={selectedNodes.length < 3}
          className="toolbar-btn p-1.5 rounded-lg text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-slate-700 hover:text-gray-900 dark:hover:text-gray-100 transition-all disabled:opacity-30 disabled:cursor-not-allowed disabled:hover:bg-transparent disabled:hover:text-gray-500 dark:disabled:hover:text-gray-400"
          title="Distribute Vertically (needs 3+ nodes)"
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <line x1="3" y1="4" x2="21" y2="4" />
            <line x1="3" y1="20" x2="21" y2="20" />
            <rect x="6" y="9" width="12" height="6" rx="1" />
          </svg>
        </button>
        <button 
          onClick={() => useDiagramStore.getState().arrangeSelectedNodesAsTree()}
          className="toolbar-btn p-1.5 rounded-lg text-violet-600 dark:text-violet-400 hover:bg-violet-50 dark:hover:bg-violet-900/30 transition-all"
          title="Arrange as Parent-Child Tree"
        >
          <LayoutGrid size={16} />
        </button>
      </div>

      <div className="w-px h-7 bg-gray-200/80 dark:bg-gray-700/60 mx-0.5" />

      {/* Group Button */}
      <button 
        onClick={() => useDiagramStore.getState().groupNodes()}
        disabled={selectedNodes.some(n => n.parentId || n.id.startsWith('group-'))}
        className="toolbar-btn px-2.5 py-1.5 rounded-lg bg-blue-500 hover:bg-blue-600 text-white text-xs font-semibold transition-all shadow-sm hover:shadow-md disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:bg-blue-500 disabled:hover:shadow-sm"
        title={selectedNodes.some(n => n.parentId || n.id.startsWith('group-')) ? "Cannot group already grouped nodes" : "Group selected nodes"}
      >
        <span className="flex items-center gap-1">
          <GripVertical size={12} />
          Group
        </span>
      </button>

      <div className="w-px h-7 bg-gray-200/80 dark:bg-gray-700/60 mx-0.5" />

      {/* Bulk Fill Colors */}
      <div className="flex items-center gap-1 px-1">
        {['#ffffff', '#fef08a', '#fed7aa', '#fecaca', '#fbcfe8', '#bfdbfe', '#bbf7d0'].map((color, i) => (
          <button
            key={color}
            onClick={() => {
              const ids = selectedNodes.map(n => n.id);
              useDiagramStore.getState().updateNodesData(ids, { color });
            }}
            className="w-5 h-5 rounded-full border border-gray-200 dark:border-gray-600 shadow-sm hover:scale-125 transition-all duration-150 hover:shadow-md"
            style={{ 
              backgroundColor: color,
              animationDelay: `${i * 30}ms`
            }}
            title={`Fill: ${color}`}
          />
        ))}
        <input 
          type="color"
          value={
            selectedNodes.length > 0 && selectedNodes.every(n => (n.data as any).color === (selectedNodes[0].data as any).color)
              ? ((selectedNodes[0].data as any).color || '#ffffff')
              : '#3b82f6'
          }
          onChange={(e) => {
            const ids = selectedNodes.map(n => n.id);
            useDiagramStore.getState().updateNodesData(ids, { color: e.target.value });
          }}
          className="w-5 h-5 p-0 border-0 rounded-full cursor-pointer bg-transparent overflow-hidden"
          title="Custom fill color"
        />
      </div>

      <div className="w-px h-7 bg-gray-200/80 dark:bg-gray-700/60 mx-0.5" />

      {/* Portal Suck */}
      {canMoveToPortal && (
        <>
          <button 
            onClick={() => {
              const store = useDiagramStore.getState();
              const ids = new Set(nodesToMove.map(n => n.id));
              useDiagramStore.setState({
                nodes: store.nodes.map(n => {
                  if (ids.has(n.id)) {
                    return { ...n, data: { ...n.data, portalId: portalNode!.id } };
                  }
                  return n;
                }),
                activeCanvasId: portalNode!.id
              });
            }}
            className="toolbar-btn px-2 py-1.5 flex items-center gap-1.5 rounded-lg bg-violet-500 hover:bg-violet-600 text-white text-xs font-semibold transition-all shadow-sm hover:shadow-md"
            title="Move selected nodes into portal"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M15 3h6v6" />
              <path d="M10 14 21 3" />
              <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />
            </svg>
            <span>Suck in</span>
          </button>
          <div className="w-px h-7 bg-gray-200/80 dark:bg-gray-700/60 mx-0.5" />
        </>
      )}

      {/* Duplicate */}
      <button
        onClick={duplicateSelected}
        className="toolbar-btn p-1.5 rounded-lg text-gray-500 dark:text-gray-400 hover:bg-emerald-50 dark:hover:bg-emerald-900/30 hover:text-emerald-600 dark:hover:text-emerald-400 transition-all"
        title="Duplicate selection (Ctrl+D)"
      >
        <Copy size={16} />
      </button>

      {/* Delete */}
      <button
        onClick={() => {
          const ids = selectedNodes.map(n => n.id);
          useDiagramStore.getState().onNodesChange(ids.map(id => ({ type: 'remove', id })));
        }}
        className="toolbar-btn p-1.5 rounded-lg text-gray-400 dark:text-gray-500 hover:bg-red-50 dark:hover:bg-red-900/30 hover:text-red-500 dark:hover:text-red-400 transition-all ml-0.5"
        title="Delete selection"
      >
        <Trash2 size={16} />
      </button>
    </Panel>
  );
}