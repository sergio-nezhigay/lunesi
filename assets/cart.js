class CartRemoveButton extends HTMLElement {
  constructor() {
    super();

    this.addEventListener("click", (event) => {
      event.preventDefault();
      this.closest("cart-items").updateQuantity(this.dataset.index, 0);
    });
  }
}
customElements.define("cart-remove-button", CartRemoveButton);

class CartItems extends HTMLElement {
  constructor() {
    super();

    this.lineItemStatusElement = document.getElementById(
      "shopping-cart-line-item-status",
    );
    this.cartErrors = document.getElementById("cart-errors");

    this.currentItemCount = Array.from(
      this.querySelectorAll('[name="updates[]"]'),
    ).reduce(
      (total, quantityInput) => total + parseInt(quantityInput.value),
      0,
    );

    this.debouncedOnChange = debounce((event) => {
      this.onChange(event);
    }, 300);

    this.addEventListener("change", this.debouncedOnChange.bind(this));
  }

  onChange(event) {
    if (event.target === null) return;
    this.updateQuantity(
      event.target.dataset.index,
      event.target.value,
      document.activeElement.getAttribute("name"),
    );
  }

  getSectionsToRender() {
    let sections = [
      {
        id: "mini-cart",
        section: document.getElementById("mini-cart")?.id,
        selector: ".shopify-section",
      },
      {
        id: "main-cart-items",
        section: document.getElementById("main-cart-items")?.dataset.id,
        selector: ".js-contents",
      },
      {
        id: "cart-icon-bubble",
        section: "cart-icon-bubble",
        selector: ".shopify-section",
      },
      {
        id: "mobile-cart-icon-bubble",
        section: "mobile-cart-icon-bubble",
        selector: ".shopify-section",
      },
      {
        id: "cart-live-region-text",
        section: "cart-live-region-text",
        selector: ".shopify-section",
      },
      {
        id: "main-cart-footer",
        section: document.getElementById("main-cart-footer")?.dataset.id,
        selector: ".js-contents",
      },
    ];
    if (document.querySelector("#main-cart-footer .free-shipping")) {
      sections.push({
        id: "main-cart-footer",
        section: document.getElementById("main-cart-footer")?.dataset.id,
        selector: ".free-shipping",
      });
    }
    return sections;
  }

  updateQuantity(line, quantity, name) {
    this.enableLoading(line);
    const sections = this.getSectionsToRender().map(
      (section) => section.section,
    );

    const body = JSON.stringify({
      line,
      quantity,
      sections: sections,
      sections_url: window.location.pathname,
    });

    fetch(`${theme.routes.cart_change_url}`, { ...fetchConfig(), ...{ body } })
      .then((response) => {
        return response.text();
      })
      .then((state) => {
        const parsedState = JSON.parse(state);
        this.classList.toggle("is-empty", parsedState.item_count === 0);
        const cartFooter = document.getElementById("main-cart-footer");

        if (cartFooter)
          cartFooter.classList.toggle("is-empty", parsedState.item_count === 0);
        if (parsedState.errors) {
          this.updateErrorLiveRegions(line, parsedState.errors);
        }
        this.getSectionsToRender().forEach((section) => {
          const element = document.getElementById(section.id);
          if (element) {
            const elementToReplace =
              element.querySelector(section.selector) || element;

            if (elementToReplace && parsedState.sections[section.section]) {
              elementToReplace.innerHTML = this.getSectionInnerHTML(
                parsedState.sections[section.section],
                section.selector,
              );
            }
          }
        });

        this.updateQuantityLiveRegions(line, parsedState.item_count);

        const lineItem = document.getElementById(`CartItem-${line}`);
        if (lineItem && name)
          lineItem.querySelector(`[name="${name}"]`).focus();
        this.disableLoading();

        document.dispatchEvent(
          new CustomEvent("cart:updated", {
            detail: {
              cart: state,
            },
          }),
        );
        publish(PUB_SUB_EVENTS.cartUpdate, { source: "cart-items" });
      })
      .catch(() => {
        this.querySelectorAll(".loading-overlay").forEach((overlay) =>
          overlay.classList.add("hidden"),
        );
        this.disableLoading();
        if (this.cartErrors) {
          this.cartErrors.textContent = theme.cartStrings.error;
        }
      });
  }

