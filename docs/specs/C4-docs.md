# C4 README 与 AI 使用记录（Codex，T1–T5 合入后执行）

- 分支：`feat/c4-docs` · 依赖：全部功能合入 · 规模：小
- 拥有的文件：`README.md`、`docs/AI_LOG.md`

## 需求
1. README（中文）：启动命令（`pnpm i && pnpm dev`）、功能清单、操作说明（平移/缩放/连线/删除/失败触发/重试）、关键技术取舍（自研画布、世界坐标、任务派生图片状态、立即保存+恢复策略、domain 纯层）、已验证场景（引用各 handoff 的验证项）、已知限制、主要依赖与 beUI 来源、AI 工具使用说明。
2. `docs/AI_LOG.md`：按时间线整理本仓库 git log 与 docs/handoff 中体现的关键决策（monorepo 取舍、beUI 安装源修正、占位节点方案等），格式：提问 → AI 建议 → 采用/修改 → 验证。
3. 所有描述必须与代码一致；不确定的功能请运行 `pnpm dev` 核实。
