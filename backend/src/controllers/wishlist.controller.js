import { badRequest } from "../utils/httpError.js";

export function createWishlistController({ wishlistService }) {
  return {
    async list(req, res, next) {
      try {
        const customerId = requiredString(req.query.customerId, "customerId");
        const wishlist = await wishlistService.getWishlistProducts(customerId);

        res.json(wishlist);
      } catch (error) {
        next(error);
      }
    },

    async add(req, res, next) {
      try {
        const customerId = requiredString(req.body.customerId, "customerId");
        const productId = requiredString(req.body.productId, "productId");
        const wishlist = await wishlistService.addProduct(customerId, productId);

        res.status(wishlist.changed ? 201 : 200).json(wishlist);
      } catch (error) {
        next(error);
      }
    },

    async remove(req, res, next) {
      try {
        const customerId = requiredString(req.body.customerId, "customerId");
        const productId = requiredString(req.body.productId, "productId");
        const wishlist = await wishlistService.removeProduct(customerId, productId);

        res.json(wishlist);
      } catch (error) {
        next(error);
      }
    }
  };
}

function requiredString(value, fieldName) {
  const stringValue = String(value || "").trim();

  if (!stringValue) {
    throw badRequest(`${fieldName} is required.`);
  }

  return stringValue;
}
