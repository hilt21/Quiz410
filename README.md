# Science Quiz

面向小学高年级的科学练习应用，帮助孩子按主题探索知识、即时查看解析，并复习尚未掌握的题目。无需注册，学习记录优先保存在当前浏览器。

[在线体验](https://hilt21.github.io/Quiz410/) · [快速开始](#快速开始) · [内容维护](#内容维护) · [项目文档](#项目文档)

## 可以做什么

- **按主题练习**：432 道题、8 个主题、8 组实验材料，支持判断、单选和多选题。
- **探索地球与宇宙**：该主题共 252 题，包含从天文竞赛 PDF 整理、纠错并补充解析的 232 题。
- **设置练习长度**：右上角设置每次题数，默认 10 题，适用于主题、错题和再次练习；设置在本机保留。
- **即时反馈与错题复习**：提交后查看答案和解析，按主题筛选待复习或已掌握的历史错题。
- **离线与明暗主题**：生产版本完成首次联网缓存后可离线练习，主题跟随系统并支持手动切换。
- **可选错题备份**：通过独立的 Cloudflare Worker 将匿名学习记录备份到 GitHub，主动点击才发送。

技术栈：Vue 3、TypeScript、Vite、JSON Schema、localStorage、Service Worker；核心练习不依赖账号或云端服务。

## 快速开始

需要 **Node.js 22.12+、npm**；克隆仓库还需要 Git。CI 使用 Node.js 22。

```sh
git clone --branch main https://github.com/hilt21/Quiz410.git
cd Quiz410
npm ci
npm run dev
```

打开终端显示的本地地址。这里显式选择 `main`，与当前发布分支保持一致。

最小使用流程：

1. 选择一个科学主题，点击“开始挑战”，再点击“开始练习”。
2. 选择答案并提交，查看反馈和解析，再进入下一题。
3. 完成后查看本轮成绩，或进入“我的错题”再次练习。
4. 如需调整练习长度，打开右上角“练习设置”，输入正整数并保存。

新题数从下一次练习生效。题库不足时按实际数量出题；材料题整组保留，实际题数可能超过设置值或少于设置值。点选单道错题或指定材料时，按所选题目练习。

每轮成绩按首次提交计算，重试不会改写本轮成绩。再次答对的错题移入“已掌握”，保留历史。刷新可恢复学习记录和设置，但不恢复未完成的练习会话。

## 开发与验证

| 命令                   | 用途                                         |
| ---------------------- | -------------------------------------------- |
| `npm run dev`          | 启动本地开发服务器                           |
| `npm run validate`     | 校验题库 Schema、答案引用、材料关系和全局 ID |
| `npm test`             | 运行判题、内容、设置、本地记录及同步接口测试 |
| `npm run typecheck`    | 检查 Vue 与 TypeScript 类型                  |
| `npm run build`        | 校验内容、检查类型、构建应用并生成离线缓存   |
| `npm run preview`      | 预览生产构建                                 |
| `npm run check`        | 运行单元测试与生产构建                       |
| `npm run format:check` | 检查代码格式；`npm run format` 可自动格式化  |

浏览器测试先构建并安装 Chromium：

```sh
npm run build
npx playwright install chromium
npm run test:e2e
```

已有 Chrome 的开发机也可使用 `PLAYWRIGHT_CHANNEL=chrome npm run test:e2e`。测试覆盖答题、刷新持久化、多标签页并发、设置、离线与旧缓存升级；截图保存在 `output/playwright/`，不提交到 Git。

离线功能只在生产构建启用。首次从未访问过的网站无法离线加载；先联网打开并完成缓存。新版资源全部缓存成功后接管后续请求，不会强制刷新正在答题的页面。若仍显示旧题量或没有设置入口，稍等几秒再刷新，或关闭本站全部标签页后重新打开。详见 [离线版本更新](docs/offline-updates.md)。

本地记录通过 Web Locks 串行合并多个标签页的提交，需要支持该 API 的现代浏览器和 HTTPS（localhost 也可）。存储失败会显示提示；损坏记录不会被自动清空或覆盖。清除网站数据会删除本机学习记录及设置。

## 内容维护

题库位于 `content/science/<topic-id>/questions.json`，由 [manifest](content/manifest.json) 发现主题。新增主题只需添加题库并更新 manifest，无需修改答题引擎。

维护时遵循 [Question Schema v1](schemas/question.schema.json)：

- 保持题目 ID 稳定且全局唯一，保留来源和原题号，重新分类时不改号。
- 每题必须包含答案和解析，答案必须引用存在的选项。
- 共享材料通过有序 `questionIds` 关联题目；单独复习子题仍保留材料。
- 文本和表格材料受支持，表格每行列数必须与表头一致。
- 当前不支持题图、自由输入或步骤排序；题库错误会阻止构建。

```sh
npm run validate
npm run check
```

原始科学题库保留在 `docs/`，正式 JSON 的解析和表述修订见 [内容编辑记录](docs/content-editorial.md)。天文题的纠错、补编、重复合并和缺失题处理见 [天文整理记录](docs/astronomy/README.md)，也可独立阅读 [整理版题目与答案](docs/astronomy/questions.md)。这些内容不是赛事官方审定题库，未声称经过外部学科专家审核。

## 项目结构

| 路径                             | 职责                                       |
| -------------------------------- | ------------------------------------------ |
| `src/App.vue`、`src/components/` | 首页、主题、答题、结果、错题视图及材料组件 |
| `src/engine/`                    | 读取和验证内容，按材料组抽题、判题         |
| `src/progress/`、`src/sync/`     | 本地记录与设置、可选备份客户端             |
| `content/`、`schemas/`           | 主题目录、正式题库、装饰素材与内容契约     |
| `scripts/`                       | 内容校验和离线缓存生成                     |
| `tests/`、`e2e/`                 | 单元与边界测试、浏览器流程                 |
| `worker/github-sync/`            | Cloudflare Worker 备份端点                 |
| `docs/`                          | 需求、设计、原题、编辑与验证记录           |

Vite 将 `content/` 作为静态资源目录；完整题目始终来自题库，备份文件不复制题干。

## 部署到 GitHub Pages

[GitHub Actions 工作流](.github/workflows/ci.yml) 在 PR 时校验和测试，向 `main` 推送时通过检查后发布。仓库 **Settings → Pages → Source** 选择 **GitHub Actions**；部署依据工作流的 `main` 触发条件，而非仓库默认分支名称。

工作流根据仓库名称设置 `BASE_PATH`。本项目站点路径为 `/Quiz410/`，可按线上路径验证：

```sh
BASE_PATH=/Quiz410/ npm run build
BASE_PATH=/Quiz410/ TEST_BASE_PATH=/Quiz410/ npm run test:e2e
```

若启用远端备份，在 GitHub repository variables 中配置 `VITE_SYNC_URL`。推送后检查 Actions 的验证和部署任务，并确认线上题库及实际交互；本地构建通过不等于部署成功。

## 可选 GitHub 备份

不配置 Worker 也可完整使用本地练习。备份不是实时跨设备同步，也没有从远端恢复学习记录的界面。

1. 在 [Worker 配置](worker/github-sync/wrangler.toml) 设置 `ALLOWED_ORIGIN`、`GITHUB_REPOSITORY` 和已存在的 `GITHUB_BRANCH`；需保护学习记录时使用独立的私有仓库。
2. 在 `worker/github-sync/` 中使用 `wrangler secret put GITHUB_TOKEN` 设置凭证，授予目标仓库 Contents 读写权限，再通过 Cloudflare Wrangler 部署 Worker。GitHub 凭证只保存在服务端。
3. 对获准备份设备的本机 `syncKey` 计算 SHA-256，使用 `wrangler secret put ALLOWED_DEVICE_HASHES` 配置逗号分隔的 64 位十六进制摘要白名单。原始设备密钥留在浏览器，不提交到 Git。
4. 按 [.env.example](.env.example) 在根目录 `.env.local` 配置 Worker 地址，然后重新构建：

   ```dotenv
   VITE_SYNC_URL=https://<worker-host>
   ```

5. 在“我的错题”中点击“同步错题到 GitHub”，发送错题引用与历史状态，包括已掌握错题的最近结果。

Worker 根据设备密钥摘要派生匿名 profile，只授权该设备自己的记录。未获准设备返回 403；缺少白名单或限流绑定时返回 503，不访问 GitHub。配置限流为每台设备每分钟每个 Cloudflare 位置 5 次请求，请求上限为 64 KiB、1000 条记录。GitHub 并发冲突会重读合并，重复同步不会重复累加次数；同步失败不影响本地记录。

接口测试使用模拟 GitHub 响应。部署者仍需验证真实成功同步、断网失败和联网重试，并核对目标仓库的匿名 JSON 文件，才能确认远端备份可用。

## 项目文档

- [产品需求](docs/PRD.md)：范围、学习与错题流程、架构边界。
- [UI 设计](docs/ui-design/README.md)：布局、明暗主题和可访问性约束。
- [Schema 验证记录](docs/schema-validation/README.md)：题型与材料的数据契约验证。
- [开发验证记录](docs/development-validation.md)：初版实现与验证证据。
- [内容编辑记录](docs/content-editorial.md)：科学题与天文题的来源和编辑边界。
- [离线版本更新](docs/offline-updates.md)：旧缓存升级问题、修复机制与回归验证。
