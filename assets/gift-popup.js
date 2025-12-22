class GiftPopup extends HTMLElement {
  constructor() {
    super();
    
    console.log('🎁 GiftPopup: Constructor started');

    // Запобігти показу на сторінці challenge
    if (window.location.pathname === '/challenge') {
      console.log('🎁 GiftPopup: Skipped on challenge page');
      return;
    }

    this.cookieName = 'beyours:gift-popup';
    this.variantId = this.dataset.variantId || '43668412792963';
    
    console.log('🎁 GiftPopup: Variant ID:', this.variantId);

    this.classes = {
      bodyClass: 'promo-popup--open',
      activeClass: 'is-active',
      closingClass: 'is-closing'
    };

    this.popup = this.querySelector('.promo-popup');
    this.form = this.querySelector('.gift-form');
    
    console.log('🎁 GiftPopup: Popup element found:', !!this.popup);
    console.log('🎁 GiftPopup: Form element found:', !!this.form);

    // Відкрити попап якщо є помилки або успішне повідомлення
    if (this.querySelector('.form__message')) {
      console.log('🎁 GiftPopup: Opening due to form message');
      this.open();
    }

    this.bindEvents();

    // ТИМЧАСОВО: показувати завжди для тестування
    console.log('🎁 GiftPopup: Initializing popup (always show for testing)');
    this.init();
    
    // Оригінальна логіка (закоментована):
    // if (!this.getCookie(this.cookieName) || this.dataset.testMode === 'true') {
    //   this.init();
    // }
  }

  connectedCallback() {
    if (Shopify.designMode) {
      this.onShopifySectionLoad = this.onSectionLoad.bind(this);
      this.onShopifySectionSelect = this.onSectionSelect.bind(this);
      this.onShopifySectionDeselect = this.onSectionDeselect.bind(this);
      document.addEventListener('shopify:section:load', this.onShopifySectionLoad);
      document.addEventListener('shopify:section:select', this.onShopifySectionSelect);
      document.addEventListener('shopify:section:deselect', this.onShopifySectionDeselect);
    }
  }

  disconnectedCallback() {
    if (Shopify.designMode) {
      document.removeEventListener('shopify:section:load', this.onShopifySectionLoad);
      document.removeEventListener('shopify:section:select', this.onShopifySectionSelect);
      document.removeEventListener('shopify:section:deselect', this.onShopifySectionDeselect);
      document.body.classList.remove(this.classes.bodyClass);
    }
  }

  onSectionLoad(event) {
    this.filterShopifyEvent(event, this, () => this.open.bind(this));
  }

  onSectionSelect(event) {
    this.filterShopifyEvent(event, this, this.open.bind(this));
  }

  onSectionDeselect(event) {
    this.filterShopifyEvent(event, this, this.close.bind(this));
  }

  filterShopifyEvent(event, element, callback) {
    if (event.target === element || event.target.contains(element)) {
      callback();
    }
  }

  bindEvents() {
    // Кнопки закриття попапа
    this.querySelectorAll('[data-gift-popup-toggle], [data-gift-popup-close]').forEach((button) => {
      button.addEventListener('click', this.onToggleClick.bind(this));
    });

    // Обробка кнопки email submit
    const emailSubmitButton = this.querySelector('[data-gift-email-submit]');
    if (emailSubmitButton) {
      emailSubmitButton.addEventListener('click', this.onEmailSubmit.bind(this));
    }

    // Обробка форми (для fallback)
    if (this.form) {
      this.form.addEventListener('submit', this.onFormSubmit.bind(this));
    }

    // Кнопка перейти в кошик після успіху
    const goToCartButton = this.querySelector('[data-gift-popup-close]');
    if (goToCartButton) {
      goToCartButton.addEventListener('click', () => {
        this.close();
        this.openMiniCart();
      });
    }
  }

  init() {
    console.log('🎁 GiftPopup: init() called');
    
    if (!this.popup) {
      console.log('🎁 GiftPopup: No popup element found, aborting init');
      return;
    }
    
    if (Shopify && Shopify.designMode) {
      console.log('🎁 GiftPopup: In design mode, skipping init');
      return;
    }

    const delay = parseInt(this.dataset.delay) * 1000 || 2000; // 2 секунди за замовчуванням
    console.log('🎁 GiftPopup: Setting timeout for', delay, 'ms');
    
    // Показати попап з затримкою
    setTimeout(() => {
      console.log('🎁 GiftPopup: Timeout reached, opening popup');
      this.open();
    }, delay);
  }

  close() {
    this.popup.classList.add(this.classes.closingClass);

    setTimeout(() => {
      this.popup.classList.remove(this.classes.activeClass);
      this.popup.classList.remove(this.classes.closingClass);

      if (this.popup.dataset.position === 'center') {
        document.body.classList.remove(this.classes.bodyClass);
      }
      
      // Показати тригер кнопку після закриття попапа
      this.showTriggerButton();
    }, 500);

    // Видалити cookie в тестовому режимі
    if (this.dataset.testMode === 'true') {
      this.removeCookie(this.cookieName);
      return;
    }

    this.setCookie(this.cookieName, this.dataset.expiry);
  }

  showTriggerButton() {
    const triggerContainer = document.getElementById('gift-trigger-container');
    if (triggerContainer) {
      triggerContainer.style.display = 'block';
      triggerContainer.style.animation = 'bounceIn 1s ease-out';
    }
  }

  onToggleClick(event) {
    event.preventDefault();
    this.popup.classList.contains(this.classes.activeClass) ? this.close() : this.open();
  }

  async onEmailSubmit(event) {
    console.log('🎁 GiftPopup: onEmailSubmit() called');
    event.preventDefault();
    
    const emailInput = this.querySelector('input[type="email"]');
    const submitButton = event.target;
    
    console.log('🎁 GiftPopup: Email input:', emailInput);
    console.log('🎁 GiftPopup: Submit button:', submitButton);
    console.log('🎁 GiftPopup: Email value:', emailInput?.value);
    
    // Перевірити валідність email
    if (!emailInput || !emailInput.value || !emailInput.validity.valid) {
      console.log('🎁 GiftPopup: Invalid email, focusing input');
      emailInput.focus();
      return;
    }

    // Перевірити чи не додано вже подарунок
    if (this.isGiftInCart()) {
      console.log('🎁 GiftPopup: Gift already in cart, closing popup');
      this.close();
      this.openMiniCart();
      return;
    }

    // Показати стан завантаження
    console.log('🎁 GiftPopup: Setting loading state');
    submitButton.disabled = true;
    const originalText = submitButton.querySelector('.label').textContent;
    submitButton.querySelector('.label').textContent = 'Processing...';

    try {
      console.log('🎁 GiftPopup: Adding gift bundle to cart');
      // Додати гіфт-бандл в кошик
      await this.addGiftBundle();
      
      console.log('🎁 GiftPopup: Setting cookie');
      // Позначити, що попап був заповнений
      this.setCookie(this.cookieName, this.dataset.expiry);
      
      console.log('🎁 GiftPopup: Submitting email');
      // Відправити email через Shopify Customer API (опціонально)
      await this.submitEmail(emailInput.value);
      
      console.log('🎁 GiftPopup: Showing success and closing');
      // Показати успіх і закрити попап
      this.showSuccessAndClose();
      
    } catch (error) {
      console.error('🎁 GiftPopup: Error adding gift bundle:', error);
      
      // Відновити кнопку при помилці
      submitButton.disabled = false;
      submitButton.querySelector('.label').textContent = originalText;
      
      // Показати помилку
      this.showError('Something went wrong. Please try again.');
    }
  }

  async submitEmail(email) {
    try {
      // Відправити email через newsletter form
      const formData = new FormData();
      formData.append('contact[email]', email);
      formData.append('contact[tags]', 'gift-bundle,newsletter');
      
      await fetch('/contact', {
        method: 'POST',
        body: formData
      });
    } catch (error) {
      console.log('Email submission failed, but gift added successfully');
    }
  }

  showSuccessAndClose() {
    // Показати повідомлення про успіх
    this.showSuccessMessage();
    
    // Закрити попап через 2 секунди
    setTimeout(() => {
      this.close();
      this.openMiniCart();
    }, 2000);
  }

  showError(message) {
    // Простий спосіб показати помилку
    const errorDiv = document.createElement('div');
    errorDiv.className = 'gift-popup-error';
    errorDiv.style.cssText = `
      color: #dc3545;
      font-size: 14px;
      margin-top: 10px;
      text-align: center;
    `;
    errorDiv.textContent = message;
    
    const form = this.querySelector('.gift-form');
    if (form) {
      const existingError = form.querySelector('.gift-popup-error');
      if (existingError) existingError.remove();
      form.appendChild(errorDiv);
    }
  }

  async onFormSubmit(event) {
    const submitButton = event.target.querySelector('[data-gift-email-submit]');
    const emailInput = event.target.querySelector('input[type="email"]');
    
    if (submitButton && emailInput && emailInput.value) {
      // Перевірити чи не додано вже подарунок
      if (this.isGiftInCart()) {
        return; // Подарунок вже в кошику
      }

      // Показати стан завантаження
      submitButton.disabled = true;
      submitButton.querySelector('.label').textContent = 'Processing...';

      try {
        // Додати гіфт-бандл в кошик ПЕРЕД відправкою форми
        await this.addGiftBundle();
        
        // Позначити, що попап був заповнений
        this.setCookie(this.cookieName, this.dataset.expiry);
        
        // Після успішного додавання - дозволити відправку форми
        // Форма відправиться автоматично після цього
        
      } catch (error) {
        console.error('Error adding gift bundle:', error);
        
        // Відновити кнопку при помилці
        submitButton.disabled = false;
        submitButton.querySelector('.label').textContent = 'Get Free Gift';
        
        // Запобігти відправці форми при помилці
        event.preventDefault();
      }
    }
  }

  isGiftInCart() {
    const cartItems = document.querySelectorAll('[data-variant-id]');
    return Array.from(cartItems).some(item => 
      item.dataset.variantId === this.variantId
    );
  }

  async addGiftBundle() {
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
            '_gift_source': 'popup'
          }
        }),
      });

      if (response.ok) {
        const result = await response.json();
        
        // Оновити кошик
        this.updateCartSections();
        
        // Показати повідомлення про успіх
        this.showSuccessMessage();
        
        return result;
      } else {
        throw new Error('Помилка при додаванні в кошик');
      }
    } catch (error) {
      console.error('Помилка додавання гіфт-бандлу:', error);
      throw error;
    }
  }

  open() {
    console.log('🎁 GiftPopup: open() called');
    console.log('🎁 GiftPopup: Popup element:', this.popup);
    console.log('🎁 GiftPopup: Active class:', this.classes.activeClass);
    
    if (!this.popup) {
      console.log('🎁 GiftPopup: Cannot open - no popup element');
      return;
    }
    
    document.body.classList.remove(this.classes.bodyClass);
    this.popup.classList.add(this.classes.activeClass);
    
    console.log('🎁 GiftPopup: Added active class, popup should be visible');

    if (this.popup.dataset.position === 'center') {
      console.log('🎁 GiftPopup: Setting up center position');
      this.setScrollbarWidth();
      document.body.classList.add(this.classes.bodyClass);
    }

    // Закрити інші попапи
    const promoPopup = document.querySelector('promo-popup');
    if (promoPopup && typeof promoPopup.close === 'function') {
      console.log('🎁 GiftPopup: Closing other promo popup');
      promoPopup.close();
    }
    
    console.log('🎁 GiftPopup: Open complete');
  }

  close() {
    this.popup.classList.add(this.classes.closingClass);

    setTimeout(() => {
      this.popup.classList.remove(this.classes.activeClass);
      this.popup.classList.remove(this.classes.closingClass);

      if (this.popup.dataset.position === 'center') {
        document.body.classList.remove(this.classes.bodyClass);
      }
    }, 500);

    // Видалити cookie в тестовому режимі
    if (this.dataset.testMode === 'true') {
      this.removeCookie(this.cookieName);
      return;
    }

    this.setCookie(this.cookieName, this.dataset.expiry);
  }

  setScrollbarWidth() {
    if (window.innerWidth > 749) {
      document.documentElement.style.setProperty('--scrollbar-width', window.innerWidth - document.body.clientWidth + 'px');
    }
  }

  showSuccessMessage() {
    // Показати тимчасове повідомлення про успіх
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
      animation: slideInRight 0.3s ease;
    `;
    message.innerHTML = '🎁 Gift added to cart!';
    document.body.appendChild(message);

    // Додати анімацію
    const style = document.createElement('style');
    style.textContent = `
      @keyframes slideInRight {
        from { transform: translateX(100%); opacity: 0; }
        to { transform: translateX(0); opacity: 1; }
      }
    `;
    document.head.appendChild(style);

    setTimeout(() => {
      message.remove();
      style.remove();
    }, 4000);
  }

  async updateCartSections() {
    try {
      // Простіше оновлення через reload кошика
      if (window.location.pathname === '/cart') {
        // Якщо на сторінці кошика - перезавантажити
        window.location.reload();
      } else {
        // Інакше оновити міні-кошик
        const response = await fetch('/cart.js');
        const cart = await response.json();
        
        // Оновити іконку кошика
        this.updateCartIcon(cart);
        
        // Повідомити про зміни в кошику
        document.dispatchEvent(new CustomEvent('cart:updated', {
          detail: { source: 'gift-popup', cart: cart }
        }));
      }
    } catch (error) {
      console.error('Error updating cart:', error);
    }
  }

  async updateCartIcon(cart = null) {
    try {
      if (!cart) {
        const response = await fetch('/cart.js');
        cart = await response.json();
      }
      
      const bubbles = document.querySelectorAll('.cart-count-bubble');
      bubbles.forEach(bubble => {
        bubble.textContent = cart.item_count;
        bubble.style.display = cart.item_count > 0 ? 'flex' : 'none';
      });
    } catch (error) {
      console.error('Error updating cart icon:', error);
    }
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

  getCookie(name) {
    const match = document.cookie.match(`(^|;)\\s*${name}\\s*=\\s*([^;]+)`);
    return match ? match[2] : null;
  }

  setCookie(name, expiry) {
    document.cookie = `${name}=true; max-age=${(expiry * 24 * 60 * 60)}; path=/`;
  }

  removeCookie(name) {
    document.cookie = `${name}=; max-age=0; path=/`;
  }
}

customElements.define('gift-popup', GiftPopup);

console.log('🎁 gift-popup.js loaded successfully');
console.log('🎁 GiftPopup custom element defined');