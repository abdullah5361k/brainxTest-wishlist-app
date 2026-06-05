import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { gidToNumericId, toShopifyGid } from "../src/utils/shopifyGid.js";

describe("shopifyGid utilities", () => {
  it("converts numeric IDs to Shopify GIDs", () => {
    assert.equal(toShopifyGid("Customer", "123"), "gid://shopify/Customer/123");
    assert.equal(toShopifyGid("Product", 456), "gid://shopify/Product/456");
  });

  it("keeps valid GIDs unchanged", () => {
    assert.equal(
      toShopifyGid("Product", "gid://shopify/Product/456"),
      "gid://shopify/Product/456"
    );
  });

  it("rejects IDs for the wrong Shopify resource", () => {
    assert.throws(() => toShopifyGid("Product", "gid://shopify/Customer/123"));
  });

  it("extracts numeric IDs from GIDs", () => {
    assert.equal(gidToNumericId("gid://shopify/ProductVariant/789"), "789");
    assert.equal(gidToNumericId("789"), "789");
  });
});
