# Xaytheon Architecture Overview

This document describes the architectural layout, technology stack, and data management mechanisms utilized in Xaytheon.

## 🏗️ Technology Stack

Xaytheon is built as a static client-side web application designed to run with maximum performance and minimal infrastructure overhead:

- **Core**: Vanilla HTML5 and Javascript (ES6).
- **Styling**: Vanilla CSS3 layout system with responsive flex/grid viewports.
- **3D Graphics**: Three.js (WebGL renderer) for rendering interactive background shapes.
- **Data Visualization**: D3.js for drawing topic mapping graphs and relationship links.
- **Backend-as-a-Service (BaaS)**: Supabase authentication client for handling secure user registration, magic link delivery, and session management.

## 📂 Project Structure

```plaintext
xaytheon/
│
├── .github/                 # CI/CD Workflows & Issue/PR Templates
├── assets/                  # Fonts, static logos, and 3D models
├── docs/                    # Architectural and Contribution guides
├── auth.js                  # Supabase auth SDK connector and navbar rendering
├── script.js                # Three.js 3D canvas and GitHub API dashboard logic
├── community.js             # Trending repos search logic (GitHub API)
├── explore.js               # Topic relationships logic (D3.js integration)
├── contributions.js         # LocalStorage contribution portfolio tracking
├── toast.js                 # Reusable toast feedback notification service
└── style.css                # Centralized stylesheet (with support for Dark Mode)
```

## 🔄 Data Flow & Caching

1. **GitHub API Integrations**: Calls to the GitHub API are performed client-side using `fetch`.
2. **Caching Strategy**: API response payloads for trending projects are cached in memory (inside `searchCache`) with a 5-minute expiration window to prevent reaching GitHub API rate limits.
3. **Contributions**: Contribution records are saved securely inside browser `localStorage` under the key `xaytheon:contributions`, offering persistency without database server roundtrips.
