# T4 Task Engine — 异步 Mock 生成、失败、重试、恢复

- 分支：`feat/t4-task-engine` · 依赖：T0 · 必读 ARCHITECTURE.md §6、§7.1

## 拥有的文件
`src/services/mockTaskService.ts`、`src/services/taskRunner.ts`、`src/services/mockConfig.ts`、`src/ui/DevPanel.tsx`、`src/services/__tests__/*.test.ts`

## 需求
1. **MockTaskService**（实现 `TaskService`）：
   - 内部 Map；`submit` 以 `idempotencyKey` 去重（同 key 返回同 taskId）。
   - 时序：queued `QUEUE_MS=800` → running `RUN_MS=2500` → succeeded/failed；用 `setTimeout`，时长可由 mockConfig 覆盖（测试用 fake timers）。
   - `resume(taskSnapshot)`：根据 `queuedAt/startedAt/expectedDurationMs` 与当前时间计算剩余时长继续执行；已超期返回 `{ resumable: false }`。
   - 输出：按 params.aspectRatio 选 `public/samples` 中对应图，返回 URL。
   - 确定性失败：提示词含 `#fail` → `CONTENT_REJECTED`；mockConfig `failNext`（用一次后自动关闭）/`failAll` → `MOCK_FORCED_FAILURE`；无输入 → 提交前拒绝 `EMPTY_INPUT`（不创建任务）。
2. **taskRunner**：
   - `startGeneration(genId)`：若 `selectActiveTask` 为 queued/running → toast 并返回；构造 `inputSnapshot`（assetIds + prompts）、params；**在一个 store 动作中**创建 Task(queued) + 占位 ImageNode（generator 右侧 +40px，`pendingTaskId`）+ `result` 边 + `generator.data.activeTaskId`；随后调用 `persistence.saveNow()`（T5；未合入时为桩）；再 `service.submit`。
   - 轮询 `get()` 每 500ms，状态变化时 `patchTask` 并 `saveNow()`。
   - 成功：`assetStore.persistRemote(url, taskId)`（T5：fetch → Blob → putBlob，返回 assetId）**完成后**，一次动作内：写 Asset(generated, origin.taskId)、占位节点 `assetId`、清 `pendingTaskId`、task succeeded、`resultAssetId`；若占位节点已被删除或任务已 cancelled → 丢弃结果。
   - 失败：patch error，保留 inputSnapshot/params。
   - `retryTask(taskId)`：新 Task（attempt+1、新 idempotencyKey、同 inputSnapshot/params、同 resultNodeId），占位节点 `pendingTaskId` 指向新任务，旧任务保留。
   - `cancelTask(taskId)`：service.cancel + 状态 cancelled。
   - `resumeTasks()`：启动时由 T5 调用；对 queued/running 任务调用 `service.resume`，不可恢复者置 `interrupted`（错误“页面刷新导致任务中断”）。
   - 全局超时守卫：`expectedDurationMs × 3` 仍未终态 → failed `TIMEOUT`。
3. **DevPanel**（beUI Drawer + Switch）：`下一次失败`、`全部失败`、`队列/运行时长` 滑块、任务列表（id、generator、状态、attempt、错误）。

## 验收（vitest + fake timers，必须）
- 正常：queued → running → succeeded，结果节点拿到新 assetId，原图片节点 assetId 不变。
- 运行中再次 startGeneration → 不新建任务。
- `failNext` → failed，重试 → succeeded，参数与输入快照一致，占位节点复用。
- 删除占位节点后任务完成 → 不创建资产。
- resume：剩余时长内继续成功；超期 → interrupted。
