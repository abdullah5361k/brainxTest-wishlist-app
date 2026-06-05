export function notFoundHandler(req, res) {
  res.status(404).json({
    error: {
      message: `Route not found: ${req.method} ${req.originalUrl}`
    }
  });
}

export function errorHandler(error, req, res, next) {
  if (res.headersSent) {
    next(error);
    return;
  }

  const statusCode = Number.isInteger(error.statusCode) ? error.statusCode : 500;
  const expose = error.expose ?? statusCode < 500;

  res.status(statusCode).json({
    error: {
      message: expose ? error.message : "Internal server error",
      ...(expose && error.details ? { details: error.details } : {})
    }
  });
}
