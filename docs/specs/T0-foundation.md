# T0 Foundation — 脚手架与契约

- 分支：`feat/t0-foundation`（阻塞任务，合入 main 后其余任务才能开始）
- 目标：可运行的空壳 + **所有共享类型、store 动作签名、服务接口、各任务的桩文件**，让 T1–T5 可互不冲突地并行。

## 范围
1. Vite + React 18 + TS（strict）+ Tailwind v4 + pnpm；脚本：`dev`、`build`、`typecheck`(`tsc -b --noEmit`)、`test`(vitest run)。
2. `npx shadcn@latest init` 配置别名 `@/`；预装 beUI：`button`、`input`、`tabs`、`switch`、`animated-badge`、`loader`、`animated-toast-stack`、`tooltip`、`dock`、`drawer`、`context-menu`（slug 以 https://beui.dev/r 为准）。
3. 依赖：`zustand`、`immer`、`nanoid`、`idb-keyval`、`vitest`、`@testing-library/react`、`fake-indexeddb`（测试用）。
4. `public/samples/` 放 3 张示例图（1:1、16:9、9:16，可用生成的纯色+文字 PNG/SVG），`src/model/samples.ts` 导出清单。
5. 共享契约（完整实现，非桩）：
   - `src/model/types.ts`：照抄 ARCHITECTURE.md §3 全部类型，含 `pendingTaskId`、`Edge.kind`、`cancelled`、任务时间字段、`SCHEMA_VERSION = 1`。
   - `src/model/ids.ts`：`newId(prefix: 'node'|'edge'|'asset'|'task')`。
   - `src/canvas/coords.ts`：`screenToWorld`、`worldToScreen`、`zoomAt`、`clampZoom`（纯函数，T1 负责补单测，T3 复用）。
   - `src/store/canvasStore.ts`：Zustand + immer。state = `{ doc: CanvasDocument; ui: { selection: {nodeIds: string[]; edgeIds: string[]}; hydrated: boolean } }`。动作（全部实现，逻辑简单）：
     `addNode(type, worldPos) → id`、`updateNodeData(id, patch)`、`moveNode(id, pos)`、`removeNodes(ids)`（**级联删除相关边**；若是 generator/占位节点则把其 queued/running 任务置 `cancelled`）、`addEdge(source,target,kind?) → id|null`（内部调用 `canConnect`）、`removeEdges(ids)`、`setViewport(vp)`、`select(sel)`、`clearSelection()`、`replaceDoc(doc)`、`upsertAsset(asset)`、`upsertTask(task)`、`patchTask(id, patch)`。
   - `src/store/selectors.ts`：`selectGeneratorInputs(doc, genId) → { images: Asset[]; prompts: string[] }`、`selectActiveTask(doc, genId)`、`selectImageNodeView(doc, nodeId)`（§7.1 派生状态）。
   - `src/services/taskService.ts`：`TaskService` 接口（`submit/get/cancel/resume`）与 DTO 类型。
   - `src/persistence/api.ts`：`PersistenceAdapter` 接口（`load/saveNow/scheduleSave/putBlob/getBlob/deleteBlob`）。
6. 桩文件（导出签名 + `throw new Error('TODO Tn')` 或最小占位 UI，文件头注明 `// OWNER: Tn`）：
   - T1：`src/canvas/Canvas.tsx`（先渲染 world 容器 + 按 doc.nodes 绝对定位 NodeFrame）、`src/canvas/usePanZoom.ts`、`src/nodes/NodeFrame.tsx`（props：`node`, `children`, 把手插槽 `handles?`）
   - T2：`src/nodes/ImageNode.tsx`、`PromptNode.tsx`、`GeneratorNode.tsx`、`src/nodes/registry.tsx`（type → 组件）、`src/ui/Toolbar.tsx`
   - T3：`src/model/graph.ts`（`canConnect` 先返回 target 为 generator 的简单实现）、`src/canvas/EdgeLayer.tsx`、`src/canvas/Handle.tsx`、`src/canvas/useConnect.ts`
   - T4：`src/services/mockTaskService.ts`、`src/services/taskRunner.ts`（`startGeneration(genId)`、`retryTask(taskId)`、`cancelTask(taskId)`、`resumeTasks()`）、`src/services/mockConfig.ts`、`src/ui/DevPanel.tsx`
   - T5：`src/persistence/db.ts`、`src/persistence/persist.ts`（`initPersistence(): Promise<void>`）、`src/persistence/migrations.ts`、`src/services/assetStore.ts`（`useAssetUrl(assetId)`）
7. `src/App.tsx`：布局 = Toolbar + Canvas + DevPanel + Toaster，启动时 `await initPersistence()` 后设 `hydrated`（桩下直接 resolve）。

## 验收
- `pnpm dev` 打开空画布无报错；`pnpm typecheck && pnpm test && pnpm build` 通过。
- store 单测：`removeNodes` 级联删边、取消任务；`addEdge` 拒绝自环/重复。
- 所有桩文件存在且标注 OWNER。

## 不做
任何交互、样式细节、持久化实现。
