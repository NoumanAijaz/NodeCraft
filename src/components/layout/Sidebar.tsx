import { useState } from 'react';
import { useDiagramStore } from '../../store/useDiagramStore';
import type { ShapeType } from '../../types/diagram';
import { Square, Circle, Diamond, StickyNote, Type, Database, Image as ImageIcon, PanelTop, CreditCard, LayoutList, Locate, Search, ChevronRight } from 'lucide-react';

interface ShapeInfo {
  type: ShapeType;
  label: string;
  icon: React.ReactNode;
  description: string;
  accentColor: string;
}

const isMac = typeof window !== 'undefined' && /Mac|iPod|iPhone|iPad/.test(navigator.platform || navigator.userAgent);

export function Sidebar() {
  const [showBulkAdd, setShowBulkAdd] = useState(false);
  const [bulkText, setBulkText] = useState('');
  const [activeTab, setActiveTab] = useState<'shapes' | 'outline'>('shapes');
  const [searchTerm, setSearchTerm] = useState('');
  const addNode = useDiagramStore((state) => state.addNode);
  const nodes = useDiagramStore((state) => state.nodes);
  const rfInstance = useDiagramStore((state) => state.reactFlowInstance);
  
  const frameNodes = nodes
    .filter(n => n.type === 'shape' && (n.data as any).shapeType === 'frame')
    .sort((a, b) => {
      const yDiff = a.position.y - b.position.y;
      if (Math.abs(yDiff) > 50) return yDiff;
      return a.position.x - b.position.x;
    });
  
  const handleFrameClick = (frameId: string) => {
    const frame = frameNodes.find(n => n.id === frameId);
    if (!frame || !rfInstance) return;
    // Prefer measured dimensions — after a NodeResizer resize, `frame.width`
    // may be stale while `frame.measured.width` reflects the actual on-screen size.
    const w = frame.measured?.width || frame.width || 400;
    const h = frame.measured?.height || frame.height || 400;
    rfInstance.fitBounds(
      { x: frame.position.x, y: frame.position.y, width: w, height: h },
      { duration: 800, padding: 0.1 }
    );
  };

  const onDragStart = (event: React.DragEvent, nodeType: ShapeType) => {
    event.dataTransfer.setData('application/reactflow', nodeType);
    event.dataTransfer.effectAllowed = 'move';
  };

  const stickers = [
    { emoji: '👍', label: 'Like' },
    { emoji: '❤️', label: 'Love' },
    { emoji: '💡', label: 'Idea' },
    { emoji: '🔥', label: 'Hot' },
    { emoji: '⭐', label: 'Star' },
    { emoji: '❌', label: 'No' },
    { emoji: '🎉', label: 'Celebrate' },
    { emoji: '❓', label: 'Question' },
  ];

  const onStickerDragStart = (event: React.DragEvent, emoji: string) => {
    event.dataTransfer.setData('application/reactflow', 'sticker');
    event.dataTransfer.setData('application/reactflow-emoji', emoji);
    event.dataTransfer.effectAllowed = 'move';
  };

  const handleStickerClick = (emoji: string) => {
    const rect = document.querySelector('.react-flow')?.getBoundingClientRect();
    const centerX = rect ? rect.left + rect.width / 2 : window.innerWidth / 2;
    const centerY = rect ? rect.top + rect.height / 2 : window.innerHeight / 2;
    const position = rfInstance ? rfInstance.screenToFlowPosition({ x: centerX, y: centerY }) : { x: 300, y: 300 };
    const randomRot = Math.floor(Math.random() * 16 - 8);
    addNode('sticker', position, { stickerEmoji: emoji, label: emoji, rotation: randomRot });
  };

  const handleBulkSubmit = () => {
    const lines = bulkText.split('\n').map(l => l.trim()).filter(l => l.length > 0);
    if (lines.length === 0) return;

    const startX = 200;
    const startY = 200;
    const cols = Math.ceil(Math.sqrt(lines.length));

    // IMPORTANT: calling addNode() in a loop is buggy because each call
    // deselects all previously-added nodes (see store). To keep all the new
    // stickies selected, we (a) capture the projected positions, then
    // (b) call addNode for each, and finally (c) re-select them all in one
    // batched setState. This is still N renders (one per addNode) but is the
    // simplest fix without adding a new bulkAddNodes store action.
    const projectedPositions = lines.map((line, index) => {
      const col = index % cols;
      const row = Math.floor(index / cols);
      return { x: startX + col * 180, y: startY + row * 180, label: line };
    });

    // First, deselect everything so the first addNode() doesn't fight with
    // currently-selected nodes.
    useDiagramStore.getState().selectNode(null);

    const newIds: string[] = [];
    projectedPositions.forEach((p) => {
      // addNode returns void, so we read the latest node id right after.
      const before = useDiagramStore.getState().nodes;
      addNode('sticky', { x: p.x, y: p.y }, { label: p.label });
      const after = useDiagramStore.getState().nodes;
      // The new node is whichever id appears in `after` but not in `before`.
      const newId = after.find(n => !before.some(b => b.id === n.id))?.id;
      if (newId) newIds.push(newId);
    });

    // Re-select all the new stickies in one go.
    useDiagramStore.setState({
      nodes: useDiagramStore.getState().nodes.map(n => ({
        ...n,
        selected: newIds.includes(n.id),
      })),
    });

    setBulkText('');
    setShowBulkAdd(false);
  };

  const bulkLineCount = bulkText.split('\n').map(l => l.trim()).filter(l => l.length > 0).length;

  const shapes: ShapeInfo[] = [
    { type: 'rectangle', label: 'Rectangle', icon: <Square size={18} />, description: 'Basic process step', accentColor: 'bg-blue-400' },
    { type: 'circle', label: 'Circle', icon: <Circle size={18} />, description: 'Start or end point', accentColor: 'bg-emerald-400' },
    { type: 'diamond', label: 'Diamond', icon: <Diamond size={18} />, description: 'Decision point', accentColor: 'bg-amber-400' },
    { type: 'cylinder', label: 'Database', icon: <Database size={18} />, description: 'Data storage', accentColor: 'bg-violet-400' },
    { type: 'image', label: 'Image', icon: <ImageIcon size={18} />, description: 'Upload image', accentColor: 'bg-pink-400' },
    { type: 'sticky', label: 'Sticky Note', icon: <StickyNote size={18} className="text-yellow-500" />, description: 'Free-form note', accentColor: 'bg-yellow-400' },
    { type: 'text', label: 'Text Block', icon: <Type size={18} />, description: 'Simple text node', accentColor: 'bg-gray-400' },
    { type: 'frame', label: 'Frame', icon: <PanelTop size={18} className="text-violet-500" />, description: 'Container area', accentColor: 'bg-violet-400' },
    { type: 'card', label: 'Task Card', icon: <CreditCard size={18} className="text-emerald-500" />, description: 'Jira-style task', accentColor: 'bg-emerald-400' },
    { type: 'portal', label: 'Portal', icon: <Locate size={18} className="text-orange-500" />, description: 'Link to canvas', accentColor: 'bg-orange-400' },
  ];

  const filteredShapes = searchTerm
    ? shapes.filter(s => s.label.toLowerCase().includes(searchTerm.toLowerCase()) || s.description.toLowerCase().includes(searchTerm.toLowerCase()))
    : shapes;

  return (
    <aside className="w-60 border-r border-gray-200/80 dark:border-gray-800/80 bg-white dark:bg-slate-950 h-full flex flex-col z-50 overflow-hidden">
      {/* Tabs */}
      <div className="flex border-b border-gray-200/80 dark:border-gray-800/80 bg-gray-50/80 dark:bg-slate-900/80">
        <button 
          onClick={() => setActiveTab('shapes')}
          className={`flex-1 py-2.5 text-[11px] font-semibold uppercase tracking-wider transition-all relative ${activeTab === 'shapes' ? 'text-blue-600 dark:text-blue-400' : 'text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-300'}`}
        >
          Tools
          {activeTab === 'shapes' && <div className="absolute bottom-0 left-3 right-3 h-0.5 bg-blue-500 dark:bg-blue-400 rounded-full" />}
        </button>
        <button 
          onClick={() => setActiveTab('outline')}
          className={`flex-1 py-2.5 text-[11px] font-semibold uppercase tracking-wider transition-all relative ${activeTab === 'outline' ? 'text-blue-600 dark:text-blue-400' : 'text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-300'}`}
        >
          Outline
          {activeTab === 'outline' && <div className="absolute bottom-0 left-3 right-3 h-0.5 bg-blue-500 dark:bg-blue-400 rounded-full" />}
        </button>
      </div>

      <div className="flex-1 overflow-y-auto sidebar-scroll">
        {activeTab === 'outline' ? (
          <div className="p-3 flex flex-col gap-2">
            <div className="flex items-center gap-2 mb-1 text-gray-400 dark:text-gray-500">
              <LayoutList size={14} />
              <span className="text-[10px] font-semibold uppercase tracking-wider">Board Frames</span>
            </div>
            {frameNodes.length === 0 ? (
              <div className="text-[11px] text-gray-400 dark:text-gray-600 p-4 text-center border border-dashed border-gray-200 dark:border-gray-800 rounded-lg bg-gray-50/50 dark:bg-slate-900/50">
                <LayoutList size={20} className="mx-auto mb-2 opacity-40" />
                Drag a Frame onto the canvas to start organizing sections.
              </div>
            ) : (
              frameNodes.map((frame, idx) => (
                <button
                  key={frame.id}
                  onClick={() => handleFrameClick(frame.id)}
                  className="flex items-center justify-between p-2.5 rounded-lg border border-gray-100 dark:border-gray-800 hover:border-blue-300 dark:hover:border-blue-700 hover:shadow-sm transition-all text-left group bg-white dark:bg-slate-900"
                >
                  <span className="text-xs font-medium text-gray-600 dark:text-gray-300 truncate">
                    {idx + 1}. {(frame.data as any).label || 'Untitled Frame'}
                  </span>
                  <Locate size={12} className="text-gray-300 group-hover:text-blue-500 transition-colors" />
                </button>
              ))
            )}
          </div>
        ) : (
          <div className="p-2.5">
            {/* Shape Search */}
            <div className="relative mb-2">
              <Search size={12} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-300 dark:text-gray-600" />
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Filter shapes..."
                className="w-full text-[11px] bg-gray-50 dark:bg-slate-900 border border-gray-200/80 dark:border-gray-800 rounded-lg pl-7 pr-2.5 py-1.5 outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400 dark:focus:border-blue-600 text-gray-700 dark:text-gray-200 placeholder-gray-400 dark:placeholder-gray-600 transition-colors"
              />
              {searchTerm && (
                <button onClick={() => setSearchTerm('')} className="absolute right-2 top-1/2 -translate-y-1/2 text-[10px] text-gray-400 hover:text-gray-600 dark:hover:text-gray-300">✕</button>
              )}
            </div>

            <div className="flex items-center gap-1.5 mb-2 px-1">
              <span className="text-[10px] font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-wider">Shapes</span>
              <span className="text-[10px] text-gray-300 dark:text-gray-600">({filteredShapes.length})</span>
            </div>
            
            <div className="flex flex-col gap-1">
              {filteredShapes.map((shape) => (
                <div
                  key={shape.type}
                  className="
                    flex items-center gap-2.5 px-2.5 py-2 rounded-lg
                    border border-transparent
                    hover:border-gray-200 dark:hover:border-gray-700
                    hover:bg-gray-50 dark:hover:bg-slate-900
                    cursor-grab active:cursor-grabbing
                    transition-all duration-150 group
                    hover:translate-x-0.5 relative
                  "
                  onDragStart={(event) => onDragStart(event, shape.type)}
                  draggable
                >
                  {/* Left accent bar */}
                  <div className={`absolute left-0 top-2 bottom-2 w-0.5 rounded-full ${shape.accentColor} opacity-0 group-hover:opacity-100 transition-opacity`} />
                  
                  {/* Icon */}
                  <div className="w-8 h-8 rounded-lg flex items-center justify-center bg-gray-50 dark:bg-slate-800 group-hover:bg-white dark:group-hover:bg-slate-700 border border-gray-100 dark:border-gray-800 group-hover:border-gray-200 dark:group-hover:border-gray-600 transition-all shadow-sm group-hover:shadow">
                    <div className="text-gray-500 dark:text-gray-400 group-hover:text-gray-700 dark:group-hover:text-gray-200 transition-colors">
                      {shape.icon}
                    </div>
                  </div>
                  
                  {/* Label & Description */}
                  <div className="flex-1 min-w-0">
                    <span className="text-xs font-medium text-gray-700 dark:text-gray-200 group-hover:text-gray-900 dark:group-hover:text-white block">{shape.label}</span>
                    <span className="text-[10px] text-gray-400 dark:text-gray-600 block truncate">{shape.description}</span>
                  </div>

                  {/* Drag hint */}
                  <ChevronRight size={12} className="text-gray-300 dark:text-gray-700 opacity-0 group-hover:opacity-100 transition-opacity" />
                </div>
              ))}
            </div>

            {filteredShapes.length === 0 && (
              <div className="text-[11px] text-gray-400 dark:text-gray-600 text-center py-4">
                No shapes match "{searchTerm}"
              </div>
            )}

            {/* Section Divider */}
            <div className="my-3 h-px bg-gradient-to-r from-transparent via-gray-200 dark:via-gray-800 to-transparent" />

            {/* Bulk Add Sticky Notes */}
            <div className="mb-1">
              {!showBulkAdd ? (
                <button
                  onClick={() => setShowBulkAdd(true)}
                  className="w-full py-2 px-3 text-[11px] bg-gray-50 dark:bg-slate-900 hover:bg-gray-100 dark:hover:bg-slate-800 text-gray-600 dark:text-gray-300 border border-dashed border-gray-200 dark:border-gray-800 rounded-lg font-medium transition-colors flex items-center justify-center gap-1.5"
                >
                  <StickyNote size={12} />
                  Bulk Add Notes
                </button>
              ) : (
                <div className="flex flex-col gap-1.5 p-2.5 bg-gray-50 dark:bg-slate-900 rounded-lg border border-gray-200 dark:border-gray-800">
                  <span className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider">Bulk Add (one per line)</span>
                  <textarea
                    value={bulkText}
                    onChange={(e) => setBulkText(e.target.value)}
                    placeholder="Idea 1&#10;Idea 2&#10;Idea 3..."
                    className="w-full h-20 text-xs bg-white dark:bg-slate-800 border border-gray-200 dark:border-gray-700 rounded-lg p-2 outline-none focus:ring-2 focus:ring-blue-500/20 text-gray-900 dark:text-gray-100 resize-none transition-shadow"
                  />
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] text-gray-400">{bulkLineCount} note{bulkLineCount !== 1 ? 's' : ''}</span>
                    <div className="flex gap-1.5">
                      <button onClick={handleBulkSubmit} disabled={bulkLineCount === 0} className="px-2.5 py-1 text-[11px] bg-blue-500 text-white rounded-md font-medium hover:bg-blue-600 transition-colors disabled:opacity-40 disabled:cursor-not-allowed">
                        Create
                      </button>
                      <button onClick={() => { setShowBulkAdd(false); setBulkText(''); }} className="px-2 py-1 text-[11px] bg-gray-200 dark:bg-slate-700 text-gray-600 dark:text-gray-300 rounded-md font-medium hover:bg-gray-300 dark:hover:bg-slate-600 transition-colors">
                        Cancel
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Section Divider */}
            <div className="my-3 h-px bg-gradient-to-r from-transparent via-gray-200 dark:via-gray-800 to-transparent" />

            {/* Stickers */}
            <div className="mb-1">
              <div className="flex items-center gap-1.5 mb-2 px-1">
                <span className="text-[10px] font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-wider">Stickers</span>
              </div>
              <div className="grid grid-cols-4 gap-1 p-2 bg-gray-50/80 dark:bg-slate-900/80 rounded-lg border border-gray-100 dark:border-gray-800/50">
                {stickers.map((st) => (
                  <button
                    key={st.emoji}
                    draggable
                    onDragStart={(e) => onStickerDragStart(e, st.emoji)}
                    onClick={() => handleStickerClick(st.emoji)}
                    className="w-9 h-9 flex items-center justify-center text-lg rounded-md hover:bg-white dark:hover:bg-slate-800 hover:shadow-sm transition-all active:scale-90 cursor-grab border border-transparent hover:border-gray-200 dark:hover:border-gray-700"
                    title={`Drag or click to place ${st.label}`}
                  >
                    {st.emoji}
                  </button>
                ))}
              </div>
            </div>

            {/* Section Divider */}
            <div className="my-3 h-px bg-gradient-to-r from-transparent via-gray-200 dark:via-gray-800 to-transparent" />

            {/* Tips */}
            <div className="p-3 rounded-lg bg-gradient-to-br from-blue-50/80 to-indigo-50/50 dark:from-blue-950/20 dark:to-indigo-950/10 border border-blue-100/60 dark:border-blue-900/30 relative overflow-hidden">
              <div className="absolute top-0 left-0 w-1 h-full bg-gradient-to-b from-blue-400 to-indigo-500 rounded-l-lg" />
              <h3 className="text-[10px] font-semibold text-blue-600 dark:text-blue-400 mb-2 pl-2">Keyboard Shortcuts</h3>
              <ul className="text-[11px] text-blue-600/70 dark:text-blue-300/60 space-y-1.5 pl-2">
                <li className="flex items-center gap-1.5">
                  <kbd className="font-mono bg-white/80 dark:bg-slate-800 px-1.5 py-0.5 rounded text-[9px] border border-blue-100 dark:border-blue-800/50 shadow-sm">Tab</kbd>
                  <span>Add child</span>
                </li>
                <li className="flex items-center gap-1.5">
                  <kbd className="font-mono bg-white/80 dark:bg-slate-800 px-1.5 py-0.5 rounded text-[9px] border border-blue-100 dark:border-blue-800/50 shadow-sm">Enter</kbd>
                  <span>Add sibling</span>
                </li>
                <li className="flex items-center gap-1.5">
                  <kbd className="font-mono bg-white/80 dark:bg-slate-800 px-1.5 py-0.5 rounded text-[9px] border border-blue-100 dark:border-blue-800/50 shadow-sm">{isMac ? '⌘D' : 'Ctrl+D'}</kbd>
                  <span>Duplicate</span>
                </li>
                <li className="flex items-center gap-1.5">
                  <kbd className="font-mono bg-white/80 dark:bg-slate-800 px-1.5 py-0.5 rounded text-[9px] border border-blue-100 dark:border-blue-800/50 shadow-sm">Del</kbd>
                  <span>Delete</span>
                </li>
              </ul>
            </div>
          </div>
        )}
      </div>

      {/* Footer */}
      <div className="p-2.5 border-t border-gray-200/80 dark:border-gray-800/80 bg-gray-50/50 dark:bg-slate-900/50">
        <p className="text-[9px] text-gray-400 dark:text-gray-600 text-center font-medium">
          NodeCraft v0.1.0 · Made with ♥
        </p>
      </div>
    </aside>
  );
}