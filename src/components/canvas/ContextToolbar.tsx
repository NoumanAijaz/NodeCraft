import { useState, useEffect } from 'react';
import { Panel, MarkerType } from '@xyflow/react';
import { useDiagramStore } from '../../store/useDiagramStore';
import { AlignLeft, AlignCenter, AlignRight, Bold, Italic, Trash2, MoveUp, MoveDown, Minus, Play, ArrowRight, ArrowLeftRight, Lock, Unlock, Tag, Zap, Copy, Circle, Square } from 'lucide-react';
import type { ShapeNodeData } from '../../types/diagram';
import { getDefaultNodeDimensions } from '../../utils/diagram';

/**
 * Safely read & parse JSON from localStorage. Returns `fallback` if the value
 * is missing, malformed, or localStorage is unavailable (private mode etc.).
 */
function safeReadJSON<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    if (raw === null) return fallback;
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

export function ContextToolbar() {
  const updateNodeData = useDiagramStore((state) => state.updateNodeData);
  const updateEdgeType = useDiagramStore((state) => state.updateEdgeType);
  const updateEdge = useDiagramStore((state) => state.updateEdge);
  const updateEdgeStyle = useDiagramStore((state) => state.updateEdgeStyle);
  const nodes = useDiagramStore((state) => state.nodes);
  const edges = useDiagramStore((state) => state.edges);
  const bringToFront = useDiagramStore((state) => state.bringToFront);
  const sendToBack = useDiagramStore((state) => state.sendToBack);
  const theme = useDiagramStore((state) => state.theme);
  const selectedNodes = nodes.filter((n) => n.selected);
  const selectedEdges = edges.filter((e) => e.selected);
  const presentationMode = useDiagramStore((state) => state.presentationMode);

  if (presentationMode) return null;

  // ==================== EDGE TOOLBAR ====================
  if (selectedNodes.length === 0 && selectedEdges.length === 1) {
    const selectedEdge = selectedEdges[0];
    const edgeStyle = selectedEdge.style as { strokeWidth?: number; stroke?: string; opacity?: number } | undefined;
    const currentOpacity = edgeStyle?.opacity ?? 1;
    const currentWidth = edgeStyle?.strokeWidth ?? 2;

    return (
      <Panel position="top-center" className="glass-panel border border-gray-200/60 dark:border-gray-700/40 rounded-2xl shadow-2xl p-3 flex flex-col gap-2.5 z-50 animate-dropdown-in mt-4 transition-colors max-w-xl">
        {/* Row 1: Core Line Properties */}
        <div className="flex items-center flex-wrap gap-2.5 pb-2.5 border-b border-gray-100 dark:border-gray-700/30">
          {/* Line Path */}
          <div className="flex items-center gap-2 shrink-0">
            <span className="text-[10px] font-bold text-gray-400 dark:text-gray-500 uppercase tracking-wider">Path</span>
            <div className="flex bg-gray-100 dark:bg-slate-700 rounded-lg p-0.5 gap-0.5">
              <button 
                onClick={() => updateEdgeType(selectedEdge.id, 'default')}
                className={`toolbar-btn px-2 py-1 text-xs rounded-md transition-all ${selectedEdge.type === 'default' || !selectedEdge.type ? 'bg-white dark:bg-slate-600 shadow-sm text-blue-600 dark:text-blue-400' : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200'}`}
                title="Curved (Bezier)"
              >
                <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
                  <path d="M2 8 C6 2, 10 14, 14 8" />
                </svg>
              </button>
              <button 
                onClick={() => updateEdgeType(selectedEdge.id, 'step')}
                className={`toolbar-btn px-2 py-1 text-xs rounded-md transition-all ${selectedEdge.type === 'step' ? 'bg-white dark:bg-slate-600 shadow-sm text-blue-600 dark:text-blue-400' : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200'}`}
                title="Step (Right-angled)"
              >
                <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
                  <path d="M2 8 H6 V8 H14" />
                </svg>
              </button>
              <button 
                onClick={() => updateEdgeType(selectedEdge.id, 'straight')}
                className={`toolbar-btn px-2 py-1 text-xs rounded-md transition-all ${selectedEdge.type === 'straight' ? 'bg-white dark:bg-slate-600 shadow-sm text-blue-600 dark:text-blue-400' : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200'}`}
                title="Straight line"
              >
                <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
                  <line x1="2" y1="8" x2="14" y2="8" />
                </svg>
              </button>
              <button 
                onClick={() => updateEdgeType(selectedEdge.id, 'smoothstep')}
                className={`toolbar-btn px-2 py-1 text-xs rounded-md transition-all ${selectedEdge.type === 'smoothstep' ? 'bg-white dark:bg-slate-600 shadow-sm text-blue-600 dark:text-blue-400' : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200'}`}
                title="Smooth Step"
              >
                <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
                  <path d="M2 12 C2 8, 6 8, 8 8 S14 8, 14 4" />
                </svg>
              </button>
            </div>
          </div>

          <div className="w-px h-5 bg-gray-200 dark:bg-gray-700 shrink-0" />

          {/* Line Type Selection */}
          <div className="flex items-center gap-2 shrink-0">
            <span className="text-[10px] font-bold text-gray-400 dark:text-gray-500 uppercase tracking-wider">Type</span>
            <select 
              value={selectedEdge.type || 'default'} 
              onChange={(e) => updateEdge(selectedEdge.id, { type: e.target.value })}
              className="text-xs bg-gray-50 dark:bg-slate-700 border border-gray-200 dark:border-gray-600 rounded-lg px-2 py-1 outline-none focus:ring-2 focus:ring-blue-500 text-gray-900 dark:text-gray-100 font-medium transition-shadow"
            >
              <option value="default">Curve</option>
              <option value="straight">Straight</option>
              <option value="step">Step</option>
              <option value="smoothstep">Smooth Step</option>
            </select>
          </div>
          
          <div className="w-px h-5 bg-gray-200 dark:bg-gray-700 shrink-0" />

          {/* Dash Style */}
          <div className="flex items-center gap-2 shrink-0">
            <span className="text-[10px] font-bold text-gray-400 dark:text-gray-500 uppercase tracking-wider">Dash</span>
            <select 
              value={(edgeStyle as any)?.strokeDasharray === '6 4' ? 'dashed' : (edgeStyle as any)?.strokeDasharray === '2 3' ? 'dotted' : 'solid'} 
              onChange={(e) => {
                const val = e.target.value;
                const dashVal = val === 'solid' ? undefined : val === 'dashed' ? '6 4' : '2 3';
                updateEdgeStyle(selectedEdge.id, { strokeDasharray: dashVal } as any);
              }}
              className="text-xs bg-gray-50 dark:bg-slate-700 border border-gray-200 dark:border-gray-600 rounded-lg px-2 py-1 outline-none focus:ring-2 focus:ring-blue-500 text-gray-900 dark:text-gray-100 font-medium transition-shadow"
            >
              <option value="solid">Solid</option>
              <option value="dashed">Dashed</option>
              <option value="dotted">Dotted</option>
            </select>
          </div>
          
          <div className="w-px h-5 bg-gray-200 dark:bg-gray-700 shrink-0" />

          {/* Stroke Width Slider */}
          <div className="flex items-center gap-2 shrink-0">
            <span className="text-[10px] font-bold text-gray-400 dark:text-gray-500 uppercase tracking-wider">Width</span>
            <input
              type="range"
              min="1"
              max="8"
              step="0.5"
              value={currentWidth}
              onChange={(e) => updateEdgeStyle(selectedEdge.id, { strokeWidth: parseFloat(e.target.value) } as any)}
              className="w-16 h-1.5 bg-gray-200 dark:bg-slate-600 rounded-full appearance-none cursor-pointer accent-blue-500"
              title={`Stroke width: ${currentWidth}px`}
            />
            <span className="text-[10px] font-mono text-gray-400 dark:text-gray-500 w-5 text-right">{currentWidth}</span>
          </div>

          <div className="flex-grow" />
          
          <button 
            onClick={() => useDiagramStore.getState().onEdgesChange([{ type: 'remove', id: selectedEdge.id }])}
            className="toolbar-btn p-1.5 rounded-lg text-red-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/30 transition-all shrink-0"
            title="Delete Line"
          >
            <Trash2 size={16} />
          </button>
        </div>

        {/* Row 2: Arrows, Color, Label, Animation, Opacity */}
        <div className="flex items-center flex-wrap gap-2.5">
          {/* Arrows */}
          <div className="flex items-center gap-2 shrink-0">
            <span className="text-[10px] font-bold text-gray-400 dark:text-gray-500 uppercase tracking-wider">Arrows</span>
            <div className="flex bg-gray-100 dark:bg-slate-700 rounded-lg p-0.5 gap-0.5">
              <button
                onClick={() => {
                  updateEdge(selectedEdge.id, {
                    markerEnd: undefined,
                    markerStart: undefined
                  });
                }}
                className={`toolbar-btn px-2 py-1 text-xs rounded-md transition-all ${!selectedEdge.markerEnd && !selectedEdge.markerStart ? 'bg-white dark:bg-slate-600 shadow-sm text-blue-600 dark:text-blue-400' : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200'}`}
                title="No arrows"
              >
                <Minus size={14} />
              </button>
              <button
                onClick={() => {
                  const stroke = edgeStyle?.stroke || '#94a3b8';
                  updateEdge(selectedEdge.id, {
                    markerEnd: { type: MarkerType.ArrowClosed, width: 20, height: 20, color: stroke },
                    markerStart: undefined
                  });
                }}
                className={`toolbar-btn px-2 py-1 text-xs rounded-md transition-all ${selectedEdge.markerEnd && !selectedEdge.markerStart ? 'bg-white dark:bg-slate-600 shadow-sm text-blue-600 dark:text-blue-400' : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200'}`}
                title="One-way arrow"
              >
                <ArrowRight size={14} />
              </button>
              <button
                onClick={() => {
                  const stroke = edgeStyle?.stroke || '#94a3b8';
                  updateEdge(selectedEdge.id, {
                    markerEnd: { type: MarkerType.ArrowClosed, width: 20, height: 20, color: stroke },
                    markerStart: { type: MarkerType.ArrowClosed, width: 20, height: 20, color: stroke }
                  });
                }}
                className={`toolbar-btn px-2 py-1 text-xs rounded-md transition-all ${selectedEdge.markerEnd && selectedEdge.markerStart ? 'bg-white dark:bg-slate-600 shadow-sm text-blue-600 dark:text-blue-400' : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200'}`}
                title="Two-way arrows"
              >
                <ArrowLeftRight size={14} />
              </button>
            </div>
          </div>

          <div className="w-px h-5 bg-gray-200 dark:bg-gray-700 shrink-0" />

          {/* Line Color */}
          <div className="flex items-center gap-1.5 shrink-0">
            <span className="text-[10px] font-bold text-gray-400 dark:text-gray-500 uppercase tracking-wider mr-0.5">Color</span>
            {['#94a3b8', '#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899', '#06b6d4'].map((color) => (
              <button
                key={color}
                onClick={() => updateEdgeStyle(selectedEdge.id, { stroke: color })}
                className={`w-4 h-4 rounded-full border shadow-xs transition-all hover:scale-125 hover:shadow-md ${edgeStyle?.stroke === color ? 'ring-2 ring-blue-500 ring-offset-1 dark:ring-offset-slate-800 scale-110' : 'border-gray-300 dark:border-gray-600'}`}
                style={{ backgroundColor: color }}
                title={`Line color ${color}`}
              />
            ))}
            <input 
              type="color"
              value={edgeStyle?.stroke || '#94a3b8'}
              onChange={(e) => updateEdgeStyle(selectedEdge.id, { stroke: e.target.value })}
              className="w-4 h-4 p-0 border-0 rounded-full cursor-pointer bg-transparent overflow-hidden"
              title="Custom line color"
            />
          </div>

          <div className="w-px h-5 bg-gray-200 dark:bg-gray-700 shrink-0" />
          
          {/* Edge Label */}
          <div className="flex items-center gap-1.5 shrink-0">
            <span className="text-[10px] font-bold text-gray-400 dark:text-gray-500 uppercase tracking-wider">Label</span>
            <input
              type="text"
              value={typeof selectedEdge.label === 'string' ? selectedEdge.label : ''}
              onChange={(e) => {
                const label = e.target.value;
                updateEdge(selectedEdge.id, {
                  label,
                  labelStyle: { fill: theme === 'dark' ? '#f8fafc' : '#334155', fontWeight: 600, fontSize: 13, fontFamily: 'system-ui, -apple-system, sans-serif' },
                  labelBgStyle: { fill: theme === 'dark' ? '#1e293b' : '#ffffff', fillOpacity: 0.9, stroke: theme === 'dark' ? '#475569' : '#e2e8f0', strokeWidth: 1, rx: 6 },
                  labelBgPadding: [8, 4],
                });
              }}
              placeholder="Text..."
              className="w-24 text-xs bg-gray-50 dark:bg-slate-700 border border-gray-200 dark:border-gray-600 rounded-lg px-2 py-1 outline-none focus:ring-2 focus:ring-blue-500 text-gray-900 dark:text-gray-100 placeholder:text-gray-400 transition-shadow"
            />
          </div>

          <div className="w-px h-5 bg-gray-200 dark:bg-gray-700 shrink-0" />

          {/* Edge Opacity */}
          <div className="flex items-center gap-1.5 shrink-0">
            <Circle size={12} className="text-gray-400" />
            <input
              type="range"
              min="0.1"
              max="1"
              step="0.1"
              value={currentOpacity}
              onChange={(e) => updateEdgeStyle(selectedEdge.id, { opacity: parseFloat(e.target.value) } as any)}
              className="w-14 h-1.5 bg-gray-200 dark:bg-slate-600 rounded-full appearance-none cursor-pointer accent-blue-500"
              title={`Opacity: ${Math.round(currentOpacity * 100)}%`}
            />
            <span className="text-[10px] font-mono text-gray-400 dark:text-gray-500 w-6 text-right">{Math.round(currentOpacity * 100)}%</span>
          </div>

          <div className="w-px h-5 bg-gray-200 dark:bg-gray-700 shrink-0" />

          {/* Animation */}
          <div className="flex items-center gap-2 shrink-0">
            <button
              onClick={() => updateEdge(selectedEdge.id, { animated: !selectedEdge.animated })}
              className={`toolbar-btn flex items-center gap-1 px-2.5 py-1 text-xs font-medium rounded-lg transition-all ${selectedEdge.animated ? 'bg-blue-500 text-white shadow-sm' : 'bg-gray-100 dark:bg-slate-700 text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200'}`}
              title="Toggle Flow Animation"
            >
              <Play size={12} className={selectedEdge.animated ? 'fill-white' : ''} />
              <span>Animate</span>
            </button>
          </div>
        </div>
      </Panel>
    );
  }

  // ==================== NODE TOOLBAR ====================
  if (selectedNodes.length !== 1 || selectedEdges.length > 0) return null;
  
  const selectedNode = selectedNodes[0];
  if (selectedNode.type !== 'shape') return null;

  const data = selectedNode.data as ShapeNodeData;
  const nodeId = selectedNode.id;
  const nodeOpacity: number = Number(data.opacity ?? 1);
  const nodeBorderWidth: number = Number(data.borderWidth ?? 2);

  const colors = ['#ffffff', '#fef08a', '#fed7aa', '#fecaca', '#fbcfe8', '#e9d5ff', '#c7d2fe', '#bfdbfe', '#bbf7d0', '#e5e7eb', 'transparent'];
  const borderColors = ['#94a3b8', '#eab308', '#f97316', '#ef4444', '#ec4899', '#a855f7', '#6366f1', '#3b82f6', '#22c55e', '#4b5563', 'transparent'];

  return (
    <Panel position="top-center" className="glass-panel border border-gray-200/60 dark:border-gray-700/40 rounded-2xl shadow-2xl p-3 flex flex-col gap-2.5 z-50 animate-dropdown-in mt-4 transition-colors max-w-2xl">
      {/* Row 1: Shape Type, Typography, Styling, Layering, Duplicate, Delete */}
      <div className="flex items-center flex-wrap gap-2.5 pb-2.5 border-b border-gray-100 dark:border-gray-700/30">
        {/* Shape Type Converter */}
        <select 
          value={data.shapeType || 'rectangle'} 
          onChange={(e) => {
            const newType = e.target.value as ShapeNodeData['shapeType'];
            const dims = getDefaultNodeDimensions(newType);
            // Use updateNodeData (the proper store action) instead of bypassing
            // it with raw setState. We only set shapeType + size; stale fields
            // from the previous shape (status/assignee on card, imageUrl on image)
            // will simply be ignored by the renderer for the new shape, which is
            // good enough — they'll be cleared if the user ever converts back.
            updateNodeData(nodeId, { shapeType: newType });
            // Also update the node's dimensions so React Flow re-measures.
            const { nodes } = useDiagramStore.getState();
            useDiagramStore.setState({
              nodes: nodes.map(n =>
                n.id === nodeId
                  ? { ...n, width: dims.width, height: dims.height }
                  : n
              ),
            });
          }}
          className="text-xs bg-blue-50 dark:bg-blue-900/30 border border-blue-200 dark:border-blue-800/40 rounded-lg px-2 py-1 outline-none focus:ring-2 focus:ring-blue-500 text-blue-600 dark:text-blue-400 font-bold cursor-pointer transition-shadow"
          title="Convert Shape Type"
        >
          <option value="rectangle">Rectangle</option>
          <option value="circle">Circle</option>
          <option value="diamond">Diamond</option>
          <option value="cylinder">Database</option>
          <option value="sticky">Sticky Note</option>
          <option value="text">Text Block</option>
          <option value="frame">Frame</option>
          <option value="card">Task Card</option>
        </select>

        <div className="w-px h-4 bg-gray-200 dark:bg-gray-700 mx-0.5" />

        {/* Font Family */}
        <select 
          value={data.fontFamily || 'sans'} 
          onChange={(e) => updateNodeData(nodeId, { fontFamily: e.target.value as any })}
          className="text-xs bg-gray-50 dark:bg-slate-700 border border-gray-200 dark:border-gray-600 rounded-lg px-2 py-1 outline-none focus:ring-2 focus:ring-blue-500 text-gray-900 dark:text-gray-100 font-medium transition-shadow"
        >
          <option value="sans">Sans-serif</option>
          <option value="serif">Serif</option>
          <option value="mono">Monospace</option>
          <option value="handwriting">Handwriting</option>
        </select>

        {/* Font Size */}
        <select 
          value={data.fontSize || 14} 
          onChange={(e) => updateNodeData(nodeId, { fontSize: parseInt(e.target.value) })}
          className="text-xs bg-gray-50 dark:bg-slate-700 border border-gray-200 dark:border-gray-600 rounded-lg px-2 py-1 outline-none focus:ring-2 focus:ring-blue-500 text-gray-900 dark:text-gray-100 transition-shadow"
        >
          {[10, 12, 14, 16, 18, 20, 24, 28].map(size => <option key={size} value={size}>{size}px</option>)}
        </select>
        
        {/* Text Color */}
        <input 
          type="color"
          value={data.textColor || (theme === 'dark' ? '#ffffff' : '#000000')}
          onChange={(e) => updateNodeData(nodeId, { textColor: e.target.value })}
          className="w-6 h-6 p-0 border-0 rounded cursor-pointer bg-transparent"
          title="Text Color"
        />

        <div className="w-px h-5 bg-gray-200 dark:bg-gray-700 shrink-0" />

        {/* Bold / Italic / Lock */}
        <div className="flex gap-0.5 shrink-0">
          <button 
            onClick={() => updateNodeData(nodeId, { bold: !data.bold })}
            className={`toolbar-btn p-1.5 rounded-lg transition-all ${data.bold ? 'bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 shadow-sm' : 'text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-slate-700'}`}
            title="Bold"
          >
            <Bold size={15} />
          </button>
          <button 
            onClick={() => updateNodeData(nodeId, { italic: !data.italic })}
            className={`toolbar-btn p-1.5 rounded-lg transition-all ${data.italic ? 'bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 shadow-sm' : 'text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-slate-700'}`}
            title="Italic"
          >
            <Italic size={15} />
          </button>
          <button 
            onClick={() => updateNodeData(nodeId, { locked: !data.locked })}
            className={`toolbar-btn p-1.5 rounded-lg transition-all ${data.locked ? 'bg-amber-50 dark:bg-amber-900/30 text-amber-600 dark:text-amber-400 shadow-sm' : 'text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-slate-700'}`}
            title={data.locked ? "Unlock shape" : "Lock shape"}
          >
            {data.locked ? <Lock size={15} /> : <Unlock size={15} />}
          </button>
        </div>

        <div className="w-px h-5 bg-gray-200 dark:bg-gray-700 shrink-0" />

        {/* Text Alignment */}
        <div className="flex gap-0.5 shrink-0">
          <button
            onClick={() => updateNodeData(nodeId, { align: 'left' })}
            className={`toolbar-btn p-1.5 rounded-lg transition-all ${data.align === 'left' ? 'bg-white dark:bg-slate-600 shadow-sm text-blue-600 dark:text-blue-400' : 'text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-slate-700'}`}
            title="Align Left"
          >
            <AlignLeft size={15} />
          </button>
          <button
            onClick={() => updateNodeData(nodeId, { align: 'center' })}
            className={`toolbar-btn p-1.5 rounded-lg transition-all ${data.align === 'center' || !data.align ? 'bg-white dark:bg-slate-600 shadow-sm text-blue-600 dark:text-blue-400' : 'text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-slate-700'}`}
            title="Align Center"
          >
            <AlignCenter size={15} />
          </button>
          <button 
            onClick={() => updateNodeData(nodeId, { align: 'right' })}
            className={`toolbar-btn p-1.5 rounded-lg transition-all ${data.align === 'right' ? 'bg-white dark:bg-slate-600 shadow-sm text-blue-600 dark:text-blue-400' : 'text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-slate-700'}`}
            title="Align Right"
          >
            <AlignRight size={15} />
          </button>
        </div>

        <div className="w-px h-5 bg-gray-200 dark:bg-gray-700 shrink-0" />

        {/* Bring to Front / Send to Back */}
        <div className="flex gap-0.5 shrink-0">
          <button 
            onClick={() => bringToFront(nodeId)}
            className="toolbar-btn p-1.5 rounded-lg text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-slate-700 transition-all"
            title="Bring to Front"
          >
            <MoveUp size={15} />
          </button>
          <button 
            onClick={() => sendToBack(nodeId)}
            className="toolbar-btn p-1.5 rounded-lg text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-slate-700 transition-all"
            title="Send to Back"
          >
            <MoveDown size={15} />
          </button>
        </div>

        {selectedNode.id.startsWith('group-') && (
          <>
            <div className="w-px h-5 bg-gray-200 dark:bg-gray-700 shrink-0" />
            <button 
              onClick={() => useDiagramStore.getState().ungroupNodes(selectedNode.id)}
              className="toolbar-btn px-2 py-1 rounded-lg text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/30 text-xs font-semibold transition-all"
              title="Ungroup"
            >
              Ungroup
            </button>
          </>
        )}

        {data.shapeType === 'sticky' && (
          <>
            <button
              onClick={() => {
                const currentOrbits = data.ideaOrbits || [];
                const label = data.label.toLowerCase();
                const mockIdeas = ['Scale', 'Optimize', 'Launch'];
                if (label.includes('market')) mockIdeas.splice(0, 3, 'Social Media', 'SEO', 'Content Strategy');
                if (label.includes('design')) mockIdeas.splice(0, 3, 'Figma', 'User Testing', 'Accessibility');
                if (label.includes('dev')) mockIdeas.splice(0, 3, 'API', 'Database', 'Auth');
                
                updateNodeData(nodeId, { ideaOrbits: [...currentOrbits, ...mockIdeas] });
              }}
              className="toolbar-btn px-2 py-1 flex items-center gap-1 rounded-lg text-purple-600 dark:text-purple-400 hover:bg-purple-50 dark:hover:bg-purple-900/30 text-xs font-semibold transition-all shrink-0"
              title="Generate Idea Orbits"
            >
              <Zap size={13} /> Ideas
            </button>
            <AuthorInput assignee={data.assignee} nodeId={nodeId} updateNodeData={updateNodeData} />
          </>
        )}

        <div className="flex-grow" />

        {/* Duplicate */}
        <button 
          onClick={() => {
            useDiagramStore.getState().duplicateSelectedNodes();
          }}
          className="toolbar-btn p-1.5 rounded-lg text-gray-500 dark:text-gray-400 hover:bg-emerald-50 dark:hover:bg-emerald-900/30 hover:text-emerald-600 dark:hover:text-emerald-400 transition-all shrink-0"
          title="Duplicate (Ctrl+D)"
        >
          <Copy size={15} />
        </button>

        {/* Delete */}
        <button 
          onClick={() => useDiagramStore.getState().onNodesChange([{ type: 'remove', id: selectedNode.id }])}
          className="toolbar-btn p-1.5 rounded-lg text-red-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/30 transition-all shrink-0"
          title="Delete Shape"
        >
          <Trash2 size={15} />
        </button>
      </div>

      {/* Row 2: Colors, Border, Opacity, Tags, Reactions, Cards */}
      <div className="flex items-center flex-wrap gap-3">
        {/* Background Color */}
        <div className="flex items-center gap-1 shrink-0">
          <span className="text-[10px] font-bold text-gray-400 dark:text-gray-500 uppercase tracking-wider mr-1">Fill</span>
          {colors.map((c) => (
            <button
              key={c}
              onClick={() => updateNodeData(nodeId, { color: c })}
              className={`w-4 h-4 rounded-full border shadow-xs transition-all hover:scale-125 hover:shadow-md ${data.color === c ? 'ring-2 ring-blue-500 ring-offset-1 dark:ring-offset-slate-800 scale-110' : 'border-gray-300 dark:border-gray-600'}`}
              style={{ backgroundColor: c === 'transparent' ? 'transparent' : c, backgroundImage: c === 'transparent' ? 'repeating-linear-gradient(45deg, #ccc 25%, transparent 25%, transparent 75%, #ccc 75%, #ccc), repeating-linear-gradient(45deg, #ccc 25%, transparent 25%, transparent 75%, #ccc 75%, #ccc)' : 'none', backgroundPosition: '0 0, 3px 3px', backgroundSize: '6px 6px' }}
              title={`Fill ${c}`}
            />
          ))}
          <input 
            type="color"
            value={data.color === 'transparent' ? '#ffffff' : (data.color || '#ffffff')}
            onChange={(e) => updateNodeData(nodeId, { color: e.target.value })}
            className="w-5 h-5 p-0 border-0 rounded cursor-pointer bg-transparent"
            title="Custom Fill Color"
          />
        </div>

        <div className="w-px h-5 bg-gray-200 dark:bg-gray-700 shrink-0" />

        {/* Border Color */}
        <div className="flex items-center gap-1 shrink-0">
          <span className="text-[10px] font-bold text-gray-400 dark:text-gray-500 uppercase tracking-wider mr-1">Border</span>
          {borderColors.slice(0, 8).map((c) => (
             <button
               key={c}
               onClick={() => updateNodeData(nodeId, { borderColor: c })}
               className={`w-3.5 h-3.5 rounded-sm border shadow-xs transition-all hover:scale-125 hover:shadow-md ${data.borderColor === c ? 'ring-2 ring-blue-500 ring-offset-1 ring-offset-white dark:ring-offset-slate-800 scale-110' : 'border-gray-300 dark:border-gray-600'}`}
               style={{ backgroundColor: c === 'transparent' ? 'transparent' : c, backgroundImage: c === 'transparent' ? 'repeating-linear-gradient(45deg, #ccc 25%, transparent 25%, transparent 75%, #ccc 75%, #ccc), repeating-linear-gradient(45deg, #ccc 25%, transparent 25%, transparent 75%, #ccc 75%, #ccc)' : 'none', backgroundPosition: '0 0, 3px 3px', backgroundSize: '6px 6px' }}
               title={`Border ${c}`}
             />
          ))}
          <input 
            type="color"
            value={data.borderColor === 'transparent' ? '#000000' : (data.borderColor || '#94a3b8')}
            onChange={(e) => updateNodeData(nodeId, { borderColor: e.target.value })}
            className="w-4 h-4 p-0 border-0 rounded cursor-pointer bg-transparent"
            title="Custom Border Color"
          />
        </div>

        <div className="w-px h-5 bg-gray-200 dark:bg-gray-700 shrink-0" />

        {/* Border Width */}
        <div className="flex items-center gap-1.5 shrink-0">
          <Square size={12} className="text-gray-400" />
          <input
            type="range"
            min="0"
            max="8"
            step="1"
            value={nodeBorderWidth}
            onChange={(e) => updateNodeData(nodeId, { borderWidth: parseInt(e.target.value) })}
            className="w-12 h-1.5 bg-gray-200 dark:bg-slate-600 rounded-full appearance-none cursor-pointer accent-blue-500"
            title={`Border width: ${nodeBorderWidth}px`}
          />
          <span className="text-[10px] font-mono text-gray-400 dark:text-gray-500 w-3 text-right">{nodeBorderWidth}</span>
        </div>

        <div className="w-px h-5 bg-gray-200 dark:bg-gray-700 shrink-0" />

        {/* Node Opacity */}
        <div className="flex items-center gap-1.5 shrink-0">
          <Circle size={12} className="text-gray-400" />
          <input
            type="range"
            min="0.1"
            max="1"
            step="0.1"
            value={nodeOpacity}
            onChange={(e) => updateNodeData(nodeId, { opacity: parseFloat(e.target.value) })}
            className="w-12 h-1.5 bg-gray-200 dark:bg-slate-600 rounded-full appearance-none cursor-pointer accent-blue-500"
            title={`Opacity: ${Math.round(nodeOpacity * 100)}%`}
          />
          <span className="text-[10px] font-mono text-gray-400 dark:text-gray-500 w-6 text-right">{Math.round(nodeOpacity * 100)}%</span>
        </div>

        <div className="w-px h-5 bg-gray-200 dark:bg-gray-700 shrink-0" />

        {/* Tags */}
        <div className="flex items-center gap-1.5 shrink-0">
          <Tag size={12} className="text-gray-400" />
          <input
            type="text"
            placeholder="Add tag..."
            className="w-20 text-xs bg-gray-50 dark:bg-slate-700 border border-gray-200 dark:border-gray-600 rounded-lg px-2 py-0.5 outline-none focus:ring-2 focus:ring-blue-500 text-gray-900 dark:text-gray-100 transition-shadow"
            onKeyDown={(e) => {
              if (e.key === 'Enter' && e.currentTarget.value.trim()) {
                const newTag = e.currentTarget.value.trim();
                const currentTags = data.tags || [];
                if (!currentTags.includes(newTag)) {
                  updateNodeData(nodeId, { tags: [...currentTags, newTag] });
                }
                e.currentTarget.value = '';
              }
            }}
          />
        </div>
        
        <div className="w-px h-5 bg-gray-200 dark:bg-gray-700 shrink-0" />

        {/* Reactions & Voting */}
        <div className="flex items-center gap-1.5 shrink-0">
          {(() => {
            const userVotes = safeReadJSON<string[]>('nodecraft_votes', []);
            const hasVoted = userVotes.includes(nodeId);
            const userReactions = safeReadJSON<Record<string, string[]>>('nodecraft_reactions', {});
            const nodeReactions = userReactions[nodeId] || [];

            return (
              <>
                <button
                  onClick={() => {
                    const newUserVotes = [...userVotes];
                    let newVotes = data.votes || 0;
                    if (hasVoted) {
                      newVotes = Math.max(0, newVotes - 1);
                      const idx = newUserVotes.indexOf(nodeId);
                      if (idx > -1) newUserVotes.splice(idx, 1);
                    } else {
                      newVotes = newVotes + 1;
                      newUserVotes.push(nodeId);
                    }
                    try { localStorage.setItem('nodecraft_votes', JSON.stringify(newUserVotes)); } catch { /* ignore quota */ }
                    updateNodeData(nodeId, { votes: newVotes });
                  }}
                  className={`toolbar-btn px-2 py-0.5 rounded-lg text-xs font-semibold transition-all flex items-center gap-1 ${hasVoted ? 'bg-rose-500 text-white hover:bg-rose-600 shadow-sm' : 'bg-rose-50 hover:bg-rose-100 dark:bg-rose-900/20 dark:hover:bg-rose-900/30 text-rose-500'}`}
                  title={hasVoted ? "Remove Vote" : "Vote (+1)"}
                >
                  <span>❤️</span>
                  <span>{hasVoted ? 'Voted' : 'Vote'}</span>
                </button>

                <div className="relative group/emojis flex items-center">
                  <button className="toolbar-btn px-2 py-0.5 bg-gray-50 hover:bg-gray-100 dark:bg-slate-700 dark:hover:bg-slate-600 text-gray-700 dark:text-gray-300 border border-gray-200 dark:border-gray-600 rounded-lg text-xs font-semibold transition-all">
                    😀 React
                  </button>
                  <div className="absolute top-full left-0 hidden group-hover/emojis:flex pt-1.5 z-50">
                    <div className="flex bg-white dark:bg-slate-800 border border-gray-200 dark:border-gray-700 rounded-xl p-1.5 shadow-xl gap-1 animate-dropdown-in duration-150">
                      {['👍', '❤️', '😮', '🚀', '🎉'].map(emoji => {
                        const hasReacted = nodeReactions.includes(emoji);
                        return (
                          <button
                            key={emoji}
                            onClick={() => {
                              const current = data.reactions || {};
                              const count = current[emoji] || 0;
                              let newCount = count;
                              const newNodeReactions = [...nodeReactions];
                              
                              if (hasReacted) {
                                newCount = Math.max(0, count - 1);
                                const idx = newNodeReactions.indexOf(emoji);
                                if (idx > -1) newNodeReactions.splice(idx, 1);
                              } else {
                                newCount = count + 1;
                                newNodeReactions.push(emoji);
                              }
                              
                              userReactions[nodeId] = newNodeReactions;
                              try { localStorage.setItem('nodecraft_reactions', JSON.stringify(userReactions)); } catch { /* ignore quota */ }
                              
                              const nextReactions = { ...current };
                              if (newCount <= 0) {
                                delete nextReactions[emoji];
                              } else {
                                nextReactions[emoji] = newCount;
                              }
                              updateNodeData(nodeId, { reactions: nextReactions });
                            }}
                            className={`p-1.5 rounded-lg text-sm transition-all hover:scale-125 ${hasReacted ? 'bg-blue-100 dark:bg-blue-900/40 ring-1 ring-blue-400 shadow-sm' : 'hover:bg-gray-100 dark:hover:bg-slate-700'}`}
                          >
                            {emoji}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                </div>
              </>
            );
          })()}
        </div>

        {/* Card Details */}
        {data.shapeType === 'card' && (
          <>
            <div className="w-px h-5 bg-gray-200 dark:bg-gray-700 shrink-0" />
            <div className="flex items-center gap-1.5 shrink-0">
              <select
                value={data.status || 'todo'}
                onChange={(e) => updateNodeData(nodeId, { status: e.target.value as any })}
                className="text-[10px] bg-gray-50 dark:bg-slate-700 border border-gray-200 dark:border-gray-600 rounded-lg px-1.5 py-0.5 outline-none text-gray-900 dark:text-gray-100 font-semibold transition-shadow"
              >
                <option value="todo">To Do</option>
                <option value="in-progress">In Progress</option>
                <option value="done">Done</option>
              </select>

              <input
                type="text"
                value={data.assignee || ''}
                onChange={(e) => updateNodeData(nodeId, { assignee: e.target.value })}
                placeholder="Assignee..."
                className="w-16 text-[10px] bg-gray-50 dark:bg-slate-700 border border-gray-200 dark:border-gray-600 rounded-lg px-1.5 py-0.5 outline-none text-gray-900 dark:text-gray-100 placeholder:text-gray-400 transition-shadow"
              />

              <input
                type="date"
                value={data.dueDate || ''}
                onChange={(e) => updateNodeData(nodeId, { dueDate: e.target.value })}
                className="text-[10px] bg-gray-50 dark:bg-slate-700 border border-gray-200 dark:border-gray-600 rounded-lg px-1.5 py-0.5 outline-none text-gray-900 dark:text-gray-100 transition-shadow"
              />
            </div>
          </>
        )}
      </div>
    </Panel>
  );
}

function AuthorInput({ assignee, nodeId, updateNodeData }: { assignee?: string; nodeId: string; updateNodeData: (id: string, data: Partial<any>) => void }) {
  const [localValue, setLocalValue] = useState(assignee || '');
  
  useEffect(() => {
    setLocalValue(assignee || '');
  }, [assignee]);

  const commit = () => {
    if (localValue !== (assignee || '')) {
      updateNodeData(nodeId, { assignee: localValue });
    }
  };

  return (
    <>
      <div className="w-px h-5 bg-gray-200 dark:bg-gray-700 shrink-0" />
      <input 
        type="text" 
        value={localValue} 
        onChange={(e) => setLocalValue(e.target.value)}
        onBlur={commit}
        onKeyDown={(e) => { if (e.key === 'Enter') { e.currentTarget.blur(); } }}
        placeholder="Author name..."
        className="text-xs px-2 py-1 w-24 bg-gray-100 dark:bg-slate-700 border border-gray-200 dark:border-gray-600 rounded-lg text-gray-700 dark:text-gray-300 focus:outline-none focus:ring-2 focus:ring-blue-500 transition-shadow"
        title="Edit Sticky Note Author"
      />
    </>
  );
}