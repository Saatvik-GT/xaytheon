"""Shared helpers for the training/export scripts."""

import base64
import json
from pathlib import Path

import torch
import torch.nn.functional as F

ROOT = Path(__file__).resolve().parent.parent
MODELS = ROOT / "public" / "models"
DATA = ROOT / ".data"


def evaluate(model, loader):
    model.eval()
    correct = total = 0
    with torch.no_grad():
        for x, y in loader:
            correct += (model(x).argmax(1) == y).sum().item()
            total += len(y)
    return correct / total


def train_classifier(model, train_loader, test_loader, epochs, lr=2e-3):
    opt = torch.optim.Adam(model.parameters(), lr=lr)
    sched = torch.optim.lr_scheduler.OneCycleLR(opt, max_lr=lr, total_steps=epochs * len(train_loader))
    acc = 0.0
    for epoch in range(epochs):
        model.train()
        for x, y in train_loader:
            opt.zero_grad()
            F.cross_entropy(model(x), y).backward()
            opt.step()
            sched.step()
        acc = evaluate(model, test_loader)
        print(f"epoch {epoch + 1}: test accuracy {acc:.4f}", flush=True)
    return acc


def export(model, example, path, input_names, output_names, dynamic_axes=None, opset=13):
    path.parent.mkdir(parents=True, exist_ok=True)
    model.eval()
    torch.onnx.export(
        model, example, path,
        input_names=input_names, output_names=output_names,
        dynamic_axes=dynamic_axes, opset_version=opset, dynamo=False,
    )
    print(f"saved {path.relative_to(ROOT)} ({path.stat().st_size / 1024:.1f} KB)", flush=True)


def write_json(path, obj):
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(obj, separators=(",", ":")))
    print(f"saved {path.relative_to(ROOT)} ({path.stat().st_size / 1024:.1f} KB)", flush=True)


def b64_pixels(arr_uint8):
    """28x28 uint8 image -> base64 string (row-major)."""
    return base64.b64encode(arr_uint8.astype("uint8").tobytes()).decode()
