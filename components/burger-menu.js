// Burger menu component loader
// Usage: import this file and call insertBurgerMenu() after DOMContentLoaded

export function insertBurgerMenu(targetSelector = 'body') {
  // Prevent duplicate insertion
  if (document.getElementById('burger-menu-template-inserted')) return;

  let template = document.getElementById('burger-menu-template');
  
  // Fallback: if template doesn't exist (fetch failed or SPA routing issue), inject it
  if (!template) {
    const fallback = document.createElement('template');
    fallback.id = 'burger-menu-template';
    fallback.innerHTML = `
      <style>
        .burger-menu { position: fixed; top: 10px; right: 10px; z-index: 9999; }
        .burger-btn { background: #4CAF50; color: white; border: none; padding: 10px 15px; border-radius: 5px; cursor: pointer; font-size: 16px; }
        .burger-btn:hover { background: #45a049; }
        .burger-dropdown { display: none; position: absolute; top: 50px; right: 0; background: white; box-shadow: 0 4px 8px rgba(0,0,0,0.2); border-radius: 5px; min-width: 200px; }
        .burger-dropdown a { display: block; padding: 12px 16px; text-decoration: none; color: #333; border-bottom: 1px solid #eee; }
        .burger-dropdown a:hover { background: #f1f1f1; }
        .burger-dropdown a:last-child { border-bottom: none; }
      </style>
      <div class="burger-menu">
        <button class="burger-btn">☰ Menu</button>
        <div class="burger-dropdown">
          <a href="/Teachers/tools/manage_students.html">Manage Students</a>
          <a href="/Teachers/tools/student_tracker/student_tracker.html">Student Tracker</a>
          <a href="/Teachers/tools/wordlists.html">Wordlists</a>
          <a href="/Teachers/tools/homework.html">Homework</a>
          <a href="/Teachers/tools/leaderboard.html">Leaderboard</a>
          <a href="#" id="feedbackMenuBtn">Feedback</a>
          <a href="/Teachers/login.html">Logout</a>
        </div>
      </div>
    `;
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
}

// If not using modules, you can expose insertBurgerMenu globally:
if (typeof window !== 'undefined') {
  window.insertBurgerMenu = insertBurgerMenu;
}
