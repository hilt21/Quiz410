import { test, expect } from '@playwright/test';
const snapshots = 'output/playwright';
test('真实材料题：错误反馈、刷新恢复、完成一组、移动端和离线', async ({ page, context }) => {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.goto('./');
  await expect(page.getByRole('heading', { name: '今天想挑战什么？' })).toBeVisible();
  await expect(page.getByRole('button', { name: /开始挑战：/ })).toHaveCount(8);
  await page.screenshot({ path: `${snapshots}/home-desktop.png`, fullPage: true });
  await page.getByRole('button', { name: '开始挑战：声音', exact: true }).click();
  await page.getByRole('button', { name: /橡皮筋乐器/ }).click();
  await expect(page.getByRole('table')).toBeVisible();
  await expect(page.getByRole('button', { name: '提交答案' })).toBeDisabled();
  await page.getByRole('radio', { name: '增大', exact: true }).check();
  await page.getByRole('button', { name: '提交答案' }).click();
  await expect(page.getByRole('heading', { name: '再想一想' })).toBeVisible();
  await page.getByRole('button', { name: '查看解析' }).click();
  await expect(page.getByText(/有效长度从8 cm增加到20 cm时/)).toBeVisible();
  await page.screenshot({ path: `${snapshots}/quiz-desktop.png`, fullPage: true });
  await page.reload();
  await page
    .getByRole('navigation')
    .getByRole('button', { name: /我的错题/ })
    .click();
  await expect(page.getByRole('button', { name: /待复习 1/ })).toBeVisible();
  await page.getByRole('button', { name: '再练错题', exact: true }).click();
  await expect(page.getByRole('table')).toBeVisible();
  await page.getByRole('radio', { name: '减小', exact: true }).check();
  await page.getByRole('button', { name: '提交答案' }).click();
  await page.getByRole('button', { name: '查看结果', exact: true }).click();
  await expect(page.getByRole('heading', { name: '完成！' })).toBeVisible();
  await page
    .getByRole('navigation')
    .getByRole('button', { name: /我的错题/ })
    .click();
  await expect(page.getByRole('button', { name: '待复习 0' })).toBeVisible();
  await expect(page.getByRole('button', { name: '已掌握 1' })).toBeVisible();
  await page.getByRole('button', { name: '已掌握 1' }).click();
  await page.getByRole('button', { name: '切换深色模式' }).click();
  await page.setViewportSize({ width: 390, height: 844 });
  await page.screenshot({ path: `${snapshots}/wrong-mobile-dark.png`, fullPage: true });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(
    true,
  );
  await page.getByRole('navigation').getByRole('button', { name: '主题练习' }).click();
  await page.getByRole('button', { name: '开始挑战：声音', exact: true }).click();
  await page.getByRole('button', { name: /橡皮筋乐器/ }).click();
  await page.getByRole('button', { name: '收起材料' }).click();
  await expect(page.getByRole('table')).toBeHidden();
  await page.getByRole('button', { name: '展开材料' }).click();
  await page.screenshot({ path: `${snapshots}/quiz-mobile-dark.png`, fullPage: true });
  for (let i = 0; i < 5; i++) {
    await page
      .getByRole('radio')
      .nth(i === 0 ? 1 : 0)
      .check();
    await page.getByRole('button', { name: '提交答案' }).click();
    await page.getByRole('button', { name: i === 4 ? '查看结果' : '下一题', exact: true }).click();
  }
  await expect(page.getByText('首次作答：答对 5 题，答错 0 题')).toBeVisible();
  await page.evaluate(async () => {
    await navigator.serviceWorker.ready;
  });
  await context.setOffline(true);
  await page.reload();
  await expect(page.getByRole('heading', { name: '今天想挑战什么？' })).toBeVisible();
  await expect(page.getByText(/当前离线/)).toBeVisible();
  expect(errors).toEqual([]);
});
test('读取损坏数据不会覆盖原记录', async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem('science-quiz-progress-v1', '{broken'));
  await page.goto('./');
  await expect(page.getByRole('alert')).toContainText('原记录已保留');
  await page.getByRole('button', { name: '开始挑战：声音', exact: true }).click();
  await page.getByRole('button', { name: /橡皮筋乐器/ }).click();
  await page.getByRole('radio').nth(1).check();
  await page.getByRole('button', { name: '提交答案' }).click();
  expect(await page.evaluate(() => localStorage.getItem('science-quiz-progress-v1'))).toBe(
    '{broken',
  );
});

