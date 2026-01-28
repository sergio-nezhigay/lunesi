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
    // Protect Buy X Get Y gift items from quantity changes
    const giftVariants = [
      theme.shopSettings?.buyXGetY?.giftVariant1,
      theme.shopSettings?.buyXGetY?.giftVariant2
    ].filter(Boolean).map(v => String(v));

    // Check if the line item is a BXGY gift
    const cartItemRow = document.querySelector(`#CartItem-${line}, [data-index="${line}"]`)?.closest('[data-variant-id]');
    const variantId = cartItemRow?.dataset?.variantId;

    // Allow deletion (quantity = 0) but block other quantity changes for gift items
    if (giftVariants.length > 0 && variantId && giftVariants.includes(String(variantId)) && parseInt(quantity) !== 0) {
      console.log('🎁 BXGY Gift Protection: Cannot change quantity of gift items (variant:', variantId, ')');
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
      console.log('🎁 BXGY Gift Protection: Already removing gifts, skipping...');
      return;
    }

    const giftVariants = [
      theme.shopSettings?.buyXGetY?.giftVariant1,
      theme.shopSettings?.buyXGetY?.giftVariant2
    ].filter(Boolean).map(v => String(v));

    if (giftVariants.length === 0 || !parsedState?.items) {
      return;
    }

    console.log('🎁 BXGY Gift Protection: Checking cart...', { giftVariants, items: parsedState.items.map(i => i.variant_id) });

    // Count regular (non-gift) items
    const regularItems = parsedState.items.filter(item =>
      !giftVariants.includes(String(item.variant_id))
    );

    // If cart has only gift items (no regular products), remove all gifts
    if (regularItems.length === 0 && parsedState.items.length > 0) {
      // Set flag to prevent duplicate attempts
      window.isRemovingGifts = true;

      console.log('🎁 BXGY Gift Protection: Removing gifts (no regular products in cart)');

      // Get all gift items that need to be removed
      const giftItemsToRemove = parsedState.items.filter(item =>
        giftVariants.includes(String(item.variant_id))
      );

      console.log('🎁 BXGY Gift Protection: Found', giftItemsToRemove.length, 'gift(s) to remove:', giftItemsToRemove.map(g => g.variant_id));

      // Disable checkout buttons while removing gifts
      disableCheckoutButtonsGlobal();

      try {
        // Remove all gifts in ONE request using /cart/update.js
        const updates = {};
        giftItemsToRemove.forEach(item => {
          updates[item.key] = 0;
        });

        console.log('🎁 BXGY Gift Protection: Removing all gifts in one request...', updates);

        await fetch('/cart/update.js', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ updates })
        });

        console.log('🎁 BXGY Gift Protection: All gifts removed!');

        // Refresh cart UI instantly without page reload
        await this.refreshCartSections();
        window.isRemovingGifts = false;
        enableCheckoutButtonsGlobal();
      } catch (error) {
        console.error('🎁 BXGY Gift Protection: Error during gift removal:', error);
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

      console.log('🎁 BXGY: Cart sections refreshed instantly');
    } catch (error) {
      console.error('🎁 BXGY: Error refreshing cart sections:', error);
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
    console.log('🎁 BXGY: Initializing BuyXGetYHandler...');
    this.settings = theme.shopSettings?.buyXGetY || {};
    console.log('🎁 BXGY: Settings loaded:', this.settings);
    this.isProcessing = false;
    this.giftsAddedForCode = null; // Track which code we've added gifts for
    this.debounceTimer = null; // For typing debounce
    this.pasteTimer = null; // For paste event
    this.changeTimer = null; // For change event
    this.debugMode = true; // Set to false in production

    if (this.settings.enabled && this.settings.discountCode) {
      console.log('🎁 BXGY: ✅ Buy X Get Y is enabled with code:', this.settings.discountCode);
      this.init();
    } else {
      console.log('🎁 BXGY: ❌ Buy X Get Y is disabled or no discount code configured');
      console.log('🎁 BXGY: Enabled?', this.settings.enabled);
      console.log('🎁 BXGY: Discount code?', this.settings.discountCode);
    }
  }

  init() {
    console.log('🎁 BXGY: init() called, setting up realtime monitoring...');
    // Listen for real-time input changes on discount code fields
    this.setupRealtimeMonitoring();
  }

  /**
   * Setup Apply button click listeners for discount code
   */
  setupRealtimeMonitoring() {
    // Function to attach listeners to Apply buttons and inputs
    const attachListeners = () => {
      console.log('🎁 BXGY: Attaching event listeners...');

      // Try broader selectors to catch all discount apply buttons
      const applyButtons = document.querySelectorAll(
        '#discount-apply-btn, #discount-apply-btn-drawer, .promo-code-apply, button[type="button"].promo-code-apply',
      );

      console.log('🎁 BXGY: Found Apply buttons:', applyButtons.length);
      if (applyButtons.length > 0) {
        console.log('🎁 BXGY: Apply button IDs:', Array.from(applyButtons).map(b => b.id || b.className));
      }

      applyButtons.forEach((button) => {
        // Remove existing listener to avoid duplicates
        button.removeEventListener("click", this.handleApplyClick);

        // Create bound handler and store reference
        this.handleApplyClick = this.handleApplyButtonClick.bind(this);
        button.addEventListener("click", this.handleApplyClick);
        console.log('🎁 BXGY: ✅ Attached click listener to Apply button:', button.id || button.className);
      });

      // Attach Enter key handler to discount inputs
      const discountInputs = document.querySelectorAll(
        '#discount-code-input, #discount-code-input-drawer, input[name="discount"]',
      );

      console.log('🎁 BXGY: Found discount inputs:', discountInputs.length);
      if (discountInputs.length > 0) {
        console.log('🎁 BXGY: Discount input IDs:', Array.from(discountInputs).map(i => i.id || i.name));
      }

      discountInputs.forEach((input) => {
        // Remove existing listener to avoid duplicates
        input.removeEventListener("keydown", this.handleInputKeydown);

        // Create bound handler and store reference
        this.handleInputKeydown = (event) => {
          if (event.key === 'Enter') {
            console.log('🎁 BXGY: Enter key pressed on discount input');
            event.preventDefault();
            // Find the Apply button in the same wrapper and click it
            const wrapper = input.closest('.cart__discount-wrapper, .cart__discount');
            const applyBtn = wrapper?.querySelector('#discount-apply-btn, #discount-apply-btn-drawer, .promo-code-apply');
            if (applyBtn) {
              console.log('🎁 BXGY: Triggering Apply button click');
              applyBtn.click();
            } else {
              console.error('🎁 BXGY: Could not find Apply button');
            }
          }
        };
        input.addEventListener("keydown", this.handleInputKeydown);
        console.log('🎁 BXGY: ✅ Attached keydown listener to discount input:', input.id || input.name);
      });

      // Return whether we found elements
      return applyButtons.length > 0 || discountInputs.length > 0;
    };

    // Attach listeners initially
    const foundInitially = attachListeners();
    if (!foundInitially) {
      console.log('🎁 BXGY: ⚠️ No discount elements found on initial page load (this is normal - mini-cart not open yet)');
    }

    // Re-attach when cart drawer opens (mini-cart might not be in DOM initially)
    document.addEventListener("cartdrawer:opened", () => {
      console.log('🎁 BXGY: 📢 Cart drawer opened event fired, re-attaching listeners...');
      setTimeout(() => {
        const found = attachListeners();
        if (!found) {
          console.error('🎁 BXGY: ❌ Still no discount elements found after cart drawer opened!');
        }
      }, 200);
    });

    // Re-attach when cart updates
    document.addEventListener("cart:updated", () => {
      console.log('🎁 BXGY: 📢 Cart updated event fired, re-attaching listeners...');
      setTimeout(attachListeners, 100);
    });

    // Also try when mini-cart element is added to DOM (fallback)
    const observer = new MutationObserver((mutations) => {
      for (const mutation of mutations) {
        if (mutation.addedNodes.length > 0) {
          const miniCart = document.getElementById('mini-cart');
          if (miniCart) {
            console.log('🎁 BXGY: 📢 Mini-cart element detected in DOM, attaching listeners...');
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
    console.log('🎁 BXGY: Apply button clicked');
    event.preventDefault();
    const button = event.target.closest('button');
    const wrapper = button.closest('.cart__discount-wrapper');
    const input = wrapper ? wrapper.querySelector('input[name="discount"]') :
      document.querySelector('#discount-code-input, #discount-code-input-drawer');

    console.log('🎁 BXGY: Found input?', !!input);
    console.log('🎁 BXGY: Input value:', input?.value);

    if (input) {
      this.activeApplyButton = button;
      this.checkAndAddGifts(input);
    } else {
      console.error('🎁 BXGY: Could not find discount input field!');
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

    console.log('🎁 BXGY: checkAndAddGifts() started');
    console.log('🎁 BXGY: Entered code:', enteredCode);
    console.log('🎁 BXGY: Trigger code:', triggerCode);
    console.log('🎁 BXGY: Codes match?', enteredCode === triggerCode);

    // Clear any previous error messages
    this.hideErrorMessage(input);

    // Show loading state
    this.setButtonLoading(true);

    try {
      // Check if cart has at least 1 non-gift product
      console.log('🎁 BXGY: Fetching cart data...');
      const cartResponse = await fetch("/cart.js");

      if (!cartResponse.ok) {
        console.error('🎁 BXGY: Failed to fetch cart:', cartResponse.status, cartResponse.statusText);
        this.setButtonLoading(false);
        return;
      }

      const cartText = await cartResponse.text();
      let cartData;
      try {
        cartData = JSON.parse(cartText);
      } catch (parseError) {
        console.error('🎁 BXGY: Cart response is not JSON:', cartText.substring(0, 200));
        this.setButtonLoading(false);
        return;
      }

      console.log('🎁 BXGY: Cart data:', { itemCount: cartData.items.length, items: cartData.items.map(i => ({ id: i.variant_id, title: i.title })) });

      const gift1Id = this.settings.giftVariant1;
      const gift2Id = this.settings.giftVariant2;

      console.log('🎁 BXGY: Gift variant IDs:', { gift1Id, gift2Id });

      // Count non-gift items in cart
      const nonGiftItems = cartData.items.filter(item => {
        const variantId = item.variant_id.toString();
        return variantId !== gift1Id && variantId !== gift2Id;
      });

      console.log('🎁 BXGY: Non-gift items in cart:', nonGiftItems.length);

      if (nonGiftItems.length === 0) {
        // No products in cart - show error
        console.log('🎁 BXGY: No non-gift products in cart, showing error');
        await new Promise(resolve => setTimeout(resolve, 500)); // Brief delay for UX
        this.setButtonLoading(false);
        this.showErrorMessage(input, 'Add at least 1 product to apply discount code');
        return;
      }

      // Check if entered code matches trigger code
      if (enteredCode === triggerCode) {
        console.log('🎁 BXGY: ✅ Code matches! Proceeding to add gifts...');
        // Always try to add gifts - addGiftsToCart() will check if they're already in cart
        this.setButtonLoading(false);
        this.addGiftsToCart();
      } else {
        console.log('🎁 BXGY: ❌ Code does not match, not adding gifts');
        this.setButtonLoading(false);
      }
    } catch (error) {
      console.error("🎁 BXGY: Error in checkAndAddGifts:", error);
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
    console.log('🎁 BXGY: addGiftsToCart() started');

    if (this.isProcessing) {
      console.log('🎁 BXGY: Already processing, skipping...');
      return;
    }
    this.isProcessing = true;

    // Show loading on Apply button and disable checkout buttons
    this.setButtonLoading(true);
    this.disableCheckoutButtons();

    try {
      // Get current cart to check if gifts already added
      console.log('🎁 BXGY: Fetching current cart state...');
      const cartResponse = await fetch("/cart.js");

      if (!cartResponse.ok) {
        console.error('🎁 BXGY: Failed to fetch cart:', cartResponse.status, cartResponse.statusText);
        return;
      }

      const cartText = await cartResponse.text();
      let cartData;
      try {
        cartData = JSON.parse(cartText);
      } catch (parseError) {
        console.error('🎁 BXGY: Cart response is not JSON:', cartText.substring(0, 200));
        return;
      }

      console.log('🎁 BXGY: Current cart items:', cartData.items.map(i => ({ id: i.variant_id, title: i.title })));

      const gift1Id = this.settings.giftVariant1;
      const gift2Id = this.settings.giftVariant2;

      console.log('🎁 BXGY: Checking for existing gifts...', { gift1Id, gift2Id });

      const giftsToAdd = [];

      // Check if gift 1 is already in cart
      const gift1InCart = cartData.items.some((item) => item.variant_id.toString() === gift1Id);
      console.log('🎁 BXGY: Gift 1 in cart?', gift1InCart);

      if (gift1Id && !gift1InCart) {
        giftsToAdd.push({ id: parseInt(gift1Id), quantity: 1 });
        console.log('🎁 BXGY: Gift 1 will be added');
      }

      // Check if gift 2 is already in cart
      const gift2InCart = cartData.items.some((item) => item.variant_id.toString() === gift2Id);
      console.log('🎁 BXGY: Gift 2 in cart?', gift2InCart);

      if (gift2Id && !gift2InCart) {
        giftsToAdd.push({ id: parseInt(gift2Id), quantity: 1 });
        console.log('🎁 BXGY: Gift 2 will be added');
      }

      console.log('🎁 BXGY: Total gifts to add:', giftsToAdd.length);

      // Add gifts to cart
      if (giftsToAdd.length > 0) {
        console.log('🎁 BXGY: Adding gifts to cart...', giftsToAdd);

        for (const gift of giftsToAdd) {
          console.log('🎁 BXGY: Adding gift variant:', gift.id);

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
              const addedItem = JSON.parse(addText);
              console.log('🎁 BXGY: ✅ Successfully added gift:', addedItem);
            } catch (parseError) {
              console.error('🎁 BXGY: Add response is not JSON:', addText.substring(0, 200));
            }
          } else {
            const errorText = await addResponse.text();
            try {
              const errorData = JSON.parse(errorText);
              console.error('🎁 BXGY: ❌ Failed to add gift:', errorData);
            } catch (parseError) {
              console.error('🎁 BXGY: ❌ Failed to add gift (non-JSON response):', errorText.substring(0, 200));
            }
          }
        }

        console.log("🎁 BXGY: ✅ Added", giftsToAdd.length, "gift(s) to cart");

        // Force apply discount to session (workaround for pricing delay)
        try {
          const triggerCode = this.settings.discountCode.trim().toUpperCase();
          console.log('🎁 BXGY: Applying discount code to session:', triggerCode);
          await fetch('/discount/' + triggerCode);
        } catch (e) {
          console.warn('🎁 BXGY: Failed to apply discount to session:', e);
        }

        // Refresh cart UI
        console.log('🎁 BXGY: Refreshing cart UI...');
        this.refreshCartUI();
      } else {
        console.log("🎁 BXGY: No gifts to add (already in cart)");
      }
    } catch (error) {
      console.error("🎁 BXGY: ❌ Error in addGiftsToCart:", error);
    } finally {
      this.isProcessing = false;
      this.setButtonLoading(false);
      this.enableCheckoutButtons();
      console.log('🎁 BXGY: addGiftsToCart() completed');
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
    console.log('🎁 BXGY: refreshCartUI() started');

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

    console.log('🎁 BXGY: Sections to refresh:', sectionsToRender.map(s => s.id));

    // Build sections query string
    const sections = sectionsToRender
      .map((section) => section.section)
      .join(",");

    console.log('🎁 BXGY: Fetching sections:', sections);

    // Fetch updated cart sections
    fetch(`${window.location.pathname}?sections=${sections}`)
      .then((response) => {
        console.log('🎁 BXGY: Sections fetch response status:', response.status);
        return response.json();
      })
      .then((data) => {
        console.log('🎁 BXGY: Received section data:', Object.keys(data));

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
                console.log('🎁 BXGY: ✅ Updated section:', section.id);
              } else {
                console.log('🎁 BXGY: ⚠️ Could not find new content for section:', section.id);
              }
            }
          } else {
            console.log('🎁 BXGY: ⚠️ Could not find element or data for section:', section.id);
          }
        });

        // Trigger cart update event
        document.dispatchEvent(
          new CustomEvent("cart:updated", {
            detail: { source: "buy-x-get-y" },
          }),
        );
        console.log('🎁 BXGY: Dispatched cart:updated event');

        // Publish cart update for components that use pub/sub
        if (
          typeof publish !== "undefined" &&
          typeof PUB_SUB_EVENTS !== "undefined"
        ) {
          publish(PUB_SUB_EVENTS.cartUpdate, { source: "buy-x-get-y" });
          console.log('🎁 BXGY: Published cart update via pub/sub');
        }

        console.log("🎁 BXGY: ✅ Cart UI refreshed successfully");
      })
      .catch((error) => {
        console.error("🎁 BXGY: ❌ Error refreshing cart UI:", error);
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
    console.log('🎁 BXGY Gift Protection (cart:updated): Already removing gifts, skipping...');
    return;
  }

  // Get gift variant IDs (convert to strings for consistent comparison)
  const giftVariants = [
    theme.shopSettings?.buyXGetY?.giftVariant1,
    theme.shopSettings?.buyXGetY?.giftVariant2
  ].filter(Boolean).map(v => String(v));

  if (giftVariants.length === 0) {
    return;
  }

  try {
    // Fetch current cart state
    const response = await fetch('/cart.js');

    if (!response.ok) {
      console.error('🎁 BXGY Gift Protection (cart:updated): Failed to fetch cart:', response.status);
      return;
    }

    const cartText = await response.text();
    let cartData;
    try {
      cartData = JSON.parse(cartText);
    } catch (parseError) {
      console.error('🎁 BXGY Gift Protection (cart:updated): Cart response is not JSON:', cartText.substring(0, 200));
      return;
    }

    if (!cartData || !cartData.items) {
      return;
    }

    console.log('🎁 BXGY Gift Protection (cart:updated): Checking cart...', { giftVariants, items: cartData.items.map(i => i.variant_id) });

    // Count regular (non-gift) items
    const regularItems = cartData.items.filter(item =>
      !giftVariants.includes(String(item.variant_id))
    );

    // If cart has only gift items (no regular products), remove all gifts
    if (regularItems.length === 0 && cartData.items.length > 0) {
      // Set flag to prevent duplicate attempts
      window.isRemovingGifts = true;

      console.log('🎁 BXGY Gift Protection (cart:updated): Cart has only gifts, removing them...');

      // Get all gift items that need to be removed
      const giftItemsToRemove = cartData.items.filter(item =>
        giftVariants.includes(String(item.variant_id))
      );

      console.log('🎁 BXGY Gift Protection (cart:updated): Found', giftItemsToRemove.length, 'gift(s) to remove');

      // Disable checkout buttons while removing gifts
      disableCheckoutButtonsGlobal();

      try {
        // Remove all gifts in ONE request using /cart/update.js
        const updates = {};
        giftItemsToRemove.forEach(item => {
          updates[item.key] = 0;
        });

        console.log('🎁 BXGY Gift Protection (cart:updated): Removing all gifts in one request...', updates);

        await fetch('/cart/update.js', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ updates })
        });

        console.log('🎁 BXGY Gift Protection (cart:updated): All gifts removed!');

        // Refresh cart UI instantly without page reload
        await refreshCartSectionsGlobal();
        window.isRemovingGifts = false;
        enableCheckoutButtonsGlobal();
      } catch (error) {
        console.error('🎁 BXGY Gift Protection (cart:updated): Error during gift removal:', error);
        window.isRemovingGifts = false;
        enableCheckoutButtonsGlobal();
      }
    }
  } catch (error) {
    console.error('🎁 BXGY Gift Protection (cart:updated): Error validating cart:', error);
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

    console.log('🎁 BXGY: Cart sections refreshed');
  } catch (error) {
    console.error('🎁 BXGY: Error refreshing cart sections:', error);
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
