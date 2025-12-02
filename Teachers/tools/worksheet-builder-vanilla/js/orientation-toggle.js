// orientation-toggle.js
// Handles page orientation toggle button, icon, and logic

document.addEventListener('DOMContentLoaded', function() {
  // Wait a bit more to ensure all modules are loaded
  setTimeout(() => {
    console.log('Setting up orientation toggle after all scripts loaded...');
    const orientationBtn = document.getElementById('pt-orientation-btn');
    const orientationIcon = document.getElementById('pt-orientation-icon');
    
    console.log('Found elements:', {
      orientationBtn: !!orientationBtn,
      orientationIcon: !!orientationIcon,
      worksheetState: !!window.worksheetState
    });
    
    if (!orientationBtn || !orientationIcon) {
      console.log('Orientation elements not found, exiting setup');
      return;
    }
    
    // Define icons for portrait and landscape
    const portraitIcon = `
      <svg width="20" height="20" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg">
        <rect x="5" y="2" width="10" height="16" rx="1.5" stroke="#4a5568" stroke-width="2" fill="none"/>
        <circle cx="10" cy="15" r="1" fill="#4a5568"/>
      </svg>
    `;
    
    const landscapeIcon = `
      <svg width="20" height="20" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg">
        <rect x="2" y="5" width="16" height="10" rx="1.5" stroke="#4a5568" stroke-width="2" fill="none"/>
        <circle cx="15" cy="10" r="1" fill="#4a5568"/>
      </svg>
    `;
    
    // Function to update icon based on current orientation
    function updateOrientationIcon() {
      if (window.worksheetState && window.worksheetState.getOrientation) {
        const currentOrientation = window.worksheetState.getOrientation();
        orientationIcon.innerHTML = currentOrientation === 'landscape' ? landscapeIcon : portraitIcon;
        orientationBtn.title = `Switch to ${currentOrientation === 'landscape' ? 'Portrait' : 'Landscape'}`;
        console.log('Updated orientation icon for:', currentOrientation);
      } else {
        console.log('worksheetState not available yet');
      }
    }
    
    // Initialize icon
    updateOrientationIcon();
    
    // Handle orientation toggle click
    orientationBtn.addEventListener('click', function(e) {
      console.log('Orientation button clicked!');
      e.stopPropagation();
      
      if (window.worksheetState && window.worksheetState.getOrientation && window.worksheetState.setOrientation) {
        const currentOrientation = window.worksheetState.getOrientation();
        console.log('Current orientation:', currentOrientation);
        const newOrientation = currentOrientation === 'landscape' ? 'portrait' : 'landscape';
        console.log('Setting new orientation:', newOrientation);
        
        // Save to history for orientation changes
        if (window.saveToHistory) window.saveToHistory('toggle page orientation');
        
        // Set new orientation
        window.worksheetState.setOrientation(newOrientation);
        
        // Update icon
        updateOrientationIcon();
        
        // Re-render pages to reflect orientation change
        if (window.renderPages) window.renderPages();
        
        // Trigger zoom recalculation if in fit mode
        setTimeout(() => {
          console.log('Checking zoom state after orientation change...');
          if (window.recalculatePageZoom) {
            const pages = document.querySelectorAll('.page-preview-a4');
            if (pages.length && pages[0].getAttribute('data-zoom-scale') !== '1') {
              console.log('Fit mode active, recalculating zoom...');
              window.recalculatePageZoom();
            }
          }
        }, 300); // Wait for pages to fully render
      } else {
        console.log('worksheetState not available:', {
          worksheetState: !!window.worksheetState,
          getOrientation: !!(window.worksheetState && window.worksheetState.getOrientation),
          setOrientation: !!(window.worksheetState && window.worksheetState.setOrientation)
        });
      }
    });
    
    // Make updateOrientationIcon globally available
    window.updateOrientationIcon = updateOrientationIcon;
    
    console.log('Orientation toggle setup complete!');
  }, 500); // Wait 500ms for all scripts to load
});
