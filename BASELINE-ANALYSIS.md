# 🔴 BASELINE PERFORMANCE ANALYSIS - HOMEPAGE (MOBILE)

**Date:** 2025-12-25
**URL:** https://lunesi.co.uk
**Device:** Emulated Moto G Power (Mobile)

---

## 📊 LIGHTHOUSE SCORES

| Metric | Score | Target | Status | Gap |
|--------|-------|--------|--------|-----|
| **Performance Score** | **53/100** | 90+ | 🔴 POOR | -37 points |
| **FCP** | **2.5s** | <1.8s | 🟡 NEEDS WORK | +0.7s too slow |
| **LCP** | **9.2s** | <2.5s | 🔴 CRITICAL | +6.7s too slow! |
| **TBT** | **530ms** | <200ms | 🔴 HIGH | +330ms too high |
| **CLS** | **0** | <0.1 | ✅ PERFECT | None |
| **Speed Index** | **6.4s** | <3.0s | 🔴 VERY SLOW | +3.4s |

---

## 🚨 CRITICAL FINDINGS

### 🔴 #1 PROBLEM: VIDEOS ARE KILLING PERFORMANCE

**Network Payload: 24,822 KiB (24.2 MB)**

**Video Files Loading on Homepage:**
1. `0dadb54...HD-1080p-7.2Mbps.mp4` - **8,381 KiB (8.2 MB)**
2. `c49f96f...HD-1080p-7.2Mbps.mp4` - **4,789 KiB (4.7 MB)** - LOADED TWICE!
3. `8c80894...HD-1080p-7.2Mbps.mp4` - **289 KiB**
4. `9a68a26...HD-1080p-7.2Mbps.mp4` - **257 KiB**

**Total Video Payload: ~20 MB** (83% of total page weight!)

**Impact on LCP:**
- LCP is 9.2 seconds
- LCP element: `video` (the hero)
- Resource load duration: 2,560ms just for the video
- This is the **PRIMARY BOTTLENECK**

**⚠️ THIS WAS NOT IN THE ORIGINAL PLAN - WE MUST ADD VIDEO OPTIMIZATION AS PHASE 0!**

---

### 🔴 #2 PROBLEM: IMAGES ARE TOO LARGE

**Total Image Savings Available: 1,047 KiB**

**Examples:**
- Image requested: **750x935 pixels**
- Image displayed: **186x248 pixels**
- **Waste: 4x larger than needed!**

**All product card images have this problem:**
- 10+ images on homepage
- Each ~150-200 KiB when they should be ~40-50 KiB
- Confirms our Phase 2.1 analysis

---

### 🔴 #3 PROBLEM: THIRD-PARTY SCRIPTS

**Total Third-Party Payload: 1,180 KiB**

| Third-Party | Size | Main Thread Time | Impact |
|-------------|------|------------------|--------|
| **Google Tag Manager** | 664 KiB | 175ms | 🔴 High |
| **Facebook Pixel** | 126 KiB | 52ms | 🟡 Medium |
| **Omnisend** | 68 KiB | 32ms | 🟡 Medium |
| **Okendo Reviews** | 64 KiB | 7ms | 🟢 Low |
| **Smartlook Analytics** | 21 KiB | 1ms | 🟢 Low |
| **Quizify** | 14 KiB | 3ms | 🟢 Low |

**Unused JavaScript: 398 KiB**
- GTM: 346 KiB unused
- Facebook: 31 KiB unused
- Total waste from third-parties

---

### 🟡 #4 PROBLEM: RENDER-BLOCKING CSS

**CSS Files Blocking Render:** 8.8 KiB total (180ms delay)

- `accelerated-checkout-backwards-compat.css` - 2.4 KiB, 500ms
- `section-image-banner.css` - 1.9 KiB, 500ms
- `section-video-hero.css` - 1.2 KiB
- `section-announcement-bar.css` - 1.8 KiB, 500ms
- `component-transparent-header.css` - 1.6 KiB, 500ms
- `md-app-modal.min.css` - 4.5 KiB, 1,220ms

**Total Blocking Time: 1,990ms just for CSS!**

---

### 🟡 #5 PROBLEM: FONT LOADING

**Custom Font Issues:**

**File:** `AttilaSan....otf` (9 KiB)
- Using **OTF format** instead of WOFF2 (60% larger)
- **Missing `font-display: swap`** - causes invisible text (FOIT)
- Est savings: 60ms

**This matches our Phase 2.3 plan perfectly.**

---

### 🟡 #6 PROBLEM: JAVASCRIPT EXECUTION

**Total JavaScript Execution: 2.2 seconds**

**Main Thread Work: 13.2 seconds total**
- Script Evaluation: 2,322ms
- Style & Layout: 1,401ms
- Script Parsing: 421ms
- Rendering: 365ms
- Other: 8,313ms

**Long Tasks: 20 found** (blocking user interaction)

