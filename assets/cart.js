class CartRemoveButton extends HTMLElement {
  constructor() {
    super();

    this.addEventListener('click', (event) => {
      event.preventDefault();
      this.closest('cart-items').updateQuantity(this.dataset.index, 0);
    });
  }
}
customElements.define('cart-remove-button', CartRemoveButton);

class CartItems extends HTMLElement {
  constructor() {
    super();

    this.lineItemStatusElement = document.getElementById('shopping-cart-line-item-status');
    this.cartErrors = document.getElementById('cart-errors');

    this.currentItemCount = Array.from(this.querySelectorAll('[name="updates[]"]'))
      .reduce((total, quantityInput) => total + parseInt(quantityInput.value), 0);

    this.debouncedOnChange = debounce((event) => {
      this.onChange(event);
    }, 300);

    this.addEventListener('change', this.debouncedOnChange.bind(this));
  }

  onChange(event) {
    if (event.target === null) return;
    this.updateQuantity(event.target.dataset.index, event.target.value, document.activeElement.getAttribute('name'));
  }

  getSectionsToRender() {
    let sections = [
      {
        id: 'mini-cart',
        section: document.getElementById('mini-cart')?.id,
        selector: '.shopify-section',
      },
      {
        id: 'main-cart-items',
        section: document.getElementById('main-cart-items')?.dataset.id,
        selector: '.js-contents',
      },
      {
        id: 'cart-icon-bubble',
        section: 'cart-icon-bubble',
        selector: '.shopify-section'
      },
      {
        id: 'mobile-cart-icon-bubble',
        section: 'mobile-cart-icon-bubble',
        selector: '.shopify-section'
      },
      {
        id: 'cart-live-region-text',
        section: 'cart-live-region-text',
        selector: '.shopify-section'
      },
      {
        id: 'main-cart-footer',
        section: document.getElementById('main-cart-footer')?.dataset.id,
        selector: '.js-contents',
      }
    ];
    if (document.querySelector('#main-cart-footer .free-shipping')) {
      sections.push({
        id: 'main-cart-footer',
        section: document.getElementById('main-cart-footer')?.dataset.id,
        selector: '.free-shipping',
      });
    }
    return sections;
  }

  updateQuantity(line, quantity, name) {
    this.enableLoading(line);
    const sections = this.getSectionsToRender().map((section) => section.section);

    const body = JSON.stringify({
      line,
      quantity,
      sections: sections,
      sections_url: window.location.pathname
    });

    fetch(`${theme.routes.cart_change_url}`, {...fetchConfig(), ...{ body }})
      .then((response) => {
        return response.text();
      })
      .then((state) => {
        const parsedState = JSON.parse(state);
        this.classList.toggle('is-empty', parsedState.item_count === 0);
        const cartFooter = document.getElementById('main-cart-footer');

        if (cartFooter) cartFooter.classList.toggle('is-empty', parsedState.item_count === 0);
        if (parsedState.errors) {
          this.updateErrorLiveRegions(line, parsedState.errors);
        }
        this.getSectionsToRender().forEach((section => {
          const element = document.getElementById(section.id);
          if (element) {
            const elementToReplace = element.querySelector(section.selector) || element;

            if (elementToReplace && parsedState.sections[section.section]) {
              elementToReplace.innerHTML =
                this.getSectionInnerHTML(parsedState.sections[section.section], section.selector);
            }
          }
        }));

        this.updateQuantityLiveRegions(line, parsedState.item_count);

        const lineItem = document.getElementById(`CartItem-${line}`);
        if (lineItem && name) lineItem.querySelector(`[name="${name}"]`).focus();
        this.disableLoading();

        document.dispatchEvent(new CustomEvent('cart:updated', {
          detail: {
            cart: state
          }
        }));
        publish(PUB_SUB_EVENTS.cartUpdate, { source: 'cart-items' });
      })
      .catch(() => {
        this.querySelectorAll('.loading-overlay').forEach((overlay) => overlay.classList.add('hidden'));
        this.disableLoading();
        if (this.cartErrors) {
          this.cartErrors.textContent = theme.cartStrings.error;
        }
      });
  }

