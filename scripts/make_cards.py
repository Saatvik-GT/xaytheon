"""Render the gallery card art from each model's real activations.

Every card is a real forward pass on a real input, painted with the same
spectral emission ramp the app uses (src/viz/spectrum.ts), so the gallery
shows exactly what the lab will.

Usage:  python scripts/make_cards.py
Output: public/cards/<model>.png (960x600)
"""

import base64
import json

import numpy as np
import onnx
import onnxruntime as ort
from PIL import Image
from PIL.PngImagePlugin import PngInfo

from common import MODELS, ROOT

OUT = ROOT / "public" / "cards"
W, H = 960, 600
PLUMBING = {"Reshape", "Transpose", "Flatten", "Squeeze", "Unsqueeze", "Identity", "Split", "Dropout", "Cast",
            "Shape", "Gather", "Concat", "Slice", "Range", "Equal", "Expand", "ConstantOfShape", "Where"}


def wavelength_rgb(nm):
    r = g = b = 0.0
    if nm < 440: r, b = -(nm - 440) / 60, 1.0
    elif nm < 490: g, b = (nm - 440) / 50, 1.0
    elif nm < 510: g, b = 1.0, -(nm - 510) / 20
    elif nm < 580: r, g = (nm - 510) / 70, 1.0
    elif nm < 645: r, g = 1.0, -(nm - 645) / 65
    else: r = 1.0
    k = 1.0
    if nm < 420: k = 0.35 + 0.65 * (nm - 380) / 40
    elif nm > 700: k = 0.35 + 0.65 * (780 - nm) / 80
    return np.array([0 if c <= 0 else (c * k) ** 0.8 for c in (r, g, b)])


def layer_hue(i, n):
    t = 0 if n <= 1 else i / (n - 1)
    return wavelength_rgb(680 - t * (680 - 415))


def emit(hue, x):
    """Black -> hue -> white-hot, vectorised over x in [0, 1]."""
    x = np.clip(x, 0, 1)[..., None]
    k = np.clip(x / 0.62, 0, 1)
    low = hue * (k * k * (3 - 2 * k) * 0.92 + k * 0.08)
    w = np.clip((x - 0.62) / 0.38, 0, 1)
    high = hue + (1 - hue) * w
    return np.where(x < 0.62, low, high)


def shade(hue):
    """Negatives: the layer's own hue, mostly greyed, never white (src/viz/spectrum.ts)."""
    grey = max(0.45, 0.3 * hue[0] + 0.59 * hue[1] + 0.11 * hue[2])
    return (hue * 0.18 + grey * 0.82) * np.array([0.62, 0.62, 0.66])


def paint(values, hue, scale=None):
    v = np.asarray(values, dtype=np.float32)
    v = np.where(np.isfinite(v), v, 0)
    s = scale or (np.abs(v).max() or 1)
    pos = emit(hue, np.abs(v) / s)
    x = np.clip(np.abs(v) / s, 0, 1)[..., None]
    neg = shade(hue) * (x * x * (3 - 2 * x) * 0.85 + x * 0.15)
    rgb = np.where((v < 0)[..., None], neg, pos)
    return Image.fromarray((rgb * 255).astype(np.uint8))


def run_all(path, feeds):
    m = onnx.load(str(path))
    names = []
    for n in m.graph.node:
        for o in n.output:
            if o and o not in [x.name for x in m.graph.output]:
                m.graph.output.extend([onnx.ValueInfoProto(name=o)])
            names.append((n.op_type, o))
    sess = ort.InferenceSession(m.SerializeToString(), providers=["CPUExecutionProvider"])
    outs = dict(zip([o.name for o in sess.get_outputs()], sess.run(None, feeds)))
    visible = [(op, o) for op, o in names if op != "Constant" and o in outs and outs[o].dtype == np.float32
               and (op not in PLUMBING or (op in ("Concat", "Gather") and outs[o].ndim >= 3))]
    return outs, visible


def hue_of(visible, tensor):
    idx = [o for _, o in visible].index(tensor)
    return layer_hue(idx, len(visible))


