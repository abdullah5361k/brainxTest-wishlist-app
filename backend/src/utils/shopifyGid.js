const SHOPIFY_GID_PATTERN = /^gid:\/\/shopify\/([A-Za-z]+)\/(\d+)$/;
const NUMERIC_ID_PATTERN = /^\d+$/;

export function toShopifyGid(resource, value) {
  const id = String(value || "").trim();

  if (!id) {
    throw new Error(`${resource} ID is required.`);
  }

  const gidMatch = id.match(SHOPIFY_GID_PATTERN);
  if (gidMatch) {
    const [, gidResource] = gidMatch;

    if (gidResource !== resource) {
      throw new Error(`Expected a ${resource} ID but received a ${gidResource} ID.`);
    }

    return id;
  }

  if (!NUMERIC_ID_PATTERN.test(id)) {
    throw new Error(`${resource} ID must be a numeric Shopify ID or Shopify GID.`);
  }

  return `gid://shopify/${resource}/${id}`;
}

export function gidToNumericId(value) {
  const id = String(value || "").trim();
  const gidMatch = id.match(SHOPIFY_GID_PATTERN);

  if (gidMatch) {
    return gidMatch[2];
  }

  if (NUMERIC_ID_PATTERN.test(id)) {
    return id;
  }

  return null;
}
