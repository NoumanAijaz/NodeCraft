import { describe, it, expect, beforeEach } from 'vitest';
import { useDiagramStore } from '../../src/store/useDiagramStore';

describe('useDiagramStore', () => {
  beforeEach(() => {
    useDiagramStore.getState().clearCanvas();
  });

  it('addNode creates a shape node and assigns portalId when inside a portal', () => {
    const store = useDiagramStore.getState();
    store.setActiveCanvasId('portal-canvas-42');

    store.addNode('rectangle', { x: 100, y: 150 });

    const nodes = useDiagramStore.getState().nodes;
    expect(nodes).toHaveLength(1);
    expect(nodes[0].type).toBe('shape');
    expect(nodes[0].position).toEqual({ x: 100, y: 150 });
    expect(nodes[0].data.portalId).toBe('portal-canvas-42');
  });

  it('deleteNode removes a node and prunes connected edges', () => {
    const store = useDiagramStore.getState();
    store.addNode('rectangle', { x: 10, y: 10 });
    store.addNode('circle', { x: 200, y: 200 });
    const [n1, n2] = useDiagramStore.getState().nodes;

    // Connect n1 -> n2
    store.onConnect({
      source: n1.id,
      target: n2.id,
      sourceHandle: null,
      targetHandle: null,
    });

    expect(useDiagramStore.getState().nodes).toHaveLength(2);
    expect(useDiagramStore.getState().edges).toHaveLength(1);

    // Delete n1
    useDiagramStore.getState().deleteNode(n1.id);

    const state = useDiagramStore.getState();
    expect(state.nodes).toHaveLength(1);
    expect(state.nodes[0].id).toBe(n2.id);
    expect(state.edges).toHaveLength(0); // Pruned
  });

  it('deleteNodes deletes multiple nodes and cleans up all incident edges', () => {
    const store = useDiagramStore.getState();
    store.addNode('rectangle', { x: 0, y: 0 });
    store.addNode('circle', { x: 100, y: 100 });
    store.addNode('diamond', { x: 200, y: 200 });
    const [n1, n2, n3] = useDiagramStore.getState().nodes;

    store.onConnect({ source: n1.id, target: n2.id, sourceHandle: null, targetHandle: null });
    store.onConnect({ source: n2.id, target: n3.id, sourceHandle: null, targetHandle: null });

    expect(useDiagramStore.getState().edges).toHaveLength(2);

    // Delete n1 and n2
    useDiagramStore.getState().deleteNodes([n1.id, n2.id]);

    const state = useDiagramStore.getState();
    expect(state.nodes).toHaveLength(1);
    expect(state.nodes[0].id).toBe(n3.id);
    expect(state.edges).toHaveLength(0);
  });

  it('deleteNodes cascade-deletes child nodes when parent group is deleted', () => {
    const store = useDiagramStore.getState();
    // Add parent group
    store.addNode('group', { x: 100, y: 100 });
    const parent = useDiagramStore.getState().nodes[0];

    // Add child node manually with parentId
    useDiagramStore.setState((s) => ({
      nodes: [
        ...s.nodes,
        {
          id: 'child-node-1',
          type: 'shape',
          position: { x: 20, y: 20 },
          parentId: parent.id,
          data: { label: 'Inside Group' },
        },
      ],
    }));

    expect(useDiagramStore.getState().nodes).toHaveLength(2);

    // Delete parent group node
    useDiagramStore.getState().deleteNode(parent.id);

    // Both parent and child should be removed
    expect(useDiagramStore.getState().nodes).toHaveLength(0);
  });

  it('deleteNodes cascade-deletes multi-level descendants even when out of order in array', () => {
    // Set up a hierarchy: top-group -> child-group -> grandchild
    // Put them in REVERSE order in the nodes array: [grandchild, child-group, top-group]
    useDiagramStore.setState({
      nodes: [
        {
          id: 'grandchild',
          type: 'shape',
          position: { x: 10, y: 10 },
          parentId: 'child-group',
          data: { label: 'Grandchild' },
        },
        {
          id: 'child-group',
          type: 'shape',
          position: { x: 50, y: 50 },
          parentId: 'top-group',
          data: { label: 'Child Group' },
        },
        {
          id: 'top-group',
          type: 'shape',
          position: { x: 100, y: 100 },
          data: { label: 'Top Group' },
        },
      ] as any,
    });

    expect(useDiagramStore.getState().nodes).toHaveLength(3);

    // Delete top-group
    useDiagramStore.getState().deleteNodes(['top-group']);

    // All descendants (child-group and grandchild) should be deleted
    expect(useDiagramStore.getState().nodes).toHaveLength(0);
  });

  it('deleteNodes resets activeCanvasId if the active portal node is deleted', () => {
    const store = useDiagramStore.getState();
    store.addNode('portal', { x: 50, y: 50 });
    const portalNode = useDiagramStore.getState().nodes[0];

    store.setActiveCanvasId(portalNode.id);
    expect(useDiagramStore.getState().activeCanvasId).toBe(portalNode.id);

    // Delete the portal node
    useDiagramStore.getState().deleteNode(portalNode.id);

    expect(useDiagramStore.getState().activeCanvasId).toBeNull();
  });

  it('duplicateSelectedNodes preserves child relative position when duplicating a group and its child', () => {
    useDiagramStore.setState({
      nodes: [
        {
          id: 'group-1',
          type: 'group',
          position: { x: 100, y: 100 },
          selected: true,
          data: { label: 'Group 1' },
        },
        {
          id: 'child-1',
          type: 'shape',
          position: { x: 20, y: 30 },
          parentId: 'group-1',
          selected: true,
          data: { label: 'Child 1' },
        },
      ] as any,
    });

    useDiagramStore.getState().duplicateSelectedNodes();

    const nodes = useDiagramStore.getState().nodes;
    expect(nodes).toHaveLength(4);

    const dupGroup = nodes.find(n => n.id !== 'group-1' && !n.parentId);
    const dupChild = nodes.find(n => n.id !== 'child-1' && n.parentId === dupGroup?.id);

    expect(dupGroup).toBeDefined();
    expect(dupChild).toBeDefined();
    // Parent should be shifted by +30px offset
    expect(dupGroup!.position).toEqual({ x: 130, y: 130 });
    // Child relative position inside parent must remain unchanged (no double-offset drift)
    expect(dupChild!.position).toEqual({ x: 20, y: 30 });
  });

  it('copySelection and pasteSelection preserve child relative position inside duplicated parent', () => {
    useDiagramStore.setState({
      nodes: [
        {
          id: 'g-orig',
          type: 'group',
          position: { x: 200, y: 200 },
          selected: true,
          data: { label: 'Group' },
        },
        {
          id: 'c-orig',
          type: 'shape',
          position: { x: 40, y: 50 },
          parentId: 'g-orig',
          selected: true,
          data: { label: 'Child' },
        },
      ] as any,
    });

    useDiagramStore.getState().copySelection();
    useDiagramStore.getState().pasteSelection();

    const nodes = useDiagramStore.getState().nodes;
    expect(nodes).toHaveLength(4);

    const pastedGroup = nodes.find(n => n.id !== 'g-orig' && !n.parentId);
    const pastedChild = nodes.find(n => n.id !== 'c-orig' && n.parentId === pastedGroup?.id);

    expect(pastedGroup).toBeDefined();
    expect(pastedChild).toBeDefined();
    // Parent shifted by +30px
    expect(pastedGroup!.position).toEqual({ x: 230, y: 230 });
    // Child relative position inside parent must remain unchanged
    expect(pastedChild!.position).toEqual({ x: 40, y: 50 });
  });

  it('layoutDiagram does not inflate vertical spacing when grouped children exist', () => {
    // Two top-level independent nodes
    const root1 = {
      id: 'root-1',
      type: 'shape',
      position: { x: 0, y: 0 },
      width: 160,
      height: 80,
      data: { label: 'Root 1' },
    };
    const root2 = {
      id: 'root-2',
      type: 'shape',
      position: { x: 0, y: 0 },
      width: 160,
      height: 80,
      data: { label: 'Root 2' },
    };
    // A group with 5 child nodes
    const group = {
      id: 'group-1',
      type: 'group',
      position: { x: 500, y: 500 },
      width: 400,
      height: 400,
      data: { label: 'Group' },
    };
    const children = Array.from({ length: 5 }, (_, i) => ({
      id: `child-${i}`,
      type: 'shape',
      parentId: 'group-1',
      position: { x: 20, y: 20 + i * 50 },
      width: 100,
      height: 40,
      data: { label: `Child ${i}` },
    }));

    useDiagramStore.setState({
      nodes: [root1, root2, group, ...children] as any,
      edges: [],
    });

    useDiagramStore.getState().layoutDiagram();

    const nodes = useDiagramStore.getState().nodes;
    const laidOutRoot1 = nodes.find(n => n.id === 'root-1');
    const laidOutRoot2 = nodes.find(n => n.id === 'root-2');

    expect(laidOutRoot1).toBeDefined();
    expect(laidOutRoot2).toBeDefined();

    // root-1 is positioned at rootY = 100 (center yCenter = 100 + 40 = 140, y = 140 - 40 = 100)
    expect(laidOutRoot1!.position.y).toBe(100);
    // root-2 should be placed below root-1 with subtreeHeight (80) + gap (120) = 300
    // Group children must NOT inflate rootY
    expect(laidOutRoot2!.position.y).toBe(300);
  });

  it('clearCanvas resets all canvas state', () => {
    const store = useDiagramStore.getState();
    store.addNode('rectangle', { x: 50, y: 50 });
    store.setActiveCanvasId('sub-canvas');
    store.setIsLocked(true);

    useDiagramStore.getState().clearCanvas();

    const state = useDiagramStore.getState();
    expect(state.nodes).toHaveLength(0);
    expect(state.edges).toHaveLength(0);
    expect(state.activeCanvasId).toBeNull();
    expect(state.isLocked).toBe(false);
  });

  it('updateNodesData updates data for multiple selected nodes without affecting others', () => {
    const store = useDiagramStore.getState();
    store.addNode('rectangle', { x: 0, y: 0 });
    store.addNode('circle', { x: 100, y: 100 });
    store.addNode('diamond', { x: 200, y: 200 });

    const [n1, n2, n3] = useDiagramStore.getState().nodes;
    store.updateNodesData([n1.id, n2.id], { locked: true, color: '#3b82f6' });

    const nodes = useDiagramStore.getState().nodes;
    expect(nodes.find((n) => n.id === n1.id)?.data.locked).toBe(true);
    expect(nodes.find((n) => n.id === n1.id)?.data.color).toBe('#3b82f6');
    expect(nodes.find((n) => n.id === n2.id)?.data.locked).toBe(true);
    expect(nodes.find((n) => n.id === n2.id)?.data.color).toBe('#3b82f6');
    expect(nodes.find((n) => n.id === n3.id)?.data.locked).toBeFalsy();
  });
});
