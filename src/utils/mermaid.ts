import { v4 as uuidv4 } from 'uuid';
import type { Node, Edge } from '@xyflow/react';

export interface MermaidParseResult {
  nodes: Node[];
  edges: Edge[];
  errors: string[];
  direction: string;
}

interface RawNode {
  id: string;
  label: string;
  shapeType: 'rectangle' | 'circle' | 'diamond' | 'cylinder';
}

// Alternation MUST be ordered longest-first so ((x)) wins over (x), [(x)] over [x]
const NODE_TOKEN = /^([A-Za-z0-9_]+)(\("[^"]*"\)|\(\([^)]*\)\)|\[\([^]]*\)\]|\{"[^"]*"\}|\{[^}]*\}|\["[^"]*"\]|\[[^\]]*\]|\("[^"]*"\)|\([^)]*\))?/;

interface ArrowPattern {
  re: RegExp;
  dotted?: boolean;
  /** Which capture group holds the edge label (1-based), if any */
  labelGroup?: number;
}

const ARROW_PATTERNS: ArrowPattern[] = [
  // A -- text --> B   /   A --- text ---> B
  { re: /^\s*--\s+([^>-]*?)\s+-{2,4}>\s*/, labelGroup: 1 },
  // A -.-> B   /   A -.->|label| B
  { re: /^\s*-\.-?>\s*(?:\|([^|]*)\|\s*)?/, dotted: true, labelGroup: 1 },
  // A ==> B   /   A ==>|label| B
  { re: /^\s*=+>\s*(?:\|([^|]*)\|\s*)?/, labelGroup: 1 },
  // A --> B   /   A -->|label| B   ({2,4} backtracks, so --> and ---> both work)
  { re: /^\s*-{2,4}>\s*(?:\|([^|]*)\|\s*)?/, labelGroup: 1 },
  // A --- B (open link)
  { re: /^\s*-{3}\s*/ },
];

function stripLabel(raw: string | undefined): string {
  if (!raw) return '';
  const delimiters = raw.startsWith('((') || raw.startsWith('[(') ? 2 : 1;
  return raw.slice(delimiters, -delimiters)
    .replace(/^"(.*)"$/, '$1')
    .trim();
}

function shapeFromToken(token: string | undefined, fallback: RawNode['shapeType']): RawNode['shapeType'] {
  if (!token) return fallback;
  if (/^\[\(.*\)\]$/.test(token)) return 'cylinder';
  if (/^\{.*\}$/.test(token)) return 'diamond';
  if (/^\(\(.*\)\)$/.test(token) || /^\(.*\)$/.test(token) || /^".*"$/.test(token)) return 'circle';
  return 'rectangle';
}

