"""Pretrained SqueezeNet 1.1 (torchvision, ImageNet-1k) for Xaytheon's "Vision" lab,
plus a handful of public-domain / CC0 sample photos from scikit-image.

Usage:  python scripts/export_squeezenet.py
Output: public/models/squeezenet.onnx, public/models/squeezenet-meta.json, public/samples/*.jpg
"""

import torch
from PIL import Image
from skimage import data
from torchvision.models import SqueezeNet1_1_Weights, squeezenet1_1

from common import MODELS, ROOT, export, write_json

# (file, loader, credit) - all public domain or CC0 per scikit-image's data docs
SAMPLES = [
    ("cat", data.chelsea, "Chelsea the cat, Stefan van der Walt, CC0"),
    ("coffee", data.coffee, "Coffee cup, Rachel Michetti, CC0"),
    ("rocket", data.rocket, "Falcon 9 rocket, SpaceX, CC0"),
    ("astronaut", data.astronaut, "Eileen Collins, NASA, public domain"),
]


def main():
    weights = SqueezeNet1_1_Weights.IMAGENET1K_V1
    model = squeezenet1_1(weights=weights).eval()
    export(model, torch.zeros(1, 3, 224, 224), MODELS / "squeezenet.onnx", ["image"], ["logits"])

    out = ROOT / "public" / "samples"
    out.mkdir(parents=True, exist_ok=True)
    credits = []
    for name, load, credit in SAMPLES:
        img = Image.fromarray(load())
        img.thumbnail((360, 360))
        img.save(out / f"{name}.jpg", quality=86, comment=f"origin: scikit-image data module; {credit}".encode())
        credits.append({"file": f"samples/{name}.jpg", "name": name, "credit": credit})
        print(f"saved public/samples/{name}.jpg {img.size}", flush=True)

    write_json(MODELS / "squeezenet-meta.json", {
        "labels": weights.meta["categories"],
        "top1": weights.meta["_metrics"]["ImageNet-1K"]["acc@1"],
        "photos": credits,
    })


if __name__ == "__main__":
    main()
