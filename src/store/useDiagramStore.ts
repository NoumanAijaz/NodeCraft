import { create } from 'zustand';
import type {
  Connection,
  Edge,
  EdgeChange,
  Node,
  NodeChange,
} from '@xyflow/react';
import {
  addEdge,
  applyNodeChanges,
  applyEdgeChanges,
  MarkerType,
} from '@xyflow/react';
import { v4 as uuidv4 } from 'uuid';
import type { ShapeNodeData, ShapeType, FileSystemFileHandle } from '../types/diagram';
import { getDefaultNodeDimensions } from '../utils/diagram';
import { templates } from '../constants/templates';
import { persist } from 'zustand/middleware';
import { temporal } from 'zundo';

/**
 * Deep-clone a node's `data` payload so duplicate/pasted nodes don't share
 * array/object references (tags, reactions, ideaOrbits) with the original.
 * Falls back to a shallow clone if structuredClone is unavailable.
 */
function deepCloneNodeData(data: unknown): ShapeNodeData {
  if (typeof structuredClone === 'function') {
    return structuredClone(data) as ShapeNodeData;
  }
  try {
    return JSON.parse(JSON.stringify(data)) as ShapeNodeData;
  } catch {
    return { ...(data as ShapeNodeData) };
  }
}

/**
 * Compute the absolute (canvas) position of a node by walking its `parentId`
 * chain. Grouped/child nodes have positions relative to their parent, so this
 * is needed for bounding-box calculations, export, camera centering, etc.
 */
export function getAbsolutePosition(node: Node, allNodes: Node[]): { x: number; y: number } {
  let x = node.position.x;
  let y = node.position.y;
  let current = node;
  // Guard against cycles in parentId chain
  const visited = new Set<string>([node.id]);
  while (current.parentId) {
    if (visited.has(current.parentId)) break;
    visited.add(current.parentId);
    const parent = allNodes.find(n => n.id === current.parentId);
    if (!parent) break;
    x += parent.position.x;
    y += parent.position.y;
    current = parent;
  }
  return { x, y };
}

interface DiagramStore {
  nodes: Node[];
  edges: Edge[];
  onNodesChange: (changes: NodeChange[]) => void;
  onEdgesChange: (changes: EdgeChange[]) => void;
  onConnect: (connection: Connection) => void;
  addNode: (type: ShapeType, position: { x: number; y: number }, dataOverrides?: Partial<ShapeNodeData> & { width?: number; height?: number }) => void;
  updateNodeData: (nodeId: string, data: Partial<ShapeNodeData>) => void;
  updateEdgeType: (edgeId: string, type: string) => void;
  updateEdge: (edgeId: string, data: Partial<Edge>) => void;
  updateEdgeStyle: (edgeId: string, style: Record<string, any>) => void;
  addChildNode: (parentId: string) => void;
  addSiblingNode: (nodeId: string) => void;
  theme: 'light' | 'dark';
  toggleTheme: () => void;
  clearCanvas: () => void;
  bringToFront: (nodeId: string) => void;
  sendToBack: (nodeId: string) => void;
  // Grid settings
  snapToGrid: boolean;
  gridSize: number;
  toggleSnapToGrid: () => void;
  setGridSize: (size: number) => void;
  clipboard: { nodes: Node[]; edges: Edge[] } | null;
  copySelection: () => void;
  pasteSelection: () => void;
  pasteImage: (imageUrl: string, position: { x: number; y: number }) => void;
  duplicateSelectedNodes: () => void;
  alignSelectedNodes: (alignment: 'left' | 'center' | 'right' | 'top' | 'middle' | 'bottom') => void;
  groupNodes: () => void;
  ungroupNodes: (groupId: string) => void;
  layoutDiagram: () => void;
  loadTemplate: (templateName: 'mindmap' | 'flowchart' | 'database') => void;
  showHelpModal: boolean;
  setShowHelpModal: (show: boolean) => void;
  reactFlowInstance: any | null;
  setReactFlowInstance: (instance: any) => void;
  gridType: 'dots' | 'lines' | 'cross';
  setGridType: (type: 'dots' | 'lines' | 'cross') => void;
  updateNodesData: (nodeIds: string[], data: Partial<ShapeNodeData>) => void;
  presentationMode: boolean;
  setPresentationMode: (active: boolean) => void;
  canvasColor: string | null;
  setCanvasColor: (color: string | null) => void;
  fileHandle: FileSystemFileHandle | null;
  fileName: string | null;
  setFileDetails: (handle: FileSystemFileHandle | null, name: string | null) => void;
  projectId: string | null;
  projectName: string | null;
  setProjectDetails: (id: string | null, name: string | null) => void;
  loadProject: (state: Partial<DiagramStore>) => void;
  boardNotes: string;
  setBoardNotes: (notes: string) => void;
  distributeSelectedNodes: (direction: 'horizontal' | 'vertical') => void;
  arrangeSelectedNodesAsTree: () => void;
  activeFilterTag: string | null;
  setActiveFilterTag: (tag: string | null) => void;
  selectNode: (nodeId: string | null) => void;
  zoom: number;
  setZoom: (zoom: number) => void;
  activeCanvasId: string | null;
  setActiveCanvasId: (id: string | null) => void;
  isAnimatingLayout: boolean;
  triggerShakeToAlign: () => void;
  moveToPortal: (nodeIds: string[], portalId: string | null) => void;
  isLocked: boolean;
  setIsLocked: (locked: boolean) => void;
}

