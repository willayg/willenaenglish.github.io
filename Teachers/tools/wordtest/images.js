// Image handling functions for word worksheet generator

// Simple emoji map for fallback
const emojiMap = {
    apple: "🍎", dog: "🐶", cat: "🐱", book: "📚", car: "🚗", 
    house: "🏠", tree: "🌳", sun: "☀️", moon: "🌙", star: "⭐",
    water: "💧", fire: "🔥", flower: "🌸", fish: "🐠", bird: "🐦",
    food: "🍎", eat: "🍽️", drink: "🥤", sleep: "😴", run: "🏃",
    walk: "🚶", happy: "😊", sad: "😢", big: "🔍", small: "🔎"
};

// Image functions - these will be set from imported modules
let getPixabayImage = null;
let imageCache = {};

// Image cycling state
let imageAlternatives = {}; // Store multiple image options for each word
let currentImageIndex = {}; // Track current image index for each word

// Helper function to get placeholder image
function getPlaceholderImage(index, label = null, currentSettings = { imageSize: 50 }) {
    const displayLabel = label || `Image ${index + 1}`;
    return `<div style="width:${currentSettings.imageSize}px;height:${currentSettings.imageSize}px;background:#f5f5f5;display:flex;align-items:center;justify-content:center;border-radius:8px;border:2px solid #ddd;font-size:14px;color:#666;">
        ${displayLabel}
    </div>`;
}

// Helper function to get image URL with fallback
async function getImageUrl(word, index, refresh = false, currentSettings = { imageSize: 50 }) {
    if (!word) return getPlaceholderImage(index, null, currentSettings);
    
    const wordKey = `${word.toLowerCase()}_${index}`;
    
    // Initialize image alternatives if not exists
    if (!imageAlternatives[wordKey]) {
        imageAlternatives[wordKey] = [];
        currentImageIndex[wordKey] = 0;
    }
    
    // If we need to refresh or don't have alternatives yet, load them
    if (refresh || imageAlternatives[wordKey].length === 0) {
        await loadImageAlternatives(word, wordKey, null, currentSettings);
    }
    
    // Return current image
    const currentIndex = currentImageIndex[wordKey] || 0;
    return imageAlternatives[wordKey][currentIndex] || getPlaceholderImage(index, null, currentSettings);
}

// Load multiple image alternatives for a word (emoji first, 6 English, blank last)
async function loadImageAlternatives(word, wordKey, kor = null, currentSettings = { imageSize: 50 }) {
    const alternatives = [];
    // Only add emoji if available
    const emoji = emojiMap[word.toLowerCase()];
    if (emoji) {
        alternatives.push(`<div style="font-size: ${currentSettings.imageSize * 0.8}px; line-height: 1;">${emoji}</div>`);
    }
    // Only get the FIRST Pixabay image for the word
    if (getPixabayImage) {
        try {
            const imageUrl = await getPixabayImage(word, true);
            if (imageUrl && imageUrl.startsWith('http')) {
                alternatives.push(imageUrl);
            } else if (imageUrl && imageUrl.length === 1) {
                alternatives.push(`<div style="font-size: ${currentSettings.imageSize * 0.8}px; line-height: 1;">${imageUrl}</div>`);
            }
        } catch (error) {
            console.warn('Error getting image for:', word, error);
        }
    }
    // Add blank option last - just a white empty box
    alternatives.push('<div style="width:' + currentSettings.imageSize + 'px;height:' + currentSettings.imageSize + 'px;background:#fff;border-radius:8px;border:2px solid #ddd;"></div>');
    imageAlternatives[wordKey] = alternatives.slice(0, 2); // Only emoji (if any) and first image
}

// Cycle to next image for a specific word
function cycleImage(word, index, updatePreviewCallback) {
    const wordKey = `${word.toLowerCase()}_${index}`;
    
    if (imageAlternatives[wordKey] && imageAlternatives[wordKey].length > 0) {
        currentImageIndex[wordKey] = (currentImageIndex[wordKey] + 1) % imageAlternatives[wordKey].length;
        
        // Instead of full preview update, just update the specific image
        const targetZone = document.querySelector(`[data-word="${word}"][data-index="${index}"]`);
        if (targetZone) {
            const currentImg = targetZone.querySelector('img');
            if (currentImg) {
                // Store current size before updating
                const currentWidth = currentImg.style.width;
                const currentHeight = currentImg.style.height;
                
                // Update the image source
                const newImageUrl = imageAlternatives[wordKey][currentImageIndex[wordKey]];
                currentImg.src = newImageUrl;
                
                // Preserve the current size
                if (currentWidth && currentHeight) {
                    currentImg.style.width = currentWidth;
                    currentImg.style.height = currentHeight;
                }
                
                return; // Skip full preview update
            }
        }
        
        // Fallback to full update if targeted update fails
        updatePreviewCallback();
    }
}