  updateErrorLiveRegions(line, message) {
    const lineItemError =
      document.getElementById(`Line-item-error-${line}`) ||
      document.getElementById(`CartDrawer-LineItemError-${line}`);
    if (lineItemError)
      lineItemError.querySelector(".cart-item__error-text").innerHTML = message;

    this.lineItemStatusElement.setAttribute("aria-hidden", true);

    const cartStatus =
      document.getElementById("cart-live-region-text") ||
      document.getElementById("CartDrawer-LiveRegionText");
    cartStatus.setAttribute("aria-hidden", false);

    setTimeout(() => {
      cartStatus.setAttribute("aria-hidden", true);
    }, 1000);
  }

  updateQuantityLiveRegions(line, itemCount) {
    if (this.currentItemCount === itemCount) {
      const quantityError = document.getElementById(`Line-item-error-${line}`);
      if (quantityError) {
        quantityError.querySelector(".cart-item__error-text").innerHTML =
          theme.cartStrings.quantityError.replace(
            "[quantity]",
            document.getElementById(`Quantity-${line}`).value,
          );
      }
    }

    this.currentItemCount = itemCount;

    if (this.lineItemStatusElement)
      this.lineItemStatusElement.setAttribute("aria-hidden", true);

    const cartStatus = document.getElementById("cart-live-region-text");
    if (cartStatus) {
      cartStatus.setAttribute("aria-hidden", false);

      setTimeout(() => {
        cartStatus.setAttribute("aria-hidden", true);
      }, 1e3);
    }
  }

  getSectionInnerHTML(html, selector) {
    return new DOMParser()
      .parseFromString(html, "text/html")
      .querySelector(selector)?.innerHTML;
  }

  enableLoading(line) {
    const cartItems = document.getElementById("main-cart-items");
    if (cartItems) cartItems.classList.add("cart__items--disabled");

    const loadingOverlay = this.querySelectorAll(".loading-overlay")[line - 1];
    if (loadingOverlay) loadingOverlay.classList.remove("hidden");

    document.activeElement.blur();
    if (this.lineItemStatusElement)
      this.lineItemStatusElement.setAttribute("aria-hidden", false);
  }

  disableLoading() {
    const cartItems = document.getElementById("main-cart-items");
    if (cartItems) cartItems.classList.remove("cart__items--disabled");
  }

  renderContents(parsedState) {
    this.getSectionsToRender().forEach((section) => {
      const element = document.getElementById(section.id);

      if (element) {
        element.innerHTML = this.getSectionInnerHTML(
          parsedState.sections[section.id],
          section.selector,
        );
      }
    });
  }
}
customElements.define("cart-items", CartItems);

class CartNote extends HTMLElement {
  constructor() {
    super();

    this.addEventListener(
      "change",
      debounce((event) => {
        const body = JSON.stringify({ note: event.target.value });
        fetch(`${theme.routes.cart_update_url}`, {
          ...fetchConfig(),
          ...{ body },
        });
      }, 300),
    );
  }
}
customElements.define("cart-note", CartNote);

class DiscountCode extends HTMLElement {
  constructor() {
    super();

    if (isStorageSupported("session")) {
      this.setupDiscount();

      this.addEventListener("change", (event) => {
        window.sessionStorage.setItem("discount", event.target.value);
      });
    }
  }

  setupDiscount() {
    const discount = window.sessionStorage.getItem("discount");
    if (discount !== null) {
      this.querySelector('input[name="discount"]').value = discount;
    }
  }
}

customElements.define("discount-code", DiscountCode);

class ShippingCalculator extends HTMLElement {
  constructor() {
    super();

    this.setupCountries();

    this.errors = this.querySelector("#ShippingCalculatorErrors");
    this.success = this.querySelector("#ShippingCalculatorSuccess");
    this.zip = this.querySelector("#ShippingCalculatorZip");
    this.country = this.querySelector("#ShippingCalculatorCountry");
    this.province = this.querySelector("#ShippingCalculatorProvince");
    this.button = this.querySelector("button");
    this.button.addEventListener("click", this.onSubmitHandler.bind(this));
  }

  setupCountries() {
    if (Shopify && Shopify.CountryProvinceSelector) {
      // eslint-disable-next-line no-new
      new Shopify.CountryProvinceSelector(
        "ShippingCalculatorCountry",
        "ShippingCalculatorProvince",
        {
          hideElement: "ShippingCalculatorProvinceContainer",
        },
      );
    }
  }

