import { Router } from "express";
import { createWishlistController } from "../controllers/wishlist.controller.js";

export function createWishlistRouter({ wishlistService }) {
  const router = Router();
  const controller = createWishlistController({ wishlistService });

  router.get("/", controller.list);
  router.post("/add", controller.add);
  router.delete("/remove", controller.remove);

  return router;
}
