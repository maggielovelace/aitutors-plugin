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

## 联系我们

[hello@aitutors.me](mailto:hello@aitutors.me) · [aitutors.me/zh/chatgpt](https://aitutors.me/zh/chatgpt) ·
[YouTube](https://www.youtube.com/@aitutorsme)

---

Claude 是我们的主力平台，新功能会先上 Claude。
但导师能做的事，两边是一样的。
