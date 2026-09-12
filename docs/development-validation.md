# 开发验证记录

日期：2026-09-12。本地实现，未提交、推送或部署。

## 已实现

- Vue 3 / TypeScript 的主题首页、主题详情、答题、结果、错题本五个视图；桌面／手机、浅色／深色主题。
- 正式题库包含 8 个主题、200 道题、8 组共享实验材料；全部具有解析。原始 Markdown 不变，内容修订见 `content-editorial.md`。
- 判断、单选、多选精确判题；材料组顺序；首次成绩与重试结果分离；本地错题记录和刷新恢复。
- Web Locks 下重新读取并合并本地记录，多标签页共享身份；延迟保存保留时间最新的答题状态。损坏存储不覆盖，写入失败可重试。
- 生产离线缓存；可选 GitHub 备份 Worker，包括设备白名单、限流、请求限制、冲突重试与确认回执。

## 验证证据

- `npm run format:check`：通过。
- `npm run check`：13 个 Vitest 测试通过；题库验证 8 / 200 / 8；TypeScript 与生产构建通过。
- 根路径浏览器测试：4 项通过（补充并发测试前）。
- `BASE_PATH=/Quiz410/ npm run build`：通过。
- `BASE_PATH=/Quiz410/ TEST_BASE_PATH=/Quiz410/ PLAYWRIGHT_CHANNEL=chrome npm run test:e2e`：5 项全部通过。
- 浏览器覆盖真实材料题、错误反馈／解析、错题刷新恢复、完整五题练习、移动端深色模式与无横向溢出、离线刷新、损坏记录保留、写入失败、多选重试首次成绩、多标签页并发保存。
- GitHub HTTP 测试使用模拟上游，覆盖来源／输入拒绝、文件创建、并发冲突、状态合并、远端失败、设备准入和限流；未写入真实 GitHub。
- 核心接口测试与后续准入／并发／延迟保存回归经历失败后修复。初始同步测试属于实现后的行为验证，不声称全部工作均为先测试后实现。

浏览器截图：`output/playwright/home-desktop.png`、`quiz-desktop.png`、`wrong-mobile-dark.png`、`quiz-mobile-dark.png`，均未纳入 Git。已人工检查首页及手机材料页截图。

## 审查与限制

Code review: harness-native fallback。仓库没有初始提交或可比较的 HEAD，`ce-code-review` 无法建立要求的差异基线，因此使用原生代码与 TypeScript 审查员直接审阅新增实现。

审查发现并修复了任意设备密钥触发远端写入、多标签页覆盖记录两个问题；复查未发现这两个修复的剩余阻断问题。简化审查去除了重复错题状态，并建立主题与材料查找索引。

真实 Worker 凭证、设备准入、GitHub Actions 和 Pages 尚未配置／在线验证。学科解析未经过外部专家审核。浏览器功能测试不等于完整屏幕阅读器或 Lighthouse 验收。清理网站数据会丢失本机记录；刷新不恢复未完成的练习会话。
