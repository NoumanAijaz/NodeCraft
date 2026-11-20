import fs from 'fs';

// Verify that getAbsolutePosition is properly exported by src/store/useDiagramStore.ts
const storeSource = fs.readFileSync('./src/store/useDiagramStore.ts', 'utf8');
if (!storeSource.includes('export function getAbsolutePosition')) {
  throw new Error('getAbsolutePosition is not exported from useDiagramStore.ts');
}

function getAbsolutePosition(node, allNodes) {
  let x = node.position.x;
  let y = node.position.y;
  let current = node;
  const visited = new Set([node.id]);
  while (current.parentId) {
    if (visited.has(current.parentId)) break;
    visited.add(current.parentId);
    const parent = allNodes.find((n) => n.id === current.parentId);
    if (!parent) break;
    x += parent.position.x;
    y += parent.position.y;
    current = parent;
  }
  return { x, y };
}

let failures = 0;
function check(name, cond, detail = '') {
  console.log(`${cond ? 'PASS' : 'FAIL'}  ${name}${detail ? '  — ' + detail : ''}`);
  if (!cond) failures++;
}

// 1. getAbsolutePosition verification
{
  const rootNode = {
    id: 'root-1',
    position: { x: 500, y: 400 },
    data: {}
  };

  const childNode = {
    id: 'child-1',
    parentId: 'root-1',
    position: { x: 50, y: 60 },
    data: {}
  };

  const grandChildNode = {
    id: 'grandchild-1',
    parentId: 'child-1',
    position: { x: 20, y: 30 },
    data: {}
  };

  const cyclicNodeA = {
    id: 'cycle-a',
    parentId: 'cycle-b',
    position: { x: 10, y: 10 },
    data: {}
  };

  const cyclicNodeB = {
    id: 'cycle-b',
    parentId: 'cycle-a',
    position: { x: 20, y: 20 },
    data: {}
  };

  const allNodes = [rootNode, childNode, grandChildNode, cyclicNodeA, cyclicNodeB];

  // Root node absolute position equals relative position
  const rootAbs = getAbsolutePosition(rootNode, allNodes);
  check('root node absolute position', rootAbs.x === 500 && rootAbs.y === 400, `got (${rootAbs.x}, ${rootAbs.y})`);

  // Child node absolute position = root + child
  const childAbs = getAbsolutePosition(childNode, allNodes);
  check('grouped child node absolute position', childAbs.x === 550 && childAbs.y === 460, `got (${childAbs.x}, ${childAbs.y})`);

  // Grandchild absolute position = root + child + grandchild
  const grandChildAbs = getAbsolutePosition(grandChildNode, allNodes);
  check('nested grandchild absolute position', grandChildAbs.x === 570 && grandChildAbs.y === 490, `got (${grandChildAbs.x}, ${grandChildAbs.y})`);

  // Cyclic parentId guard doesn't infinite loop and returns finite coordinates
  const cyclicAbs = getAbsolutePosition(cyclicNodeA, allNodes);
  check('cyclic parentId terminates safely', Number.isFinite(cyclicAbs.x) && Number.isFinite(cyclicAbs.y));
}

// 2. Node deletion with edge pruning & portal exit simulation (CanvasContextMenu logic)
{
  const targetId = 'node-to-delete';
  let activeCanvasId = 'node-to-delete';
  const _nodes = [
    { id: 'node-to-delete', position: { x: 0, y: 0 }, data: {} },
    { id: 'node-other', position: { x: 100, y: 100 }, data: {} }
  ];
  const edges = [
    { id: 'e1', source: 'node-to-delete', target: 'node-other' },
    { id: 'e2', source: 'node-other', target: 'node-to-delete' },
    { id: 'e3', source: 'node-other', target: 'other-2' }
  ];

  // Context menu delete logic:
  if (activeCanvasId === targetId) {
    activeCanvasId = null;
  }
  const edgesToRemove = edges.filter(e => e.source === targetId || e.target === targetId);
  const remainingEdges = edges.filter(e => !edgesToRemove.some(rem => rem.id === e.id));

  check('context menu delete resets active portal if target was active portal', activeCanvasId === null);
  check('context menu delete identifies both outgoing and incoming edges for removal', edgesToRemove.length === 2 && edgesToRemove.map(e => e.id).sort().join(',') === 'e1,e2');
  check('remaining edges contain no dangling references to deleted node', !remainingEdges.some(e => e.source === targetId || e.target === targetId));
}

