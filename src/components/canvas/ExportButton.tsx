import { Panel } from '@xyflow/react';
import { Download, Code, FileText } from 'lucide-react';
import { exportToSVG, downloadSVG } from '../../utils/svgExport';
import { exportNodesToPng, downloadDataUrl } from '../../utils/pngExport';
import { useDiagramStore } from '../../store/useDiagramStore';
import { useToast } from '../../context/ToastContext';

export function ExportButton() {
  const { showToast } = useToast();

  const getExportFilename = (ext: string) => {
    const { projectName, fileName } = useDiagramStore.getState();
    const name = (projectName || fileName || 'nodecraft-diagram').replace(/[^a-zA-Z0-9_-]/g, '_').substring(0, 100) || 'nodecraft-diagram';
    return `${name}.${ext}`;
  };

  const handleSVGExport = async () => {
    try {
      const { nodes, edges, theme, canvasColor } = useDiagramStore.getState();
      if (nodes.length === 0) {
        showToast('No content to export', 'warning');
        return;
      }
      const backgroundColor = canvasColor || (theme === 'dark' ? '#0f172a' : '#f8fafc');
      
      const svgContent = exportToSVG(nodes, edges, { 
        padding: 50, 
        includeBackground: true,
        backgroundColor 
      });
      
      downloadSVG(svgContent, getExportFilename('svg'));
      showToast('Diagram exported as SVG', 'success');
    } catch (error) {
      console.error('Error exporting SVG:', error);
      showToast('Failed to export SVG', 'error');
    }
  };

  const handlePNGExport = async () => {
    try {
      const nodes = useDiagramStore.getState().nodes;
      if (nodes.length === 0) {
        showToast('No content to export', 'warning');
        return;
      }

      const { theme, canvasColor } = useDiagramStore.getState();
      const backgroundColor = canvasColor || (theme === 'dark' ? '#0f172a' : '#f8fafc');

      const result = await exportNodesToPng(nodes, { backgroundColor });
      if (!result.ok) {
        if (result.reason === 'no-viewport') {
          showToast('Canvas not ready — try again', 'warning');
        } else {
          console.error('Error exporting PNG:', result.error);
          showToast('Failed to export PNG', 'error');
        }
        return;
      }

      downloadDataUrl(result.dataUrl, getExportFilename('png'));
      showToast(
        result.pixelRatio < 1
          ? 'Exported PNG (downscaled to fit large diagram)'
          : 'Diagram exported as PNG',
        'success'
      );
    } catch (error) {
      console.error('Error exporting PNG:', error);
      showToast('Failed to export PNG', 'error');
    }
  };

  return (
    <Panel position="top-right" className="bg-white dark:bg-slate-800 rounded-lg shadow-lg border border-gray-200 dark:border-gray-700 p-1 flex gap-1 z-50 mt-4 mr-4 transition-colors">
      <button 
        onClick={handlePNGExport}
        className="flex items-center gap-1.5 px-3 py-1.5 rounded hover:bg-gray-100 dark:hover:bg-slate-700 text-gray-700 dark:text-gray-300 text-sm font-medium transition-colors"
        title="Export as PNG (raster)"
      >
        <Download size={16} />
        PNG
      </button>
      <button 
        onClick={handleSVGExport}
        className="flex items-center gap-1.5 px-3 py-1.5 rounded hover:bg-gray-100 dark:hover:bg-slate-700 text-gray-700 dark:text-gray-300 text-sm font-medium transition-colors"
        title="Export as SVG (native vector)"
      >
        <Code size={16} />
        SVG
      </button>
      <button 
        onClick={() => {
          showToast('Preparing print layout...', 'info');
          setTimeout(() => window.print(), 350);
        }}
        className="flex items-center gap-1.5 px-3 py-1.5 rounded hover:bg-gray-100 dark:hover:bg-slate-700 text-gray-700 dark:text-gray-300 text-sm font-medium transition-colors"
        title="Export as PDF / Print diagram"
      >
        <FileText size={16} className="text-red-500" />
        PDF
      </button>
      <button 
        onClick={() => {
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
            link.download = getExportFilename('json');
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            setTimeout(() => URL.revokeObjectURL(url), 1000);
            showToast('Project exported as JSON', 'success');
          } catch (e) {
            console.error('Failed to export JSON:', e);
            showToast('Failed to export JSON', 'error');
          }
        }}
        className="flex items-center gap-1.5 px-3 py-1.5 rounded hover:bg-gray-100 dark:hover:bg-slate-700 text-gray-700 dark:text-gray-300 text-sm font-medium transition-colors"
        title="Export Project (.json)"
      >
        <FileText size={16} className="text-blue-500" />
        JSON
      </button>
    </Panel>
  );
}
