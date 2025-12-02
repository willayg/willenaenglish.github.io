// ui.js - UI functions for wordtest

// Import currentSettings and other necessary dependencies
// These will be passed in or imported from the main module

export function updateFont(currentSettings, updatePreviewStyles) {
    currentSettings.font = document.getElementById('fontSelect').value;
    updatePreviewStyles();
}

export function updateFontSize(currentSettings, updatePreviewStyles) {
    currentSettings.fontSize = parseInt(document.getElementById('fontSizeInput').value);
    updatePreviewStyles();
}

export function increaseFontSize(updateFontSize) {
    const input = document.getElementById('fontSizeInput');
    input.value = parseInt(input.value) + 1;
    updateFontSize();
}

export function decreaseFontSize(updateFontSize) {
    const input = document.getElementById('fontSizeInput');
    if (parseInt(input.value) > 1) {
        input.value = parseInt(input.value) - 1;
        updateFontSize();
    }
}

export function updateImageGap(currentSettings, updatePreviewStyles) {
    const slider = document.getElementById('imageGapSlider');
    if (slider) {
        currentSettings.imageGap = parseInt(slider.value);
        console.log('Image gap updated to:', currentSettings.imageGap);
        updatePreviewStyles();
    }
}

export function updateImageSize(currentSettings, updatePreviewStyles) {
    const slider = document.getElementById('imageSizeSlider');
    if (slider) {
        currentSettings.imageSize = parseInt(slider.value);
        console.log('Image size updated to:', currentSettings.imageSize);
        
        // Force update all image sizes when slider is used
        const previewArea = document.getElementById('previewArea');
        if (previewArea) {
            const images = previewArea.querySelectorAll('.image-drop-zone img');
            images.forEach(img => {
                img.removeAttribute('data-custom-size');
                img.style.width = currentSettings.imageSize + 'px';
                img.style.height = currentSettings.imageSize + 'px';
            });
        }
        
        updatePreviewStyles();
    }
}

export function updateLayout(currentSettings, updatePreview) {
    currentSettings.layout = document.getElementById('layoutSelect').value;
    updatePreview();
}
