# 离线版本更新

网站发布后，已打开的浏览器页面可能继续显示旧版。旧版缓存采用优先读取本地资源的方式，而新的 Service Worker 默认等待所有旧页面关闭才会接管。因此，新的部署已包含 252 道“地球与宇宙”题目时，旧页面仍可能显示 20 题且没有设置入口。

更新流程先绕过浏览器 HTTP 缓存，完整下载同一发布版本的资源。全部缓存成功后才让新 Worker 接管，无需等待其他标签页关闭。接管只影响后续请求，不会强制刷新正在答题的页面。用户刷新页面后看到新版；题库、HTML 和带版本哈希的脚本继续作为一致的发布版本从缓存读取，以保持离线运行。

如果页面依然显示旧内容，先刷新；首次升级时若仍未切换，稍等几秒再刷新，或关闭本站全部标签页后重新打开。无需清除浏览器数据。学习记录和练习设置保存在 localStorage，更新仅整理本应用作用域下的资源缓存。

`e2e/offline-update.spec.ts` 用真实浏览器加载旧 Worker 和精简旧界面（20 题），保持两个旧标签页打开，切换为真实生产构建，然后检查：新缓存接管后读取 252 题；另一个标签页的答题界面不被强制重载；刷新后出现设置入口；已有记录和题数设置保留；离线刷新仍显示 252 题；其他应用缓存不被删除。精简旧界面仅用于生命周期复现，不冒充全旧版应用验收。

初次运行该回归测试得到 `Expected: 252, Received: 20`；修复后通过。注册 Worker 时使用 `updateViaCache: 'none'`，防止更新检查使用旧脚本缓存。

相关机制见 [MDN：skipWaiting](https://developer.mozilla.org/en-US/docs/Web/API/ServiceWorkerGlobalScope/skipWaiting)、[MDN：updateViaCache](https://developer.mozilla.org/en-US/docs/Web/API/ServiceWorkerRegistration/updateViaCache) 和 [web.dev：Service Worker 生命周期](https://web.dev/articles/service-worker-lifecycle)。
