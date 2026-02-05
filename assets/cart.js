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

/**
 * Returns all gift variant IDs as strings (BXGY + GB promo gift)
 */
function getGiftVariantIds() {
  return [
    theme.shopSettings?.buyXGetY?.giftVariant1,
    theme.shopSettings?.buyXGetY?.giftVariant2,
    theme.shopSettings?.gbPromoGift?.variantId
  ].filter(Boolean).map(v => String(v));
}

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
    // Protect gift items from quantity changes (BXGY + GB promo)
    const giftVariants = getGiftVariantIds();

    // Check if the line item is a gift
    const cartItemRow = document.querySelector(`#CartItem-${line}, [data-index="${line}"]`)?.closest('[data-variant-id]');
    const variantId = cartItemRow?.dataset?.variantId;

    // Allow deletion (quantity = 0) but block other quantity changes for gift items
    if (giftVariants.length > 0 && variantId && giftVariants.includes(String(variantId)) && parseInt(quantity) !== 0) {
      this.disableLoading();
      return; // Block the quantity change (but allow deletion)
    }

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

        // Disable checkout before re-rendering sections if only gift items remain.
        // This closes the window where a freshly rendered button would be clickable
        // while the gift-only cart is still being cleaned up.
        if (!window.isRemovingGifts && parsedState?.items?.length > 0) {
          const _giftIds = getGiftVariantIds();
          if (_giftIds.length > 0 && !parsedState.items.some(i => !_giftIds.includes(String(i.variant_id)))) {
            disableCheckoutButtonsGlobal();
          }
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

        this.refreshVariantMaxValues();

        this.updateQuantityLiveRegions(line, parsedState.item_count);

        const lineItem = document.getElementById(`CartItem-${line}`);
        if (lineItem && name)
          lineItem.querySelector(`[name="${name}"]`).focus();
        this.disableLoading();

        // Auto-remove gifts if only gifts remain in cart
        this.removeGiftsIfOnlyGiftsInCart(parsedState);

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

  refreshVariantMaxValues() {
    const variantIds = new Set();
    document.querySelectorAll('[data-variant-id]').forEach(item => {
      if (item.dataset.variantId) variantIds.add(item.dataset.variantId);
    });

    variantIds.forEach(variantId => {
      const items = document.querySelectorAll(`[data-variant-id="${variantId}"]`);
      items.forEach(item => {
        const quantityInput = item.querySelector('quantity-input');
        if (quantityInput) {
          quantityInput.updateMaxAttribute();
        }
      });
    });
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

  /**
   * Auto-remove Buy X Get Y gift items when only gifts remain in cart
   */
  async removeGiftsIfOnlyGiftsInCart(parsedState) {
    // Prevent duplicate removal attempts
    if (window.isRemovingGifts) {
      return;
    }

    const giftVariants = getGiftVariantIds();

    if (giftVariants.length === 0 || !parsedState?.items) {
      return;
    }

    // Count regular (non-gift) items
    const regularItems = parsedState.items.filter(item =>
      !giftVariants.includes(String(item.variant_id))
    );

    // If cart has only gift items (no regular products), remove all gifts
    if (regularItems.length === 0 && parsedState.items.length > 0) {
      // Set flag to prevent duplicate attempts
      window.isRemovingGifts = true;

      // Get all gift items that need to be removed
      const giftItemsToRemove = parsedState.items.filter(item =>
        giftVariants.includes(String(item.variant_id))
      );

      // Disable checkout buttons while removing gifts
      disableCheckoutButtonsGlobal();

      try {
        // Remove all gifts in ONE request using /cart/update.js
        const updates = {};
        giftItemsToRemove.forEach(item => {
          updates[item.key] = 0;
        });

        await fetch('/cart/update.js', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ updates })
        });

        // Refresh cart UI instantly without page reload
        await this.refreshCartSections();
        window.isRemovingGifts = false;
        enableCheckoutButtonsGlobal();
      } catch (error) {
        console.error('Error during gift removal:', error);
        window.isRemovingGifts = false;
        enableCheckoutButtonsGlobal();
      }
    }
  }

  async refreshCartSections() {
    try {
      const sections = this.getSectionsToRender().map(s => s.section).filter(Boolean);
      const response = await fetch(`${window.location.pathname}?sections=${sections.join(',')}`);
      const data = await response.json();

      this.getSectionsToRender().forEach((section) => {
        const element = document.getElementById(section.id);
        if (element && data[section.section]) {
          const tempDiv = document.createElement('div');
          tempDiv.innerHTML = data[section.section];
          const newContent = tempDiv.querySelector(section.selector) || tempDiv;
          const targetElement = element.querySelector(section.selector) || element;
          if (targetElement && newContent) {
            targetElement.innerHTML = newContent.innerHTML;
          }
        }
      });

      // Update cart count in header
      const cartCountElements = document.querySelectorAll('.cart-count-bubble, [data-cart-count]');
      const cartResponse = await fetch('/cart.js');
      const cartData = await cartResponse.json();
      cartCountElements.forEach(el => {
        if (cartData.item_count === 0) {
          el.style.display = 'none';
        } else {
          el.textContent = cartData.item_count;
          el.style.display = '';
        }
      });
    } catch (error) {
      console.error('Error refreshing cart sections:', error);
    }
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
    this.debugMode = false; // Set to false in production

    if (this.settings.enabled && this.settings.discountCode) {
      this.init();
    }
  }

  init() {
    // Listen for real-time input changes on discount code fields
    this.setupRealtimeMonitoring();
  }

  /**
   * Setup Apply button click listeners for discount code
   */
  setupRealtimeMonitoring() {
    // Function to attach listeners to Apply buttons and inputs
    const attachListeners = () => {
      // Try broader selectors to catch all discount apply buttons
      const applyButtons = document.querySelectorAll(
        '#discount-apply-btn, #discount-apply-btn-drawer, .promo-code-apply, button[type="button"].promo-code-apply',
      );

      applyButtons.forEach((button) => {
        // Remove existing listener to avoid duplicates
        button.removeEventListener("click", this.handleApplyClick);

        // Create bound handler and store reference
        this.handleApplyClick = this.handleApplyButtonClick.bind(this);
        button.addEventListener("click", this.handleApplyClick);
      });

      // Attach Enter key handler to discount inputs
      const discountInputs = document.querySelectorAll(
        '#discount-code-input, #discount-code-input-drawer, input[name="discount"]',
      );

      discountInputs.forEach((input) => {
        // Remove existing listener to avoid duplicates
        input.removeEventListener("keydown", this.handleInputKeydown);

        // Create bound handler and store reference
        this.handleInputKeydown = (event) => {
          if (event.key === 'Enter') {
            event.preventDefault();
            // Find the Apply button in the same wrapper and click it
            const wrapper = input.closest('.cart__discount-wrapper, .cart__discount');
            const applyBtn = wrapper?.querySelector('#discount-apply-btn, #discount-apply-btn-drawer, .promo-code-apply');
            if (applyBtn) {
              applyBtn.click();
            }
          }
        };
        input.addEventListener("keydown", this.handleInputKeydown);
      });

      // Return whether we found elements
      return applyButtons.length > 0 || discountInputs.length > 0;
    };

    // Attach listeners initially
    attachListeners();

    // Re-attach when cart drawer opens (mini-cart might not be in DOM initially)
    document.addEventListener("cartdrawer:opened", () => {
      setTimeout(attachListeners, 200);
    });

    // Re-attach when cart updates
    document.addEventListener("cart:updated", () => {
      setTimeout(attachListeners, 100);
    });

    // Also try when mini-cart element is added to DOM (fallback)
    const observer = new MutationObserver((mutations) => {
      for (const mutation of mutations) {
        if (mutation.addedNodes.length > 0) {
          const miniCart = document.getElementById('mini-cart');
          if (miniCart) {
            setTimeout(attachListeners, 300);
            observer.disconnect(); // Stop observing once we found it
            break;
          }
        }
      }
    });
    observer.observe(document.body, { childList: true, subtree: true });
  }

  /**
   * Handle Apply button click
   */
  handleApplyButtonClick(event) {
    event.preventDefault();
    const button = event.target.closest('button');
    const wrapper = button.closest('.cart__discount-wrapper');
    const input = wrapper ? wrapper.querySelector('input[name="discount"]') :
      document.querySelector('#discount-code-input, #discount-code-input-drawer');

    if (input) {
      this.activeApplyButton = button;
      this.checkAndAddGifts(input);
    }
  }

  /**
   * Set Apply button to loading state
   */
  setButtonLoading(loading) {
    const button = this.activeApplyButton;
    if (!button) return;

    if (loading) {
      button.dataset.originalText = button.textContent.trim();
      button.disabled = true;
      button.innerHTML = `<span class="btn-spinner"></span>`;
    } else {
      button.disabled = false;
      button.textContent = button.dataset.originalText || 'Apply';
    }
  }

  /**
   * Check discount code and add gifts if it matches
   */
  async checkAndAddGifts(input) {
    const enteredCode = input.value.trim().toUpperCase();
    const triggerCode = this.settings.discountCode.trim().toUpperCase();

    // Clear any previous error messages
    this.hideErrorMessage(input);

    // Show loading state
    this.setButtonLoading(true);

    try {
      // Check if cart has at least 1 non-gift product
      const cartResponse = await fetch("/cart.js");

      if (!cartResponse.ok) {
        console.error('Failed to fetch cart:', cartResponse.status, cartResponse.statusText);
        this.setButtonLoading(false);
        return;
      }

      const cartText = await cartResponse.text();
      let cartData;
      try {
        cartData = JSON.parse(cartText);
      } catch (parseError) {
        console.error('Cart response is not JSON:', cartText.substring(0, 200));
        this.setButtonLoading(false);
        return;
      }

      const gift1Id = this.settings.giftVariant1;
      const gift2Id = this.settings.giftVariant2;

      // Count non-gift items in cart
      const nonGiftItems = cartData.items.filter(item => {
        const variantId = item.variant_id.toString();
        return variantId !== gift1Id && variantId !== gift2Id;
      });

      if (nonGiftItems.length === 0) {
        // No products in cart - show error
        await new Promise(resolve => setTimeout(resolve, 500)); // Brief delay for UX
        this.setButtonLoading(false);
        this.showErrorMessage(input, 'Add at least 1 product to apply discount code');
        return;
      }

      // Check if entered code matches trigger code
      if (enteredCode === triggerCode) {
        // Always try to add gifts - addGiftsToCart() will check if they're already in cart
        this.setButtonLoading(false);
        this.addGiftsToCart();
      } else {
        this.setButtonLoading(false);
      }
    } catch (error) {
      console.error("Error in checkAndAddGifts:", error);
      this.setButtonLoading(false);
    }
  }

  /**
   * Show error message under discount input
   */
  showErrorMessage(input, message) {
    const wrapper = input.closest('.cart__discount-wrapper, .cart__discount');
    if (!wrapper) return;

    // Remove existing error if any
    this.hideErrorMessage(input);

    // Create error element
    const errorEl = document.createElement('div');
    errorEl.className = 'discount-error-message';
    errorEl.style.cssText = 'color: #dc3545; font-size: 12px; margin-top: 8px; padding: 0 4px;';
    errorEl.textContent = message;

    // Insert after wrapper
    wrapper.parentNode.insertBefore(errorEl, wrapper.nextSibling);

    // Auto-hide after 5 seconds
    setTimeout(() => {
      this.hideErrorMessage(input);
    }, 5000);
  }

  /**
   * Hide error message
   */
  hideErrorMessage(input) {
    const wrapper = input.closest('.cart__discount-wrapper, .cart__discount');
    if (!wrapper) return;

    const existingError = wrapper.parentNode.querySelector('.discount-error-message');
    if (existingError) {
      existingError.remove();
    }
  }

  /**
   * Add gift products to cart WITHOUT redirecting to checkout
   */
  async addGiftsToCart() {
    if (this.isProcessing) {
      return;
    }
    this.isProcessing = true;

    // Show loading on Apply button and disable checkout buttons
    this.setButtonLoading(true);
    this.disableCheckoutButtons();

    try {
      // Get current cart to check if gifts already added
      const cartResponse = await fetch("/cart.js");

      if (!cartResponse.ok) {
        console.error('Failed to fetch cart:', cartResponse.status, cartResponse.statusText);
        return;
      }

      const cartText = await cartResponse.text();
      let cartData;
      try {
        cartData = JSON.parse(cartText);
      } catch (parseError) {
        console.error('Cart response is not JSON:', cartText.substring(0, 200));
        return;
      }

      const gift1Id = this.settings.giftVariant1;
      const gift2Id = this.settings.giftVariant2;

      const giftsToAdd = [];

      // Check if gift 1 is already in cart
      const gift1InCart = cartData.items.some((item) => item.variant_id.toString() === gift1Id);

      if (gift1Id && !gift1InCart) {
        giftsToAdd.push({ id: parseInt(gift1Id), quantity: 1 });
      }

      // Check if gift 2 is already in cart
      const gift2InCart = cartData.items.some((item) => item.variant_id.toString() === gift2Id);

      if (gift2Id && !gift2InCart) {
        giftsToAdd.push({ id: parseInt(gift2Id), quantity: 1 });
      }

      // Add gifts to cart
      if (giftsToAdd.length > 0) {
        for (const gift of giftsToAdd) {
          const addResponse = await fetch("/cart/add.js", {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              "X-Requested-With": "XMLHttpRequest",
            },
            body: JSON.stringify(gift),
          });

          if (addResponse.ok) {
            const addText = await addResponse.text();
            try {
              JSON.parse(addText);
            } catch (parseError) {
              console.error('Add response is not JSON:', addText.substring(0, 200));
            }
          } else {
            const errorText = await addResponse.text();
            try {
              const errorData = JSON.parse(errorText);
              console.error('Failed to add gift:', errorData);
            } catch (parseError) {
              console.error('Failed to add gift (non-JSON response):', errorText.substring(0, 200));
            }
          }
        }

        // Force apply discount to session (workaround for pricing delay)
        try {
          const triggerCode = this.settings.discountCode.trim().toUpperCase();
          await fetch('/discount/' + triggerCode);
        } catch (e) {
          console.warn('Failed to apply discount to session:', e);
        }

        // Refresh cart UI
        this.refreshCartUI();
      }
    } catch (error) {
      console.error("Error in addGiftsToCart:", error);
    } finally {
      this.isProcessing = false;
      this.setButtonLoading(false);
      this.enableCheckoutButtons();
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
   * Disable checkout and view cart buttons during processing (mini-cart + cart page)
   */
  disableCheckoutButtons() {
    // Mini-cart buttons
    const miniCartCheckoutBtn = document.querySelector('.button-container button[name="checkout"]');
    const viewCartBtn = document.querySelector('.button-container a[href="/cart"]');
    // Cart page button
    const cartPageCheckoutBtn = document.querySelector('.cart__checkout-button[name="checkout"]');

    if (miniCartCheckoutBtn) {
      miniCartCheckoutBtn.disabled = true;
      miniCartCheckoutBtn.style.opacity = '0.5';
      miniCartCheckoutBtn.style.pointerEvents = 'none';
    }

    if (viewCartBtn) {
      viewCartBtn.style.opacity = '0.5';
      viewCartBtn.style.pointerEvents = 'none';
    }

    if (cartPageCheckoutBtn) {
      cartPageCheckoutBtn.disabled = true;
      cartPageCheckoutBtn.style.opacity = '0.5';
      cartPageCheckoutBtn.style.pointerEvents = 'none';
    }
  }

  /**
   * Enable checkout and view cart buttons after processing (mini-cart + cart page)
   */
  enableCheckoutButtons() {
    // Mini-cart buttons
    const miniCartCheckoutBtn = document.querySelector('.button-container button[name="checkout"]');
    const viewCartBtn = document.querySelector('.button-container a[href="/cart"]');
    // Cart page button
    const cartPageCheckoutBtn = document.querySelector('.cart__checkout-button[name="checkout"]');

    if (miniCartCheckoutBtn) {
      miniCartCheckoutBtn.disabled = false;
      miniCartCheckoutBtn.style.opacity = '';
      miniCartCheckoutBtn.style.pointerEvents = '';
    }

    if (viewCartBtn) {
      viewCartBtn.style.opacity = '';
      viewCartBtn.style.pointerEvents = '';
    }

    if (cartPageCheckoutBtn) {
      cartPageCheckoutBtn.disabled = false;
      cartPageCheckoutBtn.style.opacity = '';
      cartPageCheckoutBtn.style.pointerEvents = '';
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
      })
      .catch((error) => {
        console.error("Error refreshing cart UI:", error);
      });
  }
}

