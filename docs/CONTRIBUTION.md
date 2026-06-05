# Contributing to Xaytheon

Welcome! We are excited that you want to contribute to Xaytheon. Please take a moment to review this guide to make the contribution process smooth and successful.

## 🚀 Branch Naming Conventions

To keep our repository organized, please use clean, descriptive branch prefixes:

- `feat/` — for new features (e.g., `feat/loading-skeleton-ui`)
- `fix/` — for bug fixes (e.g., `fix/navbar-mobile-overflow`)
- `docs/` — for documentation updates (e.g., `docs/improve-setup-guide`)
- `style/` — for UI alignment and CSS touch-ups
- `perf/` — for performance optimizations
- `accessibility/` — for screen reader and keyboard focus optimizations

## 📝 Commit Message Guidelines

Write meaningful, professional commit messages. We recommend using structured prefixes:

- `feat: add loading skeleton placeholder to dashboard`
- `fix: resolve mobile navigation wrap on narrow viewports`
- `docs: add local environment setup requirements`
- `style: adjust button contrast in dark mode`

*Avoid generic commit messages like "updated file", "fixed bug", or "commit".*

## 🔗 Pull Request Flow

1. **Sync main** before starting any new branch:
   ```bash
   git checkout main
   git pull origin main
   ```
2. **Create isolated branch** focusing on exactly one problem:
   ```bash
   git checkout -b feat/your-improvement-name
   ```
3. **Verify locally** that the project builds and runs without console errors.
4. **Submit Pull Request** using the provided PR template. Check all relevant boxes and include visual proof (screenshots) if the UI changed.
