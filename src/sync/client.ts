import type { Progress } from '../progress/store';
export async function syncProgress(progress: Progress, endpoint: string): Promise<number> {
  if (!endpoint) throw new Error('云端备份暂不可用，本机练习照常使用。');
  const url = new URL(endpoint);
  if (
    url.protocol !== 'https:' &&
    !(url.protocol === 'http:' && ['localhost', '127.0.0.1'].includes(url.hostname))
  )
    throw new Error('同步服务地址无效');
  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${progress.syncKey}` },
    body: JSON.stringify({
      version: 1,
      questions: Object.values(progress.records).filter((r) => r.wrongCount > 0),
    }),
    signal: AbortSignal.timeout(15000),
  });
  if (!response.ok) throw new Error('同步失败，请稍后重新同步。');
  const receipt = await response.json();
  if (receipt?.ok !== true) throw new Error('未收到同步确认，请稍后重试。');
  return progress.revision;
}
