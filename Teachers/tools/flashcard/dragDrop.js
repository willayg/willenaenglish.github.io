// Enhanced drag and drop functionality for flashcards (similar to wordtest)
export function enableFlashcardDragAndDrop(updatePreviewCallback) {
    // Remove existing listeners first
    document.querySelectorAll('.image-drop-zone').forEach(zone => {
        // Clone node to remove all event listeners
        const newZone = zone.cloneNode(true);
        zone.parentNode.replaceChild(newZone, zone);
    });
    
    // Add enhanced drag and drop listeners
    document.querySelectorAll('.image-drop-zone').forEach(zone => {
        const word = zone.getAttribute('data-word');
        const index = parseInt(zone.getAttribute('data-index'));
        
        if (!word || isNaN(index)) return;
        
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
            
            // Show loading indicator
            showImageLoadingSpinner(zone);
            
            const reader = new FileReader();
            reader.onload = async function(ev) {
                try {
                    const imageDataUrl = ev.target.result;
                    
                    // Validate the image data
                    if (!imageDataUrl || !imageDataUrl.startsWith('data:image/')) {
                        throw new Error('Invalid image data');
                    }
                    
                    // Update the card with the new image
                    if (window.app && window.app.cardManager) {
                        window.app.cardManager.setCardImage(index, imageDataUrl, file);
                        await updatePreviewCallback();
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
                        pointer-events: none;
                    `;
                    zone.style.position = 'relative';
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
                    hideImageLoadingSpinner(zone);
                }
            };
            
            reader.onerror = function() {
                console.error('Error reading dropped file');
                alert('Error reading the dropped file. Please try again.');
                hideImageLoadingSpinner(zone);
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
}

// Show loading spinner on the image zone
function showImageLoadingSpinner(zone) {
    // Remove any existing spinner
    const existingSpinner = zone.querySelector('.zone-loading-spinner');
    if (existingSpinner) {
        existingSpinner.remove();
    }
    
    const spinner = document.createElement('div');
    spinner.className = 'zone-loading-spinner';
    spinner.innerHTML = `
        <div style="
            position: absolute;
            top: 0;
            left: 0;
            right: 0;
            bottom: 0;
            background: rgba(255, 255, 255, 0.9);
            display: flex;
            align-items: center;
            justify-content: center;
            border-radius: 8px;
            z-index: 10;
        ">
            <div style="
                width: 30px;
                height: 30px;
                border: 3px solid #e9ecef;
                border-top: 3px solid #007bff;
                border-radius: 50%;
                animation: spin 1s linear infinite;
            "></div>
        </div>
    `;
    
    zone.style.position = 'relative';
    zone.appendChild(spinner);
}

// Hide loading spinner from the image zone
function hideImageLoadingSpinner(zone) {
    const spinner = zone.querySelector('.zone-loading-spinner');
    if (spinner) {
        spinner.remove();
    }
}

// Add CSS animations
const style = document.createElement('style');
style.textContent = `
    @keyframes spin {
        0% { transform: rotate(0deg); }
        100% { transform: rotate(360deg); }
    }
    
    @keyframes fadeInOut {
        0% { opacity: 0; transform: translateX(-50%) translateY(-10px); }
        20% { opacity: 1; transform: translateX(-50%) translateY(0); }
        80% { opacity: 1; transform: translateX(-50%) translateY(0); }
        100% { opacity: 0; transform: translateX(-50%) translateY(-10px); }
    }
    
    .image-drop-zone.drag-success {
        border: 2px solid #48bb78 !important;
        background: #e6fffa !important;
        animation: success-pulse 1.5s ease-in-out;
    }
    
    @keyframes success-pulse {
        0%, 100% { transform: scale(1); }
        50% { transform: scale(1.05); }
    }
    
    .image-drop-zone {
        position: relative;
        border: 2px dashed transparent;
        transition: all 0.3s ease;
    }
    
    .drag-instructions {
        position: absolute;
        top: -25px;
        left: 50%;
        transform: translateX(-50%);
        background: rgba(0, 0, 0, 0.8);
        color: white;
        padding: 4px 8px;
        border-radius: 4px;
        font-size: 11px;
        white-space: nowrap;
        opacity: 0;
        transition: opacity 0.3s ease;
        pointer-events: none;
        z-index: 15;
    }
    
    .image-drop-zone:hover .drag-instructions {
        opacity: 1;
    }
`;

if (!document.getElementById('flashcard-drag-drop-styles')) {
    style.id = 'flashcard-drag-drop-styles';
    document.head.appendChild(style);
}
