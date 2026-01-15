// BXGY Auto-Gift System
// Automatically adds a gift product when customer arrives via discount link and adds any product to cart

(function() {
  'use strict';

  // ===========================================
  // CONFIGURATION
  // ===========================================
  const CONFIG = {
    discountCode: 'BXGY01501b',
    giftVariantId: '43668421771395', // Stardust Nourishing Shampoo variant ID
    storageKey: 'bxgy-eligible',
    debug: true // Set to false in production
  };

  // ===========================================
  // DEBUG LOGGING
  // ===========================================
  function log(...args) {
    if (CONFIG.debug) {
      console.log('🎁 BXGY:', ...args);
    }
  }

  // ===========================================
  // STEP 1: URL DETECTION & ELIGIBILITY
  // ===========================================

  /**
   * Check if customer arrived via the BXGY discount URL
   * Shopify redirects /discount/CODE to homepage, so we check multiple sources:
   * 1. Current URL path (if no redirect yet)
   * 2. URL query parameters (?discount=CODE)
   * 3. document.referrer (catches the redirect from /discount/CODE)
   */
  function checkDiscountUrl() {
    const targetCode = CONFIG.discountCode.toLowerCase();
    let foundCode = null;
    let source = null;

    // Method 1: Check current URL path
    const pathMatch = window.location.pathname.match(/\/discount\/([^\/\?]+)/i);
    if (pathMatch) {
      foundCode = pathMatch[1];
      source = 'URL path';
    }

    // Method 2: Check URL query parameters
    if (!foundCode) {
      const urlParams = new URLSearchParams(window.location.search);
      const paramCode = urlParams.get('discount') || urlParams.get('code') || urlParams.get('coupon');
      if (paramCode) {
        foundCode = paramCode;
        source = 'URL parameter';
      }
    }

    // Method 3: Check document.referrer (catches Shopify's redirect)
    if (!foundCode && document.referrer) {
      try {
        const referrerUrl = new URL(document.referrer);
        const referrerPathMatch = referrerUrl.pathname.match(/\/discount\/([^\/\?]+)/i);
        if (referrerPathMatch) {
          foundCode = referrerPathMatch[1];
          source = 'referrer';
        }
      } catch (e) {
        log('Could not parse referrer:', e);
      }
    }

    // Method 4: Check window variable set by Liquid
    if (!foundCode && window.bxgyDiscountApplied) {
      log('Discount detected via Liquid! Applied code:', window.bxgyAppliedCode);
      setEligible(true);
      return true;
    }

    // Method 5: Check Shopify's discount cookie
    if (!foundCode) {
      const cookies = document.cookie.split(';');
      for (const cookie of cookies) {
        const [name, value] = cookie.trim().split('=');
        // Shopify stores discount codes in various cookies
        if (name && (name.includes('discount') || name.includes('code'))) {
          log('Found cookie:', name, '=', value);
          if (value && value.toLowerCase().includes(targetCode.toLowerCase())) {
            foundCode = value;
            source = 'cookie';
          }
        }
      }
    }

    if (foundCode) {
      log('Detected discount code:', foundCode, 'via', source);

      if (foundCode.toLowerCase() === targetCode) {
        log('Customer eligible for auto-gift (code matches)');
        setEligible(true);
        return true;
      } else {
        log('Code does not match target:', targetCode);
      }
    }

    return false;
  }

  /**
   * Store eligibility in localStorage
   */
  function setEligible(value) {
    try {
      if (value) {
        localStorage.setItem(CONFIG.storageKey, 'true');
        localStorage.setItem(CONFIG.storageKey + '-timestamp', Date.now().toString());
        log('Eligibility stored in localStorage');
      } else {
        localStorage.removeItem(CONFIG.storageKey);
        localStorage.removeItem(CONFIG.storageKey + '-timestamp');
        log('Eligibility cleared from localStorage');
      }
    } catch (e) {
      log('localStorage error:', e);
    }
  }

  /**
   * Check if customer is eligible for the gift
   */
  function isEligible() {
    try {
      const eligible = localStorage.getItem(CONFIG.storageKey) === 'true';
      log('Checking eligibility:', eligible);
      return eligible;
    } catch (e) {
      log('localStorage error:', e);
      return false;
    }
  }

  // ===========================================
  // STEP 2: CART CHANGE DETECTION
  // ===========================================

  // Track if we're currently adding a gift (prevent loops)
  let addingGift = false;

  /**
   * Listen for cart updates from various sources
   */
  function setupCartListeners() {
    // Listen for pub/sub cart updates (from product forms, etc.)
    if (typeof subscribe === 'function' && typeof PUB_SUB_EVENTS !== 'undefined') {
      subscribe(PUB_SUB_EVENTS.cartUpdate, (data) => {
        log('Cart updated via pub/sub, source:', data?.source);
        // Don't react to our own gift additions
        if (data?.source !== 'bxgy-auto-gift') {
          handleCartChange();
        }
      });
      log('Subscribed to PUB_SUB_EVENTS.cartUpdate');
    }

    // Listen for custom cart:updated events
    document.addEventListener('cart:updated', () => {
      log('Cart updated via cart:updated event');
      handleCartChange();
    });

    // Listen for ajaxProduct:added events (from quick add buttons)
    document.addEventListener('ajaxProduct:added', () => {
      log('Product added via ajaxProduct:added event');
      handleCartChange();
    });

    log('Cart listeners set up');
  }

  /**
   * Handle cart change - check eligibility and add gift if needed
   */
  async function handleCartChange() {
    if (addingGift) {
      log('Already adding gift, skipping...');
      return;
    }

    if (!isEligible()) {
      log('Customer not eligible, skipping gift check');
      return;
    }

    log('Customer eligible, checking cart...');

    // Small delay to ensure cart API has updated
    await new Promise(resolve => setTimeout(resolve, 300));

    const giftInCart = await isGiftInCart();
    if (giftInCart) {
      log('Gift already in cart, no action needed');
      return;
    }

    const hasProducts = await cartHasProducts();
    if (!hasProducts) {
      log('Cart is empty, waiting for products...');
      return;
    }

    log('Cart has products and gift is not in cart - adding gift!');
    await addGiftToCart();
  }

  // ===========================================
  // STEP 3: GIFT IN CART CHECK
  // ===========================================

  /**
   * Check if the gift product is already in the cart
   */
  async function isGiftInCart() {
    try {
      const response = await fetch('/cart.js');
      const cart = await response.json();

      const found = cart.items.some(item =>
        item.variant_id.toString() === CONFIG.giftVariantId
      );

      log('Gift in cart check:', found);
      return found;
    } catch (e) {
      log('Error checking cart:', e);
      return false;
    }
  }

  /**
   * Check if cart has any products (excluding the gift)
   */
  async function cartHasProducts() {
    try {
      const response = await fetch('/cart.js');
      const cart = await response.json();

      const nonGiftItems = cart.items.filter(item =>
        item.variant_id.toString() !== CONFIG.giftVariantId
      );

      log('Non-gift items in cart:', nonGiftItems.length);
      return nonGiftItems.length > 0;
    } catch (e) {
      log('Error checking cart:', e);
      return false;
    }
  }

  // ===========================================
  // STEP 4: AUTO-ADD GIFT
  // ===========================================

  /**
   * Add the gift product to cart automatically
   */
  async function addGiftToCart() {
    if (addingGift) {
      log('Already adding gift, preventing duplicate');
      return;
    }

    addingGift = true;
    log('Adding gift to cart, variant:', CONFIG.giftVariantId);

    try {
      // Get mini-cart sections for UI update
      const miniCart = document.querySelector('mini-cart');
      let sections = [];

      if (miniCart && typeof miniCart.getSectionsToRender === 'function') {
        sections = miniCart.getSectionsToRender().map(section => section.id);
      }

      const body = JSON.stringify({
        id: parseInt(CONFIG.giftVariantId),
        quantity: 1,
        sections: sections,
        sections_url: window.location.pathname
      });

      const response = await fetch('/cart/add.js', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Requested-With': 'XMLHttpRequest'
        },
        body: body
      });

      if (response.ok) {
        const parsedState = await response.json();
        log('Gift added successfully!', parsedState);

        // Update mini-cart UI if available
        if (miniCart && typeof miniCart.renderContents === 'function') {
          miniCart.renderContents(parsedState);
          log('Mini-cart UI updated');
        }

        // Dispatch event for other components
        document.dispatchEvent(new CustomEvent('cart:updated', {
          detail: { source: 'bxgy-auto-gift' }
        }));

        // Publish to pub/sub if available
        if (typeof publish === 'function' && typeof PUB_SUB_EVENTS !== 'undefined') {
          publish(PUB_SUB_EVENTS.cartUpdate, { source: 'bxgy-auto-gift' });
        }

      } else {
        const errorData = await response.json();
        log('Failed to add gift:', errorData);

        // Handle out of stock
        if (response.status === 422) {
          log('Gift may be out of stock or unavailable');
        }
      }
    } catch (e) {
      log('Error adding gift:', e);
    } finally {
      addingGift = false;
    }
  }

  // ===========================================
  // INITIALIZATION
  // ===========================================
  function init() {
    log('Initializing BXGY Auto-Gift System');
    log('Config:', CONFIG);

    // Step 1: Check URL for discount code
    const urlHasCode = checkDiscountUrl();

    // Log current eligibility status (persists across pages)
    const currentlyEligible = isEligible();
    log('Current eligibility status:', currentlyEligible);

    if (currentlyEligible) {
      log('Customer IS eligible for BXGY auto-gift');

      // Step 2: Set up cart listeners
      setupCartListeners();

      // Also check cart immediately (in case products already exist)
      setTimeout(() => {
        handleCartChange();
      }, 500);
    } else {
      log('Customer is NOT eligible (did not come via discount link)');
    }
  }

  // ===========================================
  // TEST HELPERS (for manual testing)
  // ===========================================
  window.bxgyTest = {
    // Check current state
    status: function() {
      log('=== BXGY Status ===');
      log('Eligible:', isEligible());
      log('Config:', CONFIG);
      log('Variant ID:', CONFIG.giftVariantId);
    },

    // Manually set eligibility (for testing)
    setEligible: function(value) {
      setEligible(value);
      log('Eligibility set to:', value);
    },

    // Clear all BXGY data
    clear: function() {
      setEligible(false);
      log('BXGY data cleared');
      location.reload();
    },

    // Simulate arriving via discount URL and set up listeners
    simulate: function() {
      setEligible(true);
      setupCartListeners();
      log('Simulated discount URL arrival - customer now eligible, listeners active');
      log('Now add a product to cart to trigger auto-gift');
    },

    // Manually check cart and add gift if eligible
    checkCart: function() {
      handleCartChange();
    },

    // Check if gift is in cart
    isGiftInCart: async function() {
      const result = await isGiftInCart();
      log('Gift in cart:', result);
      return result;
    },

    // Manually add gift (bypass eligibility check)
    addGift: function() {
      addGiftToCart();
    },

    // Show all cookies (for debugging)
    showCookies: function() {
      log('=== All Cookies ===');
      document.cookie.split(';').forEach(c => {
        const [name, value] = c.trim().split('=');
        console.log(name, '=', value);
      });
    },

    // Check Liquid variable
    checkLiquid: function() {
      log('bxgyDiscountApplied:', window.bxgyDiscountApplied);
      log('bxgyAppliedCode:', window.bxgyAppliedCode);
    }
  };

  // Run on DOM ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

})();