  updateErrorLiveRegions(line, message) {
    const lineItemError =
      document.getElementById(`Line-item-error-${line}`) || document.getElementById(`CartDrawer-LineItemError-${line}`);
    if (lineItemError) lineItemError.querySelector('.cart-item__error-text').innerHTML = message;

    this.lineItemStatusElement.setAttribute('aria-hidden', true);

    const cartStatus =
      document.getElementById('cart-live-region-text') || document.getElementById('CartDrawer-LiveRegionText');
    cartStatus.setAttribute('aria-hidden', false);

    setTimeout(() => {
      cartStatus.setAttribute('aria-hidden', true);
    }, 1000);
  }

  updateQuantityLiveRegions(line, itemCount) {
    if (this.currentItemCount === itemCount) {
      const quantityError = document.getElementById(`Line-item-error-${line}`);
      if (quantityError) {
        quantityError.querySelector('.cart-item__error-text')
          .innerHTML = theme.cartStrings.quantityError.replace(
            '[quantity]',
            document.getElementById(`Quantity-${line}`).value
          );
      }
    }

    this.currentItemCount = itemCount;

    if (this.lineItemStatusElement) this.lineItemStatusElement.setAttribute('aria-hidden', true);

    const cartStatus = document.getElementById('cart-live-region-text');
    if (cartStatus) {
      cartStatus.setAttribute('aria-hidden', false);

      setTimeout(() => {
        cartStatus.setAttribute('aria-hidden', true);
      }, 1e3);
    }
  }

  getSectionInnerHTML(html, selector) {
    return new DOMParser()
      .parseFromString(html, 'text/html')
      .querySelector(selector)?.innerHTML;
  }

  enableLoading(line) {
    const cartItems = document.getElementById('main-cart-items');
    if (cartItems) cartItems.classList.add('cart__items--disabled');

    const loadingOverlay = this.querySelectorAll('.loading-overlay')[line - 1];
    if (loadingOverlay) loadingOverlay.classList.remove('hidden');

    document.activeElement.blur();
    if (this.lineItemStatusElement) this.lineItemStatusElement.setAttribute('aria-hidden', false);
  }

  disableLoading() {
    const cartItems = document.getElementById('main-cart-items');
    if (cartItems) cartItems.classList.remove('cart__items--disabled');
  }

  renderContents(parsedState) {
    this.getSectionsToRender().forEach((section => {
      const element = document.getElementById(section.id);

      if (element) {
        element.innerHTML = this.getSectionInnerHTML(parsedState.sections[section.id], section.selector);
      }
    }));
  }
}
customElements.define('cart-items', CartItems);

class CartNote extends HTMLElement {
  constructor() {
    super();

    this.addEventListener('change', debounce((event) => {
      const body = JSON.stringify({ note: event.target.value });
      fetch(`${theme.routes.cart_update_url}`, {...fetchConfig(), ...{ body }});
    }, 300));
  }
}
customElements.define('cart-note', CartNote);

class DiscountCode extends HTMLElement {
  constructor() {
    super();

    if (isStorageSupported('session')) {
      this.setupDiscount();

      this.addEventListener('change', (event) => {
        window.sessionStorage.setItem('discount', event.target.value);
      });
    }
  }

  setupDiscount() {
    const discount = window.sessionStorage.getItem('discount');
    if (discount !== null) {
      this.querySelector('input[name="discount"]').value = discount;
    }
  }
}

customElements.define('discount-code', DiscountCode);

class ShippingCalculator extends HTMLElement {
  constructor() {
    super();

    this.setupCountries();

    this.errors = this.querySelector('#ShippingCalculatorErrors');
    this.success = this.querySelector('#ShippingCalculatorSuccess');
    this.zip = this.querySelector('#ShippingCalculatorZip');
    this.country = this.querySelector('#ShippingCalculatorCountry');
    this.province = this.querySelector('#ShippingCalculatorProvince');
    this.button = this.querySelector('button');
    this.button.addEventListener('click', this.onSubmitHandler.bind(this));
  }

  setupCountries() {
    if (Shopify && Shopify.CountryProvinceSelector) {
      // eslint-disable-next-line no-new
      new Shopify.CountryProvinceSelector('ShippingCalculatorCountry', 'ShippingCalculatorProvince', {
        hideElement: 'ShippingCalculatorProvinceContainer'
      });
    }
  }

