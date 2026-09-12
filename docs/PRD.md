# 儿童科学答题系统 PRD

## 1. 产品概述

### 1.1 产品名称

暂定：Science Quiz

### 1.2 产品定位

一个面向约 10 岁儿童的轻量科学答题系统。

系统部署于 GitHub Pages，以主题组织题库，支持持续增加题目。儿童可以按主题练习、即时查看反馈与解析、自动记录学习进度和错题。

系统采用 Local First 模式。核心答题流程完全在浏览器中运行，学习记录自动保存在本地。用户可以主动将错题记录同步至 GitHub，形成长期、可版本化的学习数据。

### 1.3 核心产品原则

1. 儿童可以直接使用，无需注册或登录。
2. 新增题目属于内容操作，原则上不修改程序代码。
3. 题库、答题引擎、用户学习状态保持清晰边界。
4. 抽题、判题、计分、保存等确定性任务由代码执行。
5. 网络不可用时，核心答题功能仍然可用。
6. GitHub 只承担部署、题库版本管理和可选学习记录同步。
7. 第一版保持小而稳定，不提前引入账号、数据库、AI 和复杂状态管理。

---

# 2. 目标用户

## 2.1 Primary User

年龄约 10 岁的小学生。

典型特征：

* 可以独立阅读题目
* 使用平板、手机或电脑
* 注意力持续时间有限
* 更适合即时反馈
* 需要清晰、宽松、大尺寸的交互元素
* 科学题目可能同时包含文字、图片和实验场景

## 2.2 Content Maintainer

家长、教师或题库维护者。

主要任务：

* 添加题目
* 修改题目
* 创建新主题
* 添加题目图片
* 检查题库格式
* 查看 GitHub 中同步的错题记录

维护题库原则上不需要修改 Quiz Engine。

---

# 3. 产品目标

MVP 需要完成三个核心闭环。

### 3.1 学习闭环

```text
选择主题
↓
开始答题
↓
选择答案
↓
提交
↓
即时反馈
↓
查看解析
↓
下一题
↓
完成练习
```

### 3.2 错题闭环

```text
回答错误
↓
自动记录
↓
进入错题本
↓
只练错题
↓
再次作答
↓
更新掌握状态
```

### 3.3 数据闭环

```text
答题
↓
Local Progress
↓
浏览器自动保存
↓
点击「同步错题到 GitHub」
↓
GitHub wrong questions 文件
```

---

# 4. MVP 范围

## 4.1 必须实现

### 主题

支持：

* 主题列表
* 主题名称
* 图标
* 简短介绍
* 题目数量
* 当前学习进度

示例：

```text
🚀 力与运动
🌈 光
⚡ 电
🧲 磁
🔬 实验探究
```

主题来源统一由 `manifest.json` 描述。

---

### 题型

MVP 支持：

```text
single-choice
multiple-choice
true-false
```

分别对应：

* 单选题
* 多选题
* 判断题

后续可扩展：

```text
image-choice
ordering
matching
short-answer
```

Quiz Engine 不应依赖具体主题。

---

### 答题

支持：

* 读取主题题库
* 随机抽题
* 题目随机排序
* 选项展示
* 提交答案
* 判题
* 正确反馈
* 错误反馈
* 查看解析
* 下一题
* 答题进度
* 完成页

MVP 默认不设置倒计时。

---

### 错题本

答错时自动记录。

保存：

* Question ID
* Topic ID
* 尝试次数
* 错误次数
* 最近答题结果
* 最近错误时间

支持：

```text
只练错题
```

同一道题再次答错时增加错误次数，不重复创建记录。

---

### Local Progress

所有学习数据自动保存于浏览器。

MVP 使用：

```text
localStorage
```

保存内容包括：

* 每题尝试次数
* 错误次数
* 最近结果
* 主题完成进度
* 错题记录
* 最近答题时间

页面刷新和浏览器重新打开后仍可恢复。

核心答题流程不得依赖网络。

---

# 5. GitHub 错题同步

## 5.1 功能入口

提供：

