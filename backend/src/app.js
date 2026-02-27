const express = require("express");
const cors = require("cors");
const cookieParser = require("cookie-parser");
require("dotenv").config();

const loadingMiddleware = require("./middleware/loading.middleware");
const requestLock = require("./middleware/requestLock.middleware");
const gatewayMiddleware = require("./middleware/gateway.middleware");

const authRoutes = require("./routes/auth.routes");
const userRoutes = require("./routes/user.routes");
const watchlistRoutes = require("./routes/watchlist.routes");
const notificationRoutes = require("./routes/notification.routes");
const analyticsRoutes = require("./routes/analytics.routes");
const achievementsRoutes = require("./routes/achievements.routes");
const pushRoutes = require("./routes/push.routes");
const compareRoutes = require("./routes/compare.routes");
const releaseRoutes = require("./routes/release.routes");
const searchRoutes = require("./routes/search.routes");
const collabRoutes = require("./routes/collab.routes");
const heatmapRoutes = require("./routes/heatmap.routes");
const sentimentRoutes = require("./routes/sentiment.routes");
const workflowRoutes = require("./routes/workflow.routes");
const dependencyRoutes = require("./routes/dependency.routes");
const aiRoutes = require("./routes/ai.routes");
const riskRoutes = require("./routes/risk.routes");
const analyzerRoutes = require("./routes/analyzer.routes");
const archDriftRoutes = require("./routes/arch-drift.routes");
const brainRoutes = require("./routes/brain.routes");
const bundleRoutes = require("./routes/bundle.routes");
const testLabRoutes = require("./routes/test-lab.routes");
const archaeologyRoutes = require("./routes/code-archaeology.routes");
const refactorRoutes = require("./routes/refactor-safety.routes");
const sprintRoutes = require("./routes/sprint.routes");
const sprintForecasterRoutes = require("./routes/sprint-forecaster.routes");
const securityRoutes = require("./routes/security.routes");
const auditRoutes = require("./routes/audit.routes");
const govRoutes = require("./routes/governance.routes");

const app = express();

/* ========================
   CORS CONFIG
======================== */
const corsOptions = {
  origin: (origin, callback) => {
    // Allow requests with no origin (like mobile apps or curl)
    if (!origin) return callback(null, true);

    // Allow local development
    if (
      origin.startsWith("http://localhost") ||
      origin.startsWith("http://127.0.0.1") ||
      origin.startsWith("file://") // Re-added file support from feature/login logic
    ) {
      return callback(null, true);
    }

    // Allow production frontend
    if (origin === process.env.FRONTEND_URL) {
      return callback(null, true);
    }

    callback(new Error("Not allowed by CORS"));
  },
  credentials: true, // Required for cookies and Authorization headers
  methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
  allowedHeaders: ["Content-Type", "Authorization"],
  exposedHeaders: ["Set-Cookie"],
  maxAge: 86400,
};

/* ========================
   SECURITY HEADERS
======================== */
app.use((req, res, next) => {
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.setHeader("X-Frame-Options", "DENY");
  res.setHeader("X-XSS-Protection", "1; mode=block");

  if (process.env.NODE_ENV === "production") {
    res.setHeader(
      "Strict-Transport-Security",
      "max-age=31536000; includeSubDomains"
    );
  }

  if (
    process.env.NODE_ENV === "production" &&
    req.headers["x-forwarded-proto"] !== "https"
  ) {
    return res.redirect(301, `https://${req.headers.host}${req.url}`);
  }

  next();
});

/* ========================
   INPUT VALIDATION
======================== */
app.use((req, res, next) => {
  if (["POST", "PUT", "PATCH"].includes(req.method)) {
    const contentType = req.headers["content-type"];
    if (!contentType || !contentType.includes("application/json")) {
      return res
        .status(400)
        .json({ message: "Content-Type must be application/json" });
    }
  }

  for (const key in req.query) {
    if (typeof req.query[key] === "string") {
      req.query[key] = req.query[key].trim().substring(0, 1000);
    }
  }

  next();
});

app.use(cors(corsOptions));

/* ========================
   BODY PARSING*/

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());

/* ========================
   GLOBAL LOADING & LOCK
======================== */
app.use(loadingMiddleware);
app.use(requestLock);
app.use(gatewayMiddleware);

/* ========================
   ROUTES
======================== */
app.get("/", (req, res) => {
  res.send("Xaytheon Auth Backend is running");
});

app.use("/api/auth", authRoutes);
app.use("/api/user", userRoutes);

/* ========================
   ERROR HANDLING*/


app.use("/api/watchlists", watchlistRoutes);
app.use("/api/notifications", notificationRoutes);
app.use("/api/analytics", analyticsRoutes);
app.use("/api/achievements", achievementsRoutes);
app.use("/api/push", pushRoutes);
app.use("/api/compare", compareRoutes);
app.use("/api/release", releaseRoutes);
app.use("/api/search", searchRoutes);
app.use("/api/collab", collabRoutes);
app.use("/api/heatmap", heatmapRoutes);
app.use("/api/sentiment", sentimentRoutes);
app.use("/api/workflow", workflowRoutes);
app.use("/api/dependency", dependencyRoutes);
app.use("/api/ai", aiRoutes);
app.use("/api/risk", riskRoutes);
app.use("/api/analyzer", analyzerRoutes);
app.use("/api/arch-drift", archDriftRoutes);
app.use("/api/brain", brainRoutes);
app.use("/api/bundle", bundleRoutes);
app.use("/api/test-lab", testLabRoutes);
app.use("/api/time-travel", archaeologyRoutes);
app.use("/api/refactor", refactorRoutes);
app.use("/api/sprint", sprintRoutes);
app.use("/api/sprint-forecaster", sprintForecasterRoutes);
app.use("/api/security", securityRoutes);
app.use("/api/audit", auditRoutes);
app.use("/api/gov", govRoutes);

app.use((err, req, res, next) => {
  console.error("Error:", err);

  const isDev = process.env.NODE_ENV !== "production";

  res.status(err.status || 500).json({
    message: err.message || "Internal server error",
    ...(isDev && { stack: err.stack }),
  });
});

module.exports = app;

