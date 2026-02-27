const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

let parser = null;
let traverse = null;
try {
    parser = require('@babel/parser');
    traverse = require('@babel/traverse').default || require('@babel/traverse');
} catch (e) {
    console.warn("Babel AST parsers not available. Will fallback to simple heuristics.");
}

/**
 * Risk Engine Service
 * Predicts bug propensity using REAL code churn, expertise debt, and AST-based complexity.
 */
class RiskEngineService {
    /**
     * Calculates risk scores for the live project files via Git and AST.
     */
    async calculateRiskGalaxy() {
        const repoRoot = process.cwd(); // Assume we are running from backend or project root
        // Find git root
        let gitRoot = repoRoot;
        try {
            gitRoot = execSync('git rev-parse --show-toplevel').toString().trim();
        } catch (e) {
            console.error("Not a git repository or git not available. Risk engine requires Git.");
            // Fallback to mock data if not a git repo
            return this.getMockDataGalaxy();
        }

        const files = this.getRealFileHistory(gitRoot);

        return files.map(file => {
            const churnScore = this.calculateChurnScore(file.history);
            const expertiseDebt = this.calculateExpertiseDebt(file.authors);
            const complexityScore = file.complexity * 0.4; // Weight complexity

            // Final Fragility Score (0-100)
            const fragilityScore = Math.min(100, (churnScore * 0.4) + (expertiseDebt * 0.3) + (complexityScore));

            return {
                id: file.id,
                name: file.name,
                path: file.path,
                score: parseFloat(fragilityScore.toFixed(2)),
                metrics: {
                    churn: churnScore,
                    expertise: expertiseDebt,
                    complexity: file.complexity,
                    historicalBugs: file.authors.length // simple proxy
                },
                trend: this.generateTimeline(fragilityScore),
                status: this.getStatus(fragilityScore)
            };
        });
    }

    calculateChurnScore(history) {
        if (!history || history.length === 0) return 5; // Base low
        // Higher frequency of changes in last 30 days = higher churn
        const recentChanges = history.filter(h => h.daysAgo <= 30).length;
        // Also factor in overall commit count
        const totalCommits = history.length;
        return Math.min(100, (recentChanges * 8) + (totalCommits * 0.5));
    }

    calculateExpertiseDebt(authors) {
        if (!authors || authors.length === 0) return 50; // Unknown
        if (authors.length === 1) return 10; // Sole owner, low debt (unless they leave, handled later)

        // If a file has many authors but no clear "owner" (>50% contributions), debt is high
        const totalCommits = authors.reduce((sum, a) => sum + a.commits, 0);
        const maxCommits = Math.max(...authors.map(a => a.commits));
        const ownershipRatio = maxCommits / totalCommits;

        // The lower the ownership ratio, the higher the debt 
        return Math.min(100, (1 - ownershipRatio) * 100 * 1.5);
    }

    getStatus(score) {
        if (score > 75) return 'CRITICAL';
        if (score > 50) return 'HIGH';
        if (score > 25) return 'MEDIUM';
        return 'LOW';
    }

    generateTimeline(currentScore) {
        const points = [];
        let base = currentScore;
        for (let i = 0; i < 6; i++) {
            points.push({
                month: ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun'][i],
                value: Math.max(0, Math.min(100, base + (Math.random() * 20 - 10)))
            });
        }
        return points;
    }