```text
同步错题到 GitHub
```

按钮。

按钮属于显式用户操作。

每次答错题后不直接向 GitHub 提交。

---

## 5.2 同步流程

```text
Local Progress
↓
提取 Wrong Questions
↓
生成 Sync Payload
↓
Sync API
↓
GitHub API
↓
wrong-questions.json
```

前端不得包含 GitHub Personal Access Token。

GitHub 凭证保存在安全的 Serverless 环境。

推荐：

```text
Cloudflare Worker
```

Worker 只承担：

1. 请求认证
2. Payload 校验
3. 读取 GitHub 文件
4. Merge
5. 写入 GitHub
6. 返回同步结果

---

## 5.3 GitHub 文件结构

建议：

```text
progress/
└── profile-a7f3/
    └── wrong-questions.json
```

Profile 使用匿名 ID。

不得写儿童真实姓名。

---

## 5.4 Wrong Questions Schema

`wrong-questions.json` 只保存 Question Reference 和学习状态。

不复制完整题目。

示例：

```json
{
  "version": 1,
  "updatedAt": "2026-09-12T12:30:00Z",
  "questions": [
    {
      "id": "force-001",
      "topic": "force-motion",
      "wrongCount": 2,
      "attempts": 3,
      "lastWrongAt": "2026-09-12T12:20:00Z"
    }
  ]
}
```

完整题目始终从 Question Bank 获取。

Question Bank 是题目内容的 Single Source of Truth。

---

## 5.5 同步状态

UI 至少显示：

```text
已同步

3 个错题待同步

正在同步

同步成功

同步失败
本地数据已保存

重新同步
```

网络错误不得造成 Local Progress 丢失。

---

# 6. Question Bank

## 6.1 基本原则

题库属于系统长期资产。

增加新题原则上只修改：

```text
content/
```

不得修改 Quiz Engine。

---

## 6.2 内容结构

建议：

```text
content/
├── manifest.json
│
├── science/
│   ├── force-motion/
│   │   ├── questions.json
│   │   └── images/
│   │
│   ├── light/
│   │   ├── questions.json
│   │   └── images/
│   │
│   ├── electricity/
│   │   ├── questions.json
│   │   └── images/
│   │
│   └── experiment/
│       ├── questions.json
│       └── images/
```

---

# 7. Manifest

系统通过 `manifest.json` 发现主题。

禁止运行时扫描文件目录。

示例：

```json
{
  "version": 1,
  "topics": [
    {
      "id": "force-motion",
      "title": "力与运动",
      "icon": "🚀",
      "description": "认识力、运动、摩擦和平衡",
      "file": "./science/force-motion/questions.json"
    },
    {
      "id": "light",
      "title": "光",
      "icon": "🌈",
      "description": "认识光的传播、反射和折射",
      "file": "./science/light/questions.json"
    }
  ]
}
```

增加新主题只需要：

```text
新增 Topic 文件
+
更新 manifest
```

---

# 8. Question Schema

MVP Question Primitive：

```json
{
  "id": "force-001",
  "topic": "force-motion",
  "type": "single-choice",
  "question": "小明推动桌子，但桌子没有移动。哪种说法正确？",
  "image": null,
  "options": [
    {
      "id": "a",
      "text": "桌子没有受到力"
    },
    {
      "id": "b",
      "text": "桌子受到推力，同时受到其他力"
    },
    {
      "id": "c",
      "text": "小明没有施力"
    }
  ],
  "answer": ["b"],
  "explanation": "桌子受到推力，同时也可能受到摩擦力。",
  "difficulty": 2,
  "tags": [
    "force",
    "friction"
  ],
  "source": null
}
```

核心字段：

```text
id
topic
type
question
image
options
answer
explanation
difficulty
tags
source
```

---

# 9. 题库校验

必须建立：

```text
question.schema.json
```

每次 Pull Request 或 Push 时自动执行题库校验。

Pipeline：

```text
Question Bank
↓
Schema Validation
↓
Duplicate ID Check
↓
Answer Validation
↓
Asset Validation
↓
Build
↓
Deploy
```

