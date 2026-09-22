import { getPlaceholderImage, getPixabaySearchUrl, renderImage, showImageLoadingSpinner, hideImageLoadingSpinner } from './images-utils.js?v=20260923-imgstate2';
import { createEnableImageDragAndDrop } from './images-dnd.js?v=20260923-imgstate2';
// Preserve global used by inline handlers (no behavior change)
if (!window.getPixabaySearchUrl) {
    window.getPixabaySearchUrl = getPixabaySearchUrl;
}

// Image handling functions for word worksheet generator

// Image functions - these will be set from imported modules
let getPixabayImage = null;
let imageCache = {};

// Image cycling state
let imageAlternatives = {}; // Store multiple image options for each word
let currentImageIndex = {}; // Track current image index for each word
// Retry counts to avoid infinite loops on broken images
const imageRetryCount = {};

function getSavedImage(wordKey) {
    const saved = window.savedImageData && window.savedImageData[wordKey];
    if (!saved || saved.src === 'emoji' || saved.emoji || typeof saved.src !== 'string' || !saved.src) return null;
    return saved;
}

function setSavedImage(word, index, image) {
    if (!word || image == null) return;
    const wordKey = `${String(word).toLowerCase()}_${index}`;
    const next = typeof image === 'string'
        ? { src: image, word: String(word), index: Number(index) }
        : { ...image, word: image.word || String(word), index: Number(index) };
    if (!next.src || next.src === 'emoji' || next.emoji) return;
    window.savedImageData = window.savedImageData || {};
    window.savedImageData[wordKey] = next;
}

async function getImageUrl(word, index, refresh = false, currentSettings = { imageSize: 50 }) {
    if (!word) return getPlaceholderImage(index, null, currentSettings);

    const wordKey = `${word.toLowerCase()}_${index}`;

    // Single source of truth: a loaded/saved image always wins.
    if (!refresh) {
        const saved = getSavedImage(wordKey);
        if (saved) {
            if (!imageAlternatives[wordKey]) imageAlternatives[wordKey] = [saved.src];
            currentImageIndex[wordKey] = 0;
            return saved.src;
        }
    }

    if (!imageAlternatives[wordKey]) {
        imageAlternatives[wordKey] = [];
        currentImageIndex[wordKey] = 0;
        if (window.savedImageData) delete window.savedImageData[wordKey];
    }

    if (refresh || imageAlternatives[wordKey].length === 0) {
        await loadImageAlternatives(word, wordKey, null, currentSettings);
    }

    const currentIndex = currentImageIndex[wordKey] || 0;
    const choice = imageAlternatives[wordKey][currentIndex];
    if (typeof choice === 'string' && (choice.startsWith('http') || choice.startsWith('data:image/'))) {
        setSavedImage(word, index, choice);
        return choice;
    }
    return getPlaceholderImage(index, null, currentSettings);
}