  onSubmitHandler(event) {
    event.preventDefault();

    this.errors.classList.add('hidden');
    this.success.classList.add('hidden');
    this.zip.classList.remove('invalid');
    this.country.classList.remove('invalid');
    this.province.classList.remove('invalid');
    this.button.classList.add('loading');
    this.button.setAttribute('disabled', true);

    const body = JSON.stringify({
      shipping_address: {
        zip: this.zip.value,
        country: this.country.value,
        province: this.province.value
      }
    });
    let sectionUrl = `${theme.routes.cart_url}/shipping_rates.json`;

    // remove double `/` in case shop might have /en or language in URL
    sectionUrl = sectionUrl.replace('//', '/');

    fetch(sectionUrl, { ...fetchConfig('javascript'), body })
      .then((response) => response.json())
      .then((parsedState) => {
        if (parsedState.shipping_rates) {
          this.success.classList.remove('hidden');
          this.success.innerHTML = '';

          parsedState.shipping_rates.forEach((rate) => {
            const child = document.createElement('p');
            child.innerHTML = `${rate.name}: ${rate.price} ${Shopify.currency.active}`;
            this.success.appendChild(child);
          });
        }
        else {
          let errors = [];
          Object.entries(parsedState).forEach(([attribute, messages]) => {
            errors.push(`${attribute.charAt(0).toUpperCase() + attribute.slice(1)} ${messages[0]}`);
          });

          this.errors.classList.remove('hidden');
          this.errors.querySelector('.errors').innerHTML = errors.join('; ');
        }
      })
      .catch((e) => {
        console.error(e);
      })
      .finally(() => {
        this.button.classList.remove('loading');
        this.button.removeAttribute('disabled');
      });
  }
}

customElements.define('shipping-calculator', ShippingCalculator);

/**
 * Buy X Get Y Promotion Handler
 * Automatically adds gift products to cart when a specific discount code is entered
 */
class BuyXGetYHandler {
  constructor() {
    this.settings = theme.shopSettings?.buyXGetY || {};
    this.isProcessing = false;

    console.log('🎁 BuyXGetY: Constructor called, settings:', this.settings);

    if (this.settings.enabled && this.settings.discountCode) {
      this.init();
    } else {
      console.log('🎁 BuyXGetY: NOT initialized - enabled:', this.settings.enabled, 'code:', this.settings.discountCode);
    }
  }

  init() {
    console.log('🎁 BuyXGetY: Initializing event listeners');
    // Listen for form submissions on cart forms
    document.addEventListener('submit', this.handleFormSubmit.bind(this), true);

    // Also listen for checkout button clicks (mini-cart uses button click)
    document.addEventListener('click', this.handleCheckoutClick.bind(this), true);
  }

  handleCheckoutClick(event) {
    const checkoutButton = event.target.closest('button[name="checkout"], [data-checkout-button]');
    if (!checkoutButton) return;

    console.log('🎁 BuyXGetY: Checkout button clicked:', checkoutButton);

    // Try to find form: first via closest(), then via form attribute
    let form = checkoutButton.closest('form');

    // If button is outside form, check if it has a form="id" attribute
    if (!form && checkoutButton.hasAttribute('form')) {
      const formId = checkoutButton.getAttribute('form');
      form = document.getElementById(formId);
      console.log('🎁 BuyXGetY: Button has form attribute, looking up form by id:', formId);
    }

    console.log('🎁 BuyXGetY: Found form:', form, 'form.id:', form?.id);
    if (!form) return;

    // Let the form submit handler deal with this
    // But prevent default if we need to add gifts first
    const shouldAdd = this.shouldAddGifts(form);
    console.log('🎁 BuyXGetY: shouldAddGifts result:', shouldAdd);

    if (shouldAdd) {
      event.preventDefault();
      event.stopPropagation();
      this.processCheckout(form);
    }
  }

  handleFormSubmit(event) {
    const form = event.target;
    if (form.tagName !== 'FORM') return;

    console.log('🎁 BuyXGetY: Form submit detected, form.id:', form.id, 'form.action:', form.action);

    // Check if this is a cart form going to checkout
    const isCheckout = form.action?.includes('/cart') || form.id === 'cart';
    const hasCheckoutButton = form.querySelector('button[name="checkout"]');

    console.log('🎁 BuyXGetY: isCheckout:', isCheckout, 'hasCheckoutButton:', hasCheckoutButton);

    if (!isCheckout || !hasCheckoutButton) return;

    const shouldAdd = this.shouldAddGifts(form);
    console.log('🎁 BuyXGetY: shouldAddGifts result:', shouldAdd);

    if (shouldAdd) {
      event.preventDefault();
      event.stopPropagation();
      this.processCheckout(form);
    }
  }

