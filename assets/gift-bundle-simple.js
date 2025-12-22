/**
 * Simple Gift Bundle Manager
 * Manages gift popup, cart validation, and gift bundle functionality
 */
class SimpleGiftBundleManager {
  constructor() {
    this.giftVariantId = '43668412792963';
    this.init();
  }

  init() {
    console.log('🎁 Simple Gift Bundle Manager initialized');
    
    // Bind events
    this.bindEvents();
    
    // Initial state check
    this.updateUI();
    
    // Listen for cart changes
    document.addEventListener('cart:updated', () => {
      this.updateUI();
    });

    // Update UI every 3 seconds
    setInterval(() => {
      this.updateUI();
    }, 3000);

    // Show popup if conditions are met
    this.checkPopupConditions();

    // Add test functions
    window.testGift = () => this.debugState();
    window.clearGiftData = () => {
      sessionStorage.removeItem('gift-email-submitted');
      sessionStorage.removeItem('gift-popup-closed');
      document.cookie = 'beyours:gift-popup=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/;';
      document.cookie = 'beyours:gift-bundle-claimed=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/;';
      console.log('🎁 Gift data cleared');
      this.updateUI();
    };
    window.showGiftPopup = () => this.showPopup();
    window.hideGiftPopup = () => this.hidePopup();
  }

  bindEvents() {
    document.addEventListener('click', (e) => {
      // Gift add button
      if (e.target.closest('[data-gift-add]')) {
        e.preventDefault();
        this.addGift();
      }

      // Gift remove button  
      if (e.target.closest('[data-gift-remove]')) {
        e.preventDefault();
        this.removeGift();
      }

      // Popup trigger
      if (e.target.closest('[data-gift-popup-trigger]')) {
        e.preventDefault();
        this.showPopup();
      }

      // Popup close
      if (e.target.closest('[data-popup-close]')) {
        e.preventDefault();
        this.hidePopup();
      }
    });

    // Email form submission
    document.addEventListener('submit', (e) => {
      if (e.target.closest('#gift-email-form')) {
        e.preventDefault();
        this.submitEmail(e.target);
      }
    });
  }

  // State management
  getState() {
    return {
      emailSubmitted: sessionStorage.getItem('gift-email-submitted') === 'true',
      popupClosed: sessionStorage.getItem('gift-popup-closed') === 'true',
      giftInCart: this.isGiftInCart(),
      otherItemsCount: this.getOtherItemsCount(),
      userQualifies: this.userQualifiesForGift()
    };
  }

  userQualifiesForGift() {
    const state = {
      emailSubmitted: sessionStorage.getItem('gift-email-submitted') === 'true',
      hasGiftCookie: document.cookie.includes('beyours:gift-popup=true'),
      isCustomer: window.customer && window.customer.id,
      giftInCart: this.isGiftInCart()
    };
    
    return state.emailSubmitted || state.hasGiftCookie || state.isCustomer || state.giftInCart;
  }

  isGiftInCart() {
    // Check cart items on page
    const cartItems = document.querySelectorAll('[data-variant-id]');
    return Array.from(cartItems).some(item => 
      item.dataset.variantId === this.giftVariantId
    );
  }

  getOtherItemsCount() {
    const cartItems = document.querySelectorAll('[data-variant-id]');
    return Array.from(cartItems).filter(item => 
      item.dataset.variantId !== this.giftVariantId
    ).length;
  }

  // Popup logic
  checkPopupConditions() {
    const state = this.getState();
    
    console.log('🎁 Checking popup conditions:', state);

    // Don't show if already submitted email or popup was closed
    if (state.emailSubmitted || state.popupClosed) {
      console.log('🎁 Popup blocked - already submitted or closed');
      return;
    }

    // Show popup after delay
    setTimeout(() => {
      this.showPopup();
    }, 5000);
  }

