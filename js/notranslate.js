document.addEventListener("DOMContentLoaded", function() {
  // Set translate="no" on the body
  document.body.setAttribute("translate", "no");
  // Inject meta tag for Google notranslate if not present
  if (!document.querySelector('meta[name="google"][content="notranslate"]')) {
    const meta = document.createElement('meta');
    meta.setAttribute('name', 'google');
    meta.setAttribute('content', 'notranslate');
    document.head.appendChild(meta);
  }
});