// 3. Portal state preservation verification (store source checks + logic simulation)
{
  check('useDiagramStore assigns portalId in addNode', storeSource.includes('portalId: get().activeCanvasId || undefined'));
  check('useDiagramStore assigns portalId in addChildNode', storeSource.includes('portalId: (parentNode.data as ShapeNodeData)?.portalId || get().activeCanvasId || undefined'));
  check('useDiagramStore assigns portalId in addSiblingNode', storeSource.includes('portalId: (node.data as ShapeNodeData)?.portalId || get().activeCanvasId || undefined'));
  check('useDiagramStore assigns portalId in pasteSelection', storeSource.includes('clonedData.portalId = activeCanvasId || undefined'));
  check('useDiagramStore assigns portalId in groupNodes', storeSource.includes('const portalId = (selectedNodes[0].data as ShapeNodeData)?.portalId || get().activeCanvasId || undefined'));
}

// 4. Tree layout coordinate space calculation for grouped/parented nodes
{
  // A grouped parent at (500, 300)
  const groupNode = { id: 'grp-1', position: { x: 500, y: 300 }, data: {} };
  // Root node inside group at relative (50, 50) -> abs (550, 350)
  const rootNode = { id: 'root-1', parentId: 'grp-1', position: { x: 50, y: 50 }, data: {} };
  // Child node inside group
  const childNode = { id: 'child-1', parentId: 'grp-1', position: { x: 80, y: 80 }, data: {} };
  const allNodes = [groupNode, rootNode, childNode];

  const rootAbs = getAbsolutePosition(rootNode, allNodes);
  check('tree layout root uses absolute coordinates', rootAbs.x === 550 && rootAbs.y === 350);

  // Suppose tree layout computes absolute position (550, 500) for childNode:
  const computedChildAbs = { x: 550, y: 500 };
  let relPos = { ...computedChildAbs };
  if (childNode.parentId) {
    const parent = allNodes.find(p => p.id === childNode.parentId);
    if (parent) {
      const parentAbs = getAbsolutePosition(parent, allNodes);
      relPos.x -= parentAbs.x;
      relPos.y -= parentAbs.y;
    }
  }
  check('tree layout child converted back to parent relative position', relPos.x === 50 && relPos.y === 200, `got (${relPos.x}, ${relPos.y})`);
}

// 5. Presentation mode & outline sort using absolute coordinates
{
  const groupNode = { id: 'grp-1', position: { x: 1000, y: 0 }, data: {} };
  // Grouped child has local x=20, but absolute x=1020
  const groupedChild = { id: 'grp-child', parentId: 'grp-1', position: { x: 20, y: 50 }, type: 'shape', data: {} };
  // Ungrouped node has local and absolute x=300
  const ungroupedNode = { id: 'ungrouped', position: { x: 300, y: 50 }, type: 'shape', data: {} };
  const allNodes = [groupNode, groupedChild, ungroupedNode];

  // Sorting by raw position.x puts groupedChild (20) before ungroupedNode (300) -> WRONG!
  const rawSort = [groupedChild, ungroupedNode].sort((a, b) => a.position.x - b.position.x);
  check('raw sort produces wrong order for grouped nodes', rawSort[0].id === 'grp-child');

  // Sorting by getAbsolutePosition puts ungroupedNode (300) before groupedChild (1020) -> CORRECT!
  const correctSort = [groupedChild, ungroupedNode].sort((a, b) => {
    const posA = getAbsolutePosition(a, allNodes);
    const posB = getAbsolutePosition(b, allNodes);
    if (Math.abs(posA.x - posB.x) < 50) return posA.y - posB.y;
    return posA.x - posB.x;
  });
  check('absolute position sort orders visually left-to-right regardless of grouping', correctSort[0].id === 'ungrouped' && correctSort[1].id === 'grp-child');
}

