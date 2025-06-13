// ... other imports and code above ...

window.addEventListener('DOMContentLoaded', function() {
  // ... other variable assignments ...

  bgMusic = document.getElementById('bgMusic');
  musicToggle = document.getElementById('musicToggle');
  musicMuted = true;

  // Make sure music is muted by default
  if (bgMusic) {
    bgMusic.muted = true;
    bgMusic.pause();
  }
  if (musicToggle) {
    musicToggle.textContent = '🔇 Music';
    musicToggle.checked = false;
  }

  // Music toggle button functionality
  if (musicToggle) {
    musicToggle.onclick = function() {
      musicMuted = !musicMuted;
      if (bgMusic) {
        bgMusic.muted = musicMuted;
        if (!musicMuted) {
          bgMusic.play().catch(() => {});
        } else {
          bgMusic.pause();
        }
      }
      musicToggle.textContent = musicMuted ? '🔇 Music' : '🎵 Music';
    };
  }

  // ... rest of your DOMContentLoaded code ...
});
