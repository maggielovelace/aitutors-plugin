# Heddy for Chrome

[English](README.md) · **简体中文**

**收下你找到的东西。** 配合 [aitutors.me](https://aitutors.me) 使用。

Heddy 在每个 YouTube 视频页的「分享」按钮后面加两个按钮：

- **和 Heddy 一起看**：把视频放进「我的短片」，然后在 aitutors.me 的 Classroom
  里打开，由这门课的教授陪着看。
- **放进「我的短片」**：先收下，以后再看。

Heddy 工具栏弹出框里也有这两个按钮，还能选「整个视频」或「从 m:ss 开始」。
即使 YouTube 改了页面，弹出框照样能用。

Heddy 只是个「快递员」。它不保存账号、密钥或令牌，自己也不发任何网络请求：
每次点按钮，都会在 aitutors.me 上打开一个小窗口，由那个页面检查视频，并在
孩子自己的账号下保存，孩子在那里点一下就好。

在任意网页上还可以：

- **在 YouTube 视频上按 H**，把正在说的那句话记进这个视频的批注本。快速按两次，
  会连上前一句。YouTube 自己的按键（包括 J）照常使用。
- **写批注**：选中任意网页上的文字，右键选「用 Heddy 写批注」，或打开 Heddy 的
  弹出框。也可以在 `chrome://extensions/shortcuts` 给它设一个快捷键（Heddy 默认
  不设，所以不会占用 Chrome 自己的快捷键）。
- **剪下这一页**：把网页的正文存为批注本的来源。很长的网页只保留前一部分，
  Heddy 会告诉你。

## 安装

**从 Chrome 网上应用店安装：** 上架后会在这里放链接。

**从源码安装**（测试用，或在上架之前）：

1. 下载这个仓库（Code → Download ZIP）并解压，或者
   `git clone https://github.com/maggielovelace/aitutors-plugin`。
2. 打开 `chrome://extensions`，打开右上角的 **开发者模式**。
3. 点 **加载已解压的扩展程序**，选择 `heddy-chrome` 文件夹。
4. 在拼图图标菜单里固定 Heddy，然后打开任意一个 YouTube 视频。

请在同一个 Chrome 里以孩子的身份登录 aitutors.me。如果还没登录，小窗口会先
请你登录，然后接着完成。

## 设置

右键点 Heddy 图标 → **选项**，或点弹出框里的齿轮：

- **语言**：English 或 简体中文。默认跟随 Chrome 的语言。aitutors.me 上的
  窗口跟随你在网站上选的语言。
- **开发者选项**：把内容发到 `http://localhost:3000`，而不是 aitutors.me。
  请保持关闭。

## 给学校

学校管理的 Chromebook 可能会禁止安装扩展程序。要允许 Heddy，请在 Google
管理控制台的允许列表里加入它的 ID：

```
扩展程序 ID：（上架 Chrome 网上应用店后填写）
```

aitutors.me 上没有任何功能依赖 Heddy：没有它，孩子照样可以在「快速添加」
页面添加视频。

## 隐私

**只有你让它读，它才会读页面。** Heddy 只在 YouTube 视频页
（`https://www.youtube.com/watch…`）上读取视频 ID；你点按钮时，如果选了
「从 m:ss 开始」，再读一下播放器的当前时间；按 H 时，读当前时间和视频标题；
打开弹出框时，读视频的标题、频道和时长给你看。在其他网页上，只有你打开弹出框、
右键「用 Heddy 写批注」或按你设的快捷键时，它才读你选中的文字和前后各最多
300 个字符；点「剪下这一页」时，才读这一页的正文。它不读字幕、评论、浏览记录或 Cookie，不做统计，也不上报
错误。完整说明见 [PRIVACY.md](PRIVACY.md)（英文）。

## 测试

```bash
cd heddy-chrome
npm test
```

需要 Node 20 或更高版本，没有依赖。测试会锁定权限列表、禁止发布文件里出现
任何网络请求、检查每个 `cid` 只回答一次并在 10 分钟后过期，并用网站的校验
规则检查每条消息。

## 许可

代码采用 MIT 许可，见 [LICENSE](LICENSE)。Heddy 的名字、角色形象和图标
不在许可范围内。
