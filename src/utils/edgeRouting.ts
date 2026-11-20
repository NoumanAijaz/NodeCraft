import { Position } from '@xyflow/react';
import type { Node } from '@xyflow/react';
import { getAbsolutePosition } from '../store/useDiagramStore';

export interface SmartRoutingResult {
  sourceX: number;
  sourceY: number;
  sourcePos: Position;
  targetX: number;
  targetY: number;
  targetPos: Position;
  sourceHandleId: string;
  targetHandleId: string;
  avoidancePath?: string | null;
  labelX?: number;
  labelY?: number;
}

export interface NodeBox {
  x: number;
  y: number;
  width: number;
  height: number;
}

interface HandlePoint {
  id: string;
  pos: Position;
  x: number;
  y: number;
  dir: { x: number; y: number };
}

/**
 * Projects a canvas point (e.g. from mouse drag) onto the closest face of a node box.
 * Returns the face name ('top' | 'right' | 'bottom' | 'left') and the normalized ratio
 * along that face (0 to 1), with middle-snapping near 0.5.
 */
export function projectPointToNodeBox(
  px: number,
  py: number,
  bx: number,
  by: number,
  bw: number,
  bh: number
): { face: 'top' | 'right' | 'bottom' | 'left'; ratio: number } {
  const safeW = Math.max(1, bw);
  const safeH = Math.max(1, bh);

  // Top edge
  const topX = Math.min(Math.max(px, bx), bx + safeW);
  const topY = by;
  const dTop = Math.hypot(px - topX, py - topY);
  const rTop = (topX - bx) / safeW;

  // Bottom edge
  const botX = Math.min(Math.max(px, bx), bx + safeW);
  const botY = by + safeH;
  const dBot = Math.hypot(px - botX, py - botY);
  const rBot = (botX - bx) / safeW;

  // Left edge
  const leftX = bx;
  const leftY = Math.min(Math.max(py, by), by + safeH);
  const dLeft = Math.hypot(px - leftX, py - leftY);
  const rLeft = (leftY - by) / safeH;

  // Right edge
  const rightX = bx + safeW;
  const rightY = Math.min(Math.max(py, by), by + safeH);
  const dRight = Math.hypot(px - rightX, py - rightY);
  const rRight = (rightY - by) / safeH;

  const candidates: Array<{ face: 'top' | 'right' | 'bottom' | 'left'; dist: number; ratio: number }> = [
    { face: 'top', dist: dTop, ratio: rTop },
    { face: 'bottom', dist: dBot, ratio: rBot },
    { face: 'left', dist: dLeft, ratio: rLeft },
    { face: 'right', dist: dRight, ratio: rRight },
  ];

  candidates.sort((a, b) => a.dist - b.dist);
  const best = candidates[0];

  // Snap to middle (0.5) within tolerance, otherwise clamp between 0.05 and 0.95
  let ratio = best.ratio;
  if (Math.abs(ratio - 0.5) < 0.08) {
    ratio = 0.5;
  } else {
    ratio = Math.max(0.05, Math.min(0.95, ratio));
  }

  return { face: best.face, ratio: Math.round(ratio * 1000) / 1000 };
}

/**
 * Computes a smooth obstacle avoidance curve when an edge connection
 * points backwards into or overlaps a connected node.
 */
