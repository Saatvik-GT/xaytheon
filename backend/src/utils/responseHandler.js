const isValidStatus = (status) =>
  typeof status === "number" && status >= 100 && status <= 599;

const isSuccessStatus = (status) =>
  status >= 200 && status < 300;

const logError = (message, status) => {
  console.error(JSON.stringify({
    level: "error",
    message,
    status,
    timestamp: new Date().toISOString()
  }));
};

function success(res, message, data = null, status = 200) {
  const finalStatus = isValidStatus(status) && isSuccessStatus(status)
    ? status
    : 200;

  const response = {
    success: true,
    message
  };

  if (data !== null && data !== undefined) {
    response.data = data;
  }

  return res.status(finalStatus).json(response);
}

function error(res, message, status = 500, errorCode = null, details = null) {
  const finalStatus = isValidStatus(status) && !isSuccessStatus(status)
    ? status
    : 500;

  logError(message, finalStatus);

  const response = {
    success: false,
    message
  };

  if (errorCode) response.code = errorCode;
  if (details) response.details = details;

  // Include stack only in development
  if (process.env.NODE_ENV === "development" && details?.stack) {
    response.stack = details.stack;
  }

  return res.status(finalStatus).json(response);
}

module.exports = {
  success,
  error
};
