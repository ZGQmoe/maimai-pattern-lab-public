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

## 开发、复核与夜间巡检

1. **开发（按需）**：Claude 或 Codex 从最新 main 开分支，每次处理一个有复现证据的问题。先补最小回归测试，再修复；跑完整测试并开小 PR。
2. **复核（PR 就绪后）**：由未写该改动的一方审查最新 PR 提交。检查需求范围、复现样例、误报漏报、测试和版权边界。给出可定位的发现；无阻塞时明确说明。作者修复后复核新提交，由所有者决定合并。
3. **夜间巡检（Claude Code Remote Routine，建议每天 22:00，Europe/London）**：从最新 main 运行 `node --test test.mjs`；如果有待审 PR，检查其最新提交和 CI，指出具体需要人工跟进的事项。用提交 SHA 和失败测试名去重。仅在新失败、新阻塞或已有问题恢复时输出简短报告；无变化保持安静。不改源码、不新开 PR、不合并、不部署。夜间发现转入下一轮按需开发。

在 [Claude Code Routines](https://claude.ai/code/routines) 选择 Remote，绑定本仓库，核对界面显示的时区和下次运行时间，保存后手动试跑一次。账号未连接 GitHub、没有 Remote 能力或需要授权时，报告缺哪一步；不将手动试跑称为已启用定时任务。见 [Claude 官方 Routines 说明](https://code.claude.com/docs/en/routines)。

## 可直接交给 Claude 或 Codex 的下一项任务

> 先完整阅读 REQUIREMENTS.md 和 PROJECT.md。当前优先检查 R08–R09：验证街机风格的配置分类、等级切换、手机布局及谱面资源的链接和许可说明。使用原创或经授权的谱面做验收。基础规则继续可用，机器学习识别留待后续。提交可复现证据和小 PR。

Chat 继续记录玩法与术语；Work 整理合法样本和评估表。下一轮可让 Claude 审查解析边界并整理可复现反例，再由 Codex 实现和验证；也可交换角色。新产品决策写回需求基准，不假设两个助手能互读聊天。私有站点由有权限的执行环境另行发布。
