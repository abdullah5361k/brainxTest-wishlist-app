# BrainX Test Wishlist App

Customer Wishlist App for a Shopify store. The backend is a Node.js/Express API, and wishlist data is stored in Shopify customer metafields for logged-in customers.

## Features

- Add a product to a logged-in customer's wishlist.
- Remove a product from a logged-in customer's wishlist.
- Read wishlist products from a Shopify customer metafield.
- Render an Add/Remove Wishlist button on Shopify product pages.
- Render a `/pages/wishlist` storefront page with product cards and Add to Cart actions.
- Uses Shopify Admin GraphQL API `2026-04`.

## Project Structure

```txt
backend/
  src/
    app.js
    server.js
    controllers/
    middleware/
    routes/
    services/
    utils/
  test/
  .env.example
  vercel.json

shopify-theme/
  assets/
    wishlist.css
    wishlist.js
  snippets/
    wishlist-button.liquid
  templates/
    page.wishlist.liquid
```

## Backend API

### `POST /api/wishlist/add`

Adds a product to the customer's wishlist.

Request:

```json
{
  "customerId": "123456789",
  "productId": "987654321"
}
```

Response:

```json
{
  "customerId": "gid://shopify/Customer/123456789",
  "items": [
    {
      "productId": "gid://shopify/Product/987654321",
      "addedAt": "2026-06-03T12:00:00.000Z"
    }
  ],
  "changed": true
}
```

### `GET /api/wishlist?customerId=123456789`

Returns enriched product data for the customer's saved wishlist items.

Response:

```json
{
  "customerId": "gid://shopify/Customer/123456789",
  "items": [
    {
      "productId": "gid://shopify/Product/987654321",
      "title": "Example Product",
      "handle": "example-product",
      "url": "/products/example-product",
      "image": "https://cdn.shopify.com/...",
      "variantNumericId": "111222333",
      "price": "29.99",
      "availableForSale": true,
      "addedAt": "2026-06-03T12:00:00.000Z"
    }
  ],
  "missingProductIds": []
}
```

### `DELETE /api/wishlist/remove`

Removes a product from the customer's wishlist.

Request:

```json
{
  "customerId": "123456789",
  "productId": "987654321"
}
```

Response:

```json
{
  "customerId": "gid://shopify/Customer/123456789",
  "items": [],
  "changed": true
}
```

## Local Backend Setup

```bash
cd backend
npm install
cp .env.example .env
npm run dev
```

Update `.env` with Shopify development store values:

```env
SHOPIFY_SHOP_DOMAIN=your-development-store.myshopify.com
SHOPIFY_ADMIN_ACCESS_TOKEN=shpat_xxx
SHOPIFY_API_VERSION=2026-04
SHOPIFY_METAFIELD_NAMESPACE=custom
SHOPIFY_METAFIELD_KEY=wishlist
CORS_ORIGIN=https://your-development-store.myshopify.com
```

Health check:

```bash
curl http://localhost:3000/health
```

## Shopify Admin API Scopes

Create a custom app in Shopify Admin and install it with these Admin API scopes:

```txt
read_customers
write_customers
read_products
```

The backend stores data in this customer metafield:

```txt
namespace: custom
key: wishlist
type: json
```

The app reads customer IDs and the wishlist metafield only. It does not need customer email, address, phone, or other PII fields.

## Theme Installation

1. Upload `shopify-theme/assets/wishlist.js` to the theme assets.
2. Upload `shopify-theme/assets/wishlist.css` to the theme assets.
3. Upload `shopify-theme/snippets/wishlist-button.liquid` to theme snippets.
4. Upload `shopify-theme/templates/page.wishlist.liquid` to theme templates.
5. Render the snippet below the product form or product details:

```liquid
{% render 'wishlist-button', product: product %}
```

6. Create a Shopify page named `Wishlist` and assign the `page.wishlist` template.
7. Set the deployed backend URL by creating a shop metafield:

```txt
namespace: custom
key: wishlist_backend_url
type: single_line_text_field
value: https://your-backend-url.onrender.com
```

If preferred, the product snippet can also receive the backend URL directly:

```liquid
{% render 'wishlist-button', product: product, wishlist_backend_url: 'https://your-backend-url.onrender.com' %}
```

## Deployment

Vercel is used as the deployment target for this Express backend:

1. Push this repo to GitHub as `brainxTest-wishlist-app`.
2. Import the repository in Vercel.
3. Set root directory to `backend`.
4. Add the environment variables from `backend/.env.example`.
5. Deploy and verify `/health`.

## Security Notes

- Never expose `SHOPIFY_ADMIN_ACCESS_TOKEN` in Liquid or browser JavaScript.
- Restrict `CORS_ORIGIN` to the actual Shopify storefront domain.
- The storefront API accepts `{ customerId, productId }`. For a production public app, prefer Shopify App Proxy authentication so Shopify signs requests and provides `logged_in_customer_id`.

## Test

```bash
cd backend
npm test
```
