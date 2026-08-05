import type { Node, Edge } from '@xyflow/react';
import type { ShapeNodeData } from '../types/diagram';
import { colorGradients } from '../constants/colors';

interface SVGExportOptions {
  padding?: number;
  includeBackground?: boolean;
  backgroundColor?: string;
}

// ---------- helpers ----------

function escapeXml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

// ---------- edge path calculation ----------

/**
 * Computes intersection point of a ray from the center of a rectangle
 * toward `angle`, with the rectangle boundary.
 */
function rectEdgePoint(
  cx: number, cy: number, hw: number, hh: number, angle: number
): { x: number; y: number } {
  const cos = Math.cos(angle);
  const sin = Math.sin(angle);

  // Avoid division by zero
  if (Math.abs(cos) < 1e-9) {
    return { x: cx, y: cy + (sin > 0 ? hh : -hh) };
  }
  if (Math.abs(sin) < 1e-9) {
    return { x: cx + (cos > 0 ? hw : -hw), y: cy };
  }

  const tx = hw / Math.abs(cos);
  const ty = hh / Math.abs(sin);
  const t = Math.min(tx, ty);
  return { x: cx + t * cos, y: cy + t * sin };
}

function getEdgePath(
  sx: number, sy: number, sw: number, sh: number,
  tx: number, ty: number, tw: number, th: number,
  edgeType: string
): string {
  const sCx = sx + sw / 2;
  const sCy = sy + sh / 2;
  const tCx = tx + tw / 2;
  const tCy = ty + th / 2;

  const angle = Math.atan2(tCy - sCy, tCx - sCx);

  const src = rectEdgePoint(sCx, sCy, sw / 2, sh / 2, angle);
  const tgt = rectEdgePoint(tCx, tCy, tw / 2, th / 2, angle + Math.PI);

  if (edgeType === 'straight') {
    return `M ${src.x} ${src.y} L ${tgt.x} ${tgt.y}`;
  }

  if (edgeType === 'step') {
    const midX = (src.x + tgt.x) / 2;
    return `M ${src.x} ${src.y} L ${midX} ${src.y} L ${midX} ${tgt.y} L ${tgt.x} ${tgt.y}`;
  }

  // Default: bezier curve (React Flow style — horizontal control points)
  const dx = tgt.x - src.x;
  const controlOffset = Math.max(Math.abs(dx) * 0.4, 30);
  return `M ${src.x} ${src.y} C ${src.x + controlOffset} ${src.y}, ${tgt.x - controlOffset} ${tgt.y}, ${tgt.x} ${tgt.y}`;
}

