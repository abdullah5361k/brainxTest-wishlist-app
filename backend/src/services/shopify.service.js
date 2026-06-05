import { AppError } from "../utils/httpError.js";
import { gidToNumericId } from "../utils/shopifyGid.js";

export class ShopifyUserError extends AppError {
  constructor(userErrors) {
    super(422, "Shopify rejected the metafield update.", {
      name: "ShopifyUserError",
      details: userErrors
    });
    this.userErrors = userErrors;
  }
}

export class ShopifyService {
  constructor({ shopDomain, adminAccessToken, apiVersion, fetchImpl = globalThis.fetch }) {
    this.shopDomain = shopDomain;
    this.adminAccessToken = adminAccessToken;
    this.apiVersion = apiVersion;
    this.fetchImpl = fetchImpl;
  }

  async getCustomerWishlistMetafield(customerId, namespace, key) {
    const data = await this.graphql(
      `#graphql
      query CustomerWishlist($customerId: ID!, $namespace: String!, $key: String!) {
        customer(id: $customerId) {
          id
          metafield(namespace: $namespace, key: $key) {
            id
            namespace
            key
            type
            value
            compareDigest
            updatedAt
          }
        }
      }`,
      { customerId, namespace, key }
    );

    return {
      customer: data.customer,
      metafield: data.customer?.metafield || null
    };
  }

  async setCustomerWishlistMetafield(customerId, namespace, key, items, compareDigest) {
    // Wishlist data is stored on the Customer resource as a JSON metafield
    // for logged-in customers.
    const metafieldInput = {
      ownerId: customerId,
      namespace,
      key,
      type: "json",
      value: JSON.stringify(items),
      compareDigest
    };

    const data = await this.graphql(
      `#graphql
      mutation SetCustomerWishlist($metafields: [MetafieldsSetInput!]!) {
        metafieldsSet(metafields: $metafields) {
          metafields {
            id
            namespace
            key
            type
            value
            compareDigest
            updatedAt
          }
          userErrors {
            field
            message
            code
          }
        }
      }`,
      { metafields: [metafieldInput] }
    );

    const userErrors = data.metafieldsSet?.userErrors || [];

    if (userErrors.length > 0) {
      throw new ShopifyUserError(userErrors);
    }

    return data.metafieldsSet.metafields[0];
  }

  async getProductsByIds(productIds) {
    if (productIds.length === 0) {
      return [];
    }

    const data = await this.graphql(
      `#graphql
      query WishlistProducts($ids: [ID!]!) {
        nodes(ids: $ids) {
          ... on Product {
            id
            legacyResourceId
            title
            handle
            featuredImage {
              url
              altText
            }
            variants(first: 1) {
              nodes {
                id
                legacyResourceId
                title
                availableForSale
                price
              }
            }
          }
        }
      }`,
      { ids: productIds }
    );

    return (data.nodes || []).filter(Boolean).map((product) => normalizeProduct(product));
  }

  async graphql(query, variables = {}) {
    // The Admin API token is used only on the server. It must never be exposed
    // through Liquid, theme JavaScript, or any browser-visible code.
    const response = await this.fetchImpl(this.endpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Shopify-Access-Token": this.adminAccessToken
      },
      body: JSON.stringify({ query, variables })
    });

    const payload = await readJsonResponse(response);

    if (!response.ok) {
      throw new AppError(response.status, "Shopify Admin API request failed.", {
        expose: response.status < 500,
        details: payload
      });
    }

    if (payload.errors?.length) {
      throw new AppError(502, "Shopify Admin API returned GraphQL errors.", {
        expose: false,
        details: payload.errors
      });
    }

    return payload.data;
  }

  get endpoint() {
    return `https://${this.shopDomain}/admin/api/${this.apiVersion}/graphql.json`;
  }
}

function normalizeProduct(product) {
  const firstVariant = product.variants?.nodes?.[0] || null;

  return {
    productId: product.id,
    productNumericId: String(product.legacyResourceId || gidToNumericId(product.id)),
    title: product.title,
    handle: product.handle,
    url: `/products/${product.handle}`,
    image: product.featuredImage?.url || null,
    imageAlt: product.featuredImage?.altText || product.title,
    variantId: firstVariant?.id || null,
    variantNumericId: firstVariant
      ? String(firstVariant.legacyResourceId || gidToNumericId(firstVariant.id))
      : null,
    variantTitle: firstVariant?.title || null,
    price: firstVariant?.price || null,
    availableForSale: Boolean(firstVariant?.availableForSale)
  };
}

async function readJsonResponse(response) {
  const text = await response.text();

  if (!text) {
    return {};
  }

  try {
    return JSON.parse(text);
  } catch {
    throw new AppError(502, "Shopify Admin API returned a non-JSON response.", {
      expose: false,
      details: text.slice(0, 500)
    });
  }
}
