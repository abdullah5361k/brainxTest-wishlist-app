import cors from "cors";
import express from "express";
import { getConfig, assertRequiredConfig } from "./config/env.js";
import { buildCorsOptions } from "./middleware/cors.js";
import { errorHandler, notFoundHandler } from "./middleware/errorHandler.js";
import { createWishlistRouter } from "./routes/wishlist.routes.js";
import { ShopifyService } from "./services/shopify.service.js";
import { WishlistService } from "./services/wishlist.service.js";

export function createApp({ config, wishlistService }) {
  const app = express();

  app.disable("x-powered-by");
  // Restrict browser access to the configured Shopify storefront origin(s).
  app.use(cors(buildCorsOptions(config.cors.origins)));
  app.use(express.json({ limit: "20kb" }));

  app.get("/health", (req, res) => {
    res.json({
      status: "ok",
      service: "brainx-test-wishlist-backend"
    });
  });

  app.use("/api/wishlist", createWishlistRouter({ wishlistService }));
  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
}

export function createProductionApp() {
  const config = getConfig();
  assertRequiredConfig(config);

  return createApp({
    config,
    wishlistService: createWishlistService(config)
  });
}

export function createWishlistService(config) {
  const shopifyService = new ShopifyService({
    shopDomain: config.shopify.shopDomain,
    adminAccessToken: config.shopify.adminAccessToken,
    apiVersion: config.shopify.apiVersion
  });

  return new WishlistService({
    shopifyService,
    metafieldNamespace: config.shopify.metafieldNamespace,
    metafieldKey: config.shopify.metafieldKey,
    maxItems: config.wishlist.maxItems
  });
}
