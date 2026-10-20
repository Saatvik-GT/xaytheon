# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

- **ML engineers debugging (primary):** people inspecting their own exported models. They look for dead units and odd activations, try to understand what a layer is doing, and run ablation tests before they trust a model.
- **ML students and learners:** people building intuition for how networks work by poking at them: drawing inputs, cutting neurons and watching what changes.
- **Educators:** people using it live in a classroom or a talk to explain CNNs and transformers, often on a projector.
- **Recruiters and portfolio visitors:** people who arrive from a GitHub link or résumé and decide within about 30 seconds whether the work is impressive.

## Product Purpose

Xaytheon is an X-ray for neural networks. You load an ONNX model in the browser, give it an input, and see every intermediate activation from that one forward pass. Then you do surgery: cut channels, neurons, hidden dimensions or attention heads, and watch the prediction change and the damage spread through the layers below the cut. Success means a person can explain what a specific part of a model does, because they watched it work and watched it break.

## Positioning

Netron and similar viewers show a model's structure, not its behaviour. Interpretability tooling mostly lives in research notebooks. Xaytheon rewrites the model graph in the browser so that a single run returns every activation, and it splices in masks for live ablation. You get behaviour and cause-and-effect for any ONNX model, with no server, no Python and no upload.

## Operating Context

- Engineers on a laptop browser with their own exported `.onnx` files.
- Students exploring the built-in models.
- Educators presenting on a projector.
- Visitors opening a GitHub Pages link, often on a phone.

## Capabilities and Constraints

- **100% in the browser:** no backend, no uploads, nothing stored. Inference runs on the user's device via onnxruntime-web (WASM).
- **Bring your own model:** any `.onnx` file can be opened or dropped onto the page, not just the built-in ones.
- **Free static hosting on GitHub Pages:** the total download stays reasonable, with each built-in model under a few MB.
- **Full functionality on phones**, including touch drawing and cutting units, not just a desktop tool that technically loads.

Built-in models:
- MNIST digit CNN. Ships today, 97.9% test accuracy, trained by `scripts/train_mnist.py`.
- A real pretrained ImageNet classifier (small: MobileNet or SqueezeNet class) with 1000-class predictions and real feature maps.
- A tiny character-level transformer language model trained in this repo: type text, see attention heads and next-token predictions, ablate heads.
- A latent-space explorer: a small autoencoder trained in this repo. Drag a point through a 2D latent space and watch the decoder draw.
- More doodle classifiers: Fashion-MNIST and a quick-draw style sketch model.

Mechanism terminology: activations, layers/ops, channels/neurons/hidden dims/heads, "cut" or "surgery" (ablation), "blast radius" (relative L2 drift downstream of a cut).

## Brand Commitments

- The name is **Xaytheon**.
- The user pinned https://vgpu.sh/ (a glass prism on black splitting a white beam) as the starting reference. They later asked (2026-10-20) that the prism and the frontend look original rather than copied from it. Xaytheon's prism must stay its own: a laminated block you steer by hand, splitting an emission spectrum into discrete lines, with no continuous rainbow and no vgpu-style hero tabs.

## Evidence on Hand

- `public/models/mnist-cnn.onnx` (97.9% MNIST test accuracy).
- The working engine: graph instrumentation, mask-based ablation and drift measurement.

There are no users, testimonials, benchmarks or press yet; do not fabricate any.

## Product Principles

1. **Behaviour over diagrams.** Show the model running on a real input, never a static picture of it.
2. **Cause and effect, visibly.** Every cut shows its consequence, both in the prediction and downstream through the layers.
3. **Local and private by construction.** Nothing leaves the device; this is architecture, not a setting.
4. **Any model, not just the demos.** Built-in models teach and impress, but the tool must work on the user's own model.
5. **Numbers engineers can trust.** Exact values, shapes and stats stay one glance away from every visual.

## Accessibility & Inclusion

Must be fully usable on touch devices: drawing, selecting layers and cutting units. Readability on projectors matters for educators.
