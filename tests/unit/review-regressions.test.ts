import { afterEach, describe, expect, it, vi } from 'vitest';
import { toPng } from 'html-to-image';
import { useDiagramStore } from '../../src/store/useDiagramStore';
import { exportNodesToPng } from '../../src/utils/pngExport';
import { parseMermaid } from '../../src/utils/mermaid';
import { api } from '../../src/utils/api';

vi.mock('html-to-image', () => ({ toPng: vi.fn(async () => 'data:image/png;base64,') }));

const node = (id: string, width = 160, height = 80) => ({
  id, type: 'shape', position: { x: 0, y: 0 }, width, height, data: { label: id },
});

afterEach(() => {
  if (vi.isFakeTimers()) vi.runOnlyPendingTimers();
  useDiagramStore.getState().clearCanvas();
  vi.restoreAllMocks();
  vi.useRealTimers();
});

describe('Diagram history', () => {
  it('undoes a burst of position changes in one step', () => {
    vi.useFakeTimers();
    useDiagramStore.getState().loadProject({ nodes: [node('a')], edges: [] });
    const { onNodesChange } = useDiagramStore.getState();
    onNodesChange([{ type: 'position', id: 'a', position: { x: 20, y: 10 } }]);
    onNodesChange([{ type: 'position', id: 'a', position: { x: 40, y: 20 } }]);
    vi.advanceTimersByTime(300);
    useDiagramStore.temporal.getState().undo();
    expect(useDiagramStore.getState().nodes[0].position).toEqual({ x: 0, y: 0 });
  });

  it('discards pending history when another project loads', () => {
    vi.useFakeTimers();
    const store = useDiagramStore.getState();
    store.loadProject({ nodes: [node('old')], edges: [] });
    store.onNodesChange([{ type: 'position', id: 'old', position: { x: 20, y: 10 } }]);
    store.loadProject({ nodes: [node('new')], edges: [] });
    vi.advanceTimersByTime(300);
    useDiagramStore.temporal.getState().undo();
    expect(useDiagramStore.getState().nodes.map((entry) => entry.id)).toEqual(['new']);
    expect(useDiagramStore.temporal.getState().pastStates).toHaveLength(0);
  });
});

it('exports oversized PNGs within the advertised canvas limits', async () => {
  vi.stubGlobal('document', { querySelector: () => ({}) });
  try {
    const result = await exportNodesToPng([node('large', 40_000, 40_000)], {
      backgroundColor: '#fff', maxPixelRatio: 2,
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.width).toBeLessThanOrEqual(8192);
    expect(result.width * result.height).toBeLessThanOrEqual(16_000_000);
    expect(toPng).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({ pixelRatio: result.pixelRatio }));
  } finally {
    vi.unstubAllGlobals();
  }
});

it('keeps both output dimensions positive for a very wide diagram', async () => {
  vi.stubGlobal('document', { querySelector: () => ({}) });
  try {
    const result = await exportNodesToPng([node('wide', 2_000_000, 80)], {
      backgroundColor: '#fff', maxPixelRatio: 2,
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.height).toBe(1);
    expect(toPng).toHaveBeenLastCalledWith(expect.anything(), expect.objectContaining({
      canvasHeight: expect.any(Number),
    }));
  } finally {
    vi.unstubAllGlobals();
  }
});

it('preserves literal delimiters in Mermaid labels', () => {
  const result = parseMermaid('flowchart TD\nA["(Draft)"] --> B{[Review]}');
  expect(result.errors).toEqual([]);
  expect(result.nodes.map((entry) => entry.data.label)).toEqual(['(Draft)', '[Review]']);
});

it('loads older shapes with missing data without crashing the editor', () => {
  const legacyNode = { id: 'legacy', type: 'shape', position: { x: 0, y: 0 } };
  useDiagramStore.getState().loadProject({ nodes: [legacyNode as ReturnType<typeof node>], edges: [] });
  expect(useDiagramStore.getState().nodes[0].data).toEqual({});
});

it('keeps a newer session when a request from the previous session returns unauthorized', async () => {
  let complete!: (response: Response) => void;
  vi.stubGlobal('fetch', vi.fn(() => new Promise<Response>((resolve) => { complete = resolve; })));
  vi.stubGlobal('window', new EventTarget());
  try {
    localStorage.setItem('nodecraft_token', 'previous');
    const pending = api.get('/projects');
    localStorage.setItem('nodecraft_token', 'current');
    complete(Response.json({ error: 'Session expired' }, { status: 401 }));
    await expect(pending).rejects.toThrow('Session expired');
    expect(localStorage.getItem('nodecraft_token')).toBe('current');
  } finally {
    localStorage.removeItem('nodecraft_token');
    vi.unstubAllGlobals();
  }
});
