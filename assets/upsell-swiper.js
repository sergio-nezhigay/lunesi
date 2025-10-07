(function() {
  'use strict';
  
  let sliderInstance = null;
  
  class UpsellSlider {
    constructor(container) {
      this.container = container;
      this.slidesWrapper = container.querySelector('.slider-wrapper');
      this.slides = Array.from(container.querySelectorAll('.slider-slide'));
      this.pagination = container.querySelector('.slider-pagination');
      
      this.currentSlide = 0;
      this.slidesCount = this.slides.length;
      this.isAnimating = false;
      this.startX = 0;
      this.currentX = 0;
      this.isDragging = false;
      this.threshold = 30;
      this.isResizing = false;
      
      this.init();
    }
    
    init() {
      if (this.slidesCount <= 1) {
        if (this.pagination) this.pagination.style.display = 'none';
        return;
      }
      
      this.setupSlides();
      this.createPagination();
      this.bindEvents();
      this.goToSlide(0, false);
      this.updateWrapperHeight(false);
    }
    
    setupSlides() {
      this.slides.forEach((slide, index) => {
        slide.style.transform = `translateX(${index * 100}%)`;
        slide.style.transition = 'transform 0.5s cubic-bezier(0.23, 1, 0.32, 1)';
        slide.style.position = 'absolute';
        slide.style.top = '0';
        slide.style.left = '0';
        slide.style.width = '100%';
        slide.style.height = 'auto';
        slide.classList.add('slider-slide-initialized');
      });
      
      if (this.slidesWrapper) {
        this.slidesWrapper.style.position = 'relative';
        this.slidesWrapper.style.overflow = 'hidden';
        this.slidesWrapper.style.transition = 'height 0.5s cubic-bezier(0.23, 1, 0.32, 1)';
      }
    }
    
    updateWrapperHeight(animate = true) {
      if (this.slides[this.currentSlide] && !this.isResizing) {
        this.isResizing = true;
        
        if (!animate) {
          this.slidesWrapper.style.transition = 'none';
        }
        
        setTimeout(() => {
          if (this.slides[this.currentSlide]) {
            const currentSlideHeight = this.slides[this.currentSlide].offsetHeight;
            this.slidesWrapper.style.height = currentSlideHeight + 'px';
          }
          
          if (!animate) {
            setTimeout(() => {
              this.slidesWrapper.style.transition = 'height 0.5s cubic-bezier(0.23, 1, 0.32, 1)';
            }, 50);
          }
          
          setTimeout(() => {
            this.isResizing = false;
          }, animate ? 500 : 100);
        }, animate ? 100 : 0);
      }
    }
    
    createPagination() {
      if (!this.pagination) return;
      
      this.pagination.innerHTML = '';
      
      for (let i = 0; i < this.slidesCount; i++) {
        const bullet = document.createElement('span');
        bullet.className = 'slider-bullet';
        bullet.setAttribute('data-slide', i);
        bullet.addEventListener('click', () => this.goToSlide(i));
        this.pagination.appendChild(bullet);
      }
      
      this.updatePagination();
    }
    
    updatePagination() {
      if (!this.pagination) return;
      
      const bullets = this.pagination.querySelectorAll('.slider-bullet');
      bullets.forEach((bullet, index) => {
        bullet.classList.toggle('active', index === this.currentSlide);
      });
    }
    
    bindEvents() {
      this.slidesWrapper.addEventListener('touchstart', this.handleTouchStart.bind(this), { passive: true });
      this.slidesWrapper.addEventListener('touchmove', this.handleTouchMove.bind(this), { passive: false });
      this.slidesWrapper.addEventListener('touchend', this.handleTouchEnd.bind(this), { passive: true });
      
      this.slidesWrapper.addEventListener('mousedown', this.handleMouseDown.bind(this));
      this.slidesWrapper.addEventListener('mousemove', this.handleMouseMove.bind(this));
      this.slidesWrapper.addEventListener('mouseup', this.handleMouseUp.bind(this));
      this.slidesWrapper.addEventListener('mouseleave', this.handleMouseUp.bind(this));
      
      this.container.addEventListener('keydown', this.handleKeyDown.bind(this));
      
      window.addEventListener('resize', this.handleResize.bind(this));
    }
    
    handleResize() {
      clearTimeout(this.resizeTimeout);
      this.resizeTimeout = setTimeout(() => {
        this.updateWrapperHeight(false);
      }, 150);
    }
    
    handleTouchStart(e) {
      if (e.target.closest('add-to-cart, button, .mini-cart__upsell-add-button')) {
        return;
      }
      this.startX = e.touches[0].clientX;
      this.isDragging = true;
      this.slidesWrapper.style.cursor = 'grabbing';
    }
    
    handleTouchMove(e) {
      if (!this.isDragging) return;
      
      e.preventDefault();
      this.currentX = e.touches[0].clientX;
      const diffX = this.currentX - this.startX;
      
      this.updateSlidesPosition(diffX);
    }
    
    handleTouchEnd(e) {
      if (!this.isDragging) return;
      
      this.isDragging = false;
      this.slidesWrapper.style.cursor = 'grab';
      
      const diffX = this.currentX - this.startX;
      
      setTimeout(() => {
        if (Math.abs(diffX) > this.threshold) {
          if (diffX > 0) {
            this.prevSlide();
          } else {
            this.nextSlide();
          }
        } else {
          this.goToSlide(this.currentSlide);
        }
      }, 10);
    }
    
    handleMouseDown(e) {
      if (e.target.closest('add-to-cart, button, .mini-cart__upsell-add-button')) {
        return;
      }
      e.preventDefault();
      this.startX = e.clientX;
      this.isDragging = true;
      this.slidesWrapper.style.cursor = 'grabbing';
    }
    
    handleMouseMove(e) {
      if (!this.isDragging) return;
      
      e.preventDefault();
      this.currentX = e.clientX;
      const diffX = this.currentX - this.startX;
      
      this.updateSlidesPosition(diffX);
    }
    
    handleMouseUp(e) {
      if (!this.isDragging) return;
      
      this.isDragging = false;
      this.slidesWrapper.style.cursor = 'grab';
      
      const diffX = this.currentX - this.startX;
      
      setTimeout(() => {
        if (Math.abs(diffX) > this.threshold) {
          if (diffX > 0) {
            this.prevSlide();
          } else {
            this.nextSlide();
          }
        } else {
          this.goToSlide(this.currentSlide);
        }
      }, 10);
    }
    
    handleKeyDown(e) {
      if (e.key === 'ArrowLeft') {
        e.preventDefault();
        this.prevSlide();
      } else if (e.key === 'ArrowRight') {
        e.preventDefault();
        this.nextSlide();
      }
    }
    
    updateSlidesPosition(offset) {
      this.slides.forEach((slide, index) => {
        const baseTransform = (index - this.currentSlide) * 100;
        const dragTransform = (offset / this.slidesWrapper.offsetWidth) * 100;
        slide.style.transition = 'none';
        slide.style.transform = `translateX(${baseTransform + dragTransform}%)`;
      });
    }
    
    goToSlide(index, animate = true) {
      if (this.isAnimating || this.isResizing) return;
      if (index < 0 || index >= this.slidesCount) return;
      
      this.isAnimating = true;
      this.currentSlide = index;
      
      this.slides.forEach((slide, i) => {
        slide.style.transition = animate ? 'transform 0.5s cubic-bezier(0.23, 1, 0.32, 1)' : 'none';
        slide.style.transform = `translateX(${(i - this.currentSlide) * 100}%)`;
      });
      
      this.updatePagination();
      
      setTimeout(() => {
        this.updateWrapperHeight(animate);
      }, animate ? 150 : 0);
      
      setTimeout(() => {
        this.isAnimating = false;
        this.isDragging = false;
      }, animate ? 500 : 50);
    }
    
    nextSlide() {
      const nextIndex = this.currentSlide + 1;
      if (nextIndex < this.slidesCount) {
        this.goToSlide(nextIndex);
      }
    }
    
    prevSlide() {
      const prevIndex = this.currentSlide - 1;
      if (prevIndex >= 0) {
        this.goToSlide(prevIndex);
      }
    }
    
    destroy() {
      clearTimeout(this.resizeTimeout);
      
      this.slidesWrapper.removeEventListener('touchstart', this.handleTouchStart);
      this.slidesWrapper.removeEventListener('touchmove', this.handleTouchMove);
      this.slidesWrapper.removeEventListener('touchend', this.handleTouchEnd);
      this.slidesWrapper.removeEventListener('mousedown', this.handleMouseDown);
      this.slidesWrapper.removeEventListener('mousemove', this.handleMouseMove);
      this.slidesWrapper.removeEventListener('mouseup', this.handleMouseUp);
      this.slidesWrapper.removeEventListener('mouseleave', this.handleMouseUp);
      this.container.removeEventListener('keydown', this.handleKeyDown);
      window.removeEventListener('resize', this.handleResize);
    }
  }
  
  function initCustomSlider() {
    const sliderContainer = document.querySelector('.custom-upsell-slider');
    if (!sliderContainer) return;
    
    const slides = sliderContainer.querySelectorAll('.slider-slide');
    if (slides.length === 0) return;
    
    if (sliderInstance) {
      sliderInstance.destroy();
      sliderInstance = null;
    }
    
    sliderInstance = new UpsellSlider(sliderContainer);
  }
  
  function initAfterAjax() {
    setTimeout(() => {
      const slider = document.querySelector('.custom-upsell-slider');
      if (slider) {
        initCustomSlider();
      }
    }, 100);
  }
  
  window.initCustomSlider = initCustomSlider;
  window.initAfterAjax = initAfterAjax;
  
  document.addEventListener('DOMContentLoaded', function() {
    setTimeout(initCustomSlider, 200);
  });
  
  document.addEventListener('cart:updated', function() {
    initAfterAjax();
  });
  
  document.addEventListener('cart:open', function() {
    initAfterAjax();
  });
  
  const observer = new MutationObserver(function(mutations) {
    let shouldInit = false;
    
    mutations.forEach(function(mutation) {
      if (mutation.type === 'childList') {
        mutation.addedNodes.forEach(function(node) {
          if (node.nodeType === 1) {
            if (node.classList && node.classList.contains('custom-upsell-slider')) {
              shouldInit = true;
            } else if (node.querySelector && node.querySelector('.custom-upsell-slider')) {
              shouldInit = true;
            }
          }
        });
      }
    });
    
    if (shouldInit) {
      initAfterAjax();
    }
  });
  
  observer.observe(document.body, { 
    childList: true, 
    subtree: true 
  });
  
})();