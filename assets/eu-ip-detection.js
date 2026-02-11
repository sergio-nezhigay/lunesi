/**
 * EU Country IP Detection
 * Detects visitor's country via IP geolocation API and shows/hides EU shipping notice
 */

class EUCountryDetector {
  constructor() {
    this.euCountries = ['AT', 'BE', 'BG', 'CY', 'CZ', 'DE', 'DK', 'EE', 'ES', 'FI', 'FR', 'GR', 'HR', 'HU', 'IE', 'IT', 'LT', 'LU', 'LV', 'MT', 'NL', 'PL', 'PT', 'RO', 'SE', 'SI', 'SK'];
    this.cacheKey = 'visitor_country_code';
    this.cacheExpiry = 24 * 60 * 60 * 1000; // 24 hours in milliseconds
    this.detectedCountry = null;
    this.isEUCountry = false;

    this.init();
  }

  init() {
    // Check if we have a cached country code
    const cachedData = this.getCachedCountry();

    if (cachedData) {
      console.log('[EU Detection] Using cached country:', cachedData.country);
      this.handleCountryDetected(cachedData.country);
    } else {
      console.log('[EU Detection] Fetching country from IP...');
      this.fetchCountryFromIP();
    }

    // Listen for cart updates to re-apply to dynamically loaded content
    this.setupCartListeners();
  }

  setupCartListeners() {
    // Listen for Shopify cart updates (theme uses pub/sub system)
    if (typeof PubSub !== 'undefined') {
      PubSub.subscribe('cart-update', () => {
        console.log('[EU Detection] Cart updated, re-applying EU notices');
        setTimeout(() => this.updateNotices(), 100);
      });
    }

    // Listen for cart drawer opening (actual event from cart-drawer.js)
    document.addEventListener('cartdrawer:opened', () => {
      console.log('[EU Detection] Cart drawer opened, re-applying EU notices');
      setTimeout(() => this.updateNotices(), 200);
    });

    // Also check periodically for new notices (fallback for dynamic content)
    this.noticeCheckInterval = setInterval(() => {
      if (this.detectedCountry) {
        const notices = document.querySelectorAll('.eu-shipping-notice');
        const visibleNotices = Array.from(notices).filter(n => n.offsetParent !== null);

        // Only log if we find notices that need updating
        if (visibleNotices.length > 0) {
          const needsUpdate = visibleNotices.some(n => !n.hasAttribute('data-eu-detected'));
          if (needsUpdate) {
            console.log('[EU Detection] Found new notices, updating...');
            this.updateNotices();
          }
        }
      }
    }, 1000);
  }

  getCachedCountry() {
    try {
      const cached = localStorage.getItem(this.cacheKey);
      if (!cached) return null;

      const data = JSON.parse(cached);
      const now = new Date().getTime();

      // Check if cache is still valid
      if (now - data.timestamp < this.cacheExpiry) {
        return data;
      } else {
        // Cache expired, remove it
        localStorage.removeItem(this.cacheKey);
        return null;
      }
    } catch (e) {
      console.error('[EU Detection] Error reading cache:', e);
      return null;
    }
  }

  setCachedCountry(countryCode) {
    try {
      const data = {
        country: countryCode,
        timestamp: new Date().getTime()
      };
      localStorage.setItem(this.cacheKey, JSON.stringify(data));
    } catch (e) {
      console.error('[EU Detection] Error setting cache:', e);
    }
  }

  async fetchCountryFromIP() {
    try {
      // Using ipapi.co - free tier allows 1000 requests/day, no API key needed
      const response = await fetch('https://ipapi.co/json/');

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = await response.json();
      const countryCode = data.country_code;

      if (countryCode) {
        console.log('[EU Detection] Detected country from IP:', countryCode);
        this.setCachedCountry(countryCode);
        this.handleCountryDetected(countryCode);
      } else {
        console.warn('[EU Detection] No country code in API response');
        this.handleDetectionFailed();
      }
    } catch (error) {
      console.error('[EU Detection] Error fetching country:', error);
      this.handleDetectionFailed();
    }
  }

  handleCountryDetected(countryCode) {
    this.detectedCountry = countryCode;
    this.isEUCountry = this.euCountries.includes(countryCode);

    console.log('[EU Detection] Country:', countryCode, '| Is EU:', this.isEUCountry);

    // Store globally for easy access
    window.visitorCountry = countryCode;
    window.isEUVisitor = this.isEUCountry;

    // Store on document body as data attribute
    document.body.setAttribute('data-visitor-country', countryCode);
    document.body.setAttribute('data-is-eu-visitor', this.isEUCountry);

    // Apply to all notices
    this.updateNotices();

    // Dispatch custom event for other scripts that might need this info
    document.dispatchEvent(new CustomEvent('eu-country-detected', {
      detail: { countryCode, isEU: this.isEUCountry }
    }));
  }

  updateNotices() {
    if (!this.detectedCountry) return;

    // Find all EU shipping notices (including dynamically loaded ones)
    const notices = document.querySelectorAll('.eu-shipping-notice');

    console.log('[EU Detection] Found', notices.length, 'EU notices to update');

    notices.forEach(notice => {
      if (this.isEUCountry) {
        notice.style.display = 'block';
        notice.setAttribute('data-eu-detected', 'true');
      } else {
        notice.style.display = 'none';
        notice.setAttribute('data-eu-detected', 'false');
      }
    });
  }

  handleDetectionFailed() {
    console.warn('[EU Detection] Failed to detect country, hiding EU notices by default');

    // Hide all EU notices if detection fails
    const notices = document.querySelectorAll('.eu-shipping-notice');
    notices.forEach(notice => {
      notice.style.display = 'none';
      notice.setAttribute('data-eu-detected', 'failed');
    });
  }
}

// Initialize when DOM is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => {
    new EUCountryDetector();
  });
} else {
  new EUCountryDetector();
}