**Top Offenders:**
- `https://lunesi.co.uk` - 1,074ms (main HTML parsing)
- `cart-upsell.js` - 118ms
- `shopify-perf-kit.js` - 110ms
- GTM scripts - 509ms total
- Facebook - 210ms

---

## 🎯 WHAT THESE NUMBERS MEAN

### LCP: 9.2 seconds - WHY SO SLOW?

**LCP Breakdown:**
- **Time to First Byte:** 30ms ✅ (Server is fast)
- **Resource Load Delay:** 710ms 🟡 (Time waiting to start download)
- **Resource Load Duration:** 2,560ms 🔴 (Downloading the video)
- **Element Render Delay:** -1,670ms (Negative = rendered early)

**The problem:** The video hero is **2.6 seconds just to download**, plus 710ms delay = 3.3s for video alone. But LCP is 9.2s, meaning there are other resources blocking it from rendering.

### TBT: 530ms - JavaScript Blocking

**Total Blocking Time** measures how long the page is frozen due to JavaScript.

**Your 530ms breakdown:**
- GTM: ~175ms
- Facebook: ~52ms
- Omnisend: ~32ms
- Your own JS: ~271ms

**This matches our Phase 1 plan - need to defer/async third-party scripts.**

### Network Payload: 24.2 MB - ENORMOUS

**Breakdown:**
- Videos: ~20 MB (83%)
- Images: ~2 MB (8%)
- JavaScript: ~1.2 MB (5%)
- CSS: ~1 MB (4%)

**Mobile users on 3G:** This would take 60-90 seconds to fully load!

---

## 🔄 REVISED PLAN PRIORITY

Based on your actual results, here's what will have the BIGGEST impact:

### ⚡ PHASE 0: VIDEO OPTIMIZATION (NEW - HIGHEST PRIORITY)

**Impact: Could improve LCP by 5-7 seconds!**

**Actions:**
1. **Compress hero video:**
   - Current: 8.2 MB, 1080p HD, 7.2Mbps
   - Target: <2 MB, 720p, 2Mbps for mobile
   - Tool: HandBrake, FFmpeg, or online compressor

2. **Lazy-load non-hero videos:**
   - TikTok section videos (section_tiktok_iixJNM) should NOT load on initial page load
   - Load only when user scrolls near them

3. **Use poster image for hero video:**
   - Show image first (instant)
   - Load video in background
   - Improves perceived LCP dramatically

4. **Consider removing some videos:**
   - Do you need 5 videos on homepage?
   - Each adds massive weight

**Expected Impact:**
- LCP: 9.2s → 3.5-4.5s (5-6s improvement!)
- Page Weight: 24MB → 4-6MB (75% reduction!)
- Performance Score: 53 → 65-70 (+12-17 points)

---

### ⚡ PHASE 1: IMAGE OPTIMIZATION (MOVED UP)

**Impact: 1,047 KiB savings, LCP improvement**

**Actions:**
1. Fix image sizing: 750px → 186px for product cards
2. Add responsive srcset
3. Proper lazy loading

**Expected Impact:**
- Image payload: -1MB
- LCP: Additional 0.5-1s improvement
- Performance Score: +5-8 points

---

### ⚡ PHASE 2: THIRD-PARTY SCRIPT OPTIMIZATION

**Impact: 398 KiB unused JS, TBT reduction**

**Actions:**
1. Defer GTM loading (currently blocks 175ms)
2. Defer Facebook Pixel
3. Lazy-load Omnisend

**Expected Impact:**
- TBT: 530ms → 200ms (-330ms)
- Performance Score: +8-12 points

---

### ⚡ PHASE 3: RENDER-BLOCKING CSS & FONTS

**Impact: 180ms + 60ms savings**

**Actions:**
1. Critical CSS extraction
2. Defer non-critical CSS
3. Convert OTF to WOFF2
4. Add font-display: swap

**Expected Impact:**
- FCP: 2.5s → 1.5-1.8s
- Performance Score: +5-8 points

---

## 📋 UPDATED PRIORITY ORDER

**OLD PLAN ORDER:**
1. Extract inline JS ← Not the biggest problem!
2. Critical CSS
3. Image optimization
4. Video not addressed

**NEW PLAN ORDER (Based on YOUR Data):**
1. **🔴 VIDEO OPTIMIZATION** ← Biggest impact (5-7s LCP improvement!)
2. **🔴 IMAGE OPTIMIZATION** ← Second biggest (1s LCP improvement)
3. **🟡 THIRD-PARTY SCRIPTS** ← Fix TBT (330ms improvement)
4. **🟡 CSS & FONTS** ← Fix FCP (0.5-1s improvement)
5. **🟢 INLINE JS** ← Still important but lower impact now

---

## 🎯 REALISTIC TARGETS AFTER OPTIMIZATION

**With Video + Image + Third-Party optimization:**

