import { ensureAuthRefresh } from '../auth-refresh.js';

// Burger menu component loader
// Usage: import this file and call insertBurgerMenu() after DOMContentLoaded

ensureAuthRefresh();

export function insertBurgerMenu(targetSelector = 'body') {
  // Prevent duplicate insertion
  if (document.getElementById('burger-menu-template-inserted')) return;

  const template = document.getElementById('burger-menu-template');
  if (!template) return;
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
