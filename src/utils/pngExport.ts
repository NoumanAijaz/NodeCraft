import { toPng } from 'html-to-image';
import { getNodesBounds, getViewportForBounds } from '@xyflow/react';
import type { Node } from '@xyflow/react';

export interface PngExportSuccess {
  ok: true;
  dataUrl: string;
  pixelRatio: number;
  width: number;
  height: number;
}
export type PngExportResult =
  | PngExportSuccess
  | { ok: false; reason: 'no-viewport' }
  | { ok: false; reason: 'failed'; error: unknown };

// Canvas limits: browsers cap a single canvas dimension around 16k px and
// total area well below that; stay conservative so toPng never OOMs.
const MAX_EDGE_PX = 8192;
const MAX_AREA_PX = 16_000_000;

/**
 * Renders the React Flow viewport for `nodes` to a PNG data URL.
 * Automatically scales `pixelRatio` down when the diagram is too large
 * instead of failing, so big boards still export (slightly softer).
 */
export async function exportNodesToPng(
  nodes: Node[],
  options: { backgroundColor: string; minPixelRatio?: number; maxPixelRatio?: number }
): Promise<PngExportResult> {
  const { backgroundColor } = options;
  const minPixelRatio = options.minPixelRatio ?? 0.5;
  const maxPixelRatio = options.maxPixelRatio ?? Math.max(2, window.devicePixelRatio || 1);

  const nodesBounds = getNodesBounds(nodes);
  const cssWidth = nodesBounds.width + 100;
  const cssHeight = nodesBounds.height + 100;

  // Auto-fit: shrink ratio until output respects edge & area limits.
  const fitEdge = Math.min(MAX_EDGE_PX / cssWidth, MAX_EDGE_PX / cssHeight);
  const fitArea = Math.sqrt(MAX_AREA_PX / Math.max(1, cssWidth * cssHeight));
  const ratio = Math.min(Math.max(minPixelRatio, maxPixelRatio), fitEdge, fitArea);
  // Keep at least one output pixel on the short axis of a very narrow diagram.
  const canvasWidth = Math.max(cssWidth, (1 + Number.EPSILON) / ratio);
  const canvasHeight = Math.max(cssHeight, (1 + Number.EPSILON) / ratio);

  const viewport = getViewportForBounds(
    nodesBounds,
    cssWidth,
    cssHeight,
    0.5,
    2,
    0
  );

  const viewportElement = document.querySelector('.react-flow__viewport') as HTMLElement | null;
  if (!viewportElement) {
    return { ok: false, reason: 'no-viewport' };
  }

  const filter = (el: HTMLElement) => {
    const excluded = [
      'react-flow__minimap',
      'react-flow__controls',
      // Editor-only chrome that must never appear in exports
      'no-print',
      'react-flow__handle',
      'react-flow__resize-control',
    ];
    return !excluded.some((className) => el.classList?.contains(className));
  };

  try {
    const dataUrl = await toPng(viewportElement, {
      filter,
      backgroundColor,
      width: cssWidth,
      height: cssHeight,
      canvasWidth,
      canvasHeight,
      pixelRatio: ratio,
      style: {
        width: `${cssWidth}px`,
        height: `${cssHeight}px`,
        transform: `translate(${viewport.x}px, ${viewport.y}px) scale(${viewport.zoom})`,
      },
    });
    return {
      ok: true,
      dataUrl,
      pixelRatio: ratio,
      width: Math.floor(canvasWidth * ratio),
      height: Math.floor(canvasHeight * ratio),
    };
  } catch (error) {
    return { ok: false, reason: 'failed', error };
  }
}

/** Trigger a browser download for a data URL. */
export function downloadDataUrl(dataUrl: string, filename: string): void {
  const link = document.createElement('a');
  link.download = filename;
  link.href = dataUrl;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}
