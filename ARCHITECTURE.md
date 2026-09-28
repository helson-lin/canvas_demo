# AI 创作无限画布 — 架构设计（纯前端 Mock 版）

> 范围：P0 全量 + 预留 P1 扩展点。无后端，Mock 任务服务运行在浏览器内，但接口按"未来可替换为 HTTP 服务"设计。

## 1. 技术选型

| 领域 | 选择 | 理由 |
| --- | --- | --- |
| 构建 | Vite + React 18 + TypeScript | 启动快，一条命令 `pnpm dev` |
| 状态 | Zustand（+ `immer` 中间件） | 单一 store、选择器订阅、易于持久化与测试 |
| UI 组件 | **beUI**（https://beui.dev，React + Tailwind CSS v4 + Motion，通过 shadcn CLI 拷贝源码到 `src/components/ui/`） | 用户指定；源码进仓库，可改可解释 |
| 画布 | **自研**（DOM 节点 + SVG 连线 + CSS transform） | 评分 30% 在坐标换算，自研能完整解释；避免 React Flow 把核心逻辑黑盒化 |
| 持久化 | IndexedDB（`idb-keyval`） | 文档 JSON + 上传图片 Blob 都能存；localStorage 5MB 不够放图片 |
| ID | `nanoid` | 稳定、可读前缀：`node_xxx` / `edge_xxx` / `asset_xxx` / `task_xxx` |
| 测试 | Vitest | 坐标换算、store reducer、任务状态机做单元测试 |

## 2. 分层

```
┌──────────────────────────── UI (React) ────────────────────────────┐
│ Toolbar │ Canvas(Viewport) │ NodeViews │ EdgeLayer │ Inspector/DevPanel │
└───────────────┬─────────────────────────────────────────┬──────────┘
                │ actions / selectors                     │
┌───────────────▼──────────── Domain Store (Zustand) ─────▼──────────┐
│ document: { version, viewport, nodes, edges, assets, tasks }       │
│ ui:       { selection, connecting, dragging }   (不持久化)          │
└───────┬──────────────────────────────┬─────────────────────────────┘
        │ subscribe (debounce 300ms)   │ submit / poll
┌───────▼──────────┐          ┌────────▼────────────────────────────┐
│ Persistence      │          │ TaskService (interface)             │
│ IndexedDB        │          │  └─ MockTaskService (setTimeout 状态机) │
│ + migrations     │          │ AssetStore (Blob in IndexedDB)       │
└──────────────────┘          └─────────────────────────────────────┘
```

原则：**渲染只读 store，所有变更走 action**；节点永不写死在 JSX 里。

## 3. 数据模型

```ts
// src/model/types.ts
export const SCHEMA_VERSION = 1;

type Vec2 = { x: number; y: number };           // 世界坐标

interface Viewport { x: number; y: number; zoom: number } // screen = world*zoom + (x,y)

type NodeType = 'image' | 'prompt' | 'generator';

interface BaseNode { id: string; type: NodeType; position: Vec2; size: { w: number; h: number }; createdAt: number }
interface ImageNode     extends BaseNode { type: 'image';     data: { assetId: string | null; pendingTaskId?: string } }
interface PromptNode    extends BaseNode { type: 'prompt';    data: { text: string } }
interface GeneratorNode extends BaseNode { type: 'generator'; data: { params: GenParams; activeTaskId: string | null } }
type CanvasNode = ImageNode | PromptNode | GeneratorNode;

interface GenParams { aspectRatio: '1:1' | '16:9' | '9:16'; seed?: number }

interface Edge { id: string; source: string; target: string; kind?: 'input' | 'result' }  // input: source → generator；result: generator → 结果节点（仅溯源）

interface Asset {
  id: string;
  kind: 'sample' | 'upload' | 'generated';
  src: { type: 'url'; url: string } | { type: 'blob'; blobKey: string }; // 可恢复引用，不存 objectURL
  width?: number; height?: number;
  origin?: { taskId: string };                   // generated 资产溯源
  createdAt: number;
}

type TaskStatus = 'queued' | 'running' | 'succeeded' | 'failed' | 'interrupted' | 'cancelled';

interface Task {
  id: string;
  generatorNodeId: string;
  inputSnapshot: { imageAssetIds: string[]; prompts: string[] }; // 提交时快照，失败重试复用
  params: GenParams;
  status: TaskStatus;
  error?: { code: string; message: string };
  resultAssetId?: string;
  resultNodeId?: string;
  attempt: number;
  queuedAt: number; startedAt?: number; expectedDurationMs: number; // 刷新后按剩余时长恢复
  idempotencyKey: string;                        // 为后端化预留
  createdAt: number; updatedAt: number;
}

interface CanvasDocument {
  version: number;          // = SCHEMA_VERSION
  viewport: Viewport;
  nodes: Record<string, CanvasNode>;
  edges: Record<string, Edge>;
  assets: Record<string, Asset>;
  tasks: Record<string, Task>;
}
```

