# 用真实积木搭出来的教授团

[English](README.md) · **中文**

![代码搭建的教授团](sheet.jpg)

aitutors.me 的八位 AI 导师，用**真实的 LDraw 零件在代码里搭建**，方法和[乐高海迪](../../heddy-ip/lego/README.zh-CN.md)一样，
并在海迪的同一个摄影棚里渲染（同样的塑料质感、倒角、灯光和背景）。每尊半身像由 1,400 到 1,600 块板件和光面片组成。

这是**第 2 版**；由图像模型绘制的第 1 版在 [`../`](../README.zh-CN.md)，两版都保留。

这个文件夹是一套**工具**：任何智能体（或人）都可以重新搭建某位教授、渲染新的角度、做透明背景的抠图，
或者加入一位能放进同一套里的新角色。

## 直接使用头像（不用安装）

任何人或智能体都可以直接用这个文件夹里的成品头像。把下面这段贴进任何会话（Claude Code、Codex、ChatGPT、Cursor）：

```text
Use the brick-built faculty from https://github.com/maggielovelace/aitutors-plugin/tree/main/faculty/built
(read its README first). Portraits: renders/cutout/<id>.png (transparent) or renders/<id>.png (cream).
To make one talk or blink, swap renders/faces/<id>-{base,half,open,blink}.webp. Every portrait
appears with the label "AI tutor"; never call them LEGO. Curie, Quill and the Mentor are women.
```

## 里面有什么

- `renders/<id>.png`：1200 × 1200，米色背景的成品图
- `renders/cutout/<id>.png`：同一张图，透明背景（保留底座）
- `renders/faces/<id>-<状态>.webp`：表情状态，透明背景：`base`、`half` 和 `open`（张嘴），`blink`（眨眼）。四张图除了脸部完全一样，叠在一起切换就能让教授说话、眨眼，不会闪
- `model/<id>.json`：渲染器读取的零件清单；`model/<id>.ldr`：标准 LDraw 文件，可用 Studio、LDCad、LeoCAD 打开
- `tools/`：搭建器 `bust.py`、每位角色的规格 `prof_<id>.py`、渲染 `render_bust.py`、一键命令 `build.py`

## 快速开始

```bash
conda create -y -p ./bpyenv python=3.11 && ./bpyenv/bin/pip install bpy numpy pillow
export BPY_PYTHON=$PWD/bpyenv/bin/python
python3 faculty/built/tools/build.py all --render --cutout
```

搭建方法、「整套锁定」参数（头部尺寸、相机高度 0.11149 m、转角 −16°、底座）、新增角色的步骤和质量要求，
详见[英文说明](README.md)。

## 给 AI 智能体的提示词

下面的提示词适用于 Codex、Claude Code、Cursor、Gemini CLI，或任何能运行命令、能看图片的编程智能体。
先克隆仓库，在仓库根目录打开智能体：

```bash
git clone https://github.com/maggielovelace/aitutors-plugin.git && cd aitutors-plugin
```

复制一段提示词，把 `<尖括号>` 里的内容换成你要的。智能体读英文说明最准确，所以提示词用英文。
每一段都要求智能体先读说明、保持「整套锁定」参数、并亲眼看每一张渲染图，大多数失败都来自跳过这三步。

**1. 安装并检查工具能用**

```text
Read faculty/built/README.md. Set up rendering as its "Setup" section describes and export
BPY_PYTHON. Run `python3 faculty/built/tools/build.py pi` and confirm `git status` shows no change
to faculty/built/model/. Then render a quick draft of pi at --size 700 --samples 24, open it and
tell me what you see.
```

**2. 为某位教授做贴纸或头像**

```text
Read faculty/built/README.md. Using faculty/built/renders/cutout/<curie>.png (do not re-render),
make <a 512 px sticker with a white outline and a 256 px round avatar cropped to the head>.
Crop first, then downscale; never upscale. Save to <out/curie/> and show me each file.
```

**3. 新增一位角色**

```text
Read faculty/built/README.md in full, then tools/prof_pi.py and tools/bust.py. Create a new
brick-built character: <Professor X, ...>. Follow "Adding a new character" and keep the set lock.
Draft at --size 700 --samples 24, open every render and fix what reads wrong. When it is right,
run `build.py <id> --render --cutout` and show me the final next to renders/pi.png.
The face must be original.
```

新角度、转台动画、新表情、放进网页或 App 的提示词，见[英文说明](README.md#prompts-for-ai-agents)。

**检查智能体交回来的结果**

- 和整套一致：头部大小、相机高度、角度、底座都相同。
- 在产品里出现时仍标明「AI 导师」。
- 脸是原创的；性别正确（Curie、Quill 和 Mentor 是女性）。
- 对外称「积木搭建」，不称「乐高」。
- 没有往仓库里加任何教学方法细节。

## 规则

- 是 AI 导师，出现在产品里时都会标明「AI 导师」。
- 原创角色：名字向真实人物致敬，但脸不像他们，也不像任何真实的人。
- 性别固定（负责人规定）：Curie、Quill 和 Mentor 是女性，其余五位是男性。Quill 的名字来自羽毛笔，不是某个人。
- 对外一律称「积木搭建」，不称「乐高」。
- 这个仓库里不写任何教学方法细节。

许可见 [`../LICENSE.md`](../LICENSE.md)：作品仅限个人、非商业用途；零件几何数据来自 LDraw.org，CC BY 4.0。
