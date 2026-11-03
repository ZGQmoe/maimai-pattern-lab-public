# maimai 配置练习工具 · Claude × Codex 交接

## 从哪里开始

- [公开仓库](https://github.com/ZGQmoe/maimai-pattern-lab-public) 是协作入口。先读 [AGENTS.md](AGENTS.md)、[需求基准](REQUIREMENTS.md)、[项目分工](PROJECT.md)，再读 [README.md](README.md) 运行项目。
- Claude（包括 Claude Code）和 Codex 都使用同一个 GitHub 仓库。Claude 的入口是 [CLAUDE.md](CLAUDE.md)，Codex 的入口是 [AGENTS.md](AGENTS.md)；两者都以 REQUIREMENTS.md 为准。
- 每项任务从最新 `main` 开独立分支，通过 PR 交接。接手已有改动时先看原 PR，避免重复修改；将 PR 链接、对应需求、测试结果和下一步留在 PR 里。没有写权限时仍可克隆和验证，推送前由所有者授权。
- 对话与线上站点由所有者在私有 Project 中管理。公开仓库不包含私有站点 ID、部署凭据、逐字聊天或谱面版权数据。公开源码不会自动发布到私有站点。

## 当前交付

无依赖静态网页。入口 `dist/index.html`，交互 `dist/app.js`，解析/片段识别/查询 `dist/core.js`，测试 `test.mjs`。打开页面后，导入合法样例或显式加载原创样例，选择配置、等级和策略，再检索。候选按局部负荷递增；选参考片段才可比较结构相似与负荷。海底谭 / Slide–Tap 交织、多重 Slide 是明确的未实现入口。没有实际曲目数据库。

## 运行与验收

1. 使用 Node 18+ 执行 `node --test test.mjs`。
2. 用 `python3 -m http.server 8080 -d dist`，在浏览器打开 `http://localhost:8080`。
3. 验证“交互”不返回纵连；选参考片段后验证局部递进；未实现配置和无 14 数据时应显示正确状态。导入文件不得发送到远程。
4. PR 写明对应需求 R 与验收 A 条目、测试结果和未支持边界。GitHub 的代码变更与 Sites 的发布状态分别确认。

## 可直接交给 Claude 或 Codex 的下一项任务

> 先完整阅读 REQUIREMENTS.md 和 PROJECT.md。仅针对 R01–R04：用自制或经授权的最小 Simai 样例，验证现有解析与基础配置边界，记录成功、漏检和误报，补最小回归测试。重点保留“相同普通 Tap 背景、不同目标片段不应互荐”反例。保持黑白原生框架；不做视觉设计、不接商业谱库、不加账号、ML 或手法搜索。提交可复现证据和小 PR。

Chat 继续记录玩法与术语；Work 整理合法样本和评估表。下一轮可让 Claude 审查解析边界并整理可复现反例，再由 Codex 实现和验证；也可交换角色。新产品决策写回需求基准，不假设两个助手能互读聊天。私有站点由有权限的执行环境另行发布。
