// utils.js - Utility functions for wordtest

export function cleanWord(str) {
    return (str || '').replace(/^\s*\d+\.?\s*/, '').replace(/^[^\w가-힣]+/, '').replace(/\s+$/, '');
}

export function formatTitle(title) {
    return title || 'Worksheet Title';
}

export function isImageBasedLayout(layout) {
    const imageBasedLayouts = ['picture-list', 'picture-list-2col', 'picture-quiz', 'picture-quiz-5col', 'picture-matching', '6col-images', '5col-images'];
    return imageBasedLayouts.includes(layout);
}

export function delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

export function getLayoutColumns(layout) {
    const columnMap = {
        '2col': 2,
        '3col': 3,
        '4col': 4,
        '5col': 5,
        '6col': 6,
        'picture-list-2col': 2,
        'picture-quiz-5col': 5,
        '6col-images': 6,
        '5col-images': 5
    };
    return columnMap[layout] || 1;
}

export function generateUniqueId() {
    return 'id_' + Math.random().toString(36).substr(2, 9);
}

export function escapeHTML(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}