必须检测：

* Question ID 重复
* 缺少题干
* 缺少答案
* answer 指向不存在的 option
* Topic 不存在
* 图片文件不存在
* type 不合法
* explanation 缺失
* malformed JSON

题库错误时禁止部署。

---

# 10. Quiz Runtime

Quiz Engine 只负责确定性运行逻辑。

核心接口：

```text
loadTopic()
loadQuestions()
shuffleQuestions()
startSession()
submitAnswer()
checkAnswer()
nextQuestion()
finishSession()
```

Quiz Engine 不负责：

* GitHub API
* UI 样式
* 主题内容
* 用户身份
* AI 推理

---

# 11. 核心状态模型

系统定义五个主要概念：

```text
Topic
Question
Quiz Session
Local Progress
Sync Snapshot
```

关系：

```text
Topic
  ↓
Question Bank
  ↓
Quiz Session
  ↓
Local Progress
  ↓
Sync Snapshot
  ↓
GitHub
```

### Topic

内容组织单位。

### Question

最小题目原语。

### Quiz Session

一次练习中的临时运行状态。

包括：

* 当前题号
* 当前答案
* 当前得分
* 本次题目列表

Session 完成后可以销毁。

### Local Progress

长期学习状态。

始终优先写入浏览器。

### Sync Snapshot

Local Progress 的外部持久化快照。

GitHub 故障不得影响 Quiz Session 或 Local Progress。

---

# 12. 信息架构

MVP 页面控制在五个以内：

```text
Home
↓
Topic
↓
Quiz
↓
Result

Home
↓
Wrong Questions
```

不需要复杂 SPA Router。

第一版可以直接通过应用状态切换页面。

若未来需要 URL Navigation，可以引入 Hash Router。

---

# 13. Home

首页回答一个问题：

> 今天想挑战什么？

显示 Topic Card。

示例：

```text
🚀
力与运动

已掌握 18 / 32

开始挑战
```

同时显示：

```text
我的错题
8
```

---

# 14. Quiz 页面

布局优先保证儿童阅读。

示例：

```text
3 / 10

小明骑自行车刹车后，
自行车逐渐停下来。

主要是什么力造成的？

┌──────────────────┐
│ A  重力           │
└──────────────────┘

┌──────────────────┐
│ B  摩擦力         │
└──────────────────┘

┌──────────────────┐
│ C  浮力           │
└──────────────────┘
```

答案提交后立即给反馈。

正确：

```text
✓ 答对了

摩擦力会阻碍物体之间的相对运动。

下一题
```

错误：

```text
再想一想

提示：
想想是什么让运动中的自行车慢下来。

重新选择
```

具体错误反馈策略可以在真实题库确定后继续细化。

---

# 15. Result

完成一次练习后显示：

```text
完成！

8 / 10

答对 8 题
答错 2 题

查看错题

再练一次

返回主题
```

儿童端避免显示复杂统计图。

---

# 16. 儿童体验原则

面向约 10 岁用户，UI 遵循以下约束。

### 阅读

* 大字号
* 短行宽
* 清晰层级
* 避免信息密集

### 操作

* 大点击区域
* 一个页面一个主要任务
* 控件数量少
* 避免复杂菜单

### 反馈

* 即时
* 明确
* 简短
* 鼓励继续思考

### 视觉

保持：

```text
friendly
clear
calm
playful
```

避免：

```text
过度游戏化
大量动画
高刺激色彩
复杂排行榜
连续弹窗
```

---

# 17. 技术方案

MVP：

```text
Vue 3
TypeScript
Vite
JSON Question Bank
JSON Schema
localStorage
GitHub Actions
GitHub Pages
Cloudflare Worker
GitHub API
```

暂不引入：

```text
Pinia
Tailwind
Firebase
Supabase
数据库
用户账号系统
AI Runtime
复杂 Backend
```

---

# 18. GitHub Pages 部署

Repository：

```text
GitHub
↓
GitHub Actions
↓
Validate
↓
Test
↓
Build
↓
GitHub Pages
```

