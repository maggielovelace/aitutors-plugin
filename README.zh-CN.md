# AI Tutors —— ChatGPT 与 Codex plugin

[English](README.md) · **简体中文**

把 [aitutors.me](https://aitutors.me) 的导师装进 **ChatGPT** 或 **Codex**。

本仓库只放 plugin 清单文件——导师本身运行在 `https://aitutors.me/mcp`。
这里没有需要编译的东西，也没有要运行的代码。

---

## 这是什么

[![学在问中 —— Heddy 带你认识 aitutors.me](https://img.youtube.com/vi/dYcVJzJRccg/maxresdefault.jpg)](https://www.youtube.com/watch?v=dYcVJzJRccg)

*Heddy 用中文介绍 aitutors.me：导师怎么带孩子学，家长这边看到什么。*

---

## 安装

### ChatGPT（Work）或 ChatGPT 桌面版

1. 打开 **Plugins** → **Add plugin marketplace**
2. 在 **Source** 里粘贴本仓库地址：
   ```
   https://github.com/maggielovelace/aitutors-plugin
   ```
3. 添加 marketplace，然后 **Install** 安装 *AI Tutors*
4. 出现提示时，用您的 aitutors.me 账号登录

Plugins 只在网页版的 **ChatGPT Work** 和桌面版里可用，
在 Chat 标签页、IDE 扩展和手机上都没有。

### Codex CLI

```bash
codex plugin marketplace add https://github.com/maggielovelace/aitutors-plugin
codex plugin add aitutors@aitutors-me
codex mcp login aitutors
```

最后一条命令会自动打开 aitutors.me 的登录页面。

### 不用 marketplace

任何支持 OAuth 的 MCP 客户端都可以直接连：

```
https://aitutors.me/mcp
```

图文教程：[Claude](https://aitutors.me/zh/install) ·
[ChatGPT](https://aitutors.me/zh/chatgpt) ·
[Claude Code 与 Codex](https://aitutors.me/zh/agent-setup)

---

## 装好之后有什么

Mentor 负责每天的开场问候，再把孩子交给对应科目的导师——
**Pi 教授**（数学）、**Quill 教授**（英语）、**Darwin 教授**（生物）、
**Curie 教授**（化学）、**Newton 教授**（物理）、**Harari 教授**（历史）、
**Mercator 教授**（地理）。

学习记录、闪卡和进度都存在同一个账号下，和 aitutors.me 家长面板是同一份数据——
在 ChatGPT 里做的功课，家长那边看得到。

## 使用条件

需要一份有效的 [aitutors.me](https://aitutors.me) 订阅。
plugin 登录的是您已有的账号，它不会帮您注册新账号。

---

## Skills —— Heddy IP（品牌插画）

本仓库还带一个 **`heddy-ip`** agent skill：生成 **Heddy**——aitutors.me 的雪鸮吉祥物——
的品牌图片、透明贴纸和短视频，并且始终保持角色身份一致（锁定的角色 DNA、冻结的参考图、
提示词模板，以及一套带修复规则的 QA 检查）。生成图片需要 `GEMINI_API_KEY`。
使用手册：[`heddy-ip/COOKBOOK.md`](heddy-ip/COOKBOOK.md)（英文）。

无论换什么动作、场景或画法，都是同一只猫头鹰：不对称的琥珀色眼睛（左眼更大）、
小小的琥珀色菱形喙、绿色星徽、头顶的绒毛。这份一致性本身就是产品——
这个 skill 存在的意义，就是让「画着画着变成另一只鸟」不可能发生。

| | |
|:---:|:---:|
| ![Heddy 在树枝上挥手](heddy-ip/samples/wave-crayon.jpg) | ![月下的 Heddy](heddy-ip/samples/night-observatory.jpg) |
| *社交配图——蜡笔绘本画风* | *夜景——同一套 DNA，深色背景规则* |

### 现成的素材

[`heddy-ip/media/`](heddy-ip/media/) 里带了一套起步素材库：循环 GIF（按运动 DNA
生成的动画 + 短片剪辑）、各种状态与穿搭的独立 SVG、试播短片及其分段 MP4，
以及四张画风方向样张。完整的 369 个文件素材库存放在团队共享的 Drive 文件夹里。

| | | |
|:---:|:---:|:---:|
| ![Heddy 跳跃](heddy-ip/media/gif/heddy-hop.gif) | ![雪中的 Heddy](heddy-ip/media/gif/heddy-winter-snow.gif) | ![夜读的 Heddy](heddy-ip/media/gif/heddy-night-reader.gif) |
| *跳跃（运动 DNA）* | *冬日飘雪* | *夜读* |

### 能用来做什么

- **博客与文章配图**——把文章交给它：它会找出最值得配图的 3–6 个观点，先给分镜清单，
  再一张一张生成，让 Heddy「演出」每个概念，而不是站在旁边当装饰。
- **社交媒体图片**——动态图（1:1 / 4:5）、故事和短视频封面（9:16，含安全区）、
  OG 卡片（16:9）、X 横幅——各平台的尺寸规则都写在 skill 里。
- **透明贴纸**——各种姿势的 Heddy 透明 PNG，可以贴到截图、封面和幻灯片上
  （`--cutout` 会自动把背景抠成透明）。
- **表情与姿势图鉴**——三种状态（rest / focus / ready）、安静的庆祝动作、
  以及全部服装配件，做成带标注的网格图：

  ![Heddy 表情图鉴——状态与庆祝](heddy-ip/skills/heddy-ip/assets/heddy-storybook/expressions.jpg)

  ![Heddy 姿势图鉴](heddy-ip/skills/heddy-ip/assets/heddy-storybook/poses.jpg)

- **短视频**——按 10 秒一段的旁白节奏生成（先配音、每段一张风格基准图、
  每段过一遍角色一致性检查），最后在剪辑里合成。
- **身份修复**——一张图只错了一个特征（喙画弯了、两眼画一样大），
  就只改那一处，绝不重新设计角色。

每次生成都以冻结的身份基准图
（[`reference.jpg`](heddy-ip/skills/heddy-ip/assets/heddy-storybook/reference.jpg)）为条件；
每次交付都要过 QA 清单：先看这张图讲没讲清那一个观点，再逐项核对身份特征，最后检查结构。

### Claude Code

```bash
/plugin marketplace add maggielovelace/aitutors-plugin
/plugin install heddy-ip@aitutors-me
```

### Codex CLI

```bash
codex plugin marketplace add https://github.com/maggielovelace/aitutors-plugin
codex plugin add heddy-ip@aitutors-me
```

### Hermes Agent

```bash
git clone https://github.com/maggielovelace/aitutors-plugin /tmp/aitutors-plugin
cp -R /tmp/aitutors-plugin/heddy-ip/skills/heddy-ip ~/.hermes/skills/creative/heddy-ip
hermes skills list | grep heddy-ip
```

Hermes 第一次加载时会提示您输入 `GEMINI_API_KEY`
（SKILL.md 通过 `required_environment_variables` 声明了它）。

### OpenClaw / Pi / 任何支持 SKILL.md 的 agent

skill 本身就是一个独立文件夹——`heddy-ip/skills/heddy-ip/`
（SKILL.md + 参考文档 + 冻结的参考图 + 一个纯标准库的 Python 生成脚本）。
拷到 agent 的 skills 目录即可；OpenClaw 的元数据（emoji、`requires.bins`）
写在 SKILL.md 的 frontmatter 里，任何能读 SKILL.md 的 agent 都能直接用。

> **角色版权说明：**Heddy 角色本身、角色 DNA 和参考图都是 aitutors.me 的品牌资产。
> 公开这个 skill 是为了让**替 aitutors.me 工作**的 agent 能产出品牌素材——
> 不代表授权把这个角色用在其他产品上。详见 [LICENSE](LICENSE)。

---

## Skills —— Flashcards（卡片创作）

本仓库还带一个 **`flashcards`** agent skill：教会 LLM 把笔记、课本内容或一个主题，
变成符合 **aitutors.me 自有格式** 的抽认卡——和 aitutors.me 的导师、以及孩子自己
在网站上做卡片用的是同一套格式，所以生成出来的卡片能一次通过 aitutors.me 的质检。
这个 skill 不需要 API key，不需要账号，本身也不发起任何网络请求——只生成一段 JSON，
到此为止。

和 `heddy-ip` 不一样，这个 skill **只管格式和质检**——不含任何教学逻辑、提示阶梯，
也不带任何课程内容。它按 MIT 协议开源（见 [LICENSE](LICENSE) 里 "flashcards" 那一段），
因为「一份抽认卡的 JSON 格式规范」本身没有什么需要保密的。

### 它教 LLM 做什么

- **六种卡片类型**，各有各的用途——`basic`（一问一答）、`basic_reversed`
  （一条笔记变成两张独立排期的卡片，适合单词和名词）、`type_in`
  （先自己打出答案再看结果，适合简短且答案固定的内容）、`cloze`
  （填一个空）、`cloze_multi`（填多个空，每个空自动变成一张独立的卡）。
  `image_occlusion` 只做说明，不会被这个 skill 生成——那是留给 aitutors.me
  自己的标准图表用的。
- **「一张卡一个知识点」规则**——和 aitutors.me 质检用的判定逻辑一致，
  所以一个要求「说出三种细胞器」的问题，会先被拆开，而不是被直接拒绝。
- **提示不能泄题的规则**——提示语里不能出现答案中 4 个字母以上的重复词；
  skill 写的提示是帮你缩小范围，而不是直接告诉你答案。
- **导入界面要求的精确 JSON 格式**，包括每批最多 8 张卡的上限，
  以及卡片更多时该怎么办（拆成几批）。

完整格式和示例：[`flashcards/skills/flashcards/references/card-format.md`](flashcards/skills/flashcards/references/card-format.md)（英文）。
质检规则详解：[`flashcards/skills/flashcards/references/qa-checklist.md`](flashcards/skills/flashcards/references/qa-checklist.md)（英文）。

### 怎么用

1. 把你的材料给 agent（粘贴笔记、描述一个主题，或者给它一页课本内容），
   让它使用 `flashcards` 这个 skill。
2. 它会阅读材料，拆成一个个只考一个知识点的问题，给每个知识点选一种卡片类型，
   检查每条提示有没有泄题，并把这一批控制在 8 张以内。
3. 它会给你**一段 JSON**——agent 这边的工作到此结束。
4. 把这段 JSON 拿到 **[aitutors.me/study/cards/new/import](https://aitutors.me/study/cards/new/import)**
   （需要一个已开通科目的 aitutors.me 账号），粘贴进去，确认预览无误。
   卡片会直接进入你自己的练习卡堆——没有其他任何人能看到，
   而且在你第一次被打分之前，这些都还是可以修改的草稿。

示例提示词：

```text
用 flashcards 这个 skill，把这份关于水循环的笔记做成卡片——给一个八年级的
aitutors.me 账号用，然后把可以导入的 JSON 给我。
```

### Claude Code

```bash
/plugin marketplace add maggielovelace/aitutors-plugin
/plugin install flashcards@aitutors-me
```

### Codex CLI

```bash
codex plugin marketplace add https://github.com/maggielovelace/aitutors-plugin
codex plugin add flashcards@aitutors-me
```

### Hermes Agent

```bash
git clone https://github.com/maggielovelace/aitutors-plugin /tmp/aitutors-plugin
cp -R /tmp/aitutors-plugin/flashcards/skills/flashcards ~/.hermes/skills/education/flashcards
hermes skills list | grep flashcards
```

不需要任何环境变量——这个 skill 只生成 JSON。

### OpenClaw / Pi / 任何支持 SKILL.md 的 agent

skill 本身就是一个独立文件夹——`flashcards/skills/flashcards/`
（SKILL.md + 参考文档，没有脚本，没有素材）。拷到 agent 的 skills 目录即可；
OpenClaw 的元数据（emoji）写在 SKILL.md 的 frontmatter 里，
任何能读 SKILL.md 的 agent 都能直接用。

## 海迪贴纸

![海迪贴纸](stickers-preview.png)

24 张手绘蜡笔风的海迪（aitutors.me 的猫头鹰）贴纸，适用于 iPhone、iPad 和 Mac
的 iMessage。**Heddy Stickers 即将登陆 App Store。** 透明 PNG 见
[`stickers/`](stickers/)，仅供个人聊天使用（[使用条款](stickers/LICENSE.md)）。

## 乐高海迪（LEGO Heddy）

![乐高海迪](heddy-ip/lego/renders/hero-3q.png)

把海迪做成一件真的能拼出来的乐高桌面雕塑：**1,446 块真实乐高零件**，高 217 mm，约
1.5 kg。模型由代码从 `heddy-ip` 的产品几何直接生成，保留海迪的全部身份锚点：左大右小的
琥珀色眼睛、菱形小嘴、一撮呆毛、绿色八角星徽章。它不是长得像乐高的 CGI：9 项工程校验全部
通过，包括无零件穿插、无悬空零件、可按步骤拼装也可拆回、重心落在双脚之内（倾斜超过 16.7°
才会倒）、上半身可在隐藏转盘上转动 ±20°。

- **模型**：[`heddy-ip/lego/model/heddy.ldr`](heddy-ip/lego/model/heddy.ldr)（可用 Studio、LDCad、LeoCAD 打开），
  零件清单 [`bom.csv`](heddy-ip/lego/model/bom.csv)，校验报告 [`validation.md`](heddy-ip/lego/model/validation.md)
- **拼装说明书**：82 页 PDF，148 步 ——
  [`heddy-lego-instructions.pdf`](heddy-ip/lego/instructions/heddy-lego-instructions.pdf)
- **视频**：45 秒 4K 主片、29.7 秒 9:16 竖版、8 秒角色片头 ——
  [`heddy-ip/lego/video/`](heddy-ip/lego/video/)
- **设计说明**（角色分析、配色映射、工程取舍、已声明的偏差）：
  [`heddy-ip/lego/README.zh-CN.md`](heddy-ip/lego/README.zh-CN.md)

零件几何来自 LDraw.org 零件库（CC BY 4.0），字体为 Bricolage Grotesque 与 IBM Plex Sans（OFL）。

## 联系我们

[hello@aitutors.me](mailto:hello@aitutors.me) · [aitutors.me/zh/chatgpt](https://aitutors.me/zh/chatgpt) ·
[YouTube](https://www.youtube.com/@aitutorsme)

---

Claude 是我们的主力平台，新功能会先上 Claude。
但导师能做的事，两边是一样的。
