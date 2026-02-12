(function() {
  'use strict';

  const CONFIG = {
    subscriberId: '9042b354-cad0-4f17-98fb-bb5a495d6e8a',
    apiBaseUrl: 'https://api.okendo.io/v1',
    initDelay: 500,
    storageKey: 'okendo_review_timestamps',
    storageDuration: 90 * 24 * 60 * 60 * 1000
  };

  const TimestampStorage = {
    get() {
      try {
        const data = localStorage.getItem(CONFIG.storageKey);
        if (!data) return {};
        const parsed = JSON.parse(data);
        const now = Date.now();
        Object.keys(parsed).forEach(key => {
          if (now - parsed[key].saved > CONFIG.storageDuration) {
            delete parsed[key];
          }
        });
        return parsed;
      } catch (e) {
        return {};
      }
    },

    set(reviewId, timestamp) {
      try {
        const storage = this.get();
        storage[reviewId] = {
          timestamp: timestamp,
          saved: Date.now()
        };
        localStorage.setItem(CONFIG.storageKey, JSON.stringify(storage));
      } catch (e) {}
    },

    getTimestamp(reviewId, fallbackDate) {
      const storage = this.get();
      if (storage[reviewId]) {
        return storage[reviewId].timestamp;
      }
      const date = new Date(fallbackDate);
      const hour = Math.floor(Math.random() * 14) + 8;
      const minute = Math.floor(Math.random() * 60);
      const second = Math.floor(Math.random() * 60);
      date.setHours(hour, minute, second, 0);
      const timestamp = date.toISOString();
      this.set(reviewId, timestamp);
      return timestamp;
    }
  };

  async function fetchOkendoReviewsWithPagination(productId) {
    if (!productId) return null;

    const allReviews = [];
    let nextUrl = `${CONFIG.apiBaseUrl}/stores/${CONFIG.subscriberId}/products/shopify-${productId}/reviews?limit=25`;
    let pageCount = 0;
    const maxPages = 50;

    try {
      while (nextUrl && pageCount < maxPages) {
        const response = await fetch(nextUrl, {
          method: 'GET',
          headers: { 'Content-Type': 'application/json' }
        });

        if (!response.ok) {
          if (pageCount === 0) throw new Error(`API error: ${response.status}`);
          break;
        }

        const data = await response.json();
        const reviews = data.reviews || [];

        if (reviews.length > 0) {
          allReviews.push(...reviews);
        }

        if (data.nextUrl) {
          nextUrl = data.nextUrl.startsWith('http')
            ? data.nextUrl
            : `${CONFIG.apiBaseUrl}${data.nextUrl}`;
        } else {
          nextUrl = null;
        }

        pageCount++;

        if (reviews.length < 25) break;
      }

      let reviewAggregate = null;
      if (allReviews.length > 0) {
        let totalRating = 0;
        allReviews.forEach(review => {
          totalRating += (review.rating || 5);
        });
        reviewAggregate = {
          averageRating: totalRating / allReviews.length,
          reviewCount: allReviews.length
        };
      }

      return {
        reviews: allReviews,
        reviewAggregate: reviewAggregate
      };

    } catch (error) {
      return null;
    }
  }

  function generateCompleteProductSchema(productData, reviewsData) {
    const schema = {
      "@context": "https://schema.org/",
      "@type": "Product",
      "name": productData.title,
      "url": productData.url,
      "description": productData.description,
      "image": [productData.image],
      "brand": {
        "@type": "Brand",
        "name": "Lunesi"
      },
      "offers": [{
        "@type": "Offer",
        "availability": productData.availability,
        "price": productData.price,
        "priceCurrency": productData.currency,
        "url": productData.url,
        "shippingDetails": [
          {
            "@type": "OfferShippingDetails",
            "shippingDestination": {
              "@type": "DefinedRegion",
              "addressCountry": "GB"
            },
            "deliveryTime": {
              "@type": "ShippingDeliveryTime",
              "handlingTime": {
                "@type": "QuantitativeValue",
                "minValue": 0,
                "maxValue": 1,
                "unitCode": "DAY"
              },
              "transitTime": {
                "@type": "QuantitativeValue",
                "minValue": 2,
                "maxValue": 4,
                "unitCode": "DAY"
              }
            },
            "shippingRate": {
              "@type": "MonetaryAmount",
              "value": "0.00",
              "currency": "GBP"
            },
            "name": "UK Standard Delivery via Royal Mail"
          },
          {
            "@type": "OfferShippingDetails",
            "shippingDestination": {
              "@type": "DefinedRegion",
              "addressCountry": "GB"
            },
            "deliveryTime": {
              "@type": "ShippingDeliveryTime",
              "transitTime": {
                "@type": "QuantitativeValue",
                "minValue": 1,
                "maxValue": 2,
                "unitCode": "DAY"
              }
            },
            "name": "UK Express Delivery via Royal Mail or DHL Express"
          },
          {
            "@type": "OfferShippingDetails",
            "shippingDestination": {
              "@type": "DefinedRegion",
              "addressCountry": "EU"
            },
            "deliveryTime": {
              "@type": "ShippingDeliveryTime",
              "transitTime": {
                "@type": "QuantitativeValue",
                "minValue": 7,
                "maxValue": 13,
                "unitCode": "DAY"
              }
            },
            "name": "Europe Standard Delivery via Royal Mail or DHL"
          },
          {
            "@type": "OfferShippingDetails",
            "shippingDestination": {
              "@type": "DefinedRegion",
              "addressCountry": "EU"
            },
            "deliveryTime": {
              "@type": "ShippingDeliveryTime",
              "transitTime": {
                "@type": "QuantitativeValue",
                "minValue": 3,
                "maxValue": 6,
                "unitCode": "DAY"
              }
            },
            "name": "Europe Express Delivery via DHL Express"
          }
        ],
        "hasMerchantReturnPolicy": {
          "@type": "MerchantReturnPolicy",
          "applicableCountry": "GB",
          "returnPolicyCategory": "https://schema.org/MerchantReturnFiniteReturnWindow",
          "merchantReturnDays": 14,
          "returnMethod": "http://schema.org/ReturnByMail",
          "returnFees": "https://schema.org/FreeReturn",
          "returnPolicySeasonalOverride": false,
          "additionalProperty": [
            {
              "@type": "PropertyValue",
              "name": "Return conditions",
              "value": "Items must be unused, unopened, and in original packaging. Return requests must be submitted via email before sending items back."
            }
          ]
        }
      }]
    };

    if (productData.sku) {
      schema.sku = productData.sku;
      schema.offers[0].sku = productData.sku;
    }

    if (reviewsData) {
      const reviews = reviewsData.reviews || [];
      const aggregate = reviewsData.reviewAggregate;

      console.log('🔍 DEBUG - Reviews data:', {
        totalReviews: reviews.length,
        aggregateReviewCount: aggregate?.reviewCount,
        aggregateRating: aggregate?.averageRating
      });

      if (aggregate && aggregate.reviewCount > 0 && aggregate.averageRating && aggregate.averageRating > 0) {
        schema.aggregateRating = {
          "@type": "AggregateRating",
          "ratingValue": Number(aggregate.averageRating).toFixed(1),
          "reviewCount": aggregate.reviewCount.toString(),
          "bestRating": "5",
          "worstRating": "1"
        };
      }

      if (reviews.length > 0) {
        schema.review = reviews.map(review => {
          const reviewId = review.id || review.reviewId || `${productData.id}_${review.dateCreated}`;
          const fallbackDate = review.dateCreated || review.createdAt || new Date().toISOString();
          const datePublished = TimestampStorage.getTimestamp(reviewId, fallbackDate);

          const reviewSchema = {
            "@type": "Review",
            "author": {
              "@type": "Person",
              "name": review.reviewer?.displayName ||
                      review.reviewerName ||
                      review.author?.name ||
                      "Customer"
            },
            "datePublished": datePublished,
            "reviewRating": {
              "@type": "Rating",
              "ratingValue": (review.rating || 5).toString(),
              "bestRating": "5",
              "worstRating": "1"
            }
          };

          if (review.body || review.reviewBody || review.description) {
            reviewSchema.reviewBody = review.body || review.reviewBody || review.description;
          }

          return reviewSchema;
        });
      }
    }

    return schema;
  }

  function injectSchema(schema) {
    const existingSchemas = document.querySelectorAll('script[type="application/ld+json"]');
    existingSchemas.forEach(script => {
      try {
        const data = JSON.parse(script.textContent);
        if (data['@type'] === 'Product') {
          script.remove();
        }
      } catch (e) {}
    });

    const script = document.createElement('script');
    script.type = 'application/ld+json';
    script.setAttribute('data-product-schema', 'true');
    script.textContent = JSON.stringify(schema, null, 2);
    document.head.appendChild(script);
  }

  async function initCompleteProductSchema() {
    try {
      // Get product data from global window object set by Liquid
      const productData = window.productSchemaData;

      if (!productData || !productData.id) return;

      const reviewsData = await fetchOkendoReviewsWithPagination(productData.id);
      const schema = generateCompleteProductSchema(productData, reviewsData);
      injectSchema(schema);

    } catch (error) {
      console.error('Product schema error:', error);
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
      setTimeout(initCompleteProductSchema, CONFIG.initDelay);
    });
  } else {
    setTimeout(initCompleteProductSchema, CONFIG.initDelay);
  }

  if (window.Shopify && window.Shopify.theme) {
    document.addEventListener('variant:change', () => {
      setTimeout(initCompleteProductSchema, 200);
    });
  }

})();
