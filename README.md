# Maikiri

名字来自 **maimai × raikiri**。raikiri 是用户最喜欢的谱面，Maikiri 寓意“将不会的配置斩断”。

开发前必读：[需求基准](REQUIREMENTS.md) → [项目分工](PROJECT.md)。首次接手见 [Claude × Codex 交接](HANDOFF.md)。历史想法见 [公开摘要](IDEAS-RECORD.md)。当前阶段优先搭建街机风格界面、配置分类和谱面资源入口。机器学习识别留待后续。

maimai DX 配置识别与渐进练习搜索 MVP。静态响应式网页，谱面在浏览器解析，不需要 API key、账号或服务器数据库。

## 运行和验证

Node 22+：`node --test test.mjs`。任意静态服务器指向 `dist/`（例如 `python3 -m http.server 8080 -d dist`）。部署可使用 Sites、GitHub Pages、Cloudflare Pages 或其他静态托管。

## AstroDX 谱面输入与识别

- [AstroDX 的 ADX 指南](https://wiki.astrodx.com/cn/install/android)说明 `.adx` 使用 ZIP 容器。可以从 [ADX 谱面资源](https://adxdls.saop.cc/) 查找包，或把有权使用的 Simai 谱面文件放进曲目目录再打包。该目录的站点代码、目录数据和实际谱面分别授权，详见[来源说明](https://github.com/AdingApkgg/adx-dl#许可与署名)。
- 导入在浏览器内完成，仅读取包中的 `maidata.txt`，跳过音源、封面、视频和合集清单。每包上限 100 MB、100 份谱面文本、100 张难度谱。常见 ZIP 压缩使用本地 vendored [zip.js 2.24.0](https://github.com/gildas-lormeau/zip.js/releases/tag/v2.24.0)，随附 BSD-3-Clause 许可。压缩包读取和 Simai 语法解析分开报告。
- `&title`、`&lv_n` 和 `&inote_n` 区分曲目、标注等级和难度谱。等级只作筛选。当前固定等级键为 12 到 14，其他等级通过「全部」浏览。
- `&first`、BPM、细分和时间格把每个 Note 映射到拍位与时间。Tap 键位序列可找同键重复或两键交替，同时押应按同一时间格处理。用旋转、镜像和相对节奏对齐比较结构，另算以秒为单位的速度和密度。
- Slide 起点、终点、路径符号、等待与时值可构造活动区间。若区间内穿插 Tap，可形成 Slide–Tap 交织候选。重叠的 Slide 区间可形成多重 Slide 候选。这两个方向仍需用样本确定规则边界，文件也不提供真实手法或玩家成绩。[Simai Slide 规范](https://w.atwiki.jp/simai/pages/23.html)
- 用 [chika3742 的 Synthesis. 自制谱](https://github.com/chika3742/majdata-charts/tree/main/synthesis)复核了曲名、等级和谱面字段。当前基础解析在第一格的链式 Slide 报错。ADX 封包兼容与谱面语法兼容分别验收。

## 已实现

- maidata 多 inote、lv、title、first 字段或受限单谱 Simai；支持筛选 12/12+/13/13+/14，原创样例仅覆盖 12–13+，等级只用于演示。
- BPM、细分、Tap/Break/EX、Hold/Touch、单段基础 Slide，Note 时间与位置。
- 连续单点纵连、两位置交互、基础 Slide；8 个旋转及镜像规范化。
- 按配置、等级检索片段；选择参考后可按局部负荷策略筛选，同类片段按负荷递增。
- 解释密度、持续、干扰、前后上下文；练习库 JSON 导入导出；不上传谱面。

## 明确限制

解析器为受限自实现，未宣称完整兼容 Simai。研究了 MIT 的 simai-sharp-ts（https://github.com/Shikochin/simai-sharp-ts），当前未复制或依赖其代码。lcebot/maidata-parser 是专有许可，未采用。后续以真实合法测试集评估再接入成熟解析器。

不支持连 Slide、V 双顶点、星号分支、伪 EACH、复杂 BPM 时值、部分装饰符；遇到未知 token 拒绝整谱。基础 Slide 仅保存几何类型、起终点、等待和持续，不做判定轨迹。没有完整手法推断，旋转镜像对 Slide 只作模式近似；尤其顶部/底部曲线规则不能当作精确几何等价证明。

纵连与交互仅识别连续单 Tap。同时押会打断识别，含同时押的变体可能漏检。负荷无玩家实测校准，不能输出水歌/诈称结论。结构相似度为规范化 token 匹配，非学习模型；速度独立于身份，但时值比例的细微差别会量化。推荐仅针对当前导入库，不包含商业谱库和音源，不保证整曲可打。

扫描上限 500KB/文件、15000 Note/谱；上下文扫描为 O(片段×Note)。请先使用小规模库，性能达到瓶颈再做区间索引。

## 版权与隐私

附带样例是本项目原创合成练习，无商业曲目数据。仅导入你有权使用的谱面。默认不联网传输谱面；导出文件包含导入原文，请自行保管。静态网站跨设备可访问；练习库在当前浏览器自动保存，可通过导出/导入跨设备转移。清除浏览器网站数据会删除本机练习库，请保留导出备份。

## 项目组织

见 PROJECT.md。源码、测试、项目决策以本目录为准；对话历史由应用保留。