test('判断和多选可操作，空选择不能提交，本地写入失败显示恢复入口', async ({ page }) => {
  await page.addInitScript(() => {
    Math.random = () => 0.99999;
  });
  await page.goto('./');
  await page.getByRole('button', { name: '开始挑战：声音', exact: true }).click();
  await page.getByRole('button', { name: '开始练习', exact: true }).click();
  await expect(page.getByText('判断题', { exact: true }).first()).toBeVisible();
  await page.getByRole('radio', { name: '正确', exact: true }).check();
  await page.evaluate(() => {
    Storage.prototype.setItem = () => {
      throw new DOMException('quota', 'QuotaExceededError');
    };
  });
  await page.getByRole('button', { name: '提交答案' }).click();
  await expect(page.getByRole('alert')).toContainText('暂时没能保存');
  await expect(page.getByRole('button', { name: '重试保存' })).toBeVisible();
});

test('多选必须选全；错误重试不改写本轮首次成绩', async ({ page }) => {
  await page.addInitScript(() => {
    localStorage.setItem(
      'science-quiz-progress-v1',
      JSON.stringify({
        version: 1,
        syncKey: 'a'.repeat(64),
        revision: 1,
        syncedRevision: 0,
        records: {
          'science-121': {
            id: 'science-121',
            topic: 'sound',
            attempts: 1,
            wrongCount: 1,
            lastResult: false,
            lastAttemptAt: '2026-09-12T08:00:00Z',
            lastWrongAt: '2026-09-12T08:00:00Z',
          },
        },
      }),
    );
  });
  await page.goto('./');
  await page
    .getByRole('navigation')
    .getByRole('button', { name: /我的错题/ })
    .click();
  await page.getByRole('button', { name: '再练错题', exact: true }).click();
  const choices = page.getByRole('checkbox');
  await expect(choices).toHaveCount(4);
  await choices.nth(0).check();
  await choices.nth(1).check();
  await page.getByRole('button', { name: '提交答案' }).click();
  await expect(page.getByRole('heading', { name: '再想一想' })).toBeVisible();
  await page.getByRole('button', { name: '重新选择' }).click();
  for (let i = 0; i < 3; i++) await choices.nth(i).check();
  await page.getByRole('button', { name: '提交答案' }).click();
  await expect(page.getByRole('heading', { name: '答对了！' })).toBeVisible();
  await page.getByRole('button', { name: '查看结果', exact: true }).click();
  await expect(page.getByText('首次作答：答对 0 题，答错 1 题')).toBeVisible();
});

test('两个标签页共享身份且并发提交不会覆盖次数', async ({ page, context }) => {
  const other = await context.newPage();
  for (const tab of [page, other]) {
    await tab.goto('./');
    await tab.getByRole('button', { name: '开始挑战：声音', exact: true }).click();
    await tab.getByRole('button', { name: /橡皮筋乐器/ }).click();
    await tab.getByRole('radio', { name: '减小', exact: true }).check();
  }
  const keyBefore = await page.evaluate(
    () => JSON.parse(localStorage.getItem('science-quiz-progress-v1')!).syncKey,
  );
  await Promise.all(
    [page, other].map((tab) => tab.getByRole('button', { name: '提交答案' }).click()),
  );
  await expect
    .poll(() =>
      page.evaluate(
        () =>
          JSON.parse(localStorage.getItem('science-quiz-progress-v1')!).records['science-161']
            ?.attempts,
      ),
    )
    .toBe(2);
  await other.getByRole('button', { name: '下一题', exact: true }).click();
  await other.getByRole('radio').first().check();
  await other.getByRole('button', { name: '提交答案' }).click();
  await expect
    .poll(() =>
      page.evaluate(
        () =>
          Object.keys(JSON.parse(localStorage.getItem('science-quiz-progress-v1')!).records).length,
      ),
    )
    .toBe(2);
  await page.reload();
  expect(
    await page.evaluate(
      () => JSON.parse(localStorage.getItem('science-quiz-progress-v1')!).syncKey,
    ),
  ).toBe(keyBefore);
});
