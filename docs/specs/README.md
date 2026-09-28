# 子任务拆解总览

依据：[需求.md](../../需求.md)、[ARCHITECTURE.md](../../ARCHITECTURE.md)。纯前端 Mock，无后端。

## 依赖图与分支

```
T0 foundation (阻塞，先合入 main)
 ├─ T1 canvas-viewport   feat/t1-viewport
 ├─ T2 node-ui           feat/t2-node-ui
 ├─ T3 edges             feat/t3-edges
 ├─ T4 task-engine       feat/t4-task-engine
 └─ T5 persistence       feat/t5-persistence
T6 integration + README (T1–T5 合入后)  feat/t6-integration
```

| ID | 分支 | 规格 | 依赖 | 可并行 |
| --- | --- | --- | --- | --- |
| T0 | `feat/t0-foundation` | [T0](T0-foundation.md) | — | 否（先做） |
| T1 | `feat/t1-viewport` | [T1](T1-canvas-viewport.md) | T0 | 是 |
| T2 | `feat/t2-node-ui` | [T2](T2-node-ui.md) | T0 | 是 |
| T3 | `feat/t3-edges` | [T3](T3-edges.md) | T0 | 是 |
| T4 | `feat/t4-task-engine` | [T4](T4-task-engine.md) | T0 | 是 |
| T5 | `feat/t5-persistence` | [T5](T5-persistence.md) | T0 | 是 |
| T6 | `feat/t6-integration` | [T6](T6-integration.md) | T1–T5 | 否 |

## 并行规则（所有子任务必须遵守）

1. **文件所有权**：每个规格列出“拥有的文件”。只能修改自己拥有的文件；需要改动共享文件（`src/model/types.ts`、`src/store/canvasStore.ts`、`src/App.tsx`）时，**不要直接改**，在 handoff 的「契约变更请求」中写明，由 reviewer 统一合入。
2. T0 已在共享文件中放好所有接口与桩（stub），子任务只需"填实现"。桩文件被标注 `// OWNER: Tn`，归该任务所有。
3. 从 `main`（含 T0）切分支；提交前 `git rebase main`。
4. 每个任务结束必须通过：`pnpm typecheck && pnpm test && pnpm build`。
5. 交付：推分支 + 按 [handoff 模板](../handoff/TEMPLATE.md) 写 `docs/handoff/Tn.md`（放在自己分支里）。
6. 不引入规格之外的新依赖；确需时写进 handoff 说明理由。
7. UI 控件一律用 beUI（`npx shadcn@latest add https://beui.dev/r/<slug>.json`），组件放 `src/components/ui/`。画布平移/缩放/拖动/连线不用任何组件库。

## 合并顺序（reviewer 执行）

T0 → T1 → T3 → T2 → T4 → T5 → T6。每次合并后在 main 上跑全量检查。

## Review 清单

见 [REVIEW.md](REVIEW.md)。
