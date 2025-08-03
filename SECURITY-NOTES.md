# Security and Code Hygiene Notes

## 1. Sanitizing User-Generated Content
- Whenever displaying user-generated or external content as HTML (using `innerHTML`), always sanitize to prevent XSS attacks.
- **Best practice:** Use [DOMPurify](https://github.com/cure53/DOMPurify) for sanitizing HTML content. Example usage:
  ```html
  <script src="https://cdn.jsdelivr.net/npm/dompurify@3.0.8/dist/purify.min.js"></script>
  ```
  ```js
  // Instead of: element.innerHTML = htmlString;
  element.innerHTML = DOMPurify.sanitize(htmlString);
  ```
- If you only need to show plain text, use `element.textContent = yourString;` instead of `innerHTML`.

## 2. Using External Scripts Securely
- Always pin your CDN scripts to a specific version (e.g., `@5.6.5`) to avoid unintentional updates or supply chain attacks.
- Example:
  ```html
  <!-- Good: -->
  <script src="https://cdn.jsdelivr.net/npm/@jaames/iro@5.6.5"></script>
  <!-- Bad: -->
  <script src="https://cdn.jsdelivr.net/npm/@jaames/iro"></script>
  ```
- For additional protection, use Subresource Integrity (SRI) if the CDN provides a hash, e.g.:
  ```html
  <script src="..." integrity="sha384-..." crossorigin="anonymous"></script>
  ```

## 3. When to Use innerHTML vs textContent
- Use `innerHTML` **only** when you need to render formatted HTML (bold, lists, images, etc.).
- Use `textContent` or `innerText` for plain, unformatted text (usernames, comments, answers, etc.).
- Always sanitize content if using `innerHTML` with user or external input.

## 4. General HTML/JS Hygiene
- Remove unused or duplicate scripts/stylesheets from your HTML.
- Prefer moving inline scripts into external JS files for maintainability.
- Ensure all interactive elements are keyboard accessible and have proper ARIA labeling.
- Regularly review and test print styles for worksheet outputs.

## 5. References
- DOMPurify: https://github.com/cure53/DOMPurify
- SRI Hash Generator: https://www.srihash.org/

---
_Last updated: 2025-08-03_