def mosaic(tiles, cols, tile, gap=10, pad=None):
    rows = (len(tiles) + cols - 1) // cols
    gw, gh = cols * tile + (cols - 1) * gap, rows * tile + (rows - 1) * gap
    canvas = Image.new("RGB", (W, H), (0, 0, 0))
    x0, y0 = (W - gw) // 2, (H - gh) // 2
    for i, t in enumerate(tiles):
        r, c = divmod(i, cols)
        canvas.paste(t.resize((tile, tile), Image.NEAREST), (x0 + c * (tile + gap), y0 + r * (tile + gap)))
    return canvas


def save(img, name, note):
    OUT.mkdir(parents=True, exist_ok=True)
    # Provenance travels with the file (read it back with embed-prompt.mjs --read).
    info = PngInfo()
    info.add_text("impeccable:prompt", f"origin: rendered by scripts/make_cards.py from a real forward pass; {note}. Not AI-generated.")
    img.save(OUT / f"{name}.png", optimize=True, pnginfo=info)
    print(f"saved public/cards/{name}.png  ({note})", flush=True)


def sample_pixels(meta_file, label):
    meta = json.loads((MODELS / meta_file).read_text())
    s = next(x for x in meta["samples"] if x["label"] == label)
    return np.frombuffer(base64.b64decode(s["pixels"]), dtype=np.uint8).reshape(28, 28) / 255.0


