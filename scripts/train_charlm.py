"""A tiny character-level transformer for Xaytheon's "Bard" lab.

Attention is written out by hand (no fused attention op) so each head's
attention pattern exists as its own tensor in the exported graph:
/blocks.N/attn/Softmax_output_0 with shape [1, heads, T, T]. Cutting a
"channel" of that tensor in the app is head ablation.

Usage:  python scripts/train_charlm.py
Output: public/models/bard-gpt.onnx, public/models/bard-meta.json
"""

import math
import time
import urllib.request

import torch
import torch.nn as nn
import torch.nn.functional as F

from common import DATA, MODELS, export, write_json

URL = "https://raw.githubusercontent.com/karpathy/char-rnn/master/data/tinyshakespeare/input.txt"
CTX, D, HEADS, LAYERS = 64, 96, 4, 3
STEPS, BATCH = 6000, 64


class Attention(nn.Module):
    def __init__(self):
        super().__init__()
        self.qkv = nn.Linear(D, 3 * D)
        self.proj = nn.Linear(D, D)
        self.register_buffer("mask", torch.tril(torch.ones(CTX, CTX)).view(1, 1, CTX, CTX))

    def forward(self, x):
        B, T, _ = x.shape
        q, k, v = self.qkv(x).split(D, dim=2)
        q = q.view(B, T, HEADS, D // HEADS).transpose(1, 2)
        k = k.view(B, T, HEADS, D // HEADS).transpose(1, 2)
        v = v.view(B, T, HEADS, D // HEADS).transpose(1, 2)
        att = (q @ k.transpose(-2, -1)) * (1.0 / math.sqrt(D // HEADS))
        att = att.masked_fill(self.mask[:, :, :T, :T] == 0, float("-inf"))
        att = F.softmax(att, dim=-1)
        y = (att @ v).transpose(1, 2).reshape(B, T, D)
        return self.proj(y)


class Block(nn.Module):
    def __init__(self):
        super().__init__()
        self.ln1 = nn.LayerNorm(D)
        self.attn = Attention()
        self.ln2 = nn.LayerNorm(D)
        self.mlp = nn.Sequential(nn.Linear(D, 4 * D), nn.ReLU(), nn.Linear(4 * D, D))

    def forward(self, x):
        x = x + self.attn(self.ln1(x))
        return x + self.mlp(self.ln2(x))


class TinyGPT(nn.Module):
    def __init__(self, vocab):
        super().__init__()
        self.tok = nn.Embedding(vocab, D)
        self.pos = nn.Embedding(CTX, D)
        self.blocks = nn.ModuleList([Block() for _ in range(LAYERS)])
        self.ln_f = nn.LayerNorm(D)
        self.head = nn.Linear(D, vocab)

    def forward(self, idx):
        T = idx.shape[1]
        pos = torch.arange(T, device=idx.device).unsqueeze(0)
        x = self.tok(idx) + self.pos(pos)
        for b in self.blocks:
            x = b(x)
        return self.head(self.ln_f(x))


def main():
    torch.manual_seed(0)
    cache = DATA / "tinyshakespeare.txt"
    if not cache.exists():
        cache.parent.mkdir(parents=True, exist_ok=True)
        cache.write_bytes(urllib.request.urlopen(URL).read())
    text = cache.read_text()
    chars = sorted(set(text))
    stoi = {c: i for i, c in enumerate(chars)}
    data = torch.tensor([stoi[c] for c in text], dtype=torch.long)
    split = int(len(data) * 0.95)
    train, val = data[:split], data[split:]

    def batch(src):
        ix = torch.randint(len(src) - CTX - 1, (BATCH,))
        return torch.stack([src[i:i + CTX] for i in ix]), torch.stack([src[i + 1:i + CTX + 1] for i in ix])

    model = TinyGPT(len(chars))
    print(f"params: {sum(p.numel() for p in model.parameters()):,}", flush=True)
    opt = torch.optim.AdamW(model.parameters(), lr=3e-3, weight_decay=0.05)
    sched = torch.optim.lr_scheduler.OneCycleLR(opt, max_lr=3e-3, total_steps=STEPS)
    t0 = time.time()
    for step in range(STEPS):
        model.train()
        x, y = batch(train)
        loss = F.cross_entropy(model(x).view(-1, len(chars)), y.view(-1))
        opt.zero_grad()
        loss.backward()
        torch.nn.utils.clip_grad_norm_(model.parameters(), 1.0)
        opt.step()
        sched.step()
        if step % 500 == 0 or step == STEPS - 1:
            model.eval()
            with torch.no_grad():
                vx, vy = batch(val)
                vloss = F.cross_entropy(model(vx).view(-1, len(chars)), vy.view(-1)).item()
            print(f"step {step}: train {loss.item():.3f} val {vloss:.3f} ({time.time() - t0:.0f}s)", flush=True)

    model.eval()
    with torch.no_grad():  # a quick sample so the log shows what it learned
        idx = torch.tensor([[stoi[c] for c in "ROMEO:\n"]])
        for _ in range(120):
            p = F.softmax(model(idx[:, -CTX:])[0, -1] / 0.8, dim=-1)
            idx = torch.cat([idx, torch.multinomial(p, 1).view(1, 1)], dim=1)
        print("".join(chars[i] for i in idx[0].tolist()), flush=True)

    export(
        model, torch.zeros(1, 16, dtype=torch.long), MODELS / "bard-gpt.onnx",
        ["tokens"], ["logits"], dynamic_axes={"tokens": {1: "seq"}, "logits": {1: "seq"}}, opset=17,
    )
    write_json(MODELS / "bard-meta.json", {
        "vocab": chars, "context": CTX, "layers": LAYERS, "heads": HEADS, "dim": D,
        "valLoss": round(vloss, 3), "corpus": "Tiny Shakespeare (Karpathy, char-rnn)",
    })


if __name__ == "__main__":
    main()