// Load image alternatives for a word (provider image + blank fallback)
async function loadImageAlternatives(word, wordKey, kor = null, currentSettings = { imageSize: 50 }) {
    const alternatives = [];
    // Try to get ONE image from provider or Netlify fallback
    try {
        let imageUrl = null;
        if (typeof getPixabayImage === 'function') {
            imageUrl = await getPixabayImage(word, true);
        } else {
            // Choose image_type from UI if available
            const mode = document.getElementById('pictureModeSelect')?.value || 'photos';
            const imageType = mode === 'illustrations' ? 'illustration' : (mode === 'photos' ? 'photo' : 'all');
            const apiPath = window.WillenaAPI ? window.WillenaAPI.getApiUrl('/.netlify/functions/pixabay') : '/.netlify/functions/pixabay';
            const url = `${apiPath}?q=${encodeURIComponent(word)}&image_type=${imageType}&safesearch=true&order=popular&per_page=5`;
            try {
                const res = await fetch(url, { cache: 'no-store' });
                if (res.ok) {
                    const data = await res.json();
                    const images = Array.isArray(data?.images) ? data.images : [];
                    imageUrl = data?.image || images[0] || null;
                }
            } catch (err) {
                console.warn('Pixabay function fetch failed:', err);
            }
        }
        if (imageUrl && imageUrl.startsWith('http')) {
            alternatives.push(imageUrl);
        }
    } catch (error) {
        console.warn('Error getting image for:', word, error);
    }
    // Add blank option last - just a white empty box
    alternatives.push('<div style="width:' + currentSettings.imageSize + 'px;height:' + currentSettings.imageSize + 'px;background:#fff;border-radius:8px;border:2px solid #ddd;"></div>');
    imageAlternatives[wordKey] = alternatives.slice(0, 2); // Provider image and blank fallback
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
                if (typeof newImageUrl === 'string' && (newImageUrl.startsWith('http') || newImageUrl.startsWith('data:image/'))) {
                    setSavedImage(word, index, newImageUrl);
                }
                
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

// Persist a user-selected image so it survives preview rebuilds/resizing
function setSelectedImage(word, index, imageUrl) {
    if (!word || typeof imageUrl !== 'string' || !imageUrl) return;
    const wordKey = `${String(word).toLowerCase()}_${index}`;
    imageAlternatives[wordKey] = [imageUrl];
    currentImageIndex[wordKey] = 0;
    setSavedImage(word, index, imageUrl);
}

// renderImage is imported from images-utils.js to avoid duplicate declarations

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
    // Get up to 6 more images using provider or Netlify fallback
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
                let imageUrl = null;
                if (typeof getPixabayImage === 'function') {
                    imageUrl = await getPixabayImage(newSearchTerms[i], true);
                } else {
                    const mode = document.getElementById('pictureModeSelect')?.value || 'photos';
                    const imageType = mode === 'illustrations' ? 'illustration' : (mode === 'photos' ? 'photo' : 'all');
                    const res = await fetch(`/.netlify/functions/pixabay?q=${encodeURIComponent(newSearchTerms[i])}&image_type=${imageType}&safesearch=true&order=popular&per_page=5`);
                    if (res.ok) {
                        const data = await res.json();
                        const images = Array.isArray(data?.images) ? data.images : [];
                        imageUrl = data?.image || images[0] || null;
                    }
                }
                if (imageUrl && imageUrl.startsWith('http')) {
                    newAlternatives.push(imageUrl);
                }
            } catch (error) {
                console.warn('Error getting new image for:', newSearchTerms[i], error);
            }
        }

        // Add the new alternatives to the existing ones (but avoid duplicates)
        const existingAlternatives = imageAlternatives[wordKey] || [];
        const uniqueNewAlternatives = newAlternatives.filter(alt => !existingAlternatives.includes(alt));

        if (uniqueNewAlternatives.length > 0) {
            const insertIndex = Math.min(3, existingAlternatives.length);
            imageAlternatives[wordKey] = [
                ...existingAlternatives.slice(0, insertIndex),
                ...uniqueNewAlternatives,
                ...existingAlternatives.slice(insertIndex)
            ];
            if (imageAlternatives[wordKey].length > 15) {
                imageAlternatives[wordKey] = imageAlternatives[wordKey].slice(0, 15);
            }
        }
    } catch (error) {
        console.warn('Error adding more alternatives for:', word, error);
    }
}

// Helper to refresh images for a single word/index
async function refreshImageForWord(word, index, forceNewKey = false, kor = null, currentSettings, updatePreviewCallback) {
    const wordKey = `${word.toLowerCase()}_${index}`;
    
    // Show loading spinner
    showImageLoadingSpinner(word, index);
    
    if (forceNewKey) {
        // Reset imageAlternatives and currentImageIndex for this slot
        imageAlternatives[wordKey] = [];
        currentImageIndex[wordKey] = 0;
    }

    try {
        // Fetch a new provider image plus blank fallback
        await loadImageAlternatives(word, wordKey, kor, currentSettings);
    } finally {
        // Hide loading spinner
        hideImageLoadingSpinner(word, index);
        updatePreviewCallback();
    }
}