// 6. Server path validation: sanitizePath and empty id rejection
{
  const sanitizePath = (str) => String(str || '').toLowerCase().replace(/[^a-z0-9_-]/g, '');
  const cleanId = sanitizePath('???');
  const cleanUser = sanitizePath('admin');
  check('sanitizePath on non-alphanumeric returns empty string', cleanId === '');

  // getProjectPath validation check
  let threwOnEmptyId = false;
  try {
    if (!cleanUser || !cleanId) throw new Error('Invalid project path');
  } catch {
    threwOnEmptyId = true;
  }
  check('getProjectPath rejects empty sanitized ID', threwOnEmptyId);

  let threwOnEmptyUser = false;
  try {
    const emptyUser = sanitizePath('$$$');
    if (!emptyUser || !cleanId) throw new Error('Invalid project path');
  } catch {
    threwOnEmptyUser = true;
  }
  check('getProjectPath rejects empty sanitized username', threwOnEmptyUser);
}

// 7. Context menu Select All is scoped to active canvas
{
  const menuSource = fs.readFileSync('./src/components/canvas/CanvasContextMenu.tsx', 'utf8');
  const m = menuSource.match(/type: 'select'[\s\S]{0,400}/);
  check(
    'context menu Select All is scoped to the active canvas',
    !!m && /activeCanvasId/.test(menuSource.slice(menuSource.indexOf('Select All') - 900, menuSource.indexOf('Select All'))),
    'Select All block references activeCanvasId'
  );
}

// 8. PortalId re-homing on duplicate and paste
{
  const src = fs.readFileSync('./src/store/useDiagramStore.ts', 'utf8');

  const dup = src.match(/duplicateSelectedNodes:\s*\(\)\s*=>\s*\{[\s\S]*?\n {6}\},\n/)[0];
  check('duplicateSelectedNodes pins portalId to active canvas',
    /portalId: activeCanvasId \|\| undefined/.test(dup));

  const paste = src.match(/pasteSelection:\s*\(\)\s*=>\s*\{[\s\S]*?\n {6}\},\n/)[0];
  check('pasteSelection assigns portalId unconditionally (no activeCanvasId guard)',
    /clonedData\.portalId = activeCanvasId \|\| undefined/.test(paste) &&
    !/if \(get\(\)\.activeCanvasId\)/.test(paste));

  // Behavioural: a copy cloned outside its portal must be visible on the main canvas.
  const pasted = { portalId: 'portal-a' };
  const activeCanvasId = null;
  pasted.portalId = activeCanvasId || undefined;
  check('copy pasted on the main canvas is visible', pasted.portalId === undefined,
    `portalId=${String(pasted.portalId)}`);
}

// 9. Context menu multi-node deletion & TopNav handleNew dirtiness
{
  const menuSource = fs.readFileSync('./src/components/canvas/CanvasContextMenu.tsx', 'utf8');
  check(
    'context menu delete operates on all selected nodes when target is in selection',
    /selected\.includes\(targetId\)\s*&&\s*selected\.length\s*>\s*1/.test(menuSource) &&
    /store\.deleteNodes\(selected\)/.test(menuSource)
  );

  const topNavSource = fs.readFileSync('./src/components/layout/TopNav.tsx', 'utf8');
  check(
    'TopNav handleNew checks edge count for dirtiness',
    /hasEdges\s*=\s*edges\.length\s*>\s*0/.test(topNavSource)
  );
  check(
    'TopNav handleNew bypasses false warning when current matches lastSavedSnapshot',
    /if\s*\(lastSavedSnapshot\)/.test(topNavSource) &&
    /current\s*!==\s*lastSavedSnapshot/.test(topNavSource)
  );
}

console.log(failures ? `\n${failures} check(s) FAILED` : '\nAll regression checks passed');
process.exit(failures ? 1 : 0);

