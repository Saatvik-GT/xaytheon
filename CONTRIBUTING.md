# Contributing to XAYTHEON

Thank you for your interest in contributing to XAYTHEON! We appreciate your help in building a collaborative, visual dashboard for GitHub metrics and community highlights.

Please take a moment to review this guide to ensure a smooth and productive contribution process.

---

## Code of Conduct

By participating in this project, you agree to abide by our Code of Conduct (detailed in [CODE_OF_CONDUCT.md](CODE_OF_CONDUCT.md) or standard community behaviors: respect, empathy, and professional collaboration).

---

## How Can I Contribute?

### 1. Reporting Bugs
- Check the issues tab to ensure the bug hasn't been reported yet.
- Open a new bug report using the standard template.
- Include clear steps to reproduce, actual vs. expected behavior, and console errors.

### 2. Suggesting Enhancements
- If you have an idea for a new feature or improvement, open a feature request.
- Describe the utility, design ideas, and target audience.

### 3. Submitting Code Changes
- Before starting work on an issue, verify it has been assigned to you.
- Always create a dedicated branch for your work. Never work directly on `main` or `master`.

---

## Local Setup

XAYTHEON is a static web application built with vanilla HTML, CSS, and JavaScript.

### Prerequisites
- A modern web browser.
- Git installed on your system.
- Node.js (optional, but useful for hosting a local development server).

### Steps
1. Fork the repository on GitHub.
2. Clone your fork locally:
   ```bash
   git clone https://github.com/YOUR_USERNAME/xaytheon.git
   cd xaytheon
   ```
3. Start a local server:
   - If you have Python: `python -m http.server 8000`
   - If you have Node.js: `npx serve .` or use VS Code's Live Server extension.
4. Open the local address (e.g., `http://localhost:8000`) in your browser.

---

## Branching Guidelines

We follow a clean branching convention. Branch names should be lowercase, hyphen-separated, and prefix-driven:

- **Bug fixes**: `bugfix/issue-description`
- **Features**: `feat/feature-name`
- **Documentation**: `docs/update-description`
- **Security**: `security/fix-description`
- **CI/CD**: `ci/workflow-name`

Example: `bugfix/responsive-sticky-header-hamburger`

---

## Commit Message Style

Commit messages should be clear, professional, and explain the *what* and *why* instead of just *how*. We use prefix prefixes:

- `feat:` for new user-facing features (e.g., `feat: add custom 404 page with navigation back to home`)
- `fix:` for bug fixes (e.g., `fix: replace hardcoded colors with CSS variables for dark mode`)
- `docs:` for documentation updates (e.g., `docs: add contributing guide with setup instructions`)
- `style:` for changes that do not affect code logic (whitespace, formatting)
- `refactor:` for code changes that neither fix a bug nor add a feature
- `ci:` for GitHub workflows or configuration files

---

## Pull Request Process

1. Keep PRs small, focused, and single-purpose.
2. Fill out the Pull Request template entirely.
3. Link the PR to the relevant issue using standard GitHub keywords (e.g., `Closes #12`).
4. Ensure no unrelated changes are included in your commits.
5. Verify your code doesn't produce console warnings/errors and validates visually in both light and dark modes.