def input_and_maps(input_img, tiles, cols, tile, gap=10, in_size=250, width=W):
    """The input on the left, its feature maps as a grid on the right."""
    rows = (len(tiles) + cols - 1) // cols
    gw, gh = cols * tile + (cols - 1) * gap, rows * tile + (rows - 1) * gap
    total = in_size + 56 + gw
    canvas = Image.new("RGB", (width, H), (0, 0, 0))
    W = width
    x0 = (W - total) // 2
    canvas.paste(input_img.resize((in_size, in_size), Image.NEAREST), (x0, (H - in_size) // 2))
    # a hairline arrow from input to maps
    ax, ay = x0 + in_size + 14, H // 2
    for x in range(ax, ax + 28):
        canvas.putpixel((x, ay), (110, 110, 110))
    for k in range(5):
        canvas.putpixel((ax + 27 - k, ay - k), (110, 110, 110))
        canvas.putpixel((ax + 27 - k, ay + k), (110, 110, 110))
    gx, gy = x0 + in_size + 56, (H - gh) // 2
    for i, t in enumerate(tiles):
        r, c = divmod(i, cols)
        canvas.paste(t.resize((tile, tile), Image.NEAREST), (gx + c * (tile + gap), gy + r * (tile + gap)))
    return canvas


def card_cnn(name, model_file, meta_file, label, layer_op_index, cols, tile, note):
    px = sample_pixels(meta_file, label).astype(np.float32)
    outs, vis = run_all(MODELS / model_file, {"image": px.reshape(1, 1, 28, 28)})
    convs = [o for op, o in vis if op == "Conv"]
    t = convs[layer_op_index]
    a = outs[t][0]
    hue = hue_of(vis, t)
    tiles = [paint(ch, hue, np.abs(a).max() * 0.6) for ch in a]
    src = Image.fromarray((px * 255).astype(np.uint8)).convert("RGB")
    save(input_and_maps(src, tiles, cols, tile), name, note)


def card_vision():
    img = Image.open(ROOT / "public" / "samples" / "cat.jpg").convert("RGB")
    s = min(img.width, img.height)
    img = img.crop(((img.width - s) // 2, (img.height - s) // 2, (img.width + s) // 2, (img.height + s) // 2)).resize((224, 224))
    x = (np.asarray(img, dtype=np.float32) / 255 - [0.485, 0.456, 0.406]) / [0.229, 0.224, 0.225]
    x = x.transpose(2, 0, 1)[None].astype(np.float32)
    outs, vis = run_all(MODELS / "squeezenet.onnx", {"image": x})
    relus = [o for op, o in vis if op == "Relu"]
    t = relus[2]  # an early fire module, still spatially readable
    a = outs[t][0]
    order = np.argsort(-np.abs(a).mean(axis=(1, 2)))[:20]
    hue = hue_of(vis, t)
    tiles = [paint(a[c], hue, np.abs(a[order]).max() * 0.8) for c in order]
    save(input_and_maps(img, tiles, 5, 88, gap=8, in_size=270), "vision", f"SqueezeNet {t}, strongest 20 channels, Chelsea the cat (CC0)")
    # The featured gallery card is twice as wide: same pass, more channels.
    wide_order = np.argsort(-np.abs(a).mean(axis=(1, 2)))[:44]
    wide = [paint(a[c], hue, np.abs(a[wide_order]).max() * 0.8) for c in wide_order]
    save(input_and_maps(img, wide, 11, 104, gap=8, in_size=470, width=1920), "vision-wide", f"SqueezeNet {t}, strongest 44 channels, Chelsea the cat (CC0)")


def card_bard():
    meta = json.loads((MODELS / "bard-meta.json").read_text())
    vocab = {c: i for i, c in enumerate(meta["vocab"])}
    text = "ROMEO:\nBut soft, what light through yonder window breaks?\nIt is the east, and "
    ids = [vocab[c] for c in text if c in vocab][-64:]
    outs, vis = run_all(MODELS / "bard-gpt.onnx", {"tokens": np.array([ids], dtype=np.int64)})
    soft = [o for op, o in vis if op == "Softmax"]
    tiles = []
    for t in soft:
        a = outs[t][0]
        hue = hue_of(vis, t)
        tiles += [paint(np.sqrt(np.clip(h, 0, None)), hue, np.sqrt(h.max())) for h in a]
    save(mosaic(tiles, 6, 140, gap=12), "bard", "all 12 attention heads on the opening of Romeo and Juliet, Act 2")


def card_latent():
    pts = json.loads((MODELS / "latent-map.json").read_text())["points"]
    canvas = Image.new("RGB", (W, H), (0, 0, 0))
    px = canvas.load()
    span = 3.2
    for x, y, label in pts:
        cx = int(W / 2 + x / span * (H / 2 - 20))
        cy = int(H / 2 - y / span * (H / 2 - 20))
        col = tuple(int(c * 255 * 0.9) for c in layer_hue(label, 10))
        for dx in (0, 1):
            for dy in (0, 1):
                if 0 <= cx + dx < W and 0 <= cy + dy < H:
                    px[cx + dx, cy + dy] = col
    sess = ort.InferenceSession(str(MODELS / "latent-decoder.onnx"), providers=["CPUExecutionProvider"])
    for i, (x, y) in enumerate([(-1.6, 1.2), (0.0, 0.0), (1.5, -1.0)]):
        img = sess.run(None, {"z": np.array([[x, y]], dtype=np.float32)})[0][0, 0]
        tile = Image.fromarray((np.clip(img, 0, 1) * 255).astype(np.uint8)).convert("RGB").resize((112, 112), Image.NEAREST)
        canvas.paste(tile, (W - 150, 40 + i * 180))
    save(canvas, "latent", "4000 MNIST test digits placed by the encoder, plus three decoded points")


def main():
    card_cnn("digits", "mnist-cnn.onnx", "mnist-samples.json", 3, 1, 4, 96, "conv2, all 16 maps, MNIST test digit 3")
    card_cnn("doodles", "doodle-cnn.onnx", "doodle-meta.json", 2, 0, 4, 96, "conv1, all 16 maps, Quick, Draw! cat")
    card_cnn("wardrobe", "fashion-cnn.onnx", "fashion-samples.json", 7, 0, 4, 96, "conv1, all 16 maps, Fashion-MNIST sneaker")
    card_vision()
    if (MODELS / "bard-gpt.onnx").exists():
        card_bard()
    if (MODELS / "latent-decoder.onnx").exists():
        card_latent()


if __name__ == "__main__":
    main()
