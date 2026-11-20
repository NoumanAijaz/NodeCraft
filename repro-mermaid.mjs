// Regression tests for Mermaid diagram parsing in NodeCraft
// Run: node --experimental-strip-types repro-mermaid.mjs
import { parseMermaid, MERMAID_EXAMPLE } from './src/utils/mermaid.ts';

let failures = 0;
function check(name, cond, detail = '') {
  console.log(`${cond ? 'PASS' : 'FAIL'}  ${name}${detail ? '  — ' + detail : ''}`);
  if (!cond) failures++;
}

// 1. Chained arrow parsing (A --> B --> C)
{
  const res = parseMermaid('graph TD\nA --> B --> C');
  check('chained 3-node arrow nodes count', res.nodes.length === 3, `got ${res.nodes.length}`);
  check('chained 3-node arrow edges count', res.edges.length === 2, `got ${res.edges.length}`);
  check('chained 3-node arrow errors count', res.errors.length === 0, `errors: ${JSON.stringify(res.errors)}`);
}

// 2. Longer chain (A --> B --> C --> D)
{
  const res = parseMermaid('graph TD\nA --> B --> C --> D');
  check('chained 4-node arrow nodes count', res.nodes.length === 4, `got ${res.nodes.length}`);
  check('chained 4-node arrow edges count', res.edges.length === 3, `got ${res.edges.length}`);
  check('chained 4-node arrow errors count', res.errors.length === 0, `errors: ${JSON.stringify(res.errors)}`);
}

// 3. Labeled chain with custom node labels
{
  const res = parseMermaid('graph TD\nA[Start] -->|step 1| B[Middle] -->|step 2| C[End]');
  const labels = res.nodes.map(n => n.data.label);
  const edgeLabels = res.edges.map(e => e.label);
  check('labeled chain node labels', labels.includes('Start') && labels.includes('Middle') && labels.includes('End'));
  check('labeled chain edge labels', edgeLabels.includes('step 1') && edgeLabels.includes('step 2'));
  check('labeled chain errors count', res.errors.length === 0, `errors: ${JSON.stringify(res.errors)}`);
}

// 4. Default MERMAID_EXAMPLE regression check
{
  const res = parseMermaid(MERMAID_EXAMPLE);
  check('MERMAID_EXAMPLE nodes count', res.nodes.length === 5, `got ${res.nodes.length}`);
  check('MERMAID_EXAMPLE edges count', res.edges.length === 5, `got ${res.edges.length}`);
  check('MERMAID_EXAMPLE errors count', res.errors.length === 0, `errors: ${JSON.stringify(res.errors)}`);
}

// 5. Parse error detection preserves proper error reporting
{
  const resMissingTarget = parseMermaid('graph TD\nA -->');
  check('arrow without target generates error', resMissingTarget.errors.length === 1);

  const resUnexpectedTrailing = parseMermaid('graph TD\nA --> B extra');
  check('unexpected trailing token generates error', resUnexpectedTrailing.errors.length === 1);
}

// 6. Directional layout tests: BT (bottom-to-top) and RL (right-to-left)
{
  const resBT = parseMermaid('graph BT\nA[Bottom] --> B[Top]');
  const nodeA_BT = resBT.nodes.find(n => n.data.label === 'Bottom');
  const nodeB_BT = resBT.nodes.find(n => n.data.label === 'Top');
  check('graph BT positions: source is lower (greater Y) than target', nodeA_BT.position.y > nodeB_BT.position.y, `A.y=${nodeA_BT?.position.y}, B.y=${nodeB_BT?.position.y}`);

  const resTD = parseMermaid('graph TD\nA[Top] --> B[Bottom]');
  const nodeA_TD = resTD.nodes.find(n => n.data.label === 'Top');
  const nodeB_TD = resTD.nodes.find(n => n.data.label === 'Bottom');
  check('graph TD positions: source is higher (smaller Y) than target', nodeA_TD.position.y < nodeB_TD.position.y, `A.y=${nodeA_TD?.position.y}, B.y=${nodeB_TD?.position.y}`);

  const resRL = parseMermaid('graph RL\nA[Right] --> B[Left]');
  const nodeA_RL = resRL.nodes.find(n => n.data.label === 'Right');
  const nodeB_RL = resRL.nodes.find(n => n.data.label === 'Left');
  check('graph RL positions: source is further right (greater X) than target', nodeA_RL.position.x > nodeB_RL.position.x, `A.x=${nodeA_RL?.position.x}, B.x=${nodeB_RL?.position.x}`);

  const resLR = parseMermaid('graph LR\nA[Left] --> B[Right]');
  const nodeA_LR = resLR.nodes.find(n => n.data.label === 'Left');
  const nodeB_LR = resLR.nodes.find(n => n.data.label === 'Right');
  check('graph LR positions: source is further left (smaller X) than target', nodeA_LR.position.x < nodeB_LR.position.x, `A.x=${nodeA_LR?.position.x}, B.x=${nodeB_LR?.position.x}`);
}

console.log(failures ? `\n${failures} check(s) FAILED` : '\nAll Mermaid checks passed');
process.exit(failures ? 1 : 0);