export function computeAvoidancePath(
  sBox: NodeBox,
  sPt: { x: number; y: number },
  sFace: string,
  tBox: NodeBox,
  tPt: { x: number; y: number },
  tFace: string,
  pad: number = 32,
  cornerRadius: number = 24
): { path: string; labelX: number; labelY: number } | null {
  const sx = sBox.x;
  const sy = sBox.y;
  const sw = sBox.width;
  const sh = sBox.height;

  const tx = tBox.x;
  const ty = tBox.y;
  const tw = tBox.width;
  const th = tBox.height;

  const normals: Record<string, { x: number; y: number }> = {
    top: { x: 0, y: -1 },
    bottom: { x: 0, y: 1 },
    left: { x: -1, y: 0 },
    right: { x: 1, y: 0 },
  };

  const sn = normals[sFace] || { x: 1, y: 0 };
  const tn = normals[tFace] || { x: -1, y: 0 };

  // Check if source exit or target entry points directly into/behind the node body
  let sNeeds = false;
  if (sFace === 'left' && tPt.x > sx) {
    sNeeds = true;
  } else if (sFace === 'right' && tPt.x < sx + sw) {
    sNeeds = true;
  } else if (sFace === 'top' && tPt.y > sy) {
    sNeeds = true;
  } else if (sFace === 'bottom' && tPt.y < sy + sh) {
    sNeeds = true;
  }

  let tNeeds = false;
  if (tFace === 'left' && sPt.x > tx) {
    tNeeds = true;
  } else if (tFace === 'right' && sPt.x < tx + tw) {
    tNeeds = true;
  } else if (tFace === 'top' && sPt.y > ty) {
    tNeeds = true;
  } else if (tFace === 'bottom' && sPt.y < ty + th) {
    tNeeds = true;
  }

  if (!sNeeds && !tNeeds) {
    return null;
  }

  const sStub = { x: sPt.x + sn.x * pad, y: sPt.y + sn.y * pad };
  const tStub = { x: tPt.x + tn.x * pad, y: tPt.y + tn.y * pad };

  const waypoints: Array<{ x: number; y: number }> = [sPt, sStub];

  if (sNeeds) {
    if (sFace === 'left' || sFace === 'right') {
      const goTop = tPt.y < (sy + sh / 2);
      const bypassY = goTop ? sy - pad : sy + sh + pad;
      waypoints.push({ x: sStub.x, y: bypassY });
      if (sFace === 'left' && tPt.x > sx + sw) {
        waypoints.push({ x: sx + sw + pad, y: bypassY });
      } else if (sFace === 'right' && tPt.x < sx) {
        waypoints.push({ x: sx - pad, y: bypassY });
      }
    } else {
      const goLeft = tPt.x < (sx + sw / 2);
      const bypassX = goLeft ? sx - pad : sx + sw + pad;
      waypoints.push({ x: bypassX, y: sStub.y });
      if (sFace === 'top' && tPt.y > sy + sh) {
        waypoints.push({ x: bypassX, y: sy + sh + pad });
      } else if (sFace === 'bottom' && tPt.y < sy) {
        waypoints.push({ x: bypassX, y: sy - pad });
      }
    }
  }

  if (tNeeds) {
    if (tFace === 'left' || tFace === 'right') {
      const goTop = sPt.y < (ty + th / 2);
      const bypassY = goTop ? ty - pad : ty + th + pad;
      if (tFace === 'left' && sPt.x > tx + tw) {
        waypoints.push({ x: tx + tw + pad, y: bypassY });
      } else if (tFace === 'right' && sPt.x < tx) {
        waypoints.push({ x: tx - pad, y: bypassY });
      }
      waypoints.push({ x: tStub.x, y: bypassY });
    } else {
      const goLeft = sPt.x < (tx + tw / 2);
      const bypassX = goLeft ? tx - pad : tx + tw + pad;
      if (tFace === 'top' && sPt.y > ty + th) {
        waypoints.push({ x: bypassX, y: ty + th + pad });
      } else if (tFace === 'bottom' && sPt.y < ty) {
        waypoints.push({ x: bypassX, y: ty - pad });
      }
      waypoints.push({ x: bypassX, y: tStub.y });
    }
  }

  waypoints.push(tStub);
  waypoints.push(tPt);

  // Remove consecutive duplicate / colinear-adjacent points
  const filtered: Array<{ x: number; y: number }> = [waypoints[0]];
  for (let i = 1; i < waypoints.length; i++) {
    const p = waypoints[i];
    const prev = filtered[filtered.length - 1];
    if (Math.hypot(p.x - prev.x, p.y - prev.y) > 2) {
      filtered.push(p);
    }
  }

  if (filtered.length < 2) return null;

  const midIdx = Math.floor(filtered.length / 2);
  const labelX = filtered[midIdx].x;
  const labelY = filtered[midIdx].y;

  if (cornerRadius <= 0) {
    const d = [`M ${filtered[0].x.toFixed(1)} ${filtered[0].y.toFixed(1)}`];
    for (let i = 1; i < filtered.length; i++) {
      d.push(`L ${filtered[i].x.toFixed(1)} ${filtered[i].y.toFixed(1)}`);
    }
    return { path: d.join(' '), labelX, labelY };
  }

  const d = [`M ${filtered[0].x.toFixed(1)} ${filtered[0].y.toFixed(1)}`];
  for (let i = 1; i < filtered.length - 1; i++) {
    const prev = filtered[i - 1];
    const curr = filtered[i];
    const nxt = filtered[i + 1];

    const dx1 = curr.x - prev.x;
    const dy1 = curr.y - prev.y;
    const len1 = Math.hypot(dx1, dy1);

    const dx2 = nxt.x - curr.x;
    const dy2 = nxt.y - curr.y;
    const len2 = Math.hypot(dx2, dy2);

    if (len1 < 0.1 || len2 < 0.1) continue;

    const r = Math.min(cornerRadius, len1 / 2, len2 / 2);
    const startX = curr.x - (dx1 / len1) * r;
    const startY = curr.y - (dy1 / len1) * r;
    const endX = curr.x + (dx2 / len2) * r;
    const endY = curr.y + (dy2 / len2) * r;

    d.push(`L ${startX.toFixed(1)} ${startY.toFixed(1)}`);
    d.push(`Q ${curr.x.toFixed(1)} ${curr.y.toFixed(1)} ${endX.toFixed(1)} ${endY.toFixed(1)}`);
  }
  d.push(`L ${filtered[filtered.length - 1].x.toFixed(1)} ${filtered[filtered.length - 1].y.toFixed(1)}`);

  return { path: d.join(' '), labelX, labelY };
}

