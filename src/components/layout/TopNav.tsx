import { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useShallow } from 'zustand/react/shallow';
import { useDiagramStore, getAbsolutePosition, getDiagramData } from '../../store/useDiagramStore';
import type { FileSystemFileHandle } from '../../types/diagram';
import { api } from '../../utils/api';
import { 
  Download, 
  Image as ImageIcon, 
  Trash2, 
  Sun, 
  Moon, 
  ZoomIn, 
  ZoomOut, 
  Maximize,
  HelpCircle,
  Undo2,
  Redo2,
  Share2,
  ChevronDown,
  FolderOpen,
  Save,
  FilePlus,
  Sparkles,
  LayoutTemplate,
  Search,
  Lock,
  Unlock,
  FileJson,
  Printer,
  ArrowLeft,
  GitBranch,
  History
} from 'lucide-react';
import { exportNodesToPng, downloadDataUrl } from '../../utils/pngExport';
import { parseMermaid } from '../../utils/mermaid';
import { MermaidImportModal } from '../ui/MermaidImportModal';
import { VersionHistoryModal } from '../ui/VersionHistoryModal';
import type { Node as RFNode } from '@xyflow/react';
import { exportToSVG, downloadSVG } from '../../utils/svgExport';
import { useToast } from '../../context/ToastContext';

function useClickOutside(ref: React.RefObject<HTMLElement | null>, handler: () => void) {
  const handlerRef = useRef(handler);
  handlerRef.current = handler;
  useEffect(() => {
    const listener = (event: MouseEvent) => {
      if (ref.current && !ref.current.contains(event.target as Node)) {
        handlerRef.current();
      }
    };
    document.addEventListener('mousedown', listener);
    return () => document.removeEventListener('mousedown', listener);
  }, [ref]);
}

const isMac = typeof window !== 'undefined' && /Mac|iPod|iPhone|iPad/.test(navigator.platform || navigator.userAgent);
const pendingCloudSaves = new Map<string, Promise<unknown>>();