// Global flag to prevent duplicate gift removal attempts
let isRemovingGifts = false;

// Initialize when DOM is ready
if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", () => new BuyXGetYHandler());
} else {
  new BuyXGetYHandler();
}

/**
 * Global cart:updated event listener for BXGY gift protection
 * Validates cart and removes gifts if only gifts remain
 * (Catches external cart modifications not handled by updateQuantity)
 */
document.addEventListener("cart:updated", async () => {
  // Prevent duplicate removal attempts
  if (window.isRemovingGifts) {
    return;
  }

  const giftVariants = getGiftVariantIds();

  if (giftVariants.length === 0) {
    return;
  }

  try {
    // Fetch current cart state
    const response = await fetch('/cart.js');

    if (!response.ok) {
      return;
    }

    const cartText = await response.text();
    let cartData;
    try {
      cartData = JSON.parse(cartText);
    } catch (parseError) {
      return;
    }

    if (!cartData || !cartData.items) {
      return;
    }

    // Count regular (non-gift) items
    const regularItems = cartData.items.filter(item =>
      !giftVariants.includes(String(item.variant_id))
    );

    // If cart has only gift items (no regular products), remove all gifts
    if (regularItems.length === 0 && cartData.items.length > 0) {
      // Set flag to prevent duplicate attempts
      window.isRemovingGifts = true;

      // Get all gift items that need to be removed
      const giftItemsToRemove = cartData.items.filter(item =>
        giftVariants.includes(String(item.variant_id))
      );

      // Disable checkout buttons while removing gifts
      disableCheckoutButtonsGlobal();

      try {
        // Remove all gifts in ONE request using /cart/update.js
        const updates = {};
        giftItemsToRemove.forEach(item => {
          updates[item.key] = 0;
        });

        await fetch('/cart/update.js', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ updates })
        });

        // Refresh cart UI instantly without page reload
        await refreshCartSectionsGlobal();
        window.isRemovingGifts = false;
        enableCheckoutButtonsGlobal();
      } catch (error) {
        console.error('Error during gift removal:', error);
        window.isRemovingGifts = false;
        enableCheckoutButtonsGlobal();
      }
    }
  } catch (error) {
    console.error('Error validating cart:', error);
  }
});

