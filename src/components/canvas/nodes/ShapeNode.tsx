import React, { useState, useEffect, useRef, useMemo, memo } from 'react';
import { Handle, Position } from '@xyflow/react';
import { NodeResizer } from '@xyflow/react';
import type { NodeProps } from '@xyflow/react';
import type { ShapeNodeData, ShapeNode as ShapeNodeType } from '../../../types/diagram';
import { useDiagramStore, getAbsolutePosition } from '../../../store/useDiagramStore';
import { colorGradients } from '../../../constants/colors';
import { useToast } from '../../../context/ToastContext';
import { Image as ImageIcon, Lock, User, Calendar, FileText } from 'lucide-react';

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

function isSafeImageUrl(url: string | undefined): boolean {
  if (!url || typeof url !== 'string') return false;
  const v = url.trim();
  if (v.startsWith('data:image/')) {
    // Must be base64 image, not text/html
    return /^data:image\/(png|jpeg|jpg|gif|webp);base64,/i.test(v) && v.length < 500000;
  }
  if (/^https:\/\//i.test(v)) return v.length < 2000;
  if (/^http:\/\/localhost/i.test(v)) return v.length < 2000;
  return false;
}

const NodeHandles = memo(function NodeHandles({ locked }: { locked?: boolean }) {
  if (locked) return null;
  return (
    <>
      <Handle
        type="source"
        position={Position.Top}
        id="top"
        className="react-flow__handle"
      />
      <Handle
        type="source"
        position={Position.Right}
        id="right"
        className="react-flow__handle"
      />
      <Handle
        type="source"
        position={Position.Bottom}
        id="bottom"
        className="react-flow__handle"
      />
      <Handle
        type="source"
        position={Position.Left}
        id="left"
        className="react-flow__handle"
      />
    </>
  );
});

interface ShapeStyleConfig {
  borderRadius: string;
  gradient?: [string, string];
}

const shapeStyles: Record<string, ShapeStyleConfig> = {
  rectangle: { borderRadius: '8px', gradient: ['#ffffff', '#f1f5f9'] },
  circle: { borderRadius: '50%', gradient: ['#f0f9ff', '#bae6fd'] },
  diamond: { borderRadius: '4px', gradient: ['#fef3c7', '#fde68a'] },
  sticky: { borderRadius: '2px' },
  text: { borderRadius: '4px' },
};

const TagsOverlay = memo(function TagsOverlay({ tags }: { tags?: string[] }) {
  if (!tags || tags.length === 0) return null;
  return (
    <div className="absolute -bottom-2.5 left-2 flex gap-1 z-30 flex-wrap max-w-[90%] pointer-events-none no-print" aria-label="Node tags">
      {tags.map((tag, i) => (
        <div key={i} className="px-1.5 py-0.5 rounded-full text-[9px] font-bold text-white bg-blue-500 shadow-sm border border-blue-600 truncate max-w-[60px] pointer-events-auto" title={tag}>
          {tag}
        </div>
      ))}
    </div>
  );
});

const VoteBadge = memo(function VoteBadge({ id, votes }: { id: string; votes: number }) {
  const updateNodeData = useDiagramStore((state) => state.updateNodeData);
  const [hasVoted, setHasVoted] = useState<boolean>(() => safeReadJSON<string[]>('nodecraft_votes', []).includes(id));

  const handleClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    // Re-read fresh state on click so rapid double-clicks toggle correctly.
    const userVotes = safeReadJSON<string[]>('nodecraft_votes', []);
    const voted = userVotes.includes(id);
    const nextUserVotes = [...userVotes];
    let newVotes = votes;
    if (voted) {
      newVotes = Math.max(0, votes - 1);
      const idx = nextUserVotes.indexOf(id);
      if (idx > -1) nextUserVotes.splice(idx, 1);
    } else {
      newVotes = votes + 1;
      nextUserVotes.push(id);
    }
    try { localStorage.setItem('nodecraft_votes', JSON.stringify(nextUserVotes)); } catch { /* ignore quota */ }
    setHasVoted(!voted);
    updateNodeData(id, { votes: newVotes });
  };

  return (
    <button
      onClick={handleClick}
      className={`absolute -top-3.5 -right-3.5 rounded-full px-2 py-0.5 text-[10px] font-extrabold shadow-md border z-30 transition-transform hover:scale-110 flex items-center gap-0.5 cursor-pointer no-print ${hasVoted ? 'bg-rose-500 border-rose-600 text-white' : 'bg-white dark:bg-slate-800 border-rose-200 dark:border-rose-700 text-rose-500'}`}
      title={hasVoted ? "Remove Vote" : "Click to vote"}
      aria-label={hasVoted ? "Remove vote" : "Click to vote"}
      aria-pressed={hasVoted}
    >
      <span aria-hidden="true">❤️</span> {votes}
    </button>
  );
});