function parseLabelText(label: string): { text: string; lines: number } {
  const unescaped = label.replace(/\\"/g, '"').replace(/<br\s*\/?>/gi, '\n');
  const lines = unescaped.split('\n');
  return { text: unescaped.slice(0, 300), lines: lines.length };
}

/**
 * Parse a subset of Mermaid flowchart syntax into NodeCraft nodes/edges.
 * Supports: graph/flowchart TD|TB|LR|RL headers, node shapes [] () {} (( )) [( )],
 * arrows --> --- -.- -> -.-> ==>, pipe |label| and dash -- label --> forms,
 * chains (A --> B --> C), and %% comments. Unknown directives (subgraph,
 * classDef, style…) are skipped; unparsable lines are reported in errors.
 */
export function parseMermaid(text: string): MermaidParseResult {
  const errors: string[] = [];
  const registry = new Map<string, RawNode>();
  const rawEdges: Array<{ source: string; target: string; label?: string; animated?: boolean }> = [];
  let direction = 'TD';
  let sawHeader = false;

  const registerNode = (id: string, labelToken?: string): void => {
    const label = stripLabel(labelToken);
    const existing = registry.get(id);
    if (!existing) {
      registry.set(id, { id, label, shapeType: shapeFromToken(labelToken, 'rectangle') });
    } else if (label && !existing.label) {
      existing.label = label;
      existing.shapeType = shapeFromToken(labelToken, existing.shapeType);
    }
  };

  const lines = text.split('\n');
  for (let lineIdx = 0; lineIdx < lines.length; lineIdx++) {
    const rawLine = lines[lineIdx];
    const line = rawLine.trim();
    if (!line || line.startsWith('%%')) continue;

    const headerMatch = line.match(/^(graph|flowchart)\s+(TD|TB|LR|RL|BT)\b/i);
    if (headerMatch) {
      direction = headerMatch[2].toUpperCase();
      sawHeader = true;
      continue;
    }

    if (/^(subgraph\b|end\b|classDef\b|class\s|style\s|click\s|linkStyle\s|direction\s)/i.test(line)) {
      continue;
    }

    if (!sawHeader) {
      errors.push(`Line ${lineIdx + 1}: expected a "graph TD" or "flowchart LR" header first`);
      continue;
    }

    for (const stmt of line.split(';')) {
      let s = stmt.trim();
      if (!s) continue;

      while (s.length > 0) {
        const startMatch = s.match(NODE_TOKEN);
        if (!startMatch) {
          errors.push(`Line ${lineIdx + 1}: cannot parse "${s.slice(0, 40)}"`);
          break;
        }
        const sourceId = startMatch[1];
        let cursor = startMatch[0].length;
        const rest = s.slice(cursor);

        // Lookahead: a bare token with trailing junk is a parse error — don't register it.
        const hasArrow = ARROW_PATTERNS.some(p => p.re.test(rest));
        if (!hasArrow && rest.trim()) {
          errors.push(`Line ${lineIdx + 1}: unexpected "${rest.trim().slice(0, 30)}" after node "${sourceId}"`);
          break;
        }
        registerNode(sourceId, startMatch[2]);

        if (!hasArrow) break; // standalone declaration

        // Follow an edge chain
        let matchedArrow: ArrowPattern | null = null;
        let arrowMatch: RegExpMatchArray | null = null;
        for (const pattern of ARROW_PATTERNS) {
          const m = rest.match(pattern.re);
          if (m) {
            matchedArrow = pattern;
            arrowMatch = m;
            break;
          }
        }
        if (!matchedArrow || !arrowMatch) break;

        const afterArrow = rest.slice(arrowMatch[0].length);
        const targetMatch = afterArrow.match(NODE_TOKEN);
        if (!targetMatch) {
          errors.push(`Line ${lineIdx + 1}: arrow has no valid target in "${rest.slice(0, 40)}"`);
          break;
        }
        const targetId = targetMatch[1];
        registerNode(targetId, targetMatch[2]);

        const label =
          (matchedArrow.labelGroup != null ? arrowMatch[matchedArrow.labelGroup]?.trim() : undefined) ||
          undefined;

        rawEdges.push({
          source: sourceId,
          target: targetId,
          label: label ? label.slice(0, 80) : undefined,
          animated: Boolean(matchedArrow.dotted),
        });

        // Retain target node as source for the next link in a chain (e.g. A --> B --> C)
        s = afterArrow;
      }
    }
  }

  // ---------- layered layout ----------
  const ids = [...registry.keys()];
  const idSet = new Set(ids);
  const incoming = new Map<string, number>();
  const childrenMap = new Map<string, string[]>();
  for (const e of rawEdges) {
    if (!idSet.has(e.source) || !idSet.has(e.target)) continue;
    incoming.set(e.target, (incoming.get(e.target) || 0) + 1);
    if (!childrenMap.has(e.source)) childrenMap.set(e.source, []);
    childrenMap.get(e.source)!.push(e.target);
  }

  const rank = new Map<string, number>();
  // Longest-path-from-root ranking. A node's rank is its own max incoming
  // depth — we must NOT overwrite it with the subtree's deepest rank.
  const computeRank = (id: string, depth: number, visited: Set<string>): number => {
    if (visited.has(id)) return rank.get(id) ?? depth; // cycle guard
    visited.add(id);
    const current = Math.max(rank.get(id) ?? 0, depth);
    rank.set(id, current);
    let maxChild = current;
    for (const child of childrenMap.get(id) || []) {
      maxChild = Math.max(maxChild, computeRank(child, current + 1, new Set(visited)));
    }
    return maxChild;
  };
  for (const id of ids) {
    if (!incoming.get(id)) computeRank(id, 0, new Set());
  }
  for (const id of ids) {
    if (!rank.has(id)) computeRank(id, 0, new Set());
  }

  const ranks = new Map<number, string[]>();
  for (const id of ids) {
    const r = rank.get(id) ?? 0;
    if (!ranks.has(r)) ranks.set(r, []);
    ranks.get(r)!.push(id);
  }

  const vertical = direction === 'TD' || direction === 'TB' || direction === 'BT';
  const inverted = direction === 'BT' || direction === 'RL';
  const ALONG_SPACING = 240;
  const ACROSS_SPACING = 180;
  const ORIGIN = 100;
  const maxRank = ranks.size > 0 ? Math.max(...ranks.keys()) : 0;

  const positions = new Map<string, { x: number; y: number }>();
  for (const [r, members] of [...ranks.entries()].sort((a, b) => a[0] - b[0])) {
    const effectiveRank = inverted ? maxRank - r : r;
    members.forEach((id, idx) => {
      const along = idx * ALONG_SPACING;
      const across = effectiveRank * ACROSS_SPACING;
      positions.set(
        id,
        vertical
          ? { x: ORIGIN + along, y: ORIGIN + across }
          : { x: ORIGIN + across, y: ORIGIN + along }
      );
    });
  }

  const defaultSize: Record<RawNode['shapeType'], { w: number; h: number }> = {
    rectangle: { w: 160, h: 70 },
    circle: { w: 120, h: 120 },
    diamond: { w: 130, h: 110 },
    cylinder: { w: 150, h: 140 },
  };

  const mermaidToUuid = new Map<string, string>();
  const nodes: Node[] = ids.map((origId) => {
    const raw = registry.get(origId)!;
    const size = defaultSize[raw.shapeType];
    const parsed = parseLabelText(raw.label || origId);
    const pos = positions.get(origId) || { x: ORIGIN, y: ORIGIN };
    const uuid = uuidv4();
    mermaidToUuid.set(origId, uuid);
    return {
      id: uuid,
      type: 'shape',
      position: pos,
      width: size.w,
      height: Math.max(size.h, parsed.lines > 2 ? size.h + (parsed.lines - 2) * 16 : size.h),
      data: {
        label: parsed.text || origId,
        shapeType: raw.shapeType,
        color: raw.shapeType === 'diamond' ? '#fef08a' : '#ffffff',
        borderColor: raw.shapeType === 'diamond' ? '#eab308' : '#94a3b8',
        borderWidth: 2,
        fontSize: 14,
        align: 'center',
      },
    };
  });

  const edges: Edge[] = [];
  for (const e of rawEdges) {
    const source = mermaidToUuid.get(e.source);
    const target = mermaidToUuid.get(e.target);
    if (!source || !target || source === target) continue;
    const stroke = e.animated ? '#94a3b8' : '#64748b';
    edges.push({
      id: `e-${source}-${target}-${edges.length}`,
      source,
      target,
      type: 'default',
      label: e.label,
      animated: e.animated,
      style: { strokeWidth: 2, stroke },
      markerEnd: { type: 'arrowclosed' as never, width: 20, height: 20, color: stroke },
    });
  }

  return { nodes, edges, errors, direction };
}

export const MERMAID_EXAMPLE = `graph TD
    A[Start] --> B{Is it working?}
    B -- Yes --> C[Celebrate]
    B -->|No| D[Debug]
    D -.-> B
    C --> E[(Database)]`;
