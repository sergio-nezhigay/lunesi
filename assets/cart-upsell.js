window.cartUpsellScriptLoaded = true;

(function(){
  const ADD_START_DELAY = 700;   // Delay before showing "added"
  const ADDED_DURATION   = 2000;   // How long "added" stays visible
  const UPDATE_DELAY     = 500;    // Delay before re-initializing after cart update
  let isInitialized      = false;

  // Стилі для кнопки
  const styleEl = document.createElement('style');
  styleEl.textContent = `
    .mini-cart__upsell-add-button {
      transition: background-color 1s ease !important;
    }
    .mini-cart__upsell-add-button.added {
      background-color: #7ac37a !important;
      color: #fff !important;
    }
    .mini-cart__upsell-add-button .custom-button-text {
      display: block;
      width: 100%;
      text-align: center;
    }
  `;
  document.head.appendChild(styleEl);

  function initCartUpsell(){
    if (isInitialized) return;
    const buttons = document.querySelectorAll('.mini-cart__upsell-add-button');
    if (buttons.length === 0) {
      setTimeout(initCartUpsell, 300);
      return;
    }
    isInitialized = true;
    setupMutationObserver();
    setupAddToCartButtons();
    applyPersistedState();
  }

  function setupMutationObserver(){
    const observer = new MutationObserver(muts => {
      for (let m of muts) {
        if (m.type === 'childList' && m.addedNodes.length) {
          const found = Array.from(m.addedNodes).some(n =>
            n.nodeType === 1 && (
              n.classList?.contains('mini-cart__upsell') ||
              n.querySelector?.('.mini-cart__upsell')
            )
          );
          if (found) {
            isInitialized = false;
            setTimeout(initCartUpsell, 300);
            break;
          }
        }
      }
    });
    observer.observe(document.body, { childList: true, subtree: true });
  }

  function setupAddToCartButtons(){
    document.querySelectorAll('.mini-cart__upsell-add-button').forEach(host => {
      const text = host.textContent.trim();
      if (!host.querySelector('.custom-button-text')) {
        host.setAttribute('data-original-text', text);
        const span = document.createElement('span');
        span.className = 'custom-button-text';
        span.textContent = text;
        host.textContent = '';
        host.appendChild(span);
      }
      host.removeEventListener('click', handleAddToCartClick);
      host.addEventListener('click', handleAddToCartClick);
    });
  }

  function handleAddToCartClick(e){
    e.stopPropagation();
    e.preventDefault();
    const host = e.currentTarget.closest?.('.mini-cart__upsell-add-button') || e.currentTarget;
    if (!host) return;

    const span     = host.querySelector('.custom-button-text');
    const original = host.getAttribute('data-original-text');
    const pid      = host.getAttribute('data-product-id');
    const vid      = host.getAttribute('data-variant-id');
    const width    = host.getBoundingClientRect().width;
    host.style.width = `${width}px`;

    const ts = Date.now();
    if (pid) localStorage.setItem('upsell_added_' + pid, ts.toString());

    // Показати "ADDED!" з затримкою
    setTimeout(() => {
      host.classList.add('added');
      if (span) span.textContent = 'ADDED!';
      // Приховати через ADDED_DURATION
      setTimeout(() => {
        host.classList.remove('added');
        if (span) span.textContent = original;
        host.style.width = '';
        if (pid) localStorage.removeItem('upsell_added_' + pid);
      }, ADDED_DURATION);
    }, ADD_START_DELAY);

    if (vid) {
      fetch('/cart/add.js', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: vid, quantity: 1 })
      })
      .then(res => res.json())
      .then(() => document.dispatchEvent(new Event('cart:updated')))
      .catch(() => {});
    }
  }

  function applyPersistedState(){
    document.querySelectorAll('.mini-cart__upsell-add-button').forEach(host => {
      const pid   = host.getAttribute('data-product-id');
      const tsStr = pid && localStorage.getItem('upsell_added_' + pid);
      if (!tsStr) return;

      const ts      = parseInt(tsStr, 10);
      const elapsed = Date.now() - ts;
      if (elapsed < ADD_START_DELAY + ADDED_DURATION) {
        const span     = host.querySelector('.custom-button-text');
        const original = host.getAttribute('data-original-text');
        const width    = host.getBoundingClientRect().width;
        host.style.width = `${width}px`;

        const startDelay = Math.max(ADD_START_DELAY - elapsed, 0);
        const visibleTime = ADDED_DURATION - Math.max(elapsed - ADD_START_DELAY, 0);

        setTimeout(() => {
          host.classList.add('added');
          if (span) span.textContent = 'ADDED!';
          setTimeout(() => {
            host.classList.remove('added');
            if (span) span.textContent = original;
            host.style.width = '';
            localStorage.removeItem('upsell_added_' + pid);
          }, visibleTime);
        }, startDelay);
      } else {
        localStorage.removeItem('upsell_added_' + pid);
      }
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initCartUpsell);
  } else {
    initCartUpsell();
  }

  ['cart:updated','cart:refresh','drawer:open','cart.requestComplete','cart.rendered']
    .forEach(evt =>
      document.addEventListener(evt, () => {
        isInitialized = false;
        setTimeout(initCartUpsell, UPDATE_DELAY);
      })
    );

  window.reinitializeUpsell = () => { isInitialized = false; initCartUpsell(); };
  window.initCartUpsell = initCartUpsell;
})();
