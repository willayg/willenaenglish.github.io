export class ImageManager {
    constructor() {
        this.pixabayApiKey = '46654113-8b5fc7c7c1f26479982af7c7f'; // Same as wordtest
        this.imageCache = new Map();
        this.loadingImages = new Set();
    }

    async addImagesWithAI(cards) {
        if (!cards || cards.length === 0) {
            alert('No cards available to add images to.');
            return;
        }

        const cardsWithoutImages = cards.filter(card => !card.imageUrl);
        if (cardsWithoutImages.length === 0) {
            alert('All cards already have images.');
            return;
        }

        // Show loading indicator
        this.showLoadingIndicator(true);

        try {
            for (const card of cardsWithoutImages) {
                if (!this.loadingImages.has(card.english)) {
                    await this.fetchImageForCard(card);
                    // Small delay to avoid rate limiting
                    await new Promise(resolve => setTimeout(resolve, 200));
                }
            }
        } catch (error) {
            console.error('Error adding images:', error);
            alert('Error fetching images. Please try again.');
        } finally {
            this.showLoadingIndicator(false);
        }
    }

    async fetchImageForCard(card) {
        if (!card || !card.english) return;

        this.loadingImages.add(card.english);
        
        try {
            // Check cache first
            const cacheKey = card.english.toLowerCase();
            if (this.imageCache.has(cacheKey)) {
                card.imageUrl = this.imageCache.get(cacheKey);
                return;
            }

            const imageUrl = await this.searchPixabayImage(card.english);
            if (imageUrl) {
                card.imageUrl = imageUrl;
                this.imageCache.set(cacheKey, imageUrl);
            }
        } catch (error) {
            console.error(`Error fetching image for "${card.english}":`, error);
        } finally {
            this.loadingImages.delete(card.english);
        }
    }

    async searchPixabayImage(query) {
        try {
            const cleanQuery = this.cleanSearchQuery(query);
            const url = `https://pixabay.com/api/?key=${this.pixabayApiKey}&q=${encodeURIComponent(cleanQuery)}&image_type=photo&category=all&safesearch=true&per_page=20&min_width=300&min_height=200`;
            
            const response = await fetch(url);
            if (!response.ok) {
                throw new Error(`Pixabay API error: ${response.status}`);
            }
            
            const data = await response.json();
            
            if (data.hits && data.hits.length > 0) {
                // Prefer images with good aspect ratios for flashcards
                const suitableImages = data.hits.filter(hit => {
                    const aspectRatio = hit.imageWidth / hit.imageHeight;
                    return aspectRatio >= 0.8 && aspectRatio <= 2.0; // Not too narrow or wide
                });
                
                const selectedImages = suitableImages.length > 0 ? suitableImages : data.hits;
                const randomImage = selectedImages[Math.floor(Math.random() * selectedImages.length)];
                
                // Use webformatURL for good quality but reasonable size
                return randomImage.webformatURL;
            }
            
            return null;
        } catch (error) {
            console.error('Pixabay search error:', error);
            return null;
        }
    }

    cleanSearchQuery(query) {
        // Remove special characters and clean up the query
        return query
            .toLowerCase()
            .replace(/[^\w\s]/g, '') // Remove special characters
            .replace(/\s+/g, ' ') // Normalize spaces
            .trim()
            .split(' ')[0]; // Use only the first word for better results
    }

    async refreshImages(cards) {
        if (!cards || cards.length === 0) return;

        const cardsWithImages = cards.filter(card => card.imageUrl);
        if (cardsWithImages.length === 0) {
            alert('No cards with images to refresh.');
            return;
        }

        // Clear cache for these cards
        cardsWithImages.forEach(card => {
            const cacheKey = card.english.toLowerCase();
            this.imageCache.delete(cacheKey);
            card.imageUrl = null;
        });

        // Fetch new images
        await this.addImagesWithAI(cardsWithImages);
    }

    handleDroppedFiles(files) {
        const imageFiles = files.filter(file => file.type.startsWith('image/'));
        if (imageFiles.length === 0) {
            alert('Please drop image files only.');
            return;
        }

        // For now, just store the first image for manual assignment
        // In a full implementation, you might want to show a dialog to assign images to cards
        this.pendingImages = imageFiles;
        alert(`${imageFiles.length} image(s) ready to assign. Drop them on specific cards to assign.`);
    }

    handleCardImageDrop(file, cardIndex) {
        if (!file.type.startsWith('image/')) {
            alert('Please drop an image file.');
            return;
        }

        const reader = new FileReader();
        reader.onload = (e) => {
            // Get the card manager instance (you'd need to pass this in or use a global reference)
            const app = window.app;
            if (app && app.cardManager) {
                app.cardManager.setCardImage(cardIndex, e.target.result, file);
                app.updatePreview();
            }
        };
        reader.readAsDataURL(file);
    }

    showLoadingIndicator(show) {
        let indicator = document.getElementById('imageLoadingIndicator');
        
        if (show) {
            if (!indicator) {
                indicator = document.createElement('div');
                indicator.id = 'imageLoadingIndicator';
                indicator.innerHTML = `
                    <div style="
                        position: fixed;
                        top: 50%;
                        left: 50%;
                        transform: translate(-50%, -50%);
                        background: rgba(0, 0, 0, 0.8);
                        color: white;
                        padding: 20px 30px;
                        border-radius: 8px;
                        z-index: 1000;
                        display: flex;
                        align-items: center;
                        gap: 12px;
                    ">
                        <div style="
                            width: 20px;
                            height: 20px;
                            border: 2px solid #fff;
                            border-top: 2px solid transparent;
                            border-radius: 50%;
                            animation: spin 1s linear infinite;
                        "></div>
                        <span>Fetching images...</span>
                    </div>
                    <style>
                        @keyframes spin {
                            to { transform: rotate(360deg); }
                        }
                    </style>
                `;
                document.body.appendChild(indicator);
            }
        } else {
            if (indicator) {
                indicator.remove();
            }
        }
    }

    // Preload images for better performance
    async preloadImage(url) {
        return new Promise((resolve, reject) => {
            const img = new Image();
            img.onload = () => resolve(img);
            img.onerror = reject;
            img.src = url;
        });
    }

    // Get image dimensions
    async getImageDimensions(url) {
        try {
            const img = await this.preloadImage(url);
            return {
                width: img.naturalWidth,
                height: img.naturalHeight,
                aspectRatio: img.naturalWidth / img.naturalHeight
            };
        } catch (error) {
            console.error('Error getting image dimensions:', error);
            return null;
        }
    }

    // Compress image for better performance
    compressImage(file, maxWidth = 800, quality = 0.8) {
        return new Promise((resolve) => {
            const canvas = document.createElement('canvas');
            const ctx = canvas.getContext('2d');
            const img = new Image();
            
            img.onload = () => {
                // Calculate new dimensions
                let { width, height } = img;
                if (width > maxWidth) {
                    height = (height * maxWidth) / width;
                    width = maxWidth;
                }
                
                canvas.width = width;
                canvas.height = height;
                
                // Draw and compress
                ctx.drawImage(img, 0, 0, width, height);
                canvas.toBlob(resolve, 'image/jpeg', quality);
            };
            
            img.src = URL.createObjectURL(file);
        });
    }

    // Clear all images from cards
    clearAllImages(cards) {
        if (cards) {
            cards.forEach(card => {
                card.imageUrl = null;
                card.image = null;
            });
        }
        this.imageCache.clear();
    }

    // Export images as base64 for saving
    async exportImagesAsBase64(cards) {
        const imagesData = {};
        
        for (const card of cards) {
            if (card.imageUrl && !card.imageUrl.startsWith('data:')) {
                try {
                    const response = await fetch(card.imageUrl);
                    const blob = await response.blob();
                    const base64 = await this.blobToBase64(blob);
                    imagesData[card.english] = base64;
                } catch (error) {
                    console.error(`Error converting image for ${card.english}:`, error);
                }
            }
        }
        
        return imagesData;
    }

    // Convert blob to base64
    blobToBase64(blob) {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = () => resolve(reader.result);
            reader.onerror = reject;
            reader.readAsDataURL(blob);
        });
    }

    // Restore images from base64 data
    restoreImagesFromBase64(cards, imagesData) {
        if (!imagesData) return;
        
        cards.forEach(card => {
            if (imagesData[card.english]) {
                card.imageUrl = imagesData[card.english];
            }
        });
    }

    // Get statistics about images
    getImageStats(cards) {
        const total = cards.length;
        const withImages = cards.filter(card => card.imageUrl).length;
        const withoutImages = total - withImages;
        
        return {
            total,
            withImages,
            withoutImages,
            percentage: total > 0 ? Math.round((withImages / total) * 100) : 0
        };
    }

    // Batch image operations
    async batchAddImages(cards, batchSize = 5) {
        const cardsWithoutImages = cards.filter(card => !card.imageUrl);
        
        for (let i = 0; i < cardsWithoutImages.length; i += batchSize) {
            const batch = cardsWithoutImages.slice(i, i + batchSize);
            const promises = batch.map(card => this.fetchImageForCard(card));
            
            try {
                await Promise.all(promises);
                // Update UI after each batch
                if (window.app && window.app.updatePreview) {
                    window.app.updatePreview();
                }
                // Delay between batches to avoid rate limiting
                await new Promise(resolve => setTimeout(resolve, 1000));
            } catch (error) {
                console.error('Batch image fetch error:', error);
            }
        }
    }
}