### 关系与约束
- **节点 ↔ 资产**：ImageNode 只存 `assetId`，资产独立存储 → 生成结果不会覆盖原图（新建 Asset + 新建 ImageNode）。
- **连接合法性**（`canConnect`）：target 必须是 generator；source 为 image/prompt；禁止自环与重复边。结果图片节点天然是 image，可再连接到其他生成节点。
- **生成节点输入**：派生选择器 `selectGeneratorInputs(id)` 实时从 edges 计算，不冗余存储。
- **删除节点**：同一 action 内删除所有 `source===id || target===id` 的边；若删除的是 generator，其运行中任务标记为取消/忽略回调。资产不立即删（可能被其他节点引用），做引用计数式 GC（保存时清理无引用的 upload/generated Blob）。

## 4. 坐标系统（核心）

```ts
// src/canvas/coords.ts
screenToWorld(p, vp) = { x: (p.x - vp.x) / vp.zoom, y: (p.y - vp.y) / vp.zoom }
worldToScreen(p, vp) = { x: p.x * vp.zoom + vp.x, y: p.y * vp.zoom + vp.y }

// 鼠标锚定缩放：保证缩放前后鼠标下的世界点不变
zoomAt(vp, screenPt, factor) {
  const z = clamp(vp.zoom * factor, 0.1, 4);
  const w = screenToWorld(screenPt, vp);
  return { zoom: z, x: screenPt.x - w.x * z, y: screenPt.y - w.y * z };
}
```

- 渲染：一个 `world` 容器 `transform: translate(x,y) scale(zoom)`，节点用世界坐标绝对定位，连线 SVG 也在同一容器内 → 平移缩放时相对位置天然稳定。
- 节点拖动：记录 pointerdown 时的世界坐标起点，move 时 `delta = (screenNow - screenStart) / zoom`，写回世界坐标。
- 交互：滚轮/触控板捏合 = 缩放（`ctrlKey` 判别 pinch），Space+左键 或 中键 或 空白处左键拖动 = 平移；点击空白 = 取消选择；`Delete/Backspace` 删除选中节点/边。
- 屏幕坐标**只**用于事件处理，保存的一律是世界坐标。
- Pointer Events + `setPointerCapture`，拖动中用 rAF 合并更新。

## 5. 连线交互
- 节点右侧 1 个输出把手（image/prompt），generator 左侧 1 个输入把手。
- 从输出把手拖出 → 临时虚线跟随鼠标（世界坐标）→ 在 generator 上松开时 `canConnect` 校验并 `addEdge`。
- 边用三次贝塞尔 SVG path，可点击选中后删除（或 hover 显示 ×）。

## 6. 异步 Mock 任务

### 接口（与未来后端同构）
```ts
interface TaskService {
  submit(req: { idempotencyKey: string; generatorNodeId: string; inputs; params }): Promise<{ taskId: string }>;
  get(taskId: string): Promise<{ status: TaskStatus; error?; result?: { url: string } }>;
  cancel(taskId: string): Promise<void>;
}
```

### MockTaskService
- 内存 Map 保存任务；`submit` 后 `setTimeout` 驱动：`queued`(800ms) → `running`(2~3s) → `succeeded | failed`。
- 输出：从 `public/samples/` 按比例挑选固定示例图（允许），但每次都**新建 Asset + Task 记录**。
- **可控失败**（确定性，不靠随机）：
  1. 提示词包含 `#fail` → 失败 `CONTENT_REJECTED`；
  2. DevPanel 开关「下一次任务失败」/「全部失败」→ `MOCK_FORCED_FAILURE`；
  3. 无任何输入 → 提交前前端校验失败。
- 前端通过**轮询** `get()`（500ms）推进 store 中的 Task 状态，模拟真实后端模式（而非直接回调）。

