import React, { useCallback, useRef, useEffect, useState, useMemo } from 'react';
import {
  ReactFlow,
  Background,
  MiniMap,
  ReactFlowProvider,
  useReactFlow,
  SelectionMode,
  BackgroundVariant,
  Panel,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';

import { useDiagramStore, getAbsolutePosition } from '../../store/useDiagramStore';
import { ShapeNode } from './nodes/ShapeNode';
import type { ShapeType, ShapeNodeData } from '../../types/diagram';
import { ContextToolbar } from './ContextToolbar';
import { MultiSelectToolbar } from './MultiSelectToolbar';


import { TimerWidget } from './TimerWidget';
import { ShortcutsModal } from '../ui/ShortcutsModal';
import { useToast } from '../../context/ToastContext';
import { Presentation, Notebook, Users, Zap, ChevronLeft, Pencil, Eraser } from 'lucide-react';

// Store reference to ReactFlow instance
let reactFlowInstance: ReturnType<typeof useReactFlow> | null = null;

function getReactFlowInstance() {
  return reactFlowInstance;
}

// Custom hook to store the ReactFlow instance
function useStoreReactFlowInstance() {
  const rf = useReactFlow();
  useEffect(() => {
    reactFlowInstance = rf;
    useDiagramStore.getState().setReactFlowInstance(rf);
  }, [rf]);
}

const renderMarkdown = (md: string) => {
  if (!md.trim()) return '<p class="text-gray-400 italic text-xs">No notes yet. Type something in the Edit tab!</p>';
  let html = md
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
  html = html.replace(/^# (.*$)/gim, '<h1 class="text-base font-bold text-gray-900 dark:text-white border-b border-gray-200 dark:border-gray-700 pb-1 mt-3 mb-1.5">$1</h1>');
  html = html.replace(/^## (.*$)/gim, '<h2 class="text-sm font-bold text-gray-800 dark:text-gray-200 mt-2.5 mb-1">$1</h2>');
  html = html.replace(/^### (.*$)/gim, '<h3 class="text-xs font-bold text-gray-700 dark:text-gray-300 mt-2 mb-0.5">$1</h3>');
  html = html.replace(/\*\*(.*?)\*\*/gim, '<strong class="font-bold text-gray-900 dark:text-white">$1</strong>');
  html = html.replace(/\*(.*?)\*/gim, '<em class="italic">$1</em>');
  html = html.replace(/^\> (.*$)/gim, '<blockquote class="border-l-4 border-blue-500 pl-2 text-gray-500 dark:text-gray-400 italic my-2">$1</blockquote>');
  html = html.replace(/^\- (.*$)/gim, '<li class="list-disc ml-4 text-xs text-gray-700 dark:text-gray-300 my-1">$1</li>');
  html = html.replace(/\n$/gim, '<br />');
  const lines = html.split('\n');
  const processed = lines.map(line => {
    if (!line.trim()) return '<div class="h-2"></div>';
    if (line.startsWith('<h') || line.startsWith('<li') || line.startsWith('<blockquote') || line.startsWith('<div')) return line;
    return `<p class="text-xs text-gray-600 dark:text-gray-300 leading-relaxed my-1.5">${line}</p>`;
  });
  return processed.join('');
};

const nodeTypes = {
  shape: ShapeNode,
};

function CanvasContent() {
  // Use individual selectors (or useShallow) instead of destructuring the whole
  // store — destructuring the whole store causes Canvas to re-render on every
  // single state change (zoom, pan, theme toggle, notes typing, etc.).
  const nodes = useDiagramStore((s) => s.nodes);
  const edges = useDiagramStore((s) => s.edges);
  const onNodesChange = useDiagramStore((s) => s.onNodesChange);
  const onEdgesChange = useDiagramStore((s) => s.onEdgesChange);
  const onConnect = useDiagramStore((s) => s.onConnect);
  const addNode = useDiagramStore((s) => s.addNode);
  const addChildNode = useDiagramStore((s) => s.addChildNode);
  const addSiblingNode = useDiagramStore((s) => s.addSiblingNode);
  const theme = useDiagramStore((s) => s.theme);
  const snapToGrid = useDiagramStore((s) => s.snapToGrid);
  const gridSize = useDiagramStore((s) => s.gridSize);
  const toggleSnapToGrid = useDiagramStore((s) => s.toggleSnapToGrid);
  const setGridSize = useDiagramStore((s) => s.setGridSize);
  const showHelpModal = useDiagramStore((s) => s.showHelpModal);
  const setShowHelpModal = useDiagramStore((s) => s.setShowHelpModal);
  const gridType = useDiagramStore((s) => s.gridType);
  const setGridType = useDiagramStore((s) => s.setGridType);
  const presentationMode = useDiagramStore((s) => s.presentationMode);
  const setPresentationMode = useDiagramStore((s) => s.setPresentationMode);
  const canvasColor = useDiagramStore((s) => s.canvasColor);
  const setCanvasColor = useDiagramStore((s) => s.setCanvasColor);
  const updateNodeData = useDiagramStore((s) => s.updateNodeData);
  const activeCanvasId = useDiagramStore((s) => s.activeCanvasId);
  const setActiveCanvasId = useDiagramStore((s) => s.setActiveCanvasId);
  const isAnimatingLayout = useDiagramStore((s) => s.isAnimatingLayout);
  const isLocked = useDiagramStore((s) => s.isLocked);
  const selectNode = useDiagramStore((s) => s.selectNode);
  
  const visibleNodes = useMemo(() => {
    if (!activeCanvasId) return nodes.filter(n => !(n.data as ShapeNodeData).portalId);
    return nodes.filter(n => (n.data as ShapeNodeData).portalId === activeCanvasId);
  }, [nodes, activeCanvasId]);

  const visibleEdges = useMemo(() => {
    const visibleNodeIds = new Set(visibleNodes.map(n => n.id));
    return edges.filter(e => visibleNodeIds.has(e.source) && visibleNodeIds.has(e.target));
  }, [edges, visibleNodes]);
  const reactFlowWrapper = useRef<HTMLDivElement>(null);
  const gridSettingsRef = useRef<HTMLDivElement>(null);
  const { screenToFlowPosition, getNodes } = useReactFlow();
  const [showGridSettings, setShowGridSettings] = useState(false);
  const [interactionMode, setInteractionMode] = useState<'pan' | 'select' | 'laser' | 'pen' | 'eraser'>('pan');
  const [presentationLaser, setPresentationLaser] = useState(false);
  const [simulateCollaborators, setSimulateCollaborators] = useState(false);
  const [showNotepad, setShowNotepad] = useState(false);
  const [notepadSection, setNotepadSection] = useState<'board' | 'shape' | 'outline'>('board');
  const [notepadTab, setNotepadTab] = useState<'edit' | 'preview'>('edit');
  const [spacePressed, setSpacePressed] = useState(false);
  // Ref mirror so mouse handlers in the laser/pen effect don't need spacePressed
  // in their deps (avoids tearing down & re-attaching listeners mid-stroke).
  const spacePressedRef = useRef(false);
  useEffect(() => { spacePressedRef.current = spacePressed; }, [spacePressed]);

  const effectiveInteractionMode = presentationMode ? (presentationLaser ? 'laser' : 'pan') : interactionMode;
  // Ref mirror for the same reason — the laser/pen effect deps below.
  const effectiveModeRef = useRef(effectiveInteractionMode);
  useEffect(() => { effectiveModeRef.current = effectiveInteractionMode; }, [effectiveInteractionMode]);

  const boardNotes = useDiagramStore(state => state.boardNotes);
  const setBoardNotes = useDiagramStore(state => state.setBoardNotes);
  const { showToast } = useToast();

  // Laser Pointer drawing state
  const laserCanvasRef = useRef<HTMLCanvasElement>(null);
  const laserPoints = useRef<{ x: number; y: number; age: number }[]>([]);

  // Simulated Collaborators cursor coordinates
  const [collabCursors, setCollabCursors] = useState([
    { id: '1', name: 'Sarah', color: '#8b5cf6', x: 400, y: 300 },
    { id: '2', name: 'Alex', color: '#10b981', x: 600, y: 400 }
  ]);

  // Freehand Pen & Laser Pointer drawing on parent wrapper
  useEffect(() => {
    if (effectiveInteractionMode !== 'laser' && effectiveInteractionMode !== 'pen' && effectiveInteractionMode !== 'eraser') return;
    const wrapper = reactFlowWrapper.current;
    const canvas = laserCanvasRef.current;
    if (!wrapper || !canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let isDrawing = false;
    let localPoints: { x: number; y: number }[] = [];

    // Redraw loop
    let animFrame: number;
    const render = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      
      if (effectiveModeRef.current === 'laser') {
        const points = laserPoints.current;
        if (points.length > 1) {
          ctx.beginPath();
          ctx.moveTo(points[0].x, points[0].y);
          for (let i = 1; i < points.length; i++) {
            const xc = (points[i].x + points[i - 1].x) / 2;
            const yc = (points[i].y + points[i - 1].y) / 2;
            ctx.quadraticCurveTo(points[i - 1].x, points[i - 1].y, xc, yc);
          }
          ctx.strokeStyle = '#ef4444';
          ctx.lineWidth = 4;
          ctx.lineCap = 'round';
          ctx.lineJoin = 'round';
          ctx.shadowColor = '#ef4444';
          ctx.shadowBlur = 10;
          ctx.stroke();
        }
        laserPoints.current = points
          .map(p => ({ ...p, age: p.age + 1 }))
          .filter(p => p.age < 25);
      } else if (effectiveModeRef.current === 'pen' || effectiveModeRef.current === 'eraser') {
        // Pen Mode: draw all captured path points
        if (localPoints.length > 1) {
          ctx.beginPath();
          ctx.moveTo(localPoints[0].x, localPoints[0].y);
          for (let i = 1; i < localPoints.length; i++) {
            const xc = (localPoints[i].x + localPoints[i - 1].x) / 2;
            const yc = (localPoints[i].y + localPoints[i - 1].y) / 2;
            ctx.quadraticCurveTo(localPoints[i - 1].x, localPoints[i - 1].y, xc, yc);
          }
          ctx.strokeStyle = effectiveModeRef.current === 'eraser' ? '#ec4899' : '#3b82f6';
          ctx.lineWidth = effectiveModeRef.current === 'eraser' ? 12 : 3;
          ctx.lineCap = 'round';
          ctx.lineJoin = 'round';
          ctx.shadowBlur = 0;
          ctx.stroke();
        }
      }

      animFrame = requestAnimationFrame(render);
    };

    const resizeCanvas = () => {
      if (canvas && canvas.parentElement) {
        canvas.width = canvas.parentElement.clientWidth;
        canvas.height = canvas.parentElement.clientHeight;
      }
    };
    resizeCanvas();
    window.addEventListener('resize', resizeCanvas);
    render();

    const handleMouseDown = (e: MouseEvent) => {
      if (e.button === 0 && !spacePressedRef.current) {
        if (effectiveModeRef.current === 'laser' || effectiveModeRef.current === 'pen' || effectiveModeRef.current === 'eraser') {
          e.stopPropagation();
        }
        isDrawing = true;
        const rect = wrapper.getBoundingClientRect();
        const p = { x: e.clientX - rect.left, y: e.clientY - rect.top };
        
        if (effectiveModeRef.current === 'laser') {
          laserPoints.current.push({ ...p, age: 0 });
        } else {
          localPoints = [p];
        }
      }
    };

    const handleMouseMove = (e: MouseEvent) => {
      if (isDrawing && !spacePressedRef.current) {
        if (effectiveModeRef.current === 'laser' || effectiveModeRef.current === 'pen' || effectiveModeRef.current === 'eraser') {
          e.stopPropagation();
        }
        const rect = wrapper.getBoundingClientRect();
        const p = { x: e.clientX - rect.left, y: e.clientY - rect.top };
        
        if (effectiveModeRef.current === 'laser') {
          laserPoints.current.push({ ...p, age: 0 });
        } else {
          localPoints.push(p);

          if (effectiveModeRef.current === 'eraser' && getReactFlowInstance()) {
            const rf = getReactFlowInstance();
            if (rf) {
              const flowP = rf.screenToFlowPosition({ x: e.clientX, y: e.clientY });
              const currentNodes = useDiagramStore.getState().nodes;
              const nodeToDelete = currentNodes.find(node => {
                const absPos = getAbsolutePosition(node, currentNodes);
                const w = node.width || (node.data as any)?.width || 100;
                const h = node.height || (node.data as any)?.height || 100;
                return flowP.x >= absPos.x && flowP.x <= absPos.x + w && flowP.y >= absPos.y && flowP.y <= absPos.y + h;
              });
              
              if (nodeToDelete) {
                useDiagramStore.getState().onNodesChange([{ type: 'remove', id: nodeToDelete.id }]);
              }
              
              // Re-fetch nodes after potential deletion for accurate edge hit-testing
              const freshNodes = useDiagramStore.getState().nodes;
              const currentEdges = useDiagramStore.getState().edges;
              const edgeToDelete = currentEdges.find(edge => {
                const sourceNode = freshNodes.find(n => n.id === edge.source);
                const targetNode = freshNodes.find(n => n.id === edge.target);
                if (!sourceNode || !targetNode) return false;
                
                const sourceAbs = getAbsolutePosition(sourceNode, freshNodes);
                const targetAbs = getAbsolutePosition(targetNode, freshNodes);
                const x1 = sourceAbs.x + (sourceNode.width || (sourceNode.data as any)?.width || 100) / 2;
                const y1 = sourceAbs.y + (sourceNode.height || (sourceNode.data as any)?.height || 100) / 2;
                const x2 = targetAbs.x + (targetNode.width || (targetNode.data as any)?.width || 100) / 2;
                const y2 = targetAbs.y + (targetNode.height || (targetNode.data as any)?.height || 100) / 2;
                
                const A = flowP.x - x1;
                const B = flowP.y - y1;
                const C = x2 - x1;
                const D = y2 - y1;
                
                const dot = A * C + B * D;
                const len_sq = C * C + D * D;
                let param = -1;
                if (len_sq !== 0) param = dot / len_sq;
                
                let xx, yy;
                if (param < 0) {
                  xx = x1; yy = y1;
                } else if (param > 1) {
                  xx = x2; yy = y2;
                } else {
                  xx = x1 + param * C;
                  yy = y1 + param * D;
                }
                
                const dx = flowP.x - xx;
                const dy = flowP.y - yy;
                const distance = Math.sqrt(dx * dx + dy * dy);
                
                return distance < 20;
              });
              
              if (edgeToDelete) {
                useDiagramStore.getState().onEdgesChange([{ type: 'remove', id: edgeToDelete.id }]);
              }
            }
          }
        }
      }
    };

    const handleMouseUp = (e: MouseEvent) => {
      if (e.button === 0 && isDrawing) {
        isDrawing = false;
        
        // If in Pen Mode, save drawing path to store
        if (effectiveModeRef.current === 'pen' && localPoints.length > 2) {
          const rect = wrapper.getBoundingClientRect();
          let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
          
          localPoints.forEach(p => {
            if (p.x < minX) minX = p.x;
            if (p.x > maxX) maxX = p.x;
            if (p.y < minY) minY = p.y;
            if (p.y > maxY) maxY = p.y;
          });

          // Add padding
          minX -= 5;
          minY -= 5;
          maxX += 5;
          maxY += 5;


          // Get reactFlowWrapper coordinates
          const rf = getReactFlowInstance();
          if (rf) {
            const flowMin = rf.screenToFlowPosition({ x: minX + rect.left, y: minY + rect.top });
            const flowMax = rf.screenToFlowPosition({ x: maxX + rect.left, y: maxY + rect.top });
            const flowW = flowMax.x - flowMin.x;
            const flowH = flowMax.y - flowMin.y;

            // Generate normalized SVG path relative to bounding box
            const flowPoints = localPoints.map(p => rf.screenToFlowPosition({ x: p.x + rect.left, y: p.y + rect.top }));
            let pathStr = `M ${flowPoints[0].x - flowMin.x} ${flowPoints[0].y - flowMin.y}`;
            for (let i = 1; i < flowPoints.length; i++) {
              pathStr += ` L ${flowPoints[i].x - flowMin.x} ${flowPoints[i].y - flowMin.y}`;
            }

            // Add persistent node!
            useDiagramStore.getState().addNode('drawing', flowMin, {
              svgPath: pathStr,
              color: '#3b82f6',
              width: flowW,
              height: flowH,
              label: 'Pen Sketch'
            });
            showToast('Sketch saved to canvas', 'success');
          }
        }
        
        localPoints = [];
      }
    };

    wrapper.addEventListener('mousedown', handleMouseDown, { capture: true });
    wrapper.addEventListener('mousemove', handleMouseMove, { capture: true });
    window.addEventListener('mouseup', handleMouseUp, { capture: true });

    return () => {
      cancelAnimationFrame(animFrame);
      window.removeEventListener('resize', resizeCanvas);
      wrapper.removeEventListener('mousedown', handleMouseDown, { capture: true });
      wrapper.removeEventListener('mousemove', handleMouseMove, { capture: true });
      window.removeEventListener('mouseup', handleMouseUp, { capture: true });
    };
  // deps: only `effectiveInteractionMode` (to (re)attach when entering/leaving a drawing mode) and `showToast`.
  // spacePressed is read from its ref mirror so the listener doesn't tear down mid-stroke.
  }, [effectiveInteractionMode, showToast]);

  useEffect(() => {
    if (!simulateCollaborators) return;
    const interval = setInterval(() => {
      setCollabCursors(prev =>
        prev.map(c => {
          const dx = (Math.random() - 0.5) * 60;
          const dy = (Math.random() - 0.5) * 60;
          return {
            ...c,
            x: Math.max(100, Math.min(window.innerWidth - 350, c.x + dx)),
            y: Math.max(100, Math.min(window.innerHeight - 150, c.y + dy))
          };
        })
      );
    }, 200);
    return () => clearInterval(interval);
  }, [simulateCollaborators]);

  // Spacebar pan listener
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.code === 'Space') {
        if (e.repeat) return; // don't toggle repeatedly while held
        if (useDiagramStore.getState().presentationMode) return;
        const target = e.target as HTMLElement | null;
        if (target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.tagName === 'SELECT' || target.isContentEditable)) {
          return;
        }
        e.preventDefault(); // otherwise Space activates focused buttons
        setSpacePressed(true);
      }
    };
    const handleKeyUp = (e: KeyboardEvent) => {
      if (e.code === 'Space') {
        setSpacePressed(false);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
    };
  }, []);



  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (gridSettingsRef.current && !gridSettingsRef.current.contains(event.target as Node)) {
        setShowGridSettings(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  // Store ReactFlow instance for paste image functionality
  useStoreReactFlowInstance();
  const reactFlowInstance = useDiagramStore((state) => state.reactFlowInstance);

  // Auto-zoom to the "Start Here" node on first load so users see it centered
  useEffect(() => {
    if (!reactFlowInstance || nodes.length === 0) return;
    const startNode = nodes.find(
      (n) => (n.data as ShapeNodeData).label === 'Start Here' && n.type === 'shape'
    );
    if (!startNode) return;

    // Read the initial viewport first so fitView doesn't override our zoom.
    const rfInst = reactFlowInstance;
    let timer: ReturnType<typeof setTimeout>;
    try { timer = setTimeout(() => {
      // Walk parentId chain for correct absolute position (child nodes are relative to parent)
      let absX = startNode.position.x, absY = startNode.position.y;
      let cur: typeof startNode = startNode;
      const visited = new Set<string>([startNode.id]);
      while (cur.parentId) {
        if (visited.has(cur.parentId)) break;
        visited.add(cur.parentId);
        const parent = nodes.find((n: any) => n.id === cur.parentId);
        if (!parent) break;
        absX += parent.position.x; absY += parent.position.y; cur = parent;
      }
      const w = startNode.measured?.width || startNode.width || 160;
      const h = startNode.measured?.height || startNode.height || 80;
      rfInst.setCenter(absX + w / 2, absY + h / 2, { zoom: 1.8, duration: 400 });
    }, 350); } catch {}

    return () => { if (timer) clearTimeout(timer); };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [nodes.length, reactFlowInstance]); // run once on mount after nodes render

  // Presentation Mode Slide States & Effects
  const [currentSlideIndex, setCurrentSlideIndex] = useState(0);
  const [showMiniMap, setShowMiniMap] = useState(true);

  const presentationNodes = useMemo(() => {
    return [...visibleNodes]
      .filter((n) => n.type === 'shape')
      .sort((a, b) => {
        if (Math.abs(a.position.x - b.position.x) < 50) {
          return a.position.y - b.position.y;
        }
        return a.position.x - b.position.x;
      });
  }, [visibleNodes]);

  const focusSlide = (index: number) => {
    const node = presentationNodes[index];
    if (node && reactFlowInstance) {
      // Walk parentId chain so the camera centers correctly on grouped nodes
      // (whose `position` is relative to their parent).
      const allNodes = useDiagramStore.getState().nodes;
      let absX = node.position.x;
      let absY = node.position.y;
      let current: typeof node = node;
      const visited = new Set<string>([node.id]);
      while (current.parentId) {
        if (visited.has(current.parentId)) break;
        visited.add(current.parentId);
        const parent = allNodes.find(n => n.id === current.parentId);
        if (!parent) break;
        absX += parent.position.x;
        absY += parent.position.y;
        current = parent;
      }
      const w = node.measured?.width || node.width || 150;
      const h = node.measured?.height || node.height || 100;
      reactFlowInstance.setCenter(absX + w / 2, absY + h / 2, { zoom: 1.4, duration: 800 });
      
      // Select the node so the user sees it is focused
      selectNode(node.id);
    }
  };

  useEffect(() => {
    // Clamp currentSlideIndex when nodes are deleted during presentation
    // (otherwise UI shows "Slide 6 of 3" and presentationNodes[idx] is undefined).
    setCurrentSlideIndex((i) => Math.min(i, Math.max(0, presentationNodes.length - 1)));
  }, [presentationNodes.length]);

  useEffect(() => {
    if (useDiagramStore.getState().presentationMode && useDiagramStore.getState().nodes.length > 0) {
      setCurrentSlideIndex(0);
      const t = setTimeout(() => {
        const rf = getReactFlowInstance();
        const storeNodes = useDiagramStore.getState().nodes;
        const shapeNodes = [...storeNodes].filter((n: any) => n.type === 'shape').sort((a, b) => {
          if (Math.abs(a.position.x - b.position.x) < 50) return a.position.y - b.position.y;
          return a.position.x - b.position.x;
        });
        const first = shapeNodes[0] as any;
        if (!first || !rf) return;
        let absX = first.position.x, absY = first.position.y;
        let cur: typeof first = first;
        const visited = new Set<string>([first.id]);
        while (cur.parentId) {
          if (visited.has(cur.parentId)) break;
          visited.add(cur.parentId);
          const parent = storeNodes.find((n: any) => n.id === cur.parentId);
          if (!parent) break;
          absX += parent.position.x; absY += parent.position.y; cur = parent;
        }
        rf.setCenter(absX + (first.measured?.width || first.width || 150) / 2, absY + (first.measured?.height || first.height || 100) / 2, { zoom: 1.4, duration: 800 });
      }, 300);
      return () => clearTimeout(t);
    }
  }, [presentationMode]); // presentationNodes excluded since we read nodes directly from store for fresh data

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const active = document.activeElement as HTMLElement | null;
      if (
        e.key.toLowerCase() === 'p' && 
        active?.tagName !== 'INPUT' && 
        active?.tagName !== 'TEXTAREA' &&
        active?.tagName !== 'SELECT' &&
        !active?.isContentEditable
      ) {
        e.preventDefault();
        setPresentationMode(!presentationMode);
        showToast(!presentationMode ? 'Entered Presentation Mode (Press P to exit)' : 'Exited Presentation Mode', 'info');
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [presentationMode, showToast]);

  // Spawn sticky note shortcut ('n' key)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const active = document.activeElement as HTMLElement | null;
      if (
        e.key.toLowerCase() === 'n' &&
        active?.tagName !== 'INPUT' &&
        active?.tagName !== 'TEXTAREA' &&
        active?.tagName !== 'SELECT' &&
        !active?.isContentEditable
      ) {
        e.preventDefault();
        
        if (reactFlowInstance) {
          const position = reactFlowInstance.screenToFlowPosition({
            x: window.innerWidth / 2,
            y: window.innerHeight / 2
          });
          // Use the store's addNode action so the new node gets the same defaults
          // (uuid, width/height, default colors) as a sidebar-dragged sticky.
          addNode('sticky', { x: position.x - 75, y: position.y - 75 }, {
            label: 'Double click to edit',
            color: '#fef08a',
            borderColor: '#eab308',
            fontFamily: 'handwriting',
            fontSize: 14,
            align: 'center',
          });
          showToast('Spawned a new sticky note! (Double-click to write)', 'success');
        }
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [reactFlowInstance, addNode, showToast]);

  // Delete selected nodes and edges with Delete/Backspace key
  const deleteSelectedNodes = useCallback(() => {
    const { nodes, edges } = useDiagramStore.getState();
    const selectedNodes = nodes.filter(n => n.selected);
    const selectedEdges = edges.filter(e => e.selected);
    const selectedNodeIds = new Set(selectedNodes.map(n => n.id));
    const selectedEdgeIds = new Set(selectedEdges.map(e => e.id));
    
    if (selectedNodeIds.size > 0 || selectedEdgeIds.size > 0) {
      const edgesToRemove = edges.filter(
        e => selectedEdgeIds.has(e.id) || selectedNodeIds.has(e.source) || selectedNodeIds.has(e.target)
      );

      if (selectedNodeIds.size > 0) {
        useDiagramStore.getState().onNodesChange(
          selectedNodes.map(n => ({ type: 'remove', id: n.id }))
        );
      }
      if (edgesToRemove.length > 0) {
        useDiagramStore.getState().onEdgesChange(
          edgesToRemove.map(e => ({ type: 'remove', id: e.id }))
        );
      }
      
      const parts = [];
      if (selectedNodeIds.size > 0) parts.push(`${selectedNodeIds.size} node(s)`);
      if (selectedEdgeIds.size > 0) parts.push(`${selectedEdgeIds.size} line(s)`);
      showToast(`Deleted ${parts.join(' and ')}`, 'info');
    }
  }, [showToast]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLElement) {
        if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA' || e.target.tagName === 'SELECT' || e.target.isContentEditable) return;
      }

      // Slide navigation in Presentation Mode
      if (presentationMode) {
        if (e.key === 'ArrowRight' || e.key === 'Space') {
          e.preventDefault();
          if (currentSlideIndex < presentationNodes.length - 1) {
            const nextIndex = currentSlideIndex + 1;
            setCurrentSlideIndex(nextIndex);
            focusSlide(nextIndex);
          }
          return;
        }
        if (e.key === 'ArrowLeft') {
          e.preventDefault();
          if (currentSlideIndex > 0) {
            const nextIndex = currentSlideIndex - 1;
            setCurrentSlideIndex(nextIndex);
            focusSlide(nextIndex);
          }
          return;
        }
      }

      // Mind-map shortcuts: Tab adds a child, Enter adds a sibling.
      // Only fires when exactly one node is selected and the user isn't
      // typing into a form field.
      if ((e.key === 'Tab' || e.key === 'Enter') && !e.ctrlKey && !e.metaKey && !e.altKey) {
        const selectedNodes = getNodes().filter((n) => n.selected);
        if (selectedNodes.length === 1) {
          e.preventDefault();
          if (e.key === 'Tab') {
            addChildNode(selectedNodes[0].id);
          } else {
            addSiblingNode(selectedNodes[0].id);
          }
          return;
        }
      }

      // Delete nodes
      if (e.key === 'Delete' || e.key === 'Backspace') {
        e.preventDefault();
        deleteSelectedNodes();
        return;
      }

      // Help/Shortcuts modal
      if (e.key === '?' || (e.ctrlKey && e.key === '/')) {
        e.preventDefault();
        setShowHelpModal(true);
        return;
      }

      if ((e.ctrlKey || e.metaKey) && e.key === 'z') {
        e.preventDefault();
        if (e.shiftKey) {
          useDiagramStore.temporal.getState().redo();
          showToast('Redo', 'info');
        } else {
          useDiagramStore.temporal.getState().undo();
          showToast('Undo', 'info');
        }
      } else if ((e.ctrlKey || e.metaKey) && e.key === 'y') {
        e.preventDefault();
        useDiagramStore.temporal.getState().redo();
        showToast('Redo', 'info');
      }

      // Select All with Ctrl+A / Cmd+A
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'a') {
        e.preventDefault();
        const { nodes, edges, activeCanvasId } = useDiagramStore.getState();
        const visibleNodeIds = new Set(
          activeCanvasId
            ? nodes.filter(n => (n.data as ShapeNodeData).portalId === activeCanvasId).map(n => n.id)
            : nodes.filter(n => !(n.data as ShapeNodeData).portalId).map(n => n.id)
        );
        useDiagramStore.setState({
          nodes: nodes.map(n => ({ ...n, selected: visibleNodeIds.has(n.id) })),
          edges: edges.map(edge => ({ ...edge, selected: visibleNodeIds.has(edge.source) && visibleNodeIds.has(edge.target) }))
        });
        showToast('Selected all elements', 'info');
        return;
      }

      // Copy Selection with Ctrl+C / Cmd+C
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'c') {
        e.preventDefault();
        useDiagramStore.getState().copySelection();
        showToast('Copied selection', 'info');
        return;
      }

      // Paste Selection with Ctrl+V / Cmd+V
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'v') {
        e.preventDefault();
        useDiagramStore.getState().pasteSelection();
        showToast('Pasted selection', 'info');
        return;
      }

      // Duplicate Selection with Ctrl+D / Cmd+D
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'd') {
        e.preventDefault();
        useDiagramStore.getState().duplicateSelectedNodes();
        showToast('Duplicated selection', 'success');
        return;
      }

      // Deselect All or close help modal with Escape key
      if (e.key === 'Escape') {
        e.preventDefault();
        if (showHelpModal) {
          setShowHelpModal(false);
        } else {
          selectNode(null);
          const { edges } = useDiagramStore.getState();
          useDiagramStore.setState({
            edges: edges.map(e2 => ({ ...e2, selected: false }))
          });
          showToast('Deselected all elements', 'info');
        }
        return;
      }

      // Toggle grid snap with G key
      if (e.key === 'g' && !e.ctrlKey && !e.metaKey) {
        e.preventDefault();
        toggleSnapToGrid();
        showToast(`Snap to grid ${!snapToGrid ? 'enabled' : 'disabled'}`, 'info');
      }

      // Fit view with F key
      if (e.key.toLowerCase() === 'f' && !e.ctrlKey && !e.metaKey) {
        e.preventDefault();
        reactFlowInstance?.fitView({ duration: 500, padding: 0.2 });
        showToast('Fit elements to view', 'info');
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [showToast, snapToGrid, toggleSnapToGrid, deleteSelectedNodes, reactFlowInstance, presentationMode, currentSlideIndex, presentationNodes, showHelpModal, setShowHelpModal, addChildNode, addSiblingNode, getNodes, selectNode]);

  useEffect(() => {
    const handleGlobalPaste = (event: ClipboardEvent) => {
      // Guard: don't intercept paste when the user is typing into a form field or contentEditable
      const target = event.target;
      if (target instanceof HTMLElement) {
        if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.tagName === 'SELECT' || target.isContentEditable) {
          return;
        }
      } else {
        // event.target may be a Document or text node — skip safely
        return;
      }

      const clipboardData = event.clipboardData;
      if (clipboardData) {
        const items = clipboardData.items;
        const hasImage = Array.from(items).some((item: any) => item.type.indexOf('image') !== -1);
        
        if (hasImage) {
          event.preventDefault();
          for (const item of Array.from(items)) {
            if (item.type.indexOf('image') !== -1) {
              const blob = item.getAsFile();
              if (blob) {
                const reader = new FileReader();
                reader.onload = (e) => {
                  const imageUrl = e.target?.result as string;
                  const rect = reactFlowWrapper.current?.getBoundingClientRect();
                  const centerX = rect ? rect.left + rect.width / 2 : window.innerWidth / 2;
                  const centerY = rect ? rect.top + rect.height / 2 : window.innerHeight / 2;
                  const rfInstance = getReactFlowInstance();
                  const position = rfInstance ? rfInstance.screenToFlowPosition({ x: centerX, y: centerY }) : { x: centerX, y: centerY };
                  
                  useDiagramStore.getState().pasteImage(imageUrl, position);
                  showToast('Image pasted', 'success');
                };
                reader.readAsDataURL(blob);
              }
              break;
            }
          }
        }
      }
    };

    window.addEventListener('paste', handleGlobalPaste);
    return () => window.removeEventListener('paste', handleGlobalPaste);
  }, [showToast]);

  const onDragOver = useCallback((event: React.DragEvent) => {
    event.preventDefault();
    event.dataTransfer.dropEffect = 'move';
  }, []);

  const onDrop = useCallback(
    (event: React.DragEvent) => {
      event.preventDefault();

      const type = event.dataTransfer.getData('application/reactflow') as ShapeType;
      
      const validTypes: ShapeType[] = ['rectangle', 'circle', 'diamond', 'sticky', 'text', 'cylinder', 'image', 'sticker', 'frame', 'card', 'portal', 'drawing'];
      if (!type || !validTypes.includes(type)) {
        return;
      }

      const position = screenToFlowPosition({
        x: event.clientX,
        y: event.clientY,
      });

      if (type === 'sticker') {
        const emoji = event.dataTransfer.getData('application/reactflow-emoji') || '⭐';
        addNode('sticker', position, { stickerEmoji: emoji, label: emoji });
        showToast('Sticker placed on canvas', 'success');
      } else {
        addNode(type, position);
      }
    },
    [screenToFlowPosition, addNode, showToast],
  );



  // NOTE: Tab (add child) and Enter (add sibling) mind-map shortcuts are now
  // handled in the global window 'keydown' listener further below. Previously
  // these were attached to the wrapper div via onKeyDown + tabIndex={0}, which
  // only fired when the wrapper itself had focus — i.e. after clicking empty
  // canvas, but NOT after clicking a node. That made the shortcuts feel flaky.

  const isDarkColor = (color: string | null): boolean => {
    if (!color) return theme === 'dark';
    if (color === 'transparent') return theme === 'dark';
    const hex = color.replace('#', '');
    if (hex.length === 3) {
      const r = parseInt(hex[0] + hex[0], 16);
      const g = parseInt(hex[1] + hex[1], 16);
      const b = parseInt(hex[2] + hex[2], 16);
      return (r * 0.299 + g * 0.587 + b * 0.114) < 128;
    } else if (hex.length === 6) {
      const r = parseInt(hex.substring(0, 2), 16);
      const g = parseInt(hex.substring(2, 4), 16);
      const b = parseInt(hex.substring(4, 6), 16);
      return (r * 0.299 + g * 0.587 + b * 0.114) < 128;
    }
    return theme === 'dark';
  };

  const isDarkBg = isDarkColor(canvasColor);
  const gridColor = isDarkBg ? '#475569' : '#cbd5e1';

  return (
    <>
      <div
        className={`flex-1 h-full w-full relative transition-all duration-300 ${canvasColor ? '' : 'bg-gray-50 dark:bg-slate-900'} ${interactionMode === 'laser' || interactionMode === 'pen' ? 'cursor-crosshair' : interactionMode === 'eraser' ? 'cursor-cell' : ''}`}
        style={{ backgroundColor: canvasColor || undefined }}
        ref={reactFlowWrapper}
      >
        <ReactFlow
          nodes={visibleNodes}
          edges={visibleEdges}
          className={`${isAnimatingLayout ? 'nodes-animating shake-canvas' : ''} transition-all duration-300`}
          onNodesChange={onNodesChange}
          onEdgesChange={onEdgesChange}
          onConnect={onConnect}
          onDragOver={onDragOver}
          onDrop={onDrop}
          nodeTypes={nodeTypes}
          fitView
          fitViewOptions={{ padding: 2 }}
          minZoom={0.1}
          maxZoom={4}
          panOnScroll={true}
          nodesDraggable={!isLocked && effectiveInteractionMode !== 'laser' && effectiveInteractionMode !== 'pen' && effectiveInteractionMode !== 'eraser' && !presentationMode}
          nodesConnectable={!isLocked && effectiveInteractionMode !== 'laser' && effectiveInteractionMode !== 'pen' && effectiveInteractionMode !== 'eraser' && !presentationMode}
          elementsSelectable={!isLocked && effectiveInteractionMode !== 'laser' && effectiveInteractionMode !== 'pen' && effectiveInteractionMode !== 'eraser' && !presentationMode}
          selectionOnDrag={effectiveInteractionMode === 'select'}
          panOnDrag={effectiveInteractionMode === 'pan' || spacePressed ? [0, 1, 2] : [1, 2]}
          selectionMode={SelectionMode.Partial}
          snapToGrid={snapToGrid}
          snapGrid={[gridSize, gridSize]}
          colorMode={theme}
          // Throttle zoom updates: onMove fires dozens of times per second
          // during pan/zoom, and each setZoom() re-renders TopNav (which
          // subscribes to `zoom`). Use onMoveEnd for the final value, and a
          // lightweight rAF-coalesced update during continuous motion.
          onMoveEnd={(_, viewport) => useDiagramStore.getState().setZoom(viewport.zoom)}
        >
          <Background 
             color={gridColor} 
             gap={gridSize} 
             size={gridType === 'lines' ? 1 : gridType === 'cross' ? 6 : 1.5} 
             variant={gridType === 'lines' ? BackgroundVariant.Lines : gridType === 'cross' ? BackgroundVariant.Cross : BackgroundVariant.Dots} 
           />

          {showMiniMap && !presentationMode && (
            <MiniMap 
              nodeColor={(n) => {
                if (n.type === 'shape') {
                  return (n.data as any).color || '#ffffff';
                }
                return '#eee';
              }}
            />
          )}

          {/* Bottom Right Floating Actions Panel */}
          {!presentationMode && (
            <div className="absolute flex flex-col gap-2 z-50 transition-all duration-200"
              style={{
                bottom: showMiniMap ? '138px' : '16px',
                right: '16px'
              }}
            >
              {/* Notepad Drawer Button */}
              <button
                onClick={() => setShowNotepad(!showNotepad)}
                className={`bg-white dark:bg-slate-800 border border-gray-200 dark:border-gray-700 rounded-md p-1.5 shadow-md transition-colors flex items-center justify-center ${showNotepad ? 'text-blue-600 dark:text-blue-400' : 'text-gray-500 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-slate-700 hover:text-blue-600 dark:hover:text-blue-400'}`}
                title="Board Notepad"
              >
                <Notebook size={14} />
              </button>



              {/* Collapse/Expand Toggle Button */}
              <button
                onClick={() => setShowMiniMap(!showMiniMap)}
                className="bg-white dark:bg-slate-800 border border-gray-200 dark:border-gray-700 rounded-md p-1.5 shadow-md text-gray-500 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-slate-700 hover:text-gray-700 dark:hover:text-gray-200 transition-colors flex items-center justify-center"
                title={showMiniMap ? "Collapse minimap" : "Expand minimap"}
              >
                {showMiniMap ? (
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                    <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />
                    <polyline points="15 3 21 3 21 9" />
                    <line x1="10" y1="14" x2="21" y2="3" />
                  </svg>
                ) : (
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                    <rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
                    <line x1="9" y1="3" x2="9" y2="21" />
                  </svg>
                )}
              </button>
            </div>
          )}
          <ContextToolbar />
          <MultiSelectToolbar />

          {activeCanvasId && !presentationMode && (
            <Panel position="top-left" className="m-4 z-50">
              <button
                onClick={() => setActiveCanvasId(null)}
                className="bg-white/90 dark:bg-slate-800/90 backdrop-blur-md border border-gray-200 dark:border-gray-700 rounded-lg px-3 py-2 shadow-lg text-sm font-semibold text-gray-700 dark:text-gray-200 flex items-center gap-2 hover:bg-gray-50 dark:hover:bg-slate-700 transition-colors"
              >
                <ChevronLeft size={16} /> Back to Main Canvas
              </button>
            </Panel>
          )}

          {!presentationMode && <TimerWidget />}
        </ReactFlow>

        {/* Empty State Overlay */}
        {visibleNodes.length === 0 && !presentationMode && !activeCanvasId && (
          <div className="absolute inset-0 flex items-center justify-center z-30 pointer-events-none">
            <div className="text-center animate-fade-in-up">
              <div className="animate-float inline-flex items-center justify-center w-20 h-20 rounded-2xl bg-gradient-to-br from-blue-500 to-violet-600 shadow-2xl shadow-blue-500/25 mb-6">
                <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                  <rect x="3" y="3" width="7" height="7" rx="1.5" />
                  <rect x="14" y="3" width="7" height="7" rx="1.5" />
                  <rect x="3" y="14" width="7" height="7" rx="1.5" />
                  <rect x="14" y="14" width="7" height="7" rx="1.5" />
                </svg>
              </div>
              <h2 className="text-xl font-bold text-gray-800 dark:text-gray-100 mb-2">Start Creating</h2>
              <p className="text-sm text-gray-500 dark:text-gray-400 mb-6 max-w-xs mx-auto leading-relaxed">
                Drag shapes from the sidebar, press <kbd className="px-1.5 py-0.5 bg-gray-100 dark:bg-slate-700 border border-gray-200 dark:border-gray-600 rounded text-xs font-mono text-gray-700 dark:text-gray-300">N</kbd> for a note, or load a template
              </p>
              <div className="flex items-center justify-center gap-3 text-xs text-gray-400 dark:text-gray-500">
                <span className="flex items-center gap-1">
                  <kbd className="px-1 py-0.5 bg-gray-100 dark:bg-slate-700 border border-gray-200 dark:border-gray-600 rounded font-mono">Tab</kbd>
                  <span>Child</span>
                </span>
                <span className="w-1 h-1 rounded-full bg-gray-300 dark:bg-gray-600" />
                <span className="flex items-center gap-1">
                  <kbd className="px-1 py-0.5 bg-gray-100 dark:bg-slate-700 border border-gray-200 dark:border-gray-600 rounded font-mono">Enter</kbd>
                  <span>Sibling</span>
                </span>
                <span className="w-1 h-1 rounded-full bg-gray-300 dark:bg-gray-600" />
                <span className="flex items-center gap-1">
                  <kbd className="px-1 py-0.5 bg-gray-100 dark:bg-slate-700 border border-gray-200 dark:border-gray-600 rounded font-mono">Del</kbd>
                  <span>Delete</span>
                </span>
              </div>
            </div>
          </div>
        )}

        {/* Drawing Canvas Overlay for Pen & Laser Pointer */}
        {(effectiveInteractionMode === 'laser' || effectiveInteractionMode === 'pen' || effectiveInteractionMode === 'eraser') && (
          <canvas
            ref={laserCanvasRef}
            className="absolute inset-0 w-full h-full z-40 pointer-events-none"
          />
        )}



        {/* Collaborators Cursors Layer */}
        {simulateCollaborators && collabCursors.map(c => (
          <div
            key={c.id}
            className="absolute pointer-events-none transition-all duration-300 z-50 flex items-center gap-1.5"
            style={{ left: c.x, top: c.y }}
          >
            <svg width="14" height="20" viewBox="0 0 14 20" fill="none" className="drop-shadow-xs">
              <path d="M0 0V15.5L4 12L7.5 19L10 17.5L6.5 11L11.5 10.5L0 0Z" fill={c.color} />
            </svg>
            <span 
              className="px-1.5 py-0.5 rounded text-[10px] font-bold text-white shadow-xs"
              style={{ backgroundColor: c.color }}
            >
              {c.name}
            </span>
          </div>
        ))}

        {/* Notepad Collapsible Drawer */}
        {showNotepad && (() => {
          const selectedNode = getNodes().find(n => n.selected);
          return (
            <div className="absolute right-0 top-12 bottom-0 w-80 bg-white dark:bg-slate-800 border-l border-gray-200 dark:border-gray-700 shadow-xl z-50 flex flex-col p-4 animate-in slide-in-from-right duration-250">
              <div className="flex justify-between items-center mb-3 shrink-0">
                <h3 className="text-sm font-bold text-gray-800 dark:text-gray-200 flex items-center gap-1.5">
                  <Notebook size={16} className="text-blue-500" />
                  Notepad & Outline
                </h3>
                <button 
                  onClick={() => setShowNotepad(false)}
                  className="text-xs text-gray-400 hover:text-gray-600 dark:hover:text-gray-200"
                >
                  Close
                </button>
              </div>

              {/* Section Selector Tabs */}
              <div className="flex bg-gray-100 dark:bg-slate-900/50 p-0.5 rounded-lg mb-3 shrink-0">
                <button
                  onClick={() => setNotepadSection('board')}
                  className={`flex-1 py-1 text-[10px] font-bold rounded-md transition-all ${notepadSection === 'board' ? 'bg-white dark:bg-slate-800 text-gray-800 dark:text-gray-100 shadow-xs' : 'text-gray-400 hover:text-gray-600 dark:hover:text-gray-300'}`}
                >
                  Board Notes
                </button>
                <button
                  onClick={() => setNotepadSection('shape')}
                  className={`flex-1 py-1 text-[10px] font-bold rounded-md transition-all ${notepadSection === 'shape' ? 'bg-white dark:bg-slate-800 text-gray-800 dark:text-gray-100 shadow-xs' : 'text-gray-400 hover:text-gray-600 dark:hover:text-gray-300'}`}
                >
                  Shape Notes
                </button>
                <button
                  onClick={() => setNotepadSection('outline')}
                  className={`flex-1 py-1 text-[10px] font-bold rounded-md transition-all ${notepadSection === 'outline' ? 'bg-white dark:bg-slate-800 text-gray-800 dark:text-gray-100 shadow-xs' : 'text-gray-400 hover:text-gray-600 dark:hover:text-gray-300'}`}
                >
                  Outline
                </button>
              </div>

              {/* Tab Contents */}
              {notepadSection === 'board' && (
                <>
                  <div className="flex border-b border-gray-200 dark:border-gray-700 mb-3 shrink-0">
                    <button
                      onClick={() => setNotepadTab('edit')}
                      className={`flex-1 pb-1.5 text-xs font-semibold border-b-2 transition-all ${notepadTab === 'edit' ? 'border-blue-500 text-blue-600 dark:text-blue-400' : 'border-transparent text-gray-400 hover:text-gray-600 dark:hover:text-gray-300'}`}
                    >
                      Edit
                    </button>
                    <button
                      onClick={() => setNotepadTab('preview')}
                      className={`flex-1 pb-1.5 text-xs font-semibold border-b-2 transition-all ${notepadTab === 'preview' ? 'border-blue-500 text-blue-600 dark:text-blue-400' : 'border-transparent text-gray-400 hover:text-gray-600 dark:hover:text-gray-300'}`}
                    >
                      Preview
                    </button>
                  </div>

                  {notepadTab === 'edit' ? (
                    <textarea
                      value={boardNotes}
                      onChange={(e) => setBoardNotes(e.target.value)}
                      placeholder="Jot down notes in Markdown format...&#10;# Header 1&#10;- Bullet point 1&#10;**Bold text**"
                      className="flex-1 text-xs bg-gray-50 dark:bg-slate-900 border border-gray-200 dark:border-gray-700 rounded-lg p-3 outline-none focus:ring-2 focus:ring-blue-500 text-gray-800 dark:text-gray-200 resize-none font-sans leading-relaxed"
                    />
                  ) : (
                    <div 
                      className="flex-1 overflow-y-auto bg-gray-50 dark:bg-slate-900 border border-gray-200 dark:border-gray-700 rounded-lg p-3 max-w-none text-left"
                      dangerouslySetInnerHTML={{ __html: renderMarkdown(boardNotes) }}
                    />
                  )}
                </>
              )}

              {notepadSection === 'shape' && (
                <>
                  {selectedNode ? (
                    <>
                      <div className="mb-2 px-1 text-[10px] text-gray-400 dark:text-gray-500 flex justify-between items-center shrink-0">
                        <span>Editing notes for: <strong className="text-gray-700 dark:text-gray-300">{(selectedNode.data as any)?.label || 'Selected Shape'}</strong></span>
                      </div>
                      <div className="flex border-b border-gray-200 dark:border-gray-700 mb-3 shrink-0">
                        <button
                          onClick={() => setNotepadTab('edit')}
                          className={`flex-1 pb-1.5 text-xs font-semibold border-b-2 transition-all ${notepadTab === 'edit' ? 'border-blue-500 text-blue-600 dark:text-blue-400' : 'border-transparent text-gray-400 hover:text-gray-600 dark:hover:text-gray-300'}`}
                        >
                          Edit
                        </button>
                        <button
                          onClick={() => setNotepadTab('preview')}
                          className={`flex-1 pb-1.5 text-xs font-semibold border-b-2 transition-all ${notepadTab === 'preview' ? 'border-blue-500 text-blue-600 dark:text-blue-400' : 'border-transparent text-gray-400 hover:text-gray-600 dark:hover:text-gray-300'}`}
                        >
                          Preview
                        </button>
                      </div>

                      {notepadTab === 'edit' ? (
                        <textarea
                          value={(selectedNode.data as any)?.notes || ''}
                          onChange={(e) => updateNodeData(selectedNode.id, { notes: e.target.value })}
                          placeholder="Add shape-specific documentation in Markdown format...&#10;Describe schemas, flows, or descriptions."
                          className="flex-1 text-xs bg-gray-50 dark:bg-slate-900 border border-gray-200 dark:border-gray-700 rounded-lg p-3 outline-none focus:ring-2 focus:ring-blue-500 text-gray-800 dark:text-gray-200 resize-none font-sans leading-relaxed"
                        />
                      ) : (
                        <div 
                          className="flex-1 overflow-y-auto bg-gray-50 dark:bg-slate-900 border border-gray-200 dark:border-gray-700 rounded-lg p-3 max-w-none text-left"
                          dangerouslySetInnerHTML={{ __html: renderMarkdown((selectedNode.data as any)?.notes || '') }}
                        />
                      )}
                    </>
                  ) : (
                    <div className="flex-1 flex flex-col items-center justify-center p-4 text-center text-gray-400 dark:text-gray-500">
                      <span className="text-xl mb-2">🏷️</span>
                      <p className="text-xs font-semibold text-gray-700 dark:text-gray-300">No shape selected</p>
                      <p className="text-[10px] mt-1">Select any shape or sticky note on the canvas to add shape-specific notes.</p>
                    </div>
                  )}
                </>
              )}

              {notepadSection === 'outline' && (
                <div className="flex-1 flex flex-col min-h-0 text-left">
                  <span className="text-[10px] font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-wider mb-2 shrink-0">Board Outline (Frames Index)</span>
                  {getNodes().filter(n => n.type === 'shape' && (n.data as any)?.shapeType === 'frame').length > 0 ? (
                    <div className="flex-1 overflow-y-auto space-y-1.5 pr-1">
                      {getNodes()
                        .filter(n => n.type === 'shape' && (n.data as any)?.shapeType === 'frame')
                        .map(frame => (
                          <button
                            key={frame.id}
                            onClick={() => {
                              const rf = getReactFlowInstance();
                              if (rf && frame.position) {
                                const w = frame.measured?.width || frame.width || 200;
                                const h = frame.measured?.height || frame.height || 200;
                                rf.setCenter(
                                  frame.position.x + w / 2,
                                  frame.position.y + h / 2,
                                  { zoom: 0.85, duration: 800 }
                                );
                                showToast(`Navigating to outline: ${(frame.data as any).label}`, 'info');
                              }
                            }}
                            className="w-full text-left p-2 rounded-lg bg-gray-50 hover:bg-blue-50 dark:bg-slate-900 dark:hover:bg-blue-900/20 border border-gray-150 dark:border-gray-700 hover:border-blue-300 dark:hover:border-blue-800 transition-all flex items-center justify-between group"
                          >
                            <span className="text-xs font-semibold text-gray-700 dark:text-gray-300 group-hover:text-blue-600 dark:group-hover:text-blue-400 truncate max-w-[180px]">
                              🖼️ {(frame.data as any).label || 'Untitled Frame'}
                            </span>
                            <span className="text-[9px] font-bold text-gray-400 uppercase tracking-wider group-hover:text-blue-400">
                              Jump &rarr;
                            </span>
                          </button>
                        ))}
                    </div>
                  ) : (
                    <div className="flex-1 flex flex-col items-center justify-center p-4 text-center text-gray-400 dark:text-gray-500">
                      <span className="text-xl mb-2">🖼️</span>
                      <p className="text-xs font-semibold text-gray-700 dark:text-gray-300">No Frames Created</p>
                      <p className="text-[10px] mt-1">Frames act as slides or board sections. Drag in a Frame from the sidebar to populate this outline.</p>
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })()}
        
        {/* Bottom Left Controls */}
        <div className="absolute bottom-4 left-4 z-50 flex items-center gap-2">
          {/* Interaction Mode Toggle */}
          {!presentationMode && (
            <div className="flex glass-panel border border-gray-200/60 dark:border-gray-700/40 rounded-xl shadow-lg overflow-hidden">
              <button
                onClick={() => setInteractionMode('select')}
                className={`p-2.5 transition-all active:scale-95 ${interactionMode === 'select' ? 'bg-blue-500 text-white shadow-inner' : 'text-gray-500 hover:bg-white/60 dark:hover:bg-white/5'}`}
                title="Select Tool (Shift + Drag to lasso)"
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m22 2-7 20-4-9-9-4Z"/><path d="M22 2 11 13"/></svg>
              </button>
              <div className="w-px bg-gray-200/60 dark:bg-gray-700/40" />
              <button
                onClick={() => setInteractionMode('pan')}
                className={`p-2.5 transition-all active:scale-95 ${interactionMode === 'pan' ? 'bg-blue-500 text-white shadow-inner' : 'text-gray-500 hover:bg-white/60 dark:hover:bg-white/5'}`}
                title="Pan Tool (Space + Drag)"
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M18 11V6a2 2 0 0 0-2-2v0a2 2 0 0 0-2 2v0"/><path d="M14 10V4a2 2 0 0 0-2-2v0a2 2 0 0 0-2 2v2"/><path d="M10 10.5V6a2 2 0 0 0-2-2v0a2 2 0 0 0-2 2v8"/><path d="M18 8a2 2 0 1 1 4 0v6a8 8 0 0 1-8 8h-2c-2.8 0-4.5-.86-5.99-2.34l-3.6-3.6a2 2 0 0 1 2.83-2.82L7 15"/></svg>
              </button>
              <div className="w-px bg-gray-200/60 dark:bg-gray-700/40" />
              <button
                onClick={() => setInteractionMode('laser')}
                className={`p-2.5 transition-all active:scale-95 ${interactionMode === 'laser' ? 'bg-red-500 text-white shadow-inner' : 'text-gray-500 hover:bg-white/60 dark:hover:bg-white/5'}`}
                title="Laser Pointer"
              >
                <Zap size={16} className={interactionMode === 'laser' ? 'fill-current' : ''} />
              </button>
              <div className="w-px bg-gray-200/60 dark:bg-gray-700/40" />
              <button
                onClick={() => setInteractionMode('pen')}
                className={`p-2.5 transition-all active:scale-95 ${interactionMode === 'pen' ? 'bg-blue-500 text-white shadow-inner' : 'text-gray-500 hover:bg-white/60 dark:hover:bg-white/5'}`}
                title="Pen Tool"
              >
                <Pencil size={16} />
              </button>
              <div className="w-px bg-gray-200/60 dark:bg-gray-700/40" />
              <button
                onClick={() => setInteractionMode('eraser')}
                className={`p-2.5 transition-all active:scale-95 ${interactionMode === 'eraser' ? 'bg-pink-500 text-white shadow-inner' : 'text-gray-500 hover:bg-white/60 dark:hover:bg-white/5'}`}
                title="Eraser Tool"
              >
                <Eraser size={16} />
              </button>
            </div>
          )}

          {/* Collaborator Simulator Toggle */}
          {!presentationMode && (
            <button
              onClick={() => setSimulateCollaborators(!simulateCollaborators)}
              className={`p-2.5 glass-panel border border-gray-200/60 dark:border-gray-700/40 rounded-xl shadow-lg transition-all active:scale-95 ${simulateCollaborators ? 'text-green-600 dark:text-green-400 bg-green-50/80 dark:bg-green-900/20' : 'text-gray-500 hover:bg-white/60 dark:hover:bg-white/5'}`}
              title="Toggle Live Collaborators Simulation"
            >
              <Users size={16} />
            </button>
          )}

          {/* Grid Snap Toggle */}
          <div className="relative flex items-center glass-panel border border-gray-200/60 dark:border-gray-700/40 rounded-xl shadow-lg" ref={gridSettingsRef}>
            {/* Toggle Snap Part */}
            <button
              onClick={() => {
                toggleSnapToGrid();
                showToast(`Snap to grid ${!snapToGrid ? 'enabled' : 'disabled'}`, 'info');
              }}
              className={`flex items-center gap-1.5 px-3 py-1.5 text-xs transition-colors rounded-l-xl ${
                snapToGrid 
                  ? 'bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 hover:bg-blue-100 dark:hover:bg-blue-900/40' 
                  : 'text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-700'
              }`}
              title={`Toggle Snap to Grid (G)`}
            >
              <svg width="14" height="14" viewBox="0 0 16 16" fill="currentColor">
                <path d="M1 1h5v5H1V1zm0 9h5v5H1v-5zm9-9h5v5h-5V1zm0 9h5v5h-5v-5z"/>
              </svg>
              <span className="font-medium">Grid</span>
              <kbd className="px-1.5 py-0.5 text-[10px] font-mono bg-gray-100 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded">G</kbd>
            </button>
            
            {/* Divider */}
            <div className="w-px h-5 bg-gray-200 dark:bg-gray-700" />
            
            {/* Dropdown Caret */}
            <button
              onClick={() => setShowGridSettings(!showGridSettings)}
              className={`px-2 py-1.5 text-xs transition-colors text-gray-500 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-700 rounded-r-xl ${showGridSettings ? 'bg-gray-100 dark:bg-gray-700' : ''}`}
              title="Grid Settings"
            >
              <svg width="8" height="8" viewBox="0 0 10 10" fill="none" stroke="currentColor" strokeWidth="1.5">
                <path d="M2 4 L5 7 L8 4" />
              </svg>
            </button>

             {/* Grid Settings Dropdown */}
             {showGridSettings && (
               <div className="absolute bottom-full left-0 mb-2 w-44 bg-white dark:bg-gray-800 rounded-lucid border border-gray-200 dark:border-gray-700 shadow-lucid-lg p-3 animate-fade-in z-50 flex flex-col gap-3">
                 <div>
                   <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-2">Grid Size</p>
                   <div className="grid grid-cols-2 gap-1.5">
                     {[10, 20, 30, 50].map((size) => (
                       <button
                         key={size}
                         onClick={() => {
                           setGridSize(size);
                           showToast(`Grid size: ${size}px`, 'info');
                         }}
                         className={`px-2 py-1 text-xs font-semibold rounded border transition-colors text-center ${
                           gridSize === size
                             ? 'bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 border-blue-200 dark:border-blue-800'
                             : 'text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-700 border-gray-200 dark:border-gray-700 bg-gray-50/50 dark:bg-gray-900/30'
                         }`}
                       >
                         {size}px
                       </button>
                     ))}
                   </div>
                 </div>

                 <div className="border-t border-gray-100 dark:border-gray-700 pt-2">
                   <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-2">Grid Style</p>
                   <div className="flex bg-gray-100 dark:bg-slate-700 rounded p-0.5 w-full">
                     {['dots', 'lines', 'cross'].map((type) => (
                       <button
                         key={type}
                         onClick={() => {
                           setGridType(type as any);
                           showToast(`Grid style: ${type}`, 'info');
                         }}
                         className={`flex-1 py-1 text-[10px] font-bold rounded capitalize transition-all ${
                           gridType === type
                             ? 'bg-white dark:bg-slate-600 shadow-sm text-blue-600 dark:text-blue-400'
                             : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200'
                         }`}
                       >
                         {type}
                       </button>
                     ))}
                   </div>
                 </div>

                 <div className="border-t border-gray-100 dark:border-gray-700 pt-2">
                    <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-2">Canvas Color</p>
                    <div className="flex flex-wrap gap-1 mb-2">
                      {[
                        { name: 'Default', value: null },
                        { name: 'Cream', value: '#fafaf9' },
                        { name: 'Warm Gray', value: '#f4f4f5' },
                        { name: 'Ice Blue', value: '#f0f9ff' },
                        { name: 'Navy', value: '#0b1329' },
                        { name: 'Dark Slate', value: '#0f172a' },
                        { name: 'Forest', value: '#061a10' },
                      ].map((color) => (
                        <button
                          key={color.name}
                          onClick={() => {
                            setCanvasColor(color.value);
                            showToast(`Canvas theme: ${color.name}`, 'info');
                          }}
                          className={`w-5 h-5 rounded-full border shadow-sm transition-transform hover:scale-115 ${
                            canvasColor === color.value
                              ? 'ring-2 ring-blue-500 ring-offset-1 dark:ring-offset-slate-800 border-transparent'
                              : 'border-gray-300 dark:border-gray-600'
                          }`}
                          style={{ 
                            backgroundColor: color.value || (theme === 'dark' ? '#0f172a' : '#f9fafb'),
                            backgroundImage: color.value === null ? 'linear-gradient(45deg, #ccc 25%, transparent 25%, transparent 75%, #ccc 75%, #ccc), linear-gradient(45deg, #ccc 25%, #fff 25%, #fff 75%, #ccc 75%, #ccc)' : 'none',
                            backgroundSize: color.value === null ? '6px 6px' : 'auto'
                          }}
                          title={color.name}
                        />
                      ))}
                    </div>
                    <div className="flex items-center gap-1.5 mt-2 bg-gray-50 dark:bg-slate-700 rounded px-1.5 py-0.5">
                      <span className="text-[9px] font-semibold text-gray-400">Custom</span>
                      <input
                        type="color"
                        value={canvasColor || (theme === 'dark' ? '#0f172a' : '#f9fafb')}
                        onChange={(e) => {
                          setCanvasColor(e.target.value);
                        }}
                        className="w-5 h-5 p-0 border-0 rounded cursor-pointer bg-transparent"
                        title="Custom Canvas Color"
                      />
                    </div>
                  </div>
               </div>
             )}
          </div>

          <button
            onClick={() => setPresentationMode(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lucid shadow-lucid text-xs text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
            title="Enter Presentation Mode (Slideshow)"
          >
            <Presentation size={14} className="text-blue-500" />
            <span className="font-medium">Present</span>
            <kbd className="px-1.5 py-0.5 text-[10px] font-mono bg-gray-100 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded">P</kbd>
          </button>

        </div>
      </div>
      
      {presentationMode && (
        <div className="absolute bottom-6 left-1/2 transform -translate-x-1/2 bg-white dark:bg-slate-800 rounded-lg shadow-2xl border border-gray-200 dark:border-gray-700 px-4 py-2.5 flex items-center gap-4 z-[9999] animate-in fade-in slide-in-from-bottom-4 duration-300">
          <button
            onClick={() => {
              if (currentSlideIndex > 0) {
                const nextIndex = currentSlideIndex - 1;
                setCurrentSlideIndex(nextIndex);
                focusSlide(nextIndex);
              }
            }}
            disabled={currentSlideIndex === 0}
            className="px-2.5 py-1 text-xs font-semibold rounded hover:bg-gray-100 dark:hover:bg-slate-700 text-gray-700 dark:text-gray-300 disabled:opacity-30 disabled:pointer-events-none transition-colors border border-gray-200 dark:border-gray-600"
            title="Previous shape"
          >
            ← Prev
          </button>
          
          <span className="text-xs font-bold text-gray-600 dark:text-gray-400 min-w-[70px] text-center select-none">
            {presentationNodes.length > 0 ? `${currentSlideIndex + 1} of ${presentationNodes.length}` : '0 of 0'}
          </span>

          <button
            onClick={() => {
              if (currentSlideIndex < presentationNodes.length - 1) {
                const nextIndex = currentSlideIndex + 1;
                setCurrentSlideIndex(nextIndex);
                focusSlide(nextIndex);
              }
            }}
            disabled={currentSlideIndex === presentationNodes.length - 1 || presentationNodes.length === 0}
            className="px-2.5 py-1 text-xs font-semibold rounded hover:bg-gray-100 dark:hover:bg-slate-700 text-gray-700 dark:text-gray-300 disabled:opacity-30 disabled:pointer-events-none transition-colors border border-gray-200 dark:border-gray-600"
            title="Next shape"
          >
            Next →
          </button>

          <div className="w-px h-6 bg-gray-200 dark:bg-gray-700 mx-1" />

          {/* Separate Laser button in presentation mode */}
          <button
            onClick={() => setPresentationLaser(!presentationLaser)}
            className={`px-2.5 py-1 text-xs font-semibold rounded flex items-center gap-1.5 transition-colors border ${presentationLaser ? 'bg-red-50 dark:bg-red-900/30 text-red-600 dark:text-red-400 border-red-200 dark:border-red-800/30' : 'hover:bg-gray-100 dark:hover:bg-slate-700 text-gray-700 dark:text-gray-300 border-gray-200 dark:border-gray-600'}`}
            title="Laser Pointer"
          >
            <Zap size={14} className={presentationLaser ? 'fill-current' : ''} />
            Laser
          </button>

          <div className="w-px h-6 bg-gray-200 dark:bg-gray-700 mx-1" />

          <button
            onClick={() => setPresentationMode(false)}
            className="px-2.5 py-1 bg-red-500 hover:bg-red-600 text-white rounded text-xs font-bold transition-colors shadow-sm"
          >
            Exit Presentation
          </button>
        </div>
      )}

      <ShortcutsModal isOpen={showHelpModal} onClose={() => setShowHelpModal(false)} />
    </>
  );
}

export function Canvas() {
  return (
    <ReactFlowProvider>
      <CanvasContent />
    </ReactFlowProvider>
  );
}