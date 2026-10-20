"""Quick, Draw! sketch classifier for Xaytheon's "Doodles" lab.

Downloads only the first N bitmaps of each category (HTTP range requests on the
public Quick, Draw! numpy_bitmap files, CC BY 4.0, Google), then trains a CNN.

Usage:  python scripts/train_doodles.py
Output: public/models/doodle-cnn.onnx, public/models/doodle-meta.json
"""

import urllib.request

import numpy as np
import torch
import torch.nn as nn
import torch.nn.functional as F
from torchvision import transforms

from common import DATA, MODELS, b64_pixels, export, train_classifier, write_json

CATEGORIES = ["airplane", "bicycle", "cat", "clock", "fish", "house", "star", "tree", "umbrella", "envelope"]
PER_CLASS = 12000
URL = "https://storage.googleapis.com/quickdraw_dataset/full/numpy_bitmap/{}.npy"


def fetch(name):
    cache = DATA / "quickdraw" / f"{name}.u8"
    if cache.exists():
        return np.frombuffer(cache.read_bytes(), dtype=np.uint8).reshape(-1, 784)
    # .npy v1 header: 6 magic + 2 version + 2 header-len + header; data follows.
    want = 4096 + PER_CLASS * 784
    req = urllib.request.Request(URL.format(name), headers={"Range": f"bytes=0-{want - 1}"})
    blob = urllib.request.urlopen(req).read()
    assert blob[:6] == b"\x93NUMPY", "not an .npy file"
    hlen = int.from_bytes(blob[8:10], "little")
    start = 10 + hlen
    arr = np.frombuffer(blob[start:start + PER_CLASS * 784], dtype=np.uint8).reshape(-1, 784)
    cache.parent.mkdir(parents=True, exist_ok=True)
    cache.write_bytes(arr.tobytes())
    print(f"  {name}: {len(arr)} drawings", flush=True)
    return arr


class Doodles(torch.utils.data.Dataset):
    def __init__(self, x, y, tf):
        self.x, self.y, self.tf = x, y, tf

    def __len__(self):
        return len(self.y)

    def __getitem__(self, i):
        img = torch.from_numpy(self.x[i].reshape(1, 28, 28).astype(np.float32) / 255.0)
        return (self.tf(img) if self.tf else img), int(self.y[i])


class DoodleCNN(nn.Module):
    def __init__(self, n):
        super().__init__()
        self.conv1 = nn.Conv2d(1, 16, 3, padding=1)
        self.conv2 = nn.Conv2d(16, 32, 3, padding=1)
        self.conv3 = nn.Conv2d(32, 64, 3, padding=1)
        self.fc1 = nn.Linear(64 * 3 * 3, 128)
        self.fc2 = nn.Linear(128, n)

    def forward(self, x):
        x = F.max_pool2d(F.relu(self.conv1(x)), 2)  # 14
        x = F.max_pool2d(F.relu(self.conv2(x)), 2)  # 7
        x = F.max_pool2d(F.relu(self.conv3(x)), 2)  # 3
        x = torch.flatten(x, 1)
        x = F.relu(self.fc1(x))
        return self.fc2(x)


def main():
    torch.manual_seed(0)
    print("downloading Quick, Draw! bitmaps", flush=True)
    xs, ys = [], []
    for i, name in enumerate(CATEGORIES):
        a = fetch(name)
        xs.append(a)
        ys.append(np.full(len(a), i))
    x, y = np.concatenate(xs), np.concatenate(ys)
    perm = np.random.default_rng(0).permutation(len(y))
    x, y = x[perm], y[perm]
    split = int(len(y) * 0.9)
    aug = transforms.RandomAffine(degrees=8, translate=(0.08, 0.08), scale=(0.85, 1.05))
    train = Doodles(x[:split], y[:split], aug)
    test = Doodles(x[split:], y[split:], None)
    model = DoodleCNN(len(CATEGORIES))
    acc = train_classifier(
        model,
        torch.utils.data.DataLoader(train, batch_size=128, shuffle=True),
        torch.utils.data.DataLoader(test, batch_size=1000),
        epochs=6,
    )
    export(model, torch.zeros(1, 1, 28, 28), MODELS / "doodle-cnn.onnx", ["image"], ["logits"])
    picks, seen = [], {c: 0 for c in range(len(CATEGORIES))}
    for img, label in zip(x[split:], y[split:].tolist()):
        if seen[label] < 2:
            picks.append({"label": label, "pixels": b64_pixels(img.reshape(28, 28))})
            seen[label] += 1
    picks.sort(key=lambda p: p["label"])
    write_json(MODELS / "doodle-meta.json", {
        "labels": CATEGORIES, "accuracy": round(acc, 4), "samples": picks,
        "credit": "Quick, Draw! dataset, Google, CC BY 4.0",
    })


if __name__ == "__main__":
    main()