  showPopup() {
    const popup = document.getElementById('gift-popup');
    if (popup) {
      // popup.classList.add('is-visible');
      // popup.classList.remove('is-hidden');
      console.log('🎁 Showing popup');
    }
  }

  hidePopup() {
    const popup = document.getElementById('gift-popup');
    if (popup) {
      popup.classList.remove('is-visible');
      popup.classList.add('is-hidden');
      
      // Mark as closed
      sessionStorage.setItem('gift-popup-closed', 'true');
      console.log('🎁 Hiding popup');
      
      // Update UI after closing
      setTimeout(() => this.updateUI(), 500);
    }
  }

  // Email submission
  async submitEmail(form) {
    const emailInput = form.querySelector('input[type="email"]');
    const submitBtn = form.querySelector('button[type="submit"]');
    
    if (!emailInput.value || !emailInput.validity.valid) {
      alert('Please enter a valid email address');
      return;
    }

    // Show loading
    submitBtn.disabled = true;
    submitBtn.textContent = 'Adding gift...';

    try {
      // Add gift to cart
      await this.addGift();
      
      // Mark email as submitted
      sessionStorage.setItem('gift-email-submitted', 'true');
      
      // Set cookie
      document.cookie = 'beyours:gift-popup=true; max-age=' + (30 * 24 * 60 * 60) + '; path=/';
      
      // Show success
      submitBtn.textContent = '🎉 Gift Added!';
      
      // Close popup after delay
      setTimeout(() => {
        this.hidePopup();
        this.updateUI();
      }, 2000);
      
    } catch (error) {
      console.error('🎁 Email submission error:', error);
      alert('Something went wrong. Please try again.');
      submitBtn.disabled = false;
      submitBtn.textContent = 'Get Free Gift';
    }
  }

