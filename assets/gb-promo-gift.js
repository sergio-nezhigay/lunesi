/**
 * GB Promo Gift Handler
 * Adds a free gift to cart and applies the Shopify discount code when
 * customer clicks "Add Free Gift" in the mini-cart banner.
 * Banner visibility is controlled server-side in mini-cart.liquid.
 */
class GBPromoGiftHandler {
  constructor() {
    this.settings = theme.shopSettings?.gbPromoGift || {};

    if (!this.settings.enabled || !this.settings.variantId) {
      return;
    }

    this.isProcessing = false;
    this.bindEvents();
  }

  bindEvents() {
    // Event delegation — mini-cart re-renders so we can't bind directly
    document.addEventListener('click', (e) => {
      const btn = e.target.closest('.gb-promo-gift__btn');
      if (btn && !this.isProcessing) {
        e.preventDefault();
        this.addGift();
      }
    });
  }

  async addGift() {
    this.isProcessing = true;
    const btn = document.querySelector('.gb-promo-gift__btn');
    if (btn) btn.disabled = true;

    try {
      const addRes = await fetch('/cart/add.js', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Requested-With': 'XMLHttpRequest'
        },
        body: JSON.stringify({ id: parseInt(this.settings.variantId), quantity: 1 })
      });

      if (!addRes.ok) return;

      // Apply discount code to session so Shopify prices gift at £0
      try {
        await fetch('/discount/' + encodeURIComponent(this.settings.discountCode));
      } catch (e) {
        // discount apply is best-effort
      }

      this.refreshCartSections();
    } catch (error) {
      console.error('GB promo gift: addGift error', error);
    } finally {
      this.isProcessing = false;
      if (btn) btn.disabled = false;
    }
  }

  refreshCartSections() {
    const sectionsToRender = [
      { id: 'mini-cart', section: document.getElementById('mini-cart')?.dataset.id || 'mini-cart', selector: '.shopify-section' },
      { id: 'cart-icon-bubble', section: 'cart-icon-bubble', selector: '.shopify-section' },
      { id: 'mobile-cart-icon-bubble', section: 'mobile-cart-icon-bubble', selector: '.shopify-section' },
      { id: 'main-cart-items', section: document.getElementById('main-cart-items')?.dataset.id, selector: '.js-contents' },
      { id: 'main-cart-footer', section: document.getElementById('main-cart-footer')?.dataset.id, selector: '.js-contents' }
    ].filter(s => s.section);

    const sections = sectionsToRender.map(s => s.section).join(',');

    fetch(`${window.location.pathname}?sections=${sections}`)
      .then(res => res.json())
      .then(data => {
        sectionsToRender.forEach(section => {
          const element = document.getElementById(section.id);
          if (element && data[section.section]) {
            const target = element.querySelector(section.selector) || element;
            if (target) {
              const parser = new DOMParser();
              const doc = parser.parseFromString(data[section.section], 'text/html');
              const newContent = doc.querySelector(section.selector);
              if (newContent) {
                target.innerHTML = newContent.innerHTML;
              }
            }
          }
        });

        document.dispatchEvent(new CustomEvent('cart:updated', { detail: { source: 'gb-promo-gift' } }));

        if (typeof publish !== 'undefined' && typeof PUB_SUB_EVENTS !== 'undefined') {
          publish(PUB_SUB_EVENTS.cartUpdate, { source: 'gb-promo-gift' });
        }
      })
      .catch(err => console.error('GB promo gift: section refresh failed', err));
  }
}

new GBPromoGiftHandler();
