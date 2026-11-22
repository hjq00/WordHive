"""生成轻词 Android 应用图标。

v1.4 按用户要求简化：**直接 1:1 缩小原图**，不做任何美化处理。

设计取舍：
- 原图 1439x1424，只做「中心最小裁切」变成 1424x1424 正方形（左右各裁约 7.5px，
  视觉无损）；不挪主体、不裁边缘草地、不改构图。
- 不调色、不锐化、不加圆角：ic_launcher.png 就是原图等比缩小后的方形图，
  圆角/圆形由 Android 启动器的 adaptive 遮罩自行处理。
- ic_launcher_round.png = 同图 + 正圆遮罩（Android roundIcon 规范必需，四角透明）。
- ic_launcher_foreground.png = 同图满幅铺满 108dp 画布，alpha 全 255，
  避免 launcher 做视差缩放时露出一圈背景色。
- 背景色取原图四边平均色写进 values/ic_launcher_background.xml；
  drawable/ic_launcher_background.xml 保持纯色，不在此脚本内改动。

产出：
  design/icon-output/mipmap-{mdpi,hdpi,xhdpi,xxhdpi,xxxhdpi}/ic_launcher.png
  design/icon-output/mipmap-*/ic_launcher_round.png
  design/icon-output/mipmap-*/ic_launcher_foreground.png
  design/icon-preview.png            512px 目视确认（方形原图，无圆角）
  design/icon-preview-adaptive.png   512px 目视确认（模拟 adaptive 中心 72/108 裁剪 + 圆形遮罩）
并复制到 android/app/src/main/res/mipmap-*/
"""
from __future__ import annotations

import argparse
import re
import shutil
from pathlib import Path

from PIL import Image, ImageDraw

HERE = Path(__file__).parent
PROJECT = HERE.parent
OUT = HERE / "icon-output"
RES = PROJECT / "android" / "app" / "src" / "main" / "res"

DEFAULT_SRC = Path(
    "C:/Users/Administrator/.workbuddy/clipboard-images/"
    "clipboard-2026-11-20T04-43-02-012Z-def2d64a.jpg"
)

# 五档 launcher 尺寸（px）。adaptive 前景按 108/48 换算成 108dp 画布。
DENSITIES = {
    "mdpi": 48,
    "hdpi": 72,
    "xhdpi": 96,
    "xxhdpi": 144,
    "xxxhdpi": 192,
}
FG_RATIO = 108 / 48  # adaptive 前景画布 = launcher 尺寸 * 2.25


def square_center(img: Image.Image) -> Image.Image:
    """中心最小裁切成正方形：只裁掉长边多出来的部分，不缩放、不二次构图。"""
    w, h = img.size
    side = min(w, h)
    left = (w - side) // 2
    top = (h - side) // 2
    return img.crop((left, top, left + side, top + side))


def edge_color(img: Image.Image) -> tuple[int, int, int]:
    """取图片四条边的平均色，用作 adaptive 背景色，避免外圈露色。"""
    small = img.resize((24, 24), Image.LANCZOS)
    px = small.load()
    total = [0, 0, 0]
    count = 0
    for x in range(24):
        for y in range(24):
            if 2 <= x <= 21 and 2 <= y <= 21:
                continue  # 跳过中心区域，只统计 2px 边缘环
            r, g, b = px[x, y][:3]
            total[0] += r
            total[1] += g
            total[2] += b
            count += 1
    count = max(1, count)
    return tuple(int(c / count) for c in total)  # type: ignore[return-value]


def circle_mask(size: int, supersample: int = 4) -> Image.Image:
    """抗锯齿正圆遮罩（唯一保留的遮罩，Android roundIcon 规范要求）。"""
    big = size * supersample
    mask = Image.new("L", (big, big), 0)
    ImageDraw.Draw(mask).ellipse((0, 0, big - 1, big - 1), fill=255)
    return mask.resize((size, size), Image.LANCZOS)


def launcher(sq: Image.Image, size: int) -> Image.Image:
    """ic_launcher.png：原图等比缩小，方形、不透明、无圆角。"""
    return sq.resize((size, size), Image.LANCZOS).convert("RGB")


def round_icon(sq: Image.Image, size: int) -> Image.Image:
    """ic_launcher_round.png：同上 + 正圆遮罩。"""
    icon = sq.resize((size, size), Image.LANCZOS).convert("RGBA")
    icon.putalpha(circle_mask(size))
    return icon


def foreground(sq: Image.Image, size: int) -> Image.Image:
    """ic_launcher_foreground.png：同图满幅铺满 108dp 画布，alpha 全 255。"""
    icon = sq.resize((size, size), Image.LANCZOS).convert("RGBA")
    icon.putalpha(255)
    return icon


