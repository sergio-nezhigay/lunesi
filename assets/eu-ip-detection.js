/**
 * EU Country IP Detection
 * Detects visitor's country via IP geolocation API and shows/hides EU shipping notice
 */

class EUCountryDetector {
  constructor() {
    this.euCountries = ['AT', 'BE', 'BG', 'CY', 'CZ', 'DE', 'DK', 'EE', 'ES', 'FI', 'FR', 'GR', 'HR', 'HU', 'IE', 'IT', 'LT', 'LU', 'LV', 'MT', 'NL', 'PL', 'PT', 'RO', 'SE', 'SI', 'SK'];
    this.cacheKey = 'visitor_country_code';
    this.cacheExpiry = 24 * 60 * 60 * 1000; // 24 hours in milliseconds

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
    const isEU = this.euCountries.includes(countryCode);
    console.log('[EU Detection] Country:', countryCode, '| Is EU:', isEU);

    // Find all EU shipping notices
    const notices = document.querySelectorAll('.eu-shipping-notice');

    notices.forEach(notice => {
      if (isEU) {
        notice.style.display = 'block';
        notice.setAttribute('data-eu-detected', 'true');
      } else {
        notice.style.display = 'none';
        notice.setAttribute('data-eu-detected', 'false');
      }
    });

    // Dispatch custom event for other scripts that might need this info
    document.dispatchEvent(new CustomEvent('eu-country-detected', {
      detail: { countryCode, isEU }
    }));
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
