# Baseline Testing Checklist - Lunesi Theme

## 📋 Essential Pages to Test

### ✅ MUST TEST (Minimum viable baseline):
- [ ] Homepage (Mobile Lighthouse)
- [ ] Product Page (Mobile Lighthouse) - Use: `/products/[your-best-seller]`
- [ ] Functional test: Add to cart works

### 🎯 RECOMMENDED (Comprehensive baseline):
- [ ] Homepage (Mobile + Desktop Lighthouse)
- [ ] Product Page (Mobile + Desktop Lighthouse)
- [ ] Collection Page (Mobile Lighthouse)
- [ ] Cart Page (Mobile Lighthouse)
- [ ] Cross-browser test (Chrome, Safari, Firefox)

### 🔧 OPTIONAL (Deep analysis):
- [ ] WebPageTest for all page types
- [ ] Real device testing on iPhone/Android
- [ ] Checkout page testing

---

## 📄 Page URLs to Test

**Homepage:**
```
https://spain-test-store-shampoo.myshopify.com/?preview_theme_id=154401570947
```

**Product Page (Choose your best-selling product):**
```
https://spain-test-store-shampoo.myshopify.com/products/[PRODUCT-HANDLE]?preview_theme_id=154401570947
```

**Collection Page:**
```
https://spain-test-store-shampoo.myshopify.com/collections/main-collection?preview_theme_id=154401570947
```

**Cart Page:**
```
https://spain-test-store-shampoo.myshopify.com/cart?preview_theme_id=154401570947
```

---

## 🎯 What Each Page Tests:

### Homepage:
- Initial site load performance
- Hero video/image loading
- Featured collections
- Third-party scripts (GTM, Omnisend)
- Section rendering

### Product Page (MOST IMPORTANT):
- Image gallery performance
- Variant selection JavaScript
- Reviews widgets (Stamped.io)
- Add to cart functionality
- Product recommendations
- Metafield rendering (FAQs, content)

### Collection Page:
- Product grid image loading
- Faceted filtering
- Lazy loading effectiveness
- Pagination

### Cart Page:
- Cart drawer performance
- Quantity updates
- Upsell recommendations
- Checkout button

---

## 📊 Expected Performance Differences:

Typical scores (before optimization):

| Page Type | Expected Mobile Score | Common Issues |
|-----------|----------------------|---------------|
| Homepage | 40-60 | Heavy sections, tracking |
| Product Page | 30-50 ⚠️ | Image galleries, reviews |
| Collection | 50-70 | Image grids |
| Cart | 60-80 | Usually fastest |

**Product pages are typically 10-20 points LOWER than homepage.**

---

## ⚡ Quick Start (15 min baseline):

If you're short on time, do this:

1. **Run Lighthouse Mobile on:**
   - Homepage
   - 1 Product Page (your best seller)

2. **Quick functional test:**
   - Add product to cart
   - View cart
   - Verify checkout accessible

3. **Record the scores** and move to optimization

This gives you enough data to start Phase 1.

---

## 📈 Comprehensive Baseline (60 min):

If you have time, test all page types:

1. Homepage (Mobile + Desktop)
2. Product Page (Mobile + Desktop)
3. Collection Page (Mobile)
4. Cart Page (Mobile)
5. Network/Coverage analysis on each
6. WebPageTest on homepage + product page
7. Real device test

This gives complete picture of site performance.

---

## 🚨 Red Flags to Watch For:

If you see these, prioritize fixing them:

**Homepage:**
- Performance Score <40 🔴
- LCP >4s 🔴
- TBT >600ms 🔴

**Product Page:**
- Performance Score <30 🔴
- LCP >5s 🔴
- Images >1000KB each 🔴
- TBT >800ms 🔴

**Any Page:**
- Console errors 🔴
- Failed network requests 🔴
- Layout shifts (CLS >0.25) 🔴

---

## ✅ Decision Tree:

**After baseline testing:**

1. **If Homepage score >70, Product Page >60:**
   → Minor optimizations needed, focus on specific issues

2. **If Homepage score 50-70, Product Page 40-60:**
   → Follow plan Phases 1-2, expect good results

3. **If Homepage score <50, Product Page <40:**
   → Follow full plan Phases 1-3, significant improvements possible

4. **If Product Page much slower than Homepage (20+ point gap):**
   → Prioritize image optimization (Phase 2) before inline JS (Phase 1)

---

## 🎯 My Recommendation for You:

**Do the "Quick Start" version:**
- Test Homepage + Product Page (Mobile only)
- Takes ~15 minutes
- Gives enough data to start optimizing
- Can always test more pages later

**Why?**
- Fastest way to get baseline
- Covers the 2 most important pages
- You can validate optimizations work on these pages
- Can expand testing later if needed

**After Phase 1 optimizations:**
- Re-test these same 2 pages
- If improvements are good, continue
- If not, we'll adjust the plan

---

## Next Steps:

1. [ ] Run Lighthouse on Homepage (Mobile)
2. [ ] Run Lighthouse on Product Page (Mobile)
3. [ ] Share the scores
4. [ ] I'll analyze and tell you which optimizations to prioritize

