# Heddy 的舞蹈

[English](README.md) · **中文**

一段 10 秒的定格动画舞蹈，从锁定的 `../model/heddy.json` 渲染，和影片用同一个摄影棚。Heddy 可以
独舞，也可以领着 [`faculty/built`](../../../faculty/built/README.zh-CN.md) 里的八位积木 AI 导师一起跳。

| 文件 | 规格 | 内容 |
|---|---|---|
| `video/heddy-lego-dance-16x9.mp4` | 10 秒，1280×720，24 fps | Heddy 独舞 |
| `video/heddy-team-dance-16x9.mp4` | 10 秒，1280×720，24 fps | Heddy 领舞，AI 导师分两排错位站 |
| `video/heddy-team-dance-9x16.mp4` | 10 秒，720×1280，24 fps | 同一支舞，竖版，四排菱形队形 |

## 怎么动

Heddy 只有一个真实关节：转盘（±20°）。模型上没有任何零件被弯折、重画或改色。整支舞是把整个
玩具当定格动画来摆：跳、左右摇、横移、转圈，转盘负责反向扭动。导师是带底座的半身像，没有关节，
所以整体跳、摇、转。

每个动作都由 Heddy 先做，后面每一排晚一小拍跟上，所以转身和最后的转圈会一排排往后传。

| 时间 | 动作 |
|---|---|
| 0.0–1.5 秒 | 背对镜头，用转盘扭动 |
| 1.5–2.4 秒 | 跳起转身，面向镜头 |
| 2.4–5.0 秒 | 左右摇摆 |
| 5.0–6.3 秒 | 左右横移 |
| 6.3–7.8 秒 | 点头加四分之一转 |
| 7.8–8.7 秒 | 整圈旋转 |
| 8.7–10 秒 | 落地定格，歪头 |

整支舞就是 `render_dance.py` 里的 `pose(t)` 函数。速度 112 BPM，按"一拍二"渲染。字幕按拍子一个词
一个词出现，使用 Bricolage Grotesque（OFL，见 `../tools/fonts/`）。鼓点在 `make_dance.py` 里合成，
没有使用任何采样音频。团队版视频带有"Heddy and the AI tutors"标注。

## 重新生成

需要 Python 3.11，并安装 `bpy`、`numpy`、`pillow`、`imageio-ffmpeg`。在仓库根目录运行：

```bash
# Heddy 独舞
python heddy-ip/lego/dance/render_dance.py heddy-ip/lego /tmp/dance 1280 720 32
python heddy-ip/lego/dance/make_dance.py /tmp/dance heddy-ip/lego heddy-lego-dance-16x9.mp4

# 和 AI 导师一起（先 16:9，再 9:16）
python heddy-ip/lego/dance/render_dance.py heddy-ip/lego /tmp/team169 1280 720 32 --team
python heddy-ip/lego/dance/make_dance.py /tmp/team169 heddy-ip/lego heddy-team-dance-16x9.mp4
python heddy-ip/lego/dance/render_dance.py heddy-ip/lego /tmp/team916 720 1280 32 --team
python heddy-ip/lego/dance/make_dance.py /tmp/team916 heddy-ip/lego heddy-team-dance-9x16.mp4
```

渲染可以续跑：已完成的帧会跳过。AI 导师的使用条款见
[`faculty/LICENSE.md`](../../../faculty/LICENSE.md)。