// Helper function to render an image
function renderImage(imageUrl, index, word = null, kor = null, currentSettings = { imageSize: 50 }) {
    // Add double-click to open image search based on selected mode
    let dblClickHandler = '';
    if (word) {
        dblClickHandler = `ondblclick="
            const pictureModeSelect = document.getElementById('pictureModeSelect');
            const mode = pictureModeSelect ? pictureModeSelect.value : 'photos';
            const encodedWord = encodeURIComponent('${word}');
            let url = '';
            switch (mode) {
                case 'photos':
                    url = 'https://pixabay.com/images/search/' + encodedWord + '/';
                    break;
                case 'illustrations':
                    url = 'https://pixabay.com/illustrations/search/' + encodedWord + '/';
                    break;
                case 'ai':
                    url = 'https://lexica.art/?q=' + encodedWord;
                    break;
                default:
                    url = 'https://pixabay.com/images/search/' + encodedWord + '/';
            }
            // Calculate left-side position and size (80vh x 25vw)
            const screenW = window.screen.availWidth || window.innerWidth;
            const screenH = window.screen.availHeight || window.innerHeight;
            const width = Math.round(screenW * 0.25);
            const height = Math.round(screenH * 0.8);
            const left = 10;
            const top = Math.round((screenH - height) / 2);
            const windowFeatures = 'width=' + width + ',height=' + height + ',left=' + left + ',top=' + top + ',scrollbars=yes,resizable=yes';
            window.open(url, 'ImageSearchWindow', windowFeatures);
        "`;
    }
    
    if (imageUrl.startsWith('<div')) {
        // It's an emoji or placeholder div - update font size
        if (imageUrl.includes('font-size:')) {
            const updatedImageUrl = imageUrl.replace(/font-size:\s*\d+px/, `font-size: ${currentSettings.imageSize * 0.8}px`);
            return `<div class="image-drop-zone" data-word="${word}" data-index="${index}" style="position: relative; cursor: pointer;" ${dblClickHandler}>${updatedImageUrl}</div>`;
        }
        return `<div class="image-drop-zone" data-word="${word}" data-index="${index}" style="position: relative; cursor: pointer;" ${dblClickHandler}>${imageUrl}</div>`;
    }
    // It's a real image URL
    return `<div class="image-drop-zone" data-word="${word}" data-index="${index}" style="position: relative;">
        <img src="${imageUrl}" style="width:${currentSettings.imageSize}px;height:${currentSettings.imageSize}px;object-fit:cover;border-radius:8px;border:2px solid #ddd;cursor:pointer;" alt="Image ${index + 1}" ${dblClickHandler}>
    </div>`;
}

// Function to refresh only currently visible images (not all alternatives)
async function refreshImages(updatePreviewCallback) {
    console.log('Refreshing currently visible images...');
    const previewArea = document.getElementById('previewArea');
    if (previewArea) {
        previewArea.innerHTML = '<div class="preview-placeholder"><p>Loading new images...</p></div>';
    }
    
    // Instead of clearing everything, we'll only refresh the currently visible images
    // by adding new alternatives to the existing ones
    
    // Get the current word list from the preview to know which images to refresh
    const currentWords = window.currentWords || [];
    
    // For each word that has current alternatives, add more options
    for (let i = 0; i < currentWords.length; i++) {
        const word = currentWords[i]?.eng || currentWords[i]?._originalEng;
        if (word) {
            const wordKey = `${word.toLowerCase()}_${i}`;
            
            // Only refresh if this word already has alternatives (meaning it's been loaded)
            if (imageAlternatives[wordKey] && imageAlternatives[wordKey].length > 0) {
                // Add more image alternatives without clearing existing ones
                try {
                    await addMoreImageAlternatives(word, wordKey, null, window.currentSettings || { imageSize: 50 });
                } catch (error) {
                    console.warn('Error adding more alternatives for:', word, error);
                }
            }
        }
    }
    
    // Small delay to show loading message
    await new Promise(resolve => setTimeout(resolve, 100));
    
    // Update preview with refreshed images
    await updatePreviewCallback();
}

// Helper function to add more image alternatives without clearing existing ones
async function addMoreImageAlternatives(word, wordKey, kor = null, currentSettings = { imageSize: 50 }) {
    // Get 6 more English images with different search terms
    if (getPixabayImage) {
        try {
            const newSearchTerms = [
                `${word} photo`, 
                `${word} image`, 
                `${word} vector`,
                `${word} art`,
                `${word} picture`,
                `${word} graphic`
            ];
            
            const newAlternatives = [];
            for (let i = 0; i < newSearchTerms.length; i++) {
                try {
                    const imageUrl = await getPixabayImage(newSearchTerms[i], true);
                    if (imageUrl && imageUrl.startsWith('http')) {
                        newAlternatives.push(imageUrl);
                    } else if (imageUrl && imageUrl.length === 1) {
                        newAlternatives.push(`<div style="font-size: ${currentSettings.imageSize * 0.8}px; line-height: 1;">${imageUrl}</div>`);
                    }
                } catch (error) {
                    console.warn('Error getting new image for:', newSearchTerms[i], error);
                }
            }
            
            // Add the new alternatives to the existing ones (but avoid duplicates)
            const existingAlternatives = imageAlternatives[wordKey] || [];
            const uniqueNewAlternatives = newAlternatives.filter(alt => 
                !existingAlternatives.includes(alt)
            );
            
            // Insert new alternatives after the first few existing ones
            if (uniqueNewAlternatives.length > 0) {
                const insertIndex = Math.min(3, existingAlternatives.length);
                imageAlternatives[wordKey] = [
                    ...existingAlternatives.slice(0, insertIndex),
                    ...uniqueNewAlternatives,
                    ...existingAlternatives.slice(insertIndex)
                ];
                
                // Limit total alternatives to prevent memory issues
                if (imageAlternatives[wordKey].length > 15) {
                    imageAlternatives[wordKey] = imageAlternatives[wordKey].slice(0, 15);
                }
            }
        } catch (error) {
            console.warn('Error adding more alternatives for:', word, error);
        }
    }
}

