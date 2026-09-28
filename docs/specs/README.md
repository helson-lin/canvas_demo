# 子任务拆解总览

依据：[需求.md](../../需求.md)、[ARCHITECTURE.md](../../ARCHITECTURE.md)。纯前端 Mock，无后端。

## 依赖图与分支

主体模块由 Claude 子代理开发，小模块交给 Codex。

```
T0 foundation ✅ (已合入 main)
 ├─ T1 canvas-viewport   feat/t1-viewport      Claude
 ├─ T2 node-ui           feat/t2-node-ui       Claude
 ├─ T3 edges             feat/t3-edges         Claude
 ├─ T4 task-engine       feat/t4-task-engine   Claude
 ├─ T5 persistence       feat/t5-persistence   Claude
 ├─ C1 toolbar           feat/c1-toolbar       Codex ✅
 ├─ C2 devpanel          (main)                reviewer ✅
 └─ C3 status-ui         (main)                reviewer ✅
C4 README + AI 记录 (功能合入后)  feat/c4-docs   Codex
T6 集成验收 (reviewer)            feat/t6-integration
```

| ID | 规格 | 执行者 | 依赖 |
| --- | --- | --- | --- |
| T0 | [T0](T0-foundation.md) | reviewer | — ✅ |
| T1 ✅ | [T1](T1-canvas-viewport.md) | Claude | T0 |
| T2 ✅ | [T2](T2-node-ui.md) | Claude | T0 |
| T3 ✅ | [T3](T3-edges.md) | Claude | T0 |
| T4 ✅ | [T4](T4-task-engine.md) | Claude | T0 |
| T5 ✅ | [T5](T5-persistence.md) | Claude | T0 |
| C1 ✅ | [C1](C1-toolbar.md) | Codex | T0 |
| C2 ✅ | [C2](C2-devpanel.md) | reviewer | T0 |
| C3 ✅ | [C3](C3-status-ui.md) | reviewer | T0 |
| C4 | [C4](C4-docs.md) | Codex | 全部 |
| T6 | [T6](T6-integration.md) | reviewer | 全部 |

## 并行规则（所有子任务必须遵守，完整约束见 [AGENTS.md](../../AGENTS.md)）

1. **文件所有权**：每个规格列出“拥有的文件”。只能修改自己拥有的文件；需要改动共享文件（见 AGENTS.md §4 共享契约文件）时，**不要直接改**，在 handoff 的「契约变更请求」中写明，由 reviewer 统一合入。
2. T0 已在共享文件中放好所有接口与桩（stub），子任务只需"填实现"。桩文件被标注 `// OWNER: Tn`，归该任务所有。
3. 从 `main`（含 T0）切分支；提交前 `git rebase main`。
4. 每个任务结束必须通过：`pnpm typecheck && pnpm test && pnpm build`。
5. 交付：推分支 + 按 [handoff 模板](../handoff/TEMPLATE.md) 写 `docs/handoff/Tn.md`（放在自己分支里）。
6. 不引入规格之外的新依赖；确需时写进 handoff 说明理由。
7. UI 控件一律用 beUI（`npx shadcn@latest add -y @beui/<name>`），组件放 `src/components/motion/`。画布平移/缩放/拖动/连线不用任何组件库。

## 合并顺序（reviewer 执行）

T1 → T3 → T2 → T4 → T5 → C1/C2/C3（随到随合）→ C4 → T6。每次合并后在 main 上跑全量检查。

## Review 清单

见 [REVIEW.md](REVIEW.md)。