  onSubmitHandler(event) {
    event.preventDefault();

    this.errors.classList.add("hidden");
    this.success.classList.add("hidden");
    this.zip.classList.remove("invalid");
    this.country.classList.remove("invalid");
    this.province.classList.remove("invalid");
    this.button.classList.add("loading");
    this.button.setAttribute("disabled", true);

    const body = JSON.stringify({
      shipping_address: {
        zip: this.zip.value,
        country: this.country.value,
        province: this.province.value,
      },
    });
    let sectionUrl = `${theme.routes.cart_url}/shipping_rates.json`;

    // remove double `/` in case shop might have /en or language in URL
    sectionUrl = sectionUrl.replace("//", "/");

    fetch(sectionUrl, { ...fetchConfig("javascript"), body })
      .then((response) => response.json())
      .then((parsedState) => {
        if (parsedState.shipping_rates) {
          this.success.classList.remove("hidden");
          this.success.innerHTML = "";

          parsedState.shipping_rates.forEach((rate) => {
            const child = document.createElement("p");
            child.innerHTML = `${rate.name}: ${rate.price} ${Shopify.currency.active}`;
            this.success.appendChild(child);
          });
        } else {
          let errors = [];
          Object.entries(parsedState).forEach(([attribute, messages]) => {
            errors.push(
              `${attribute.charAt(0).toUpperCase() + attribute.slice(1)} ${messages[0]}`,
            );
          });

          this.errors.classList.remove("hidden");
          this.errors.querySelector(".errors").innerHTML = errors.join("; ");
        }
      })
      .catch((e) => {
        console.error(e);
      })
      .finally(() => {
        this.button.classList.remove("loading");
        this.button.removeAttribute("disabled");
      });
  }
}

customElements.define("shipping-calculator", ShippingCalculator);

/**
 * Buy X Get Y Promotion Handler
 * Automatically adds gift products to cart in real-time when the correct discount code is typed
 */
class BuyXGetYHandler {
  constructor() {
    this.settings = theme.shopSettings?.buyXGetY || {};
    this.isProcessing = false;
    this.giftsAddedForCode = null; // Track which code we've added gifts for
    this.debounceTimer = null; // For typing debounce
    this.pasteTimer = null; // For paste event
    this.changeTimer = null; // For change event
    this.debugMode = true; // Set to false in production

    if (this.settings.enabled && this.settings.discountCode) {
      this.init();
    }
  }

  init() {
    // Listen for real-time input changes on discount code fields
    this.setupRealtimeMonitoring();
  }

  /**
   * Setup real-time monitoring of discount code inputs
   */
  setupRealtimeMonitoring() {
    // Function to attach listeners to discount inputs
    const attachListeners = () => {
      const discountInputs = document.querySelectorAll(
        'input[name="discount"]#discount-code-input, input[name="discount"]#discount-code-input-drawer',
      );

      discountInputs.forEach((input) => {
        // Remove existing listeners if any
        input.removeEventListener("input", this.handleDiscountInput.bind(this));
        input.removeEventListener("paste", this.handleDiscountPaste.bind(this));
        input.removeEventListener("change", this.handleDiscountChange.bind(this));

        // Add event listeners
        // 1. Input event: for character-by-character typing (300ms debounce)
        input.addEventListener("input", this.handleDiscountInput.bind(this));

        // 2. Paste event: for copy/paste operations (immediate, no debounce)
        input.addEventListener("paste", this.handleDiscountPaste.bind(this));

        // 3. Change event: for autofill/autocomplete (100ms debounce)
        input.addEventListener("change", this.handleDiscountChange.bind(this));
      });
    };

    // Attach listeners initially
    attachListeners();

    // Re-attach when cart drawer opens (mini-cart might not be in DOM initially)
    document.addEventListener("cartdrawer:opened", () => {
      setTimeout(attachListeners, 100);
    });

    // Re-attach when cart updates
    document.addEventListener("cart:updated", () => {
      setTimeout(attachListeners, 100);
    });
  }

  /**
   * Handle discount code input changes (real-time typing)
   */
  handleDiscountInput(event) {
    clearTimeout(this.debounceTimer);

    this.debounceTimer = setTimeout(() => {
      this.checkAndAddGifts(event.target);
    }, 300); // 300ms debounce for typing
  }

  /**
   * Handle discount code paste (immediate)
   */
  handleDiscountPaste(event) {
    // Clear any pending debounced check
    clearTimeout(this.debounceTimer);
    clearTimeout(this.pasteTimer);

    // Check shortly after paste completes (allow paste to populate input)
    this.pasteTimer = setTimeout(() => {
      this.checkAndAddGifts(event.target);
    }, 50); // 50ms delay to let paste complete
  }