// Helper to refresh images for a single word/index
async function refreshImageForWord(word, index, forceNewKey = false, kor = null, currentSettings, updatePreviewCallback) {
    const wordKey = `${word.toLowerCase()}_${index}`;
    
    // Show loading spinner
    showImageLoadingSpinner(word, index);
    
    if (forceNewKey) {
        // When refreshing images on right-click, preserve the emoji if it exists
        const existingEmoji = imageAlternatives[wordKey] && imageAlternatives[wordKey][0] && 
                              imageAlternatives[wordKey][0].includes('<div') && 
                              imageAlternatives[wordKey][0].includes('font-size') ? 
                              imageAlternatives[wordKey][0] : null;
        
        // Reset imageAlternatives and currentImageIndex for this slot
        imageAlternatives[wordKey] = [];
        currentImageIndex[wordKey] = 0;
        
        // If we had an emoji, preserve it
        if (existingEmoji) {
            imageAlternatives[wordKey].push(existingEmoji);
        }
    }

    try {
        // Fetch new images (6 English + emoji + blank)
        await loadImageAlternatives(word, wordKey, kor, currentSettings);
    } finally {
        // Hide loading spinner
        hideImageLoadingSpinner(word, index);
        updatePreviewCallback();
    }
}

// Helper functions to show/hide loading spinner
function showImageLoadingSpinner(word, index) {
    const wordKey = `${word.toLowerCase()}_${index}`;
    const previewArea = document.getElementById('previewArea');
    if (!previewArea) return;
    
    // Find all image containers for this word index
    const imageContainers = previewArea.querySelectorAll('.image-container');
    if (imageContainers[index]) {
        const imageContainer = imageContainers[index];
        // Make sure the container has relative positioning
        imageContainer.style.position = 'relative';
        
        // Remove existing spinner if any
        const existingSpinner = imageContainer.querySelector('.image-loading-overlay');
        if (existingSpinner) {
            existingSpinner.remove();
        }
        
        // Add spinner overlay
        const spinnerOverlay = document.createElement('div');
        spinnerOverlay.className = 'image-loading-overlay';
        spinnerOverlay.innerHTML = '<div class="image-loading-spinner"></div>';
        imageContainer.appendChild(spinnerOverlay);
    }
}

function hideImageLoadingSpinner(word, index) {
    const wordKey = `${word.toLowerCase()}_${index}`;
    const previewArea = document.getElementById('previewArea');
    if (!previewArea) return;
    
    // Find all image containers for this word index
    const imageContainers = previewArea.querySelectorAll('.image-container');
    if (imageContainers[index]) {
        const imageContainer = imageContainers[index];
        const existingSpinner = imageContainer.querySelector('.image-loading-overlay');
        if (existingSpinner) {
            existingSpinner.remove();
        }
    }
}

// Enhanced drag and drop functionality for images
function enableImageDragAndDrop(updatePreviewCallback) {
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
            reader.onload = async function(ev) {
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
            
            reader.onerror = function() {
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
}

// Initialize image module functions
function initializeImageModule(pixabayFn, cache) {
    getPixabayImage = pixabayFn;
    imageCache = cache;
}

// Function to completely clear all images (for when users want to start fresh)
async function clearAllImages(updatePreviewCallback) {
    console.log('Clearing all images...');
    const previewArea = document.getElementById('previewArea');
    if (previewArea) {
        previewArea.innerHTML = '<div class="preview-placeholder"><p>Clearing all images...</p></div>';
    }
    
    // Clear image cache and alternatives completely
    if (imageCache) {
        Object.keys(imageCache).forEach(key => delete imageCache[key]);
    }
    
    // Clear image alternatives to force reload
    imageAlternatives = {};
    currentImageIndex = {};
    
    // Small delay to show loading message
    await new Promise(resolve => setTimeout(resolve, 100));
    
    // Update preview with new images
    await updatePreviewCallback();
}

// Export all functions
export {
    emojiMap,
    imageAlternatives,
    currentImageIndex,
    getPlaceholderImage,
    getImageUrl,
    loadImageAlternatives,
    addMoreImageAlternatives,
    cycleImage,
    renderImage,
    refreshImages,
    refreshImageForWord,
    showImageLoadingSpinner,
    hideImageLoadingSpinner,
    enableImageDragAndDrop,
    initializeImageModule,
    clearAllImages
};