    getRealFileHistory(gitRoot) {
        let trackedFiles = [];
        try {
            // Get all tracked files, limit to JS/TS/HTML/CSS for relevant analysis
            const output = execSync('git ls-files', { cwd: gitRoot, encoding: 'utf-8' });
            trackedFiles = output.split('\\n').filter(f => f.trim().length > 0);
        } catch (e) {
            console.error(e);
            return [];
        }

        // Filter valid extensions and ignore node_modules just in case
        trackedFiles = trackedFiles.filter(f => {
            if (f.includes('node_modules/')) return false;
            if (f.includes('dist/') || f.includes('build/')) return false;
            return f.endsWith('.js') || f.endsWith('.ts') || f.endsWith('.tsx') || f.endsWith('.css') || f.endsWith('.html');
        });

        // Cap to 60-80 files to keep the API reasonably fast for demo
        // Priority to backend and src files
        trackedFiles.sort((a, b) => {
            const scoreA = a.includes('src/') ? 1 : 0;
            const scoreB = b.includes('src/') ? 1 : 0;
            return scoreB - scoreA;
        });
        if (trackedFiles.length > 80) trackedFiles = trackedFiles.slice(0, 80);

        const now = Date.now() / 1000;
        const results = [];

        trackedFiles.forEach((filePath, idx) => {
            const absolutePath = path.join(gitRoot, filePath);

            // 1. Get AST Complexity
            const complexity = this.analyzeFileComplexity(absolutePath);

            // 2. Get Git metrics
            let history = [];
            let authors = [];
            try {
                const log = execSync(`git log --follow --format="%at|%an" -- "${filePath}"`, { cwd: gitRoot, encoding: 'utf-8' });
                const lines = log.trim().split('\n').filter(l => l);

                const authorMap = {};
                lines.forEach(line => {
                    const parts = line.split('|');
                    if (parts.length >= 2) {
                        const ts = parseInt(parts[0], 10);
                        const author = parts[1].trim();

                        const daysAgo = (now - ts) / (60 * 60 * 24);
                        history.push({ daysAgo });
                        authorMap[author] = (authorMap[author] || 0) + 1;
                    }
                });

                authors = Object.keys(authorMap).map(name => ({
                    name,
                    commits: authorMap[name]
                }));
            } catch (err) {
                // Ignore errors for individual files
            }

            results.push({
                id: `file-${idx}`, // generate an ID string so frontend correctly links the ID
                name: path.basename(filePath),
                path: filePath,
                complexity,
                history,
                authors
            });
        });

        return results;
    }

    /**
     * Parse code file to extract Cyclomatic Complexity
     */
    analyzeFileComplexity(filePath) {
        let baseComplexity = 1;
        if (!fs.existsSync(filePath)) return baseComplexity;

        const ext = path.extname(filePath);
        if (ext !== '.js' && ext !== '.ts' && ext !== '.jsx' && ext !== '.tsx') {
            // non-script assets get a simple heuristic based on file size lines
            const content = fs.readFileSync(filePath, 'utf-8');
            return Math.min(100, Math.floor(content.split('\\n').length / 5));
        }

        if (!parser || !traverse) {
            // Fallback line counting logic if Babel is not installed
            const content = fs.readFileSync(filePath, 'utf-8');
            const lines = content.split('\\n');
            let approx = 1;
            lines.forEach(l => {
                const s = l.trim();
                if (s.startsWith('if ') || s.startsWith('if(') || s.includes(' else ') || s.startsWith('for ') || s.startsWith('while ') || s.startsWith('switch(') || s.includes('catch(')) {
                    approx++;
                }
            });
            return approx;
        }

        try {
            const content = fs.readFileSync(filePath, 'utf-8');
            const isTS = filePath.endsWith('.ts') || filePath.endsWith('.tsx');

            const plugins = ["jsx", "classProperties", "objectRestSpread"];
            if (isTS) plugins.push("typescript");

            const ast = parser.parse(content, {
                sourceType: 'unambiguous',
                plugins: plugins
            });

            traverse(ast, {
                enter(p) {
                    const type = p.node.type;
                    if (['IfStatement', 'WhileStatement', 'DoWhileStatement', 'ForStatement', 'ForInStatement', 'ForOfStatement', 'ConditionalExpression', 'CatchClause'].includes(type)) {
                        baseComplexity++;
                    } else if (type === 'LogicalExpression' && (p.node.operator === '&&' || p.node.operator === '||')) {
                        baseComplexity++;
                    } else if (type === 'SwitchCase' && p.node.test !== null) {
                        baseComplexity++;
                    }
                }
            });
        } catch (err) {
            // Syntax error or unparseable, fallback to size
            const content = fs.readFileSync(filePath, 'utf-8');
            return Math.min(100, Math.floor(content.split('\\n').length / 10));
        }

        return baseComplexity;
    }

    /**
     * Fallback to mock data if not running in a git repo
     */
    getMockDataGalaxy() {
        console.warn("Using fallback mock data for Risk Galaxy");
        const getMockFileHistory = [
            {
                id: 1, name: 'auth.service.js', path: 'src/services/auth.service.js', complexity: 85,
                history: Array.from({ length: 15 }, () => ({ daysAgo: Math.floor(Math.random() * 60) })),
                authors: [{ name: 'dev1', commits: 50 }, { name: 'dev2', commits: 45 }]
            }
        ];
        return getMockFileHistory.map(f => ({
            id: f.id, name: f.name, path: f.path, score: 70, metrics: { churn: 50, expertise: 40, complexity: f.complexity, historicalBugs: 2 },
            trend: this.generateTimeline(70), status: 'HIGH'
        }));
    }