let shakeTimeoutId: ReturnType<typeof setTimeout> | null = null;

export const useDiagramStore = create<DiagramStore>()(
  temporal(
    persist(
      (set, get) => ({
      nodes: [
        {
          id: uuidv4(),
          type: 'shape',
          position: { x: 250, y: 250 },
          width: 160,
          height: 80,
          data: { label: 'Start Here', shapeType: 'rectangle', color: '#e2e8f0', borderColor: '#94a3b8', borderWidth: 2, fontSize: 16, align: 'center' },
        },
      ],
      edges: [],
      theme: 'light',
      snapToGrid: true,
      gridSize: 20,
      gridType: 'dots',
      presentationMode: false,
      canvasColor: null,
      activeFilterTag: null,
      zoom: 1,
      activeCanvasId: null,
      isAnimatingLayout: false,
      isLocked: false,
      setZoom: (zoom) => set({ zoom }),
      setIsLocked: (locked) => set({ isLocked: locked }),
      
      setActiveCanvasId: (id) => set({ activeCanvasId: id }),
      
      triggerShakeToAlign: () => {
        set({ isAnimatingLayout: true });
        get().layoutDiagram();
        if (shakeTimeoutId) clearTimeout(shakeTimeoutId);
        shakeTimeoutId = setTimeout(() => {
          set({ isAnimatingLayout: false });
          shakeTimeoutId = null;
        }, 600);
      },
      
      moveToPortal: (nodeIds: string[], portalId: string | null) => {
        const ids = new Set(nodeIds);
        set({
          nodes: get().nodes.map(n => {
            if (ids.has(n.id)) {
              return { ...n, data: { ...n.data, portalId } };
            }
            return n;
          })
        });
      },
      clipboard: null,
      fileHandle: null,
      fileName: null,
      showHelpModal: false,
      reactFlowInstance: null,
      boardNotes: '',
      
      toggleTheme: () => {
        set({ theme: get().theme === 'light' ? 'dark' : 'light' });
      },

      onNodesChange: (changes: NodeChange[]) => {
        set({
          nodes: applyNodeChanges(changes, get().nodes),
        });
      },
      
      onEdgesChange: (changes: EdgeChange[]) => {
        set({
          edges: applyEdgeChanges(changes, get().edges),
        });
      },
      
      onConnect: (connection: Connection) => {
        const { nodes, edges } = get();
        const sourceNode = nodes.find(n => n.id === connection.source);
        const targetNode = nodes.find(n => n.id === connection.target);
        
        let animated = false;
        let style: any = { strokeWidth: 2, stroke: '#94a3b8' };
        
        if (sourceNode && targetNode) {
          const sourceType = (sourceNode.data as ShapeNodeData).shapeType;
          const targetType = (targetNode.data as ShapeNodeData).shapeType;
          
          if (sourceType === 'cylinder' && targetType === 'rectangle') {
            animated = true;
            style = { strokeWidth: 4, stroke: '#3b82f6', filter: 'drop-shadow(0 0 6px rgba(59, 130, 246, 0.6))' };
          } else if (sourceType === 'sticky' && targetType === 'sticky') {
            animated = true;
            style = { strokeWidth: 3, stroke: '#eab308', strokeDasharray: '5,5' };
          }
        }

        set({
          edges: addEdge({ 
            ...connection, 
            type: 'default', 
            animated, 
            style,
            markerEnd: { type: MarkerType.ArrowClosed, width: 20, height: 20, color: style.stroke }
          }, edges),
        });
      },
      
      addNode: (shapeType: ShapeType, position: { x: number; y: number }, dataOverrides?: Partial<ShapeNodeData> & { width?: number; height?: number }) => {
        const { width: defaultW, height: defaultH } = getDefaultNodeDimensions(shapeType);
        const overrideWidth = dataOverrides?.width;
        const overrideHeight = dataOverrides?.height;
        // Strip width/height from dataOverrides so they don't leak into ShapeNodeData
        const { width: _w, height: _h, ...cleanDataOverrides } = dataOverrides || {};

        const newNode: Node = {
          id: uuidv4(),
          type: 'shape',
          position,
          width: overrideWidth || defaultW,
          height: overrideHeight || defaultH,
          zIndex: shapeType === 'frame' ? -1 : 0,
          selected: true,
          data: {
            label: shapeType === 'text' ? 'Double click to edit' : shapeType === 'image' ? '' : shapeType === 'frame' ? 'Frame Area' : shapeType === 'card' ? 'New Task Card' : 'New Node',
            shapeType,
            color: shapeType === 'sticky' ? '#fef08a' : shapeType === 'frame' ? 'transparent' : '#ffffff',
            borderColor: shapeType === 'sticky' ? '#eab308' : shapeType === 'frame' ? '#94a3b8' : '#94a3b8',
            borderWidth: shapeType === 'frame' ? 4 : 2,
            fontSize: shapeType === 'frame' ? 18 : 14,
            align: shapeType === 'frame' ? 'left' : 'center',
            bold: shapeType === 'frame' ? true : false,
            status: shapeType === 'card' ? 'todo' : undefined,
            assignee: shapeType === 'card' ? 'Unassigned' : shapeType === 'sticky' ? 'Anonymous' : undefined,
            dueDate: shapeType === 'card' ? '' : undefined,
            ...cleanDataOverrides,
          } as ShapeNodeData,
        };
        
        const updatedNodes = get().nodes.map(n => ({ ...n, selected: false }));
        set({ nodes: [...updatedNodes, newNode] });
      },
      
      updateNodeData: (nodeId: string, data: Partial<ShapeNodeData>) => {
        set({
          nodes: get().nodes.map((node) => {
            if (node.id === nodeId) {
              const updatedData = { ...node.data, ...data };
              return {
                ...node,
                data: updatedData,
                draggable: updatedData.locked ? false : undefined,
              };
            }
            return node;
          }),
        });
      },

      updateEdgeType: (edgeId: string, type: string) => {
        set({
          edges: get().edges.map((edge) => {
            if (edge.id === edgeId) {
              return { ...edge, type };
            }
            return edge;
          }),
        });
      },

      updateEdge: (edgeId: string, data: Partial<Edge>) => {
        set({
          edges: get().edges.map((edge) => {
            if (edge.id === edgeId) {
              return { ...edge, ...data };
            }
            return edge;
          }),
        });
      },

      updateEdgeStyle: (edgeId: string, style: Record<string, any>) => {
        set({
          edges: get().edges.map((edge) => {
            if (edge.id === edgeId) {
              const updatedStyle = {
                ...(edge.style as Record<string, any> || {}),
                ...style,
              };
              
              // Synchronize marker colors with line color updates
              const markerEnd = edge.markerEnd && typeof edge.markerEnd === 'object'
                ? { ...edge.markerEnd, color: updatedStyle.stroke || (edge.markerEnd as any).color }
                : edge.markerEnd;
              const markerStart = edge.markerStart && typeof edge.markerStart === 'object'
                ? { ...edge.markerStart, color: updatedStyle.stroke || (edge.markerStart as any).color }
                : edge.markerStart;

              return {
                ...edge,
                style: updatedStyle,
                markerEnd,
                markerStart
              };
            }
            return edge;
          }),
        });
      },

      addChildNode: (parentId: string) => {
        const { nodes, edges } = get();
        const parentNode = nodes.find((n) => n.id === parentId);
        if (!parentNode) return;

        const newId = uuidv4();
        const shapeType = (parentNode.data as ShapeNodeData).shapeType || 'rectangle';
        const { width, height } = getDefaultNodeDimensions(shapeType);

        const newNode: Node = {
          id: newId,
          type: 'shape',
          parentId: parentNode.parentId, // Keep same parent group if child is nested
          extent: parentNode.parentId ? 'parent' : undefined,
          position: { x: parentNode.position.x + 250, y: parentNode.position.y },
          width: parentNode.width || width,
          height: parentNode.height || height,
          selected: true,
          data: {
            label: shapeType === 'image' ? '' : 'Child Node',
            shapeType,
            color: '#ffffff',
            borderColor: '#94a3b8',
            borderWidth: 2,
            fontSize: 14,
            align: 'center',
          } as ShapeNodeData,
        };

        const newEdge: Edge = {
          id: `e-${parentId}-${newId}`,
          source: parentId,
          target: newId,
          type: 'default',
          style: { strokeWidth: 2, stroke: '#94a3b8' },
          markerEnd: { type: MarkerType.ArrowClosed, width: 20, height: 20, color: '#94a3b8' }
        };

        const deselectedNodes = nodes.map(n => ({ ...n, selected: false }));
        set({ nodes: [...deselectedNodes, newNode], edges: [...edges, newEdge] });
      },

      addSiblingNode: (nodeId: string) => {
        const { nodes, edges } = get();
        const node = nodes.find((n) => n.id === nodeId);
        if (!node) return;

        // Find parent edge, ignoring group nodes as parent connections
        const parentEdge = edges.find((e) => e.target === nodeId && !e.source.startsWith('group-'));
        
        const newId = uuidv4();
        const shapeType = (node.data as ShapeNodeData).shapeType || 'rectangle';
        const { width, height } = getDefaultNodeDimensions(shapeType);

        const newNode: Node = {
          id: newId,
          type: 'shape',
          parentId: node.parentId, // Keep sibling node inside the same group
          extent: node.parentId ? 'parent' : undefined,
          position: { x: node.position.x, y: node.position.y + 120 },
          width: node.width || width,
          height: node.height || height,
          selected: true,
          data: {
            label: shapeType === 'image' ? '' : 'Sibling Node',
            shapeType,
            color: '#ffffff',
            borderColor: '#94a3b8',
            borderWidth: 2,
            fontSize: 14,
            align: 'center',
          } as ShapeNodeData,
        };

        const newEdges = [...edges];
        if (parentEdge) {
          newEdges.push({
            id: `e-${parentEdge.source}-${newId}`,
            source: parentEdge.source,
            target: newId,
            type: parentEdge.type || 'default',
            style: { strokeWidth: 2, stroke: '#94a3b8' },
            markerEnd: { type: MarkerType.ArrowClosed, width: 20, height: 20, color: '#94a3b8' }
          });
        }

        const deselectedNodes = nodes.map(n => ({ ...n, selected: false }));
        set({ nodes: [...deselectedNodes, newNode], edges: newEdges });
      },

      clearCanvas: () => {
        set({
          nodes: [],
          edges: [],
          activeCanvasId: null,
          activeFilterTag: null,
          isLocked: false,
          presentationMode: false,
          isAnimatingLayout: false,
          zoom: 1,
          boardNotes: '',
        });
        useDiagramStore.temporal.getState().clear();
      },

      bringToFront: (nodeId: string) => {
        const nodes = get().nodes;
        const maxZ = nodes.reduce((max, n) => {
          const z = typeof n.zIndex === 'number' ? n.zIndex : 0;
          return Math.max(max, z);
        }, 0);
        set({
          nodes: nodes.map(n =>
            n.id === nodeId
              ? { ...n, zIndex: maxZ + 1 }
              : n
          ),
        });
      },

      sendToBack: (nodeId: string) => {
        const nodes = get().nodes;
        const minZ = nodes.reduce((min, n) => {
          const z = typeof n.zIndex === 'number' ? n.zIndex : 0;
          return Math.min(min, z);
        }, 0);
        set({
          nodes: nodes.map(n =>
            n.id === nodeId
              ? { ...n, zIndex: minZ - 1 }
              : n
          ),
        });
      },

      toggleSnapToGrid: () => {
        set({ snapToGrid: !get().snapToGrid });
      },

      setGridSize: (size: number) => {
        set({ gridSize: size });
      },


      copySelection: () => {
        const { nodes, edges } = get();
        const selectedNodes = nodes.filter(n => n.selected);
        const selectedNodeIds = new Set(selectedNodes.map(n => n.id));
        const selectedEdges = edges.filter(e => e.selected || (selectedNodeIds.has(e.source) && selectedNodeIds.has(e.target)));
        
        if (selectedNodes.length > 0 || selectedEdges.length > 0) {
          // Deep-clone data so later edits to originals don't mutate the clipboard
          const clonedNodes = selectedNodes.map(n => ({
            ...n,
            data: deepCloneNodeData(n.data),
          }));
          const clonedEdges = selectedEdges.map(e => ({ ...e }));
          set({ clipboard: { nodes: clonedNodes, edges: clonedEdges } });
        }
      },

      pasteSelection: () => {
        const { clipboard, nodes, edges } = get();
        if (!clipboard) return;

        const newNodes: Node[] = [];
        const newEdges: Edge[] = [];
        const idMap = new Map<string, string>();

        // First pass: generate all new IDs
        clipboard.nodes.forEach(node => {
          idMap.set(node.id, uuidv4());
        });

        // Second pass: construct new nodes with resolved parentIds
        clipboard.nodes.forEach(node => {
          const newId = idMap.get(node.id)!;
          // Only preserve parentId if the parent is also in the clipboard (avoids dangling refs)
          const newParentId = node.parentId && idMap.has(node.parentId) ? idMap.get(node.parentId) : undefined;
          newNodes.push({
            ...node,
            id: newId,
            parentId: newParentId,
            extent: newParentId ? 'parent' : undefined,
            selected: true,
            // Clone data so the pasted node doesn't share references with the clipboard
            data: deepCloneNodeData(node.data),
            position: { x: node.position.x + 30, y: node.position.y + 30 }
          });
        });

        clipboard.edges.forEach(edge => {
          const newSource = idMap.get(edge.source);
          const newTarget = idMap.get(edge.target);
          
          // Only paste edge if both endpoints exist in the pasted selection
          if (newSource && newTarget) {
            newEdges.push({
              ...edge,
              id: uuidv4(),
              selected: true,
              source: newSource,
              target: newTarget
            });
          }
        });

        const currentNodes = nodes.map(n => ({ ...n, selected: false }));
        const currentEdges = edges.map(e => ({ ...e, selected: false }));

        set({
          nodes: [...currentNodes, ...newNodes],
          edges: [...currentEdges, ...newEdges],
        });
      },

      pasteImage: (imageUrl: string, position: { x: number; y: number }) => {
        const newId = uuidv4();
        const newNode: Node = {
          id: newId,
          type: 'shape',
          position,
          width: 200,
          height: 200,
          selected: true,
          data: {
            label: '',
            imageUrl,
            shapeType: 'image',
            color: '#ffffff',
            borderColor: '#94a3b8',
            borderWidth: 2,
            align: 'center',
          } as ShapeNodeData,
        };
        const updatedNodes = get().nodes.map(n => ({ ...n, selected: false }));
        set({ nodes: [...updatedNodes, newNode] });
      },

      duplicateSelectedNodes: () => {
        const { nodes, edges } = get();
        const selectedNodes = nodes.filter(n => n.selected);
        if (selectedNodes.length === 0) return;

        const idMap = new Map<string, string>();
        const offset = 30;

        // First pass: generate all new IDs
        selectedNodes.forEach(n => {
          idMap.set(n.id, uuidv4());
        });

        // Second pass: construct new nodes with resolved parentIds
        const newNodes = selectedNodes.map(n => {
          const newId = idMap.get(n.id)!;
          // Only preserve parentId if the parent is also selected (avoids dangling refs)
          const newParentId = n.parentId && idMap.has(n.parentId) ? idMap.get(n.parentId) : undefined;
          return {
            ...n,
            id: newId,
            parentId: newParentId,
            extent: newParentId ? ('parent' as const) : undefined,
            position: { x: n.position.x + offset, y: n.position.y + offset },
            selected: true,
            data: deepCloneNodeData(n.data),
          };
        });

        const selectedIds = new Set(selectedNodes.map(n => n.id));
        const newEdges = edges
          .filter(e => selectedIds.has(e.source) && selectedIds.has(e.target))
          .map(e => ({
            ...e,
            id: uuidv4(),
            source: idMap.get(e.source) || e.source,
            target: idMap.get(e.target) || e.target,
            selected: true,
          }));

        set({
          nodes: [...nodes.map(n => ({ ...n, selected: false })), ...newNodes],
          edges: [...edges, ...newEdges],
        });
      },

      alignSelectedNodes: (alignment) => {
        const { nodes } = get();
        const selectedNodes = nodes.filter(n => n.selected);
        if (selectedNodes.length < 2) return;

        const getDims = (n: Node) => ({
          w: n.measured?.width || n.width || 150,
          h: n.measured?.height || n.height || 50
        });

        const updatedNodes = nodes.map(n => {
          if (!n.selected) return n;
          
          let newPos = { ...n.position };
          
          if (alignment === 'left') {
            const minX = Math.min(...selectedNodes.map(sn => sn.position.x));
            newPos.x = minX;
          } else if (alignment === 'right') {
            const maxRight = Math.max(...selectedNodes.map(sn => sn.position.x + getDims(sn).w));
            newPos.x = maxRight - getDims(n).w;
          } else if (alignment === 'center') {
            const centers = selectedNodes.map(sn => sn.position.x + getDims(sn).w / 2);
            const avgCenter = centers.reduce((sum, c) => sum + c, 0) / selectedNodes.length;
            newPos.x = avgCenter - getDims(n).w / 2;
          } else if (alignment === 'top') {
            const minY = Math.min(...selectedNodes.map(sn => sn.position.y));
            newPos.y = minY;
          } else if (alignment === 'bottom') {
            const maxBottom = Math.max(...selectedNodes.map(sn => sn.position.y + getDims(sn).h));
            newPos.y = maxBottom - getDims(n).h;
          } else if (alignment === 'middle') {
            const middles = selectedNodes.map(sn => sn.position.y + getDims(sn).h / 2);
            const avgMiddle = middles.reduce((sum, m) => sum + m, 0) / selectedNodes.length;
            newPos.y = avgMiddle - getDims(n).h / 2;
          }
          
          return { ...n, position: newPos };
        });

        set({ nodes: updatedNodes });
      },

      groupNodes: () => {
        const { nodes } = get();
        // Allow grouping any selected nodes
        const selectedNodes = nodes.filter(n => n.selected);
        if (selectedNodes.length < 2) return;

        const padding = 20;
        let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;

        selectedNodes.forEach(n => {
          const w = n.measured?.width || n.width || 150;
          const h = n.measured?.height || n.height || 50;
          const absPos = getAbsolutePosition(n, nodes);
          if (absPos.x < minX) minX = absPos.x;
          if (absPos.y < minY) minY = absPos.y;
          if (absPos.x + w > maxX) maxX = absPos.x + w;
          if (absPos.y + h > maxY) maxY = absPos.y + h;
        });

        const groupId = `group-${uuidv4()}`;
        const groupWidth = maxX - minX + padding * 2;
        const groupHeight = maxY - minY + padding * 2;

        const groupNode: Node = {
          id: groupId,
          type: 'shape',
          position: { x: minX - padding, y: minY - padding },
          width: groupWidth,
          height: groupHeight,
          selected: true,
          style: { width: groupWidth, height: groupHeight, zIndex: -1 },
          data: {
            label: '',
            shapeType: 'rectangle',
            color: 'transparent',
            borderColor: '#94a3b8',
            borderWidth: 2,
          } as ShapeNodeData,
        };

        const updatedNodes = nodes.map(n => {
          if (selectedNodes.find(sn => sn.id === n.id)) {
            const absPos = getAbsolutePosition(n, nodes);
            return {
              ...n,
              selected: false,
              parentId: groupId,
              extent: 'parent' as const,
              position: {
                x: absPos.x - (minX - padding),
                y: absPos.y - (minY - padding)
              }
            };
          }
          return n;
        });

        set({ nodes: [groupNode, ...updatedNodes] });
      },

      ungroupNodes: (groupId: string) => {
        const { nodes, edges } = get();
        const groupNode = nodes.find(n => n.id === groupId);
        if (!groupNode) return;

        // For nested groups: re-parent direct children to the group's grandparent
        // (or detach to top-level if no grandparent). Children's positions are
        // converted from group-relative to the new parent's coordinate space by
        // adding the group's own relative position.
        const groupParentId = groupNode.parentId;

        const updatedNodes = nodes.filter(n => n.id !== groupId).map(n => {
          if (n.parentId === groupId) {
            return {
              ...n,
              parentId: groupParentId,
              extent: groupParentId ? ('parent' as const) : undefined,
              position: {
                x: n.position.x + groupNode.position.x,
                y: n.position.y + groupNode.position.y
              }
            };
          }
          return n;
        });

        const updatedEdges = edges.filter(e => e.source !== groupId && e.target !== groupId);

        set({ nodes: updatedNodes, edges: updatedEdges });
      },

      layoutDiagram: () => {
        const { nodes, edges } = get();
        if (nodes.length === 0) return;

        // 1. Identify parent-child relationships from edges
        const childrenMap = new Map<string, string[]>();
        const parentMap = new Map<string, string>();
        edges.forEach((edge) => {
          if (!childrenMap.has(edge.source)) {
            childrenMap.set(edge.source, []);
          }
          childrenMap.get(edge.source)!.push(edge.target);
          parentMap.set(edge.target, edge.source);
        });

        // 2. Find root nodes (nodes with no incoming connections). We do NOT exclude
        //    grouped nodes (parentId) here — layout should still arrange them.
        const rootNodes = nodes.filter((node) => !parentMap.has(node.id));

        // 3. Subtree height calculation
        const subtreeHeight = new Map<string, number>();
        const nodeHeightMap = new Map<string, number>();
        
        nodes.forEach(n => {
          nodeHeightMap.set(n.id, n.measured?.height || n.height || 80);
        });

        const getSubtreeHeight = (nodeId: string, visited: Set<string> = new Set()): number => {
          if (subtreeHeight.has(nodeId)) return subtreeHeight.get(nodeId)!;
          if (visited.has(nodeId)) return nodeHeightMap.get(nodeId) || 80; // cycle guard
          visited.add(nodeId);
          
          const children = childrenMap.get(nodeId) || [];
          if (children.length === 0) {
            const h = nodeHeightMap.get(nodeId) || 80;
            subtreeHeight.set(nodeId, h);
            return h;
          }
          const childrenHeight = children.reduce((sum, childId) => sum + getSubtreeHeight(childId, new Set(visited)), 0) + (children.length - 1) * 40;
          const selfHeight = nodeHeightMap.get(nodeId) || 80;
          const totalHeight = Math.max(selfHeight, childrenHeight);
          subtreeHeight.set(nodeId, totalHeight);
          return totalHeight;
        };

        // Pre-calculate heights
        rootNodes.forEach(root => getSubtreeHeight(root.id));

        // 4. Position nodes recursively
        const updatedNodes = [...nodes];
        
        const layoutNode = (nodeId: string, x: number, yCenter: number, visited: Set<string> = new Set()) => {
          if (visited.has(nodeId)) return; // cycle guard
          visited.add(nodeId);
          
          const nodeIdx = updatedNodes.findIndex(n => n.id === nodeId);
          if (nodeIdx === -1) return;
          
          const node = updatedNodes[nodeIdx];
          const w = node.measured?.width || node.width || 160;
          const h = node.measured?.height || node.height || 80;
          
          updatedNodes[nodeIdx] = {
            ...node,
            position: { x, y: yCenter - h / 2 }
          };
          
          const children = childrenMap.get(nodeId) || [];
          if (children.length === 0) return;
          
          const totalSubtreeH = getSubtreeHeight(nodeId);
          let startY = yCenter - totalSubtreeH / 2;
          
          children.forEach((childId) => {
            const childH = getSubtreeHeight(childId);
            const childCenterY = startY + childH / 2;
            layoutNode(childId, x + w + 100, childCenterY, new Set(visited));
            startY += childH + 40; // 40px spacing between siblings
          });
        };

        // Position all root nodes horizontally aligned, vertically stacked
        let rootY = 100;
        rootNodes.forEach((root) => {
          const rHeight = getSubtreeHeight(root.id);
          layoutNode(root.id, 100, rootY + rHeight / 2);
          rootY += rHeight + 120; // 120px spacing between independent trees
        });

        set({ nodes: updatedNodes });
      },

      loadTemplate: (templateName) => {
        const template = templates[templateName];
        if (!template) return;

        const idMap = new Map<string, string>();
        
        // 1. Generate new UUIDs for all nodes
        template.nodes.forEach(n => {
          idMap.set(n.id, uuidv4());
        });

        // 2. Create the Node objects
        const newNodes: Node[] = template.nodes.map(n => {
          const newId = idMap.get(n.id)!;
          const { width, height } = getDefaultNodeDimensions(n.shapeType);
          
          return {
            id: newId,
            type: 'shape',
            position: { x: n.x, y: n.y },
            width: n.width || width,
            height: n.height || height,
            data: {
              label: n.label,
              shapeType: n.shapeType,
              color: n.color || (n.shapeType === 'sticky' ? '#fef08a' : '#ffffff'),
              borderColor: n.borderColor || (n.shapeType === 'sticky' ? '#eab308' : '#94a3b8'),
              borderWidth: n.borderWidth || 2,
              fontSize: n.fontSize || 14,
              align: 'center',
              bold: n.bold || false,
            } as ShapeNodeData
          };
        });

        // 3. Create the Edge objects
        const newEdges: Edge[] = template.edges.map(e => {
          const newSource = idMap.get(e.source)!;
          const newTarget = idMap.get(e.target)!;
          const stroke = e.style?.stroke || '#94a3b8';
          const strokeWidth = e.style?.strokeWidth || 2;
          
          let markerEnd = undefined;
          let markerStart = undefined;
          
          if (e.markerType === 'directed' || !e.markerType) {
            markerEnd = { type: MarkerType.ArrowClosed, width: 20, height: 20, color: stroke };
          } else if (e.markerType === 'bidirectional') {
            markerEnd = { type: MarkerType.ArrowClosed, width: 20, height: 20, color: stroke };
            markerStart = { type: MarkerType.ArrowClosed, width: 20, height: 20, color: stroke };
          }

          return {
            id: `e-${newSource}-${newTarget}-${uuidv4()}`,
            source: newSource,
            target: newTarget,
            type: 'default',
            label: e.label,
            animated: e.animated || false,
            style: { stroke, strokeWidth },
            markerEnd,
            markerStart
          };
        });

        set({
          nodes: newNodes,
          edges: newEdges,
          fileHandle: null,
          fileName: null
        });
        useDiagramStore.temporal.getState().clear();
      },

      setShowHelpModal: (show) => {
        set({ showHelpModal: show });
      },

      setReactFlowInstance: (instance) => {
        set({ reactFlowInstance: instance });
      },

      setGridType: (type) => {
        set({ gridType: type });
      },

      setPresentationMode: (active) => {
        if (active) {
          const { nodes, edges } = get();
          set({
            presentationMode: active,
            nodes: nodes.map(n => ({ ...n, selected: false })),
            edges: edges.map(e => ({ ...e, selected: false }))
          });
        } else {
          set({ presentationMode: active });
        }
      },

      setCanvasColor: (color) => {
        set({ canvasColor: color });
      },

      updateNodesData: (nodeIds, data) => {
        set({
          nodes: get().nodes.map((node) => {
            if (nodeIds.includes(node.id)) {
              const updatedData = { ...node.data, ...data };
              return {
                ...node,
                data: updatedData,
                draggable: updatedData.locked ? false : undefined,
              };
            }
            return node;
          }),
        });
      },

      projectId: null,
      projectName: null,

      setFileDetails: (handle, name) => {
        set({ fileHandle: handle, fileName: name });
      },

      setProjectDetails: (id, name) => {
        set({ projectId: id, projectName: name });
      },

      loadProject: (state) => {
        set({
          nodes: state.nodes || [],
          edges: state.edges || [],
          theme: state.theme || 'light',
          snapToGrid: state.snapToGrid ?? true,
          gridSize: state.gridSize || 20,
          boardNotes: state.boardNotes || '',
          gridType: state.gridType || 'dots',
          canvasColor: state.canvasColor || null,
          // Reset transient state to avoid getting trapped in presentation mode,
          // locked canvas, or a now-deleted portal after loading a project.
          activeCanvasId: null,
          activeFilterTag: null,
          isLocked: false,
          presentationMode: false,
          isAnimatingLayout: false,
          zoom: 1,
          fileHandle: null,
          fileName: null,
        });
        useDiagramStore.temporal.getState().clear();
      },

      setBoardNotes: (notes) => {
        set({ boardNotes: notes });
      },

      distributeSelectedNodes: (direction) => {
        const { nodes } = get();
        const selectedNodes = nodes.filter(n => n.selected);
        if (selectedNodes.length < 3) return;

        const getDims = (n: Node) => ({
          w: n.measured?.width || n.width || 150,
          h: n.measured?.height || n.height || 50,
        });

        if (direction === 'horizontal') {
          const sorted = [...selectedNodes].sort((a, b) => a.position.x - b.position.x);
          const first = sorted[0];
          const last = sorted[sorted.length - 1];
          // Gap based on right-edge of first → left-edge of last, minus total node widths
          const totalWidths = sorted.reduce((sum, n) => sum + getDims(n).w, 0);
          const availableSpace = (last.position.x + getDims(last).w) - first.position.x - totalWidths;
          const gapSize = sorted.length > 1 ? availableSpace / (sorted.length - 1) : 0;

          const updatedNodes = nodes.map(n => {
            if (!n.selected) return n;
            const index = sorted.findIndex(sn => sn.id === n.id);
            // Compute x: cumulative left-edge based on prior node widths + gaps
            let xPos = first.position.x;
            for (let i = 0; i < index; i++) {
              xPos += getDims(sorted[i]).w + gapSize;
            }
            return {
              ...n,
              position: {
                ...n.position,
                x: xPos
              }
            };
          });
          set({ nodes: updatedNodes });
        } else {
          const sorted = [...selectedNodes].sort((a, b) => a.position.y - b.position.y);
          const first = sorted[0];
          const last = sorted[sorted.length - 1];
          const totalHeights = sorted.reduce((sum, n) => sum + getDims(n).h, 0);
          const availableSpace = (last.position.y + getDims(last).h) - first.position.y - totalHeights;
          const gapSize = sorted.length > 1 ? availableSpace / (sorted.length - 1) : 0;

          const updatedNodes = nodes.map(n => {
            if (!n.selected) return n;
            const index = sorted.findIndex(sn => sn.id === n.id);
            let yPos = first.position.y;
            for (let i = 0; i < index; i++) {
              yPos += getDims(sorted[i]).h + gapSize;
            }
            return {
              ...n,
              position: {
                ...n.position,
                y: yPos
              }
            };
          });
          set({ nodes: updatedNodes });
        }
      },

      arrangeSelectedNodesAsTree: () => {
        const { nodes, edges } = get();
        const selectedNodes = nodes.filter(n => n.selected);
        if (selectedNodes.length === 0) return;

        const selectedIds = new Set(selectedNodes.map(n => n.id));
        const selectedEdges = edges.filter(e => selectedIds.has(e.source) && selectedIds.has(e.target));
        
        const parentMap = new Map<string, string>();
        const childrenMap = new Map<string, string[]>();
        selectedEdges.forEach(e => {
          parentMap.set(e.target, e.source);
          if (!childrenMap.has(e.source)) childrenMap.set(e.source, []);
          childrenMap.get(e.source)!.push(e.target);
        });

        const roots = selectedNodes.filter(n => !parentMap.has(n.id));
        if (roots.length === 0 && selectedNodes.length > 0) {
          roots.push(selectedNodes[0]);
        }

        const startX = roots[0].position.x;
        const startY = roots[0].position.y;
        const updatedPositions = new Map<string, { x: number; y: number }>();

        const layoutSubtree = (nodeId: string, x: number, y: number, visited: Set<string> = new Set()): number => {
          // Cycle guard — bail if we've already visited this node in this pass
          if (visited.has(nodeId)) return 0;
          visited.add(nodeId);

          updatedPositions.set(nodeId, { x, y });
          const children = childrenMap.get(nodeId) || [];
          if (children.length === 0) return 180;

          let totalWidth = 0;
          const childWidths: number[] = [];
          children.forEach(c => {
            if (visited.has(c)) return; // skip cycles
            const w = layoutSubtree(c, 0, y + 150, new Set(visited));
            childWidths.push(w);
            totalWidth += w;
          });

          let curX = x - totalWidth / 2;
          children.forEach((c, idx) => {
            if (visited.has(c) && !updatedPositions.has(c)) return;
            const childW = childWidths[idx] || 180;
            const targetX = curX + childW / 2;
            const pos = updatedPositions.get(c);
            if (pos) {
              const dx = targetX - pos.x;
              updatedPositions.set(c, { x: targetX, y: pos.y });
              offsetSubtree(c, dx, new Set(visited));
            }
            curX += childW;
          });

          return totalWidth;
        };

        const offsetSubtree = (nodeId: string, dx: number, visited: Set<string>) => {
          if (visited.has(nodeId)) return;
          visited.add(nodeId);
          const children = childrenMap.get(nodeId) || [];
          children.forEach(c => {
            const pos = updatedPositions.get(c);
            if (pos) {
              updatedPositions.set(c, { x: pos.x + dx, y: pos.y });
              offsetSubtree(c, dx, visited);
            }
          });
        };

        let currentRootX = startX;
        roots.forEach(r => {
          const subtreeW = layoutSubtree(r.id, currentRootX, startY);
          // Use the actual subtree width (with padding) so multiple roots don't overlap
          currentRootX += Math.max(400, subtreeW + 100);
        });

        const updatedNodes = nodes.map(n => {
          if (updatedPositions.has(n.id)) {
            return {
              ...n,
              position: updatedPositions.get(n.id)!
            };
          }
          return n;
        });

        set({ nodes: updatedNodes });
      },
      setActiveFilterTag: (tag) => {
        set({ activeFilterTag: tag });
      },

      selectNode: (nodeId) => {
        set({
          nodes: get().nodes.map(n => ({ ...n, selected: nodeId ? n.id === nodeId : false })),
        });
      }
    }),
    {
      name: 'nodecraft-storage',
      partialize: (state) => {
        // Exclude ALL transient UI/session state — only persist document + settings.
        // If you forget to exclude something here, the app can reload trapped in
        // presentation mode, locked canvas, or a now-deleted portal.
        const {
          fileHandle,
          fileName,
          projectId,
          projectName,
          clipboard,
          reactFlowInstance,
          showHelpModal,
          isAnimatingLayout,
          zoom,
          activeCanvasId,
          isLocked,
          presentationMode,
          activeFilterTag,
          ...rest
        } = state;
        return rest;
      }
    }
  ),
  {
    partialize: (state) => ({ nodes: state.nodes, edges: state.edges }),
    limit: 100,
    handleSet: (handleSet) => {
      let timeout: ReturnType<typeof setTimeout> | null;
      return (state) => {
        if (timeout) clearTimeout(timeout);
        timeout = setTimeout(() => {
          handleSet(state);
        }, 250); // 250ms is perfect for combining quick continuous changes
      };
    }
  }
)
);
