#!/bin/sh
# Rasterise the toolbar and store icons from icons/src/*.svg (needs rsvg-convert,
# e.g. `brew install librsvg`). The PNGs are committed, so a store build needs
# no tools: run this only after changing an SVG.
#
#   eyes-mark.svg        A · 02's eyes mark (D34): the idle toolbar icon
#   eyes-mark-ready.svg  + a green dot: on a YouTube watch page
#   eyes-mark-saved.svg  + a green tick: for 2 s after a save
#   store-128.png        the store and 128 px icon: the same navy eyes crest
#                        (owner ruling 2026-11-01), drawn at 96 x 96 in the middle
#                        of a transparent 128 x 128 canvas, Google's 16 px padding
set -eu
cd "$(dirname "$0")/../icons"
for size in 16 32 48; do
  rsvg-convert -w "$size" -h "$size" src/eyes-mark.svg -o "toolbar-$size.png"
done
for state in ready saved; do
  for size in 16 32; do
    rsvg-convert -w "$size" -h "$size" "src/eyes-mark-$state.svg" -o "toolbar-$state-$size.png"
  done
done
rsvg-convert -w 96 -h 96 --page-width 128 --page-height 128 --left 16 --top 16 src/eyes-mark.svg -o store-128.png
echo "icons rendered"
