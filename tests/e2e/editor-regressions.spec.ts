import { expect, test, type Page } from '@playwright/test';
import { readFile } from 'node:fs/promises';

async function createSession(page: Page) {
  await page.route(/^https:\/\/fonts\.(googleapis|gstatic)\.com\//, route => route.abort());
  const registered = await page.request.post('/api/auth/register', {
    data: { username: `r_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 6)}`, password: 'Test-password-123' },
  });
  expect(registered.status()).toBe(201);
  const { token, user } = await registered.json();
  await page.addInitScript(({ token, user }) => {
    localStorage.setItem('nodecraft_token', token);
    localStorage.setItem('nodecraft_user', JSON.stringify(user));
  }, { token, user });
  return { Authorization: `Bearer ${token}` };
}

async function createProject(page: Page, headers: Record<string, string>, name: string) {
  const response = await page.request.post('/api/projects', { headers, data: { name } });
  expect(response.status()).toBe(201);
  const { project } = await response.json();
  return project.id as string;
}

async function openFileMenu(page: Page) {
  await page.getByRole('button', { name: 'File', exact: true }).click();
  await page.getByRole('button', { name: /^Open\.\.\./ }).click();
}

function shape(id: string, label: string, x = 0, borderColor = '#94a3b8') {
  return {
    id, type: 'shape', position: { x, y: 0 }, width: 240, height: 120,
    data: { label, shapeType: 'rectangle', borderColor, borderWidth: 12 },
  };
}

test('competing clients cannot save or restore against an old revision', async ({ page }) => {
  const headers = await createSession(page);
  const id = await createProject(page, headers, 'Revision checks');
  const url = `/api/projects/${id}`;
  const { project } = await (await page.request.get(url, { headers })).json();
  const savedVersion = await page.request.post(`${url}/versions`, { headers, data: { label: 'Original' } });
  expect(savedVersion.status()).toBe(201);
  const { version } = await savedVersion.json();
  const save = (boardNotes: string) => page.request.put(url, {
    headers,
    data: { revision: project.revision, data: { ...project.data, boardNotes } },
  });

  const responses = await Promise.all([save('First editor'), save('Second editor')]);
  expect(responses.map(response => response.status()).sort()).toEqual([200, 409]);
  const { revision } = await responses.find(response => response.ok())!.json();
  expect(revision).not.toBe(project.revision);
  const restoreUrl = `${url}/versions/${version.seq}/restore`;
  const stale = await page.request.post(restoreUrl, { headers, data: { revision: project.revision } });
  expect(stale.status()).toBe(409);
  const current = await (await page.request.get(url, { headers })).json();
  expect(current.project.revision).toBe(revision);
  expect(current.project.data.boardNotes).toBe(responses[0].ok() ? 'First editor' : 'Second editor');
  const restored = await page.request.post(restoreUrl, { headers, data: { revision } });
  expect(restored.status()).toBe(200);
  const restoredProject = await restored.json();
  expect(restoredProject.revision).not.toBe(revision);
  const afterRename = await page.request.put(`${url}/rename`, { headers, data: { name: 'Renamed elsewhere' } });
  expect(afterRename.ok()).toBe(true);
  const staleRenameSave = await page.request.put(url, {
    headers, data: { revision: restoredProject.revision, data: restoredProject.data },
  });
  expect(staleRenameSave.status()).toBe(409);
});

test('a stale editor keeps its notes and shows a conflict', async ({ page }) => {
  const headers = await createSession(page);
  const id = await createProject(page, headers, 'Two tabs');
  const editorUrl = `/project/${id}`;
  const apiUrl = `/api/projects/${id}`;
  await page.goto(editorUrl);
  await page.getByRole('button', { name: 'Board Notepad' }).click();
  const note = page.getByPlaceholder(/Jot down notes/);
  const firstSave = page.waitForResponse(response =>
    response.url().endsWith(apiUrl) && response.request().method() === 'PUT' && response.ok());
  await page.getByRole('button', { name: 'Save', exact: true }).click();
  await firstSave;

  const other = await page.context().newPage();
  await other.route(/^https:\/\/fonts\.(googleapis|gstatic)\.com\//, route => route.abort());
  await other.goto(editorUrl);
  await other.getByRole('button', { name: 'Board Notepad' }).click();
  await other.getByPlaceholder(/Jot down notes/).fill('Saved in the other tab');
  const saved = other.waitForResponse(response =>
    response.url().endsWith(apiUrl) && response.request().method() === 'PUT' && response.ok() &&
    response.request().postDataJSON().data.boardNotes === 'Saved in the other tab');
  await other.getByRole('button', { name: 'Save', exact: true }).click();
  await saved;

  await note.fill('Still in my tab');
  await page.getByRole('button', { name: 'Save', exact: true }).click();
  await expect(page.getByText('Cloud changed', { exact: true })).toBeVisible();
  await expect(note).toHaveValue('Still in my tab');
  const { project } = await (await page.request.get(apiUrl, { headers })).json();
  expect(project.data.boardNotes).toBe('Saved in the other tab');

  page.on('dialog', dialog => dialog.accept());
  await page.reload();
  await page.getByRole('button', { name: 'Board Notepad' }).click();
  await expect(note).toHaveValue('Saved in the other tab');
});

test('opens a local diagram through the File System Access picker', async ({ page }) => {
  const headers = await createSession(page);
  const id = await createProject(page, headers, 'Open local file');
  await page.addInitScript((diagram) => {
    let calls = 0;
    Object.defineProperty(window, 'showOpenFilePicker', {
      configurable: true,
      value: async () => {
        if (calls++) throw new DOMException('The picker was cancelled.', 'AbortError');
        const file = new File([JSON.stringify(diagram)], 'picked.ncraft', { type: 'application/json' });
        return [{ getFile: async () => file }];
      },
    });
  }, { nodes: [shape('from-local', 'Opened from local file')], edges: [] });
  await page.goto(`/project/${id}`);
  await openFileMenu(page);
  await expect(page.getByText('Opened from local file', { exact: true })).toBeVisible();
  await openFileMenu(page);
  await expect(page.getByText('Opened from local file', { exact: true })).toBeVisible();
  await expect(page.getByText('Failed to open file', { exact: true })).toHaveCount(0);
});

test('opens a local diagram through the browser file chooser fallback', async ({ page }) => {
  const headers = await createSession(page);
  const id = await createProject(page, headers, 'Open local file fallback');
  await page.addInitScript(() => {
    Reflect.deleteProperty(window, 'showOpenFilePicker');
    Reflect.deleteProperty(Window.prototype, 'showOpenFilePicker');
  });
  await page.goto(`/project/${id}`);
  const fileChooser = page.waitForEvent('filechooser');
  await openFileMenu(page);
  await (await fileChooser).setFiles({
    name: 'fallback.ncraft', mimeType: 'application/json',
    buffer: Buffer.from(JSON.stringify({ nodes: [shape('fallback', 'Opened via fallback')], edges: [] })),
  });
  await expect(page.getByText('Opened via fallback', { exact: true })).toBeVisible();
});

test('downloads an oversized diagram as a bounded PNG with both shapes rendered', async ({ page }) => {
  test.setTimeout(60_000);
  const headers = await createSession(page);
  const id = await createProject(page, headers, 'Large raster');
  const data = { nodes: [shape('left', 'Left', 0, '#ff0000'), shape('right', 'Right', 20_000, '#0000ff')], edges: [] };
  const seeded = await page.request.put(`/api/projects/${id}`, { headers, data: { data } });
  expect(seeded.ok()).toBe(true);
  await page.goto(`/project/${id}`);
  await expect(page.getByText('Right', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Export', exact: true }).click();
  const downloaded = page.waitForEvent('download');
  await page.getByRole('button', { name: /Export as PNG/ }).click();
  const download = await downloaded;
  expect(download.suggestedFilename()).toBe('Large_raster.png');
  const png = await readFile((await download.path())!);
  expect(png.subarray(0, 8).toString('hex')).toBe('89504e470d0a1a0a');
  const width = png.readUInt32BE(16);
  const height = png.readUInt32BE(20);
  expect(width).toBeGreaterThan(4000);
  expect(width).toBeLessThanOrEqual(8192);
  expect(height).toBeGreaterThan(0);
  expect(width * height).toBeLessThanOrEqual(16_000_000);
  const rendered = await page.evaluate(async (base64) => {
    const image = new Image();
    image.src = `data:image/png;base64,${base64}`;
    await image.decode();
    const canvas = document.createElement('canvas');
    canvas.width = image.width;
    canvas.height = image.height;
    const context = canvas.getContext('2d')!;
    context.drawImage(image, 0, 0);
    const { data } = context.getImageData(0, 0, canvas.width, canvas.height);
    let red = false;
    let blue = false;
    for (let pixel = 0; pixel < data.length; pixel += 4) {
      const [r, g, b] = [data[pixel], data[pixel + 1], data[pixel + 2]];
      if (r > 175 && g < 90 && b < 90) red = true;
      if (b > 175 && r < 90 && g < 90) blue = true;
    }
    return { red, blue };
  }, png.toString('base64'));
  expect(rendered).toEqual({ red: true, blue: true });
});

test('autosaves a board note on its own, even while presenting', async ({ page }) => {
  const headers = await createSession(page);
  const id = await createProject(page, headers, 'Autosave');
  await page.goto(`/project/${id}`);
  await page.getByRole('button', { name: 'Board Notepad' }).click();
  const note = page.getByPlaceholder(/Jot down notes/);
  await expect(note).toBeVisible();

  const save = page.waitForResponse(response =>
    response.url().endsWith(`/api/projects/${id}`) && response.request().method() === 'PUT' && response.ok());
  await page.getByRole('button', { name: 'Save', exact: true }).click();
  await save;
  await expect(page.getByText('Cloud Saved', { exact: true })).toBeVisible();
  const unsavedNote = 'Only the board note changed.';
  await note.fill(unsavedNote);
  await page.getByTitle('Enter Presentation Mode (Slideshow)').evaluate((button: HTMLButtonElement) => button.click());
  await expect(page.getByText('1 of 1', { exact: true })).toBeVisible();

  await expect.poll(async () => {
    const response = await page.request.get(`/api/projects/${id}`, { headers });
    const { project } = await response.json();
    return project.data.boardNotes;
  }, { timeout: 8000 }).toBe(unsavedNote);
});

test('keeps the current project when an earlier project load finishes late', async ({ page }) => {
  const headers = await createSession(page);
  const first = await createProject(page, headers, 'Slow project');
  const second = await createProject(page, headers, 'Current project');
  let release!: () => void;
  const delayed = new Promise<void>((resolve) => { release = resolve; });
  await page.route(`**/api/projects/${first}`, async route => {
    await delayed;
    await route.continue();
  });
  try {
    const loading = page.waitForRequest(response => response.url().endsWith(`/api/projects/${first}`));
    await page.goto(`/project/${first}`);
    await loading;
    await page.evaluate((id) => {
      history.pushState({}, '', `/project/${id}`);
      window.dispatchEvent(new PopStateEvent('popstate'));
    }, second);
    await expect(page.getByText('Current project', { exact: true })).toBeVisible();
    const lateResponse = page.waitForResponse(response => response.url().endsWith(`/api/projects/${first}`));
    release();
    await (await lateResponse).finished();
    const saved = page.waitForRequest(request => request.method() === 'PUT' && request.url().includes('/api/projects/'));
    await page.getByRole('button', { name: 'Save', exact: true }).click();
    expect((await saved).url()).toMatch(new RegExp(`/api/projects/${second}$`));
  } finally {
    release();
    await page.unrouteAll({ behavior: 'wait' });
  }
});

test('a slower earlier save cannot overwrite a newer manual save', async ({ page }) => {
  const headers = await createSession(page);
  const id = await createProject(page, headers, 'Save order');
  await page.goto(`/project/${id}`);
  await page.getByRole('button', { name: 'Board Notepad' }).click();
  const note = page.getByPlaceholder(/Jot down notes/);
  const save = page.getByRole('button', { name: 'Save', exact: true });
  let release!: () => void;
  const delayed = new Promise<void>((resolve) => { release = resolve; });
  const endpoint = `/api/projects/${id}`;
  const isSave = (request: import('@playwright/test').Request, value: string) =>
    request.method() === 'PUT' && request.url().endsWith(endpoint) && request.postDataJSON().data.boardNotes === value;
  await page.route(`**${endpoint}`, async route => {
    if (isSave(route.request(), 'older')) await delayed;
    await route.continue();
  });
  try {
    await note.fill('older');
    const olderStarted = page.waitForRequest(request => isSave(request, 'older'));
    await save.click();
    await olderStarted;
    await note.fill('newer');
    const newerFinished = page.waitForResponse(response => isSave(response.request(), 'newer') && response.ok());
    const olderFinished = page.waitForResponse(response => isSave(response.request(), 'older') && response.ok());
    await save.click();
    // Let an overlapping request finish first when saves are unordered.
    await Promise.race([newerFinished, new Promise(resolve => setTimeout(resolve, 1000))]);
    release();
    await Promise.all([olderFinished, newerFinished]);
    const response = await page.request.get(endpoint, { headers });
    const { project } = await response.json();
    expect(project.data.boardNotes).toBe('newer');
  } finally {
    release();
    await page.unrouteAll({ behavior: 'wait' });
  }
});

test('eraser leaves nodes on a hidden portal canvas intact', async ({ page }) => {
  const headers = await createSession(page);
  const id = await createProject(page, headers, 'Portal');
  const nodes = [
    { id: 'hidden', type: 'shape', position: { x: 0, y: 0 }, width: 160, height: 80, data: { label: 'Hidden shape', shapeType: 'rectangle', portalId: 'portal' } },
    { id: 'visible', type: 'shape', position: { x: 0, y: 0 }, width: 160, height: 80, data: { label: 'Visible shape', shapeType: 'rectangle' } },
    { id: 'portal', type: 'shape', position: { x: 300, y: 0 }, width: 120, height: 120, data: { label: 'Portal', shapeType: 'portal' } },
  ];
  const saved = await page.request.put(`/api/projects/${id}`, { headers, data: { data: { nodes, edges: [] } } });
  expect(saved.ok()).toBe(true);
  await page.goto(`/project/${id}`);
  const visibleNode = page.locator('.react-flow__node[data-id="visible"]');
  await expect(visibleNode).toBeVisible();
  await page.getByRole('button', { name: 'Eraser Tool' }).click();
  const bounds = (await visibleNode.boundingBox())!;
  await page.mouse.move(bounds.x + bounds.width / 2, bounds.y + bounds.height / 2);
  await page.mouse.down();
  await page.mouse.move(bounds.x + bounds.width / 2 + 5, bounds.y + bounds.height / 2);
  await page.mouse.up();
  await expect(visibleNode).toHaveCount(0);
  await page.getByRole('button', { name: 'Pan Tool' }).click();
  await page.locator('.react-flow__node[data-id="portal"]').getByText('Portal', { exact: true }).dblclick();
  await expect(page.getByText('Hidden shape', { exact: true })).toBeVisible();
});

test('the presentation advances with the Space key', async ({ page }) => {
  const headers = await createSession(page);
  const response = await page.request.post('/api/projects', { headers, data: { name: 'Slides', template: 'mindmap' } });
  expect(response.status()).toBe(201);
  const { project } = await response.json();
  await page.goto(`/project/${project.id}`);
  await page.getByTitle('Enter Presentation Mode (Slideshow)').click();
  await expect(page.getByText('1 of 6', { exact: true })).toBeVisible();
  await page.keyboard.press('Space');
  await expect(page.getByText('2 of 6', { exact: true })).toBeVisible();
});

test('the first slide focuses a node on the active portal canvas', async ({ page }) => {
  const headers = await createSession(page);
  const id = await createProject(page, headers, 'Portal slides');
  const nodes = [
    { id: 'portal', type: 'shape', position: { x: 0, y: 0 }, width: 120, height: 120, data: { label: 'Portal', shapeType: 'portal' } },
    { id: 'slide', type: 'shape', position: { x: 900, y: 600 }, width: 160, height: 80, data: { label: 'Portal slide', shapeType: 'rectangle', portalId: 'portal' } },
  ];
  const saved = await page.request.put(`/api/projects/${id}`, { headers, data: { data: { nodes, edges: [] } } });
  expect(saved.ok()).toBe(true);
  await page.goto(`/project/${id}`);
  await page.locator('.react-flow__node[data-id="portal"]').getByText('Portal', { exact: true }).dblclick();
  const slide = page.locator('.react-flow__node[data-id="slide"]');
  await expect(slide).toHaveCount(1);
  await page.getByTitle('Enter Presentation Mode (Slideshow)').click();
  await expect(page.getByText('1 of 1', { exact: true })).toBeVisible();
  await expect.poll(async () => {
    const viewport = (await page.locator('.react-flow').boundingBox())!;
    const bounds = (await slide.boundingBox())!;
    return Math.abs(viewport.x + viewport.width / 2 - bounds.x - bounds.width / 2);
  }).toBeLessThan(10);
});

test('the dashboard displays the name the server stored after a rename', async ({ page }) => {
  const headers = await createSession(page);
  const id = await createProject(page, headers, 'Before rename');
  await page.goto('/dashboard');
  await page.getByText('Before rename', { exact: true }).hover();
  await page.getByTitle('Rename').click();
  const name = 'A'.repeat(100);
  const input = page.getByRole('textbox').last();
  await input.fill(`${name} extra`);
  const rename = page.waitForResponse(response => response.url().endsWith(`/api/projects/${id}/rename`) && response.ok());
  await input.press('Enter');
  await rename;
  const response = await page.request.get(`/api/projects/${id}`, { headers });
  const { project } = await response.json();
  await expect(page.getByText(project.name, { exact: true })).toBeVisible();
  expect(project.name).toBe(name);
});
