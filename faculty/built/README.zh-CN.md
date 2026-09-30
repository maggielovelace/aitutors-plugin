# 用真实积木搭出来的教授团

[English](README.md) · **中文**

![代码搭建的教授团](sheet.jpg)

aitutors.me 的八位 AI 导师，用**真实的 LDraw 零件在代码里搭建**，方法和[乐高海迪](../../heddy-ip/lego/README.zh-CN.md)一样，
并在海迪的同一个摄影棚里渲染（同样的塑料质感、倒角、灯光和背景）。每尊半身像由 1,400 到 1,600 块板件和光面片组成。

这是**第 2 版**；由图像模型绘制的第 1 版在 [`../`](../README.zh-CN.md)，两版都保留。

这个文件夹是一套**工具**：任何智能体（或人）都可以重新搭建某位教授、渲染新的角度、做透明背景的抠图，
或者加入一位能放进同一套里的新角色。

## 里面有什么

- `renders/<id>.png`：1200 × 1200，米色背景的成品图
- `renders/cutout/<id>.png`：同一张图，透明背景（保留底座）
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

## 规则

- 是 AI 导师，出现在产品里时都会标明「AI 导师」。
- 原创角色：名字向真实人物致敬，但脸不像他们，也不像任何真实的人。
- 每位教授的性别与致敬对象一致：Curie 和 Mentor 是女性，其余六位是男性。
- 对外一律称「积木搭建」，不称「乐高」。
- 这个仓库里不写任何教学方法细节。

许可见 [`../LICENSE.md`](../LICENSE.md)：作品仅限个人、非商业用途；零件几何数据来自 LDraw.org，CC BY 4.0。
