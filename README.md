## What is Xaytheon?

**Xaytheon** is a comprehensive **GitHub analytics and open-source discovery platform** designed to help developers track their contributions, discover trending projects, and explore the open-source ecosystem. It serves as an intelligent layer on top of GitHub, providing enhanced visualization, filtering, and community insights.

---

## 🚀 Run Xaytheon Locally

### Prerequisites

| Tool | Version | Required? | Notes |
|------|---------|-----------|-------|
| **Node.js** | 18+ | ✅ Yes | [Download](https://nodejs.org) |
| **npm** | 9+ | ✅ Yes | Comes with Node.js |
| **Git** | any | ✅ Yes | To clone the repo |
| **Redis** | 7+ | ⬜ Optional | Needed for analytics queue (BullMQ). A Windows binary is included in `redis/` |
| **Docker** | 20+ | ⬜ Optional | Only if you prefer Docker setup |

### Option A — One-Command Setup (Recommended)

Clone the repo and run a single script that installs everything, seeds demo data, and starts the server:

```bash
git clone https://github.com/Saatvik-GT/xaytheon.git
cd xaytheon

# macOS / Linux
bash setup.sh

# Windows
.\setup.bat
```

The script will:
1. Check that Node.js 18+ and npm are installed
2. Install root and backend dependencies
3. Create `backend/.env` from `.env.example`
4. Seed the database with demo data (user, watchlists, analytics, etc.)
5. Start the backend dev server on `http://localhost:5000`

Then open the frontend with **VS Code Live Server** (or any static file server) at `http://127.0.0.1:5500`.

### Option B — Manual Setup

```bash
# 1. Clone & enter the project
git clone https://github.com/Saatvik-GT/xaytheon.git
cd xaytheon

# 2. Install root dependencies
npm install

# 3. Set up the backend
cd backend
npm install

# 4. Create your .env (edit as needed)
cp .env.example .env

# 5. (Optional) Seed demo data for instant dashboards
npm run seed

# 6. Start the backend
npm run dev          # uses nodemon for hot-reload
# or: npm start     # plain node
```

Then open `index.html` in your browser using Live Server or any static server.

### Option C — Docker (includes Redis)

No local Node.js/Redis needed — everything runs in containers.

```bash
git clone https://github.com/Saatvik-GT/xaytheon.git
cd xaytheon

# Create backend .env first
cp backend/.env.example backend/.env

# Build & start all services
docker-compose up --build
```

| Service | URL |
|---------|-----|
| Frontend | [http://localhost:8080](http://localhost:8080) |
| Backend API | [http://localhost:5000](http://localhost:5000) |
| Redis | `localhost:6379` |

### Environment Variables

After setup, edit `backend/.env` to customise your instance:

```env
PORT=5000                              # Backend port
JWT_SECRET=change_me_to_a_random_string # Auth token secret
FRONTEND_URL=http://127.0.0.1:5500     # Frontend origin (CORS)
API_URL=http://127.0.0.1:5000          # Backend origin

# GitHub OAuth (optional — for "Login with GitHub")
GITHUB_CLIENT_ID=
GITHUB_CLIENT_SECRET=
# See SETUP_GITHUB_OAUTH.md for step-by-step instructions
```

> **Tip:** Email variables (`EMAIL_HOST`, `EMAIL_USER`, etc.) are only needed for password-reset emails. You can leave them blank for local development.

### Demo Data & Credentials

Running `npm run seed` (or the setup script) creates a ready-to-use demo account:

| Field | Value |
|-------|-------|
| Email | `demo@xaytheon.dev` |
| Password | `demo1234` |

The seed script also populates:
- 📋 A **"Trending Repos" watchlist** with 5 popular repositories
- 📊 **30 days of analytics snapshots** (stars, followers, commits)
- 🔔 **Sample notifications** (stars, forks, issues, PRs)
- 🏆 **Starter achievements** (Welcome Aboard, Watcher, etc.)

This means dashboards will display meaningful data immediately — no GitHub token required.

### Redis (Optional)

Redis is required for the background analytics queue (BullMQ). If Redis isn't running, the backend still starts — but queued analytics jobs won't process.

**Quick start:**
```bash
# Docker
docker run -d -p 6379:6379 redis

# Windows (included binary)
redis\redis-server.exe
```

---

## Key Features & Pages

### 1. **Home/Landing Page** (index.html)
- **User Authentication System**: Sign-in functionality to personalize the experience
- **Future Features Placeholder**: Indicates ongoing development with promises of "advanced features" for authenticated users
- Central hub connecting to all other sections

### 2. **GitHub Dashboard** (github.html)
**Personal GitHub Analytics Hub**

Features:
- **Profile Overview**: Displays your GitHub username, avatar, and bio
- **Repository Statistics**: 
  - Total public repositories
  - Total private repositories (if accessible)
  - Repository breakdown and metrics
- **Social Metrics**:
  - Follower count
  - Following count
  - Network analysis
- **Contribution Visualization**:
  - Public contributions heatmap (similar to GitHub's contribution graph)
  - Activity patterns and streaks
  - Commit history visualization
  - Fallback rendering if official GitHub data is unavailable

**Purpose**: Gives you a consolidated view of your GitHub presence and activity patterns.

### 3. **Advanced Analytics Dashboard** (analytics.html)
**Historical GitHub Growth Tracking**

Features:
- **Historical Data Tracking**:
  - Automated snapshots of GitHub metrics over time
  - Stores stars, followers, repos, commits, and language distribution
  - Tracks contribution velocity and growth patterns
- **Interactive Visualizations**:
  - Line charts for stars and followers growth
  - Bar charts for commit activity
  - Doughnut charts for language distribution
  - Contribution velocity heatmaps
- **Date Range Filtering**:
  - Custom date range selection
  - Quick filters (7, 30, 90, 365 days)
  - Comparison tools for different time periods
- **Growth Metrics**:
  - Percentage change calculations
  - Growth rate analysis
  - Min/max/average statistics
- **Data Export**:
  - Export analytics in JSON format
  - Export analytics in CSV format
  - Download historical snapshots for external analysis
- **Automated Snapshots**:
  - Scheduled periodic data collection
  - Configurable snapshot intervals
  - Automatic cleanup of old data

**Purpose**: Enables developers to track their GitHub growth over time, understand contribution patterns, and showcase their progress with data-driven insights.

### 4. **Community Highlights** (community.html)
**Trending Repository Discovery Engine**

Features:
- **Real-Time Trending Projects**: See what's gaining traction in the developer community
- **Multi-Dimensional Filtering**:
  
  **Language Filter**:
  - Any language (all)
  - JavaScript
  - TypeScript
  - Python
  - Go
  - Rust
  - Java
  - C#
  - C++
  
  **Topic Filter**: 
  - Custom topic/tag search
  - Domain-specific filtering (AI, web dev, DevOps, etc.)
  
  **Time Window**:
  - Last 7 days (weekly trends)
  - Last 30 days (monthly trends)
  - Last 90 days (quarterly trends)
  
  **Top K Selection**:
  - Control the number of results (top 10, 25, 50, etc.)
  - Customizable result set size

- **Dynamic Updates**: Real-time refresh of trending data
- **Reset Functionality**: Clear all filters to start fresh

**Purpose**: Helps developers stay current with what's hot in the open-source world and discover popular projects in their areas of interest.

### 4. **Explore by Topic** (explore.html)
**Advanced Repository Discovery & Mapping**

Features:
- **Topic-Based Search**:
  - Enter a "Base Topic" to find related repositories
  - Discover projects by keywords, technologies, or domains
  
- **Language Filtering**: Same comprehensive language options as Community Highlights
  
- **Sampling Control**:
  - "Repos to sample" setting
  - Adjustable dataset size for exploration
  
- **Topic Map Visualization**:
  - Interactive visualization showing relationships between topics
  - Network graph connecting topics to repositories
  - Discover related topics and adjacent technologies
  
- **Repository Listing**: 
  - Detailed view of repositories matching your criteria
  - Organized by topic relationships

**Purpose**: Enables deep exploration of the GitHub ecosystem, helping you discover repositories through topic relationships and technology connections.

### 5. **Your Open Source Contributions** (contributions.html)
**Personal Contribution Tracker**

Features:
- **Contribution History**: Track your open-source contributions over time
- **Project Portfolio**: See all projects you've contributed to
- **Impact Metrics**: Measure your influence in the open-source community
- **Authentication Required**: Personal data accessible only when signed in

**Purpose**: Maintains a comprehensive record of your open-source involvement and contributions.

---
## Project Structure

The project follows a modular structure, grouping related files by responsibility to keep the codebase organized and easy to maintain.

```plaintext
xaytheon/
│
├── .github/                 # GitHub configs (issues, workflows)
│
├── assets/                  # Static assets
│   ├── images/
│   ├── icons/
│
├── pages/                   # HTML pages
│   ├── index.html
│   ├── login.html
│   ├── github.html
│   ├── community.html
│   ├── explore.html
│   └── contributions.html
│
├── js/                      # JavaScript logic
│   ├── auth.js
│   ├── script.js
│   ├── github.js
│   ├── community.js
│   ├── explore.js
│   └── contributions.js
│
├── css/                     # Stylesheets
│   └── style.css
│
├── config/                  # Configuration & metadata
│   ├── GithubAPI_info
│   └── supabase.sql
│
├── docs/                    # Documentation
│   ├── CONTRIBUTION.md
│   └── windows_setup_guide.md
│
├── LICENSE.md               # License
├── SECURITY.md              # Security policy
├── README.md                # Project overview
└── package.json (if added later)

```

## Technical Capabilities

### **Data Processing**
- Integrates with GitHub's API to fetch real-time data
- Processes contribution graphs and activity heatmaps
- Analyzes trending patterns across repositories
- Maps topic relationships and repository connections

### **Filtering & Search**
- Multi-parameter filtering (language, topic, time, popularity)
- Dynamic query building
- Real-time result updates
- Configurable result sets

### **Visualization**
- Contribution heatmaps and activity charts
- Topic relationship maps
- Trending graphs and statistics
- Interactive data displays

### **User Management**
- Authentication system for personalized experiences
- User profile integration
- Saved preferences and filters
- Persistent user data

---

## Use Cases

**For Individual Developers:**
- Track personal GitHub activity and contributions
- Discover new projects to contribute to
- Stay updated with trending technologies
- Build a portfolio of open-source work

**For Open Source Contributors:**
- Find projects aligned with their skills and interests
- Identify active, well-maintained repositories
- Connect with trending projects early
- Explore related technologies and adjacent domains

**For Tech Enthusiasts:**
- Monitor what's popular in specific programming languages
- Follow technology trends over time
- Discover emerging tools and frameworks
- Research competitive landscapes

**For Learners:**
- Find beginner-friendly projects
- Explore codebases in their learning language
- Follow industry trends
- Identify popular repositories for learning

---

## Platform Architecture

The platform consists of **6 interconnected pages**:
1. **Home** → Central authentication & navigation hub
2. **GitHub Dashboard** → Personal analytics
3. **Analytics Dashboard** → Historical growth tracking
4. **Community Highlights** → Trending discovery
5. **Explore by Topic** → Deep exploration
6. **Contributions** → Personal tracking

Each page focuses on a specific aspect of the GitHub ecosystem while maintaining seamless navigation between features.

---

## Summary

**Xaytheon** is essentially a **GitHub intelligence and discovery platform** that transforms how developers interact with the open-source ecosystem. It combines personal analytics, community trends, and advanced exploration tools into a unified interface, making it easier to navigate GitHub's vast repository landscape, discover meaningful projects, and track your open-source journey.