export function TopNav() {
  const navigate = useNavigate();
  const clearCanvas = useDiagramStore((state) => state.clearCanvas);
  const nodes = useDiagramStore((state) => state.nodes);
  const edges = useDiagramStore((state) => state.edges);
  const theme = useDiagramStore((state) => state.theme);
  const canvasColor = useDiagramStore((state) => state.canvasColor);
  const toggleTheme = useDiagramStore((state) => state.toggleTheme);
  const fileHandle = useDiagramStore((state) => state.fileHandle);
  const fileName = useDiagramStore((state) => state.fileName);
  const projectId = useDiagramStore((state) => state.projectId);
  const projectName = useDiagramStore((state) => state.projectName);
  const setFileDetails = useDiagramStore((state) => state.setFileDetails);
  const setProjectDetails = useDiagramStore((state) => state.setProjectDetails);
  const loadProject = useDiagramStore((state) => state.loadProject);
  const triggerShakeToAlign = useDiagramStore((state) => state.triggerShakeToAlign);
  const loadTemplate = useDiagramStore((state) => state.loadTemplate);
  const setShowHelpModal = useDiagramStore((state) => state.setShowHelpModal);
  const activeFilterTag = useDiagramStore((state) => state.activeFilterTag);
  const setActiveFilterTag = useDiagramStore((state) => state.setActiveFilterTag);
  const reactFlowInstance = useDiagramStore((state) => state.reactFlowInstance);
  const zoom = useDiagramStore((state) => state.zoom);
  const isLocked = useDiagramStore((state) => state.isLocked);
  const setIsLocked = useDiagramStore((state) => state.setIsLocked);
  const lastSavedSnapshot = useDiagramStore((state) => state.lastSavedSnapshot);
  const markSaved = useDiagramStore((state) => state.markSaved);
  const presentationMode = useDiagramStore((state) => state.presentationMode);
  const diagramData = useDiagramStore(useShallow(getDiagramData));
  const currentSnapshot = useMemo(() => JSON.stringify(diagramData), [diagramData]);
  
  const { showToast } = useToast();
  const [saveStatus, setSaveStatus] = useState<'saved' | 'saving' | 'unsaved'>('saved');
  
  // Dropdown states
  const [menuOpen, setMenuOpen] = useState(false);
  const [templateOpen, setTemplateOpen] = useState(false);
  const [exportOpen, setExportOpen] = useState(false);
  const [mermaidOpen, setMermaidOpen] = useState(false);
  const [versionsOpen, setVersionsOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const templateRef = useRef<HTMLDivElement>(null);
  const exportRef = useRef<HTMLDivElement>(null);

  useClickOutside(menuRef, useCallback(() => setMenuOpen(false), []));
  useClickOutside(templateRef, useCallback(() => setTemplateOpen(false), []));
  useClickOutside(exportRef, useCallback(() => setExportOpen(false), []));

  // Search functionality
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<RFNode[]>([]);
  const [searchFocused, setSearchFocused] = useState(false);
  const searchContainerRef = useRef<HTMLDivElement>(null);

  // Zoom input
  const [zoomEditing, setZoomEditing] = useState(false);
  const [zoomInput, setZoomInput] = useState('');

  const uniqueTags = Array.from(
    new Set(
      nodes
        .flatMap((node) => (node.data as any)?.tags || [])
        .filter((tag): tag is string => typeof tag === 'string' && tag.trim().length > 0)
    )
  );

  useEffect(() => {
    if (!searchQuery.trim()) {
      setSearchResults([]);
      return;
    }
    const query = searchQuery.toLowerCase();
    const matches = nodes.filter(node => 
      node.type === 'shape' && 
      ((node.data as any).label || '').toLowerCase().includes(query)
    );
    setSearchResults(matches);
  }, [searchQuery, nodes]);

  useEffect(() => {
    const handleOutsideClick = (e: MouseEvent) => {
      if (searchContainerRef.current && !searchContainerRef.current.contains(e.target as Node)) {
        setSearchFocused(false);
      }
    };
    document.addEventListener('mousedown', handleOutsideClick);
    return () => document.removeEventListener('mousedown', handleOutsideClick);
  }, []);

  // Listen for palette-triggered Mermaid import
  useEffect(() => {
    const openMermaid = () => setMermaidOpen(true);
    const openVersions = () => {
      if (useDiagramStore.getState().projectId) setVersionsOpen(true);
      else showToast('Version history is available for cloud projects', 'warning');
    };
    window.addEventListener('nodecraft-open-mermaid', openMermaid);
    window.addEventListener('nodecraft-open-versions', openVersions);
    return () => {
      window.removeEventListener('nodecraft-open-mermaid', openMermaid);
      window.removeEventListener('nodecraft-open-versions', openVersions);
    };
  }, [showToast]);

  const handleVersionRestored = (data: any, name: string) => {
    const store = useDiagramStore.getState();
    store.loadProject({ ...data, nodes: data.nodes || [], edges: data.edges || [] });
    if (projectId && name) store.setProjectDetails(projectId, name);
    // loadProject snapshots restored state as saved — correct: server file IS this state now
    setTimeout(() => reactFlowInstance?.fitView({ duration: 400, padding: 0.15 }), 60);
  };

  const handleMermaidImport = (text: string) => {
    try {
      const result = parseMermaid(text);
      if (result.nodes.length === 0) {
        showToast('Nothing to import — check the diagram syntax', 'warning');
        return;
      }
      useDiagramStore.setState({
        nodes: result.nodes,
        edges: result.edges,
        lastSavedSnapshot: null,
        fileHandle: null,
        fileName: null,
      });
      useDiagramStore.temporal.getState().clear();
      setMermaidOpen(false);
      setTimeout(() => reactFlowInstance?.fitView({ duration: 500, padding: 0.15 }), 80);
      showToast(`Imported ${result.nodes.length} nodes · ${result.edges.length} edges from Mermaid`, 'success');
    } catch (err: any) {
      console.error('Mermaid import failed:', err);
      showToast('Failed to import Mermaid diagram', 'error');
    }
  };

  const handleNavigate = (node: RFNode) => {
    if (reactFlowInstance && typeof reactFlowInstance.setCenter === 'function') {
      const { nodes: allNodes } = useDiagramStore.getState();
      const absPos = getAbsolutePosition(node, allNodes);
      const x = absPos.x + (node.measured?.width || node.width || 100) / 2;
      const y = absPos.y + (node.measured?.height || node.height || 80) / 2;
      reactFlowInstance.setCenter(x, y, { zoom: 1.2, duration: 800 });
      
      useDiagramStore.setState({
        nodes: allNodes.map((n) => ({
          ...n,
          selected: n.id === node.id,
        })),
      });
      
      setSearchFocused(false);
      setSearchQuery('');
      showToast(`Centered on: ${(node.data as any).label || 'Unnamed shape'}`, 'success');
    } else {
      showToast('Click nodes to navigate once loaded', 'warning');
    }
  };

  const handleNew = async () => {
    // Dirtiness check: if state is already saved to snapshot, avoid false warning;
    // otherwise check for any non-default content (multiple nodes, custom label, or connected edges).
    const hasEdges = edges.length > 0;
    const hasNonDefaultNodes = nodes.length > 1 ||
      (nodes.length === 1 && (nodes[0].data as { label?: string })?.label !== 'Start Here');

    let isDirty = false;
    if (lastSavedSnapshot) {
      const current = currentSnapshot;
      isDirty = current !== lastSavedSnapshot;
    } else {
      isDirty = hasEdges || hasNonDefaultNodes;
    }

    if (isDirty) {
      if (!confirm('Create new diagram? Any unsaved changes will be lost.')) {
        return;
      }
    }
    setMenuOpen(false);

    if (projectId) {
      try {
        const res = await api.post('/projects', { name: 'Untitled Diagram' });
        if (res.project && res.project.id) {
          showToast('Created new project', 'success');
          navigate(`/project/${res.project.id}`);
          return;
        }
      } catch (err: any) {
        console.error('Failed to create project:', err);
        showToast(err?.message || 'Failed to create new project', 'error');
        return;
      }
    }

    clearCanvas();
    setFileDetails(null, null);
    setProjectDetails(null, null);
  };

  const handleOpen = async () => {
    setMenuOpen(false);
    
    if (!('showOpenFilePicker' in window)) {
      const input = document.createElement('input');
      input.type = 'file';
      input.accept = '.ncraft,.json,application/json';
      input.onchange = async (e: any) => {
        const file = e.target.files[0];
        if (!file) return;
        try {
          const text = await file.text();
          const data = JSON.parse(text);
          loadProject(data);
          setFileDetails(null, file.name);
          showToast(`Loaded ${file.name}`, 'success');
        } catch (error) {
          console.error(error);
          showToast('Failed to parse file', 'error');
        }
      };
      input.click();
      return;
    }

    try {
      // @ts-ignore
      const [handle] = await window.showOpenFilePicker({
        types: [{
          description: 'NodeCraft Diagram',
          accept: { 'application/json': ['.ncraft', '.json'] },
        }],
      });
      const file = await handle.getFile();
      const text = await file.text();
      const data = JSON.parse(text);
      
      loadProject(data);
      setFileDetails(handle, file.name);
      showToast(`Loaded ${file.name}`, 'success');
    } catch (error: any) {
      if (error.name !== 'AbortError') {
        console.error(error);
        showToast('Failed to open file', 'error');
      }
    }
  };

  // Monotonic save revision: lets a stale save detect that a newer save
  // started after it, so it can skip settling the status (see below).
  const saveRevisionRef = useRef(0);
  useEffect(() => () => { saveRevisionRef.current += 1; }, []);

  const handleCloudSave = useCallback(async (silent = false) => {
    if (!projectId) return;
    // Monotonic revision so a stale save that resolves AFTER a newer save
    // started can't clobber the newer status/snapshot (out-of-order resolves).
    const revision = ++saveRevisionRef.current;
    let request: Promise<unknown> | undefined;
    try {
      setSaveStatus('saving');
      const state = useDiagramStore.getState();
      const diagramData = getDiagramData(state);
      // Snapshot the EXACT payload being uploaded — taking it after the await
      // would mark mid-save edits as saved without uploading them.
      const snapshot = JSON.stringify(diagramData);

      const send = () => api.put(`/projects/${projectId}`, {
        data: diagramData,
        name: projectName || 'Untitled Diagram',
      });
      // Serialize writes even if the editor unmounts and reopens the same project.
      const previous = pendingCloudSaves.get(projectId);
      request = previous ? previous.then(send, send) : send();
      pendingCloudSaves.set(projectId, request);
      await request;

      // A newer save started after this one — its outcome (and its
      // markSaved/setSaveStatus) is authoritative; don't clobber it.
      if (revision !== saveRevisionRef.current || useDiagramStore.getState().projectId !== projectId) return;
      markSaved(snapshot);
      setSaveStatus('saved');
      if (!silent) {
        showToast('Saved to cloud', 'success');
      }
    } catch (err) {
      if (revision !== saveRevisionRef.current || useDiagramStore.getState().projectId !== projectId) return;
      console.error('Failed to save project:', err);
      setSaveStatus('unsaved');
      if (!silent) {
        showToast('Failed to save to cloud', 'error');
      }
    } finally {
      if (pendingCloudSaves.get(projectId) === request) pendingCloudSaves.delete(projectId);
    }
  }, [projectId, projectName, showToast, markSaved]);

  useEffect(() => {
    const save = () => {
      if (projectId) void handleCloudSave();
      else showToast('No cloud project open', 'warning');
    };
    window.addEventListener('nodecraft-save-cloud', save);
    return () => window.removeEventListener('nodecraft-save-cloud', save);
  }, [projectId, handleCloudSave, showToast]);

  // 3-second debounced auto-save effect — skip when no actual edits since last save/load
  useEffect(() => {
    if (!projectId) return;
    if (lastSavedSnapshot && currentSnapshot === lastSavedSnapshot) {
      setSaveStatus('saved');
      return;
    }
    setSaveStatus('unsaved');
    const timer = setTimeout(() => {
      handleCloudSave(true);
    }, 3000);

    return () => clearTimeout(timer);
  }, [currentSnapshot, projectId, handleCloudSave, lastSavedSnapshot]);

  const saveToFileHandle = async (handle: FileSystemFileHandle) => {
    let writable: FileSystemWritableFileStream | undefined;
    try {
      writable = await handle.createWritable();
      const { nodes, edges, theme, snapToGrid, gridSize, boardNotes, gridType, canvasColor } = useDiagramStore.getState();
      const data = { nodes, edges, theme, snapToGrid, gridSize, boardNotes, gridType, canvasColor };
      await writable.write(JSON.stringify(data, null, 2));
      await writable.close();
      return true;
    } catch (error) {
      console.error(error);
      if (writable && typeof writable.abort === 'function') {
        try { await writable.abort(); } catch {}
      }
      return false;
    }
  };

  const handleSave = async () => {
    setMenuOpen(false);
    if (projectId) {
      await handleCloudSave(false);
      return;
    }
    if (fileHandle && typeof fileHandle.createWritable === 'function') {
      const success = await saveToFileHandle(fileHandle);
      if (success) {
        showToast('Project saved', 'success');
      } else {
        handleSaveAs();
      }
    } else {
      handleSaveAs();
    }
  };

  const fallbackDownload = () => {
    // Read ALL state from the store at call time — closure values captured at
    // render time would be stale if the user changed settings (theme, gridSize, etc.)
    // after this component rendered but before clicking save.
    const state = useDiagramStore.getState();
    const data = {
      nodes: state.nodes,
      edges: state.edges,
      theme: state.theme,
      snapToGrid: state.snapToGrid,
      gridSize: state.gridSize,
      boardNotes: state.boardNotes,
      gridType: state.gridType,
      canvasColor: state.canvasColor,
    };
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = fileName || 'Untitled Diagram.ncraft';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    showToast('Project downloaded', 'success');
  };

  const handleSaveAs = async () => {
    setMenuOpen(false);
    
    if (!('showSaveFilePicker' in window)) {
      fallbackDownload();
      return;
    }

    try {
      // @ts-ignore
      const handle = await window.showSaveFilePicker({
        suggestedName: fileName || 'Untitled Diagram.ncraft',
        types: [{
          description: 'NodeCraft Diagram',
          accept: { 'application/json': ['.ncraft'] },
        }],
      });
      
      const success = await saveToFileHandle(handle);
      if (success) {
        const file = await handle.getFile();
        setFileDetails(handle, file.name);
        showToast(`Saved as ${file.name}`, 'success');
      } else {
        fallbackDownload();
      }
    } catch (error: any) {
      if (error.name !== 'AbortError') {
        console.error(error);
        fallbackDownload();
      }
    }
  };

  const handleExport = async (format: 'png' | 'svg') => {
    if (nodes.length === 0) {
      showToast('No content to export', 'warning');
      return;
    }

    setExportOpen(false);

    const getFilename = (ext: string) => {
      const name = (projectName || fileName || 'nodecraft-diagram').replace(/[^a-zA-Z0-9_-]/g, '_').substring(0, 100) || 'nodecraft-diagram';
      return `${name}.${ext}`;
    };

    if (format === 'svg') {
      try {
        const isDark = theme === 'dark';
        const backgroundColor = canvasColor || (isDark ? '#0f172a' : '#f8fafc');
        const svgContent = exportToSVG(nodes, edges, {
          padding: 50,
          includeBackground: true,
          backgroundColor
        });
        downloadSVG(svgContent, getFilename('svg'));
        showToast('Diagram exported as SVG', 'success');
      } catch (error) {
        console.error('Error exporting SVG:', error);
        showToast('Failed to export SVG', 'error');
      }
      return;
    }
    
    if (format === 'png') {
      try {
        const backgroundColor = canvasColor || (theme === 'dark' ? '#0f172a' : '#f8fafc');
        const result = await exportNodesToPng(nodes, { backgroundColor });
        if (!result.ok) {
          if (result.reason === 'no-viewport') {
            showToast('Canvas not ready — try again', 'warning');
          } else {
            console.error('Error exporting PNG:', result.error);
            showToast('Failed to export diagram', 'error');
          }
          return;
        }
        downloadDataUrl(result.dataUrl, getFilename('png'));
        showToast(
          result.pixelRatio < 1
            ? 'Exported PNG (downscaled to fit large diagram)'
            : 'Diagram exported as PNG',
          'success'
        );
      } catch (err) {
        console.error('Error exporting PNG:', err);
        showToast('Failed to export diagram', 'error');
      }
    }
  };

  const handleExportJSON = () => {
    try {
      const state = useDiagramStore.getState();
      const projectData = {
        version: '1.0.0',
        nodes: state.nodes,
        edges: state.edges,
        theme: state.theme,
        snapToGrid: state.snapToGrid,
        gridSize: state.gridSize,
        boardNotes: state.boardNotes,
        gridType: state.gridType,
        canvasColor: state.canvasColor,
      };
      
      const jsonString = JSON.stringify(projectData, null, 2);
      const blob = new Blob([jsonString], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      
      const link = document.createElement('a');
      link.href = url;
      const baseName = (projectName || fileName || 'nodecraft-project').replace(/\.json$/, '');
      link.download = `${baseName}.json`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      
      setTimeout(() => URL.revokeObjectURL(url), 1000);
      showToast('Project exported as JSON successfully', 'success');
      setExportOpen(false);
    } catch (error) {
      console.error('Error exporting JSON project:', error);
      showToast('Failed to export JSON project', 'error');
    }
  };

  const handleImportJSON = () => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.json';
    input.onchange = async (e) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (!file) return;
      try {
        const text = await file.text();
        const projectData = JSON.parse(text);
        if (!projectData.nodes || !Array.isArray(projectData.nodes)) {
          throw new Error('Invalid project file format (missing nodes)');
        }
        loadProject(projectData);
        setFileDetails(null, file.name);
        showToast(`Successfully imported project: ${file.name}`, 'success');
      } catch (error: any) {
        showToast(`Import failed: ${error.message || 'Invalid JSON'}`, 'error');
      }
    };
    input.click();
    setMenuOpen(false);
  };

  const handleClear = () => {
    if (nodes.length === 0) {
      showToast('Canvas is already empty', 'info');
      return;
    }
    if (!window.confirm('Are you sure you want to clear the canvas? This will permanently delete all nodes and edges.')) {
      return;
    }
    clearCanvas();
    // clearCanvas already resets transient state (activeCanvasId, presentationMode, etc.)
    // but we also need to clear file details so the “Saved” badge disappears.
    setFileDetails(null, null);
    showToast('Canvas cleared', 'success');
  };

  const handleZoomClick = () => {
    setZoomEditing(true);
    setZoomInput(Math.round(zoom * 100).toString());
  };

  const handleZoomSubmit = () => {
    const val = parseInt(zoomInput);
    if (!isNaN(val) && val >= 10 && val <= 500) {
      if (reactFlowInstance) {
        reactFlowInstance.zoomTo(val / 100, { duration: 300 });
      }
    }
    setZoomEditing(false);
  };
  const handlersRef = useRef({ handleNew, handleOpen, handleSave, handleSaveAs });
  useEffect(() => {
    handlersRef.current = { handleNew, handleOpen, handleSave, handleSaveAs };
  });

  useEffect(() => {
    if (presentationMode) return;
    const handleFileShortcuts = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLElement) {
        if (
          e.target.tagName === 'INPUT' ||
          e.target.tagName === 'TEXTAREA' ||
          e.target.tagName === 'SELECT' ||
          e.target.isContentEditable
        ) {
          return;
        }
      }

      const isMod = e.ctrlKey || e.metaKey;

      if (isMod && e.key.toLowerCase() === 's') {
        e.preventDefault();
        if (e.shiftKey) {
          handlersRef.current.handleSaveAs();
        } else {
          handlersRef.current.handleSave();
        }
      } else if (isMod && e.key.toLowerCase() === 'o') {
        e.preventDefault();
        handlersRef.current.handleOpen();
      } else if (isMod && e.key.toLowerCase() === 'n') {
        e.preventDefault();
        handlersRef.current.handleNew();
      }
    };

    window.addEventListener('keydown', handleFileShortcuts);
    return () => window.removeEventListener('keydown', handleFileShortcuts);
  }, [presentationMode]);
  const btnClass = "p-1.5 text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-slate-800 hover:text-gray-700 dark:hover:text-gray-200 rounded-md transition-all active:scale-95";
  const textBtnClass = "flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-slate-800 rounded-md transition-all active:scale-95";

  if (presentationMode) return null;

  return (
    <nav className="h-11 border-b border-gray-200/80 dark:border-gray-800/80 bg-white/90 dark:bg-slate-900/90 backdrop-blur-sm flex items-center justify-between px-3 z-50 relative">
      {/* Left Section */}
      <div className="flex items-center gap-1.5">
        {/* Dashboard Navigation */}
        <button
          onClick={() => navigate('/dashboard')}
          className="flex items-center gap-1.5 px-2 py-1 text-xs font-semibold text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-slate-800 rounded-lg transition-colors mr-1"
          title="Back to Dashboard"
        >
          <ArrowLeft size={14} className="text-blue-500" />
          <span className="hidden sm:inline">Dashboard</span>
        </button>

        <div className="text-gray-300 dark:text-gray-600 text-xs hidden sm:block">/</div>

        {/* Project Title & Badge */}
        <div className="flex items-center gap-2 px-1 py-0.5">
          <div className="text-xs font-medium text-gray-700 dark:text-gray-300 flex items-center truncate max-w-[140px] sm:max-w-[220px]" title={projectName || fileName || 'Untitled Diagram'}>
            <span className="truncate font-semibold">{projectName || fileName || 'Untitled Diagram'}</span>
            {projectId ? (
              saveStatus === 'saving' ? (
                <span className="ml-2 inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[9px] bg-blue-50 dark:bg-blue-950/40 text-blue-600 dark:text-blue-400 border border-blue-100 dark:border-blue-800/40 font-semibold shrink-0">
                  <span className="w-1 h-1 bg-blue-500 rounded-full animate-ping" />
                  Saving...
                </span>
              ) : saveStatus === 'saved' ? (
                <span className="ml-2 inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[9px] bg-emerald-50 dark:bg-emerald-950/30 text-emerald-600 dark:text-emerald-400 border border-emerald-100 dark:border-emerald-800/40 font-semibold shrink-0">
                  <span className="w-1 h-1 bg-emerald-500 rounded-full animate-pulse" />
                  Cloud Saved
                </span>
              ) : (
                <span className="ml-2 inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[9px] bg-amber-50 dark:bg-amber-950/30 text-amber-600 dark:text-amber-400 border border-amber-100 dark:border-amber-800/40 font-semibold shrink-0">
                  <span className="w-1 h-1 bg-amber-500 rounded-full" />
                  Unsaved
                </span>
              )
            ) : fileHandle ? (
              <span className="ml-2 inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[9px] bg-emerald-50 dark:bg-emerald-950/30 text-emerald-600 dark:text-emerald-400 border border-emerald-100 dark:border-emerald-800/40 font-semibold shrink-0">
                <span className="w-1 h-1 bg-emerald-500 rounded-full animate-pulse" />
                Saved
              </span>
            ) : (
              <span className="ml-2 inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[9px] bg-amber-50 dark:bg-amber-950/30 text-amber-600 dark:text-amber-400 border border-amber-100 dark:border-amber-800/40 font-semibold shrink-0">
                <span className="w-1 h-1 bg-amber-500 rounded-full animate-pulse" />
                Local Draft
              </span>
            )}
          </div>
          {/* Node/Edge Counter */}
          <span className="hidden lg:inline-flex items-center px-1.5 py-0.5 rounded-md text-[10px] font-mono text-gray-400 dark:text-gray-500 bg-gray-50 dark:bg-slate-800 border border-gray-100 dark:border-gray-800">
            {nodes.length}N · {edges.length}E
          </span>
        </div>

        <div className="w-px h-4 bg-gray-200 dark:bg-gray-700/50 mx-1" />

        {/* File Menu */}
        <div className="relative" ref={menuRef}>
          <button
            onClick={() => { setMenuOpen(!menuOpen); setTemplateOpen(false); setExportOpen(false); }}
            className={textBtnClass}
          >
            File
            <ChevronDown size={11} className={`opacity-60 transition-transform ${menuOpen ? 'rotate-180' : ''}`} />
          </button>

          {menuOpen && (
            <div className="absolute top-full left-0 mt-1.5 w-56 bg-white dark:bg-slate-800 rounded-xl border border-gray-200/80 dark:border-gray-700/50 shadow-xl py-1 z-[100] animate-dropdown-in">
              <button onClick={handleNew} className="w-full text-left px-3 py-2 text-xs text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-slate-700/50 flex items-center justify-between transition-colors rounded-lg mx-0">
                <span className="flex items-center gap-2.5"><FilePlus size={14} className="text-gray-400" />New</span>
                <kbd className="text-[10px] text-gray-400 dark:text-gray-500 font-mono bg-gray-100 dark:bg-slate-700 px-1.5 py-0.5 rounded">{isMac ? '⌘N' : 'Ctrl+N'}</kbd>
              </button>
              <button onClick={handleOpen} className="w-full text-left px-3 py-2 text-xs text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-slate-700/50 flex items-center justify-between transition-colors rounded-lg mx-0">
                <span className="flex items-center gap-2.5"><FolderOpen size={14} className="text-gray-400" />Open...</span>
                <kbd className="text-[10px] text-gray-400 dark:text-gray-500 font-mono bg-gray-100 dark:bg-slate-700 px-1.5 py-0.5 rounded">{isMac ? '⌘O' : 'Ctrl+O'}</kbd>
              </button>
              <button onClick={handleImportJSON} className="w-full text-left px-3 py-2 text-xs text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-slate-700/50 flex items-center gap-2.5 transition-colors rounded-lg mx-0">
                <FolderOpen size={14} className="text-blue-500" />Import JSON...
              </button>
              <button onClick={() => { setMermaidOpen(true); setMenuOpen(false); }} className="w-full text-left px-3 py-2 text-xs text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-slate-700/50 flex items-center gap-2.5 transition-colors rounded-lg mx-0">
                <GitBranch size={14} className="text-violet-500" />Import Mermaid...
              </button>
              <div className="h-px bg-gray-100 dark:bg-gray-700/50 my-1 mx-2" />
              <button onClick={handleSave} className="w-full text-left px-3 py-2 text-xs text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-slate-700/50 flex items-center justify-between transition-colors rounded-lg mx-0">
                <span className="flex items-center gap-2.5"><Save size={14} className="text-gray-400" />Save</span>
                <kbd className="text-[10px] text-gray-400 dark:text-gray-500 font-mono bg-gray-100 dark:bg-slate-700 px-1.5 py-0.5 rounded">{isMac ? '⌘S' : 'Ctrl+S'}</kbd>
              </button>
              <button onClick={handleSaveAs} className="w-full text-left px-3 py-2 text-xs text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-slate-700/50 flex items-center justify-between transition-colors rounded-lg mx-0">
                <span className="flex items-center gap-2.5"><Save size={14} className="text-gray-400" />Save As...</span>
                <kbd className="text-[10px] text-gray-400 dark:text-gray-500 font-mono bg-gray-100 dark:bg-slate-700 px-1.5 py-0.5 rounded">{isMac ? '⇧⌘S' : 'Ctrl+Shift+S'}</kbd>
              </button>
              {projectId && (
                <button onClick={() => { setVersionsOpen(true); setMenuOpen(false); }} className="w-full text-left px-3 py-2 text-xs text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-slate-700/50 flex items-center gap-2.5 transition-colors rounded-lg mx-0">
                  <History size={14} className="text-blue-500" />Version History...
                </button>
              )}
            </div>
          )}
        </div>

        <div className="w-px h-4 bg-gray-200 dark:bg-gray-700/50 mx-0.5" />

        {/* Save Quick */}
        <button onClick={handleSave} className={textBtnClass} title="Save (Ctrl+S)">
          <Save size={14} className="text-blue-500" />
          <span className="hidden sm:inline">Save</span>
        </button>

        <div className="w-px h-4 bg-gray-200 dark:bg-gray-700/50 mx-0.5" />

        {/* Undo / Redo */}
        <button onClick={() => { useDiagramStore.temporal.getState().undo(); showToast('Undo', 'info'); }} className={btnClass} title="Undo (Ctrl+Z)">
          <Undo2 size={14} />
        </button>
        <button onClick={() => { useDiagramStore.temporal.getState().redo(); showToast('Redo', 'info'); }} className={btnClass} title="Redo (Ctrl+Shift+Z)">
          <Redo2 size={14} />
        </button>

        <div className="w-px h-4 bg-gray-200 dark:bg-gray-700/50 mx-0.5" />

        {/* Shake to Align */}
        <button onClick={() => { triggerShakeToAlign(); showToast('Shook nodes into alignment!', 'success'); }} className={textBtnClass} title="Auto-arrange nodes">
          <Sparkles size={14} className="text-amber-500" />
          <span className="hidden md:inline">Align</span>
        </button>
      </div>

      {/* Center Section */}
      <div className="flex items-center gap-3">
        {/* Tag Filter */}
        {uniqueTags.length > 0 && (
          <select
            value={activeFilterTag || ''}
            onChange={(e) => setActiveFilterTag(e.target.value || null)}
            className="text-[11px] bg-gray-50 dark:bg-slate-800 border border-gray-200/80 dark:border-gray-700/50 rounded-lg px-2 py-1 outline-none text-gray-600 dark:text-gray-300 font-medium hover:border-gray-300 dark:hover:border-gray-600 transition-colors cursor-pointer"
          >
            <option value="">All Tags</option>
            {uniqueTags.map((tag) => (
              <option key={tag} value={tag}>🏷️ {tag}</option>
            ))}
          </select>
        )}

        {/* Search */}
        <div className="relative hidden md:block" ref={searchContainerRef}>
          <div className={`relative flex items-center bg-gray-50 dark:bg-slate-800 border rounded-lg px-2.5 py-1 w-44 sm:w-52 transition-all duration-200 ${searchFocused ? 'w-60 ring-2 ring-blue-500/20 border-blue-400 dark:border-blue-500' : 'border-gray-200/80 dark:border-gray-700/50 hover:border-gray-300 dark:hover:border-gray-600'}`}>
            <Search size={13} className="text-gray-400 dark:text-gray-500 mr-2 shrink-0" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onFocus={() => setSearchFocused(true)}
              placeholder="Search nodes..."
              className="text-xs bg-transparent border-none outline-none text-gray-900 dark:text-gray-100 placeholder-gray-400 dark:placeholder-gray-500 w-full"
            />
            {searchQuery && (
              <button onClick={() => setSearchQuery('')} className="text-[10px] font-bold text-gray-400 hover:text-gray-600 dark:text-gray-500 dark:hover:text-gray-300 ml-1.5 shrink-0">✕</button>
            )}
          </div>
          
          {searchFocused && searchResults.length > 0 && (
            <div className="absolute top-full left-0 right-0 mt-1 max-h-48 overflow-y-auto bg-white dark:bg-slate-800 border border-gray-200/80 dark:border-gray-700/50 rounded-xl shadow-xl z-50 py-1 animate-dropdown-in">
              {searchResults.map((node) => {
                const labelText = (node.data as any).label || 'Unnamed shape';
                const shapeType = (node.data as any).shapeType || 'rectangle';
                return (
                  <button key={node.id} onClick={() => handleNavigate(node)} className="w-full text-left px-3 py-1.5 hover:bg-gray-50 dark:hover:bg-slate-700/50 transition-colors flex items-center gap-3 rounded-lg mx-0">
                    <div className="w-2 h-2 rounded-full bg-blue-400 shrink-0" />
                    <div className="flex flex-col min-w-0">
                      <span className="text-xs font-medium text-gray-800 dark:text-gray-200 truncate">{labelText}</span>
                      <span className="text-[10px] text-gray-400 dark:text-gray-500 capitalize">{shapeType}</span>
                    </div>
                  </button>
                );
              })}
            </div>
          )}

          {searchFocused && searchQuery && searchResults.length === 0 && (
            <div className="absolute top-full left-0 right-0 mt-1 bg-white dark:bg-slate-800 border border-gray-200/80 dark:border-gray-700/50 rounded-xl shadow-xl z-50 py-3 text-center text-xs text-gray-400 dark:text-gray-500 animate-dropdown-in">
              No matching shapes found
            </div>
          )}
        </div>

        {/* Zoom Controls */}
        <div className="flex items-center bg-gray-50 dark:bg-slate-800/80 rounded-lg border border-gray-200/80 dark:border-gray-700/50 p-0.5 gap-0.5">
          <button onClick={() => reactFlowInstance?.zoomOut({ duration: 300 })} className={btnClass} title="Zoom Out">
            <ZoomOut size={14} />
          </button>
          {zoomEditing ? (
            <input
              autoFocus
              value={zoomInput}
              onChange={(e) => setZoomInput(e.target.value)}
              onBlur={handleZoomSubmit}
              onKeyDown={(e) => e.key === 'Enter' && handleZoomSubmit()}
              className="w-12 text-xs text-center font-mono font-semibold bg-white dark:bg-slate-700 border border-blue-300 dark:border-blue-600 rounded-md py-0.5 outline-none text-gray-700 dark:text-gray-200"
            />
          ) : (
            <button onClick={handleZoomClick} className="text-[11px] text-gray-500 dark:text-gray-400 min-w-[44px] text-center font-mono font-semibold hover:text-gray-700 dark:hover:text-gray-200 hover:bg-white dark:hover:bg-slate-700 rounded-md py-0.5 transition-colors" title="Click to set zoom">
              {Math.round(zoom * 100)}%
            </button>
          )}
          <button onClick={() => reactFlowInstance?.zoomIn({ duration: 300 })} className={btnClass} title="Zoom In">
            <ZoomIn size={14} />
          </button>
          <div className="w-px h-4 bg-gray-200 dark:bg-gray-700/50" />
          <button onClick={() => reactFlowInstance?.fitView({ duration: 400 })} className={btnClass} title="Fit to Screen">
            <Maximize size={13} />
          </button>
          <div className="w-px h-4 bg-gray-200 dark:bg-gray-700/50" />
          <button
            onClick={() => { setIsLocked(!isLocked); showToast(isLocked ? 'Canvas unlocked' : 'Canvas locked (read-only)', 'info'); }}
            className={`p-1.5 rounded-md transition-all active:scale-95 ${isLocked ? 'text-amber-500 bg-amber-50 dark:bg-amber-950/20' : 'text-gray-400 hover:bg-white dark:hover:bg-slate-700 hover:text-gray-600 dark:hover:text-gray-300'}`}
            title={isLocked ? "Unlock Canvas" : "Lock Canvas"}
          >
            {isLocked ? <Lock size={13} /> : <Unlock size={13} />}
          </button>
        </div>
      </div>

      {/* Right Section */}
      <div className="flex items-center gap-1">
        {/* Templates */}
        <div className="relative" ref={templateRef}>
          <button onClick={() => { setTemplateOpen(!templateOpen); setMenuOpen(false); setExportOpen(false); }} className={textBtnClass}>
            <LayoutTemplate size={14} className="text-violet-500" />
            <span className="hidden sm:inline">Templates</span>
            <ChevronDown size={11} className={`opacity-60 transition-transform ${templateOpen ? 'rotate-180' : ''}`} />
          </button>
          {templateOpen && (
            <div className="absolute right-0 top-full mt-1.5 w-60 bg-white dark:bg-slate-800 rounded-xl border border-gray-200/80 dark:border-gray-700/50 shadow-xl z-50 py-1.5 animate-dropdown-in">
              <div className="px-3 pb-1.5 pt-0.5">
                <span className="text-[10px] font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-wider">Start from a template</span>
              </div>
              <button onClick={() => { loadTemplate('mindmap'); setTemplateOpen(false); showToast('Loaded Mind Map template', 'success'); }} className="w-full text-left px-3 py-2 hover:bg-gray-50 dark:hover:bg-slate-700/50 transition-colors rounded-lg mx-0">
                <div className="flex items-center gap-2">
                  <span className="text-base">🧠</span>
                  <div>
                    <div className="text-xs font-medium text-gray-700 dark:text-gray-200">Mind Map Concept</div>
                    <div className="text-[10px] text-gray-400 dark:text-gray-500">Brainstorm with radiating branches</div>
                  </div>
                </div>
              </button>
              <button onClick={() => { loadTemplate('flowchart'); setTemplateOpen(false); showToast('Loaded Flowchart template', 'success'); }} className="w-full text-left px-3 py-2 hover:bg-gray-50 dark:hover:bg-slate-700/50 transition-colors rounded-lg mx-0">
                <div className="flex items-center gap-2">
                  <span className="text-base">⚡</span>
                  <div>
                    <div className="text-xs font-medium text-gray-700 dark:text-gray-200">Interactive Flowchart</div>
                    <div className="text-[10px] text-gray-400 dark:text-gray-500">Process flow with decision branches</div>
                  </div>
                </div>
              </button>
              <button onClick={() => { loadTemplate('database'); setTemplateOpen(false); showToast('Loaded DB Schema template', 'success'); }} className="w-full text-left px-3 py-2 hover:bg-gray-50 dark:hover:bg-slate-700/50 transition-colors rounded-lg mx-0">
                <div className="flex items-center gap-2">
                  <span className="text-base">🗄️</span>
                  <div>
                    <div className="text-xs font-medium text-gray-700 dark:text-gray-200">Database Schema</div>
                    <div className="text-[10px] text-gray-400 dark:text-gray-500">Entity relationship diagram</div>
                  </div>
                </div>
              </button>
            </div>
          )}
        </div>

        <div className="w-px h-4 bg-gray-200 dark:bg-gray-700/50 mx-0.5" />

        {/* Theme Toggle */}
        <button onClick={toggleTheme} className={btnClass} title="Toggle Theme">
          {theme === 'dark' ? <Sun size={15} /> : <Moon size={15} />}
        </button>

        <div className="w-px h-4 bg-gray-200 dark:bg-gray-700/50 mx-0.5" />

        {/* Export */}
        <div className="relative" ref={exportRef}>
          <button onClick={() => { setExportOpen(!exportOpen); setMenuOpen(false); setTemplateOpen(false); }} className={textBtnClass}>
            <Download size={14} />
            <span className="hidden sm:inline">Export</span>
            <ChevronDown size={11} className={`opacity-60 transition-transform ${exportOpen ? 'rotate-180' : ''}`} />
          </button>
          {exportOpen && (
            <div className="absolute right-0 top-full mt-1.5 w-52 bg-white dark:bg-slate-800 rounded-xl border border-gray-200/80 dark:border-gray-700/50 shadow-xl z-50 py-1.5 animate-dropdown-in">
              <button onClick={() => handleExport('png')} className="w-full text-left px-3 py-2 hover:bg-gray-50 dark:hover:bg-slate-700/50 transition-colors rounded-lg mx-0">
                <div className="flex items-center gap-2.5">
                  <ImageIcon size={14} className="text-green-500" />
                  <div>
                    <div className="text-xs font-medium text-gray-700 dark:text-gray-200">Export as PNG</div>
                    <div className="text-[10px] text-gray-400 dark:text-gray-500">High-res raster image</div>
                  </div>
                </div>
              </button>
              <button onClick={() => handleExport('svg')} className="w-full text-left px-3 py-2 hover:bg-gray-50 dark:hover:bg-slate-700/50 transition-colors rounded-lg mx-0">
                <div className="flex items-center gap-2.5">
                  <Download size={14} className="text-violet-500" />
                  <div>
                    <div className="text-xs font-medium text-gray-700 dark:text-gray-200">Export as SVG</div>
                    <div className="text-[10px] text-gray-400 dark:text-gray-500">Scalable vector format</div>
                  </div>
                </div>
              </button>
              <button onClick={() => { setExportOpen(false); showToast('Preparing print layout...', 'info'); setTimeout(() => window.print(), 350); }} className="w-full text-left px-3 py-2 hover:bg-gray-50 dark:hover:bg-slate-700/50 transition-colors rounded-lg mx-0">
                <div className="flex items-center gap-2.5">
                  <Printer size={14} className="text-orange-500" />
                  <div>
                    <div className="text-xs font-medium text-gray-700 dark:text-gray-200">Export as PDF</div>
                    <div className="text-[10px] text-gray-400 dark:text-gray-500">Print to PDF layout</div>
                  </div>
                </div>
              </button>
              <button onClick={handleExportJSON} className="w-full text-left px-3 py-2 hover:bg-gray-50 dark:hover:bg-slate-700/50 transition-colors rounded-lg mx-0">
                <div className="flex items-center gap-2.5">
                  <FileJson size={14} className="text-blue-500" />
                  <div>
                    <div className="text-xs font-medium text-gray-700 dark:text-gray-200">Export Project (.json)</div>
                    <div className="text-[10px] text-gray-400 dark:text-gray-500">Full project backup</div>
                  </div>
                </div>
              </button>
            </div>
          )}
        </div>

        <div className="w-px h-4 bg-gray-200 dark:bg-gray-700/50 mx-0.5" />

        {/* Clear */}
        <button onClick={handleClear} className="p-1.5 text-gray-400 hover:text-red-500 dark:hover:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/20 rounded-md transition-all active:scale-95" title="Clear Canvas">
          <Trash2 size={15} />
        </button>

        {/* Help */}
        <button onClick={() => setShowHelpModal(true)} className={btnClass} title="Help & Shortcuts">
          <HelpCircle size={15} />
        </button>

        {/* Share */}
        <button onClick={() => showToast('Share feature coming soon', 'info')} className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-gray-600 dark:text-gray-300 border border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-slate-800 rounded-lg transition-all active:scale-95" title="Share">
          <Share2 size={13} />
          <span className="hidden sm:inline">Share</span>
        </button>
      </div>

      <MermaidImportModal
        isOpen={mermaidOpen}
        onClose={() => setMermaidOpen(false)}
        onImport={handleMermaidImport}
      />
      <VersionHistoryModal
        isOpen={versionsOpen}
        projectId={projectId}
        onClose={() => setVersionsOpen(false)}
        onRestored={handleVersionRestored}
        showToast={showToast}
      />
    </nav>
  );
}