  shouldAddGifts(form) {
    console.log('🎁 BuyXGetY: shouldAddGifts called, isProcessing:', this.isProcessing, 'enabled:', this.settings.enabled);

    if (this.isProcessing) return false;
    if (!this.settings.enabled) return false;

    // Get discount code from form - check multiple locations:
    // 1. Inside the form directly
    // 2. Linked via form="cart" attribute (used on /cart page)
    // 3. By specific IDs
    const formId = form.id;

    const insideForm = form.querySelector('input[name="discount"]');
    const linkedToForm = formId ? document.querySelector(`input[name="discount"][form="${formId}"]`) : null;
    const byId1 = document.querySelector('#discount-code-input');
    const byId2 = document.querySelector('#discount-code-input-drawer');

    console.log('🎁 BuyXGetY: Looking for discount input:');
    console.log('  - Inside form:', insideForm);
    console.log('  - Linked via form attr:', linkedToForm);
    console.log('  - By ID #discount-code-input:', byId1);
    console.log('  - By ID #discount-code-input-drawer:', byId2);

    const discountInput = insideForm || linkedToForm || byId1 || byId2;

    if (!discountInput) {
      console.log('🎁 BuyXGetY: No discount input found!');
      return false;
    }

    const enteredCode = discountInput.value.trim().toUpperCase();
    const triggerCode = this.settings.discountCode.trim().toUpperCase();

    console.log('🎁 BuyXGetY: enteredCode:', enteredCode, 'triggerCode:', triggerCode, 'match:', enteredCode === triggerCode);

    return enteredCode === triggerCode;
  }

  async processCheckout(form) {
    if (this.isProcessing) return;
    this.isProcessing = true;

    const checkoutButton = form.querySelector('button[name="checkout"], [data-checkout-button]');
    const originalText = checkoutButton?.textContent;

    try {
      // Show loading state
      if (checkoutButton) {
        checkoutButton.disabled = true;
        checkoutButton.textContent = 'Adding gifts...';
      }

      // Get current cart to check if gifts already added
      const cartResponse = await fetch('/cart.js');
      const cartData = await cartResponse.json();

      const gift1Id = this.settings.giftVariant1;
      const gift2Id = this.settings.giftVariant2;

      const giftsToAdd = [];

      // Check if gift 1 is already in cart
      if (gift1Id && !cartData.items.some(item => item.variant_id.toString() === gift1Id)) {
        giftsToAdd.push({ id: parseInt(gift1Id), quantity: 1 });
      }

      // Check if gift 2 is already in cart
      if (gift2Id && !cartData.items.some(item => item.variant_id.toString() === gift2Id)) {
        giftsToAdd.push({ id: parseInt(gift2Id), quantity: 1 });
      }

      // Add gifts to cart
      if (giftsToAdd.length > 0) {
        for (const gift of giftsToAdd) {
          await fetch('/cart/add.js', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'X-Requested-With': 'XMLHttpRequest'
            },
            body: JSON.stringify(gift)
          });
        }
        console.log('Buy X Get Y: Added', giftsToAdd.length, 'gift(s) to cart');
      }

      // Now submit the form to proceed to checkout
      // We need to add a hidden input with name="checkout" because form.submit()
      // doesn't include the button's name, and Shopify needs this to redirect to checkout
      this.isProcessing = false;

      // Add hidden checkout input if it doesn't exist
      let checkoutInput = form.querySelector('input[name="checkout"]');
      if (!checkoutInput) {
        checkoutInput = document.createElement('input');
        checkoutInput.type = 'hidden';
        checkoutInput.name = 'checkout';
        checkoutInput.value = '';
        form.appendChild(checkoutInput);
      }

      form.submit();

    } catch (error) {
      console.error('Buy X Get Y: Error adding gifts:', error);
      this.isProcessing = false;

      // Restore button and submit anyway
      if (checkoutButton) {
        checkoutButton.disabled = false;
        checkoutButton.textContent = originalText;
      }

      // Still proceed to checkout even if adding gifts failed - also add hidden input
      let checkoutInput = form.querySelector('input[name="checkout"]');
      if (!checkoutInput) {
        checkoutInput = document.createElement('input');
        checkoutInput.type = 'hidden';
        checkoutInput.name = 'checkout';
        checkoutInput.value = '';
        form.appendChild(checkoutInput);
      }
      form.submit();
    }
  }
}

// Initialize when DOM is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => new BuyXGetYHandler());
} else {
  new BuyXGetYHandler();
}
