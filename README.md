## Xaytheon

Selected in Social Winter of Code (SWoC)

<img width="1300" height="400" alt="Xaytheon banner" src="https://github.com/user-attachments/assets/6bf856a4-0da4-4505-a433-f54797283dc4" />

This project was selected for Social Winter of Code (SWoC) and is open to community contributions.

Contribution period ended on 1st March. Thank you, everyone.

Please star the repository if you liked it. Thank you!

## What Is Xaytheon?

**Xaytheon** is a GitHub analytics and open-source discovery platform designed to help developers track their contributions, discover trending projects, and explore the open-source ecosystem. It provides enhanced visualization, filtering, and community-focused insights on top of GitHub data.

---

## Run Xaytheon Locally

### Prerequisites

| Tool | Required? | Notes |
|------|-----------|-------|
| Git | Yes | To clone the repository |
| Browser | Yes | Chrome, Edge, Firefox, or another modern browser |
| VS Code Live Server | Recommended | Any static file server also works |

### Setup

```bash
git clone https://github.com/DarshanCodes09/xaytheon.git
cd xaytheon
```

Then open `index.html` in your browser.

For the best local development experience, open the project in VS Code and use the Live Server extension. The site usually runs at:

```text
http://127.0.0.1:5500
```

No npm install, backend server, Redis, or Docker setup is required for the current version of this repository.

---

## Key Features & Pages

### 1. Home/Landing Page (`index.html`)

- Central entry point for the project
- Navigation to the main product pages
- GitHub-focused visual experience

### 2. Login Page (`login.html`)

- Sign-in and account interface
- Client-side authentication flow
- GitHub login option in the UI

### 3. GitHub Dashboard (`github.html`)

- GitHub profile overview
- Repository and social metrics
- Contribution-focused dashboard UI

### 4. Community Highlights (`community.html`)

- Trending repository discovery
- Language, topic, and time-window filtering
- Dynamic repository cards and reset controls

### 5. Explore by Topic (`explore.html`)

- Topic-based repository exploration
- Language and sampling controls
- Topic map and repository listing interface

### 6. Your Open Source Contributions (`contributions.html`)

- Personal contribution tracking UI
- Project portfolio-style view
- Open-source activity and impact sections

---

## Project Structure

The current project is a static frontend application. The main HTML, CSS, and JavaScript files live at the repository root.

```plaintext
xaytheon/
|-- .github/                 # GitHub templates and workflows
|-- assets/                  # Static assets
|   |-- fonts/               # Custom fonts
|   |-- icons/               # Icons and generated app icons
|   |-- logo/                # Logo images
|   |-- models/              # 3D models
|   |-- favicon.svg
|   |-- github.jpeg
|   `-- logo.svg
|-- auth.js                  # Authentication logic
|-- community.html           # Community highlights page
|-- community.js             # Community page logic
|-- contributions.html       # Contributions page
|-- contributions.js         # Contributions page logic
|-- explore.html             # Explore page
|-- explore.js               # Explore page logic
|-- github.html              # GitHub dashboard page
|-- index.html               # Home page
|-- login.html               # Login page
|-- navbar.html              # Shared navigation markup
|-- script.js                # Main site logic
|-- style.css                # Shared styles
|-- LICENSE.md
`-- README.md
```

---

## Technical Capabilities

### Data & Discovery

- Fetches and displays GitHub-oriented data in the frontend
- Highlights repositories, topics, and contribution-related information
- Supports discovery workflows across community and topic pages

### Filtering & Search

- Language, topic, and time-based filtering
- Configurable result counts
- Dynamic UI updates for exploration flows

### Visualization

- Interactive frontend sections
- 3D assets and custom visual design
- Repository and contribution-focused displays

### User Experience

- Multi-page static site architecture
- Shared navigation
- Responsive styling through a central stylesheet

---

## Use Cases

**For individual developers:**

- Track personal GitHub activity and contributions
- Discover projects to explore or contribute to
- Build a portfolio-style view of open-source work

**For open-source contributors:**

- Find projects aligned with their skills and interests
- Identify active repositories
- Explore related technologies and adjacent domains

**For learners:**

- Discover repositories by language or topic
- Explore open-source project examples
- Follow trends in the developer ecosystem

---

## Summary

**Xaytheon** is a GitHub-focused discovery and contribution platform. It combines repository exploration, community highlights, and contribution-oriented pages into a static frontend experience for developers interested in the open-source ecosystem.
