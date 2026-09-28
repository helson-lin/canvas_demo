# AGENTS.md — 协作约束

本仓库是 AI 创作无限画布面试题（需求见 [需求.md](需求.md)，设计见 [ARCHITECTURE.md](ARCHITECTURE.md)，子任务见 [docs/specs/](docs/specs/README.md)）。
所有编码代理与人工开发都必须遵守本文件。与规格冲突时以本文件为准，并在 handoff 中指出冲突。

## 1. 技术栈与命令
- 单包项目：Vite 8 + React 19 + TypeScript（strict）+ Tailwind v4 + Zustand（immer）+ idb-keyval + Vitest。包管理器 **pnpm**。
- 命令：
  - `pnpm dev` 启动开发服务器
  - `pnpm typecheck` / `pnpm test` / `pnpm lint` / `pnpm build`
- **提交前必须全部通过**：`pnpm typecheck && pnpm test && pnpm lint && pnpm build`。

## 2. 目录与分层（依赖只能自上而下）

```
src/
  domain/       纯 TS 领域层：types、ids、graph、selectors、migrations、taskApi(DTO+TaskService 接口)、samples
  store/        Zustand store（唯一可变状态源）
  services/     TaskService 的 Mock 实现、taskRunner、assetStore
  persistence/  IndexedDB 读写、保存策略、启动恢复
  canvas/       视口、坐标换算、平移缩放、拖动、连线、边渲染
  nodes/        三种节点组件 + NodeFrame + registry
  ui/           工具栏、DevPanel、Toaster、SaveIndicator 等外围 UI
  components/motion/  beUI 源码（第三方拷贝，见 §5）
  lib/          工具函数（cn、ease 等，beUI 依赖）
```

- **`src/domain` 必须保持纯净**：禁止 import React、DOM/浏览器 API（window、document、indexedDB、fetch）、zustand、immer、idb-keyval、motion，以及任何 `@/` 下非 domain 的模块。它将来会原样移到后端共享包。`src/domain/__tests__/domain-purity.test.ts` 会强制检查。
- 组件只通过 store 的 actions / domain selectors 读写数据，**不得**在组件里拼装跨实体的写操作（多实体原子更新用 `transact`，放在 services 中）。
- services 与 persistence 不得 import 组件；向用户提示用 `@/ui/toast` 的 `toast()`。
- 导入统一使用别名 `@/`。

## 3. 数据不变量（review 硬性检查）
1. 节点 `position` 永远是**世界坐标**；屏幕坐标只在事件处理中出现，经 `@/canvas/coords` 换算。
2. 节点、边、资产、任务都用 `newId(prefix)` 生成的稳定 ID；节点不得写死在渲染逻辑中。
3. 删除节点必须级联删除相关边（`removeNodes` 已实现），不得留下悬空边。
4. 生成结果永远**新建 Asset**，不得修改原始图片节点或原资产。
5. 图片节点的生成状态**由任务派生**（`selectImageNodeView`），节点上不存 status 字段。
6. 任务状态转换、节点增删必须调用 `persistence.saveNow()`；只有拖动/视口/文本编辑走 `scheduleSave()`。
7. Blob 必须先写入 IndexedDB，文档后引用；持久化中不得保存 `blob:`/objectURL。
8. 刷新后不得存在永久 `queued`/`running` 的任务（恢复或转 `interrupted`）。
9. 同一生成节点有 `queued/running` 任务时不得再次提交，且要有提示。
10. 失败必须可控（`#fail` 提示词、DevPanel 开关），**禁止使用随机数决定成败**。
11. **用户发起的**节点/连线修改前必须调用 `checkpoint()`（`@/store/history`，连续输入/微移用同一 key 合并）；任务系统的写入（提交、成功、失败）不记录历史，撤销也不会回滚任务、资产或结果节点。
12. 修改 `CanvasDocument` 结构必须递增 `SCHEMA_VERSION` 并在 `src/domain/migrations.ts` 添加迁移与测试。

## 4. 共享契约文件（只有 reviewer 可改）
`src/domain/types.ts`、`src/domain/taskApi.ts`、`src/domain/selectors.ts`、`src/store/canvasStore.ts`、`src/persistence/api.ts`、`src/App.tsx`、`package.json`、配置文件（vite/tsconfig/oxlint/components.json）。
需要改动时：**不要直接改**，在 `docs/handoff/Tn.md` 的「契约变更请求」中写明文件、改动和理由。

子任务的桩文件头部标注 `// OWNER: Tn`，只有对应任务可修改。每个任务拥有的文件以 `docs/specs/Tn-*.md` 为准。

## 5. UI 与 beUI
- UI 控件一律优先使用 beUI（https://beui.dev）。安装：`npx shadcn@latest add -y @beui/<name>`（名称见 https://beui.dev/registry.json），文件落在 `src/components/motion/`。
- 已安装：button-base、button-stateful、input、tabs、switch、animated-badge、loader、animated-toast-stack、tooltip、dock、drawer、context-menu（`src/components/motion/`），image-generation（`src/components/agents/`）。
- beUI 的 Tabs 指示器、AnimatedBadge 等使用 motion **layout 动画**：组件重渲染时页面位置变化会被动画化。节点内容必须保持 `memo(…, sameNodeContent)`，位置只由 NodeFrame 订阅，否则拖动时控件会“残留”在原位置。
- `src/components/motion/`、`src/components/agents/` 是第三方源码，**尽量不改**；必须改时在 handoff 中列出 diff 原因。lint 已忽略该目录。
- **画布平移、缩放、节点拖动、连线不使用任何组件库**，也不得用 motion 动画驱动节点 `position`。
- 节点内交互控件需标 `data-no-drag`（或为 input/textarea/button/select），避免触发节点拖动与画布平移。
- 新增 npm 依赖属于契约变更，需要在 handoff 中说明。

## 6. 测试要求
- 纯逻辑（domain、coords、store、taskRunner、persistence）必须有 Vitest 单测；异步任务使用 fake timers，禁止真实等待。
- IndexedDB 测试使用 `fake-indexeddb`（已在 `src/test/setup.ts` 全局加载）。
- 组件测试使用 `@testing-library/react`（jsdom）。
- 测试放在被测模块同级的 `__tests__/` 目录。

## 7. Git 与交付流程
- 分支：`feat/tN-<slug>`，从最新 `main` 切出；提交前 `git rebase main`。
- 提交信息：`<type>(<scope>): <摘要>`，type ∈ feat / fix / test / docs / refactor / chore。
- 不提交 `node_modules`、`dist`、密钥、个人配置。
- 完成后在分支中写 `docs/handoff/Tn.md`（模板 `docs/handoff/TEMPLATE.md`），包括验证命令输出与手测结果。**如实报告**未完成项和失败项。
- 合并由 reviewer 执行，review 清单见 `docs/specs/REVIEW.md`。

## 8. 代码风格
- TypeScript strict，禁止 `any`（确需时用 `unknown` 并收窄）；不留 `console.log`。
- 与周围代码保持一致：无分号、单引号、2 空格缩进；注释只写“为什么”。
- 用户可见文案使用中文。
