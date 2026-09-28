# T2 Node UI — 三种节点内容与工具栏

- 分支：`feat/t2-node-ui` · 依赖：T0

## 拥有的文件
`src/nodes/ImageNode.tsx`、`PromptNode.tsx`、`GeneratorNode.tsx`、`src/nodes/registry.tsx`、`src/ui/Toolbar.tsx`、`src/ui/NodeStatus.tsx`（新建）、`src/components/motion/*`（新增 beUI 组件）

## 需求
1. Toolbar（beUI Dock + Tooltip）：新建 图片 / 提示词 / 生成 节点，放在**当前视口中心的世界坐标**（用 `screenToWorld`），多次新建错开 24px；「载入示例」按钮生成带 `示例` 标签的一组节点（不自动运行生成）。
2. ImageNode：
   - 根据 `selectImageNodeView` 渲染：`ready` 显示图片（`useAssetUrl`，T5 提供；T0 桩可先返回 sample URL）；`queued/running` 显示 beUI Loader + Animated Badge；`failed/interrupted` 显示错误原因 + 重试按钮（调用 `retryTask`）；`missing` 显示“图片缺失”占位。
   - 空图片节点：可从示例图列表选择，或本地上传（`<input type=file accept=image/*>` → 调 `assetStore.importFile(file)` 返回 assetId，T5 实现；T2 仅调用）。
3. PromptNode：textarea（套 beUI Input 样式，`data-no-drag`），输入即写 `updateNodeData`；显示字数。
4. GeneratorNode：
   - 输入区：缩略图列出当前引用的图片、引用的提示词（截断 2 行），数据来自 `selectGeneratorInputs`，实时反映连线变化。
   - 参数：比例 `1:1 | 16:9 | 9:16`（beUI Tabs segment）。
   - 生成按钮（StatefulButton）：idle/queued/running/succeeded/failed 五态；queued/running 时禁用，点击时 toast“任务进行中”；调用 `startGeneration(genId)`（T4）。
   - 最近一次任务状态 Badge + 失败原因 + 重试。
5. 所有节点头部显示类型图标、标题、短 ID（便于演示稳定 ID）。

## 验收
- 组件测试（testing-library）：GeneratorNode 在连两条边后显示 1 图 1 词；running 状态按钮禁用；ImageNode 各 view 状态渲染正确（用构造的 doc）。
- 不直接改 store 结构；只调用 T0 定义的 actions/selectors/T4 T5 暴露的函数。
