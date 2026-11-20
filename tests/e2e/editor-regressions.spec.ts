import { expect, test, type Page } from '@playwright/test';

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