/**
 * Global function to refresh cart sections without page reload
 */
async function refreshCartSectionsGlobal() {
  try {
    const sections = ['mini-cart', 'cart-icon-bubble', 'mobile-cart-icon-bubble', 'cart-live-region-text'];
    const response = await fetch(`${window.location.pathname}?sections=${sections.join(',')}`);
    const data = await response.json();

    sections.forEach((sectionId) => {
      const element = document.getElementById(sectionId);
      if (element && data[sectionId]) {
        const tempDiv = document.createElement('div');
        tempDiv.innerHTML = data[sectionId];
        const newContent = tempDiv.querySelector('.shopify-section') || tempDiv;
        element.innerHTML = newContent.innerHTML;
      }
    });

    // Update cart count
    const cartResponse = await fetch('/cart.js');
    const cartData = await cartResponse.json();
    const cartCountElements = document.querySelectorAll('.cart-count-bubble, [data-cart-count]');
    cartCountElements.forEach(el => {
      if (cartData.item_count === 0) {
        el.style.display = 'none';
      } else {
        el.textContent = cartData.item_count;
        el.style.display = '';
      }
    });
  } catch (error) {
    console.error('Error refreshing cart sections:', error);
  }
}

/**
 * Global function to disable checkout buttons (mini-cart + cart page)
 */
