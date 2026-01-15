// BXGY Auto-Gift System
// Automatically adds a gift product when customer arrives via discount link and adds any product to cart

(function() {
  'use strict';

  // ===========================================
  // CONFIGURATION
  // ===========================================
  const CONFIG = {
    // Discount code prefix - any code starting with this triggers auto-gift
    discountPrefix: 'BXGY-',
    // Storage key prefix for localStorage
    storageKeyPrefix: 'bxgy-auto-gift',
    // Debug mode - set to false in production
    debug: true,
    // Legacy support: if discount code doesn't contain variant ID, use this default
    defaultGiftVariantId: '43668421771395'
  };

  // Current session state (detected from discount code)
  let currentGiftVariantId = null;

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
   * Parse discount code to extract variant ID
   * Format: BXGY-{variantId} (e.g., BXGY-43668421771395)
   * Returns variant ID or null if not a valid BXGY code
   */
  function parseDiscountCode(code) {
    if (!code) return null;

    const upperCode = code.toUpperCase();
    const prefix = CONFIG.discountPrefix.toUpperCase();

    // Check if code starts with BXGY prefix
    if (upperCode.startsWith(prefix)) {
      const variantPart = code.substring(CONFIG.discountPrefix.length);
      log('Parsed variant ID from discount code:', variantPart);

      // Validate it looks like a variant ID (numeric, reasonable length)
      if (/^\d{10,20}$/.test(variantPart)) {
        return variantPart;
      } else {
        log('Variant part is not a valid ID, using default:', CONFIG.defaultGiftVariantId);
        return CONFIG.defaultGiftVariantId;
      }
    }

    // Legacy support: check for old format codes starting with BXGY (without dash)
    if (upperCode.startsWith('BXGY')) {
      log('Legacy BXGY code detected, using default variant:', CONFIG.defaultGiftVariantId);
      return CONFIG.defaultGiftVariantId;
    }

    return null;
  }

  /**
   * Check if customer arrived via a BXGY discount URL
   * Shopify redirects /discount/CODE to homepage, so we check multiple sources
   */
  function checkDiscountUrl() {
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

    // Method 4: Check window variable set by Liquid (most reliable)
    if (!foundCode && window.bxgyDiscountApplied && window.bxgyAppliedCode) {
      foundCode = window.bxgyAppliedCode;
      source = 'Liquid';
    }

    // Method 5: Check Shopify's discount cookie for BXGY codes
    if (!foundCode) {
      const cookies = document.cookie.split(';');
      for (const cookie of cookies) {
        const [name, value] = cookie.trim().split('=');
        if (name && value && value.toUpperCase().includes('BXGY')) {
          foundCode = decodeURIComponent(value);
          source = 'cookie';
          break;
        }
      }
    }

    if (foundCode) {
      log('Detected discount code:', foundCode, 'via', source);

      // Parse the discount code to extract variant ID
      const variantId = parseDiscountCode(foundCode);

      if (variantId) {
        log('BXGY discount detected! Gift variant ID:', variantId);
        currentGiftVariantId = variantId;
        setEligible(true, variantId, foundCode);
        return true;
      } else {
        log('Not a BXGY discount code, ignoring');
      }
    }

    return false;
  }

  /**
   * Store eligibility in localStorage
   * @param {boolean} value - Whether eligible
   * @param {string} variantId - Gift variant ID
   * @param {string} discountCode - The discount code used
   */
  function setEligible(value, variantId = null, discountCode = null) {
    const storageKey = CONFIG.storageKeyPrefix;
    try {
      if (value) {
        localStorage.setItem(storageKey + '-eligible', 'true');
        localStorage.setItem(storageKey + '-timestamp', Date.now().toString());
        if (variantId) {
          localStorage.setItem(storageKey + '-variant', variantId);
        }
        if (discountCode) {
          localStorage.setItem(storageKey + '-code', discountCode);
        }
        log('Eligibility stored in localStorage (variant:', variantId, ')');
      } else {
        localStorage.removeItem(storageKey + '-eligible');
        localStorage.removeItem(storageKey + '-timestamp');
        localStorage.removeItem(storageKey + '-variant');
        localStorage.removeItem(storageKey + '-code');
        log('Eligibility cleared from localStorage');
      }
    } catch (e) {
      log('localStorage error:', e);
    }
  }

  /**
   * Check if customer is eligible for the gift
   * Also loads the variant ID from storage
   */
  function isEligible() {
    const storageKey = CONFIG.storageKeyPrefix;
    try {
      const eligible = localStorage.getItem(storageKey + '-eligible') === 'true';
      log('Checking eligibility:', eligible);

      if (eligible) {
        // Load variant ID from storage if not already set
        if (!currentGiftVariantId) {
          currentGiftVariantId = localStorage.getItem(storageKey + '-variant') || CONFIG.defaultGiftVariantId;
          log('Loaded variant ID from storage:', currentGiftVariantId);
        }
      }

      return eligible;
    } catch (e) {
      log('localStorage error:', e);
      return false;
    }
  }

  /**
   * Get current gift variant ID
   */
  function getGiftVariantId() {
    return currentGiftVariantId || CONFIG.defaultGiftVariantId;
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
      const giftVariantId = getGiftVariantId();

      const found = cart.items.some(item =>
        item.variant_id.toString() === giftVariantId
      );

      log('Gift in cart check (variant ' + giftVariantId + '):', found);
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
      const giftVariantId = getGiftVariantId();

      const nonGiftItems = cart.items.filter(item =>
        item.variant_id.toString() !== giftVariantId
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

    const giftVariantId = getGiftVariantId();
    addingGift = true;
    log('Adding gift to cart, variant:', giftVariantId);

    try {
      // Get mini-cart sections for UI update
      const miniCart = document.querySelector('mini-cart');
      let sections = [];

      if (miniCart && typeof miniCart.getSectionsToRender === 'function') {
        sections = miniCart.getSectionsToRender().map(section => section.id);
      }

      const body = JSON.stringify({
        id: parseInt(giftVariantId),
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
      log('Current Gift Variant ID:', getGiftVariantId());
      log('Stored Code:', localStorage.getItem(CONFIG.storageKeyPrefix + '-code'));
      log('Config:', CONFIG);
    },

    // Manually set eligibility with a specific variant ID
    setEligible: function(variantId) {
      const vid = variantId || CONFIG.defaultGiftVariantId;
      setEligible(true, vid, 'MANUAL-TEST');
      currentGiftVariantId = vid;
      log('Eligibility set with variant:', vid);
    },

    // Clear all BXGY data
    clear: function() {
      setEligible(false);
      currentGiftVariantId = null;
      log('BXGY data cleared');
      location.reload();
    },

    // Simulate arriving via discount URL with variant ID
    simulate: function(variantId) {
      const vid = variantId || CONFIG.defaultGiftVariantId;
      currentGiftVariantId = vid;
      setEligible(true, vid, 'BXGY-' + vid);
      setupCartListeners();
      log('Simulated discount arrival - variant:', vid);
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
    addGift: function(variantId) {
      if (variantId) {
        currentGiftVariantId = variantId;
      }
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
    },

    // Parse a discount code to test
    parseCode: function(code) {
      const result = parseDiscountCode(code);
      log('Parsed "' + code + '" → variant:', result);
      return result;
    }
  };

  // Run on DOM ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

})();