function getAbsolutePosition(node: Node, allNodes: Node[]): { x: number; y: number } {
  let x = node.position.x;
  let y = node.position.y;
  let current = node;
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

// ---------- bounding box ----------

function getNodeBounds(nodes: Node[]): { x: number; y: number; width: number; height: number } {
  if (nodes.length === 0) {
    return { x: 0, y: 0, width: 800, height: 600 };
  }

  let minX = Infinity, minY = Infinity;
  let maxX = -Infinity, maxY = -Infinity;
  for (const node of nodes) {
    const w = node.measured?.width || node.width || 150;
    const h = node.measured?.height || node.height || 50;
    const p = getAbsolutePosition(node, nodes);
    minX = Math.min(minX, p.x);
    minY = Math.min(minY, p.y);
    maxX = Math.max(maxX, p.x + w);
    maxY = Math.max(maxY, p.y + h);
  }
  return { x: minX, y: minY, width: maxX - minX, height: maxY - minY };
}

// ---------- shape rendering ----------

function renderShape(
  node: Node,
  offsetX: number,
  offsetY: number,
  allNodes: Node[]
): string {
  const data = node.data as unknown as ShapeNodeData;
  const shapeType = data.shapeType || 'rectangle';
  const p = getAbsolutePosition(node, allNodes);
  const x = p.x - offsetX;
  const y = p.y - offsetY;
  const w = node.measured?.width || node.width || 150;
  const h = node.measured?.height || node.height || 50;
  const color = data.color || '#ffffff';
  const borderColor = data.borderColor || '#94a3b8';
  const borderWidth = data.borderWidth || 2;
  const imageUrl = data.imageUrl;

  const hexId = color.replace('#', '');
  const hasPreset = colorGradients[color];
  const fillValue = color === 'transparent'
    ? 'transparent'
    : hasPreset ? `url(#grad-${hexId})` : color;
  const cylFillValue = color === 'transparent'
    ? 'transparent'
    : hasPreset ? `url(#cyl-grad-${hexId})` : color;
  const cylTopFillValue = color === 'transparent'
    ? 'transparent'
    : hasPreset ? `url(#cyl-top-grad-${hexId})` : color;

  switch (shapeType) {
    case 'circle': {
      const cx = x + w / 2;
      const cy = y + h / 2;
      return `<ellipse cx="${cx}" cy="${cy}" rx="${w / 2}" ry="${h / 2}"
          fill="${fillValue}" stroke="${borderColor}" stroke-width="${borderWidth}" />`;
    }

    case 'diamond': {
      const pts = `${x + w / 2},${y} ${x + w},${y + h / 2} ${x + w / 2},${y + h} ${x},${y + h / 2}`;
      return `<polygon points="${pts}"
          fill="${fillValue}" stroke="${borderColor}" stroke-width="${borderWidth}" stroke-linejoin="round" />`;
    }

    case 'cylinder': {
      const rx = w / 2;
      const ry = h * 0.15;
      const cx = x + rx;
      const topCy = y + ry;
      const bottomCy = y + h - ry;
      return `
        <path d="M ${x} ${topCy} L ${x} ${bottomCy} A ${rx} ${ry} 0 0 0 ${x + w} ${bottomCy} L ${x + w} ${topCy} A ${rx} ${ry} 0 0 0 ${x} ${topCy} Z"
          fill="${cylFillValue}" stroke="${borderColor}" stroke-width="${borderWidth}" />
        <ellipse cx="${cx}" cy="${topCy}" rx="${rx}" ry="${ry}"
          fill="${cylTopFillValue}" stroke="${borderColor}" stroke-width="${borderWidth}" />
        <path d="M ${x} ${y + h * 0.4} A ${rx} ${ry} 0 0 0 ${x + w} ${y + h * 0.4}"
          fill="none" stroke="${borderColor}" stroke-width="${borderWidth}" stroke-opacity="0.4" />
        <path d="M ${x} ${y + h * 0.7} A ${rx} ${ry} 0 0 0 ${x + w} ${y + h * 0.7}"
          fill="none" stroke="${borderColor}" stroke-width="${borderWidth}" stroke-opacity="0.4" />`;
    }

    case 'sticky': {
      const fs = 20;
      const pts = `${x + fs},${y} ${x + w},${y} ${x + w},${y + h - fs} ${x + w - fs},${y + h - fs} ${x},${y + h} ${x},${y}`;
      return `
        <polygon points="${pts}"
          fill="${fillValue}" stroke="${borderColor}" stroke-width="${borderWidth}" stroke-linejoin="round" />
        <polygon points="${x + fs},${y} ${x + fs + 10},${y} ${x + fs + 10},${y + 10}"
          fill="${borderColor}" opacity="0.3" />`;
    }

    case 'image': {
      const r = 8;
      let svg = `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="${r}"
          fill="${fillValue}" stroke="${borderColor}" stroke-width="${borderWidth}" />`;

      if (imageUrl) {
        // Use clipPath for rounded corners on image
        const clipId = `clip-img-${node.id.replace(/[^a-zA-Z0-9]/g, '')}`;
        svg += `
        <clipPath id="${clipId}">
          <rect x="${x}" y="${y}" width="${w}" height="${h}" rx="${r}" />
        </clipPath>
        <image href="${escapeXml(imageUrl)}" x="${x}" y="${y}" width="${w}" height="${h}"
          preserveAspectRatio="xMidYMid slice" clip-path="url(#${clipId})" />`;
      } else {
        // Placeholder icon for "Double-click to upload"
        const iconX = x + w / 2;
        const iconY = y + h / 2 - 10;
        svg += `
        <g opacity="0.4">
          <rect x="${iconX - 14}" y="${iconY - 14}" width="28" height="28" rx="4"
            fill="none" stroke="${borderColor}" stroke-width="1.5" />
          <path d="M ${iconX - 6} ${iconY + 6} L ${iconX - 2} ${iconY} L ${iconX + 2} ${iconY + 4} L ${iconX + 6} ${iconY - 2}"
            fill="none" stroke="${borderColor}" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" />
        </g>
        <text x="${iconX}" y="${iconY + 28}"
          text-anchor="middle" dominant-baseline="middle"
          font-family="system-ui, -apple-system, sans-serif" font-size="10"
          fill="#94a3b8">Double-click to upload</text>`;
      }
      return svg;
    }

    case 'text':
      return `<rect x="${x}" y="${y}" width="${w}" height="${h}" fill="transparent" stroke="none" />`;

    case 'sticker': {
      // Emoji sticker — render large emoji centered in an invisible box.
      const emoji = data.stickerEmoji || '⭐';
      const cx = x + w / 2;
      const cy = y + h / 2;
      const rot = data.rotation ? ` transform="rotate(${data.rotation} ${cx} ${cy})"` : '';
      return `<text x="${cx}" y="${cy}" text-anchor="middle" dominant-baseline="central"${rot} font-size="${Math.min(w, h) * 0.7}" font-family="system-ui, 'Apple Color Emoji', 'Segoe UI Emoji', sans-serif">${escapeXml(emoji)}</text>`;
    }

    case 'frame': {
      // Dashed border frame with a title tab in the top-left.
      const title = data.label || '';
      const stroke = data.borderColor || '#94a3b8';
      const bw = data.borderWidth || 4;
      let svg = `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="12" ry="12" fill="none" stroke="${stroke}" stroke-width="${bw}" stroke-dasharray="8 4" />`;
      if (title) {
        svg += `<rect x="${x}" y="${y}" width="${Math.min(120, title.length * 9 + 16)}" height="22" rx="6" fill="${stroke}" />`;
        svg += `<text x="${x + 8}" y="${y + 15}" font-family="system-ui, -apple-system, sans-serif" font-size="13" font-weight="700" fill="#ffffff">${escapeXml(title)}</text>`;
      }
      return svg;
    }

    case 'card': {
      // Jira-style task card: rounded rect with colored left border.
      const statusColors: Record<string, string> = {
        todo: '#ef4444',
        'in-progress': '#f59e0b',
        done: '#10b981',
      };
      const accent = statusColors[data.status || 'todo'] || '#cbd5e1';
      const fill = data.color || '#ffffff';
      let svg = `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="8" ry="8" fill="${fill}" stroke="#e2e8f0" stroke-width="1" />`;
      svg += `<rect x="${x}" y="${y}" width="5" height="${h}" fill="${accent}" />`;
      return svg;
    }

    case 'portal': {
      // Radial gradient circle for portals.
      const cx = x + w / 2;
      const cy = y + h / 2;
      const r = Math.min(w, h) / 2;
      const gradId = `portal-${node.id.replace(/[^a-zA-Z0-9]/g, '')}`;
      return `<defs><radialGradient id="${gradId}" cx="50%" cy="50%" r="50%">
          <stop offset="0%" stop-color="#3b82f6" />
          <stop offset="50%" stop-color="#1e3a8a" />
          <stop offset="100%" stop-color="#0f172a" />
        </radialGradient></defs>
        <circle cx="${cx}" cy="${cy}" r="${r}" fill="url(#${gradId})" stroke="#60a5fa" stroke-width="2" />`;
    }

    case 'drawing': {
      // Freehand pen sketch — render the stored SVG path inside a translated box.
      const path = data.svgPath || '';
      return `<g transform="translate(${x} ${y})"><path d="${path}" fill="none" stroke="${data.color || '#3b82f6'}" stroke-width="3" stroke-linecap="round" stroke-linejoin="round" /></g>`;
    }

    default: // rectangle
      return `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="8" ry="8"
          fill="${fillValue}" stroke="${borderColor}" stroke-width="${borderWidth}" />`;
  }
}

// ---------- text rendering ----------

function renderText(
  node: Node,
  offsetX: number,
  offsetY: number,
  allNodes: Node[]
): string {
  const data = node.data as unknown as ShapeNodeData;
  const shapeType = data.shapeType || 'rectangle';
  const label = (shapeType === 'sticker' ? data.stickerEmoji : data.label) || '';
  // Mirror the ShapeNode auto-size logic for stickies so exports match.
  const stickyAutoFontSize = (text: string) => {
    const len = text.length;
    if (len < 20) return 18;
    if (len < 60) return 14;
    if (len < 120) return 11;
    return 9;
  };
  const fontSize = shapeType === 'sticky' ? (data.fontSize || stickyAutoFontSize(label)) : (data.fontSize || 14);
  const align = data.align || 'center';
  const textColor = data.textColor || '#1e293b';
  const bold = data.bold === true;
  const italic = data.italic === true;
  const fontFamily = data.fontFamily || 'sans';

  const fontMap = {
    sans: 'system-ui, -apple-system, sans-serif',
    serif: 'Georgia, Cambria, "Times New Roman", Times, serif',
    mono: 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace',
    handwriting: '"Kalam", "Caveat", cursive',
  };
  const fontFam = fontMap[fontFamily] || fontMap.sans;
  // Use absolute position for grouped nodes (mirrors renderShape).
  const absPos = (n: Node): { x: number; y: number } => {
    let x = n.position.x;
    let y = n.position.y;
    let current = n;
    const visited = new Set<string>([n.id]);
    while (current.parentId) {
      if (visited.has(current.parentId)) break;
      visited.add(current.parentId);
      const parent = allNodes.find(p => p.id === current.parentId);
      if (!parent) break;
      x += parent.position.x;
      y += parent.position.y;
      current = parent;
    }
    return { x, y };
  };
  const p = absPos(node);
  const x = p.x - offsetX;
  const y = p.y - offsetY;
  const w = node.measured?.width || node.width || 150;
  const h = node.measured?.height || node.height || 50;

  const textX = x + w / 2;
  const textY = y + h / 2;
  const textAnchor = align === 'left' ? 'start' : align === 'right' ? 'end' : 'middle';
  const dx = align === 'left' ? 12 : align === 'right' ? -12 : 0;

  if (shapeType === 'image') {
    if (!label) return '';
    const captionH = 24;
    const captionY = y + h - captionH;
    const captionTextY = captionY + captionH / 2;
    const fontWeight = bold ? '700' : '500';
    const fontStyle = italic ? 'italic' : 'normal';
    return `
      <rect x="${x + 2}" y="${captionY - 2}" width="${w - 4}" height="${captionH}"
        fill="#0f172a" fill-opacity="0.6" rx="6" ry="6" />
      <text x="${textX}" y="${captionTextY}"
        text-anchor="middle" dominant-baseline="middle"
        font-family="${fontFam}" font-size="11"
        fill="#ffffff" font-weight="${fontWeight}" font-style="${fontStyle}">${escapeXml(label)}</text>`;
  }

  // Skip text rendering for sticker (emoji is in renderShape), drawing, frame title (already in shape).
  if (shapeType === 'sticker' || shapeType === 'drawing' || shapeType === 'frame' || shapeType === 'portal') return '';

  if (!label) return '';

  const lines = label.split('\n');
  const lineSpacing = fontSize * 1.2;
  const textCenterY = shapeType === 'cylinder' ? textY + (h * 0.08) : textY;
  const startY = textCenterY - ((lines.length - 1) * lineSpacing) / 2;

  let tspans = '';
  lines.forEach((line, i) => {
    tspans += `<tspan x="${textX + dx}" dy="${i === 0 ? 0 : lineSpacing}" text-anchor="${textAnchor}">${escapeXml(line)}</tspan>`;
  });

  const fontWeight = bold ? '700' : '400';
  const fontStyle = italic ? 'italic' : 'normal';

  return `
    <text x="${textX + dx}" y="${startY}"
      dominant-baseline="middle"
      font-family="${fontFam}" font-size="${fontSize}"
      fill="${textColor}" font-weight="${fontWeight}" font-style="${fontStyle}">${tspans}</text>`;
}

// ---------- main export ----------

export function exportToSVG(
  nodes: Node[],
  edges: Edge[],
  options: SVGExportOptions = {}
): string {
  const { padding = 50, includeBackground = true, backgroundColor = '#f8fafc' } = options;

  const bounds = getNodeBounds(nodes);
  const svgWidth = bounds.width + padding * 2;
  const svgHeight = bounds.height + padding * 2;

  const offsetX = bounds.x - padding;
  const offsetY = bounds.y - padding;

  // ===== Build <defs> =====
  let defs = '';

  // Color gradient definitions
  Object.entries(colorGradients).forEach(([hex, grad]) => {
    const hexId = hex.replace('#', '');
    defs += `
    <linearGradient id="grad-${hexId}" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="${grad[0]}" />
      <stop offset="100%" stop-color="${grad[1]}" />
    </linearGradient>
    <linearGradient id="cyl-grad-${hexId}" x1="0%" y1="0%" x2="0%" y2="100%">
      <stop offset="0%" stop-color="${grad[0]}" />
      <stop offset="100%" stop-color="${grad[1] === '#ffffff' ? '#e2e8f0' : grad[1]}" />
    </linearGradient>
    <linearGradient id="cyl-top-grad-${hexId}" x1="0%" y1="0%" x2="0%" y2="100%">
      <stop offset="0%" stop-color="#ffffff" stop-opacity="0.6" />
      <stop offset="100%" stop-color="${grad[0]}" />
    </linearGradient>`;
  });

  // Drop shadow filters & Dash flow animation keyframes
  defs += `
    <style>
      @keyframes edge-flow {
        from {
          stroke-dashoffset: 20;
        }
        to {
          stroke-dashoffset: 0;
        }
      }
      .animated-flow {
        stroke-dasharray: 6, 6;
        animation: edge-flow 1.2s linear infinite;
      }
    </style>
    <filter id="drop-shadow" x="-10%" y="-10%" width="130%" height="130%">
      <feDropShadow dx="0" dy="2" stdDeviation="3" flood-color="#000000" flood-opacity="0.1" />
    </filter>`;

  // Arrow marker — collect all unique edge colors
  const markerColors = new Set<string>();
  for (const edge of edges) {
    const style = edge.style as { stroke?: string } | undefined;
    markerColors.add(style?.stroke || '#94a3b8');
  }
  if (markerColors.size === 0) markerColors.add('#94a3b8');

  for (const color of markerColors) {
    const markerId = `arrow-${color.replace('#', '')}`;
    defs += `
    <marker id="${markerId}" viewBox="0 0 10 10" refX="10" refY="5"
      markerWidth="8" markerHeight="8" orient="auto-start-reverse">
      <path d="M 0 0 L 10 5 L 0 10 z" fill="${color}" />
    </marker>`;
  }

  // ===== Assemble SVG =====
  let svg = `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg"
     xmlns:xlink="http://www.w3.org/1999/xlink"
     width="${svgWidth}" height="${svgHeight}"
     viewBox="0 0 ${svgWidth} ${svgHeight}">
  <defs>${defs}
  </defs>`;

  if (includeBackground) {
    svg += `\n  <rect width="${svgWidth}" height="${svgHeight}" fill="${backgroundColor}" />`;
  }

  svg += '\n  <g>';

  // ---- Draw edges (behind nodes) ----
  for (const edge of edges) {
    const sourceNode = nodes.find((n) => n.id === edge.source);
    const targetNode = nodes.find((n) => n.id === edge.target);
    if (!sourceNode || !targetNode) continue;

    const sw = sourceNode.measured?.width || sourceNode.width || 150;
    const sh = sourceNode.measured?.height || sourceNode.height || 50;
    const tw = targetNode.measured?.width || targetNode.width || 150;
    const th = targetNode.measured?.height || targetNode.height || 50;
    const edgeType = edge.type || 'default';
    const style = edge.style as { strokeWidth?: number; stroke?: string; strokeDasharray?: string } | undefined;
    const strokeWidth = style?.strokeWidth || 2;
    const stroke = style?.stroke || '#94a3b8';
    const strokeDasharray = style?.strokeDasharray;
    const dashAttr = strokeDasharray ? `stroke-dasharray="${strokeDasharray}"` : '';
    const markerId = `arrow-${stroke.replace('#', '')}`;

    // IMPORTANT: compute path in *offset* coordinate space so it matches node rendering
    const sourceAbs = getAbsolutePosition(sourceNode, nodes);
    const targetAbs = getAbsolutePosition(targetNode, nodes);

    const pathD = getEdgePath(
      sourceAbs.x - offsetX,
      sourceAbs.y - offsetY,
      sw, sh,
      targetAbs.x - offsetX,
      targetAbs.y - offsetY,
      tw, th,
      edgeType === 'step' ? 'step' : edgeType === 'straight' ? 'straight' : 'default'
    );

    const hasMarkerStart = !!edge.markerStart;
    const hasMarkerEnd = !!edge.markerEnd;
    const markerStartAttr = hasMarkerStart ? `marker-start="url(#${markerId})"` : '';
    const markerEndAttr = hasMarkerEnd ? `marker-end="url(#${markerId})"` : '';

    svg += `
    <path d="${pathD}"
      fill="none" stroke="${stroke}" stroke-width="${strokeWidth}" ${dashAttr}
      ${markerStartAttr} ${markerEndAttr} />`;

    if (edge.animated) {
      svg += `
    <path d="${pathD}"
      fill="none" stroke="${stroke}" stroke-width="${strokeWidth}"
      class="animated-flow" />`;
    }

    // Edge Label rendering
    if (edge.label && typeof edge.label === 'string') {
      const sCx = sourceAbs.x - offsetX + sw / 2;
      const sCy = sourceAbs.y - offsetY + sh / 2;
      const tCx = targetAbs.x - offsetX + tw / 2;
      const tCy = targetAbs.y - offsetY + th / 2;
      const angle = Math.atan2(tCy - sCy, tCx - sCx);
      const src = rectEdgePoint(sCx, sCy, sw / 2, sh / 2, angle);
      const tgt = rectEdgePoint(tCx, tCy, tw / 2, th / 2, angle + Math.PI);

      const lx = (src.x + tgt.x) / 2;
      const ly = (src.y + tgt.y) / 2;
      const labelLength = edge.label.length;
      const rectWidth = Math.max(60, labelLength * 6 + 10);

      svg += `
      <g>
        <rect x="${lx - rectWidth / 2}" y="${ly - 9}" width="${rectWidth}" height="18" rx="4" fill="${backgroundColor}" fill-opacity="0.95" stroke="${stroke}" stroke-width="0.5" />
        <text x="${lx}" y="${ly}" text-anchor="middle" dominant-baseline="middle"
          font-family="system-ui, -apple-system, sans-serif" font-size="9" font-weight="600" fill="${stroke}">${escapeXml(edge.label)}</text>
      </g>`;
    }
  }

  // ---- Draw nodes ----
  for (const node of nodes) {
    svg += `
    <g filter="url(#drop-shadow)">`;
    svg += renderShape(node, offsetX, offsetY, nodes);
    svg += renderText(node, offsetX, offsetY, nodes);
    svg += `
    </g>`;
  }

  svg += `
  </g>
</svg>`;

  return svg;
}

export function downloadSVG(svgContent: string, filename: string = 'diagram.svg'): void {
  const blob = new Blob([svgContent], { type: 'image/svg+xml;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}