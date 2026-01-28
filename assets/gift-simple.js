// Ultra Simple Gift Bundle
// Silent mode - disabled for production
const simpleGiftDebugLog = () => {};

// Get settings from admin (fallback to defaults)
function getSettings() {
  return window.giftBundleSettings || {
    variantId: '43694372257923',
    popupHeading: 'Get Your Free Gift!',
    popupSubheading: 'Subscribe to our newsletter and get a free gift bundle worth $100!',
    popupButtonText: 'Get Free Gift',
    claimButtonText: 'Claim Gift',
    giftValueText: '$100',
    triggerText: 'Claim your free gift',
    triggerSubtext: 'Get $100 bundle',
    validationMessage: 'Add 1 more item for free gift',
    giftAddedMessage: 'Gift bundle added',
    couponCode: 'freebundle',
    showPopupDelay: 5000,
    enabled: true,
    storageType: 'session'
  };
}

// Storage helper functions
function getStorage() {
  const settings = getSettings();
  return settings.storageType === 'local' ? localStorage : sessionStorage;
}

function setStorageItem(key, value) {
  const storage = getStorage();
  storage.setItem(key, value);
}

function getStorageItem(key) {
  const storage = getStorage();
  return storage.getItem(key);
}

function clearStorageItems() {
  const storage = getStorage();
  const keys = ['gift-email-submitted', 'gift-popup-closed', 'gift-coupon-used', 'gift-trigger-dismissed'];
  keys.forEach(key => storage.removeItem(key));
}

// Simple state check
function isEmailSubmitted() {
  return getStorageItem('gift-email-submitted') === 'true';
}

function isPopupClosed() {
  return getStorageItem('gift-popup-closed') === 'true';
}

// Cache cart data
let cartCache = null;
let cartCacheTime = 0;

async function updateCartCache() {
  try {
    const response = await fetch('/cart.js');
    if (!response.ok) {
      console.error('🎁 Failed to fetch cart:', response.status, response.statusText);
      return null;
    }
    const text = await response.text();
    try {
      const cartData = JSON.parse(text);
      cartCache = cartData;
      cartCacheTime = Date.now();
      return cartData;
    } catch (parseError) {
      console.error('🎁 Cart response is not JSON:', text.substring(0, 200));
      return null;
    }
  } catch (e) {
    console.error('🎁 Error fetching cart:', e);
    return null;
  }
}

function getCartData() {
  // Cache for 2 seconds
  if (cartCache && (Date.now() - cartCacheTime) < 2000) {
    return cartCache;
  }
  
  // Update cache asynchronously
  updateCartCache();
  
  return cartCache;
}

function isGiftInCart() {
  const settings = getSettings();
  
  // Try to get cached cart data
  const cartData = getCartData();
  if (cartData && cartData.items) {
    return cartData.items.some(item => item.variant_id.toString() === settings.variantId);
  }
  
  // Fallback to DOM selectors - much more comprehensive
  const selectors = [
    `[data-variant-id="${settings.variantId}"]`,
    `[data-variant="${settings.variantId}"]`, 
    `[data-product-id="${settings.variantId}"]`,
    `[data-line-item-id*="${settings.variantId}"]`,
    `.cart-item[data-variant-id="${settings.variantId}"]`,
    `.line-item[data-variant-id="${settings.variantId}"]`,
    `.cart__item[data-variant-id="${settings.variantId}"]`
  ];
  
  for (const selector of selectors) {
    if (document.querySelector(selector)) {
      return true;
    }
  }
  
  // Check all elements with variant data
  const allVariantElements = document.querySelectorAll('[data-variant-id], [data-variant], [data-product-id]');
  return Array.from(allVariantElements).some(elem => {
    return elem.dataset.variantId === settings.variantId ||
           elem.dataset.variant === settings.variantId ||
           elem.dataset.productId === settings.variantId ||
           elem.textContent.includes(settings.variantId);
  });
}

function getOtherItemsCount() {
  const settings = getSettings();
  
  // Try to get cached cart data
  const cartData = getCartData();
  if (cartData && cartData.items) {
    return cartData.items.filter(item => item.variant_id.toString() !== settings.variantId).length;
  }
  
  // Fallback to DOM counting
  const allVariantElements = document.querySelectorAll('[data-variant-id], [data-variant], [data-product-id]');
  return Array.from(allVariantElements).filter(elem => {
    return elem.dataset.variantId !== settings.variantId &&
           elem.dataset.variant !== settings.variantId &&
           elem.dataset.productId !== settings.variantId &&
           !elem.textContent.includes(settings.variantId);
  }).length;
}