const ReactionsBar = memo(function ReactionsBar({ id, reactions }: { id: string; reactions: Record<string, number> }) {
  const updateNodeData = useDiagramStore((state) => state.updateNodeData);
  const [myReactions, setMyReactions] = useState<string[]>(() => safeReadJSON<Record<string, string[]>>('nodecraft_reactions', {})[id] || []);

  const makeToggle = (emoji: string, count: number) => (e: React.MouseEvent) => {
    e.stopPropagation();
    // Re-read fresh state on click so rapid double-clicks toggle correctly.
    const freshUserReactions = safeReadJSON<Record<string, string[]>>('nodecraft_reactions', {});
    const freshNodeReactions = freshUserReactions[id] || [];
    const reacted = freshNodeReactions.includes(emoji);
    const newNodeReactions = [...freshNodeReactions];
    let newCount = count;
    if (reacted) {
      newCount = Math.max(0, count - 1);
      const idx = newNodeReactions.indexOf(emoji);
      if (idx > -1) newNodeReactions.splice(idx, 1);
    } else {
      newCount = count + 1;
      newNodeReactions.push(emoji);
    }
    freshUserReactions[id] = newNodeReactions;
    try { localStorage.setItem('nodecraft_reactions', JSON.stringify(freshUserReactions)); } catch { /* ignore quota */ }
    setMyReactions([...newNodeReactions]);

    const nextReactions = { ...reactions };
    if (newCount <= 0) {
      delete nextReactions[emoji];
    } else {
      nextReactions[emoji] = newCount;
    }
    updateNodeData(id, { reactions: nextReactions });
  };

  return (
    <div className="absolute -top-6 left-2 flex gap-1 z-30 flex-wrap max-w-[90%] pointer-events-none no-print">
      {Object.entries(reactions).map(([emoji, count]) => {
        if (count <= 0) return null;
        const hasReacted = myReactions.includes(emoji);
        return (
          <button
            key={emoji}
            onClick={makeToggle(emoji, count)}
            className={`px-1.5 py-0.5 rounded-full text-[10px] border shadow-sm font-medium pointer-events-auto hover:scale-105 transition-transform ${hasReacted ? 'bg-blue-500 text-white border-blue-600' : 'bg-white dark:bg-slate-800 border-gray-200 dark:border-gray-700 text-gray-700 dark:text-gray-300'}`}
            aria-pressed={hasReacted}
            aria-label={`React with ${emoji}`}
          >
            <span aria-hidden="true">{emoji}</span> <span className="text-[8px] font-bold opacity-75">{count}</span>
          </button>
        );
      })}
    </div>
  );
});

const Overlays = memo(function Overlays({ id, votes, reactions, tags, notes }: { id: string; votes?: number; reactions?: Record<string, number>; tags?: string[]; notes?: string }) {
  const selectNode = useDiagramStore((state) => state.selectNode);
  return (
    <>
      {/* Notes Indicator */}
      {typeof notes === 'string' && notes.length > 0 && (
        <button
          onClick={(e) => {
            e.stopPropagation();
            selectNode(id);
          }}
          className="absolute -top-3.5 left-2 bg-yellow-400 text-yellow-900 rounded-full p-1 shadow-md border border-yellow-500 z-30 transition-transform hover:scale-110 flex items-center justify-center cursor-pointer no-print group/notebadge"
          title="Contains Markdown Notes"
          aria-label="Contains Markdown Notes"
        >
          <FileText size={12} strokeWidth={2.5} aria-hidden="true" />
          {/* Hover Tooltip */}
          <div className="absolute top-full left-0 mt-1 opacity-0 invisible group-hover/notebadge:opacity-100 group-hover/notebadge:visible transition-all duration-200 bg-white dark:bg-slate-800 border border-gray-200 dark:border-gray-700 shadow-xl rounded-md p-2 w-48 text-xs text-gray-700 dark:text-gray-300 pointer-events-none z-50 text-left overflow-hidden">
            <p className="line-clamp-4 font-normal leading-relaxed text-[10px]">
              {notes}
            </p>
          </div>
        </button>
      )}

      {/* Top Right Vote Badge */}
      {typeof votes === 'number' && votes > 0 && <VoteBadge id={id} votes={votes} />}

      {/* Reactions Overlay */}
      {reactions && Object.keys(reactions).length > 0 && <ReactionsBar id={id} reactions={reactions} />}

      <TagsOverlay tags={tags} />
    </>
  );
});

