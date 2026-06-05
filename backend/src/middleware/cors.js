import { AppError } from "../utils/httpError.js";

export function buildCorsOptions(allowedOrigins) {
  const normalizedOrigins = new Set(
    allowedOrigins.map((origin) => origin.trim().replace(/\/$/, "")).filter(Boolean)
  );

  return {
    origin(origin, callback) {
      if (!origin || normalizedOrigins.has("*") || normalizedOrigins.has(origin.replace(/\/$/, ""))) {
        callback(null, true);
        return;
      }

      callback(new AppError(403, "This storefront origin is not allowed by CORS."));
    }
  };
}
