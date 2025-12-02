// Utilities extracted from images.js to reduce file size without changing behavior

// Simple emoji map for fallback
export const emojiMap = {
	apple: "🍎", dog: "🐶", cat: "🐱", book: "📚", car: "🚗",
	house: "🏠", tree: "🌳", sun: "☀️", moon: "🌙", star: "⭐",
	water: "💧", fire: "🔥", flower: "🌸", fish: "🐠", bird: "🐦",
	food: "🍎", eat: "🍽️", drink: "🥤", sleep: "😴", run: "🏃",
	walk: "🚶", happy: "😊", sad: "😢", big: "🔍", small: "🔎"
};

// Helper function to get placeholder image
export function getPlaceholderImage(index, label = null, currentSettings = { imageSize: 50 }) {
	const displayLabel = label || `Image ${index + 1}`;
	return `<div style="width:${currentSettings.imageSize}px;height:${currentSettings.imageSize}px;background:#f5f5f5;display:flex;align-items:center;justify-content:center;border-radius:8px;border:2px solid #ddd;font-size:14px;color:#666;">
		${displayLabel}
	</div>`;
}

// Centralized helper for Pixabay search URLs (kept identical to original)
export function getPixabaySearchUrl(word, mode) {
	const encodedWord = encodeURIComponent(word);
	switch (mode) {
		case 'photos':
			return `https://pixabay.com/images/search/${encodedWord}/`;
		case 'illustrations':
			return `https://pixabay.com/illustrations/search/${encodedWord}/`;
		case 'ai':
			return `https://pixabay.com/images/search/${encodedWord}/?content_type=ai`;
		case 'vectors':
			return `https://pixabay.com/vectors/search/${encodedWord}/`;
		default:
			return `https://pixabay.com/images/search/${encodedWord}/`;
	}
}

// Helper function to render an image (kept identical to original)
export function renderImage(imageUrl, index, word = null, kor = null, currentSettings = { imageSize: 50 }) {
	// Add double-click to open image search based on selected mode
	let clickHandler = '';
	if (word) {
		clickHandler = `onclick="
			const pictureModeSelect = document.getElementById('pictureModeSelect');
			const mode = pictureModeSelect ? pictureModeSelect.value : 'photos';
			const url = window.getPixabaySearchUrl ? window.getPixabaySearchUrl('${word}', mode) : '${getPixabaySearchUrl('${word}', '${mode}')}' ;
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
		// Emoji or placeholder divs need consistent box sizing with <img>
		const isEmoji = imageUrl.includes('font-size:') && !/width:\s*\d+px/.test(imageUrl);
		if (isEmoji) {
			const updatedImageUrl = imageUrl.replace(/font-size:\s*\d+px/, `font-size: ${currentSettings.imageSize * 0.8}px`);
			return `<div class="image-drop-zone" data-word="${word}" data-index="${index}" style="position: relative; cursor: pointer;" ${clickHandler}>
				<div style="width:${currentSettings.imageSize}px;height:${currentSettings.imageSize}px;display:flex;align-items:center;justify-content:center;border-radius:8px;border:2px solid #ddd;overflow:hidden;background:#fff;">
					${updatedImageUrl}
				</div>
			</div>`;
		}
		// Already a sized placeholder box; just wrap normally
		return `<div class="image-drop-zone" data-word="${word}" data-index="${index}" style="position: relative; cursor: pointer;" ${clickHandler}>${imageUrl}</div>`;
	}
	// It's a real image URL
	const safeWord = word || '';
	const onErr = `onerror="this.setAttribute('data-error','1'); if(window._wordtestImageError){ window._wordtestImageError(${JSON.stringify(''+safeWord)}, ${index}, this); }"`;
	return `<div class="image-drop-zone" data-word="${safeWord}" data-index="${index}" style="position: relative;" ${clickHandler}>
		<div style="width:${currentSettings.imageSize}px;height:${currentSettings.imageSize}px;display:block;border-radius:8px;border:2px solid #ddd;overflow:hidden;background:#fff;">
			<img src="${imageUrl}" ${onErr} style="display:block;width:100%;height:100%;object-fit:cover;" alt="Image ${index + 1}">
		</div>
	</div>`;
}

// Helper functions to show/hide loading spinner
export function showImageLoadingSpinner(word, index) {
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

export function hideImageLoadingSpinner(word, index) {
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

export default {
	emojiMap,
	getPlaceholderImage,
	getPixabaySearchUrl,
	renderImage,
	showImageLoadingSpinner,
	hideImageLoadingSpinner
};