`main` 为 Production Branch。

所有内容更新经过校验后自动部署。

---

# 19. Repository Structure

建议：

```text
/
├── src/
│   ├── components/
│   ├── views/
│   ├── engine/
│   ├── progress/
│   ├── sync/
│   ├── types/
│   └── App.vue
│
├── content/
│   ├── manifest.json
│   └── science/
│
├── schemas/
│   └── question.schema.json
│
├── scripts/
│   └── validate-content.ts
│
├── worker/
│   └── github-sync/
│
├── public/
│
├── tests/
│
└── .github/
    └── workflows/
```

---

# 20. 非功能需求

### Performance

首屏应快速加载。

Topic 切换不依赖远程 API。

### Reliability

刷新页面不丢学习记录。

GitHub Sync Failure 不影响本地数据。

### Security

GitHub Token 不允许出现在：

```text
Repository frontend
JavaScript bundle
localStorage
Browser Network Config
```

Token 仅存在于 Worker Secret。

### Privacy

默认不采集：

* 姓名
* 邮箱
* 地址
* 学校
* 年龄
* 设备身份

Profile 使用匿名随机 ID。

### Accessibility

至少满足：

* Keyboard navigation
* 明确 focus state
* 合理 contrast
* 图片支持 alt text
* 不依赖颜色表达正确与错误

---

# 21. MVP 明确排除

第一版不做：

* 用户账号
* 用户登录
* 多用户后台
* 教师后台
* 排行榜
* 社交功能
* 在线 PK
* AI 自动判题
* AI Tutor
* AI 生成题
* 云数据库
* 跨设备实时同步
* 完整 SRS
* 复杂积分系统
* 商城
* 广告
* CMS
* 实时多人功能

这些能力出现真实需求后再评估。

---

# 22. 后续演进

## Phase 2

可能增加：

* PWA
* 离线安装
* IndexedDB
* 从 GitHub 恢复 Progress
* 图片题
* 错题掌握状态
* 简单成就
* 主题推荐

## Phase 3

根据真实需求评估：

* Short Answer
* SRS
* 多设备同步
* Teacher Mode
* Learning Analytics

AI 相关能力单独评估，不进入核心 Quiz Runtime。

---

# 23. MVP 验收标准

### Content

新增一个主题时：

1. 新建题库文件
2. 更新 Manifest
3. 不修改 Quiz Engine
4. 系统自动显示新主题

### Quiz

用户可以：

1. 选择主题
2. 开始练习
3. 完成单选题
4. 完成多选题
5. 完成判断题
6. 获得即时反馈
7. 查看解析
8. 完成 Quiz
9. 查看结果

### Local Progress

用户：

1. 答错一道题
2. 关闭页面
3. 再次访问网站
4. 错题仍然存在

### Wrong Questions

用户能够进入：

```text
我的错题
```

并单独练习已记录错题。

### GitHub Sync

用户点击：

```text
同步错题到 GitHub
```

后：

1. Worker 收到请求
2. 验证数据
3. 更新对应 profile
4. GitHub 中生成或更新：

```text
progress/<profile-id>/wrong-questions.json
```

5. 前端显示同步成功

网络失败时：

```text
Local Progress
```

保持完整。

### CI

不合法 Question Data 必须使 CI Failure。

合法内容成功 Build 后自动部署 GitHub Pages。

---

# 24. Architecture Thesis

题库是长期内容资产。

Topic 是内容组织接口。

Question 是最小内容原语。

Quiz Session 是短期运行状态。

Local Progress 是学习者长期状态。

Quiz Engine 只负责抽题、判题、计分和状态转换。

所有学习记录首先在本地确定性保存。

GitHub 作为可选的版本化持久层。

新增主题和题目应主要发生在 Content Layer。

网络、同步服务或 GitHub 故障不得破坏核心答题流程。

整个系统保持：

```text
Content
+
Deterministic Runtime
+
Local State
+
Optional Sync
```

这是 MVP 的最高架构约束。