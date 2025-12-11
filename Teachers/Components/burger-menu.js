import { ensureAuthRefresh } from '../auth-refresh.js';

// Burger menu component loader
// Usage: import this file and call insertBurgerMenu() after DOMContentLoaded

ensureAuthRefresh();

export function insertBurgerMenu(targetSelector = 'body') {
  // Prevent duplicate insertion
  if (document.getElementById('burger-menu-template-inserted')) return;

  let template = document.getElementById('burger-menu-template');

  // Fallback: if template doesn't exist OR has invalid content (e.g., SPA routing returned index.html)
  // Check if template content actually contains .burger-menu
  const isValidTemplate = template && template.content && template.content.querySelector('.burger-menu');
  
  if (!isValidTemplate) {
    // Remove any invalid template that might exist
    if (template) template.remove();
    
    const fallback = document.createElement('template');
    fallback.id = 'burger-menu-template';
    fallback.innerHTML = `
      <style>
        .burger-menu { position: relative; display: inline-block; }
        .burger-btn { font-size: 28px; background: none; border: none; cursor: pointer; color: #fff; }
        .burger-dropdown { display: none; position: absolute; right: 0; background: #eaebf0; min-width: 140px; box-shadow: 0 2px 8px rgba(0,0,0,0.15); z-index: 1000; border-radius: 6px; overflow: hidden; }
        .burger-dropdown a { display: block; padding: 12px 18px; color: #3d3752; text-decoration: none; transition: background 0.2s; }
        .burger-dropdown a:hover { background: #f0f0f0; }
      </style>
      <div class="burger-menu">
        <button class="burger-btn" aria-label="Menu">☰</button>
        <div class="burger-dropdown">
          <a href="/index.html">Home</a>
          <a href="/Teachers/index.html">Dashboard</a>
          <a href="/Teachers/profile.html">Profile</a>
          <a href="#" id="feedbackMenuBtn">Feedback</a>
          <a href="/Teachers/components/feedback-admin.html" id="adminMenuBtn">Admin</a>
          <a href="#" id="logoutMenuBtn">Logout</a>
        </div>
      </div>`;
    document.body.appendChild(fallback);
    template = fallback;
  }
  const node = template.content.cloneNode(true);
  const wrapper = document.createElement('div');
  wrapper.id = 'burger-menu-template-inserted';
  wrapper.appendChild(node);

  // Insert at the top of the target element
  const target = document.querySelector(targetSelector);
  if (target) target.insertBefore(wrapper, target.firstChild);

  // Dropdown logic
  const burgerBtn = wrapper.querySelector('.burger-btn');
  const dropdown = wrapper.querySelector('.burger-dropdown');
  burgerBtn.onclick = () => {
    dropdown.style.display = dropdown.style.display === 'block' ? 'none' : 'block';
  };
  document.addEventListener('click', (e) => {
    if (!wrapper.contains(e.target)) dropdown.style.display = 'none';
  });

  // Feedback modal logic (optional: trigger your feedback modal here)
  wrapper.querySelector('#feedbackMenuBtn').onclick = (e) => {
    e.preventDefault();
    if (window.showFeedbackModal) window.showFeedbackModal();
    else alert('Feedback modal not implemented!');
    dropdown.style.display = 'none';
  };

  // Admin button logic (optional: close dropdown on click)
  const adminBtn = wrapper.querySelector('#adminMenuBtn');
  if (adminBtn) {
    adminBtn.onclick = function() {
      dropdown.style.display = 'none';
      // Let the link work normally
    };
  }

  // Logout button logic
  const logoutBtn = wrapper.querySelector('#logoutMenuBtn');
  if (logoutBtn) {
    logoutBtn.onclick = function(e) {
      e.preventDefault();
      localStorage.removeItem('userId');
      localStorage.removeItem('userRole');
      const redirect = encodeURIComponent(location.pathname + location.search);
      window.location.href = `/Teachers/login.html?redirect=${redirect}`;
      dropdown.style.display = 'none';
    };
  }
}

// If not using modules, you can expose insertBurgerMenu globally:
if (typeof window !== 'undefined') {
  window.insertBurgerMenu = insertBurgerMenu;
}
