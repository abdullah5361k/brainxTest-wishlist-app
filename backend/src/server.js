import "dotenv/config";
import { getConfig } from "./config/env.js";
import { createProductionApp } from "./app.js";

const config = getConfig();
const app = createProductionApp();

app.listen(config.port, () => {
  console.log(`Wishlist backend is running on port ${config.port}`);
});