  // Cart operations
  async addGift() {
    if (this.isGiftInCart()) {
      console.log('🎁 Gift already in cart');
      return;
    }

    try {
      const response = await fetch('/cart/add.js', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: this.giftVariantId,
          quantity: 1,
          properties: {
            '_gift_bundle': 'true',
            '_gift_source': 'popup'
          }
        })
      });

      if (response.ok) {
        console.log('🎁 Gift added to cart');
        await this.updateCart();
        this.updateUI();
      } else {
        throw new Error('Failed to add gift');
      }
    } catch (error) {
      console.error('🎁 Add gift error:', error);
      throw error;
    }
  }

  async removeGift() {
    console.log('REMOVED !@#!@@!#!@#!')
    try {
      const response = await fetch('/cart/change.js', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: this.giftVariantId,
          quantity: 0
        })
      });

      if (response.ok) {
        console.log('🎁 Gift removed from cart');
        await this.updateCart();
        this.updateUI();
      } else {
        throw new Error('Failed to remove gift');
      }
    } catch (error) {
      console.error('🎁 Remove gift error:', error);
    }
  }

  async updateCart() {
    try {
      // Update cart sections
      const response = await fetch('/cart?section_id=mini-cart');
      const text = await response.text();
      const parser = new DOMParser();
      const doc = parser.parseFromString(text, 'text/html');
      const newContent = doc.querySelector('.shopify-section');
      
      if (newContent) {
        const miniCart = document.getElementById('mini-cart');
        if (miniCart) {
          miniCart.innerHTML = newContent.innerHTML;
        }
      }

      // Update cart count
      const cartResponse = await fetch('/cart.js');
      const cart = await cartResponse.json();
      
      const bubbles = document.querySelectorAll('.cart-count-bubble');
      bubbles.forEach(bubble => {
        bubble.textContent = cart.item_count;
        bubble.style.display = cart.item_count > 0 ? 'flex' : 'none';
      });

      // Trigger cart updated event
      document.dispatchEvent(new CustomEvent('cart:updated', {
        detail: { cart: cart }
      }));

    } catch (error) {
      console.error('🎁 Update cart error:', error);
    }
  }

  // UI Updates
  updateUI() {
    const state = this.getState();
    console.log('🎁 Updating UI:', state);

    this.updateTriggerButton(state);
    this.updateGiftSection(state);
    this.updateCheckoutValidation(state);
  }

  updateTriggerButton(state) {
    const trigger = document.getElementById('gift-trigger-container');
    if (!trigger) return;

    // Show trigger if popup was closed without submitting email
    if (state.popupClosed && !state.emailSubmitted && !state.giftInCart) {
      trigger.style.display = 'block';
      console.log('🎁 Showing trigger button');
    } else {
      trigger.style.display = 'none';
      console.log('🎁 Hiding trigger button');
    }
  }

  updateGiftSection(state) {
    const giftSection = document.getElementById('gift-section');
    if (!giftSection) return;

    // Only show gift section if user qualifies
    if (!state.userQualifies) {
      giftSection.style.display = 'none';
      return;
    }

    giftSection.style.display = 'block';

    if (state.giftInCart) {
      // Show gift as added
      giftSection.innerHTML = `
        <div class="gift-bundle-added">
          <div class="gift-bundle-content">
            <div class="gift-bundle-icon">✅</div>
            <div class="gift-bundle-text">
              <h4>Gift Added!</h4>
              <p>Free gift bundle in your cart</p>
            </div>
          </div>
          <button class="button button--small button--tertiary" data-gift-remove>
            Remove
          </button>
        </div>
      `;
    } else {
      // Show add gift option
      giftSection.innerHTML = `
        <div class="gift-bundle-offer">
          <div class="gift-bundle-content">
            <div class="gift-bundle-icon">🎁</div>
            <div class="gift-bundle-text">
              <h4>Free Gift Available!</h4>
              <p>Add your $100 gift bundle</p>
            </div>
          </div>
          <button class="button button--small button--cta" data-gift-add>
            Add Gift
          </button>
        </div>
      `;
    }
  }

  updateCheckoutValidation(state) {
    const checkoutButtons = document.querySelectorAll('button[name="checkout"], button[data-checkout-button]');
    const shouldBlock = state.giftInCart && state.otherItemsCount === 0;

    checkoutButtons.forEach(button => {
      if (shouldBlock) {
        button.disabled = true;
        button.classList.add('button--disabled');
        if (button.textContent.includes('Checkout')) {
          button.textContent = 'Add Item to Checkout';
        }
      } else {
        button.disabled = false;
        button.classList.remove('button--disabled');
        if (button.textContent.includes('Add Item')) {
          button.textContent = 'Checkout';
        }
      }
    });

    // Show/hide validation message
    const validationMessages = document.querySelectorAll('.gift-validation-message');
    validationMessages.forEach(msg => {
      msg.style.display = shouldBlock ? 'block' : 'none';
    });

    console.log('🎁 Checkout validation:', { shouldBlock, buttons: checkoutButtons.length });
  }

  // Debug
  debugState() {
    const state = this.getState();
    console.log('🎁 === GIFT DEBUG STATE ===');
    console.log('State:', state);
    console.log('Gift section:', document.getElementById('gift-section'));
    console.log('Trigger:', document.getElementById('gift-trigger-container'));
    console.log('Popup:', document.getElementById('gift-popup'));
    console.log('Checkout buttons:', document.querySelectorAll('button[name="checkout"], button[data-checkout-button]'));
    console.log('SessionStorage gift-email-submitted:', sessionStorage.getItem('gift-email-submitted'));
    console.log('SessionStorage gift-popup-closed:', sessionStorage.getItem('gift-popup-closed'));
    console.log('Cookie:', document.cookie);
    console.log('=========================');
  }
}

// Initialize when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
  window.giftManager = new SimpleGiftBundleManager();
  console.log('🎁 Gift manager initialized and available as window.giftManager');
});

console.log('🎁 Simple gift bundle script loaded');