class MiniCart extends HTMLElement {
  constructor() {
    super();
    this.isLoading = false;
  }
   
  connectedCallback() {
    this.header = document.querySelector('sticky-header');
    this.drawer = document.querySelector('cart-drawer');
    new IntersectionObserver(this.handleIntersection.bind(this)).observe(this);
  }
  
  handleIntersection(entries, observer) {
    if (!entries[0].isIntersecting) return;
    if (this.isLoading) return; // Запобігаємо повторним викликам
    
    console.log('MiniCart intersection triggered');
    observer.unobserve(this);
    this.isLoading = true;
    
    fetch(this.dataset.url)
      .then(response => {
        if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status}`);
        }
        return response.text();
      })
      .then(html => {
        document.getElementById('mini-cart').innerHTML =
          this.getSectionInnerHTML(html, '.shopify-section');
          
        // Додаємо клас що контент завантажено
        document.getElementById('mini-cart').classList.add('content-loaded');
        
        document.dispatchEvent(new CustomEvent('cartdrawer:opened'));
        console.log('Cart content loaded successfully');
      })
      .catch(e => {
        console.error('Error loading cart:', e);
        // На випадок помилки показуємо базовий контент
        this.showFallbackContent();
      })
      .finally(() => {
        this.isLoading = false;
      });
  }
  
  showFallbackContent() {
    // Простий fallback якщо fetch не працює
    const miniCart = document.getElementById('mini-cart');
    if (miniCart) {
      miniCart.innerHTML = `
        <div class="mini-cart is-empty">
          <div class="mini-cart__inner">
            <div class="mini-cart__header">
              <drawer-close-button class="header__icon header__icon--summary header__icon--cart">
                <svg class="icon icon-close" aria-hidden="true" focusable="false">
                  <use href="#icon-close"></use>
                </svg>
              </drawer-close-button>
              <div class="title h4">Cart</div>
            </div>
            <div class="mini-cart__empty center">
              <p class="mini-cart__empty-text h3">Your cart is empty</p>
              <a href="/collections/all" class="button">Continue shopping</a>
            </div>
          </div>
        </div>
      `;
      miniCart.classList.add('content-loaded');
    }
  }
  
  open() {
    const detailsElement = this.drawer.querySelector('details');
    if (detailsElement.hasAttribute('open')) {
      return;
    }
    
    // Чекаємо трохи якщо контент ще завантажується
    if (this.isLoading) {
      console.log('Waiting for content to load...');
      setTimeout(() => this.open(), 100);
      return;
    }
    
    this.drawer.openMenuDrawer();
  }
  
  renderContents(parsedState) {
    this.productId = parsedState.id;
    this.getSectionsToRender().forEach((section => {
      if (document.getElementById(section.id)) {
        document.getElementById(section.id).innerHTML =
          this.getSectionInnerHTML(parsedState.sections[section.id], section.selector);
      }
    }));
    
    // Додаємо клас що контент завантажено
    document.getElementById('mini-cart').classList.add('content-loaded');
    this.open();
  }
  
  getSectionsToRender() {
    return [
      {
        id: 'mini-cart',
        section: 'mini-cart',
        selector: '.shopify-section'
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
      }
    ];
  }
  
  getSectionInnerHTML(html, selector = '.shopify-section') {
    return new DOMParser()
      .parseFromString(html, 'text/html')
      .querySelector(selector).innerHTML;
  }
}

customElements.define('mini-cart', MiniCart);