### 状态机与防重
```
idle ──submit──▶ queued ──▶ running ──▶ succeeded ──(新建 Asset + ImageNode + 边? 可选)
                                   └──▶ failed ──retry──▶ queued (attempt+1，复用 inputSnapshot/params)
刷新时 queued/running ──▶ interrupted（可重试）
```
- 生成按钮在 `activeTask.status ∈ {queued, running}` 时禁用并显示"生成中…"，重复点击提示 toast。
- 成功：结果 ImageNode 放在 generator 右侧（世界坐标偏移），任务记录 `resultAssetId/resultNodeId`；原图片节点不变。
- 失败：卡片显示错误原因 + 「重试」；输入文本、参数原样保留。

### beUI 组件映射
| 场景 | beUI 组件 |
| --- | --- |
| 顶部工具栏（新建节点 / 载入示例 / 适配视图） | `Dock` + `Button` + `Tooltip` |
| 提示词编辑 | `Input`（多行时用 textarea 并套用 beUI tokens） |
| 生成参数（比例） | `Tabs`（segment）或 `Select` |
| 生成按钮（空闲 → 排队 → 生成中 → 成功/失败） | `StatefulButton` / `Action Swap` |
| 任务状态标签 | `Animated Badge` |
| 生成中占位 | `Loader`（reduced-motion 安全） |
| 错误/重复提交/保存提示 | `Animated Toast Stack` |
| Mock 失败开关 | `Switch`（放在 `Drawer` 形式的 DevPanel） |
| 节点右键菜单（删除/重试/复制） | `Animated Context Menu` |

约束：beUI 只用于节点内部与外围面板；**画布平移、缩放、拖动、连线不交给任何组件库**。节点内交互控件需 `onPointerDown` 阻止冒泡，避免触发节点拖动。Motion 动画不作用于节点 `position`（位置由 store 直接驱动，避免与拖动冲突）。

## 7. 持久化与恢复
- 存储键：`canvas:doc`（CanvasDocument JSON）、`asset:blob:<key>`（上传图片 Blob）。
- 写入：store 订阅 document 变更，300ms debounce 写 IndexedDB；UI 角标显示"已保存/保存中"（P1）。
- 加载流程：
  1. 读 doc → `migrate(doc)`：按 `version` 逐级执行 `migrations[v]`，未知高版本则只读提示；
  2. 执行 7.1 的任务恢复；
  3. Blob 资产在渲染时 `URL.createObjectURL`，缓存在内存 Map，不持久化 objectURL；缺失时显示占位图。
### 7.1 生成中刷新：结果图片节点的状态持久化

问题：如果结果图片节点只在成功时才创建，刷新时"生成中"的东西只存在于内存，页面上什么都不剩；如果只存任务、不存节点，又会出现"任务成功了但节点没落盘"或"节点有了但资产没落盘"的撕裂状态。

**方案：提交即落占位节点，状态以任务为唯一来源。**

1. **提交时**（一个 action，原子写入）：
   - 新建 `Task(status=queued)`，记录 `queuedAt`、`expectedDurationMs`；
   - 同时新建**结果占位节点** `ImageNode { data: { assetId: null, pendingTaskId: task.id } }`，放在 generator 右侧，并建边 `generator → 结果节点`（仅用于展示溯源，标记 `kind: 'result'`，不作为生成输入）；
   - `task.resultNodeId = 占位节点 id`；
   - **立即 flush 保存**（不走 300ms debounce）。
2. **图片节点渲染状态完全派生**：
   ```ts
   imageNodeView(node) =
     node.data.assetId            ? 'ready'
     : task?.status === 'queued'  ? 'queued'      // Loader + "排队中"
     : task?.status === 'running' ? 'running'     // Loader + 进度
     : task?.status === 'failed' || 'interrupted' ? 'failed'  // 错误原因 + 重试
     : 'missing'                                  // 占位图
   ```
   节点自身不存 status 字段，避免与任务状态不一致。
3. **成功时**（一个 action，一次 IndexedDB 事务）：先把结果图片写入 `asset:blob:<key>`（示例图也 fetch 成 Blob 固化，避免示例路径变化后丢图），再在同一次文档写入中：新建 `Asset(kind=generated)`、`node.data.assetId = asset.id`、清除 `pendingTaskId`、`task.status = succeeded`。顺序保证：**Blob 先落盘，文档后引用**，不会出现引用指向不存在的 Blob。
4. **关键状态转换一律立即 flush**：queued/running/succeeded/failed 变化、节点创建删除；只有拖动、视口变化走 debounce。另在 `visibilitychange(hidden)` 和 `pagehide` 时同步触发一次 flush。
5. **刷新后恢复**（选择"恢复执行"，超时则安全降级）：
   - `queued/running` 且 `now - queuedAt < expectedDurationMs + 宽限期(10s)`：把任务重新交给 MockTaskService 的 `resume(task)`，按剩余时长继续推进（Mock 是确定性的：同样的 inputSnapshot/params + 失败开关 → 同样结果），图片节点继续显示生成中；
   - 超过宽限期，或 Mock 无法恢复：`status = interrupted`，错误"页面刷新导致任务中断"，占位节点显示「重试」；
   - 任何情况下都**不会永久停留在"生成中"**：taskRunner 另有全局超时守卫（`expectedDurationMs × 3`）兜底转 failed(`TIMEOUT`)。
