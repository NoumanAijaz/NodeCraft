import { describe, it, expect } from 'vitest';
import { parseMermaid, MERMAID_EXAMPLE } from '../../src/utils/mermaid';

describe('Mermaid Parser', () => {
  it('parses chained 3-node arrow (A --> B --> C)', () => {
    const res = parseMermaid('graph TD\nA --> B --> C');
    expect(res.nodes).toHaveLength(3);
    expect(res.edges).toHaveLength(2);
    expect(res.errors).toHaveLength(0);
    const nodeA = res.nodes.find((n) => n.data.label === 'A');
    const nodeB = res.nodes.find((n) => n.data.label === 'B');
    const nodeC = res.nodes.find((n) => n.data.label === 'C');
    expect(nodeA).toBeDefined();
    expect(nodeB).toBeDefined();
    expect(nodeC).toBeDefined();
    expect(res.edges[0].source).toBe(nodeA!.id);
    expect(res.edges[0].target).toBe(nodeB!.id);
    expect(res.edges[1].source).toBe(nodeB!.id);
    expect(res.edges[1].target).toBe(nodeC!.id);
  });

  it('parses chained 4-node arrow (A --> B --> C --> D)', () => {
    const res = parseMermaid('graph TD\nA --> B --> C --> D');
    expect(res.nodes).toHaveLength(4);
    expect(res.edges).toHaveLength(3);
    expect(res.errors).toHaveLength(0);
  });

  it('parses labeled chain with custom node labels', () => {
    const res = parseMermaid('graph TD\nA[Start] -->|step 1| B[Middle] -->|step 2| C[End]');
    const labels = res.nodes.map((n) => n.data.label);
    const edgeLabels = res.edges.map((e) => e.label);
    expect(labels).toContain('Start');
    expect(labels).toContain('Middle');
    expect(labels).toContain('End');
    expect(edgeLabels).toContain('step 1');
    expect(edgeLabels).toContain('step 2');
    expect(res.errors).toHaveLength(0);
  });

  it('parses MERMAID_EXAMPLE correctly', () => {
    const res = parseMermaid(MERMAID_EXAMPLE);
    expect(res.nodes).toHaveLength(5);
    expect(res.edges).toHaveLength(5);
    expect(res.errors).toHaveLength(0);
  });

  it('detects syntax errors properly', () => {
    const resMissingTarget = parseMermaid('graph TD\nA -->');
    expect(resMissingTarget.errors.length).toBeGreaterThanOrEqual(1);

    const resUnexpectedTrailing = parseMermaid('graph TD\nA --> B extra');
    expect(resUnexpectedTrailing.errors.length).toBeGreaterThanOrEqual(1);
  });

  it('supports directional layout: BT (bottom-to-top)', () => {
    const resBT = parseMermaid('graph BT\nA[Bottom] --> B[Top]');
    const nodeA = resBT.nodes.find((n) => n.data.label === 'Bottom');
    const nodeB = resBT.nodes.find((n) => n.data.label === 'Top');
    expect(nodeA).toBeDefined();
    expect(nodeB).toBeDefined();
    // In BT, source A is lower (greater Y) than target B
    expect(nodeA!.position.y).toBeGreaterThan(nodeB!.position.y);
  });

  it('supports directional layout: TD (top-to-down)', () => {
    const resTD = parseMermaid('graph TD\nA[Top] --> B[Bottom]');
    const nodeA = resTD.nodes.find((n) => n.data.label === 'Top');
    const nodeB = resTD.nodes.find((n) => n.data.label === 'Bottom');
    expect(nodeA).toBeDefined();
    expect(nodeB).toBeDefined();
    // In TD, source A is higher (smaller Y) than target B
    expect(nodeA!.position.y).toBeLessThan(nodeB!.position.y);
  });

  it('supports directional layout: RL (right-to-left)', () => {
    const resRL = parseMermaid('graph RL\nA[Right] --> B[Left]');
    const nodeA = resRL.nodes.find((n) => n.data.label === 'Right');
    const nodeB = resRL.nodes.find((n) => n.data.label === 'Left');
    expect(nodeA).toBeDefined();
    expect(nodeB).toBeDefined();
    // In RL, source A is further right (greater X) than target B
    expect(nodeA!.position.x).toBeGreaterThan(nodeB!.position.x);
  });

  it('supports directional layout: LR (left-to-right)', () => {
    const resLR = parseMermaid('graph LR\nA[Left] --> B[Right]');
    const nodeA = resLR.nodes.find((n) => n.data.label === 'Left');
    const nodeB = resLR.nodes.find((n) => n.data.label === 'Right');
    expect(nodeA).toBeDefined();
    expect(nodeB).toBeDefined();
    // In LR, source A is further left (smaller X) than target B
    expect(nodeA!.position.x).toBeLessThan(nodeB!.position.x);
  });
});
