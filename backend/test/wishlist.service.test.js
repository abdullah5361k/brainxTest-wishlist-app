import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { ShopifyUserError } from "../src/services/shopify.service.js";
import {
  parseWishlistValue,
  sanitizeWishlistItems,
  WishlistService
} from "../src/services/wishlist.service.js";

describe("wishlist value parsing", () => {
  it("supports the current object format and deduplicates product IDs", () => {
    const items = parseWishlistValue(
      JSON.stringify([
        { productId: "gid://shopify/Product/1", addedAt: "2026-06-03T00:00:00.000Z" },
        { productId: "1", addedAt: "ignored duplicate" },
        { productId: "2" }
      ])
    );

    assert.deepEqual(items, [
      { productId: "gid://shopify/Product/1", addedAt: "2026-06-03T00:00:00.000Z" },
      { productId: "gid://shopify/Product/2", addedAt: null }
    ]);
  });

  it("keeps backward compatibility with a simple array of product IDs", () => {
    assert.deepEqual(parseWishlistValue(JSON.stringify(["1", "gid://shopify/Product/2"])), [
      { productId: "gid://shopify/Product/1", addedAt: null },
      { productId: "gid://shopify/Product/2", addedAt: null }
    ]);
  });

  it("drops malformed wishlist entries", () => {
    assert.deepEqual(sanitizeWishlistItems([{ productId: "bad" }, null, { productId: "3" }]), [
      { productId: "gid://shopify/Product/3", addedAt: null }
    ]);
  });
});

describe("WishlistService", () => {
  it("adds a product once and persists the customer metafield", async () => {
    const shopifyService = createShopifyMock();
    const service = createService(shopifyService);

    const result = await service.addProduct("10", "20");
    const duplicate = await service.addProduct("10", "20");

    assert.equal(result.changed, true);
    assert.equal(duplicate.changed, false);
    assert.deepEqual(duplicate.items, [
      {
        productId: "gid://shopify/Product/20",
        addedAt: "2026-06-03T12:00:00.000Z"
      }
    ]);
    assert.equal(shopifyService.savedValues.length, 1);
  });

  it("removes a product from the wishlist", async () => {
    const shopifyService = createShopifyMock([
      { productId: "gid://shopify/Product/20", addedAt: "2026-06-03T12:00:00.000Z" },
      { productId: "gid://shopify/Product/30", addedAt: "2026-06-03T12:10:00.000Z" }
    ]);
    const service = createService(shopifyService);

    const result = await service.removeProduct("10", "20");

    assert.equal(result.changed, true);
    assert.deepEqual(result.items, [
      { productId: "gid://shopify/Product/30", addedAt: "2026-06-03T12:10:00.000Z" }
    ]);
  });

  it("returns product details in the stored wishlist order", async () => {
    const shopifyService = createShopifyMock([
      { productId: "gid://shopify/Product/20", addedAt: "2026-06-03T12:00:00.000Z" },
      { productId: "gid://shopify/Product/30", addedAt: "2026-06-03T12:10:00.000Z" }
    ]);
    const service = createService(shopifyService);

    const result = await service.getWishlistProducts("10");

    assert.deepEqual(
      result.items.map((item) => item.productId),
      ["gid://shopify/Product/20", "gid://shopify/Product/30"]
    );
    assert.equal(result.items[0].variantNumericId, "2001");
  });

  it("retries when Shopify reports a compare digest conflict", async () => {
    const shopifyService = createShopifyMock();
    shopifyService.failNextSaveWithCompareDigest = true;
    const service = createService(shopifyService);

    const result = await service.addProduct("10", "20");

    assert.equal(result.changed, true);
    assert.equal(shopifyService.saveAttempts, 2);
  });
});

function createService(shopifyService) {
  return new WishlistService({
    shopifyService,
    now: () => new Date("2026-06-03T12:00:00.000Z")
  });
}

function createShopifyMock(initialItems = []) {
  const state = {
    value: JSON.stringify(initialItems),
    compareDigest: "digest-1"
  };

  return {
    savedValues: [],
    saveAttempts: 0,
    failNextSaveWithCompareDigest: false,

    async getCustomerWishlistMetafield(customerId) {
      return {
        customer: { id: customerId },
        metafield: {
          value: state.value,
          compareDigest: state.compareDigest
        }
      };
    },

    async setCustomerWishlistMetafield(customerId, namespace, key, items) {
      this.saveAttempts += 1;

      if (this.failNextSaveWithCompareDigest) {
        this.failNextSaveWithCompareDigest = false;
        throw new ShopifyUserError([{ code: "COMPARE_DIGEST_MISMATCH", message: "Digest mismatch" }]);
      }

      state.value = JSON.stringify(items);
      state.compareDigest = `digest-${this.saveAttempts + 1}`;
      this.savedValues.push({ customerId, namespace, key, items });

      return {
        value: state.value,
        compareDigest: state.compareDigest
      };
    },

    async getProductsByIds(productIds) {
      return productIds.map((productId) => ({
        productId,
        productNumericId: productId.split("/").at(-1),
        title: `Product ${productId.split("/").at(-1)}`,
        handle: `product-${productId.split("/").at(-1)}`,
        url: `/products/product-${productId.split("/").at(-1)}`,
        image: null,
        imageAlt: `Product ${productId.split("/").at(-1)}`,
        variantId: `gid://shopify/ProductVariant/${productId.split("/").at(-1)}01`,
        variantNumericId: `${productId.split("/").at(-1)}01`,
        variantTitle: "Default Title",
        price: "10.00",
        availableForSale: true
      }));
    }
  };
}