function shouldShowClaimButton() {
  // Show if email submitted OR popup was closed OR coupon was used, but gift not in cart
  const couponUsed = getStorageItem('gift-coupon-used') === 'true';
  return (isEmailSubmitted() || isPopupClosed() || couponUsed) && !isGiftInCart();
}

function customerQualifiesForGift() {
  return isEmailSubmitted() || isPopupClosed() || getStorageItem('gift-coupon-used') === 'true';
}

// Check for discount code in URL
function checkForCoupon() {
  const settings = getSettings();
  
  // Check URL parameters first
  const urlParams = new URLSearchParams(window.location.search);
  const discount = urlParams.get('discount') || urlParams.get('coupon') || urlParams.get('code');
  
  // Check URL path for /discount/code format
  const pathMatch = window.location.pathname.match(/\/discount\/([^\/\?]+)/);
  const pathDiscount = pathMatch ? pathMatch[1] : null;
  
  const foundCode = discount || pathDiscount;
  
  if (foundCode && foundCode.toLowerCase() === settings.couponCode.toLowerCase()) {
    // Mark as coupon used to skip popup - set all flags immediately
    setStorageItem('gift-email-submitted', 'true');
    setStorageItem('gift-coupon-used', 'true');
    setStorageItem('gift-popup-closed', 'true');

    // Add gift to cart immediately
    // DISABLED: auto-add not needed, user will click "ADD GIFT" button manually
    /* setTimeout(() => {
      addGiftToCart();
    }, 500); */
    
    // Clean URL only if it was from parameters, not discount path
    if (discount && !pathDiscount) {
      const cleanUrl = window.location.pathname;
      window.history.replaceState({}, document.title, cleanUrl);
    }
    
    return true;
  }
  
  return false;
}

// Submit email to Omnisend (using same logic as waitlist)
async function submitToOmnisend(email) {
  const OMNISEND_API_KEY = '66b4f08d3245832d9dfc8e4c-pGw52OhTA5rgmbd7iyaBEfnhHqwMJ317fyvHhAqsumBn1H1gES';
  const settings = getSettings();
  
  
  try {
    // Check if email is valid first
    if (!isValidEmail(email)) {
      console.error('🎁 Invalid email format');
      return false;
    }
    
    // Check for existing contact first
    const existingContact = await getExistingContact(email, OMNISEND_API_KEY);
    
    const customProperties = {
      gift_bundle_claimed: 'true',
      gift_bundle_date: new Date().toISOString(),
      gift_bundle_value: settings.giftValueText,
      gift_bundle_source: 'gift-popup',
      gift_bundle_variant_id: settings.variantId
    };
    
    let response;
    
    if (existingContact) {
      // Update existing contact
      response = await fetch(`https://api.omnisend.com/v3/contacts/${existingContact.contactID}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'X-API-Key': OMNISEND_API_KEY
        },
        body: JSON.stringify({ 
          customProperties, 
          tags: ['gift-bundle']
        })
      });
    } else {
      simpleGiftDebugLog('🎁 Creating new contact');
      // Create new contact
      response = await fetch('https://api.omnisend.com/v3/contacts', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-API-Key': OMNISEND_API_KEY
        },
        body: JSON.stringify({
          email,
          status: 'subscribed',
          statusDate: new Date().toISOString(),
          tags: ['gift-bundle'],
          customProperties
        })
      });
    }
    
    simpleGiftDebugLog('🎁 Omnisend API response status:', response.status);
    
    if (response.ok) {
      const responseData = await response.json();
      simpleGiftDebugLog('🎁 Omnisend API successful:', responseData);
      
      // Try to send event
      try {
        await sendGiftBundleEvent(email, settings);
      } catch (e) {
        console.warn('🎁 Event sending failed but contact created:', e);
      }
      
      return true;
    } else {
      console.warn('🎁 Omnisend API failed, trying fallback approaches');
      
      // Try simple approach fallback
      const simpleSuccess = await trySimpleApproach(email, settings, OMNISEND_API_KEY, existingContact);
      if (simpleSuccess) return true;
      
      // Try SDK fallback
      const sdkSuccess = await trySDKFallback(email, settings);
      return sdkSuccess;
    }
    
  } catch (error) {
    console.error('🎁 Omnisend submission error:', error);
    
    // Try SDK fallback on any error
    return await trySDKFallback(email, settings);
  }
}

// Helper functions (same as waitlist)
function isValidEmail(email) {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email) && email.length <= 100;
}

async function getExistingContact(email, apiKey) {
  try {
    const search = await fetch(`https://api.omnisend.com/v3/contacts?email=${encodeURIComponent(email)}`, {
      method: 'GET',
      headers: { 'Content-Type': 'application/json', 'X-API-Key': apiKey }
    });
    
    if (search.ok) {
      const data = await search.json();
      if (data.contacts?.length) {
        return data.contacts[0];
      }
    }
  } catch (e) {
    console.warn('🎁 Failed to check existing contact:', e);
  }
  return null;
}

