export const DEFAULT_SHOPIFY_API_VERSION = "2026-04";

export class ConfigError extends Error {
  constructor(message) {
    super(message);
    this.name = "ConfigError";
    this.statusCode = 500;
    this.expose = false;
  }
}

export function getConfig(env = process.env) {
  const shopDomain = normalizeShopDomain(
    env.SHOPIFY_SHOP_DOMAIN || env.SHOPIFY_STORE_DOMAIN || ""
  );

  return {
    port: Number.parseInt(env.PORT || "3000", 10),
    nodeEnv: env.NODE_ENV || "development",
    shopify: {
      shopDomain,
      adminAccessToken: (env.SHOPIFY_ADMIN_ACCESS_TOKEN || "").trim(),
      apiVersion: (env.SHOPIFY_API_VERSION || DEFAULT_SHOPIFY_API_VERSION).trim(),
      metafieldNamespace: (env.SHOPIFY_METAFIELD_NAMESPACE || "custom").trim(),
      metafieldKey: (env.SHOPIFY_METAFIELD_KEY || "wishlist").trim()
    },
    cors: {
      origins: parseOriginList(
        env.CORS_ORIGIN || (shopDomain ? `https://${shopDomain}` : "")
      )
    },
    wishlist: {
      maxItems: Number.parseInt(env.MAX_WISHLIST_ITEMS || "100", 10)
    }
  };
}

export function assertRequiredConfig(config) {
  const missing = [];

  if (!config.shopify.shopDomain) {
    missing.push("SHOPIFY_SHOP_DOMAIN");
  }

  if (!config.shopify.adminAccessToken) {
    missing.push("SHOPIFY_ADMIN_ACCESS_TOKEN");
  }

  if (!config.shopify.metafieldNamespace) {
    missing.push("SHOPIFY_METAFIELD_NAMESPACE");
  }

  if (!config.shopify.metafieldKey) {
    missing.push("SHOPIFY_METAFIELD_KEY");
  }

  if (missing.length > 0) {
    throw new ConfigError(`Missing required environment variables: ${missing.join(", ")}`);
  }
}

function normalizeShopDomain(value) {
  const rawValue = String(value || "").trim().toLowerCase();

  if (!rawValue) {
    return "";
  }

  try {
    const url = rawValue.startsWith("http") ? new URL(rawValue) : new URL(`https://${rawValue}`);
    return url.hostname;
  } catch {
    return rawValue.replace(/^https?:\/\//, "").split("/")[0];
  }
}

function parseOriginList(value) {
  return String(value || "")
    .split(",")
    .map((origin) => origin.trim().replace(/\/$/, ""))
    .filter(Boolean);
}
