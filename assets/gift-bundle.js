class GiftBundleManager {
  constructor() {
    this.variantId = '43668412792963';
    this.cookieName = 'beyours:gift-bundle-claimed';
    this.isInitialized = false;
    this.fakeGiftInCart = false; // Для миттєвого UI відгуку
    this.init();
  }

  init() {
    if (this.isInitialized) return;
    this.isInitialized = true;

    this.bindEvents();
    this.checkForEmailCoupon();
    this.updateGiftButtonStates();
    this.validateCart();
    
    // updateGiftSection тільки для звичайного cart
    if (document.querySelector('.cart__footer')) {
      this.updateGiftSection();
    }
    
    // Слухати зміни в кошику
    document.addEventListener('cart:updated', () => {
      this.updateGiftButtonStates();
      this.validateCart();
      
      // updateGiftSection тільки для звичайного cart
      if (document.querySelector('.cart__footer')) {
        this.updateGiftSection();
      }
    });
    
    // Додати слухач для кліків
    document.addEventListener('click', () => {
      setTimeout(() => {
        this.validateCart();
        this.updateGiftButtonStates();
      }, 100);
    });

    // Основна валідація тепер в gift-simple.js
    // setInterval(() => {
    //   this.validateCart();
    // }, 2000);

    // Тестування логіки - додати команди для консолі
    window.testGiftLogic = () => {
      console.log('🎁 === GIFT LOGIC TEST ===');
      console.log('🎁 Email submitted:', sessionStorage.getItem('gift-email-submitted'));
      console.log('🎁 Gift claimed:', this.isGiftClaimed());
      console.log('🎁 Gift in cart:', this.isGiftInCart());
      console.log('🎁 Non-gift items count:', this.getNonGiftItemsCount());
      console.log('🎁 Gift section element:', document.getElementById('gift-section'));
      console.log('🎁 Checkout buttons:', document.querySelectorAll('button[name="checkout"], button[data-checkout-button]'));
      console.log('🎁 === END TEST ===');
    };
  }

  bindEvents() {
    // Додати обробники для кнопок додавання гіфта
    document.addEventListener('click', (e) => {
      // Знайти найближчий елемент з потрібним атрибутом
      const addButton = e.target.closest('[data-gift-bundle-add]');
      const removeButton = e.target.closest('[data-gift-bundle-remove]');
      const triggerButton = e.target.closest('[data-gift-popup-trigger]');
      
      if (addButton) {
        e.preventDefault();
        this.addGiftBundle();
      }
      if (removeButton) {
        e.preventDefault();
        this.removeGiftBundle();
      }
      if (triggerButton) {
        e.preventDefault();
        this.openGiftPopup();
      }
    });
  }

  // Перевірити чи прийшли з email з купоном
  checkForEmailCoupon() {
    const urlParams = new URLSearchParams(window.location.search);
    const discount = urlParams.get('discount') || urlParams.get('coupon') || urlParams.get('code');
    
    // Перевірити URL на наявність discount коду
    const currentPath = window.location.pathname;
    const pathMatch = currentPath.match(/\/discount\/([^\/\?]+)/);
    const pathDiscount = pathMatch ? pathMatch[1] : null;
    
    const foundCode = discount || pathDiscount;
    
    // Перевірити чи вже встановлені прапорці з gift-simple.js
    const couponUsed = sessionStorage.getItem('gift-coupon-used') === 'true' ||
                      localStorage.getItem('gift-coupon-used') === 'true';
    
    if ((foundCode && foundCode.toLowerCase() === 'freebundle') || couponUsed) {
      
      // Встановити всі необхідні прапорці (синхронізація з gift-simple.js)
      sessionStorage.setItem('gift-email-submitted', 'true');
      sessionStorage.setItem('gift-coupon-used', 'true');
      sessionStorage.setItem('gift-popup-closed', 'true');
      
      this.addGiftBundle();
      this.markGiftAsClaimed();
      
      // Очистити URL від параметрів тільки якщо це був URL параметр
      if (discount && !pathDiscount) {
        const cleanUrl = window.location.pathname;
        window.history.replaceState({}, document.title, cleanUrl);
      }
    }
  }

  async addGiftBundle() {
    if (this.isGiftInCart()) return;
    if (this.isGiftClaimed()) return;

    // МИТТЄВО оновити UI без чекання API
    this.markGiftAsClaimed();
    this.fakeGiftInCart = true; // Тимчасовий прапорець
    this.updateGiftButtonStates();
    this.validateCart();
    this.showGiftAddedMessage();
    
    // Відкрити кошик миттєво
    setTimeout(() => {
      this.openMiniCart();
    }, 100);

    // API запит у фоні
    try {
      const response = await fetch('/cart/add.js', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          id: this.variantId,
          quantity: 1,
          properties: {
            '_gift_bundle': 'true',
            '_gift_source': 'email_or_popup'
          }
        }),
      });

      if (response.ok) {
        // Товар успішно додано - можна оновити кошик
        this.fakeGiftInCart = false;
        document.cookie = 'beyours:gift-bundle-claimed=true; max-age=' + (30 * 24 * 60 * 60) + '; path=/';
        
        // Тихо оновити кошик у фоні (без блимання)
        this.updateCartSections();
        
      } else {
        // Помилка API - відкатити зміни
        this.fakeGiftInCart = false;
        this.removeCookie(this.cookieName);
        this.updateGiftButtonStates();
        this.validateCart();
        
        // Показати помилку
        this.showErrorMessage('Failed to add gift. Please try again.');
      }
    } catch (error) {
      console.error('Помилка додавання гіфт-бандлу:', error);
      
      // Відкатити UI зміни
      this.fakeGiftInCart = false;
      this.removeCookie(this.cookieName);
      this.updateGiftButtonStates();
      this.validateCart();
      
      this.showErrorMessage('Network error. Please check your connection.');
    }
  }

  async removeGiftBundle() {
    const giftLineItem = this.getGiftLineItem();
    if (!giftLineItem) return;

    try {
      const response = await fetch('/cart/change.js', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          id: this.variantId,
          quantity: 0
        }),
      });

      if (response.ok) {
        this.updateCartSections();
        this.updateGiftButtonStates();
        this.validateCart();
      }
    } catch (error) {
      console.error('Помилка видалення гіфт-бандлу:', error);
    }
  }

  isGiftInCart() {
    // Якщо ми тимчасово показуємо що подарунок додано
    if (this.fakeGiftInCart) return true;
    
    // Перевірити через DOM елементи (для обох типів кошика)
    const cartItems = document.querySelectorAll('[data-variant-id]');
    const domCheck = Array.from(cartItems).some(item => 
      item.dataset.variantId === this.variantId
    );
    
    // Додаткова перевірка через Liquid змінні (якщо є)
    const liquidCheck = window.cartHasGift || false;
    
    return domCheck || liquidCheck;
  }

  getGiftLineItem() {
    return document.querySelector(`[data-variant-id="${this.variantId}"]`);
  }

  isGiftClaimed() {
    // Перевірити cookie
    const match = document.cookie.match(`(^|;)\\s*${this.cookieName}\\s*=\\s*([^;]+)`);
    const cookieCheck = match ? match[2] === 'true' : false;
    
    // Перевірити sessionStorage та localStorage (з gift-simple.js)
    const sessionCheck = sessionStorage.getItem('gift-email-submitted') === 'true' ||
                         sessionStorage.getItem('gift-coupon-used') === 'true';
    const localCheck = localStorage.getItem('gift-email-submitted') === 'true' ||
                      localStorage.getItem('gift-coupon-used') === 'true';
    
    return cookieCheck || sessionCheck || localCheck;
  }

  markGiftAsClaimed() {
    // Встановити cookie на 30 днів
    document.cookie = `${this.cookieName}=true; max-age=${30 * 24 * 60 * 60}; path=/`;
  }

  updateGiftButtonStates() {
    const isInCart = this.isGiftInCart();
    
    // Оптимізація: перевірити чи стан змінився
    if (this.lastButtonState === isInCart) return;
    this.lastButtonState = isInCart;
    
    const addButtons = document.querySelectorAll('[data-gift-bundle-add]');
    const removeButtons = document.querySelectorAll('[data-gift-bundle-remove]');

    addButtons.forEach(button => {
      if (button.disabled !== isInCart) {
        button.disabled = isInCart;
        button.style.opacity = isInCart ? '0.6' : '1';
        button.style.cursor = isInCart ? 'not-allowed' : 'pointer';
      }
      
      const label = button.querySelector('.label');
      if (label) {
        const newText = isInCart ? 'Gift in Cart' : 'Add Gift';
        if (label.textContent !== newText) {
          label.textContent = newText;
        }
      }
      
      if (isInCart && !button.classList.contains('gift-added')) {
        button.classList.add('gift-added');
      } else if (!isInCart && button.classList.contains('gift-added')) {
        button.classList.remove('gift-added');
      }
    });

    removeButtons.forEach(button => {
      const shouldShow = isInCart ? 'block' : 'none';
      if (button.style.display !== shouldShow) {
        button.style.display = shouldShow;
      }
    });
  }

  validateCart() {
    const isGiftInCart = this.isGiftInCart();
    const otherItemsCount = this.getNonGiftItemsCount();
    const shouldBlock = isGiftInCart && otherItemsCount === 0;
    
    // Уникнути непотрібних оновлень якщо стан не змінився
    const currentState = `${isGiftInCart}-${otherItemsCount}-${shouldBlock}`;
    if (this.lastValidationState === currentState) {
      return;
    }
    this.lastValidationState = currentState;
    
    // Знайти всі кнопки чекауту (тільки ті, що не в mini-cart - там Liquid керує)
    const regularCartButtons = document.querySelectorAll('.cart__checkout-button, .cart__footer button[name="checkout"], .cart__footer button[data-checkout-button]');
    
    // Знайти додаткові кнопки чекауту, але виключити ті що в mini-cart
    const additionalButtons = document.querySelectorAll('button[name="checkout"], button[data-checkout-button], .button[type="submit"]');
    const filteredButtons = Array.from(additionalButtons).filter(button => {
      const buttonParent = button.closest('.mini-cart, .drawer, .cart-drawer');
      const isNewsletterButton = button.closest('.newsletter, .footer, [class*="newsletter"], [class*="subscribe"]');
      const buttonText = button.textContent.toLowerCase().trim();
      
      // Виключити mini-cart кнопки (ними керує Liquid) та newsletter кнопки
      return !buttonParent && 
             !isNewsletterButton && 
             !buttonText.includes('newsletter') && 
             !buttonText.includes('subscribe');
    });
    
    const allButtons = [...regularCartButtons, ...filteredButtons];
    
    // Знайти validation messages тільки для regular cart (не для mini-cart)
    const regularCartValidationMessages = document.querySelectorAll('.cart__footer .gift-validation-message, .cart__validation-section .gift-validation-message');

    if (shouldBlock) {
      // Блокувати тільки regular cart кнопки
      allButtons.forEach((checkoutButton) => {
        if (checkoutButton && !checkoutButton.closest('.mini-cart, .drawer, .cart-drawer')) {
          checkoutButton.disabled = true;
          checkoutButton.classList.add('button--disabled');
          checkoutButton.setAttribute('disabled', 'disabled');
          
          // Оновити текст кнопки тільки якщо це потрібно
          const currentText = checkoutButton.textContent.trim();
          if ((currentText.includes('Checkout') || currentText === 'Checkout') && !currentText.includes('Add Item')) {
            checkoutButton.textContent = 'Add Item to Checkout';
          }
        }
      });
      
      // Показати validation messages тільки для regular cart
      if (regularCartValidationMessages.length === 0) {
        // Перевірити чи не існує вже повідомлення з Liquid перед створенням нового
        const existingLiquidValidation = document.querySelector('.cart__validation-section .gift-validation-message');
        if (!existingLiquidValidation) {
          this.createValidationMessagesForRegularCart();
        } else {
          existingLiquidValidation.style.display = 'block';
        }
      } else {
        regularCartValidationMessages.forEach((validationMessage) => {
          if (validationMessage) {
            validationMessage.style.display = 'block';
          }
        });
      }
    } else {
      // Дозволити чекаут
      allButtons.forEach((checkoutButton) => {
        if (checkoutButton && !checkoutButton.closest('.mini-cart, .drawer, .cart-drawer')) {
          checkoutButton.disabled = false;
          checkoutButton.classList.remove('button--disabled');
          checkoutButton.removeAttribute('disabled');
          
          // Відновити текст кнопки
          if (checkoutButton.textContent.includes('Add Item')) {
            checkoutButton.textContent = 'Checkout';
          }
        }
      });
      
      // Приховати validation messages тільки для regular cart
      regularCartValidationMessages.forEach((validationMessage) => {
        if (validationMessage) {
          validationMessage.style.display = 'none';
        }
      });
      
      // Також приховати Liquid validation якщо існує
      const existingLiquidValidation = document.querySelector('.cart__validation-section .gift-validation-message');
      if (existingLiquidValidation) {
        existingLiquidValidation.style.display = 'none';
      }
    }
  }

  getNonGiftItemsCount() {
    // Спочатку перевірити чи є дані з Liquid
    if (typeof window.cartNonGiftItemsCount !== 'undefined') {
      return window.cartNonGiftItemsCount;
    }
    
    const cartItems = document.querySelectorAll('[data-variant-id]');
    let count = 0;
    
    // Спробувати рахувати через DOM елементи
    if (cartItems.length > 0) {
      cartItems.forEach(item => {
        if (item.dataset.variantId !== this.variantId) {
          // Для звичайного кошика рахувати кількість з input
          const quantityInput = item.querySelector('input[name="updates[]"]');
          if (quantityInput) {
            count += parseInt(quantityInput.value) || 0;
          } else {
            count += 1; // Для mini-cart де немає input
          }
        }
      });
    }
    
    return count;
  }

  async getCartItemsFromAPI() {
    try {
      const response = await fetch('/cart.js');
      const cart = await response.json();
      return cart.items || [];
    } catch (error) {
      console.error('Error fetching cart:', error);
      return [];
    }
  }

  createValidationMessagesForRegularCart() {
    // Створити повідомлення тільки для звичайного cart (не для mini-cart)
    const cartFooter = document.querySelector('.cart__footer');
    if (cartFooter) {
      const existingMsg = cartFooter.querySelector('.gift-validation-message');
      if (!existingMsg) {
        const validationSection = document.createElement('div');
        validationSection.className = 'cart__validation-section';
        validationSection.style.cssText = 'margin: 20px 0;';
        validationSection.innerHTML = `
          <div class="gift-validation-message" style="background: #f8f9fa; border: 1px solid #e9ecef; border-radius: 4px; padding: 12px 16px;">
            <div class="validation-content" style="display: flex; align-items: center; justify-content: center;">
              <div class="validation-text">
                <p style="margin: 0; font-size: 14px; color: #6c757d; text-align: center;">Add one more item to cart to proceed with checkout</p>
              </div>
            </div>
          </div>
        `;
        cartFooter.appendChild(validationSection);
      }
    }
  }

  async updateCartSections() {
    try {
      // Спочатку швидко оновимо іконку кошика
      this.updateCartIcon();
      
      // Потім асинхронно оновимо секції
      const updates = [
        fetch(`/cart?section_id=mini-cart`).then(response => response.text()),
        fetch('/cart.js').then(response => response.json())
      ];
      
      const [miniCartHTML, cartData] = await Promise.all(updates);
      
      // Оновити mini-cart тільки якщо він видимий
      const miniCart = document.getElementById('mini-cart');
      if (miniCart && miniCart.offsetParent !== null) {
        const parser = new DOMParser();
        const doc = parser.parseFromString(miniCartHTML, 'text/html');
        const newContent = doc.querySelector('.shopify-section');
        
        if (newContent) {
          miniCart.innerHTML = newContent.innerHTML;
        }
      }

      // Оновити іконку кошика з точними даними
      this.updateCartIcon(cartData);
      
      // Оновити gift section
      this.updateGiftSection();
      
      // Повідомити про оновлення кошика
      document.dispatchEvent(new CustomEvent('cart:updated', {
        detail: { cart: cartData }
      }));
      
    } catch (error) {
      console.error('Помилка оновлення кошика:', error);
      // При помилці просто оновимо іконку
      this.updateCartIcon();
    }
  }

  updateGiftSection() {
    // Тільки для звичайного cart - для mini-cart це керується Liquid
    const giftSection = document.querySelector('.cart__footer #gift-section');
    if (!giftSection) return;

    const isGiftInCart = this.isGiftInCart();
    const emailSubmitted = sessionStorage.getItem('gift-email-submitted') === 'true';
    const giftClaimed = this.isGiftClaimed();
    const otherItemsCount = this.getNonGiftItemsCount();
    
    // Уникнути непотрібних оновлень якщо стан не змінився
    const currentGiftState = `${isGiftInCart}-${emailSubmitted}-${giftClaimed}-${otherItemsCount}`;
    if (this.lastGiftSectionState === currentGiftState) {
      return;
    }
    this.lastGiftSectionState = currentGiftState;
    
    // Приховати gift section якщо тільки gift в кошику (конфлікт з validation message)
    if (isGiftInCart && otherItemsCount === 0) {
      giftSection.style.display = 'none';
      return;
    }
    
    // Показати секцію тільки якщо кастомер має право на подарунок і немає gift в кошику
    if ((emailSubmitted || giftClaimed) && !isGiftInCart) {
      giftSection.style.display = 'block';
      
      // Показати кнопку для додавання подарунка тільки якщо вміст ще не встановлено
      if (!giftSection.querySelector('.gift-bundle-offer')) {
        giftSection.innerHTML = `
          <div class="gift-bundle-offer">
            <div class="gift-bundle-content">
              <div class="gift-bundle-text">
                <h4 class="gift-bundle-title">Free Gift Available</h4>
                <p class="gift-bundle-description">Add gift bundle to cart</p>
              </div>
            </div>
            <button class="button button--small button--cta gift-bundle-add" data-gift-bundle-add>
              <span class="label">Add Gift</span>
            </button>
          </div>
        `;
      }
    } else {
      giftSection.style.display = 'none';
    }
  }

  createGiftSection() {
    // Створити gift section якщо його немає
    const miniCartFooter = document.querySelector('.mini-cart__footer');
    if (miniCartFooter) {
      const giftSection = document.createElement('div');
      giftSection.className = 'mini-cart__gift-section';
      giftSection.id = 'gift-section';
      giftSection.innerHTML = `
        <style>
          .mini-cart__gift-section {
            margin: 16px 0;
            padding: 0 20px;
          }
          
          .gift-bundle-offer,
          .gift-bundle-added {
            display: flex;
            align-items: center;
            justify-content: space-between;
            background: linear-gradient(135deg, #f8f9fa 0%, #e9ecef 100%);
            border: 2px solid #e6cedf;
            border-radius: 12px;
            padding: 16px;
            margin-bottom: 12px;
            transition: all 0.3s ease;
          }
          
          .gift-bundle-added {
            border-color: #28a745;
            background: linear-gradient(135deg, #d4edda 0%, #c3e6cb 100%);
          }
          
          .gift-bundle-content {
            display: flex;
            align-items: center;
            flex: 1;
          }
          
          .gift-bundle-icon {
            font-size: 28px;
            margin-right: 12px;
            animation: bounce 2s infinite;
          }
          
          .gift-bundle-text h4 {
            font-size: 14px;
            font-weight: 600;
            margin: 0 0 4px 0;
            color: #155724;
          }
          
          .gift-bundle-text p {
            font-size: 12px;
            margin: 0;
            color: #6c757d;
            line-height: 1.2;
          }
        </style>
      `;
      
      miniCartFooter.insertBefore(giftSection, miniCartFooter.firstChild);
    }
  }

  async updateCartIcon() {
    try {
      const response = await fetch('/cart.js');
      const cart = await response.json();
      
      const bubbles = document.querySelectorAll('.cart-count-bubble');
      bubbles.forEach(bubble => {
        bubble.textContent = cart.item_count;
        bubble.style.display = cart.item_count > 0 ? 'flex' : 'none';
      });
    } catch (error) {
      console.error('Помилка оновлення іконки кошика:', error);
    }
  }

  showGiftAddedMessage() {
    // Показати тимчасове повідомлення
    const message = document.createElement('div');
    message.style.cssText = `
      position: fixed;
      top: 20px;
      right: 20px;
      background: #28a745;
      color: white;
      padding: 16px 20px;
      border-radius: 8px;
      z-index: 9999;
      font-size: 14px;
      font-weight: 500;
      box-shadow: 0 4px 12px rgba(0,0,0,0.15);
    `;
    message.textContent = '🎁 Gift added to cart!';
    document.body.appendChild(message);

    setTimeout(() => {
      message.remove();
    }, 3000);
  }

  showErrorMessage(text) {
    // Показати повідомлення про помилку
    const message = document.createElement('div');
    message.style.cssText = `
      position: fixed;
      top: 20px;
      right: 20px;
      background: #dc3545;
      color: white;
      padding: 16px 20px;
      border-radius: 8px;
      z-index: 9999;
      font-size: 14px;
      font-weight: 500;
      box-shadow: 0 4px 12px rgba(0,0,0,0.15);
    `;
    message.textContent = text;
    document.body.appendChild(message);

    setTimeout(() => {
      message.remove();
    }, 5000);
  }

  removeCookie(name) {
    document.cookie = `${name}=; max-age=0; path=/`;
  }

  openMiniCart() {
    const miniCart = document.querySelector('mini-cart');
    if (miniCart && typeof miniCart.open === 'function') {
      miniCart.open();
    } else {
      // Fallback для відкриття drawer
      const cartDrawer = document.querySelector('cart-drawer');
      if (cartDrawer) {
        cartDrawer.openMenuDrawer();
      }
    }
  }

  openGiftPopup() {
    console.log('🎁 GiftBundleManager: openGiftPopup() called');
    const popup = document.querySelector('gift-popup');
    console.log('🎁 GiftBundleManager: Gift popup element found:', !!popup);
    
    if (popup && typeof popup.open === 'function') {
      console.log('🎁 GiftBundleManager: Opening popup via .open() method');
      popup.open();
    } else {
      console.log('🎁 GiftBundleManager: Using alternative popup opening method');
      // Альтернативний спосіб відкриття попапа
      const popupElement = document.querySelector('.promo-popup');
      console.log('🎁 GiftBundleManager: Promo popup element found:', !!popupElement);
      
      if (popupElement) {
        popupElement.classList.add('is-active');
        document.body.classList.add('promo-popup--open');
        console.log('🎁 GiftBundleManager: Added active classes manually');
      }
    }
  }
}

// Ініціалізувати менеджер гіфт-бандлу
document.addEventListener('DOMContentLoaded', () => {
  const manager = new GiftBundleManager();
  window.giftBundleManager = manager;
});

// Експорт для використання в інших місцях
window.GiftBundleManager = GiftBundleManager;