# C2 DevPanel — Mock 失败开关与任务列表（Codex）

- 分支：`feat/c2-devpanel` · 依赖：main（T0）· 规模：小
- 拥有的文件：`src/ui/DevPanel.tsx`、`src/ui/__tests__/DevPanel.test.tsx`

## 需求
1. 右上角「Mock 控制台」按钮（beUI button-base）打开右侧 beUI `Drawer`。
2. 开关（beUI `Switch`）：「下一次任务失败」`failNext`、「所有任务失败」`failAll`；数字输入：排队时长 `queueMs`、生成时长 `runMs`（100–10000ms）。读写通过 `getMockConfig / setMockConfig / subscribeMockConfig`（`useSyncExternalStore` 订阅）。
3. 说明文字：「提示词包含 #fail 也会触发失败」。
4. 任务列表：从 `useCanvasStore(s => s.doc.tasks)` 按 `createdAt` 倒序展示 id 后 6 位、生成节点 id 后 6 位、状态（beUI `AnimatedBadge`）、attempt、错误信息。只读，不提供操作按钮。
5. 不修改 `mockConfig.ts`、store 或其他共享文件。

## 验收
- 组件测试：切换开关后 `getMockConfig()` 对应字段变化；构造 2 个任务后列表按时间倒序渲染且显示错误信息。
- 四项检查通过；写 `docs/handoff/C2.md`。