def adaptive_preview(sq: Image.Image, size: int) -> Image.Image:
    """模拟 launcher 渲染 adaptive 图标：只显示中心 72/108（2/3），再套圆形遮罩。

    背景用中性桌面灰，方便一眼看清「图标本身」而不是被背景色影响判断。
    """
    side = round(size * 72 / 108)
    offset = (size - side) // 2
    cropped = sq.resize((size, size), Image.LANCZOS).crop(
        (offset, offset, offset + side, offset + side)
    )
    layer = cropped.resize((size, size), Image.LANCZOS).convert("RGBA")
    layer.putalpha(circle_mask(size))
    canvas = Image.new("RGBA", (size, size), (232, 233, 229, 255))
    canvas.alpha_composite(layer, (0, 0))
    return canvas


def write_bg_color(rgb: tuple[int, int, int]) -> Path | None:
    """把采样到的草地色写进 values/ic_launcher_background.xml。"""
    path = RES / "values" / "ic_launcher_background.xml"
    if not path.parent.exists():
        return None
    hex_color = f"#{rgb[0]:02X}{rgb[1]:02X}{rgb[2]:02X}"
    path.write_text(
        '<?xml version="1.0" encoding="utf-8"?>\n'
        "<resources>\n"
        f'    <color name="ic_launcher_background">{hex_color}</color>\n'
        "</resources>\n",
        encoding="utf-8",
    )
    return path


def sync_drawable_color(rgb: tuple[int, int, int]) -> Path | None:
    """让 drawable/ic_launcher_background.xml 的纯色与 values 保持同一个值。

    这个矢量图已无人引用，但若被陈旧构建缓存命中，颜色不一致会露出一块别的绿。
    只替换 fillColor，不恢复模板的青绿。
    """
    path = RES / "drawable" / "ic_launcher_background.xml"
    if not path.exists():
        return None
    hex_color = f"#{rgb[0]:02X}{rgb[1]:02X}{rgb[2]:02X}"
    text = path.read_text(encoding="utf-8")
    new_text = re.sub(r'android:fillColor="#[0-9A-Fa-f]{6}"',
                      f'android:fillColor="{hex_color}"', text)
    if new_text != text:
        path.write_text(new_text, encoding="utf-8")
        return path
    return None


def main() -> None:
    parser = argparse.ArgumentParser(description="生成轻词 Android 应用图标（原图 1:1 等比缩小）")
    parser.add_argument("--src", default=str(DEFAULT_SRC), help="源图片路径")
    parser.add_argument("--no-copy", action="store_true", help="只生成到 design/icon-output，不复制到 android res")
    args = parser.parse_args()

    src = Path(args.src)
    if not src.exists():
        raise SystemExit(f"源图片不存在：{src}")

    photo = Image.open(src)
    if photo.mode != "RGB":
        photo = photo.convert("RGB")
    sq = square_center(photo)
    bg = edge_color(sq)
    print(f"source={src.name} {photo.size[0]}x{photo.size[1]} -> square {sq.size[0]}x{sq.size[1]}")
    print(f"  no enhancement / no rounded corners; bg=#{bg[0]:02X}{bg[1]:02X}{bg[2]:02X}")

    OUT.mkdir(parents=True, exist_ok=True)

    # 目视确认用大图（方形原图，无圆角、无调色）
    launcher(sq, 512).save(HERE / "icon-preview.png")
    adaptive_preview(sq, 512).save(HERE / "icon-preview-adaptive.png")

    for name, px in DENSITIES.items():
        target = OUT / f"mipmap-{name}"
        target.mkdir(parents=True, exist_ok=True)
        launcher(sq, px).save(target / "ic_launcher.png")
        round_icon(sq, px).save(target / "ic_launcher_round.png")
        fg_px = round(px * FG_RATIO)
        fg = foreground(sq, fg_px)
        fg.save(target / "ic_launcher_foreground.png")

        alpha = fg.getchannel("A")
        print(f"  mipmap-{name}: launcher {px}px / round {px}px / foreground {fg_px}px  min_alpha={alpha.getextrema()[0]}")

        if not args.no_copy:
            res_dir = RES / f"mipmap-{name}"
            if not res_dir.exists():
                print(f"  ! 跳过复制（不存在）：{res_dir}")
                continue
            for fname in ("ic_launcher.png", "ic_launcher_round.png", "ic_launcher_foreground.png"):
                shutil.copyfile(target / fname, res_dir / fname)

    if not args.no_copy:
        color_file = write_bg_color(bg)
        if color_file:
            print(f"  adaptive background -> {color_file}")
        drawable_file = sync_drawable_color(bg)
        if drawable_file:
            print(f"  drawable background -> {drawable_file}")

    print("done ->", OUT, "| preview:", HERE / "icon-preview.png")


if __name__ == "__main__":
    main()
