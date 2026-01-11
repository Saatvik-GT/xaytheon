## Xaytheon 
Selected in Social Winter of Code (SWoC)
<img width="1300" height="400" alt="image" src="https://github.com/user-attachments/assets/6bf856a4-0da4-4505-a433-f54797283dc4" />

This project has been selected for Social Winter of Code (SWoC), and is actively open to community contributions.
Before contributing, please read CONTRIBUTION.md carefully.

⭐ Please Star the Repository if you liked it, thank you! ⭐

## What is Xaytheon?

**Xaytheon** is a comprehensive **GitHub analytics and open-source discovery platform** designed to help developers track their contributions, discover trending projects, and explore the open-source ecosystem. It serves as an intelligent layer on top of GitHub, providing enhanced visualization, filtering, and community insights.

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

### 3. **Community Highlights** (community.html)
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
## How to Run Locally

1. Clone the repository
   ```bash
   git clone https://github.com/Saatvik-GT/xaytheon.git


## Platform Architecture

The platform consists of **5 interconnected pages**:
1. **Home** → Central authentication & navigation hub
2. **GitHub Dashboard** → Personal analytics
3. **Community Highlights** → Trending discovery
4. **Explore by Topic** → Deep exploration
5. **Contributions** → Personal tracking

Each page focuses on a specific aspect of the GitHub ecosystem while maintaining seamless navigation between features.

---

## Summary

**Xaytheon** is essentially a **GitHub intelligence and discovery platform** that transforms how developers interact with the open-source ecosystem. It combines personal analytics, community trends, and advanced exploration tools into a unified interface, making it easier to navigate GitHub's vast repository landscape, discover meaningful projects, and track your open-source journey.
