# C3 Status UI — 保存状态与缩放控件（Codex）

- 分支：`feat/c3-status-ui` · 依赖：main（T0）· 规模：小
- 拥有的文件：`src/ui/SaveIndicator.tsx`、`src/ui/ZoomControls.tsx`、`src/ui/__tests__/statusUi.test.tsx`、`src/canvas/fit.ts`（新建，纯函数）+ `src/canvas/__tests__/fit.test.ts`

## 需求
1. SaveIndicator（左下角）：`useSaveStatus()` → idle 不显示；saving「保存中…」；saved「已保存 HH:mm:ss」；error「保存失败：原因」（beUI `AnimatedBadge`）。
2. ZoomControls（右下角）：显示 `Math.round(zoom*100)%`；按钮「−」「+」（以视口中心为锚点调用 `zoomAt`，factor 1/1.2 与 1.2）、「100%」、「适配全部」。结果写 `setViewport`。
3. `fit.ts`：`fitBounds(nodes: CanvasNode[], container: {w,h}, padding = 80): Viewport` —— 计算所有节点包围盒（position + size），缩放到可容纳（clamp 到 `MIN_ZOOM..1`）并居中；无节点时返回 `{x:0,y:0,zoom:1}`。容器尺寸取 `window.innerWidth/innerHeight`。
4. 控件标 `data-no-drag`，阻止 pointerdown 冒泡到画布。

## 验收
- `fit.test.ts`：单节点居中、多节点包围盒、超大范围时 zoom 被 clamp、空数组。
- 组件测试：不同 save status 文案；点击 + 后 zoom 为 1.2。
- 四项检查通过；写 `docs/handoff/C3.md`。
