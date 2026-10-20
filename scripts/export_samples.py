"""Sample digits for the MNIST lab's sample strip (no training).

Usage:  python scripts/export_samples.py
Output: public/models/mnist-samples.json
"""

from torchvision import datasets

from common import DATA, MODELS, b64_pixels, write_json


def main():
    raw = datasets.MNIST(DATA, train=False, download=True)
    picks, per_class = [], {c: 0 for c in range(10)}
    for img, label in zip(raw.data, raw.targets.tolist()):
        if per_class[label] < 2:
            picks.append({"label": label, "pixels": b64_pixels(img.numpy())})
            per_class[label] += 1
        if len(picks) == 20:
            break
    picks.sort(key=lambda p: p["label"])
    write_json(MODELS / "mnist-samples.json", {"labels": [str(i) for i in range(10)], "accuracy": 0.9786, "samples": picks})


if __name__ == "__main__":
    main()
