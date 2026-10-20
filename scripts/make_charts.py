"""Training and model charts for the README, drawn from the real training logs.

Usage:  python scripts/make_charts.py
Output: docs/charts/*.png
"""

import re
from pathlib import Path

import matplotlib

matplotlib.use("Agg")
import matplotlib.pyplot as plt  # noqa: E402

from common import DATA, ROOT  # noqa: E402

OUT = ROOT / "docs" / "charts"
BG, FG, MUTED, GRID = "#000000", "#ededed", "#8a8a8a", "#1f1f1f"
# Layer colours from the spectrum (red input to violet output), as in the app.
RED, ORANGE, YELLOW, GREEN, CYAN, BLUE, VIOLET = "#ff3b30", "#ff9f0a", "#ffd60a", "#34c759", "#00c8ff", "#3157ff", "#9d5cff"

# Per-epoch test accuracy, copied from the training output of each script.
CLASSIFIERS = {
    "Digits (MNIST CNN)": (RED, [0.9568, 0.9714, 0.9786]),
    "Doodles (Quick, Draw!)": (CYAN, [0.9143, 0.9488, 0.9568, 0.9645, 0.9659, 0.9673]),
    "Wardrobe (Fashion-MNIST)": (VIOLET, [0.7814, 0.8543, 0.8807, 0.8854, 0.8971, 0.8972]),
}


def style(ax, title, xlabel, ylabel):
    ax.set_facecolor(BG)
    ax.set_title(title, color=FG, loc="left", fontsize=13, pad=14)
    ax.set_xlabel(xlabel, color=MUTED, fontsize=10)
    ax.set_ylabel(ylabel, color=MUTED, fontsize=10)
    ax.tick_params(colors=MUTED, labelsize=9)
    for s in ax.spines.values():
        s.set_color(GRID)
    ax.grid(True, color=GRID, linewidth=0.8)
    ax.set_axisbelow(True)


def save(fig, name):
    OUT.mkdir(parents=True, exist_ok=True)
    fig.savefig(OUT / name, dpi=160, facecolor=BG, bbox_inches="tight")
    plt.close(fig)
    print(f"saved docs/charts/{name}")


def accuracy_chart():
    fig, ax = plt.subplots(figsize=(8, 4.2), facecolor=BG)
    for name, (color, accs) in CLASSIFIERS.items():
        ax.plot(range(1, len(accs) + 1), [a * 100 for a in accs], marker="o", color=color, linewidth=2, label=name)
        ax.annotate(f"{accs[-1] * 100:.1f}%", (len(accs), accs[-1] * 100), textcoords="offset points", xytext=(8, -3), color=color, fontsize=9)
    style(ax, "Test accuracy per epoch", "epoch", "test accuracy (%)")
    ax.set_xticks(range(1, 7))
    leg = ax.legend(facecolor=BG, edgecolor=GRID, labelcolor=FG, fontsize=9, loc="lower right")
    save(fig, "accuracy.png")


def transformer_chart():
    steps, train, val = [], [], []
    for line in (DATA / "charlm.log").read_text().splitlines():
        m = re.match(r"step (\d+): train ([\d.]+) val ([\d.]+)", line)
        if m:
            steps.append(int(m.group(1)))
            train.append(float(m.group(2)))
            val.append(float(m.group(3)))
    fig, ax = plt.subplots(figsize=(8, 4.2), facecolor=BG)
    ax.plot(steps, train, color=GREEN, linewidth=2, label="train loss")
    ax.plot(steps, val, color=YELLOW, linewidth=2, label="validation loss")
    style(ax, "Character transformer: loss (Tiny Shakespeare)", "training step", "cross-entropy (nats per character)")
    leg = ax.legend(facecolor=BG, edgecolor=GRID, labelcolor=FG, fontsize=9)
    save(fig, "transformer-loss.png")


def vae_chart():
    epochs, loss = [], []
    for line in (DATA / "vae.log").read_text().splitlines():
        m = re.match(r"epoch (\d+): loss ([\d.]+)", line)
        if m:
            epochs.append(int(m.group(1)))
            loss.append(float(m.group(2)))
    fig, ax = plt.subplots(figsize=(8, 4.2), facecolor=BG)
    ax.plot(epochs, loss, color=BLUE, linewidth=2)
    ax.fill_between(epochs, loss, min(loss) - 5, color=BLUE, alpha=0.12)
    style(ax, "Latent VAE: negative ELBO per image (MNIST)", "epoch", "loss per image")
    save(fig, "vae-loss.png")


def size_chart():
    models = [
        ("Digits", 52138, 205),
        ("Doodles", 98442, 386),
        ("Wardrobe", 156394, 612),
        ("Latent", 219585, 859),
        ("Bard", 358497, 1432),
        ("Vision", 1235496, 4842),
    ]
    colors = [RED, CYAN, VIOLET, BLUE, GREEN, ORANGE]
    fig, ax = plt.subplots(figsize=(8, 4.2), facecolor=BG)
    names = [m[0] for m in models]
    params = [m[1] for m in models]
    bars = ax.barh(names, params, color=colors)
    ax.set_xscale("log")
    for bar, (_, p, kb) in zip(bars, models):
        ax.text(bar.get_width() * 1.15, bar.get_y() + bar.get_height() / 2, f"{p:,} params · {kb / 1024:.1f} MB" if kb >= 1024 else f"{p:,} params · {kb} KB",
                va="center", color=FG, fontsize=9)
    ax.set_xlim(20000, 40_000_000)
    style(ax, "Built-in models: size (log scale)", "parameters", "")
    ax.invert_yaxis()
    ax.grid(axis="y", visible=False)
    save(fig, "model-sizes.png")


if __name__ == "__main__":
    accuracy_chart()
    transformer_chart()
    vae_chart()
    size_chart()
