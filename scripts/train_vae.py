"""A 2-D latent VAE on MNIST for Xaytheon's "Latent" lab.

Only the decoder ships: z [1, 2] -> image [1, 1, 28, 28]. The encoder is used
once here to place 4000 test digits on the latent map the app draws behind
the draggable point.

Usage:  python scripts/train_vae.py
Output: public/models/latent-decoder.onnx, public/models/latent-map.json
"""

import torch
import torch.nn as nn
import torch.nn.functional as F
from torchvision import datasets, transforms

from common import DATA, MODELS, export, write_json


class Encoder(nn.Module):
    def __init__(self):
        super().__init__()
        self.conv1 = nn.Conv2d(1, 32, 4, 2, 1)   # 14
        self.conv2 = nn.Conv2d(32, 64, 4, 2, 1)  # 7
        self.fc = nn.Linear(64 * 7 * 7, 256)
        self.mu = nn.Linear(256, 2)
        self.logvar = nn.Linear(256, 2)

    def forward(self, x):
        h = F.relu(self.conv2(F.relu(self.conv1(x))))
        h = F.relu(self.fc(torch.flatten(h, 1)))
        return self.mu(h), self.logvar(h)


class Decoder(nn.Module):
    def __init__(self):
        super().__init__()
        self.fc1 = nn.Linear(2, 128)
        self.fc2 = nn.Linear(128, 32 * 7 * 7)
        self.up1 = nn.ConvTranspose2d(32, 32, 4, 2, 1)  # 14
        self.up2 = nn.ConvTranspose2d(32, 1, 4, 2, 1)   # 28

    def forward(self, z):
        h = F.relu(self.fc2(F.relu(self.fc1(z))))
        h = F.relu(self.up1(h.view(-1, 32, 7, 7)))
        return torch.sigmoid(self.up2(h))


def main():
    torch.manual_seed(0)
    train = datasets.MNIST(DATA, train=True, download=True, transform=transforms.ToTensor())
    test = datasets.MNIST(DATA, train=False, download=True, transform=transforms.ToTensor())
    loader = torch.utils.data.DataLoader(train, batch_size=128, shuffle=True)
    enc, dec = Encoder(), Decoder()
    opt = torch.optim.Adam([*enc.parameters(), *dec.parameters()], lr=1e-3)
    for epoch in range(20):
        total = 0.0
        for x, _ in loader:
            mu, logvar = enc(x)
            z = mu + torch.randn_like(mu) * torch.exp(0.5 * logvar)
            recon = F.binary_cross_entropy(dec(z), x, reduction="sum")
            kl = -0.5 * torch.sum(1 + logvar - mu.pow(2) - logvar.exp())
            loss = (recon + kl) / len(x)
            opt.zero_grad()
            loss.backward()
            opt.step()
            total += loss.item() * len(x)
        print(f"epoch {epoch + 1}: loss {total / len(train):.2f}", flush=True)

    export(dec, torch.zeros(1, 2), MODELS / "latent-decoder.onnx", ["z"], ["image"])

    enc.eval()
    with torch.no_grad():
        xs = test.data[:4000].unsqueeze(1).float() / 255.0
        mu, _ = enc(xs)
    pts = [[round(a, 3), round(b, 3), int(c)] for (a, b), c in zip(mu.tolist(), test.targets[:4000].tolist())]
    write_json(MODELS / "latent-map.json", {"points": pts})


if __name__ == "__main__":
    main()
