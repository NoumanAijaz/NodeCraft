import { Panel, useReactFlow, getNodesBounds, getViewportForBounds } from '@xyflow/react';
import { toPng } from 'html-to-image';
import { Download, Code, FileText } from 'lucide-react';
import { exportToSVG, downloadSVG } from '../../utils/svgExport';
import { useDiagramStore } from '../../store/useDiagramStore';

export function ExportButton() {
  const { getNodes } = useReactFlow();

  const handleSVGExport = async () => {
    try {
      const { nodes, edges, theme } = useDiagramStore.getState();
      const backgroundColor = theme === 'dark' ? '#0f172a' : '#f8fafc';
      
      const svgContent = exportToSVG(nodes, edges, { 
        padding: 50, 
        includeBackground: true,
        backgroundColor 
      });
      
      downloadSVG(svgContent, 'nodecraft-diagram.svg');
    } catch (error) {
      console.error('Error exporting SVG:', error);
    }
  };

  const handlePNGExport = async () => {
    try {
      const nodes = getNodes();
      if (nodes.length === 0) return; // empty-canvas guard
      const nodesBounds = getNodesBounds(nodes);
      const imageWidth = nodesBounds.width + 100;
      const imageHeight = nodesBounds.height + 100;

      const viewport = getViewportForBounds(
        nodesBounds,
        imageWidth,
        imageHeight,
        0.5,
        2,
        0
      );

      const viewportElement = document.querySelector('.react-flow__viewport') as HTMLElement;
      
      if (viewportElement) {
        // Exclude React Flow's UI chrome (minimap, controls) from the export —
        // otherwise they appear as opaque rectangles in the saved PNG.
        const filter = (node: HTMLElement) => {
          const exclusionClasses = ['react-flow__minimap', 'react-flow__controls'];
          return !exclusionClasses.some((className) => node.classList?.contains(className));
        };

        const { theme } = useDiagramStore.getState();
        const options = {
          filter,
          backgroundColor: theme === 'dark' ? '#0f172a' : '#f8fafc',
          width: imageWidth,
          height: imageHeight,
          style: {
            width: `${imageWidth}px`,
            height: `${imageHeight}px`,
            transform: `translate(${viewport.x}px, ${viewport.y}px) scale(${viewport.zoom})`,
          },
        };

        const dataUrl = await toPng(viewportElement, options);
        const link = document.createElement('a');
        link.download = 'nodecraft-diagram.png';
        link.href = dataUrl;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
      }
    } catch (error) {
      console.error('Error exporting PNG:', error);
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
        onClick={() => setTimeout(() => window.print(), 350)}
        className="flex items-center gap-1.5 px-3 py-1.5 rounded hover:bg-gray-100 dark:hover:bg-slate-700 text-gray-700 dark:text-gray-300 text-sm font-medium transition-colors"
        title="Export as PDF / Print diagram"
      >
        <FileText size={16} className="text-red-500" />
        PDF
      </button>
      <button 
        onClick={() => {
          try {
            // Include the same metadata as TopNav's handleExportJSON so the
            // exported file can be fully restored on import.
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
            link.download = 'nodecraft-project.json';
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            URL.revokeObjectURL(url);
          } catch (e) {
            console.error('Failed to export JSON:', e);
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