function disableCheckoutButtonsGlobal() {
  // Mini-cart buttons
  const miniCartCheckoutBtn = document.querySelector('.button-container button[name="checkout"]');
  const viewCartBtn = document.querySelector('.button-container a[href="/cart"]');

  // Cart page button
  const cartPageCheckoutBtn = document.querySelector('.cart__checkout-button[name="checkout"]');

  if (miniCartCheckoutBtn) {
    miniCartCheckoutBtn.disabled = true;
    miniCartCheckoutBtn.style.opacity = '0.5';
    miniCartCheckoutBtn.style.pointerEvents = 'none';
  }

  if (viewCartBtn) {
    viewCartBtn.style.opacity = '0.5';
    viewCartBtn.style.pointerEvents = 'none';
  }

  if (cartPageCheckoutBtn) {
    cartPageCheckoutBtn.disabled = true;
    cartPageCheckoutBtn.style.opacity = '0.5';
    cartPageCheckoutBtn.style.pointerEvents = 'none';
  }
}

/**
 * Global function to enable checkout buttons (mini-cart + cart page)
 */
function enableCheckoutButtonsGlobal() {
  // Mini-cart buttons
  const miniCartCheckoutBtn = document.querySelector('.button-container button[name="checkout"]');
  const viewCartBtn = document.querySelector('.button-container a[href="/cart"]');

  // Cart page button
  const cartPageCheckoutBtn = document.querySelector('.cart__checkout-button[name="checkout"]');

  if (miniCartCheckoutBtn) {
    miniCartCheckoutBtn.disabled = false;
    miniCartCheckoutBtn.style.opacity = '';
    miniCartCheckoutBtn.style.pointerEvents = '';
  }

  if (viewCartBtn) {
    viewCartBtn.style.opacity = '';
    viewCartBtn.style.pointerEvents = '';
  }

  if (cartPageCheckoutBtn) {
    cartPageCheckoutBtn.disabled = false;
    cartPageCheckoutBtn.style.opacity = '';
    cartPageCheckoutBtn.style.pointerEvents = '';
  }
}
