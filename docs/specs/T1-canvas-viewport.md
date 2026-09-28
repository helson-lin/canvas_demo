# T1 Canvas Viewport — 平移、锚定缩放、拖动、选择

- 分支：`feat/t1-viewport` · 依赖：T0 · 评分权重最高（30%）

## 拥有的文件
`src/canvas/Canvas.tsx`、`src/canvas/usePanZoom.ts`、`src/canvas/useNodeDrag.ts`（新建）、`src/nodes/NodeFrame.tsx`、`src/canvas/__tests__/coords.test.ts`、`src/canvas/Background.tsx`（可选点阵网格）

## 需求
1. world 容器 `transform: translate(vp.x px, vp.y px) scale(vp.zoom)`，`transform-origin: 0 0`；节点按世界坐标绝对定位。
2. 平移：空白处左键拖动、中键拖动、Space+左键（光标 grab/grabbing）；触控板双指滚动平移（`wheel` 无 ctrlKey）。
3. 缩放：`ctrl/meta+wheel` 与触控板 pinch（`ctrlKey` 为 true）→ `zoomAt(vp, 鼠标相对容器坐标, factor)`；范围 0.1–4；`factor = exp(-deltaY * 0.01)`。wheel 监听需 `{ passive: false }`。
4. 节点拖动（NodeFrame 标题栏/空白区）：pointerdown 记录起点屏幕坐标与节点起始世界坐标，move 时 `pos = start + (now - startScreen)/zoom`；`setPointerCapture`；rAF 合并写 store；位移 < 3px 视为点击（选中）。
5. 节点内部交互控件（input/textarea/button/select）不触发拖动：NodeFrame 检查 `event.target.closest('[data-no-drag], input, textarea, button, select')`。
6. 选择：点击节点选中（高亮描边）；Shift 点击加选；点击空白取消选择；`Delete/Backspace`（焦点不在输入框时）调用 `removeNodes`/`removeEdges`。
7. 右下角显示缩放百分比 + 「适配全部」按钮（beUI Button），适配 = 计算节点包围盒居中。
8. 视口变化写 `setViewport`（store 负责，保存节流由 T5 处理）。

## 验收
- `coords.test.ts`：往返一致性；`zoomAt` 后锚点处世界坐标不变（多组 zoom/点）；clamp 边界。
- 手测：缩放到 0.3 与 3.0 下拖动节点，节点跟手不漂移；在不同鼠标位置缩放，鼠标下内容不动；平移缩放后连线（T3）与节点相对位置稳定。
- 保存的 position 永远是世界坐标（在 handoff 中贴一次 store 快照证明）。
