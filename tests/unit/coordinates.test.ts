import { describe, it, expect } from 'vitest';
import { getAbsolutePosition } from '../../src/store/useDiagramStore';
import type { Node } from '@xyflow/react';

describe('Coordinate Translation Helpers & getAbsolutePosition', () => {
  it('returns identical coordinates for root nodes', () => {
    const rootNode: Node = {
      id: 'root-1',
      position: { x: 500, y: 400 },
      data: {},
    };
    const allNodes: Node[] = [rootNode];

    const abs = getAbsolutePosition(rootNode, allNodes);
    expect(abs.x).toBe(500);
    expect(abs.y).toBe(400);
  });

  it('calculates compound coordinates for single-nested child nodes', () => {
    const rootNode: Node = {
      id: 'root-1',
      position: { x: 500, y: 400 },
      data: {},
    };
    const childNode: Node = {
      id: 'child-1',
      parentId: 'root-1',
      position: { x: 50, y: 60 },
      data: {},
    };
    const allNodes: Node[] = [rootNode, childNode];

    const abs = getAbsolutePosition(childNode, allNodes);
    expect(abs.x).toBe(550);
    expect(abs.y).toBe(460);
  });

  it('calculates compound coordinates for multi-level nested grandchildren', () => {
    const rootNode: Node = {
      id: 'root-1',
      position: { x: 500, y: 400 },
      data: {},
    };
    const childNode: Node = {
      id: 'child-1',
      parentId: 'root-1',
      position: { x: 50, y: 60 },
      data: {},
    };
    const grandChildNode: Node = {
      id: 'grandchild-1',
      parentId: 'child-1',
      position: { x: 20, y: 30 },
      data: {},
    };
    const allNodes: Node[] = [rootNode, childNode, grandChildNode];

    const abs = getAbsolutePosition(grandChildNode, allNodes);
    expect(abs.x).toBe(570);
    expect(abs.y).toBe(490);
  });

  it('terminates safely on cyclic parentId references without infinite loops', () => {
    const nodeA: Node = {
      id: 'cycle-a',
      parentId: 'cycle-b',
      position: { x: 10, y: 10 },
      data: {},
    };
    const nodeB: Node = {
      id: 'cycle-b',
      parentId: 'cycle-a',
      position: { x: 20, y: 20 },
      data: {},
    };
    const allNodes: Node[] = [nodeA, nodeB];

    const abs = getAbsolutePosition(nodeA, allNodes);
    expect(Number.isFinite(abs.x)).toBe(true);
    expect(Number.isFinite(abs.y)).toBe(true);
  });

  it('sorts nodes visually left-to-right by absolute coordinates regardless of local grouping', () => {
    const groupNode: Node = { id: 'grp-1', position: { x: 1000, y: 0 }, data: {} };
    // Grouped child has local x=20, but absolute x=1020
    const groupedChild: Node = { id: 'grp-child', parentId: 'grp-1', position: { x: 20, y: 50 }, data: {} };
    // Ungrouped node has local and absolute x=300
    const ungroupedNode: Node = { id: 'ungrouped', position: { x: 300, y: 50 }, data: {} };
    const allNodes: Node[] = [groupNode, groupedChild, ungroupedNode];

    const sorted = [groupedChild, ungroupedNode].sort((a, b) => {
      const posA = getAbsolutePosition(a, allNodes);
      const posB = getAbsolutePosition(b, allNodes);
      if (Math.abs(posA.x - posB.x) < 50) return posA.y - posB.y;
      return posA.x - posB.x;
    });

    expect(sorted[0].id).toBe('ungrouped');
    expect(sorted[1].id).toBe('grp-child');
  });

  it('correctly calculates relative position when converting from absolute space in tree layout', () => {
    const groupNode: Node = { id: 'grp-1', position: { x: 500, y: 300 }, data: {} };
    const childNode: Node = { id: 'child-1', parentId: 'grp-1', position: { x: 80, y: 80 }, data: {} };
    const allNodes: Node[] = [groupNode, childNode];

    // Suppose layout computed absolute coordinates (550, 500) for childNode
    const targetAbs = { x: 550, y: 500 };
    const parent = allNodes.find((p) => p.id === childNode.parentId);
    const parentAbs = parent ? getAbsolutePosition(parent, allNodes) : { x: 0, y: 0 };
    const targetRel = {
      x: targetAbs.x - parentAbs.x,
      y: targetAbs.y - parentAbs.y,
    };

    expect(targetRel.x).toBe(50);
    expect(targetRel.y).toBe(200);
  });
});
