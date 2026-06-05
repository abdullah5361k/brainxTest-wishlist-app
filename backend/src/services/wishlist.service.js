import { AppError } from "../utils/httpError.js";
import { toShopifyGid } from "../utils/shopifyGid.js";
import { ShopifyUserError } from "./shopify.service.js";

const DEFAULT_MAX_ITEMS = 100;
const MAX_COMPARE_DIGEST_RETRIES = 3;

// Business layer for wishlist reads/writes. Controllers stay thin while Shopify
// metafield details, validation, deduping, and retry behavior live in one place.
export class WishlistService {
  constructor({
    shopifyService,
    metafieldNamespace = "custom",
    metafieldKey = "wishlist",
    maxItems = DEFAULT_MAX_ITEMS,
    now = () => new Date()
  }) {
    this.shopifyService = shopifyService;
    this.metafieldNamespace = metafieldNamespace;
    this.metafieldKey = metafieldKey;
    this.maxItems = Number.isFinite(maxItems) && maxItems > 0 ? maxItems : DEFAULT_MAX_ITEMS;
    this.now = now;
  }

  async getWishlistProducts(customerId) {
    const snapshot = await this.readWishlist(customerId);
    const productIds = snapshot.items.map((item) => item.productId);
    // The customer metafield stores product IDs only; enrich those IDs with
    // product/variant data before returning data to the storefront.
    const products = await this.shopifyService.getProductsByIds(productIds);
    const productsById = new Map(products.map((product) => [product.productId, product]));

    const items = snapshot.items
      .map((wishlistItem) => {
        const product = productsById.get(wishlistItem.productId);

        if (!product) {
          return null;
        }

        return {
          ...product,
          addedAt: wishlistItem.addedAt
        };
      })
      .filter(Boolean);

    return {
      customerId: snapshot.customerId,
      items,
      missingProductIds: productIds.filter((productId) => !productsById.has(productId))
    };
  }

  async addProduct(customerId, productId) {
    const productGid = this.normalizeProductId(productId);
    const [product] = await this.shopifyService.getProductsByIds([productGid]);

    if (!product) {
      throw new AppError(404, "Product not found in Shopify.");
    }

    return this.updateWishlist(customerId, (items) => {
      if (items.some((item) => item.productId === productGid)) {
        return items;
      }

      if (items.length >= this.maxItems) {
        throw new AppError(400, `Wishlist cannot contain more than ${this.maxItems} products.`);
      }

      return [
        ...items,
        {
          productId: productGid,
          addedAt: this.now().toISOString()
        }
      ];
    });
  }

  async removeProduct(customerId, productId) {
    const productGid = this.normalizeProductId(productId);

    return this.updateWishlist(customerId, (items) =>
      items.filter((item) => item.productId !== productGid)
    );
  }

  async updateWishlist(customerId, updater) {
    const customerGid = this.normalizeCustomerId(customerId);

    // Shopify compareDigest prevents overwriting a metafield that changed
    // between read and write. Retrying handles fast repeated clicks/tabs safely.
    for (let attempt = 1; attempt <= MAX_COMPARE_DIGEST_RETRIES; attempt += 1) {
      const snapshot = await this.readWishlist(customerGid);
      const nextItems = sanitizeWishlistItems(updater([...snapshot.items]));

      if (wishlistItemsAreEqual(snapshot.items, nextItems)) {
        return {
          customerId: customerGid,
          items: nextItems,
          changed: false
        };
      }

      try {
        await this.shopifyService.setCustomerWishlistMetafield(
          customerGid,
          this.metafieldNamespace,
          this.metafieldKey,
          nextItems,
          snapshot.compareDigest
        );

        return {
          customerId: customerGid,
          items: nextItems,
          changed: true
        };
      } catch (error) {
        if (attempt < MAX_COMPARE_DIGEST_RETRIES && isCompareDigestError(error)) {
          continue;
        }

        throw error;
      }
    }

    throw new AppError(409, "Wishlist changed while saving. Please try again.");
  }

  async readWishlist(customerId) {
    const customerGid = this.normalizeCustomerId(customerId);
    const { customer, metafield } = await this.shopifyService.getCustomerWishlistMetafield(
      customerGid,
      this.metafieldNamespace,
      this.metafieldKey
    );

    if (!customer) {
      throw new AppError(404, "Customer not found in Shopify.");
    }

    return {
      customerId: customerGid,
      compareDigest: metafield?.compareDigest ?? null,
      items: parseWishlistValue(metafield?.value)
    };
  }

  normalizeCustomerId(customerId) {
    return normalizeId("Customer", customerId);
  }

  normalizeProductId(productId) {
    return normalizeId("Product", productId);
  }
}

export function parseWishlistValue(value) {
  if (!value) {
    return [];
  }

  let parsed;

  try {
    parsed = JSON.parse(value);
  } catch {
    throw new AppError(500, "Wishlist metafield contains invalid JSON.", { expose: false });
  }

  if (!Array.isArray(parsed)) {
    return [];
  }

  return sanitizeWishlistItems(parsed);
}

export function sanitizeWishlistItems(items) {
  const seen = new Set();
  const sanitized = [];

  // Accept the current object format and the older simple string-array format,
  // then normalize everything to Shopify Product GIDs for reliable comparisons.
  for (const item of Array.isArray(items) ? items : []) {
    const rawProductId = typeof item === "string" ? item : item?.productId;

    if (!rawProductId) {
      continue;
    }

    let productId;

    try {
      productId = toShopifyGid("Product", rawProductId);
    } catch {
      continue;
    }

    if (seen.has(productId)) {
      continue;
    }

    seen.add(productId);
    sanitized.push({
      productId,
      addedAt: typeof item?.addedAt === "string" ? item.addedAt : null
    });
  }

  return sanitized;
}

function normalizeId(resource, id) {
  try {
    return toShopifyGid(resource, id);
  } catch (error) {
    throw new AppError(400, error.message);
  }
}

function wishlistItemsAreEqual(left, right) {
  return JSON.stringify(left) === JSON.stringify(right);
}

function isCompareDigestError(error) {
  if (!(error instanceof ShopifyUserError)) {
    return false;
  }

  return error.userErrors.some((userError) => {
    const haystack = `${userError.code || ""} ${userError.message || ""}`.toLowerCase();
    return haystack.includes("compare") || haystack.includes("digest");
  });
}
