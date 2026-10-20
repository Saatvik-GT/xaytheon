"""Train the tiny MNIST CNN that ships as Xaytheon's demo model.

Usage:  python scripts/train_mnist.py
Output: public/models/mnist-cnn.onnx

The model takes raw [0, 1] pixels (white digit on black, 1x1x28x28) so the
browser can feed canvas pixels straight in without normalisation.
"""

from pathlib import Path

import torch
import torch.nn as nn
import torch.nn.functional as F
from torchvision import datasets, transforms

ROOT = Path(__file__).resolve().parent.parent
OUT = ROOT / "public" / "models" / "mnist-cnn.onnx"
DATA = ROOT / ".data"


class TinyCNN(nn.Module):
    def __init__(self):
        super().__init__()
        self.conv1 = nn.Conv2d(1, 8, 3, padding=1)
        self.conv2 = nn.Conv2d(8, 16, 3, padding=1)
        self.fc1 = nn.Linear(16 * 7 * 7, 64)
        self.fc2 = nn.Linear(64, 10)

    def forward(self, x):
        x = F.max_pool2d(F.relu(self.conv1(x)), 2)
        x = F.max_pool2d(F.relu(self.conv2(x)), 2)
        x = torch.flatten(x, 1)
        x = F.relu(self.fc1(x))
        return self.fc2(x)


def main():
    torch.manual_seed(0)
    # Light augmentation so hand-drawn canvas digits (thicker, off-centre) still work.
    train_tf = transforms.Compose([
        transforms.RandomAffine(degrees=10, translate=(0.12, 0.12), scale=(0.85, 1.15)),
        transforms.ToTensor(),
    ])
    train = datasets.MNIST(DATA, train=True, download=True, transform=train_tf)
    test = datasets.MNIST(DATA, train=False, download=True, transform=transforms.ToTensor())
    train_loader = torch.utils.data.DataLoader(train, batch_size=128, shuffle=True)
    test_loader = torch.utils.data.DataLoader(test, batch_size=1000)

    model = TinyCNN()
    opt = torch.optim.Adam(model.parameters(), lr=2e-3)
    for epoch in range(3):
        model.train()
        for x, y in train_loader:
            opt.zero_grad()
            F.cross_entropy(model(x), y).backward()
            opt.step()
        model.eval()
        correct = 0
        with torch.no_grad():
            for x, y in test_loader:
                correct += (model(x).argmax(1) == y).sum().item()
        print(f"epoch {epoch + 1}: test accuracy {correct / len(test):.4f}")

    OUT.parent.mkdir(parents=True, exist_ok=True)
    torch.onnx.export(
        model,
        torch.zeros(1, 1, 28, 28),
        OUT,
        input_names=["image"],
        output_names=["logits"],
        opset_version=13,
        dynamo=False,
    )
    print(f"saved {OUT} ({OUT.stat().st_size / 1024:.1f} KB)")


if __name__ == "__main__":
    main()