// Enhanced drag and drop functionality for images (delegated to factory)
const enableImageDragAndDrop = createEnableImageDragAndDrop({
  showImageLoadingSpinner,
  hideImageLoadingSpinner,
  imageAlternatives,
  currentImageIndex,
  setSavedImage
});

// Initialize image module functions
function initializeImageModule(pixabayFn, cache) {
    getPixabayImage = pixabayFn;
    imageCache = cache;
}

// Reset all in-memory image state without touching the DOM
function resetImageState() {
    try {
        imageCache = {};
        imageAlternatives = {};
        currentImageIndex = {};
    } catch (_) {}
}

// Handle a single image error by fetching a new alternative only for that slot
async function handleImageError(word, index, imgEl, updatePreviewCallback) {
    const key = `${(word || '').toLowerCase()}_${index}`;
    imageRetryCount[key] = (imageRetryCount[key] || 0) + 1;
    // Stop after 2 retries; replace with a blank box
    const maxRetries = 2;
    if (imageRetryCount[key] > maxRetries) {
        if (imgEl) {
            imgEl.outerHTML = `<div style="width:${window.currentSettings?.imageSize || 50}px;height:${window.currentSettings?.imageSize || 50}px;background:#fff;border-radius:8px;border:2px solid #ddd;"></div>`;
        }
        return;
    }
    try {
        const updater = updatePreviewCallback || window.updatePreview || (()=>{});
        await refreshImageForWord(word, index, true, null, window.currentSettings || { imageSize: 50 }, updater);
    } catch (e) {
        // As a last resort, swap to a blank placeholder
        if (imgEl) {
            imgEl.outerHTML = `<div style="width:${window.currentSettings?.imageSize || 50}px;height:${window.currentSettings?.imageSize || 50}px;background:#fff;border-radius:8px;border:2px solid #ddd;"></div>`;
        }
    }
}

// Scan current preview and refresh only images that failed to load
async function refreshFailedImages(updatePreviewCallback) {
    const preview = document.getElementById('previewArea');
    if (!preview) return;
    const imgs = Array.from(preview.querySelectorAll('.image-drop-zone img'));
    const failed = imgs.filter(img => img.getAttribute('data-error') === '1' || (img.complete && img.naturalWidth === 0));
    let count = 0;
    for (const img of failed) {
        const word = img.getAttribute('data-word') || img.closest('.image-drop-zone')?.getAttribute('data-word') || '';
        const idx = parseInt(img.getAttribute('data-index') || img.closest('.image-drop-zone')?.getAttribute('data-index') || '-1');
        if (!isNaN(idx) && idx >= 0) {
        count++;
        await handleImageError(word, idx, img, updatePreviewCallback);
        }
    }
    return count;
}

// Expose a global handler for inline <img onerror>
if (!window._wordtestImageError) {
    window._wordtestImageError = (word, index, imgEl) => {
        handleImageError(word, index, imgEl, window.updatePreview || (()=>{}));
    };
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
    window.savedImageData = {};
    
    // Small delay to show loading message
    await new Promise(resolve => setTimeout(resolve, 100));
    
    // Update preview with new images
    await updatePreviewCallback();
}

// Export all functions
export {
  imageAlternatives,
  currentImageIndex,
  getPlaceholderImage,
  getImageUrl,
  loadImageAlternatives,
  addMoreImageAlternatives,
  cycleImage,
    setSelectedImage,
  setSavedImage,
  renderImage,
  refreshImages,
  refreshImageForWord,
  showImageLoadingSpinner,
  hideImageLoadingSpinner,
  enableImageDragAndDrop,
  initializeImageModule,
  clearAllImages,
  resetImageState,
  refreshFailedImages,
  handleImageError,
  getPixabaySearchUrl
};
