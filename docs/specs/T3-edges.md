# T3 Edges — 连接创建、渲染、删除

- 分支：`feat/t3-edges` · 依赖：T0

## 拥有的文件
`src/domain/graph.ts`、`src/domain/__tests__/graph.test.ts`、`src/canvas/EdgeLayer.tsx`、`src/canvas/Handle.tsx`、`src/canvas/useConnect.ts`

## 需求
1. `graph.ts`：
   - `canConnect(doc, source, target): { ok: true } | { ok: false; reason }` —— target 必须是 generator；source 必须是 image/prompt；拒绝自环、重复边、节点不存在；`kind: 'result'` 边只能由系统（T4）创建，不可被用户当输入。
   - `edgesOf(doc, nodeId)`、`inputsOf(doc, genId)`（按 kind='input' 过滤）。
   - `findDanglingEdges(doc)`：返回指向不存在节点的边（T5 加载时用于修复，T6 自测）。
2. Handle：image/prompt 节点右侧输出把手；generator 左侧输入把手；把手位置由节点世界坐标 + size 计算（不读 DOM），保证缩放下精准。
3. useConnect：从输出把手 pointerdown → 预览虚线（世界坐标，跟随鼠标 `screenToWorld`）→ 在 generator 节点或其把手上 pointerup 时 `addEdge`；非法时 toast 原因；Esc 取消。
4. EdgeLayer：位于 world 容器内的 SVG（`overflow: visible`），三次贝塞尔；`input` 实线、`result` 虚线；点击选中高亮，Delete 删除；hover 中点显示 × 按钮删除。线宽用 `vector-effect: non-scaling-stroke`。
5. 边渲染只依赖 doc，节点拖动时自动跟随。

## 验收
- `graph.test.ts` 覆盖所有 canConnect 分支、`findDanglingEdges`。
- 手测：图片、提示词各连到生成节点；结果图片节点再连到另一个生成节点；删除任一节点后无残留边（store 快照）。