6. **重试**：复用原 `inputSnapshot`、`params` 与**同一个占位节点**（`attempt+1`，新 `idempotencyKey`，旧任务保留为历史），不会在画布上堆积多个失败节点。
7. **防重复**：generator 的 `activeTaskId` 指向 queued/running 任务时拒绝再次提交；刷新后该约束依旧有效（因为 `activeTaskId` 与任务状态都已持久化）。
8. **删除占位节点**：若其任务仍在进行，先标记任务 `cancelled`，runner 收到回调时发现节点不存在则丢弃结果、不创建资产。

验证用例（写入 README 自测清单）：
- 排队中刷新 → 继续排队并成功；
- 生成中刷新 → 继续生成并成功，结果节点位置与连线不变；
- 生成中关闭标签页 30s 后再打开 → 显示"中断，可重试"，点击重试成功；
- 成功后刷新 → 结果图片从 IndexedDB Blob 恢复，原图片节点未被覆盖；
- 打开「下一次失败」开关生成 → 失败 → 刷新 → 仍显示失败原因，关闭开关后重试成功。

- 初始状态：空画布；工具栏提供「载入示例」按钮，示例节点带 `示例` 标记。

## 8. 目录结构

```
src/
  model/        types.ts, ids.ts, migrations.ts, selectors.ts, graph.ts(canConnect/删除级联)
  store/        canvasStore.ts (document + actions), uiStore.ts
  canvas/       coords.ts, Canvas.tsx(viewport/事件), EdgeLayer.tsx, useDrag.ts, usePanZoom.ts
  nodes/        ImageNode.tsx, PromptNode.tsx, GeneratorNode.tsx, NodeFrame.tsx(选中/拖动/把手)
  services/     taskService.ts(接口), mockTaskService.ts, taskRunner.ts(轮询→store), assetStore.ts
  persistence/  db.ts, persist.ts(debounce 保存/加载/恢复)
  ui/           Toolbar.tsx, DevPanel.tsx(失败开关), Toast.tsx
  __tests__/    coords.test.ts, graph.test.ts, taskRunner.test.ts, migrations.test.ts
public/samples/ 示例图片
```

## 9. 实施顺序（约 95 分钟）

| 时间 | 内容 | 验收 |
| --- | --- | --- |
| 0–10 | 脚手架、types、store 骨架 | `pnpm dev` 可跑 |
| 10–35 | 坐标/平移/锚定缩放/节点拖动/选择删除 + coords 单测 | 验收 2 |
| 35–50 | 三种节点 UI、连线创建删除、级联删除 | 验收 1、3 |
| 50–70 | MockTaskService + taskRunner + 失败/重试/防重 | 验收 4 |
| 70–85 | IndexedDB 持久化、迁移、interrupted 恢复、上传 | 验收 5 |
| 85–95 | README、自测清单 | 验收 6 |

## 10. 后端化预案（追问准备）
- **接口**：`POST /tasks`（Header `Idempotency-Key`，body: generatorNodeId, inputs(assetIds, prompt), params）→ `202 {taskId}`；`GET /tasks/:id`；`POST /tasks/:id/cancel`；`POST /tasks/:id/retry`（新建 attempt，关联原任务）。
- **超时但服务端可能已接收**：客户端在提交前生成并持久化 `idempotencyKey`；超时后用同 key 重发，服务端唯一索引 `(user_id, idempotency_key)` 返回已存在任务；或 `GET /tasks?idempotencyKey=` 对账。刷新后对 `interrupted` 任务先查询再决定是否重试，而非直接降级。
- **资源与节点**：图片上传走对象存储（预签名 URL），`assets` 表存元数据与引用；画布文档只存 `assetId`。删除节点不删资产，资产按引用计数/定期 GC 删除（生成结果与任务记录关联，保留审计）。
- **文档保存**：画布文档带 `version`（schema）+ `revision`（乐观锁），冲突时 409。
