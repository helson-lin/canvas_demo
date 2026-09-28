# T5 Persistence — IndexedDB、Blob 资产、迁移、刷新恢复

- 分支：`feat/t5-persistence` · 依赖：T0 · 必读 ARCHITECTURE.md §7、§7.1

## 拥有的文件
`src/persistence/db.ts`、`persist.ts`、`src/domain/migrations.ts`、`src/services/assetStore.ts`、`src/ui/SaveIndicator.tsx`（新建）、`src/persistence/__tests__/*.test.ts`

## 需求
1. `db.ts`：idb-keyval 自定义 store `canvas-demo`；key：`doc`、`blob:<key>`。
2. `persist.ts`（实现 `PersistenceAdapter` + `initPersistence`）：
   - 加载：读 doc → `migrate` → `repair`（用 `@/domain` 的 `findDanglingEdges` 删除悬空边）→ `replaceDoc` → 调用 `resumeTasks()`（T4）→ `hydrated = true`。
   - 保存：订阅 store；`scheduleSave` 300ms debounce（拖动/视口/文本）；`saveNow()` 立即写并返回 Promise（状态转换用）；`visibilitychange=hidden`、`pagehide` 时 `saveNow`。只保存 `doc`，不保存 `ui`。
   - 写入串行化（Promise 队列），避免旧快照覆盖新快照。
   - 写入失败 → toast + SaveIndicator 显示错误。
3. `src/domain/migrations.ts`：`migrations: Record<number, (doc) => doc>`、`migrate(raw)`：无 version 视为 0；逐级升级到 `SCHEMA_VERSION`；高于当前版本 → 抛出 `UnsupportedVersion`（UI 提示并以只读空画布启动，不覆盖存储）。附 v0→v1 示例迁移（如补 `Edge.kind='input'`）。
4. `assetStore.ts`：
   - `importFile(file) → assetId`：putBlob → upsertAsset(kind=upload, src blob)。
   - `persistRemote(url, originTaskId) → assetId`：fetch → Blob → putBlob → upsertAsset(kind=generated)，**先 Blob 后文档**。
   - `useAssetUrl(assetId)`：url 源直接返回；blob 源 `createObjectURL` 并内存缓存（引用计数，卸载时 revoke）；缺失返回 `null`（UI 显示缺失占位）。
   - `gcBlobs()`：保存后空闲时删除无 Asset 引用的 blob（资产本身按引用保留，不因删节点而删）。
5. SaveIndicator：已保存 / 保存中 / 保存失败（beUI Animated Badge）。

## 验收（vitest + fake-indexeddb）
- 保存→重载 round-trip：节点、位置、边、视口、资产、任务终态一致。
- 迁移：v0 文档升级正确；未来版本拒绝且不覆盖。
- 并发保存：快速多次 saveNow，最终存储为最后一次状态。
- 上传图片 blob 重载后 `useAssetUrl` 可取到。
- running 任务文档重载 → 调用 resumeTasks（mock 断言）。
