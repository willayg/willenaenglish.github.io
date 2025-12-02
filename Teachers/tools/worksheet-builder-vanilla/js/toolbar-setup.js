// toolbar-setup.js
// Handles alignment icon dropdowns and toolbar logic

// Alignment icon dropdown logic
function setupIconDropdown(btnId, menuId, iconId, optionClass, icons) {
  const btn = document.getElementById(btnId);
  const menu = document.getElementById(menuId);
  const icon = document.getElementById(iconId);
  const options = document.querySelectorAll('.' + optionClass);
  
  if (!btn || !menu || !icon || !options.length) return;
  
  // Toggle dropdown
  btn.addEventListener('click', function(e) {
    e.stopPropagation();
    menu.style.display = menu.style.display === 'block' ? 'none' : 'block';
  });
  
  // Handle option selection
  options.forEach(option => {
    option.addEventListener('click', function(e) {
      e.stopPropagation();
      const value = this.getAttribute('data-value');
      
      // Update icon
      if (icons[value]) {
        icon.innerHTML = icons[value];
      }
      
      // Call alignment function
      if (btnId.includes('halign')) {
        if (window.setAlign) window.setAlign('h', value);
      } else if (btnId.includes('valign')) {
        if (window.setAlign) window.setAlign('v', value);
      }
      
      // Close dropdown
      menu.style.display = 'none';
    });
  });
  
  // Close dropdown when clicking outside
  document.addEventListener('click', function(e) {
    if (!btn.contains(e.target) && !menu.contains(e.target)) {
      menu.style.display = 'none';
    }
  });
}

// Define icons for alignment options
const halignIcons = {
  left: '<svg width="22" height="22" viewBox="0 0 22 22"><rect x="3" y="5" width="16" height="2.5" rx="1.2" fill="#4a5568"/><rect x="3" y="9.5" width="10" height="2.5" rx="1.2" fill="#4a5568"/><rect x="3" y="14" width="13" height="2.5" rx="1.2" fill="#4a5568"/></svg>',
  center: '<svg width="22" height="22" viewBox="0 0 22 22"><rect x="3" y="5" width="16" height="2.5" rx="1.2" fill="#4a5568"/><rect x="6" y="9.5" width="10" height="2.5" rx="1.2" fill="#4a5568"/><rect x="5" y="14" width="13" height="2.5" rx="1.2" fill="#4a5568"/></svg>',
  right: '<svg width="22" height="22" viewBox="0 0 22 22"><rect x="3" y="5" width="16" height="2.5" rx="1.2" fill="#4a5568"/><rect x="9" y="9.5" width="10" height="2.5" rx="1.2" fill="#4a5568"/><rect x="6" y="14" width="13" height="2.5" rx="1.2" fill="#4a5568"/></svg>',
  justify: '<svg width="22" height="22" viewBox="0 0 22 22"><rect x="3" y="5" width="16" height="2.5" rx="1.2" fill="#4a5568"/><rect x="3" y="9.5" width="16" height="2.5" rx="1.2" fill="#4a5568"/><rect x="3" y="14" width="16" height="2.5" rx="1.2" fill="#4a5568"/></svg>'
};

const valignIcons = {
  top: '<svg width="22" height="22" viewBox="0 0 22 22">'+
    '<rect x="4" y="5" width="14" height="2.5" rx="1.2" fill="#4a5568"/>'+
    '<rect x="4" y="9.5" width="14" height="2.5" rx="1.2" fill="#bbb"/>'+
    '<rect x="4" y="14" width="14" height="2.5" rx="1.2" fill="#bbb"/>'+
  '</svg>',
  middle: '<svg width="22" height="22" viewBox="0 0 22 22">'+
    '<rect x="4" y="5" width="14" height="2.5" rx="1.2" fill="#bbb"/>'+
    '<rect x="4" y="9.5" width="14" height="2.5" rx="1.2" fill="#4a5568"/>'+
    '<rect x="4" y="14" width="14" height="2.5" rx="1.2" fill="#bbb"/>'+
  '</svg>',
  bottom: '<svg width="22" height="22" viewBox="0 0 22 22">'+
    '<rect x="4" y="5" width="14" height="2.5" rx="1.2" fill="#bbb"/>'+
    '<rect x="4" y="9.5" width="14" height="2.5" rx="1.2" fill="#bbb"/>'+
    '<rect x="4" y="14" width="14" height="2.5" rx="1.2" fill="#4a5568"/>'+
  '</svg>'
};

setupIconDropdown('pt-halign-btn', 'pt-halign-menu', 'pt-halign-icon', 'halign-option', halignIcons);
setupIconDropdown('pt-valign-btn', 'pt-valign-menu', 'pt-valign-icon', 'valign-option', valignIcons);

// Also ensure orientation icon is updated after a delay when everything is loaded
document.addEventListener('DOMContentLoaded', function() {
  setTimeout(() => {
    if (window.updateOrientationIcon) {
      window.updateOrientationIcon();
    }
  }, 200);
});
