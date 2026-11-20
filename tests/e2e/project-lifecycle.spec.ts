import { test, expect } from '@playwright/test';

test.describe('Project Lifecycle E2E Suite', () => {
  const testPassword = 'Password123!';

  test('full user flow: register -> create cloud project -> edit -> File > New -> verify both projects remain intact on dashboard', async ({ page }) => {
    // Keep username <= 20 chars (auth constraint is 3-20 chars)
    const testUsername = `u_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 6)}`;

    // Automatically accept any browser confirmation dialogs (e.g. "Create new diagram? Any unsaved changes will be lost.")
    page.on('dialog', (dialog) => dialog.accept());

    // 1. Navigate to register page
    await page.goto('/register');
    await expect(page.getByRole('heading', { name: 'Join NodeCraft' })).toBeVisible();

    // 2. Register account
    await page.getByPlaceholder('e.g. alex_dev').fill(testUsername);
    await page.getByPlaceholder('Create a password').fill(testPassword);
    await page.getByPlaceholder('Confirm password').fill(testPassword);
    await page.getByRole('button', { name: 'Create Account' }).click();

    // 3. Verify landing on dashboard
    await expect(page).toHaveURL(/\/dashboard/);
    await expect(page.getByText(testUsername)).toBeVisible();

    // 4. Create first project via "Blank Diagram" button
    const blankDiagramBtn = page.getByRole('button', { name: 'Blank Diagram Start with a clean canvas' });
    await expect(blankDiagramBtn).toBeVisible();
    await blankDiagramBtn.click();

    // 5. Verify navigation to the project canvas editor
    await expect(page).toHaveURL(/\/project\/[a-zA-Z0-9_-]+/);
    const firstProjectUrl = page.url();
    const firstProjectId = firstProjectUrl.split('/project/')[1];
    expect(firstProjectId).toBeTruthy();

    // Verify project editor TopNav is visible
    await expect(page.getByText('NodeCraft')).toBeVisible();

    // 6. Perform "File > New" to create second project
    const fileMenuBtn = page.getByRole('button', { name: 'File' });
    await fileMenuBtn.click();

    const newProjectItem = page.getByRole('button', { name: /New/ });
    await expect(newProjectItem).toBeVisible();
    await newProjectItem.click();

    // 7. Verify navigation to a brand new second project
    await page.waitForURL((url) => url.pathname.startsWith('/project/') && !url.pathname.includes(firstProjectId));
    const secondProjectUrl = page.url();
    const secondProjectId = secondProjectUrl.split('/project/')[1];
    expect(secondProjectId).toBeTruthy();
    expect(secondProjectId).not.toBe(firstProjectId);

    // 8. Return to dashboard
    const dashboardBtn = page.getByRole('button', { name: /Dashboard/ });
    await dashboardBtn.click();
    await expect(page).toHaveURL(/\/dashboard/);

    // 9. Verify both projects exist on the dashboard
    await expect(page.getByText('My Documents')).toBeVisible();
    await expect(page.getByText('(2)')).toBeVisible({ timeout: 10000 });

    // Verify each project card is rendered
    const projectCards = page.locator('div[class*="cursor-pointer"]');
    await expect(projectCards).toHaveCount(2);
  });
});