async function trySimpleApproach(email, settings, apiKey, existingContact) {
  try {
    const simpleProps = {
      gift_bundle_claimed: 'true',
      gift_bundle_date: new Date().toISOString(),
      gift_bundle_value: settings.giftValueText,
      gift_bundle_source: 'gift-popup'
    };
    
    let res;
    if (existingContact) {
      res = await fetch(`https://api.omnisend.com/v3/contacts/${existingContact.contactID}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'X-API-Key': apiKey
        },
        body: JSON.stringify({ customProperties: simpleProps, tags: ['gift-bundle'] })
      });
    } else {
      res = await fetch('https://api.omnisend.com/v3/contacts', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-API-Key': apiKey
        },
        body: JSON.stringify({ email, tags: ['gift-bundle'], customProperties: simpleProps })
      });
    }
    
    if (res.ok) {
      simpleGiftDebugLog('🎁 Simple approach worked!');
      return true;
    }
  } catch (e) {
    console.warn('🎁 Simple approach failed:', e);
  }
  return false;
}

async function trySDKFallback(email, settings) {
  try {
    if (typeof window.omnisend === 'function') {
      simpleGiftDebugLog('🎁 Using Omnisend SDK function approach');
      window.omnisend('identify', {
        email,
        tags: ['gift-bundle'],
        properties: {
          gift_bundle_claimed: 'true',
          gift_bundle_date: new Date().toISOString(),
          gift_bundle_value: settings.giftValueText,
          gift_bundle_source: 'gift-popup'
        }
      });
      simpleGiftDebugLog('🎁 SDK identify successful');
      return true;
    } else if (window.omnisend && Array.isArray(window.omnisend)) {
      simpleGiftDebugLog('🎁 Using Omnisend SDK array approach');
      window.omnisend.push(['identify', {
        email,
        tags: ['gift-bundle'],
        properties: {
          gift_bundle_claimed: 'true',
          gift_bundle_date: new Date().toISOString(),
          gift_bundle_value: settings.giftValueText,
          gift_bundle_source: 'gift-popup'
        }
      }]);
      simpleGiftDebugLog('🎁 SDK push successful');
      return true;
    }
  } catch (e) {
    console.warn('🎁 SDK fallback failed:', e);
  }
  return false;
}

async function sendGiftBundleEvent(email, settings) {
  const OMNISEND_API_KEY = '66b4f08d3245832d9dfc8e4c-pGw52OhTA5rgmbd7iyaBEfnhHqwMJ317fyvHhAqsumBn1H1gES';
  
  const eventFields = {
    gift_bundle_value: settings.giftValueText,
    gift_bundle_variant_id: settings.variantId,
    gift_bundle_source: 'gift-popup',
    gift_bundle_date: new Date().toISOString()
  };
  
  try {
    // Try v3 events API first
    let res = await fetch('https://api.omnisend.com/v3/events', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-API-Key': OMNISEND_API_KEY
      },
      body: JSON.stringify({
        email,
        eventName: 'gift_bundle_claimed',
        fields: eventFields
      })
    });
    
    if (res.ok) {
      simpleGiftDebugLog('🎁 Event sent successfully');
      return true;
    }
    
    // Try v5 events API as fallback
    res = await fetch('https://api.omnisend.com/v5/events', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-API-Key': OMNISEND_API_KEY
      },
      body: JSON.stringify({
        eventName: 'gift_bundle_claimed',
        origin: 'api',
        contact: { email },
        properties: eventFields
      })
    });
    
    if (res.ok) {
      simpleGiftDebugLog('🎁 Event sent via v5 API');
      return true;
    }
    
  } catch (e) {
    console.warn('🎁 Failed to send event:', e);
  }
  
  return false;
}

// Show popup after delay if not submitted email and no coupon
function maybeShowPopup() {
  const settings = getSettings();
  
  if (!settings.enabled) {
    return;
  }
  
  // ГОЛОВНА ПЕРЕВІРКА: якщо gift вже в кошику - не показувати popup
  if (isGiftInCart()) {
    return;
  }
  
  // Check for coupon first - if found, don't show popup
  const couponFound = checkForCoupon();
  if (couponFound) {
    return;
  }
  
  // Check if coupon was already used this session
  if (getStorageItem('gift-coupon-used') === 'true') {
    return;
  }
  
  // Check if email was already submitted or popup was closed
  if (isEmailSubmitted() || isPopupClosed()) {
    return;
  }
  
  setTimeout(() => {
    // ПОВТОРНА ПЕРЕВІРКА: якщо gift додався за час очікування
    if (isGiftInCart()) {
      return;
    }
    
    // Triple check before showing popup
    if (getStorageItem('gift-coupon-used') === 'true') {
      return;
    }
    
    if (isEmailSubmitted() || isPopupClosed()) {
      return;
    }
    
    const popup = document.getElementById('gift-popup');
    if (popup) {
      popup.classList.add('is-visible');
      popup.classList.remove('is-hidden');
    }
  }, settings.showPopupDelay);
}

// Add gift to cart (with duplicate prevention)
let giftAddInProgress = false; // Prevent multiple simultaneous calls

async function addGiftToCart(clickedButton = null) {
  const settings = getSettings();

  // Prevent multiple simultaneous calls
  if (giftAddInProgress) {
    return;
  }

  giftAddInProgress = true;

  try {
    // Check if we're on main cart page or mini-cart
    const miniCart = document.querySelector('mini-cart');
    const cartItems = document.querySelector('cart-items');

    let sections = [];

    if (miniCart && typeof miniCart.getSectionsToRender === 'function') {
      sections = miniCart.getSectionsToRender().map((section) => section.id);
    } else if (cartItems && typeof cartItems.getSectionsToRender === 'function') {
      sections = cartItems.getSectionsToRender().map((section) => section.section);
    }

    // Add gift with sections
    const body = JSON.stringify({
      id: 43694372257923,
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
      const text = await response.text();
      let parsedState;
      try {
        parsedState = JSON.parse(text);
      } catch (parseError) {
        console.error('🎁 Add to cart response is not JSON:', text.substring(0, 200));
        giftAddInProgress = false;
        return;
      }
  console.log('🎁 Gift added successfully');

  // Update cart WITHOUT reload - support both mini-cart and main cart
  if (miniCart && typeof miniCart.renderContents === 'function') {
    miniCart.renderContents(parsedState);

    // Ховаємо gift-section
    const giftSection = document.querySelector('.mini-cart__gift-section');
    if (giftSection) {
       localStorage.setItem('giftHidden', 'true');
    }

    giftAddInProgress = false;
  } else if (cartItems) {
    // For main cart page - reload the page
    window.location.reload();
  } else {
    giftAddInProgress = false;
  }
} else {
      const errorData = await response.json();
      console.error('🎁 Failed to add gift:', errorData);
      giftAddInProgress = false;
    }
  } catch (error) {
    console.error('🎁 Error adding gift:', error);
    giftAddInProgress = false;
  }
}


// Handle events
document.addEventListener('click', (e) => {
  // Close popup
  if (e.target.closest('[data-popup-close]')) {
    const popup = document.getElementById('gift-popup');
    if (popup) {
      popup.classList.remove('is-visible');
      popup.classList.add('is-hidden');
      setStorageItem('gift-popup-closed', 'true');
      simpleGiftDebugLog('🎁 Popup closed');
    }
  }

  // Trigger popup
  if (e.target.closest('[data-gift-popup-trigger]')) {
    const popup = document.getElementById('gift-popup');
    if (popup) {
      popup.classList.add('is-visible');
      popup.classList.remove('is-hidden');
      simpleGiftDebugLog('🎁 Popup triggered');
    }
  }

  // Close trigger button
  if (e.target.closest('[data-gift-trigger-close]')) {
    const trigger = document.getElementById('gift-trigger-container');
    if (trigger) {
      trigger.style.display = 'none';
      setStorageItem('gift-trigger-dismissed', 'true');
      simpleGiftDebugLog('🎁 Trigger dismissed');
    }
  }

  // Add gift button
  if (e.target.closest('[data-gift-add]')) {
    e.preventDefault();
    const clickedButton = e.target.closest('[data-gift-add]');
    addGiftToCart(clickedButton);
  }
});

// Handle email form
document.addEventListener('submit', async (e) => {
  if (e.target.id === 'gift-email-form') {
    e.preventDefault();
    
    const email = e.target.querySelector('input[type="email"]').value;
    const submitBtn = e.target.querySelector('button[type="submit"]');
    
    if (!email) {
      alert('Please enter email');
      return;
    }
    
    // Show loading
    submitBtn.disabled = true;
    submitBtn.textContent = 'Adding gift...';
    
    try {
      // Submit to Omnisend first
      await submitToOmnisend(email);

      // Mark email as submitted
      setStorageItem('gift-email-submitted', 'true');

      // Add gift
      // DISABLED: auto-add not needed, user will click "ADD GIFT" button manually
      // await addGiftToCart();

      // Show success
      submitBtn.textContent = '✅ Subscribed!';
      
      // Close popup after delay
      setTimeout(() => {
        const popup = document.getElementById('gift-popup');
        if (popup) {
          popup.classList.remove('is-visible');
          popup.classList.add('is-hidden');
          setStorageItem('gift-popup-closed', 'true');
        }
      }, 2000);
      
    } catch (error) {
      console.error('🎁 Email submission error:', error);
      alert('Something went wrong. Please try again.');
      submitBtn.disabled = false;
      submitBtn.textContent = 'Get Free Gift';
    }
  }
});

// Ensure only 1 gift in cart
async function enforceGiftQuantity() {
  const settings = getSettings();

  try {
    const cartResponse = await fetch('/cart.js');
    const cartData = await cartResponse.json();

    // Find gift item in cart
    const giftItem = cartData.items.find(item => item.variant_id.toString() === settings.variantId);

    if (giftItem && giftItem.quantity > 1) {
      simpleGiftDebugLog('🎁 Multiple gift items found, reducing to 1');

      // Update quantity to 1
      await fetch('/cart/change.js', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: giftItem.key,
          quantity: 1
        })
      });

      // Reload to update UI
      window.location.reload();
    }
  } catch (error) {
    console.error('🎁 Error enforcing gift quantity:', error);
  }
}

// Auto-remove gift if customer no longer qualifies (< 2 products)
let autoRemoveInProgress = false;

async function autoRemoveGiftIfNotQualified() {
  if (autoRemoveInProgress) {
    console.log('🎁 Auto-remove already in progress, skipping');
    return;
  }

  autoRemoveInProgress = true;
  console.log('🎁 Checking if gift should be removed...');

  const checkoutButton = document.querySelector('[data-checkout-button]');
  if (checkoutButton) {
    checkoutButton.setAttribute('disabled', 'disabled');
    checkoutButton.disabled = true;
  }

  try {
    const cartResponse = await fetch('/cart.js');

    if (!cartResponse.ok) {
      console.error('🎁 Failed to fetch cart:', cartResponse.status, cartResponse.statusText);
      autoRemoveInProgress = false;
      if (checkoutButton) {
        checkoutButton.removeAttribute('disabled');
        checkoutButton.disabled = false;
      }
      return;
    }

    const cartText = await cartResponse.text();
    let cartData;
    try {
      cartData = JSON.parse(cartText);
    } catch (parseError) {
      console.error('🎁 Cart response is not JSON:', cartText.substring(0, 200));
      autoRemoveInProgress = false;
      if (checkoutButton) {
        checkoutButton.removeAttribute('disabled');
        checkoutButton.disabled = false;
      }
      return;
    }

    console.log('🎁 Cart data:', cartData.items.length, 'items');

    // шукаємо подарунок з ID 43694372257923
    const giftItem = cartData.items.find(
      item => item.variant_id.toString() === "43694372257923"
    );

    if (!giftItem) {
      console.log('🎁 Gift product 43694372257923 not found in cart');
      localStorage.setItem('giftHidden', 'false'); // 👉 немає подарунка

      autoRemoveInProgress = false;
      if (checkoutButton) {
        checkoutButton.removeAttribute('disabled');
        checkoutButton.disabled = false;
      }
      return;
    }

    console.log('🎁 Gift found in cart');
    localStorage.setItem('giftHidden', 'true'); // 👉 подарунок є

    // рахуємо інші товари
    const otherItemsCount = cartData.items
      .filter(item => item.variant_id.toString() !== "43694372257923")
      .reduce((total, item) => total + item.quantity, 0);

    console.log('🎁 Other items count:', otherItemsCount);

    if (otherItemsCount < 2) {
      console.log('🎁 Removing gift - not enough items (need 2, have', otherItemsCount, ')');

      const miniCart = document.querySelector('mini-cart');
      const sections = miniCart ? miniCart.getSectionsToRender().map(s => s.id) : [];

      const removeResponse = await fetch('/cart/change.js', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Requested-With': 'XMLHttpRequest'
        },
        body: JSON.stringify({
          id: giftItem.key,
          quantity: 0,
          sections: sections,
          sections_url: window.location.pathname
        })
      });

      if (removeResponse.ok) {
        console.log('🎁 Gift removed successfully');
        const parsedState = await removeResponse.json();

        if (miniCart && typeof miniCart.renderContents === 'function') {
          miniCart.renderContents(parsedState);
          console.log('🎁 Cart UI updated instantly via renderContents');
        }

        if (document.body.classList.contains('template-cart')) {
          window.location.reload();
        }
      }
    } else {
      console.log('🎁 Gift qualifies - keeping it (', otherItemsCount, 'items)');
      if (checkoutButton) {
        checkoutButton.removeAttribute('disabled');
        checkoutButton.disabled = false;
      }
    }

    autoRemoveInProgress = false;
  } catch (error) {
    console.error('🎁 Error auto-removing gift:', error);
    autoRemoveInProgress = false;
  }
}
// Validate checkout buttons
function validateCheckout() {
  const giftInCart = isGiftInCart();
  const otherItems = getOtherItemsCount();
  const shouldBlock = giftInCart && otherItems === 0;
  
  // Для mini-cart використовуємо дані з Liquid якщо доступні
  const miniCartShouldBlock = (typeof window.miniCartGiftInCart !== 'undefined' && typeof window.miniCartNonGiftItemsCount !== 'undefined') 
    ? window.miniCartGiftInCart && window.miniCartNonGiftItemsCount === 0
    : shouldBlock;
  
  // Знайти всі кнопки чекауту
  const checkoutButtons = document.querySelectorAll(`
    button[name="checkout"], 
    button[data-checkout-button],
    input[name="checkout"],
    .cart__checkout-button,
    .button[type="submit"]
  `.replace(/\s+/g, ' ').trim());
  
  // Відфільтрувати newsletter кнопки та mini-cart кнопки (для них Liquid керує validation)
  const filteredButtons = Array.from(checkoutButtons).filter(button => {
    const buttonText = button.textContent.toLowerCase();
    const buttonParent = button.closest('.newsletter, .footer, [class*="newsletter"], [class*="subscribe"]');
    const isMiniCartButton = button.closest('.mini-cart, .drawer, .cart-drawer');
    return !buttonParent && 
           !isMiniCartButton &&
           !buttonText.includes('newsletter') && 
           !buttonText.includes('subscribe');
  });
  
  // Також обробити mini-cart кнопки окремо (без створення повідомлень)
  const miniCartButtons = Array.from(checkoutButtons).filter(button => {
    return button.closest('.mini-cart, .drawer, .cart-drawer');
  });
  
  // DISABLED: No validation or button text changes needed
  // Mini-cart buttons should always be enabled with "Checkout" text
  miniCartButtons.forEach(button => {
    // Always enable button
    button.disabled = false;
    button.classList.remove('button--disabled');
    button.removeAttribute('disabled');

    // Always restore "Checkout" text if it was changed
    if (button.textContent.includes('Add Item')) {
      button.textContent = 'Checkout';
    }
  });
  
  // Показати/сховати validation в mini-cart через gift-validation-container
  const miniCartValidationContainer = document.getElementById('gift-validation-container');
  if (miniCartValidationContainer && miniCartButtons.length > 0) {
    if (miniCartShouldBlock) {
      // Заповнити контейнер якщо він порожній
      if (!miniCartValidationContainer.innerHTML.trim()) {
        miniCartValidationContainer.innerHTML = `
          <div class="gift-validation-message" style="
            background: #f8f9fa;
            border: 1px solid #e9ecef;
            color: #6c757d;
            padding: 12px 16px;
            border-radius: 4px;
            margin: 16px 20px;
            text-align: center;
            font-size: 14px;
          ">
            <div class="gift-validation-text">Add one more item to cart to proceed with checkout</div>
          </div>
        `;
      }
      miniCartValidationContainer.style.display = 'block';
    } else {
      miniCartValidationContainer.style.display = 'none';
    }
  }

  // DISABLED: No validation or button text changes needed
  // Regular cart buttons should always be enabled with "Checkout" text
  filteredButtons.forEach(button => {
    // Always enable button
    button.disabled = false;
    button.classList.remove('button--disabled');
    button.removeAttribute('disabled');

    // Always restore "Checkout" text if it was changed
    if (button.textContent.includes('Add Item')) {
      button.textContent = 'Checkout';
    }
  });

  // DISABLED: Remove all validation messages from DOM
  // Find and remove all validation messages
  const validationContainers = document.querySelectorAll('.cart__validation-section, .gift-validation-message, #gift-validation-container');
  validationContainers.forEach(container => {
    if (container) {
      container.remove();
    }
  });
}

// Update claim gift buttons - managed via JS so Liquid can stay simple
async function updateClaimButtons() {
  const mainCartGiftSection = document.querySelector('[data-gift-main-offer]');
  const miniCartGiftSection = document.querySelector('[data-mini-gift-offer]');

  if (!mainCartGiftSection && !miniCartGiftSection) {
    return;
  }

  try {
    const settings = getSettings();
    const giftVariantId = settings.variantId ? settings.variantId.toString() : '';

    let cartData = await updateCartCache();
    if (!cartData) {
      cartData = getCartData();
    }

    if (!cartData) {
      console.error('🎁 updateClaimButtons: Failed to get cart data');
      return;
    }

    let nonGiftItemsCount = 0;
    let giftInCart = false;
    let totalItemsCount = 0;

    if (cartData && Array.isArray(cartData.items)) {
      cartData.items.forEach((item) => {
        const quantity = parseInt(item.quantity, 10) || 0;
        const isGiftVariant = item.variant_id && item.variant_id.toString() === giftVariantId;

        if (isGiftVariant) {
          giftInCart = true;
        } else {
          nonGiftItemsCount += quantity;
        }

        totalItemsCount += quantity;
      });
    } else {
      nonGiftItemsCount = getOtherItemsCount();
      giftInCart = isGiftInCart();
      totalItemsCount = nonGiftItemsCount + (giftInCart ? 1 : 0);
    }

    const cartHasItems = totalItemsCount > 0;
    const shouldShowGiftSection = cartHasItems && nonGiftItemsCount >= 2 && !giftInCart;

    // Update localStorage to control mini-cart gift section visibility
    if (giftInCart) {
      localStorage.setItem('giftHidden', 'true');
    } else if (shouldShowGiftSection) {
      localStorage.setItem('giftHidden', 'false');
    }

    if (mainCartGiftSection) {
      mainCartGiftSection.toggleAttribute('hidden', !shouldShowGiftSection);
    }

    if (miniCartGiftSection) {
      miniCartGiftSection.toggleAttribute('hidden', !shouldShowGiftSection);
    }

    // Also control mini-cart gift section via class selector (Liquid-rendered)
    const miniCartGiftSectionLiquid = document.querySelector('.mini-cart__gift-section');
    if (miniCartGiftSectionLiquid) {
      if (shouldShowGiftSection) {
        miniCartGiftSectionLiquid.style.display = 'block';
      } else {
        miniCartGiftSectionLiquid.style.display = 'none';
      }
    }

    if (typeof window !== 'undefined') {
      window.cartNonGiftItemsCount = nonGiftItemsCount;
      window.cartHasGift = giftInCart;
    }
  } catch (error) {
    simpleGiftDebugLog('🎁 updateClaimButtons error', error);
  }
}

// 🔹 Приклад простої реалізації getOtherItemsCount (щоб код не ламався)
function getOtherItemsCount() {
  const inputs = document.querySelectorAll('.quantity__input');
  let total = 0;

  inputs.forEach(input => {
    const quantity = parseInt(input.value, 10) || 0;
    total += quantity;
  });

  return total;
}


// Initialize when page loads
document.addEventListener('DOMContentLoaded', () => {
  // Check Omnisend availability
  simpleGiftDebugLog('🎁 Omnisend function available:', typeof window.omnisend === 'function');
  simpleGiftDebugLog('🎁 Omnisend array available:', window.omnisend && Array.isArray(window.omnisend));
  simpleGiftDebugLog('🎁 Omnisend object:', window.omnisend);
  
  maybeShowPopup();

  // Update claim buttons immediately and with delay to ensure cart data is loaded
  updateClaimButtons();
  setTimeout(() => {
    updateClaimButtons();
  }, 500);

  // enforceGiftQuantity(); // DISABLED: allow multiple gift quantities
  // validateCheckout(); // DISABLED: no validation needed
  
  // Prevent cart form submission if only gift
  document.addEventListener('submit', (e) => {
    const form = e.target;
    if (form.action && (form.action.includes('/checkout') || form.action.includes('/cart'))) {
      const giftInCart = isGiftInCart();
      const otherItems = getOtherItemsCount();
      const shouldBlock = giftInCart && otherItems === 0;
      
      if (shouldBlock) {
        e.preventDefault();
        e.stopPropagation();
        simpleGiftDebugLog('🎁 Blocked checkout form submission - only gift in cart');
        
        const settings = getSettings();
        // alert(settings.validationMessage || 'Add 1 more item for free gift');
        return false;
      }
    }
  });
  
  // Prevent checkout link navigation
  document.addEventListener('click', (e) => {
    const link = e.target.closest('a[href*="/checkout"]');
    if (link) {
      const giftInCart = isGiftInCart();
      const otherItems = getOtherItemsCount();
      const shouldBlock = giftInCart && otherItems === 0;
      
      if (shouldBlock) {
        e.preventDefault();
        e.stopPropagation();
        simpleGiftDebugLog('🎁 Blocked checkout link - only gift in cart');
        
        const settings = getSettings();
        alert(settings.validationMessage || 'Add 1 more item for free gift');
        return false;
      }
    }
  });
  
  // Listen for quantity changes
  document.addEventListener('change', (e) => {
    if (e.target.classList.contains('quantity__input')) {
      console.log('🎁 Quantity input changed');
      setTimeout(() => {
        // autoRemoveGiftIfNotQualified(); // DISABLED: auto-remove not needed
        updateClaimButtons();
      }, 200);
    }
  });

  document.addEventListener('click', (e) => {
    if (e.target.closest('.quantity__button')) {
      console.log('🎁 Quantity button clicked');
      setTimeout(() => {
        // autoRemoveGiftIfNotQualified(); // DISABLED: auto-remove not needed
        updateClaimButtons();
      }, 200);
    }

    // Также отслеживаем кнопки удаления товара
    if (e.target.closest('cart-remove-button') || e.target.closest('.delete-product')) {
      console.log('🎁 Remove button clicked');
      setTimeout(() => {
        // autoRemoveGiftIfNotQualified(); // DISABLED: auto-remove not needed
        updateClaimButtons();
      }, 300);
    }
  });

  // Extra validation for cart changes
  document.addEventListener('cart:updated', () => {
    // validateCheckout(); // DISABLED: no validation needed
    // enforceGiftQuantity(); // DISABLED: allow multiple gift quantities
    // autoRemoveGiftIfNotQualified(); // DISABLED: auto-remove not needed
    updateClaimButtons();
  });

  // Listen for cart drawer open events
  document.addEventListener('cart-drawer:open', () => {
    console.log('🎁 Cart drawer opened, updating gift buttons');
    setTimeout(() => {
      updateClaimButtons();
    }, 100);
  });

  // Also listen for mutations on cart drawer
  const observeCartDrawer = () => {
    const cartDrawer = document.querySelector('mini-cart, .cart-drawer, [data-cart-drawer]');
    if (cartDrawer) {
      const observer = new MutationObserver(() => {
        updateClaimButtons();
      });
      observer.observe(cartDrawer, { childList: true, subtree: true });
    }
  };

  observeCartDrawer();
  
  // Захист від клавіатурних команд (пробіл, Enter)
  document.addEventListener('keydown', (e) => {
    const giftInCart = isGiftInCart();
    const otherItems = getOtherItemsCount();
    const shouldBlock = giftInCart && otherItems === 0;
    
    if (shouldBlock && (e.code === 'Space' || e.code === 'Enter')) {
      const activeElement = document.activeElement;
      if (activeElement && (
        activeElement.name === 'checkout' ||
        activeElement.getAttribute('data-checkout-button') !== null ||
        activeElement.classList.contains('cart__checkout-button') ||
        activeElement.textContent.includes('Checkout')
      )) {
        e.preventDefault();
        e.stopPropagation();
        alert('Add one more item to cart to proceed with checkout');
        return false;
      }
    }
  });
});

// Simple test function
window.testGift = () => {
  simpleGiftDebugLog('🎁 Email submitted:', isEmailSubmitted());
  simpleGiftDebugLog('🎁 Popup closed:', isPopupClosed());
  simpleGiftDebugLog('🎁 Gift in cart:', isGiftInCart());
};

window.clearGift = () => {
  clearStorageItems();
  // Clear all gift-related cookies
  document.cookie = 'beyours:gift-popup=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/;';
  document.cookie = 'beyours:gift-bundle-claimed=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/;';
  simpleGiftDebugLog('🎁 Data cleared');
  location.reload();
};

// Test URL coupon
window.testCoupon = (code) => {
  const settings = getSettings();
  const testCode = code || settings.couponCode;
  simpleGiftDebugLog('🎁 Testing coupon:', testCode);
  window.location.href = window.location.pathname + '?discount=' + testCode;
};

// Show current settings
window.showSettings = () => {
  console.table(getSettings());
};

// Test Omnisend integration
window.testOmnisend = async (email = 'test@example.com') => {
  simpleGiftDebugLog('🎁 Testing Omnisend with email:', email);
  const result = await submitToOmnisend(email);
  simpleGiftDebugLog('🎁 Omnisend test result:', result);
  return result;
};