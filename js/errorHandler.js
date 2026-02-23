// js/errorHandler.js

/**
 * Base application error with structured metadata.
 * Enables consistent error classification across modules.
 */
class AppError extends Error {
  constructor(message, options = {}) {
    super(message);

    this.name = options.name || "AppError";
    this.code = options.code || null;
    this.module = options.module || null;
    this.step = options.step || null;
    this.severity = options.severity || "error"; // info | warning | error | critical
    this.meta = options.meta || null;

    Error.captureStackTrace?.(this, this.constructor);
  }
}

/**
 * Centralized frontend error management layer.
 * Handles logging, UI notifications, and global runtime capture.
 */
const ErrorHandler = (() => {
  let _handling = false;

  // Runtime configuration (can be adjusted during initialization)
  let _config = {
    showUI: true,
    logToConsole: true,
    environment: "development", // switch to "production" in deploy builds
  };

  function configure(options = {}) {
    _config = { ..._config, ...options };
  }

  /**
   * Normalizes unknown errors into structured AppError objects.
   */
  function format(error, context = {}) {
    if (error instanceof AppError) return error;

    return new AppError(
      error?.message || String(error) || "Unexpected error occurred",
      {
        module: context.module,
        step: context.step,
        code: context.code,
        severity: context.severity || "error",
        meta: context.meta || null,
      }
    );
  }

  /**
   * Console logging layer with severity awareness.
   */
  function log(error) {
    if (!_config.logToConsole) return;

    const level =
      error.severity === "warning"
        ? "warn"
        : error.severity === "critical"
        ? "error"
        : "error";

    console.groupCollapsed(
      `🚨 ${error.name} [${error.module || "global"}]`
    );

    console[level](error.message);

    if (_config.environment === "development") {
      console.info("Step:", error.step);
      console.info("Code:", error.code);
      console.info("Meta:", error.meta);
      console.info("Stack:", error.stack);
    }

    console.groupEnd();
  }

  /**
   * User-facing notification layer.
   * Safe-fails silently if banner element is missing.
   */
  function showUI(error) {
    if (!_config.showUI) return;

    const banner = document.getElementById("error-banner");
    if (!banner) return;

    banner.textContent = error.message;
    banner.className = `error-banner ${error.severity}`;
    banner.style.display = "block";

    setTimeout(() => {
      banner.style.display = "none";
    }, 6000);
  }

  /**
   * Main entry point for handling all application errors.
   * Prevents recursive triggering.
   */
  function handle(rawError, context = {}) {
    if (_handling) return;
    _handling = true;

    try {
      const error = format(rawError, context);

      log(error);
      showUI(error);

      // Extension point:
      // sendToTelemetry(error);
      // applyRetryStrategy(error);

    } catch (internalFailure) {
      console.error("ErrorHandler internal failure:", internalFailure);
    }

    _handling = false;
  }

  /**
   * Attaches global runtime and promise rejection listeners.
   */
  function attachGlobalListeners() {
    window.addEventListener("error", (event) => {
      handle(event.error || event.message, {
        module: "runtime",
        severity: "critical",
      });
    });

    window.addEventListener("unhandledrejection", (event) => {
      handle(event.reason, {
        module: "promise",
        severity: "error",
      });
    });
  }

  return {
    handle,
    configure,
    attachGlobalListeners,
    AppError,
  };
})();

export default ErrorHandler;