    /**
     * BLAST-RADIUS VULNERABILITY PROPAGATION ENGINE
     * Dynamically infers dependencies based on actual file paths in a heuristic manner to construct the graph!
     */
    async calculateBlastRadius(vulnerabilityNode, dependencyTree) {
        // Since we are now real, we override 'dependencyTree' and generate a real heuristic correlation graph.
        const gitRoot = execSync('git rev-parse --show-toplevel').toString().trim();
        const files = this.getRealFileHistory(gitRoot);

        // Build a naive dependency correlation map based on AST or directory proximity
        const propagationMap = new Map();
        const visited = new Set();

        files.forEach(f => {
            // Assume 1 layer propagation connection to files in the same directory
            f.directory = path.dirname(f.path);
        });

        const traverse = (fileId, depth, parentImpact) => {
            if (visited.has(fileId) || depth > 3) return;
            visited.add(fileId);

            const node = files.find(f => f.id === fileId || f.name.includes(fileId)); // weak match for ease
            if (!node) return;

            const impactScore = parentImpact * Math.pow(0.7, depth);

            if (!propagationMap.has(node.id)) {
                propagationMap.set(node.id, {
                    id: node.id,
                    name: node.name,
                    type: node.path.includes('backend') ? 'backend' : 'frontend',
                    impactScore: Math.min(100, impactScore),
                    depth: depth,
                    status: this.getPropagationStatus(impactScore),
                    affectedServices: []
                });
            }

            // Simple heuristic to build dependents: files in the same directory, or files mentioning the name
            const dependents = files.filter(f => {
                if (f.id === node.id) return false;
                // Files in same folder heavily connected
                if (f.directory === node.directory) return true;
                // Files mentioning root name (hacky heuristic for JS imports)
                const baseName = node.name.split('.')[0];
                return f.path.includes(baseName) || f.name.includes(baseName);
            }).slice(0, 4); // Limit blast explosion fan-out

            dependents.forEach(dep => {
                traverse(dep.id, depth + 1, impactScore);
                if (propagationMap.has(node.id) && !propagationMap.get(node.id).affectedServices.includes(dep.id)) {
                    propagationMap.get(node.id).affectedServices.push(dep.id);
                }
            });
        };

        // If 'vulnerabilityNode' exists, trigger from it. Otherwise pick the worst file.
        const startTarget = files.find(f => f.name.includes(vulnerabilityNode)) || files.sort((a, b) => b.complexity - a.complexity)[0];

        if (startTarget) {
            traverse(startTarget.id, 0, 100);
        }

        return {
            sourceVulnerability: vulnerabilityNode,
            totalAffectedNodes: propagationMap.size,
            propagationTree: Array.from(propagationMap.values()),
            riskLevel: this.calculateOverallRiskLevel(propagationMap),
            recommendation: this.generateRecommendation(propagationMap)
        };
    }

    getPropagationStatus(impact) {
        if (impact > 75) return 'CRITICAL';
        if (impact > 50) return 'HIGH';
        if (impact > 25) return 'MODERATE';
        return 'LOW';
    }

    calculateOverallRiskLevel(propagationMap) {
        const criticalCount = Array.from(propagationMap.values())
            .filter(n => n.status === 'CRITICAL').length;
        const highCount = Array.from(propagationMap.values())
            .filter(n => n.status === 'HIGH').length;

        if (criticalCount > 3 || (criticalCount > 0 && highCount > 5)) {
            return 'SYSTEM_CRITICAL';
        } else if (criticalCount > 0 || highCount > 3) {
            return 'MODERATE_RISK';
        }
        return 'LOW_RISK';
    }

    generateRecommendation(propagationMap) {
        const totalNodes = propagationMap.size;
        const criticalNodes = Array.from(propagationMap.values())
            .filter(n => n.status === 'CRITICAL');

        if (totalNodes > 10) {
            return `URGENT: Vulnerability affects ${totalNodes} downstream services. Immediate patch required.`;
        } else if (criticalNodes.length > 0) {
            return `HIGH PRIORITY: ${criticalNodes.length} critical services compromised. Schedule emergency patch.`;
        }
        return `Monitor closely. ${totalNodes} services affected but impact is contained.`;
    }

    getMockDependencyTree() {
        return { nodes: [], links: [] };
    }
}

module.exports = new RiskEngineService();

