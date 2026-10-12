import { test, expect } from '@playwright/test';

const settingsKey = 'science-quiz-practice-count-v1';

test('设置全局题数：校验、取消、跨主题、刷新、当前练习与再次练习', async ({ page }) => {
  await page.addInitScript(() => {
    Math.random = () => 0.99999;
  });
  await page.goto('./');
  const open = page.getByRole('button', { name: '练习设置', exact: true });
  const input = page.getByRole('spinbutton', { name: '每次练习题数' });
  const dialog = page.getByRole('dialog', { name: '练习设置' });
  await open.click();
  await expect(input).toBeFocused();
  await expect(input).toHaveValue('10');
  for (const invalid of ['0', '-1', '1.5', '']) {
    await input.fill(invalid);
    await page.getByRole('button', { name: '保存设置' }).click();
    await expect(dialog).toBeVisible();
    expect(await page.evaluate((key) => localStorage.getItem(key), settingsKey)).toBeNull();
  }
  await input.fill('23');
  await page.getByRole('button', { name: '取消', exact: true }).click();
  await expect(open).toBeFocused();
  await open.click();
  await expect(input).toHaveValue('10');
  await input.fill('3');
  await page.getByRole('button', { name: '保存设置' }).click();
  await expect(dialog).toBeHidden();
  await page.reload();
  await page.getByRole('button', { name: '开始挑战：地球与宇宙', exact: true }).click();
  await expect(page.getByText('每次练习 3 题', { exact: false })).toBeVisible();
  await page.getByRole('button', { name: '开始练习', exact: true }).click();
  await expect(page.locator('.quiz-top')).toContainText('1 / 3');
  // Updating during a session affects the next session only.
  await open.click();
  await input.fill('7');
  await page.getByRole('button', { name: '保存设置' }).click();
  await expect(page.locator('.quiz-top')).toContainText('1 / 3');
  for (let i = 0; i < 3; i++) {
    await page.getByRole('radio').first().check();
    await page.getByRole('button', { name: '提交答案' }).click();
    const reveal = page.getByRole('button', { name: '查看解析', exact: true });
    if (await reveal.isVisible()) await reveal.click();
    await page.getByRole('button', { name: i === 2 ? '查看结果' : '下一题', exact: true }).click();
  }
  await page.getByRole('button', { name: '再练一次', exact: true }).click();
  await expect(page.locator('.quiz-top')).toContainText('1 / 7');
  await page.getByRole('button', { name: '返回主题', exact: true }).click();
  await page.getByRole('dialog').getByRole('button', { name: '返回主题', exact: true }).click();
  await page.getByRole('button', { name: '全部主题', exact: true }).click();
  await page.getByRole('button', { name: '开始挑战：光', exact: true }).click();
  await expect(page.getByText('每次练习 7 题', { exact: false })).toBeVisible();
  await page.getByRole('button', { name: '开始练习', exact: true }).click();
  await expect(page.locator('.quiz-top')).toContainText('1 / 7');
});

test('设置保存失败保留旧值；小屏幕和明暗主题可操作，离线恢复设置和天文题', async ({
  page,
  context,
}) => {
  await page.setViewportSize({ width: 320, height: 720 });
  await page.goto('./');
  const open = page.getByRole('button', { name: '练习设置', exact: true });
  await open.click();
  const input = page.getByRole('spinbutton', { name: '每次练习题数' });
  await input.fill('23');
  await page.evaluate(() => {
    const setItem = Storage.prototype.setItem;
    Storage.prototype.setItem = function (key, value) {
      if (key === 'science-quiz-practice-count-v1') throw new Error('blocked');
      return setItem.call(this, key, value);
    };
  });
  await page.getByRole('button', { name: '保存设置' }).click();
  await expect(page.getByRole('alert')).toContainText('设置暂时没能保存');
  await page.getByRole('button', { name: '取消', exact: true }).click();
  await page.reload();
  for (const dark of [false, true]) {
    if (dark) await page.getByRole('button', { name: '切换深色模式' }).click();
    await open.click();
    await expect(input).toHaveValue('10');
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
      true,
    );
    await page.screenshot({
      path: `output/playwright/settings-mobile-${dark ? 'dark' : 'light'}.png`,
      fullPage: true,
    });
    await page.keyboard.press('Escape');
    await expect(open).toBeFocused();
  }
  await page.setViewportSize({ width: 1440, height: 1000 });
  await open.click();
  await page.screenshot({ path: 'output/playwright/settings-desktop-dark.png', fullPage: true });
  await input.fill('23');
  await page.getByRole('button', { name: '保存设置' }).click();
  await page.evaluate(async () => {
    await navigator.serviceWorker.ready;
  });
  await context.setOffline(true);
  await page.reload();
  await page.getByRole('button', { name: '开始挑战：地球与宇宙', exact: true }).click();
  await expect(page.getByText('每次练习 23 题', { exact: false })).toBeVisible();
  await page.getByRole('button', { name: '开始练习', exact: true }).click();
  await expect(page.locator('.quiz-top')).toContainText('1 / 23');
});

test('错题练习使用设置；数量大于题库时按实际数量，指定材料仍保持完整', async ({ page }) => {
  await page.addInitScript(() => {
    localStorage.setItem('science-quiz-practice-count-v1', '1');
    localStorage.setItem(
      'science-quiz-progress-v1',
      JSON.stringify({
        version: 1,
        syncKey: 'a'.repeat(64),
        revision: 2,
        syncedRevision: 0,
        records: Object.fromEntries(
          ['science-121', 'science-122'].map((id) => [
            id,
            {
              id,
              topic: 'sound',
              attempts: 1,
              wrongCount: 1,
              lastResult: false,
              lastAttemptAt: '2026-10-12T08:00:00Z',
              lastWrongAt: '2026-10-12T08:00:00Z',
            },
          ]),
        ),
      }),
    );
  });
  await page.goto('./');
  await page
    .getByRole('navigation')
    .getByRole('button', { name: /我的错题/ })
    .click();
  await page.getByRole('button', { name: '再练错题', exact: true }).click();
  await expect(page.locator('.quiz-top')).toContainText('1 / 1');
  await page.getByRole('button', { name: '返回主题', exact: true }).click();
  await page.getByRole('dialog').getByRole('button', { name: '返回主题', exact: true }).click();
  await page.getByRole('button', { name: '开始挑战：声音', exact: true }).click();
  await page.getByRole('button', { name: /橡皮筋乐器/ }).click();
  await expect(page.locator('.quiz-top')).toContainText('1 / 5');
  await page.getByRole('button', { name: '返回主题', exact: true }).click();
  await page.getByRole('dialog').getByRole('button', { name: '返回主题', exact: true }).click();
  await page.getByRole('button', { name: '练习设置', exact: true }).click();
  await page.getByRole('spinbutton', { name: '每次练习题数' }).fill('1000');
  await page.getByRole('button', { name: '保存设置' }).click();
  await page.getByRole('button', { name: '开始练习', exact: true }).click();
  await expect(page.locator('.quiz-top')).toContainText('1 / 19');
});