| Metric | Baseline | Realistic Target | Optimistic Target |
|--------|----------|------------------|-------------------|
| Performance | 53 | 75-85 | 85-90 |
| LCP | 9.2s | 2.5-3.5s | 1.8-2.5s |
| FCP | 2.5s | 1.5-1.8s | 1.0-1.5s |
| TBT | 530ms | 150-250ms | <150ms |
| Page Weight | 24.2 MB | 4-6 MB | 2-4 MB |

---

## ❓ ANSWERING YOUR QUESTIONS

### Q1: Can you optimize the plan based on these results?

**YES! Major changes needed:**

**The original plan missed the #1 problem: VIDEOS!**

Your homepage has:
- 5 HD videos (20 MB total)
- Video hero is the LCP element (9.2s!)
- This wasn't in the original plan because the code analysis showed videos but didn't reveal the huge file sizes

**New Phase 0 (MUST DO FIRST):**
1. Compress hero video: 8.2 MB → <2 MB
2. Remove or lazy-load TikTok section videos
3. Use poster images for faster initial render

**This single change could improve LCP from 9.2s → 3.5s (60% improvement!)**

---

### Q2: Is testing only homepage enough?

**For YOUR site - YES, homepage baseline is enough to start, BUT:**

**Homepage reveals critical issues:**
- 9.2s LCP (video problem)
- 24 MB page weight (video + images)
- 530ms TBT (third-party scripts)

**These issues likely exist on ALL pages.**

**RECOMMENDATION:**

✅ **Start optimizing homepage now** - the issues are clear

⚠️ **But also quickly test 1 product page** to see if it's even worse

**Why test product page too?**
- Product pages typically have:
  - Multiple product images (gallery)
  - Reviews widgets (Okendo in your case)
  - More complex JavaScript
- Your product template has 16 sections (vs 14 on homepage)
- Product page LCP could be 10-12 seconds (even worse!)

**Quick test (5 minutes):**
1. Pick your best-selling product URL
2. Run Lighthouse Mobile on it
3. Check if LCP is worse than 9.2s
4. If product page is much worse, we'll prioritize it

---

## 🎯 IMMEDIATE NEXT STEPS

**Option A: Start Optimizing Homepage Now (Recommended)**
- We have enough data
- Video optimization will have massive impact
- Can test product page later

**Option B: Quick Product Page Test First**
- Takes 5 minutes
- Confirms if product pages are worse
- Then start optimizing

**My Recommendation: Option A** - Your homepage issues are severe and clear. Start fixing videos immediately.

---

## 📝 BASELINE RECORDED

Let me save your exact numbers:

```
========================================
BASELINE PERFORMANCE REPORT
Date: 2025-12-25
Page: Homepage (lunesi.co.uk)
Device: Mobile (Emulated Moto G Power)
========================================

LIGHTHOUSE METRICS (Mobile):
- Performance Score: 53 / 100 🔴
- FCP: 2.5 s 🟡 (Target: <1.8s)
- LCP: 9.2 s 🔴 (Target: <2.5s) ← CRITICAL!
- TBT: 530 ms 🔴 (Target: <200ms)
- CLS: 0 ✅ (Target: <0.1) PERFECT!
- Speed Index: 6.4 s 🔴

NETWORK METRICS:
- Total Payload: 24,822 KiB (24.2 MB) 🔴
- Videos: ~20 MB (83%)
- Images: ~2 MB
- JavaScript: ~1.2 MB
- Third-party: 1,180 KiB

CRITICAL ISSUES:
1. Video hero: 8.2 MB (causing 9.2s LCP)
2. Images: 750px served for 186px display
3. Third-party scripts: 398 KiB unused
4. Render-blocking CSS: 180ms delay
5. Custom OTF font: needs WOFF2 + font-display

BIGGEST PAIN POINT:
Videos! 20 MB of video on homepage is crushing performance.

REVISED OPTIMIZATION PRIORITY:
1. VIDEO compression/optimization (Est: -6s LCP)
2. IMAGE sizing (Est: -1s LCP)
3. THIRD-PARTY script deferral (Est: -330ms TBT)
4. CSS/Font optimization (Est: -0.7s FCP)

EXPECTED IMPROVEMENT (All phases):
- Performance Score: 53 → 85-90 (+32-37 points)
- LCP: 9.2s → 1.8-2.5s (-6.7 to -7.4s)
- Page Weight: 24 MB → 2-4 MB (-20 MB, 83% reduction)

========================================
```

---

## ⚠️ WARNING: Inline JavaScript Is NOT Your Main Problem

**Original plan assumed inline JS was #1 bottleneck.**

**Reality: Your main bottlenecks are:**
1. Videos (20 MB, 9.2s LCP) 🔴
2. Images (oversized by 4x) 🔴
3. Third-party scripts (1.2 MB) 🟡
4. Render-blocking CSS 🟡

**Inline JavaScript extraction is still good, but it's now lower priority.**

