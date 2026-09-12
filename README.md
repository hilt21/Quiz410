# Science Quiz

面向小学高年级的科学练习应用。Vue 3 + TypeScript + Vite，200 道真实题目、8 个主题、8 组实验材料。无需登录，学习记录优先保存在本机。

## 本地运行

需要 Node.js 22.12+（建议 Node 22 LTS）。

```sh
npm ci
npm run dev
```

- `npm run validate`：严格验证 Schema、答案引用、材料关系和跨主题 ID。
- `npm test`：运行判题、题库、本地记录和同步接口测试。
- `npm run build`：校验题库、检查类型、构建应用并生成离线缓存。
- `npm run preview`：预览生产构建；离线功能仅在生产构建启用。
- `npm run check`：单元测试与生产构建。
- `npm run format:check`：检查新代码格式；`npm run format` 自动格式化。
- `npx playwright install chromium` 后运行 `npm run test:e2e`：浏览器流程。先执行 `npm run build`。
- 已安装 Chrome 的开发机也可用 `PLAYWRIGHT_CHANNEL=chrome npm run test:e2e`。

浏览器证据保存到 `output/playwright/`（不提交）。首次联网打开并完成离线缓存后，关闭或刷新仍可离线练习；首次从未访问过的网站无法凭空离线加载。正在使用的版本不会被中途替换，关闭所有旧页面再打开可启用新版本。

## 目录

- `src/components/`：答题与材料组件；`src/App.vue`：五个页面的应用状态和视图。
- `src/engine/`：题库读取、校验、判题和按材料组抽题。
- `src/progress/`：本地学习记录；`src/sync/`：可选远端备份客户端。
- `content/manifest.json`：主题目录；`content/science/*/questions.json`：正式题库。
- `content/assets/`：随内容发布的装饰素材。Vite 的 `publicDir` 指向 `content/`。
- `schemas/question.schema.json`：已确认的 Question Schema v1。
- `worker/github-sync/`：Cloudflare Worker 同步端点。
- `docs/`：原始 PRD、原题、Schema 验证和 UI 设计参考。

## 内容维护

新增主题：添加 `content/science/<topic-id>/questions.json` 并更新 manifest，不改答题引擎。题号稳定且全局唯一；不得因为重新分类而改号。材料组用有序 `questionIds` 关联单题。错题单独复习时仍加载完整材料。

当前 v1 支持判断、单选、多选和文本／表格材料，不包含题图、自由输入或步骤排序。`explanation` 必填；表格每行宽度须与表头一致。题库出现错误会使构建失败。

原始题库保持不变；正式 JSON 补充的解析、表格转写与少量科学表述修正见 [内容编辑记录](docs/content-editorial.md)。这不是赛事官方题库，解析尚未经过外部学科专家审核。

## 学习记录

每次提交更新尝试次数、错误次数与最近结果。每轮成绩按首次提交计算，重试不会改写该成绩；再次答对会从“待复习”移入“已掌握”，保留历史。刷新恢复学习记录，本轮未完成会话不恢复。

本地保存使用 Web Locks 串行合并多个标签页的提交；需要支持该 API 的现代浏览器及 HTTPS（本机 localhost 也可）。浏览器无法读写存储时会明确提示。损坏记录不会被自动清空或覆盖，用户可临时练习；清理浏览器网站数据会丢失本机记录。备份不等于实时跨设备同步。

## GitHub Pages

工作流在 PR 时校验和测试；`main` 推送后发布。仓库 Settings → Pages 的 Source 选择 GitHub Actions。项目站点路径由 `BASE_PATH` 设置，例如 `/Quiz410/`。

部署流水线已提供，当前开发不自动提交、推送或创建远端部署。实际远端 CI 与 Pages 发布必须在代码推送后验证。

## 可选 GitHub 备份

不配置时可以完整使用本地练习，错题本会说明云端备份暂不可用。

1. 在 `worker/github-sync/wrangler.toml` 配置 `ALLOWED_ORIGIN`、备份仓库和已存在的分支。若学习记录不应公开，使用独立的私有仓库。
2. 使用 Cloudflare Wrangler 部署 Worker；通过 `wrangler secret put GITHUB_TOKEN` 设置仅有目标仓库 Contents 读写权限的凭证。凭证绝不能写入前端或 Git。
3. 为获准备份的设备计算本机 `syncKey` 的 SHA-256（64 位十六进制），使用 `wrangler secret put ALLOWED_DEVICE_HASHES` 配置逗号分隔的摘要白名单。原始密钥留在浏览器，不要提交到 Git。未获准设备返回 403；缺少白名单或限流绑定时返回 503，不访问 GitHub。`wrangler.toml` 的限流绑定限制每台设备每分钟每个 Cloudflare 位置 5 次请求。
4. `.env.local` 设置 `VITE_SYNC_URL=https://<worker-host>` 后重新构建；GitHub Actions 使用同名 repository variable。
5. 点击“同步错题到 GitHub”才发送历史错题引用和记录。Worker 根据本机随机密钥的 SHA-256 派生匿名 profile 路径，不接受客户端指定其他 profile；请求上限 64 KiB、1000 条记录。

获准的本机密钥只授权自己的匿名记录，不是 GitHub Token。GitHub 并发冲突会重读并合并，重复同步不会重复累加计数。已掌握的历史错题也发送最近状态。同步失败不影响本地记录。

## 上线验证

需部署者配置真实 Worker 与 Pages 后，验证一次成功同步、一次断网失败、恢复网络后再次同步，并检查目标私有仓库中的匿名 JSON 文件。Worker 凭证和远端部署尚未在本次本地开发中配置；自动测试使用模拟 GitHub HTTP 响应，不声称完成真实远端写入。
