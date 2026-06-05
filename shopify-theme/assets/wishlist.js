(function () {
  if (window.CustomerWishlistAppInitialized) {
    return;
  }

  window.CustomerWishlistAppInitialized = true;

  const SELECTORS = {
    productWidget: "[data-wishlist-product]",
    toggleButton: "[data-wishlist-toggle]",
    status: "[data-wishlist-status]",
    page: "[data-wishlist-page]",
    pageStatus: "[data-wishlist-page-status]",
    grid: "[data-wishlist-grid]"
  };

  document.addEventListener("DOMContentLoaded", () => {
    document.querySelectorAll(SELECTORS.productWidget).forEach(initProductWidget);
    document.querySelectorAll(SELECTORS.page).forEach(initWishlistPage);
  });

  async function initProductWidget(widget) {
    // Liquid only renders customerId for logged-in customers. The backend accepts
    // Shopify numeric IDs from Liquid and normalizes them to GraphQL GIDs.
    const customerId = widget.dataset.customerId;
    const productId = widget.dataset.productId;
    const apiBaseUrl = normalizeApiBaseUrl(widget.dataset.backendUrl);
    const button = widget.querySelector(SELECTORS.toggleButton);
    const status = widget.querySelector(SELECTORS.status);

    if (!button || !customerId || !productId) {
      return;
    }

    if (!apiBaseUrl) {
      setStatus(status, "Wishlist is not configured yet.");
      button.disabled = true;
      return;
    }

    let inWishlist = false;

    setButtonLoading(button, true);

    try {
      const wishlist = await getWishlist(apiBaseUrl, customerId);
      inWishlist = wishlistContainsProduct(wishlist.items, productId);
      updateToggleButton(button, inWishlist);
      setStatus(status, "");
      setButtonLoading(button, false);
    } catch (error) {
      updateToggleButton(button, false);
      button.disabled = true;
      setStatus(status, error.message);
      return;
    }

    button.addEventListener("click", async () => {
      setButtonLoading(button, true);
      setStatus(status, "");

      try {
        if (inWishlist) {
          const wishlist = await removeFromWishlist(apiBaseUrl, customerId, productId);
          inWishlist = wishlistContainsProduct(wishlist.items, productId);
          setStatus(status, "Removed from wishlist.");
        } else {
          const wishlist = await addToWishlist(apiBaseUrl, customerId, productId);
          inWishlist = wishlistContainsProduct(wishlist.items, productId);
          setStatus(status, "Added to wishlist.");
        }

        updateToggleButton(button, inWishlist);
      } catch (error) {
        setStatus(status, error.message);
        updateToggleButton(button, inWishlist);
      } finally {
        setButtonLoading(button, false);
      }
    });
  }

  async function initWishlistPage(page) {
    const customerId = page.dataset.customerId;
    const apiBaseUrl = normalizeApiBaseUrl(page.dataset.backendUrl);
    const status = page.querySelector(SELECTORS.pageStatus);
    const grid = page.querySelector(SELECTORS.grid);

    if (!customerId || !grid) {
      return;
    }

    if (!apiBaseUrl) {
      setStatus(status, "Wishlist is not configured yet.");
      return;
    }

    try {
      const wishlist = await getWishlist(apiBaseUrl, customerId);
      renderWishlistItems({ apiBaseUrl, customerId, grid, status, items: wishlist.items });
    } catch (error) {
      setStatus(status, error.message);
    }
  }

  function renderWishlistItems({ apiBaseUrl, customerId, grid, status, items }) {
    grid.replaceChildren();
    const wishlistItems = Array.isArray(items) ? items : [];

    if (!wishlistItems.length) {
      setStatus(status, "Your wishlist is empty.");
      return;
    }

    setStatus(status, "");

    wishlistItems.forEach((item) => {
      grid.appendChild(createWishlistCard({ apiBaseUrl, customerId, item, grid, status }));
    });
  }

  function createWishlistCard({ apiBaseUrl, customerId, item, grid, status }) {
    // Build DOM nodes manually instead of injecting HTML so product titles and
    // image alt text from Shopify cannot create accidental markup.
    const card = document.createElement("article");
    card.className = "wishlist-card";

    if (item.image) {
      const image = document.createElement("img");
      image.className = "wishlist-card__image";
      image.src = item.image;
      image.alt = item.imageAlt || item.title;
      image.loading = "lazy";
      card.appendChild(image);
    }

    const body = document.createElement("div");
    body.className = "wishlist-card__body";

    const title = document.createElement("a");
    title.className = "wishlist-card__title";
    title.href = item.url || "#";
    title.textContent = item.title;
    body.appendChild(title);

    if (item.price) {
      const price = document.createElement("p");
      price.className = "wishlist-card__price";
      price.textContent = formatPrice(item.price);
      body.appendChild(price);
    }

    const actions = document.createElement("div");
    actions.className = "wishlist-card__actions";

    const addToCartButton = document.createElement("button");
    addToCartButton.type = "button";
    addToCartButton.className = "wishlist-button";
    addToCartButton.textContent = item.availableForSale ? "Add to Cart" : "Unavailable";
    addToCartButton.disabled = !item.availableForSale || !item.variantNumericId;
    addToCartButton.addEventListener("click", async () => {
      addToCartButton.disabled = true;
      addToCartButton.textContent = "Adding...";

      try {
        await addVariantToCart(item.variantNumericId);
        addToCartButton.textContent = "Added";
      } catch (error) {
        setStatus(status, error.message);
        addToCartButton.disabled = false;
        addToCartButton.textContent = "Add to Cart";
      }
    });

    const removeButton = document.createElement("button");
    removeButton.type = "button";
    removeButton.className = "wishlist-button wishlist-button--secondary";
    removeButton.textContent = "Remove";
    removeButton.addEventListener("click", async () => {
      removeButton.disabled = true;

      try {
        await removeFromWishlist(apiBaseUrl, customerId, item.productId);
        const wishlist = await getWishlist(apiBaseUrl, customerId);
        renderWishlistItems({ apiBaseUrl, customerId, grid, status, items: wishlist.items });
      } catch (error) {
        setStatus(status, error.message);
        removeButton.disabled = false;
      }
    });

    actions.append(addToCartButton, removeButton);
    body.appendChild(actions);
    card.appendChild(body);

    return card;
  }

  async function getWishlist(apiBaseUrl, customerId) {
    return apiRequest(apiBaseUrl, `/api/wishlist?customerId=${encodeURIComponent(customerId)}`);
  }

  async function addToWishlist(apiBaseUrl, customerId, productId) {
    return apiRequest(apiBaseUrl, "/api/wishlist/add", {
      method: "POST",
      body: JSON.stringify({ customerId, productId })
    });
  }

  async function removeFromWishlist(apiBaseUrl, customerId, productId) {
    return apiRequest(apiBaseUrl, "/api/wishlist/remove", {
      method: "DELETE",
      body: JSON.stringify({ customerId, productId })
    });
  }

  async function apiRequest(apiBaseUrl, path, options) {
    const response = await fetch(`${apiBaseUrl}${path}`, {
      headers: {
        "Content-Type": "application/json"
      },
      ...options
    });

    const payload = await readJson(response);

    if (!response.ok) {
      throw new Error(payload.error?.message || "Wishlist request failed.");
    }

    return payload;
  }

  async function addVariantToCart(variantId) {
    const response = await fetch("/cart/add.js", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json"
      },
      body: JSON.stringify({
        id: String(variantId),
        quantity: 1
      })
    });

    const payload = await readJson(response);

    if (!response.ok) {
      throw new Error(payload.description || "Unable to add product to cart.");
    }

    return payload;
  }

  async function readJson(response) {
    const text = await response.text();

    if (!text) {
      return {};
    }

    try {
      return JSON.parse(text);
    } catch {
      return {};
    }
  }

  function wishlistContainsProduct(items, productId) {
    return (items || []).some((item) => {
      const storedId = item.productId || "";
      return storedId === productId || storedId.endsWith(`/Product/${productId}`);
    });
  }

  function updateToggleButton(button, inWishlist) {
    button.textContent = inWishlist ? "Remove from Wishlist" : "Add to Wishlist";
    button.setAttribute("aria-pressed", String(inWishlist));
  }

  function setButtonLoading(button, isLoading) {
    button.disabled = isLoading;

    if (isLoading) {
      button.textContent = "Please wait...";
    }
  }

  function setStatus(element, message) {
    if (element) {
      element.textContent = message;
    }
  }

  function normalizeApiBaseUrl(value) {
    const url = String(value || "").trim().replace(/\/$/, "");

    if (!url) {
      return "";
    }

    return url;
  }

  function formatPrice(value) {
    const numberValue = Number(value);

    if (!Number.isFinite(numberValue)) {
      return value;
    }

    return new Intl.NumberFormat(undefined, {
      style: "currency",
      currency: window.Shopify?.currency?.active || "USD"
    }).format(numberValue);
  }
})();