function ShapeNodeInner({ id, data, selected, width: nodeWidth, height: nodeHeight }: NodeProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [text, setText] = useState((data.label as string) || '');
  const [imageError, setImageError] = useState(false);
  const updateNodeData = useDiagramStore((state) => state.updateNodeData);
  const theme = useDiagramStore((state) => state.theme);
  const { showToast } = useToast();
  // Tracks whether label editing is active so Escape can cancel the edit
  // without committing in-progress text (blur may fire with stale text after unmount).
  const editingRef = useRef(false);
  // textarea ref is used by most shapes (rectangle, sticky, circle, card, image caption).
  const inputRef = useRef<HTMLTextAreaElement>(null);
  // Frame title uses a single-line <input>, so it needs its own ref type.
  const frameInputRef = useRef<HTMLInputElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const shapeData = data as ShapeNodeData;
  const { shapeType, color, borderColor, borderWidth, fontSize, align, bold, italic, textColor, fontFamily, locked, tags, reactions, votes, assignee, dueDate, status, stickerEmoji, notes, rotation } = shapeData;

  const isTextOnly = shapeType === 'text';
  const isDiamond = shapeType === 'diamond';
  const isCircle = shapeType === 'circle';

  const fontFamilyStyle = useMemo(() => {
    switch (fontFamily) {
      case 'serif':
        return 'Georgia, Cambria, "Times New Roman", Times, serif';
      case 'mono':
        return 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Courier New", monospace';
      case 'handwriting':
        return '"Kalam", "Caveat", cursive';
      default: // sans
        return 'system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif';
    }
  }, [fontFamily]);

  const startEditing = () => {
    editingRef.current = true;
    setIsEditing(true);
  };

  const cancelEditing = () => {
    // Escape: restore the original label without committing in-progress text.
    editingRef.current = false;
    const original = (shapeData.label as string) || '';
    setText(original);
    setIsEditing(false);
    updateNodeData(id, { label: original });
  };

  useEffect(() => {
    if (isEditing) {
      // Focus whichever input is mounted (textarea for most shapes, <input> for frame)
      const el = inputRef.current || frameInputRef.current;
      if (el) {
        el.focus();
        if (typeof (el as HTMLTextAreaElement).setSelectionRange === 'function') {
          (el as HTMLTextAreaElement).setSelectionRange(0, el.value.length);
        }
      }
    }
  }, [isEditing]);

  useEffect(() => {
    setText((shapeData.label as string) || '');
  }, [shapeData.label]);

  // Reset the editor if the node's shape type changes while it is mounted.
  useEffect(() => {
    setIsEditing(false);
    editingRef.current = false;
  }, [shapeType]);

  useEffect(() => {
    setImageError(false);
  }, [shapeData.imageUrl]);

  const handleBlur = () => {
    if (!editingRef.current) return;
    editingRef.current = false;
    setIsEditing(false);
    updateNodeData(id, { label: text });
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') {
      e.preventDefault();
      cancelEditing();
      return;
    }
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      inputRef.current?.blur();
    }
  };

  const handleFrameKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') {
      e.preventDefault();
      cancelEditing();
      return;
    }
    if (e.key === 'Enter') {
      e.preventDefault();
      frameInputRef.current?.blur();
    }
  };

  const getStickyFontSize = (textStr: string) => {
    const len = (textStr || '').length;
    if (len < 20) return 18;
    if (len < 60) return 14;
    if (len < 120) return 11;
    return 9;
  };

  const textStyle: React.CSSProperties = useMemo(() => ({
    // For stickies, respect an explicit user-set fontSize first; only auto-size if none.
    fontSize: `${shapeType === 'sticky' ? (fontSize || getStickyFontSize(text || '')) : (fontSize || 14)}px`,
    textAlign: align || 'center',
    fontWeight: bold ? 'bold' : 'normal',
    fontStyle: italic ? 'italic' : 'normal',
    color: shapeType === 'portal' ? '#ffffff' : (textColor || (isTextOnly ? (theme === 'dark' ? '#f8fafc' : '#1e293b') : '#1e293b')),
    lineHeight: 1.4,
    wordBreak: 'break-word' as const,
    width: isDiamond ? '100%' : undefined,
    padding: isDiamond ? '8px' : undefined,
    fontFamily: fontFamilyStyle,
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }), [shapeType, fontSize, text, align, bold, italic, textColor, isTextOnly, theme, isDiamond, fontFamilyStyle]);

  const gradient = colorGradients[color || '#ffffff'] || colorGradients['#ffffff'];
  const shapeStyle = shapeStyles[shapeType] || shapeStyles.rectangle;

  // Standard shapes (rectangle, sticky, text) base style — defined before the
  // per-shape early returns so Hook call order stays stable across shape types.
  const baseStyle: React.CSSProperties = useMemo(() => ({
    background: isTextOnly ? 'transparent' : `linear-gradient(135deg, ${gradient[0]}, ${gradient[1]})`,
    borderColor: isTextOnly ? 'transparent' : (borderColor || '#cbd5e1'),
    borderWidth: isTextOnly ? '0px' : `${borderWidth || 2}px`,
    borderStyle: 'solid',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: shapeType === 'sticky' ? '12px 12px 16px 12px' : '10px',
    boxShadow: selected 
      ? '0 0 0 2px #3b82f6, 0 4px 12px rgba(0, 0, 0, 0.1)' 
      : shapeType === 'sticky'
        ? '2px 3px 8px rgba(0,0,0,0.12), 0 1px 3px rgba(0,0,0,0.08)'
        : '0 2px 8px rgba(0, 0, 0, 0.08), 0 1px 3px rgba(0, 0, 0, 0.06)',
    transition: 'box-shadow 0.2s ease, border-color 0.2s ease',
    width: '100%',
    height: '100%',
    position: 'relative',
  }), [isTextOnly, gradient, borderColor, borderWidth, shapeType, selected]);

  const resolvedShapeStyle: React.CSSProperties = useMemo(() => {
    const shape = { ...baseStyle };

    if (isTextOnly) {
      shape.borderRadius = '4px';
    } else if (shapeType === 'sticky') {
      shape.borderRadius = '2px';
      shape.borderBottomRightRadius = '24px';
      shape.alignItems = 'flex-start';
    } else if (shapeType === 'portal') {
      shape.borderRadius = '50%';
      shape.background = 'radial-gradient(circle at center, #3b82f6 0%, #1e3a8a 50%, #0f172a 100%)';
      shape.border = '2px solid #60a5fa';
      shape.boxShadow = '0 0 30px rgba(59, 130, 246, 0.6), inset 0 0 20px rgba(0, 0, 0, 0.8)';
    } else {
      shape.borderRadius = shapeStyle.borderRadius;
    }

    return shape;
  }, [baseStyle, isTextOnly, shapeType, shapeStyle.borderRadius]);

  // Freehand Pen Drawing shape
  if (shapeType === 'drawing') {
    return (
      <>
        <NodeHandles locked={locked} />

        <NodeResizer 
          color="#3b82f6" 
          isVisible={selected && !locked} 
          minWidth={40} 
          minHeight={40} 
          lineClassName="stroke-blue-500"
        />

        {locked && (
          <div className="absolute -top-2 -right-2 bg-white dark:bg-slate-800 border border-gray-200 dark:border-gray-700 rounded-full p-1 shadow-md z-20 text-amber-500">
            <Lock size={10} strokeWidth={3} aria-hidden="true" />
          </div>
        )}

        <div className="w-full h-full relative pointer-events-none select-none">
          {/* Node width/height live on the node itself (see store), not in data. */}
          <svg 
            width="100%" 
            height="100%" 
            viewBox={`0 0 ${nodeWidth || 100} ${nodeHeight || 80}`}
            preserveAspectRatio="none"
            aria-hidden="true"
          >
            <path
              d={shapeData.svgPath || ''}
              stroke={color || '#3b82f6'}
              strokeWidth={3}
              fill="none"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </div>
      </>
    );
  }

  // FigJam-style Sticker/Stamp shape
  if (shapeType === 'sticker') {
    return (
      <>
        <NodeHandles locked={locked} />

        <NodeResizer 
          color="#3b82f6" 
          isVisible={selected && !locked} 
          minWidth={30} 
          minHeight={30} 
          lineClassName="stroke-blue-500"
        />

        {locked && (
          <div className="absolute -top-2 -right-2 bg-white dark:bg-slate-800 border border-gray-200 dark:border-gray-700 rounded-full p-1 shadow-md z-20 text-amber-500">
            <Lock size={10} strokeWidth={3} aria-hidden="true" />
          </div>
        )}

        <div 
          className="w-full h-full flex items-center justify-center select-none animate-in zoom-in-50 duration-200 leading-none pointer-events-none"
          style={{
            filter: 'drop-shadow(0 4px 8px rgba(0, 0, 0, 0.18)) drop-shadow(0 1px 3px rgba(0, 0, 0, 0.1))',
            transform: typeof rotation === 'number' ? `rotate(${rotation}deg)` : 'rotate(-5deg)',
          }}
          role="img"
          aria-label={`Sticker: ${stickerEmoji || 'star'}`}
        >
          <svg
            viewBox="0 0 100 100"
            className="w-full h-full"
            style={{ overflow: 'visible', pointerEvents: 'none' }}
            preserveAspectRatio="xMidYMid meet"
          >
            <text
              x="50"
              y="54"
              fontSize="78"
              textAnchor="middle"
              dominantBaseline="central"
              fontFamily="system-ui, 'Apple Color Emoji', 'Segoe UI Emoji', 'Noto Color Emoji', sans-serif"
              style={{ userSelect: 'none' }}
            >
              {stickerEmoji || (shapeData.label && shapeData.label !== 'New Node' ? shapeData.label : '⭐')}
            </text>
          </svg>
        </div>
        <Overlays id={id} votes={votes} reactions={reactions} tags={tags} notes={notes} />
      </>
    );
  }

  // Diamond uses SVG polygon for scaling and connection alignment
  if (isDiamond) {
    return (
      <>
        <NodeHandles locked={locked} />
        
        <NodeResizer 
          color="#3b82f6" 
          isVisible={selected && !locked} 
          minWidth={50} 
          minHeight={50} 
          lineClassName="stroke-blue-500"
        />

        {locked && (
          <div className="absolute -top-2 -right-2 bg-white dark:bg-slate-800 border border-gray-200 dark:border-gray-700 rounded-full p-1 shadow-md z-20 text-amber-500">
            <Lock size={10} strokeWidth={3} aria-hidden="true" />
          </div>
        )}

        <div
          style={{
            width: '100%',
            height: '100%',
            position: 'relative',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
          onDoubleClick={() => !locked && startEditing()}
          className="group/node"
        >
          {/* SVG Diamond geometry */}
          <svg viewBox="0 0 100 100" preserveAspectRatio="none" className="absolute inset-0 w-full h-full" style={{ overflow: 'visible' }} aria-hidden="true">
            <defs>
              <linearGradient id={`grad-${id}`} x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stopColor={gradient[0]} />
                <stop offset="100%" stopColor={gradient[1]} />
              </linearGradient>
            </defs>
            <polygon
              points="50,0 100,50 50,100 0,50"
              fill={color === 'transparent' ? 'transparent' : `url(#grad-${id})`}
              stroke={borderColor || '#3b82f6'}
              strokeWidth={borderWidth || 2}
              vectorEffect="non-scaling-stroke"
              style={{
                filter: selected 
                  ? 'drop-shadow(0 0 2px #3b82f6) drop-shadow(0 4px 10px rgba(0, 0, 0, 0.15))'
                  : 'drop-shadow(0 2px 6px rgba(0, 0, 0, 0.08))',
                transition: 'filter 0.2s ease',
              }}
            />
          </svg>

          {/* Inner content container */}
          <div
            style={{
              width: '60%',
              height: '60%',
              display: 'flex',
              alignItems: 'center',
              justifyContent: align === 'left' ? 'flex-start' : align === 'right' ? 'flex-end' : 'center',
              textAlign: align || 'center',
              zIndex: 1,
            }}
          >
            {isEditing ? (
              <textarea
                ref={inputRef}
                value={text}
                onChange={(e) => setText(e.target.value)}
                onBlur={handleBlur}
                onKeyDown={handleKeyDown}
                className="nodrag w-full bg-transparent border-none outline-none resize-none overflow-hidden text-slate-800 dark:text-slate-200"
                style={{ ...textStyle, transform: undefined, width: undefined, padding: undefined }}
                rows={2}
              />
            ) : (
              <div 
                className="select-none pointer-events-none break-words px-1 w-full"
                onDoubleClick={() => !locked && startEditing()}
                style={{ ...textStyle, transform: undefined, width: undefined, padding: undefined }}
              >
                {text || 'Decision'}
              </div>
            )}
          </div>
        </div>
        <Overlays id={id} votes={votes} reactions={reactions} tags={tags} notes={notes} />
      </>
    );
  }

  // Cylinder/Database shape
  if (shapeType === 'cylinder') {
    return (
      <>
        <NodeHandles locked={locked} />
        
        <NodeResizer 
          color="#3b82f6" 
          isVisible={selected && !locked} 
          minWidth={50} 
          minHeight={50} 
          lineClassName="stroke-blue-500"
        />

        {locked && (
          <div className="absolute -top-2 -right-2 bg-white dark:bg-slate-800 border border-gray-200 dark:border-gray-700 rounded-full p-1 shadow-md z-20 text-amber-500">
            <Lock size={10} strokeWidth={3} aria-hidden="true" />
          </div>
        )}

        <div
          style={{
            width: '100%',
            height: '100%',
            position: 'relative',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
          onDoubleClick={() => !locked && startEditing()}
          className="group/node"
        >
          {/* SVG Cylinder geometry */}
          <svg viewBox="0 0 100 100" preserveAspectRatio="none" className="absolute inset-0 w-full h-full" style={{ overflow: 'visible' }} aria-hidden="true">
            <defs>
              <linearGradient id={`cyl-grad-${id}`} x1="0%" y1="0%" x2="0%" y2="100%">
                <stop offset="0%" stopColor={gradient[0]} />
                <stop offset="100%" stopColor={gradient[1] === '#ffffff' ? '#e2e8f0' : gradient[1]} />
              </linearGradient>
              <linearGradient id={`cyl-top-grad-${id}`} x1="0%" y1="0%" x2="0%" y2="100%">
                <stop offset="0%" stopColor="#ffffff" stopOpacity={0.6} />
                <stop offset="100%" stopColor={gradient[0]} />
              </linearGradient>
            </defs>
            {/* Cylinder body */}
            <path
              d="M 0,15 L 0,85 A 50,15 0 0,0 100,85 L 100,15 A 50,15 0 0,0 0,15 Z"
              fill={color === 'transparent' ? 'transparent' : `url(#cyl-grad-${id})`}
              stroke={borderColor || '#64748b'}
              strokeWidth={borderWidth || 2}
              vectorEffect="non-scaling-stroke"
              style={{
                filter: selected 
                  ? 'drop-shadow(0 0 2px #3b82f6) drop-shadow(0 4px 10px rgba(0, 0, 0, 0.15))'
                  : 'drop-shadow(0 2px 6px rgba(0, 0, 0, 0.08))',
                transition: 'filter 0.2s ease',
              }}
            />
            {/* Cylinder top ellipse */}
            <ellipse
              cx="50"
              cy="15"
              rx="50"
              ry="15"
              fill={color === 'transparent' ? 'transparent' : `url(#cyl-top-grad-${id})`}
              stroke={borderColor || '#64748b'}
              strokeWidth={borderWidth || 2}
              vectorEffect="non-scaling-stroke"
            />
            {/* Additional line indicators for layers */}
            <path d="M 0,38 A 50,12 0 0,0 100,38" fill="none" stroke={borderColor || '#64748b'} strokeWidth={borderWidth || 2} strokeOpacity={0.4} vectorEffect="non-scaling-stroke" />
            <path d="M 0,61 A 50,12 0 0,0 100,61" fill="none" stroke={borderColor || '#64748b'} strokeWidth={borderWidth || 2} strokeOpacity={0.4} vectorEffect="non-scaling-stroke" />
          </svg>

          {/* Text content container */}
          <div
            style={{
              width: '80%',
              height: '60%',
              marginTop: '15%', // Push down slightly to clear the top ellipse
              display: 'flex',
              alignItems: 'center',
              justifyContent: align === 'left' ? 'flex-start' : align === 'right' ? 'flex-end' : 'center',
              textAlign: align || 'center',
              zIndex: 1,
            }}
          >
            {isEditing ? (
              <textarea
                ref={inputRef}
                value={text}
                onChange={(e) => setText(e.target.value)}
                onBlur={handleBlur}
                onKeyDown={handleKeyDown}
                className="nodrag w-full bg-transparent border-none outline-none resize-none overflow-hidden text-slate-800 dark:text-slate-200"
                style={textStyle}
                rows={2}
              />
            ) : (
              <div 
                className="select-none pointer-events-none break-words px-1 w-full"
                style={textStyle}
              >
                {text || 'Database'}
              </div>
            )}
          </div>
        </div>
      <Overlays id={id} votes={votes} reactions={reactions} tags={tags} notes={notes} />
      </>
    );
  }

  // Image shape
  if (shapeType === 'image') {
    const handleImageUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
      const file = event.target.files?.[0];
      if (!file) return;
      // Validate file type and size (2MB limit to avoid localStorage blow-up)
      if (!file.type.startsWith('image/')) {
        setImageError(true);
        showToast('Unsupported file type — please select an image', 'error');
        return;
      }
      if (file.size > 2 * 1024 * 1024) {
        setImageError(true);
        showToast('Image too large (max 2 MB)', 'error');
        return;
      }
      const reader = new FileReader();
      reader.onerror = () => {
        setImageError(true);
        showToast('Failed to read image file', 'error');
      };
      reader.onloadend = () => {
        const result = reader.result as string;
        // Only allow data:image base64 (from FileReader) — block other schemes
        if (typeof result === 'string' && result.startsWith('data:image/')) {
          updateNodeData(id, { imageUrl: result });
          setImageError(false);
        } else {
          setImageError(true);
          showToast('Unsupported image data', 'error');
        }
      };
      reader.readAsDataURL(file);
      // Reset input so same file can be re-selected
      event.target.value = '';
    };
    const triggerUpload = () => {
      fileInputRef.current?.click();
    };

    const imageUrl = shapeData.imageUrl;

    return (
      <>
        <NodeHandles locked={locked} />
        
        <NodeResizer 
          color="#3b82f6" 
          isVisible={selected && !locked} 
          minWidth={50} 
          minHeight={50} 
          lineClassName="stroke-blue-500"
        />

        {locked && (
          <div className="absolute -top-2 -right-2 bg-white dark:bg-slate-800 border border-gray-200 dark:border-gray-700 rounded-full p-1 shadow-md z-20 text-amber-500">
            <Lock size={10} strokeWidth={3} aria-hidden="true" />
          </div>
        )}

        <div
          style={{
            width: '100%',
            height: '100%',
            background: color === 'transparent' ? 'transparent' : `linear-gradient(135deg, ${gradient[0]}, ${gradient[1]})`,
            borderColor: color === 'transparent' ? 'transparent' : (borderColor || '#cbd5e1'),
            borderWidth: color === 'transparent' ? 0 : `${borderWidth || 2}px`,
            borderStyle: 'solid',
            borderRadius: '8px',
            boxShadow: selected 
              ? '0 0 0 2px #3b82f6, 0 4px 12px rgba(0, 0, 0, 0.1)' 
              : '0 2px 8px rgba(0, 0, 0, 0.08), 0 1px 3px rgba(0, 0, 0, 0.06)',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            overflow: 'hidden',
            position: 'relative',
          }}
          onDoubleClick={() => !locked && triggerUpload()}
          className="group/node"
        >
          <input
            type="file"
            ref={fileInputRef}
            onChange={handleImageUpload}
            accept="image/*"
            className="hidden"
          />

          {isSafeImageUrl(imageUrl) ? (
            <div className="w-full h-full relative">
              {imageError ? (
                <div className="w-full h-full flex flex-col items-center justify-center p-3 text-red-500 dark:text-red-400 bg-red-50/50 dark:bg-red-950/20">
                  <span className="text-xs font-semibold">Failed to load image</span>
                  <span className="text-[10px] text-gray-500 mt-1">Double-click to change</span>
                </div>
              ) : (
                <img 
                  src={imageUrl as string} 
                  alt="Diagram element" 
                  className="w-full h-full object-cover pointer-events-none"
                  onError={() => setImageError(true)}
                />
              )}
              {/* Image Caption overlay */}
              <div 
                className="absolute bottom-0 left-0 right-0 bg-slate-900/60 backdrop-blur-xs p-1 text-center pointer-events-auto"
                onDoubleClick={(e) => {
                  e.stopPropagation();
                  if (!locked) startEditing();
                }}
              >
                {isEditing ? (
                  <textarea
                    ref={inputRef}
                    value={text}
                    onChange={(e) => setText(e.target.value)}
                    onBlur={handleBlur}
                    onKeyDown={handleKeyDown}
                    className="nodrag w-full bg-transparent border-none outline-none resize-none overflow-hidden text-white text-xs text-center"
                    rows={1}
                  />
                ) : (
                  <div className="text-white text-xs font-medium truncate px-1">
                    {text || 'Double-click to caption'}
                  </div>
                )}
              </div>
            </div>
          ) : (
            <div 
              className="flex flex-col items-center justify-center p-4 cursor-pointer text-gray-400 dark:text-gray-500 hover:text-blue-500 dark:hover:text-blue-400 transition-colors w-full h-full"
              onClick={() => !locked && triggerUpload()}
            >
              <ImageIcon size={32} className="mb-2" />
              <span className="text-xs font-semibold text-center">Double-click to upload</span>
            </div>
          )}
        </div>
      </>
    );
  }

  // Circle shape
  if (isCircle) {
    return (
      <>
        <NodeHandles locked={locked} />
        
        <NodeResizer 
          color="#3b82f6" 
          isVisible={selected && !locked} 
          minWidth={60} 
          minHeight={60} 
          lineClassName="stroke-blue-500"
        />

        {locked && (
          <div className="absolute -top-2 -right-2 bg-white dark:bg-slate-800 border border-gray-200 dark:border-gray-700 rounded-full p-1 shadow-md z-20 text-amber-500">
            <Lock size={10} strokeWidth={3} aria-hidden="true" />
          </div>
        )}

        <div
          style={{
            width: '100%',
            height: '100%',
            background: `linear-gradient(135deg, ${gradient[0]}, ${gradient[1]})`,
            borderColor: borderColor || '#3b82f6',
            borderWidth: `${borderWidth || 2}px`,
            borderStyle: 'solid',
            borderRadius: '50%',
            boxShadow: selected 
              ? '0 0 0 2px #3b82f6, 0 4px 12px rgba(0, 0, 0, 0.1)' 
              : '0 2px 8px rgba(0, 0, 0, 0.08), 0 1px 3px rgba(0, 0, 0, 0.06)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '12px',
            transition: 'box-shadow 0.2s ease, border-color 0.2s ease',
            position: 'relative',
          }}
          onDoubleClick={() => !locked && startEditing()}
          className="group/node"
        >
          {isEditing ? (
            <textarea
              ref={inputRef}
              value={text}
              onChange={(e) => setText(e.target.value)}
              onBlur={handleBlur}
              onKeyDown={handleKeyDown}
              placeholder="Circle"
              className="nodrag w-full bg-transparent border-none outline-none resize-none overflow-hidden text-slate-800 dark:text-slate-200 text-center"
              style={textStyle}
              rows={2}
            />
          ) : (
            <div 
              className="select-none pointer-events-none break-words text-center px-2"
              style={textStyle}
            >
              {text || 'Circle'}
            </div>
          )}
        </div>
        <Overlays id={id} votes={votes} reactions={reactions} tags={tags} notes={notes} />
      </>
    );
  }



  // Frame/Container shape
  if (shapeType === 'frame') {
    return (
      <>
        <NodeResizer 
          color="#8b5cf6" 
          isVisible={selected && !locked} 
          minWidth={100} 
          minHeight={100} 
          lineClassName="stroke-purple-500"
        />
        
        {locked && (
          <div className="absolute -top-2 -right-2 bg-white dark:bg-slate-800 border border-gray-200 dark:border-gray-700 rounded-full p-1 shadow-md z-20 text-amber-500">
            <Lock size={10} strokeWidth={3} aria-hidden="true" />
          </div>
        )}

        <div
          style={{
            width: '100%',
            height: '100%',
            border: `${borderWidth || 4}px dashed ${borderColor || '#94a3b8'}`,
            borderRadius: '12px',
            background: color || 'transparent',
            display: 'flex',
            flexDirection: 'column',
            position: 'relative',
            pointerEvents: 'none',
          }}
          className="group/node"
        >
          {/* Frame Title Tab */}
          <div 
            style={{
              background: borderColor || '#94a3b8',
              color: '#ffffff',
              padding: '6px 16px',
              borderTopLeftRadius: '8px',
              borderBottomRightRadius: '8px',
              display: 'inline-block',
              alignSelf: 'flex-start',
              fontWeight: 700,
              pointerEvents: 'auto',
              cursor: 'move',
            }}
            onDoubleClick={() => !locked && startEditing()}
          >
            {isEditing ? (
              <input
                ref={frameInputRef}
                value={text}
                onChange={(e) => setText(e.target.value)}
                onBlur={handleBlur}
                onKeyDown={handleFrameKeyDown}
                className="nodrag bg-transparent border-none outline-none text-white font-bold w-full"
                style={{ fontSize: `${fontSize || 18}px`, fontFamily: fontFamilyStyle }}
              />
            ) : (
              <span style={{ fontSize: `${fontSize || 18}px`, fontFamily: fontFamilyStyle }}>
                {text}
              </span>
            )}
          </div>
        </div>
        <Overlays id={id} votes={votes} reactions={reactions} tags={tags} notes={notes} />
      </>
    );
  }

  // Jira Task Card Shape
  if (shapeType === 'card') {
    const statusColors = {
      todo: '#ef4444',
      'in-progress': '#f59e0b',
      done: '#10b981'
    };
    const cardBorderColor = statusColors[status as keyof typeof statusColors] || '#cbd5e1';

    return (
      <>
        <NodeHandles locked={locked} />

        <NodeResizer 
          color="#10b981" 
          isVisible={selected && !locked} 
          minWidth={150} 
          minHeight={90} 
          lineClassName="stroke-emerald-500"
        />

        {locked && (
          <div className="absolute -top-2 -right-2 bg-white dark:bg-slate-800 border border-gray-200 dark:border-gray-700 rounded-full p-1 shadow-md z-20 text-amber-500">
            <Lock size={10} strokeWidth={3} aria-hidden="true" />
          </div>
        )}

        <div
          style={{
            width: '100%',
            height: '100%',
            background: color || '#ffffff',
            border: `1px solid ${selected ? '#3b82f6' : '#e2e8f0'}`,
            borderLeft: `5px solid ${cardBorderColor}`,
            borderRadius: '8px',
            boxShadow: selected ? '0 0 0 2px #3b82f6, 0 4px 12px rgba(0,0,0,0.1)' : '0 2px 8px rgba(0,0,0,0.08)',
            display: 'flex',
            flexDirection: 'column',
            padding: '10px',
            position: 'relative',
            textAlign: 'left'
          }}
          onDoubleClick={() => !locked && startEditing()}
          className="dark:bg-slate-800 dark:border-slate-700"
        >
          {/* Header row */}
          <div className="flex justify-between items-center mb-1 text-[9px] font-bold text-gray-400 uppercase tracking-wider">
            <span>Task ID</span>
            <span 
              className="px-1.5 py-0.5 rounded text-[8px]" 
              style={{ 
                backgroundColor: `${cardBorderColor}20`, 
                color: cardBorderColor, 
                border: `1px solid ${cardBorderColor}40` 
              }}
            >
              {status || 'To Do'}
            </span>
          </div>

          {/* Title Area */}
          <div className="flex-1 min-w-0 pr-1">
            {isEditing ? (
              <textarea
                ref={inputRef}
                value={text}
                onChange={(e) => setText(e.target.value)}
                onBlur={handleBlur}
                onKeyDown={handleKeyDown}
                placeholder="Task Card"
                className="nodrag w-full bg-transparent border-none outline-none resize-none overflow-hidden text-gray-800 dark:text-gray-200 font-semibold"
                style={{ fontSize: `${fontSize || 12}px`, fontFamily: fontFamilyStyle }}
                rows={2}
              />
            ) : (
              <div 
                style={{ fontSize: `${fontSize || 12}px`, fontFamily: fontFamilyStyle }} 
                className="select-none pointer-events-none break-words font-semibold text-gray-800 dark:text-gray-200 line-clamp-2"
              >
                {text || 'Task Card'}
              </div>
            )}
          </div>

          <div className="h-px bg-gray-100 dark:bg-gray-700 my-1.5" />

          {/* Footer Metadata */}
          <div className="flex justify-between items-center text-[10px] text-gray-500 dark:text-gray-400">
            <div className="flex items-center gap-1 min-w-0">
              <User size={12} className="shrink-0" />
              <span className="truncate">{assignee || 'Unassigned'}</span>
            </div>
            {dueDate && (
              <div className="flex items-center gap-1 shrink-0">
                <Calendar size={12} />
                <span>{dueDate}</span>
              </div>
            )}
          </div>
        </div>

        <Overlays id={id} votes={votes} reactions={reactions} tags={tags} notes={notes} />
      </>
    );
  }

  return (
    <>
      {!isTextOnly && <NodeHandles locked={locked} />}
      
      <NodeResizer 
        color="#3b82f6" 
        isVisible={selected && !locked} 
        minWidth={isTextOnly ? 30 : 50} 
        minHeight={isTextOnly ? 20 : 30} 
        lineClassName="stroke-blue-500"
      />

      {locked && (
        <div className="absolute -top-2 -right-2 bg-white dark:bg-slate-800 border border-gray-200 dark:border-gray-700 rounded-full p-1 shadow-md z-20 text-amber-500">
          <Lock size={10} strokeWidth={3} aria-hidden="true" />
        </div>
      )}

      <div
        style={resolvedShapeStyle}
        onDoubleClick={() => {
          if (shapeType === 'portal') {
            useDiagramStore.getState().setActiveCanvasId(id);
          } else if (!locked) {
            startEditing();
          }
        }}
        className="group/node"
      >
        <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: align === 'left' ? 'flex-start' : align === 'right' ? 'flex-end' : 'center' }}>
          {isEditing ? (
            <textarea
              ref={inputRef}
              value={text}
              onChange={(e) => setText(e.target.value)}
              onBlur={handleBlur}
              onKeyDown={handleKeyDown}
              placeholder={shapeType === 'sticky' ? 'Sticky Note' : shapeType === 'portal' ? 'Portal' : shapeType === 'text' ? 'Text' : 'Rectangle'}
              className="nodrag w-full bg-transparent border-none outline-none resize-none overflow-hidden text-slate-800 dark:text-slate-200"
              style={{ ...textStyle, textAlign: align || 'center' }}
              rows={3}
            />
          ) : (
            <div 
              style={textStyle} 
              className="select-none pointer-events-auto nodrag break-words w-full px-2 cursor-text"
              onDoubleClick={(e) => {
                e.stopPropagation();
                if (shapeType === 'portal') {
                  useDiagramStore.getState().setActiveCanvasId(id);
                } else if (!locked) {
                  startEditing();
                }
              }}
            >
              {text || (shapeType === 'sticky' ? 'Sticky Note' : shapeType === 'portal' ? 'Portal' : shapeType === 'text' ? 'Text' : 'Rectangle')}
            </div>
          )}
        </div>

        {/* Sticky Note Author Footer */}
        {shapeType === 'sticky' && assignee && (
          <div className="absolute -bottom-1 -right-1 bg-amber-200 border border-amber-300 text-amber-800 text-[9px] font-bold px-1.5 py-0.5 rounded shadow-sm z-30 pointer-events-none no-print truncate max-w-[80px]">
            {assignee}
          </div>
        )}
      </div>

      {/* Idea Orbits */}
      {shapeData.ideaOrbits && shapeData.ideaOrbits.length > 0 && (
        <div className="absolute inset-0 pointer-events-none z-50 flex items-center justify-center">
          {shapeData.ideaOrbits.map((idea, index) => {
            const delay = (index * 10) / (shapeData.ideaOrbits?.length || 1);
            const detachIdea = () => {
              const newOrbits = (shapeData.ideaOrbits || []).filter((_, i) => i !== index);
              updateNodeData(id, { ideaOrbits: newOrbits });

              const allNodes = useDiagramStore.getState().nodes;
              const node = allNodes.find(n => n.id === id);
              if (!node) return;

              const absPos = getAbsolutePosition(node, allNodes);
              useDiagramStore.getState().addNode('sticky', {
                x: absPos.x + 150 + (Math.random() * 50),
                y: absPos.y + (Math.random() * 100 - 50)
              }, { label: idea });
            };
            return (
              <div 
                key={`${idea}-${index}`}
                className="absolute orbit-pill pointer-events-auto cursor-pointer group/orbit"
                style={{ animationDelay: `-${delay}s` }}
                role="button"
                tabIndex={0}
                aria-label={`Detach idea "${idea}" and spawn a sticky note`}
                onClick={(e) => {
                  e.stopPropagation();
                  detachIdea();
                }}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault();
                  e.stopPropagation();
                  detachIdea();
                }
              }}
              >
                <div className="bg-purple-100 dark:bg-purple-900 border border-purple-300 dark:border-purple-700 text-purple-800 dark:text-purple-200 text-[10px] font-semibold px-2 py-1 rounded-full shadow-md hover:scale-110 hover:bg-purple-200 dark:hover:bg-purple-800 transition-all whitespace-nowrap">
                  <span aria-hidden="true">✨</span> {idea}
                </div>
              </div>
            );
          })}
        </div>
      )}

      <Overlays id={id} votes={votes} reactions={reactions} tags={tags} notes={notes} />
    </>
  );
}

