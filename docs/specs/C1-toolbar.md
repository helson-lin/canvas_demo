# C1 Toolbar — 新建节点与载入示例（Codex）

- 分支：`feat/c1-toolbar` · 依赖：main（T0）· 规模：小
- 拥有的文件：`src/ui/Toolbar.tsx`、`src/ui/__tests__/Toolbar.test.tsx`

## 需求
1. 顶部居中工具栏（beUI `Dock` + `Tooltip`，图标用 lucide-react）：新建「图片」「提示词」「生成」节点；「载入示例」。
2. 新节点位置 = 当前视口中心的**世界坐标**：`screenToWorld({ x: innerWidth/2, y: innerHeight/2 }, viewport)`，再减去节点尺寸一半（`DEFAULT_NODE_SIZE`）；连续新建时每次偏移 24px（模块内计数器，视口变化后重置）。
3. 新建后选中新节点（`select({ nodeIds: [id] })`），调用 `persistence.saveNow()`。
4. 「载入示例」：在视口中心附近创建一组 `sample: true` 的节点：1 个图片节点（使用 `SAMPLE_IMAGES[0]`，先 `upsertAsset({ kind: 'sample', src: { type: 'url', url } })`）、1 个提示词节点（文本「一只戴墨镜的柴犬，赛博朋克风」）、1 个生成节点，并用 `addEdge` 连好输入。**不自动运行生成**。完成后 toast「已载入示例数据」。
5. 只调用 store actions / domain，不修改共享文件。

## 验收
- 组件测试：点击三个按钮分别新增对应类型节点，位置为世界坐标（设置 viewport `{x:100,y:50,zoom:2}` 断言）；载入示例后有 3 节点 2 边且 `sample === true`。
- `pnpm typecheck && pnpm test && pnpm lint && pnpm build` 通过；写 `docs/handoff/C1.md`。
