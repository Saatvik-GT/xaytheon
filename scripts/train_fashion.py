"""Fashion-MNIST CNN for Xaytheon's "Wardrobe" lab.

Usage:  python scripts/train_fashion.py
Output: public/models/fashion-cnn.onnx, public/models/fashion-samples.json
"""

import torch
import torch.nn as nn
import torch.nn.functional as F
from torchvision import datasets, transforms

from common import DATA, MODELS, b64_pixels, export, train_classifier, write_json

CLASSES = ["T-shirt", "Trouser", "Pullover", "Dress", "Coat", "Sandal", "Shirt", "Sneaker", "Bag", "Ankle boot"]


class FashionCNN(nn.Module):
    def __init__(self):
        super().__init__()
        self.conv1 = nn.Conv2d(1, 16, 3, padding=1)
        self.conv2 = nn.Conv2d(16, 32, 3, padding=1)
        self.fc1 = nn.Linear(32 * 7 * 7, 96)
        self.fc2 = nn.Linear(96, 10)

    def forward(self, x):
        x = F.max_pool2d(F.relu(self.conv1(x)), 2)
        x = F.max_pool2d(F.relu(self.conv2(x)), 2)
        x = torch.flatten(x, 1)
        x = F.relu(self.fc1(x))
        return self.fc2(x)


def main():
    torch.manual_seed(0)
    aug = transforms.Compose([transforms.RandomHorizontalFlip(), transforms.RandomAffine(0, translate=(0.06, 0.06)), transforms.ToTensor()])
    train = datasets.FashionMNIST(DATA, train=True, download=True, transform=aug)
    test = datasets.FashionMNIST(DATA, train=False, download=True, transform=transforms.ToTensor())
    model = FashionCNN()
    acc = train_classifier(
        model,
        torch.utils.data.DataLoader(train, batch_size=128, shuffle=True),
        torch.utils.data.DataLoader(test, batch_size=1000),
        epochs=6,
    )
    export(model, torch.zeros(1, 1, 28, 28), MODELS / "fashion-cnn.onnx", ["image"], ["logits"])

    raw = datasets.FashionMNIST(DATA, train=False, download=True)
    picks, per_class = [], {c: 0 for c in range(10)}
    for img, label in zip(raw.data, raw.targets.tolist()):
        if per_class[label] < 3:
            picks.append({"label": label, "pixels": b64_pixels(img.numpy())})
            per_class[label] += 1
        if len(picks) == 30:
            break
    picks.sort(key=lambda p: p["label"])
    write_json(MODELS / "fashion-samples.json", {"labels": CLASSES, "accuracy": round(acc, 4), "samples": picks})


if __name__ == "__main__":
    main()
