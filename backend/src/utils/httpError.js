export class AppError extends Error {
  constructor(statusCode, message, options = {}) {
    super(message);
    this.name = options.name || "AppError";
    this.statusCode = statusCode;
    this.expose = options.expose ?? statusCode < 500;
    this.details = options.details;
  }
}

export function badRequest(message, details) {
  return new AppError(400, message, { details });
}

export function notFound(message) {
  return new AppError(404, message);
}
