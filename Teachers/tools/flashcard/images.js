export class ImageManager {
    constructor() {
        // Remove the hardcoded API key - use Netlify function instead
        this.imageCache = new Map();
        this.loadingImages = new Set();
    }

    async addImagesWithAI(cards, showAlerts = true) {
        if (!cards || cards.length === 0) {
            if (showAlerts) {
                alert('No cards available to add images to.');
            }
            return;
        }

        const cardsWithoutImages = cards.filter(card => !card.imageUrl);
        if (cardsWithoutImages.length === 0) {
            if (showAlerts) {
                alert('All cards already have images.');
            }
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
            if (showAlerts) {
                alert('Error fetching images. Please try again.');
            }
        } finally {
            this.showLoadingIndicator(false);
        }
    }

    async fetchImageForCard(card) {
        if (!card || !card.english || card.imageUrl) return;

        this.loadingImages.add(card.english);
        
        try {
            // Check cache first
            const cacheKey = card.english.toLowerCase();
            if (this.imageCache.has(cacheKey)) {
                card.imageUrl = this.imageCache.get(cacheKey);
                this.loadingImages.delete(card.english);
                return;
            }

            const imageUrl = await this.searchPixabayImage(card.english);
            if (imageUrl) {
                card.imageUrl = imageUrl;
                this.imageCache.set(cacheKey, imageUrl);
            } else {
                console.log(`No image found for "${card.english}"`);
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
            console.log(`Searching for image: "${cleanQuery}"`);
            
            // Try Pixabay first if we have network access
            try {
                // Read current filter selection and build proper Pixabay query
                let imageType = 'photo';
                let extraParams = '';
                const sel = document.getElementById('imageTypeSelect');
                if (sel) {
                    console.log(`Current filter selection: ${sel.value}`);
                    if (sel.value === 'illustrations') imageType = 'illustration';
                    else if (sel.value === 'vectors') imageType = 'vector';
                    else if (sel.value === 'ai') { imageType = 'photo'; extraParams = '&content_type=ai'; }
                }
                const apiPath = window.WillenaAPI ? window.WillenaAPI.getApiUrl('/.netlify/functions/pixabay') : '/.netlify/functions/pixabay';
                const url = `${apiPath}?q=${encodeURIComponent(cleanQuery)}&image_type=${imageType}${extraParams}&safesearch=true&per_page=5`;
                console.log(`Fetching from: ${url}`);
                
                const response = await fetch(url);
                
                if (response.ok) {
                    const data = await response.json();
                    console.log(`Search results for "${cleanQuery}":`, data);
                    
                    if (data.images && data.images.length > 0) {
                        // Return a random image from the results
                        const randomImage = data.images[Math.floor(Math.random() * data.images.length)];
                        console.log(`Selected image for "${cleanQuery}":`, randomImage);
                        return randomImage;
                    } else if (data.hits && data.hits.length > 0) {
                        // Handle direct Pixabay response format
                        const randomImage = data.hits[Math.floor(Math.random() * data.hits.length)];
                        const imageUrl = randomImage.webformatURL || randomImage.largeImageURL || randomImage.fullHDURL;
                        console.log(`Selected Pixabay image for "${cleanQuery}":`, imageUrl);
                        return imageUrl;
                    }
                }
            } catch (networkError) {
                console.log('Network request failed, using fallback');
            }
            
            // Fallback to local images
            console.log(`Using fallback for "${cleanQuery}"`);
            return await this.getLocalFallbackImage(cleanQuery);
        } catch (error) {
            console.error('Pixabay search error:', error);
            // Fallback to local development images if API fails
            return await this.getLocalFallbackImage(cleanQuery);
        }
    }

    // Fallback method for local development or when API fails
    async getLocalFallbackImage(query) {
        const cleanQuery = query.toLowerCase().trim();
        
        // Simple emoji map for common words (like wordtest)
        const emojiMap = {
            apple: "🍎", dog: "🐶", cat: "🐱", book: "📚", car: "🚗", 
            house: "🏠", tree: "🌳", sun: "☀️", moon: "🌙", star: "⭐",
            water: "💧", fire: "🔥", flower: "🌸", fish: "🐠", bird: "🐦",
            food: "🍎", eat: "🍽️", drink: "🥤", sleep: "😴", run: "🏃",
            walk: "🚶", happy: "😊", sad: "😢", big: "🔍", small: "🔎",
            banana: "🍌", orange: "🍊", grape: "🍇", strawberry: "🍓", 
            chair: "🪑", table: "🪑", window: "🪟", door: "🚪", bed: "🛏️",
            school: "🏫", hospital: "🏥", store: "🏪", park: "🏞️", beach: "🏖️",
            phone: "📱", computer: "💻", camera: "📷", watch: "⌚", bag: "👜"
        };
        
        // Check for direct emoji match
        if (emojiMap[cleanQuery]) {
            console.log(`Using emoji for "${cleanQuery}": ${emojiMap[cleanQuery]}`);
            return this.createEmojiImageUrl(emojiMap[cleanQuery]);
        }
        
        // Try to find partial matches
        for (const [key, emoji] of Object.entries(emojiMap)) {
            if (key.includes(cleanQuery) || cleanQuery.includes(key)) {
                console.log(`Using partial match emoji for "${cleanQuery}": ${emoji}`);
                return this.createEmojiImageUrl(emoji);
            }
        }
        
        // Fallback to Unsplash (doesn't require API key for basic usage)
        try {
            const unsplashUrl = `https://source.unsplash.com/200x200/?${encodeURIComponent(cleanQuery)}`;
            console.log(`Using Unsplash fallback for "${cleanQuery}"`);
            return unsplashUrl;
        } catch (error) {
            console.warn('Unsplash fallback failed:', error);
        }
        
        // Final fallback - placeholder image
        console.log(`Using placeholder for "${cleanQuery}"`);
        return this.createPlaceholderImageUrl(cleanQuery);
    }

    // Create a data URL with emoji
    createEmojiImageUrl(emoji) {
        const canvas = document.createElement('canvas');
        canvas.width = 200;
        canvas.height = 200;
        const ctx = canvas.getContext('2d');
        
        // Fill background
        ctx.fillStyle = '#f8f9fa';
        ctx.fillRect(0, 0, 200, 200);
        
        // Draw emoji
        ctx.font = '120px serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillStyle = '#000';
        ctx.fillText(emoji, 100, 100);
        
        return canvas.toDataURL();
    }

    // Create a placeholder image URL
    createPlaceholderImageUrl(text) {
        const canvas = document.createElement('canvas');
        canvas.width = 200;
        canvas.height = 200;
        const ctx = canvas.getContext('2d');
        
        // Fill background
        ctx.fillStyle = '#e9ecef';
        ctx.fillRect(0, 0, 200, 200);
        
        // Draw text
        ctx.font = '16px Arial';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillStyle = '#6c757d';
        ctx.fillText('Image', 100, 80);
        ctx.font = '14px Arial';
        ctx.fillText(text, 100, 120);
        
        return canvas.toDataURL();
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