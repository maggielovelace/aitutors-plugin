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

## 联系我们

[hello@aitutors.me](mailto:hello@aitutors.me) · [aitutors.me/zh/chatgpt](https://aitutors.me/zh/chatgpt) ·
[YouTube](https://www.youtube.com/@aitutorsme)

---

Claude 是我们的主力平台，新功能会先上 Claude。
但导师能做的事，两边是一样的。