/**
 * Calculates the geometrically optimal connection points (handles) between two nodes
 * with sliding face ratios and obstacle avoidance routing.
 */
export function getSmartEdgeRouting(
  sourceNode: any,
  targetNode: any,
  sourceHandleId?: string | null,
  targetHandleId?: string | null,
  allNodes?: Node[],
  sourceRatio: number = 0.5,
  targetRatio: number = 0.5,
  edgeType: string = 'default'
): SmartRoutingResult {
  const sw: number = sourceNode.measured?.width ?? sourceNode.width ?? 150;
  const sh: number = sourceNode.measured?.height ?? sourceNode.height ?? 80;
  const tw: number = targetNode.measured?.width ?? targetNode.width ?? 150;
  const th: number = targetNode.measured?.height ?? targetNode.height ?? 80;

  // Resolve absolute positions (handles grouped/nested nodes)
  let sx: number, sy: number;
  if (sourceNode.internals?.positionAbsolute) {
    sx = sourceNode.internals.positionAbsolute.x;
    sy = sourceNode.internals.positionAbsolute.y;
  } else if (allNodes) {
    const abs = getAbsolutePosition(sourceNode, allNodes);
    sx = abs.x;
    sy = abs.y;
  } else {
    sx = sourceNode.position?.x ?? 0;
    sy = sourceNode.position?.y ?? 0;
  }

  let tx: number, ty: number;
  if (targetNode.internals?.positionAbsolute) {
    tx = targetNode.internals.positionAbsolute.x;
    ty = targetNode.internals.positionAbsolute.y;
  } else if (allNodes) {
    const abs = getAbsolutePosition(targetNode, allNodes);
    tx = abs.x;
    ty = abs.y;
  } else {
    tx = targetNode.position?.x ?? 0;
    ty = targetNode.position?.y ?? 0;
  }

  const sRatio = typeof sourceRatio === 'number' && Number.isFinite(sourceRatio)
    ? Math.max(0.05, Math.min(0.95, sourceRatio))
    : 0.5;
  const tRatio = typeof targetRatio === 'number' && Number.isFinite(targetRatio)
    ? Math.max(0.05, Math.min(0.95, targetRatio))
    : 0.5;

  // 4 Cardinal connection points on source node parameterized by sourceRatio
  const sHandles: HandlePoint[] = [
    { id: 'top', pos: Position.Top, x: sx + sw * sRatio, y: sy, dir: { x: 0, y: -1 } },
    { id: 'right', pos: Position.Right, x: sx + sw, y: sy + sh * sRatio, dir: { x: 1, y: 0 } },
    { id: 'bottom', pos: Position.Bottom, x: sx + sw * sRatio, y: sy + sh, dir: { x: 0, y: 1 } },
    { id: 'left', pos: Position.Left, x: sx, y: sy + sh * sRatio, dir: { x: -1, y: 0 } },
  ];

  // 4 Cardinal connection points on target node parameterized by targetRatio
  const tHandles: HandlePoint[] = [
    { id: 'top', pos: Position.Top, x: tx + tw * tRatio, y: ty, dir: { x: 0, y: 1 } },
    { id: 'right', pos: Position.Right, x: tx + tw, y: ty + th * tRatio, dir: { x: -1, y: 0 } },
    { id: 'bottom', pos: Position.Bottom, x: tx + tw * tRatio, y: ty + th, dir: { x: 0, y: -1 } },
    { id: 'left', pos: Position.Left, x: tx, y: ty + th * tRatio, dir: { x: 1, y: 0 } },
  ];

  const chosenS = sHandles.find(h => h.id === sourceHandleId);
  const chosenT = tHandles.find(h => h.id === targetHandleId);

  // If specific handles are explicitly constrained, respect the user's chosen faces
  if (chosenS && chosenT) {
    const cornerRadius = edgeType === 'step' ? 0 : edgeType === 'smoothstep' ? 12 : 24;
    const avoidance = computeAvoidancePath(
      { x: sx, y: sy, width: sw, height: sh },
      { x: chosenS.x, y: chosenS.y },
      chosenS.id,
      { x: tx, y: ty, width: tw, height: th },
      { x: chosenT.x, y: chosenT.y },
      chosenT.id,
      32,
      cornerRadius
    );

    return {
      sourceX: chosenS.x,
      sourceY: chosenS.y,
      sourcePos: chosenS.pos,
      targetX: chosenT.x,
      targetY: chosenT.y,
      targetPos: chosenT.pos,
      sourceHandleId: chosenS.id,
      targetHandleId: chosenT.id,
      avoidancePath: avoidance?.path ?? null,
      labelX: avoidance?.labelX,
      labelY: avoidance?.labelY,
    };
  }

  // Automatic best face search if handles were not explicitly locked
  const candidateS = chosenS ? [chosenS] : sHandles;
  const candidateT = chosenT ? [chosenT] : tHandles;

  let bestS = candidateS[0];
  let bestT = candidateT[0];
  let bestScore = -Infinity;

  for (const s of candidateS) {
    for (const t of candidateT) {
      const vx = t.x - s.x;
      const vy = t.y - s.y;
      const dist = Math.hypot(vx, vy);
      if (dist < 1) continue;
      const ux = vx / dist;
      const uy = vy / dist;

      const sDot = s.dir.x * ux + s.dir.y * uy;
      const tDot = t.dir.x * ux + t.dir.y * uy;

      let score = sDot + tDot;
      // Severely penalize reverse/backward vector alignments
      if (sDot < 0) score -= 3 * Math.abs(sDot);
      if (tDot < 0) score -= 3 * Math.abs(tDot);
      score -= dist / 2000;

      if (score > bestScore) {
        bestScore = score;
        bestS = s;
        bestT = t;
      }
    }
  }

  const cornerRadius = edgeType === 'step' ? 0 : edgeType === 'smoothstep' ? 12 : 24;
  const avoidance = computeAvoidancePath(
    { x: sx, y: sy, width: sw, height: sh },
    { x: bestS.x, y: bestS.y },
    bestS.id,
    { x: tx, y: ty, width: tw, height: th },
    { x: bestT.x, y: bestT.y },
    bestT.id,
    32,
    cornerRadius
  );

  return {
    sourceX: bestS.x,
    sourceY: bestS.y,
    sourcePos: bestS.pos,
    targetX: bestT.x,
    targetY: bestT.y,
    targetPos: bestT.pos,
    sourceHandleId: bestS.id,
    targetHandleId: bestT.id,
    avoidancePath: avoidance?.path ?? null,
    labelX: avoidance?.labelX,
    labelY: avoidance?.labelY,
  };
}
