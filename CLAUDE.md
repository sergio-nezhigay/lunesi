# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

This is a Shopify theme called "Be Yours by roartheme" for the Lunesi e-commerce store. It's a custom Shopify theme built with Liquid templates, vanilla JavaScript (using Web Components), and CSS.

## Development Commands

### Shopify CLI Commands
- `npm run dev` - Start local development server (connects to spain-test-store-shampoo.myshopify.com, theme ID 154367197315)


## Architecture

### Directory Structure
- `assets/` - JavaScript, CSS, images, and other static assets
- `sections/` - Shopify sections (reusable page components)
- `snippets/` - Liquid snippets (reusable template fragments)
- `templates/` - JSON template files that define page layouts using sections
- `layout/` - Theme layout files (theme.liquid is the main wrapper)
- `config/` - Theme configuration (settings_schema.json, settings_data.json, markets.json)
- `locales/` - Translation files for internationalization

### Key Technical Patterns

#### Web Components
The theme uses vanilla JavaScript Web Components extensively (classes that extend HTMLElement). Key components include:
- Product forms and variants
- Cart functionality (cart drawer, cart items)
- Media galleries
- Modals and popups
- Search functionality
- Faceted filtering

#### Pub/Sub System
The theme uses a custom publish/subscribe pattern defined in `assets/pubsub.js`:
- Events: `cart-update`, `quantity-update`, `variant-change`, `cart-error`
- Used for coordinating updates across components without tight coupling

#### JavaScript Organization
- `assets/global.js` - Core utilities including currency formatting, initialization helpers
- `assets/vendor-v4.js` - Third-party dependencies
- Component-specific JS files follow the pattern of defining Web Components that manage their own state

### Key Features

#### Waitlist Mode
A global feature that replaces all purchase buttons with waitlist signup:
- Controlled by `settings.waitlist_mode` in settings_schema.json
- Modal popup defined in `snippets/preorder.liquid`
- Conditionally renders waitlist buttons instead of add-to-cart buttons throughout the theme

#### Free Shipping Bar
Item-based free shipping progress indicator:
- Configurable in settings_schema.json (threshold, text, colors)
- Implemented in `snippets/free-shipping.liquid`
- Shows progress toward free shipping based on item count (not cart total)

#### Color Swatches
Dynamic product variant color swatches:
- Enabled via `settings.color_swatches_enabled`
- Implemented in `assets/color-swatches.js`

#### Quick View
Product quick view modals:
- Enabled via `settings.quick_view_enabled`
- Uses `sections/main-product-modal.liquid` and `templates/product.modal.json`

### Section Groups
The theme uses section groups (Shopify 2.0 feature):
- `sections/header-group.json` - Header components
- `sections/footer-group.json` - Footer components
- `sections/overlay-group.json` - Overlay elements

### Template System
Templates are JSON files that compose sections together:
- Multiple page template variants exist (e.g., page.about.json, page.contact.json, page.quiz.json)
- Product template variants: product.json, product.modal.json, product.pre-order.json, product.gift-card.json

## Important Conventions

### Liquid Development
- Use Liquid comments: `{% comment %}...{% endcomment %}`
- Settings are accessed via `settings.setting_name`
- Theme uses RTL support - check `text_direction` variable in theme.liquid
- Image optimization uses Shopify's image_url filter with width/height parameters

### JavaScript
- Always use console logs (not logger) per user configuration
- Custom elements are defined using `customElements.define()`
- Event delegation is used extensively
- Theme initialization happens when 'page:loaded' event fires

### CSS
- Base styles in `assets/base.css`
- Component styles follow naming pattern: `component-*.css`
- Section styles follow naming pattern: `section-*.css`
- CSS custom properties (CSS variables) are defined in `snippets/css-variables.liquid`

### Theme Configuration
- Settings are defined in `config/settings_schema.json`
- Current settings values are in `config/settings_data.json` (auto-generated, be careful editing)
- JavaScript variables are injected via `snippets/js-variables.liquid`

## Common Tasks

### Adding a New Section
1. Create the section file in `sections/`
2. Define the schema at the bottom of the file with `{% schema %}...{% endschema %}`
3. Add any required CSS to `assets/` and reference it at the top of the section
4. Add any required JS to `assets/` if creating new Web Components

### Modifying Product Display
- Main product section: `sections/main-product.liquid`
- Buy buttons logic: `snippets/buy-buttons.liquid`
- Variant picker: `snippets/product-variant-picker.liquid`
- Product cards: `snippets/card-product.liquid`

### Cart Modifications
- Cart drawer: `sections/mini-cart.liquid` and `assets/cart-drawer.js`
- Cart page items: `sections/main-cart-items.liquid` and `assets/cart.js`
- Cart recommendations: `sections/cart-recommendations.liquid`

### Theme Settings
- Global settings are defined in `config/settings_schema.json`
- Access settings in Liquid: `{{ settings.setting_id }}`
- Access settings in JS: Check `snippets/js-variables.liquid` for how settings are exposed to JavaScript