function ShapeNodeBase(props: NodeProps) {
  const activeFilterTag = useDiagramStore((state) => state.activeFilterTag);
  const data = props.data as ShapeNodeData;
  const tags = (data?.tags as string[] | undefined) || [];
  const isDimmed = activeFilterTag ? !tags.includes(activeFilterTag) : false;
  const userOpacity = typeof data?.opacity === 'number' ? data.opacity : 1;
  const combinedOpacity = (isDimmed ? 0.15 : 1) * userOpacity;

  // CRITICAL: do NOT use `display: 'contents'` here.
  // It removes the element's box, which silently breaks `opacity` and
  // `pointerEvents` — the tag-filter dimming feature is completely broken
  // with `display: contents`. Use a normal block wrapper that still allows
  // the inner ShapeNodeInner to position absolute handles/resizer correctly
  // (React Flow node wrapper already provides the positioning context).
  return (
    <div
      style={{
        opacity: combinedOpacity,
        pointerEvents: isDimmed ? 'none' : 'auto',
        transition: 'opacity 0.3s ease',
        width: '100%',
        height: '100%',
        position: 'relative',
      }}
    >
      <ShapeNodeInner {...props} />
    </div>
  );
}

export const ShapeNode = memo(ShapeNodeBase);

// Re-export the ShapeNodeType alias for consumers that need it.
export type { ShapeNodeType };
