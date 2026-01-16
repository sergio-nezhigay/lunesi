# AGENTS.md

## 1. Project Context
* **Platform:** Shopify Online Store 2.0 (Liquid).
* **Architecture:** JSON templates, Sections, and Snippets.


## 2. Agent Behavior Rules (The "Safety" Protocol)
* **🚫 NO LIVE DEPLOYMENTS:** NEVER run `shopify theme push` or `npm run push` without explicit, written confirmation from the user.
* **Local First:** All changes could be verified via the local development server (`npm run dev`).
* **Asset Management:** When adding CSS/JS, prefer using the `assets` folder and `asset_url` filters over inline code.
* **Schema Safety:** When modifying `schema` JSON in sections, always validate syntax to prevent JSON errors that break the editor.

## 3. Critical Commands
* **Start Local Dev:** `npm run dev` (Use this for all previews).
* **Lint / Validate:** `shopify theme check` (Run this before marking a task complete).
* **Pull Changes:** `shopify theme pull` (To sync remote changes to local).
* **FORBIDDEN:** `shopify theme push` (Do not use).

## 4. Coding Standards (Liquid)
* **Variables:** Use `{% assign %}` for logic and `{% capture %}` for complex strings.
* **Loops:** specific `for` loops should use `limit:` if iterating over large collections to preserve performance.
* **Images:** Always use the `image_tag` filter with `width` attributes for performance, rather than raw `<img>` tags.
* **Ids:** Ensure section IDs are dynamic (e.g., `id="{{ section.id }}"`) so the section can be used multiple times on a page.

## 5. Known "Gotchas"
* *App Blocks:* Remember that app blocks can be reordered by the merchant; do not hardcode positions relative to apps.
* *Liquid Cache:* If changing a snippet, it might update instantly locally but require a refresh.
* *JSON Templates:* Do not use trailing commas in `.json` template files.
