// Drag-and-drop utilities extracted from images.js to reduce size without changing behavior

export function createEnableImageDragAndDrop({ showImageLoadingSpinner, hideImageLoadingSpinner, imageAlternatives, currentImageIndex }) {
  return function enableImageDragAndDrop(updatePreviewCallback) {
    // Remove existing listeners first
    document.querySelectorAll('.image-drop-zone').forEach(zone => {
      // Clone node to remove all event listeners
      const newZone = zone.cloneNode(true);
      zone.parentNode.replaceChild(newZone, zone);
    });

    // Add enhanced drag and drop listeners
    document.querySelectorAll('.image-drop-zone').forEach(zone => {
      // Make the zone more visually obvious as a drop target
      zone.style.border = '2px dashed transparent';
      zone.style.transition = 'all 0.3s ease';
      zone.title = 'Drag and drop an image here to replace this picture';

      // Prevent default drag behaviors on the zone
      zone.addEventListener('dragenter', e => {
        e.preventDefault();
        e.stopPropagation();
      });

      zone.addEventListener('dragover', e => {
        e.preventDefault();
        e.stopPropagation();
        zone.classList.add('dragover');
        zone.style.border = '2px dashed #4299e1';
        zone.style.backgroundColor = '#e6f0fa';
        zone.style.borderRadius = '8px';
      });

      zone.addEventListener('dragleave', e => {
        e.preventDefault();
        e.stopPropagation();
        // Only remove styles if we're actually leaving the zone (not entering child elements)
        if (!zone.contains(e.relatedTarget)) {
          zone.classList.remove('dragover');
          zone.style.border = '2px dashed transparent';
          zone.style.backgroundColor = '';
          zone.style.borderRadius = '';
        }
      });

      zone.addEventListener('drop', async e => {
        e.preventDefault();
        e.stopPropagation();
        zone.classList.remove('dragover');
        zone.style.border = '2px dashed transparent';
        zone.style.backgroundColor = '';
        zone.style.borderRadius = '';

        const files = Array.from(e.dataTransfer.files);
        if (files.length === 0) return;

        const file = files[0];
        if (!file.type.startsWith('image/')) {
          alert('Please drop an image file (JPG, PNG, GIF, etc.)');
          return;
        }

        // Check file size (limit to 5MB)
        if (file.size > 5 * 1024 * 1024) {
          alert('Image file is too large. Please use an image smaller than 5MB.');
          return;
        }

        const word = zone.getAttribute('data-word');
        const index = parseInt(zone.getAttribute('data-index'));

        if (!word || isNaN(index)) {
          console.error('Invalid word or index for image drop');
          return;
        }

        // Show loading indicator
        showImageLoadingSpinner(word, index);

        const reader = new FileReader();
        reader.onload = async function (ev) {
          try {
            const wordKey = `${word.toLowerCase()}_${index}`;
            const imageDataUrl = ev.target.result;

            // Validate the image data
            if (!imageDataUrl || !imageDataUrl.startsWith('data:image/')) {
              throw new Error('Invalid image data');
            }

            // Initialize alternatives array if it doesn't exist
            if (!imageAlternatives[wordKey]) {
              imageAlternatives[wordKey] = [];
            }

            // Insert the new image at the front of alternatives
            imageAlternatives[wordKey].unshift(imageDataUrl);
            currentImageIndex[wordKey] = 0;

            // Update only this specific image instead of full preview refresh
            const currentImg = zone.querySelector('img');
            if (currentImg) {
              // Store current size before updating
              const currentWidth = currentImg.style.width;
              const currentHeight = currentImg.style.height;

              // Update the image source
              currentImg.src = imageDataUrl;

              // Preserve the current size
              if (currentWidth && currentHeight) {
                currentImg.style.width = currentWidth;
                currentImg.style.height = currentHeight;
              }

              console.log(`Updated image for ${word}_${index} without full refresh`);
            } else {
              // If no img element found, update the zone's innerHTML
              const sizeStyle = `width:${window.currentSettings?.imageSize || 50}px;height:${window.currentSettings?.imageSize || 50}px;`;
              zone.innerHTML = `<img src="${imageDataUrl}" style="${sizeStyle}object-fit:cover;border-radius:8px;border:2px solid #ddd;cursor:pointer;" alt="Image ${index + 1}" data-word="${word}" data-index="${index}">`;
              console.log(`Created new image element for ${word}_${index}`);
            }

            // Show success feedback with animation
            zone.classList.add('drag-success');
            zone.style.border = '2px solid #48bb78';
            zone.style.backgroundColor = '#e6fffa';

            // Show success message temporarily
            const successMsg = document.createElement('div');
            successMsg.innerHTML = '✅ Image replaced successfully!';
            successMsg.style.cssText = `
                        position: absolute;
                        top: -35px;
                        left: 50%;
                        transform: translateX(-50%);
                        background: #48bb78;
                        color: white;
                        padding: 4px 8px;
                        border-radius: 4px;
                        font-size: 11px;
                        white-space: nowrap;
                        z-index: 20;
                        animation: fadeInOut 2s ease-in-out;
                    `;
            zone.appendChild(successMsg);

            setTimeout(() => {
              zone.classList.remove('drag-success');
              zone.style.border = '2px dashed transparent';
              zone.style.backgroundColor = '';
              if (successMsg.parentNode) {
                successMsg.parentNode.removeChild(successMsg);
              }
            }, 2000);

          } catch (error) {
            console.error('Error processing dropped image:', error);
            alert('Error processing the dropped image. Please try again.');
          } finally {
            // Hide loading indicator
            hideImageLoadingSpinner(word, index);
          }
        };

        reader.onerror = function () {
          console.error('Error reading dropped file');
          alert('Error reading the dropped file. Please try again.');
          hideImageLoadingSpinner(word, index);
        };

        reader.readAsDataURL(file);
      });

      // Add hover effects for better UX
      zone.addEventListener('mouseenter', e => {
        if (!zone.classList.contains('dragover')) {
          zone.style.border = '2px dashed #cbd5e0';
          zone.style.backgroundColor = '#f7fafc';
        }
      });

      zone.addEventListener('mouseleave', e => {
        if (!zone.classList.contains('dragover')) {
          zone.style.border = '2px dashed transparent';
          zone.style.backgroundColor = '';
        }
      });
    });
  };
}

export default { createEnableImageDragAndDrop };