  /**
   * Handle discount code change (autofill/autocomplete)
   */
  handleDiscountChange(event) {
    clearTimeout(this.changeTimer);

    this.changeTimer = setTimeout(() => {
      this.checkAndAddGifts(event.target);
    }, 100); // 100ms debounce for autofill
  }

  /**
   * Check discount code and add gifts if it matches
   */
  checkAndAddGifts(input) {
    const enteredCode = input.value.trim().toUpperCase();
    const triggerCode = this.settings.discountCode.trim().toUpperCase();

    // Check if entered code matches trigger code
    if (enteredCode === triggerCode) {
      // Only add gifts if we haven't already added them for this code
      if (this.giftsAddedForCode !== enteredCode) {
        this.addGiftsToCart();
      }
    } else {
      // Code changed or cleared - reset tracking
      this.giftsAddedForCode = null;
    }
  }

  /**
   * Add gift products to cart WITHOUT redirecting to checkout
   */
  async addGiftsToCart() {
    if (this.isProcessing) return;
    this.isProcessing = true;

    // Show loading message
    this.showLoadingMessage("Adding your free gifts...");

    try {
      // Get current cart to check if gifts already added
      const cartResponse = await fetch("/cart.js");
      const cartData = await cartResponse.json();

      const gift1Id = this.settings.giftVariant1;
      const gift2Id = this.settings.giftVariant2;

      const giftsToAdd = [];

      // Check if gift 1 is already in cart
      if (
        gift1Id &&
        !cartData.items.some((item) => item.variant_id.toString() === gift1Id)
      ) {
        giftsToAdd.push({ id: parseInt(gift1Id), quantity: 1 });
      }

      // Check if gift 2 is already in cart
      if (
        gift2Id &&
        !cartData.items.some((item) => item.variant_id.toString() === gift2Id)
      ) {
        giftsToAdd.push({ id: parseInt(gift2Id), quantity: 1 });
      }

      // Add gifts to cart
      if (giftsToAdd.length > 0) {
        for (const gift of giftsToAdd) {
          await fetch("/cart/add.js", {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              "X-Requested-With": "XMLHttpRequest",
            },
            body: JSON.stringify(gift),
          });
        }

        console.log("Buy X Get Y: Added", giftsToAdd.length, "gift(s) to cart");

        // Mark that we've added gifts for this code
        const triggerCode = this.settings.discountCode.trim().toUpperCase();
        this.giftsAddedForCode = triggerCode;

        // Force apply discount to session (workaround for pricing delay)
        try {
          await fetch('/discount/' + triggerCode);
        } catch (e) {
          console.warn('Failed to apply discount to session:', e);
        }

        // Show success message briefly
        this.showLoadingMessage("Free gifts added!", "success");

        // Refresh cart UI
        this.refreshCartUI();

        // Hide message after cart refreshes
        const hideDelay = this.debugMode ? 120000 : 1500; // 30s in debug, 1.5s in production
        setTimeout(() => this.hideLoadingMessage(), hideDelay);
      } else {
        console.log("Buy X Get Y: Gifts already in cart");
        // Mark as added even if already in cart
        const triggerCode = this.settings.discountCode.trim().toUpperCase();
        this.giftsAddedForCode = triggerCode;
        this.hideLoadingMessage();
      }
    } catch (error) {
      console.error("Buy X Get Y: Error adding gifts:", error);
      this.showLoadingMessage("Error adding gifts. Please try again.", "error");
      const errorDelay = this.debugMode ? 120000 : 3000; // 30s in debug, 3s in production
      setTimeout(() => this.hideLoadingMessage(), errorDelay);
    } finally {
      this.isProcessing = false;
    }
  }

  /**
   * Show loading message to user
   */
  showLoadingMessage(message, type = "loading") {
    // Remove existing message if any
    this.hideLoadingMessage();

    // Create message element
    const messageEl = document.createElement("div");
    messageEl.id = "buy-x-get-y-message";
    messageEl.className = `buy-x-get-y-message buy-x-get-y-message--${type}`;

    // Add spinner for loading state
    if (type === "loading") {
      messageEl.innerHTML = `
        <div class="buy-x-get-y-message__spinner"></div>
        <span>${message}</span>
      `;
    } else {
      messageEl.innerHTML = `<span>${message}</span>`;
    }

    // Find discount code container to insert message inside it
    const discountContainer = document.querySelector(
      "discount-code.cart__discount",
    );
    if (discountContainer) {
      // Insert inside the discount-code container, at the end
      discountContainer.appendChild(messageEl);
    } else {
      // Fallback: insert after discount input
      const discountInput = document.querySelector(
        "#discount-code-input, #discount-code-input-drawer",
      );
      if (discountInput) {
        const wrapper = discountInput.closest(".cart__discount, .field");
        if (wrapper) {
          wrapper.appendChild(messageEl);
        } else {
          discountInput.parentElement.insertAdjacentElement(
            "afterend",
            messageEl,
          );
        }
      }
    }

    // Add styles if not already added
    if (!document.getElementById("buy-x-get-y-styles")) {
      const styles = document.createElement("style");
      styles.id = "buy-x-get-y-styles";
      styles.textContent = `
        .buy-x-get-y-message {
          display: flex;
          align-items: center;
          gap: 8px;
          padding: 10px 12px;
          margin: 8px 0;
          border-radius: 4px;
          font-size: 13px;
          line-height: 1.4;
          animation: slideIn 0.3s ease-out;
        }

        .buy-x-get-y-message--loading {
          background: #f0f8ff;
          color: #1a5490;
        }

        .buy-x-get-y-message--success {
          background: #f0f9f0;
          color: #2d5016;

        }

        .buy-x-get-y-message--error {
          background: #fff5f5;
          color: #8b1e1e;

        }

        .buy-x-get-y-message__spinner {
          width: 14px;
          height: 14px;
          border: 2px solid currentColor;
          border-top-color: transparent;
          border-radius: 50%;
          animation: spin 0.6s linear infinite;
          flex-shrink: 0;
        }

        @keyframes spin {
          to { transform: rotate(360deg); }
        }

        @keyframes slideIn {
          from {
            opacity: 0;
            transform: translateY(-8px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }
      `;
      document.head.appendChild(styles);
    }
  }

  /**
   * Hide loading message
   */
  hideLoadingMessage() {
    const messageEl = document.getElementById("buy-x-get-y-message");
    if (messageEl) {
      messageEl.style.animation = "slideIn 0.2s ease-out reverse";
      setTimeout(() => messageEl.remove(), 200);
    }
  }

  /**
   * Refresh cart UI after adding gifts
   */
  refreshCartUI() {
    // Define sections to refresh (same as CartItems.getSectionsToRender)
    const sectionsToRender = [
      {
        id: "mini-cart",
        section:
          document.getElementById("mini-cart")?.dataset.id || "mini-cart",
        selector: ".shopify-section",
      },
      {
        id: "main-cart-items",
        section: document.getElementById("main-cart-items")?.dataset.id,
        selector: ".js-contents",
      },
      {
        id: "cart-icon-bubble",
        section: "cart-icon-bubble",
        selector: ".shopify-section",
      },
      {
        id: "mobile-cart-icon-bubble",
        section: "mobile-cart-icon-bubble",
        selector: ".shopify-section",
      },
      {
        id: "main-cart-footer",
        section: document.getElementById("main-cart-footer")?.dataset.id,
        selector: ".js-contents",
      },
    ].filter((section) => section.section); // Only include sections that exist

    // Build sections query string
    const sections = sectionsToRender
      .map((section) => section.section)
      .join(",");

    // Fetch updated cart sections
    fetch(`${window.location.pathname}?sections=${sections}`)
      .then((response) => response.json())
      .then((data) => {
        // Update each section with new HTML
        sectionsToRender.forEach((section) => {
          const element = document.getElementById(section.id);
          if (element && data[section.section]) {
            const elementToReplace =
              element.querySelector(section.selector) || element;

            if (elementToReplace) {
              // Parse the HTML and extract the relevant section
              const parser = new DOMParser();
              const doc = parser.parseFromString(
                data[section.section],
                "text/html",
              );
              const newContent = doc.querySelector(section.selector);

              if (newContent) {
                elementToReplace.innerHTML = newContent.innerHTML;
              }
            }
          }
        });

        // Trigger cart update event
        document.dispatchEvent(
          new CustomEvent("cart:updated", {
            detail: { source: "buy-x-get-y" },
          }),
        );

        // Publish cart update for components that use pub/sub
        if (
          typeof publish !== "undefined" &&
          typeof PUB_SUB_EVENTS !== "undefined"
        ) {
          publish(PUB_SUB_EVENTS.cartUpdate, { source: "buy-x-get-y" });
        }

        console.log("Buy X Get Y: Cart UI refreshed");
      })
      .catch((error) => {
        console.error("Buy X Get Y: Error refreshing cart UI:", error);
      });
  }
}

// Initialize when DOM is ready
if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", () => new BuyXGetYHandler());
} else {
  new BuyXGetYHandler();
}
