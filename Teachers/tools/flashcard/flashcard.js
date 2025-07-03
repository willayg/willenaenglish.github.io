document.addEventListener('DOMContentLoaded', function() {
  // DOM Elements
  const aiPromptInput = document.getElementById('aiPrompt');
  const generateWordsBtn = document.getElementById('generateWordsBtn');
  const wordListTextarea = document.getElementById('wordList');
  const cardsPerPageSelect = document.getElementById('cardsPerPage');
  const generateCardsBtn = document.getElementById('generateCardsBtn');
  const flashCardPreview = document.getElementById('flashCardPreview');
  const wordCountDisplay = document.getElementById('wordCount');
  const loadingState = document.getElementById('loadingState');
  const previewContainer = document.getElementById('previewContainer');
  const printBtn = document.getElementById('printBtn');
  const downloadPdfBtn = document.getElementById('downloadPdfBtn');
  const fontSizeSelect = document.getElementById('fontSize');
  const showKoreanCheckbox = document.getElementById('showKorean');
  const imageQualitySelect = document.getElementById('imageQuality');
  const statusDisplay = document.getElementById('statusDisplay');

  let currentWords = [];
  let currentImages = {};
  let imageCache = {}; // Cache multiple images per word for click-to-change
  let currentImageIndex = {}; // Track which image index is shown for each word

  // OpenMoji filename mapping for common words
  const openMojiMap = {
    // Animals
    'cat': ['cat-face.svg', 'cat.svg'],
    'dog': ['dog-face.svg', 'dog.svg'],
    'rabbit': ['rabbit-face.svg', 'rabbit.svg'],
    'mouse': ['mouse-face.svg', 'mouse.svg'],
    'horse': ['horse-face.svg', 'horse.svg'],
    'cow': ['cow-face.svg', 'cow.svg'],
    'pig': ['pig-face.svg', 'pig.svg'],
    'sheep': ['sheep.svg'],
    'monkey': ['monkey-face.svg', 'monkey.svg'],
    'chicken': ['chicken.svg'],
    'bird': ['bird.svg'],
    'elephant': ['elephant.svg'],
    'bear': ['bear.svg'],
    'tiger': ['tiger-face.svg', 'tiger.svg'],
    'lion': ['tiger.svg'], // closest match
    'fish': ['fish.svg'],
    'whale': ['whale.svg'],
    'dolphin': ['dolphin.svg'],
    'snake': ['snake.svg'],
    'turtle': ['turtle.svg'],
    'frog': ['frog.svg'],
    'bee': ['bee.svg'],
    'ant': ['ant.svg'],
    'butterfly': ['butterfly.svg'], // if available
    'snail': ['snail.svg'],
    'octopus': ['octopus.svg'],
    'penguin': ['penguin.svg'],
    
    // Food
    'apple': ['apple.svg', 'green-apple.svg'],
    'banana': ['banana.svg'],
    'orange': ['tangerine.svg'],
    'strawberry': ['strawberry.svg'],
    'peach': ['peach.svg'],
    'pear': ['pear.svg'],
    'cherry': ['cherries.svg'],
    'bread': ['bread.svg'],
    'cheese': ['cheese.svg'],
    'hamburger': ['hamburger.svg'],
    'pizza': ['pizza.svg'],
    'hotdog': ['hot-dog.svg'],
    'cake': ['birthday-cake.svg'],
    'cookie': ['cookie.svg'],
    'candy': ['candy.svg'],
    'chocolate': ['chocolate-bar.svg'],
    'rice': ['cooked-rice.svg'],
    'noodles': ['spaghetti.svg'],
    'soup': ['steaming-bowl.svg'],
    'coffee': ['hot-beverage.svg'],
    'tea': ['teacup-without-handle.svg'],
    'milk': ['glass-of-milk.svg'],
    
    // Nature
    'sun': ['sun.svg', 'sun-with-face.svg'],
    'moon': ['full-moon.svg', 'crescent-moon.svg'],
    'star': ['star.svg', 'glowing-star.svg'],
    'cloud': ['cloud.svg'],
    'rain': ['cloud-with-rain.svg'],
    'snow': ['snowflake.svg'],
    'tree': ['deciduous-tree.svg', 'evergreen-tree.svg'],
    'flower': ['cherry-blossom.svg', 'hibiscus.svg', 'sunflower.svg'],
    'rose': ['rose.svg'],
    'mountain': ['mountain.svg'],
    'ocean': ['water-wave.svg'],
    'fire': ['fire.svg'],
    
    // Transportation
    'car': ['automobile.svg'],
    'bus': ['bus.svg'],
    'train': ['train.svg'],
    'airplane': ['airplane.svg'],
    'bicycle': ['bicycle.svg'],
    'boat': ['sailboat.svg'],
    'ship': ['ship.svg'],
    'taxi': ['taxi.svg'],
    'truck': ['delivery-truck.svg'],
    
    // Body parts
    'eye': ['eye.svg'],
    'nose': ['nose.svg'],
    'mouth': ['mouth.svg'],
    'ear': ['ear.svg'],
    'hand': ['raised-hand.svg'],
    'foot': ['foot.svg'],
    
    // Objects
    'book': ['open-book.svg', 'closed-book.svg'],
    'phone': ['mobile-phone.svg'],
    'computer': ['laptop-computer.svg'],
    'television': ['television.svg'],
    'clock': ['twelve-oclock.svg'],
    'camera': ['camera.svg'],
    'key': ['key.svg'],
    'ball': ['soccer-ball.svg'],
    'umbrella': ['umbrella.svg'],
    'bag': ['handbag.svg'],
    'hat': ['top-hat.svg'],
    'shirt': ['t-shirt.svg'],
    'shoe': ['running-shoe.svg'],
    
    // Emotions
    'happy': ['grinning-face.svg', 'smiling-face-with-smiling-eyes.svg'],
    'sad': ['crying-face.svg', 'disappointed-face.svg'],
    'angry': ['angry-face.svg'],
    'surprised': ['astonished-face.svg'],
    'love': ['smiling-face-with-heart-eyes.svg', 'red-heart.svg'],
    'heart': ['red-heart.svg', 'sparkling-heart.svg'],
    
    // Numbers
    'one': ['one-button.svg'],
    'two': ['two-button.svg'],
    'three': ['three-button.svg'],
    'four': ['four-button.svg'],
    'five': ['five-button.svg'],
    'six': ['six-button.svg'],
    'seven': ['seven-button.svg'],
    'eight': ['eight-button.svg'],
    'nine': ['nine-button.svg'],
    'ten': ['keycap-ten.svg'],
    
    // Colors
    'red': ['red-circle.svg', 'red-heart.svg'],
    'blue': ['blue-circle.svg', 'blue-heart.svg'],
    'green': ['green-circle.svg', 'green-heart.svg'],
    'yellow': ['yellow-circle.svg', 'yellow-heart.svg'],
    'purple': ['purple-heart.svg'],
    'orange': ['orange-circle.svg'],
    'black': ['black-circle.svg'],
    'white': ['white-circle.svg'],
    
    // Weather
    'sunny': ['sun.svg'],
    'cloudy': ['cloud.svg'],
    'rainy': ['cloud-with-rain.svg'],
    'snowy': ['cloud-with-snow.svg'],
    'windy': ['wind-face.svg'],
    
    // Korean specific additions
    '고양이': ['cat-face.svg', 'cat.svg'],
    '개': ['dog-face.svg', 'dog.svg'],
    '사과': ['apple.svg', 'green-apple.svg'],
    '바나나': ['banana.svg'],
    '자동차': ['automobile.svg'],
    '집': ['house.svg'],
    '학교': ['school.svg'],
    '책': ['open-book.svg', 'closed-book.svg'],
    '꽃': ['cherry-blossom.svg', 'hibiscus.svg'],
    '나무': ['deciduous-tree.svg', 'evergreen-tree.svg'],
    '태양': ['sun.svg', 'sun-with-face.svg'],
    '달': ['full-moon.svg', 'crescent-moon.svg'],
    '별': ['star.svg', 'glowing-star.svg'],
    '물': ['droplet.svg', 'water-wave.svg'],
    '불': ['fire.svg'],
    '음식': ['fork-and-knife.svg'],
    '빵': ['bread.svg'],
    '물고기': ['fish.svg'],
    '새': ['bird.svg'],
    '마음': ['red-heart.svg', 'sparkling-heart.svg'],
    '행복': ['grinning-face.svg', 'smiling-face-with-smiling-eyes.svg'],
    '슬픔': ['crying-face.svg', 'disappointed-face.svg']
  };

  // Update status display
  function updateStatus(message, isError = false) {
    if (statusDisplay) {
      statusDisplay.textContent = message;
      statusDisplay.className = `mt-2 p-2 text-xs rounded border ${isError ? 'bg-red-50 text-red-700 border-red-200' : 'bg-gray-50 text-gray-700 border-gray-200'}`;
      console.log('Status:', message);
    }
  }

  // Update word count
  function updateWordCount() {
    const words = parseWordList();
    wordCountDisplay.textContent = `${words.length} word pairs ready`;
    updateStatus(`${words.length} word pairs detected`);
  }

  // Parse word list from textarea
  function parseWordList() {
    const text = wordListTextarea.value.trim();
    if (!text) return [];
    
    return text.split('\n')
      .map(line => line.trim())
      .filter(line => line && line.includes(','))
      .map(line => {
        // Remove unwanted prefixes (numbers, dots, asterisks)
        const cleanedLine = line.replace(/^\s*[\d*]+[.)]?\s*/, '');
        const parts = cleanedLine.split(',').map(part => part.trim());
        if (parts.length >= 2) {
          return {
            english: parts[0],
            korean: parts[1] || ''
          };
        }
        return null;
      })
      .filter(pair => pair !== null);
  }

  // Get the correct base URL for API calls
  function getBaseUrl() {
    // Get the current window location
    const currentUrl = window.location.href;
    
    // If we're in the tools/flashcard directory, we need to go up to the root
    if (currentUrl.includes('/Teachers/tools/flashcard/')) {
      // Go up 3 levels to get to the root
      return window.location.origin + '/';
    } else if (currentUrl.includes('/Teachers/')) {
      // Go up 1 level to get to the root  
      return window.location.origin + '/';
    } else {
      // Already at root level
      return window.location.origin + '/';
    }
  }

  // AI Word Generation
  async function generateWordsWithAI() {
    const prompt = aiPromptInput.value.trim();
    if (!prompt) {
      alert('Please enter a prompt for AI word generation');
      return;
    }

    try {
      // Show loading state
      const buttonText = generateWordsBtn.querySelector('.button-text');
      const loadingSpinner = generateWordsBtn.querySelector('.loading-spinner');
      buttonText.textContent = 'Generating...';
      loadingSpinner.classList.remove('hidden');
      generateWordsBtn.disabled = true;

      const baseUrl = getBaseUrl();
      const apiUrl = `${baseUrl}.netlify/functions/openai_proxy`;
      
      console.log('Calling OpenAI API at:', apiUrl);
      updateStatus('Connecting to OpenAI...');

      const response = await fetch(apiUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          endpoint: 'chat/completions',
          payload: {
            model: 'gpt-3.5-turbo',
            messages: [
              { role: 'system', content: 'You are a helpful ESL teaching assistant.' },
              { role: 'user', content: `Generate a list of English-Korean word pairs based on: "${prompt}". 
                       Format each pair as "english_word, korean_translation" on a new line. 
                       Only provide the word pairs, no extra text or numbering.
                       Example format:
                       apple, 사과
                       book, 책
                       cat, 고양이` }
            ],
            max_tokens: 1000
          }
        })
      });

      console.log('OpenAI response status:', response.status);

      if (!response.ok) {
        throw new Error(`OpenAI API failed with status: ${response.status}`);
      }

      const data = await response.json();
      console.log('OpenAI response data:', data);
      
      // Process the AI response to extract word pairs
      let generatedText = data.data?.choices?.[0]?.message?.content || '';
      
      if (!generatedText) {
        throw new Error('No content received from OpenAI');
      }
      
      updateStatus('✓ OpenAI response received, processing...');
      
      // Clean up the response - remove numbering and extra formatting
      generatedText = generatedText
        .split('\n')
        .map(line => line.trim())
        .filter(line => line && line.includes(','))
        .map(line => line.replace(/^\d+[.)\s]*/, '')) // Remove numbering
        .join('\n');

      // Append to existing content or replace if empty
      if (wordListTextarea.value.trim()) {
        wordListTextarea.value += '\n' + generatedText;
      } else {
        wordListTextarea.value = generatedText;
      }

      updateWordCount();
      updateStatus('✓ Words generated successfully!');
      
    } catch (error) {
      console.error('Error generating words:', error);
      updateStatus(`✗ OpenAI Error: ${error.message}`, true);
      alert(`Failed to generate words: ${error.message}\n\nPlease check:\n1. Your internet connection\n2. That you're running this from the correct URL\n3. The browser console for more details`);
    } finally {
      // Hide loading state
      const buttonText = generateWordsBtn.querySelector('.button-text');
      const loadingSpinner = generateWordsBtn.querySelector('.loading-spinner');
      buttonText.textContent = 'Generate Words with AI';
      loadingSpinner.classList.add('hidden');
      generateWordsBtn.disabled = false;
    }
  }

  // Update Pixabay API call to fetch 10 images and mix 5 illustrations and 5 photos
  async function fetchImagesFromPixabay(englishWord, koreanWord, retries = 2) {
    for (let attempt = 0; attempt <= retries; attempt++) {
      try {
        const searchWord = koreanWord || englishWord;
        console.log(`🔍 Searching Pixabay images for: "${searchWord}" (Korean: "${koreanWord}", English: "${englishWord}")`);

        const baseUrl = getBaseUrl();
        const photoApiUrl = `${baseUrl}.netlify/functions/pixabay?q=${encodeURIComponent(searchWord)}&image_type=photo&safesearch=true&per_page=5`;
        const illustrationApiUrl = `${baseUrl}.netlify/functions/pixabay?q=${encodeURIComponent(searchWord)}&image_type=illustration&safesearch=true&per_page=5`;

        console.log(`Pixabay Photo API URL: ${photoApiUrl}`);
        console.log(`Pixabay Illustration API URL: ${illustrationApiUrl}`);

        const [photoResponse, illustrationResponse] = await Promise.all([
          fetch(photoApiUrl),
          fetch(illustrationApiUrl)
        ]);

        if (!photoResponse.ok || !illustrationResponse.ok) {
          throw new Error(`Pixabay API failed with status: ${photoResponse.status} (photo), ${illustrationResponse.status} (illustration)`);
        }

        const photoData = await photoResponse.json();
        const illustrationData = await illustrationResponse.json();

        console.log(`Pixabay photo response for "${searchWord}":`, photoData);
        console.log(`Pixabay illustration response for "${searchWord}":`, illustrationData);

        const photoImages = photoData.images || [];
        const illustrationImages = illustrationData.images || [];

        const combinedImages = [...photoImages, ...illustrationImages];

        if (combinedImages.length > 0) {
          console.log(`✓ Found ${combinedImages.length} Pixabay images for "${searchWord}" (${photoImages.length} photos + ${illustrationImages.length} illustrations)`);
          return combinedImages; // Return the array of image URLs
        }
      } catch (error) {
        console.error(`Error fetching images from Pixabay (attempt ${attempt + 1}):`, error);
      }
    }

    console.warn(`No Pixabay images found for "${englishWord}" after ${retries + 1} attempts.`);
    return [];
  }

  // Combined function to fetch images from both OpenMoji and Pixabay
  async function fetchCombinedImages(englishWord, koreanWord) {
    console.log(`🎯 Fetching combined images for: "${englishWord}" / "${koreanWord}"`);
    
    let allImages = [];
    
    // 1. First, get OpenMoji images (local emoji-style images)
    const openMojiImages = findOpenMojiImages(englishWord, koreanWord);
    if (openMojiImages.length > 0) {
      allImages.push(...openMojiImages);
      console.log(`✓ Found ${openMojiImages.length} OpenMoji images`);
    }
    
    // 2. Then, get Pixabay images (photographic/illustration images)
    try {
      const pixabayImages = await fetchImagesFromPixabay(englishWord, koreanWord);
      if (pixabayImages.length > 0) {
        // Add all Pixabay images without filtering (they come from our secure endpoint)
        allImages.push(...pixabayImages);
        console.log(`✓ Found ${pixabayImages.length} Pixabay images`);
      }
    } catch (error) {
      console.warn('Pixabay search failed:', error);
    }

    // 3. Store and return the combined images
    if (allImages.length > 0) {
      // Store all images in cache for cycling functionality
      imageCache[englishWord] = allImages;
      currentImageIndex[englishWord] = 0;
      
      const totalImages = imageCache[englishWord].length;
      const openMojiCount = openMojiImages.length;
      const pixabayCount = allImages.length - openMojiCount;
      
      console.log(`🎨 Combined result: ${totalImages} total images (${openMojiCount} OpenMoji + ${pixabayCount} Pixabay)`);
      
      return imageCache[englishWord]; // Return the array of all images
    }
    
    console.log(`❌ No images found for "${englishWord}" / "${koreanWord}"`);
    return []; // Return empty array instead of null
  }

  // Debug: Test Pixabay connection
  async function testPixabayConnection() {
    console.log('Testing Pixabay connection...');
    try {
      const baseUrl = getBaseUrl();
      const apiUrl = `${baseUrl}.netlify/functions/pixabay?q=apple%20education&image_type=illustration&safesearch=true&per_page=3`;
      
      console.log('Testing Pixabay at:', apiUrl);
      updateStatus('Testing Pixabay connection with educational search...');
      
      const response = await fetch(apiUrl);
      console.log('Pixabay test response status:', response.status);
      
      if (!response.ok) {
        console.error('Pixabay test failed:', response.status, response.statusText);
        updateStatus(`✗ Pixabay test failed: HTTP ${response.status}`, true);
        return false;
      }
      
      const data = await response.json();
      console.log('Pixabay test data:', data);
      
      if (data.images && data.images.length > 0) {
        console.log('Pixabay connection successful! Sample educational images:', data.images);
        updateStatus(`✓ Pixabay working - found ${data.images.length} educational images`);
        return true;
      } else {
        console.log('Pixabay connected but no educational images returned');
        updateStatus('⚠ Pixabay connected but no educational images found');
        return false;
      }
    } catch (error) {
      console.error('Pixabay test error:', error);
      updateStatus(`✗ Pixabay connection failed: ${error.message}`, true);
      return false;
    }
  }

  // Generate flash cards
  async function generateFlashCards() {
    const words = parseWordList();
    
    if (words.length === 0) {
      alert('Please enter some word pairs first');
      return;
    }

    currentWords = words;
    const cardsPerPage = parseInt(cardsPerPageSelect.value);
    
    // Show loading state
    loadingState.classList.remove('hidden');
    flashCardPreview.innerHTML = '';
    generateCardsBtn.disabled = true;
    generateCardsBtn.textContent = 'Generating Cards...';
    
    try {
      console.log(`Starting to generate cards for ${words.length} words`);
      updateStatus(`Fetching images for ${words.length} words...`);
      
      // Fetch images for all words with progress tracking
      const imagePromises = words.map(async (word, index) => {
        console.log(`Fetching images ${index + 1}/${words.length} for: ${word.english} (Korean: ${word.korean})`);
        updateStatus(`Fetching images ${index + 1}/${words.length}: ${word.korean || word.english}`);
        const images = await fetchCombinedImages(word.english, word.korean); // Get combined OpenMoji + Pixabay images
        
        // Set the first image as the current display image
        const imageUrl = images.length > 0 ? images[0] : null;
        currentImages[word.english] = imageUrl;
        
        // Store all images for cycling functionality
        imageCache[word.english] = images;
        
        // Update status with success/failure
        if (images.length > 0) {
          console.log(`✓ ${images.length} images found for: ${word.english} (${images.filter(img => img.includes('openmoji')).length} OpenMoji + ${images.filter(img => !img.includes('openmoji')).length} Pixabay)`);
        } else {
          console.log(`✗ No images found for: ${word.english} using search term: ${word.korean || word.english}`);
        }
        
        return imageUrl;
      });
      
      const imageResults = await Promise.all(imagePromises);
      const successfulImages = imageResults.filter(url => url !== null).length;
      console.log(`Image fetching completed: ${successfulImages}/${words.length} images found`);
      updateStatus(`Images processed: ${successfulImages}/${words.length} found. Creating cards...`);
      
      // Generate pages
      const pages = [];
      for (let i = 0; i < words.length; i += cardsPerPage) {
        pages.push(words.slice(i, i + cardsPerPage));
      }
      
      console.log(`Creating ${pages.length} page(s) with ${cardsPerPage} cards per page`);
      
      // Create HTML for each page
      const pagesHtml = pages.map((pageWords, pageIndex) => {
        return createPageHtml(pageWords, cardsPerPage, pageIndex + 1);
      }).join('');
      
      flashCardPreview.innerHTML = pagesHtml;
      console.log('Cards generated successfully');
      updateStatus(`✓ Generated ${pages.length} page(s) with ${words.length} cards`);
      
    } catch (error) {
      console.error('Error generating flash cards:', error);
      updateStatus(`✗ Error: ${error.message}`, true);
      alert(`Failed to generate flash cards: ${error.message}\n\nPlease try again.`);
    } finally {
      loadingState.classList.add('hidden');
      generateCardsBtn.disabled = false;
      generateCardsBtn.textContent = 'Generate Flash Cards';
    }
  }

  // Create HTML for a single page
  function createPageHtml(words, cardsPerPage, pageNumber) {
    const showKorean = false; // Korean translation disabled for print and PDF
    const fontSize = 'large'; // Default font size

    let gridClass, cardClass;
    switch (cardsPerPage) {
      case 2:
        gridClass = 'cards-grid-2';
        cardClass = 'flashcard-grid-2';
        break;
      case 4:
        gridClass = 'cards-grid-4';
        cardClass = 'flashcard-grid-4';
        break;
      case 8:
        gridClass = 'cards-grid-8';
        cardClass = 'flashcard-grid-8';
        break;
      default:
        gridClass = 'cards-grid-4';
        cardClass = 'flashcard-grid-4';
    }

    const cardsHtml = words.map(word => {
      const imageUrl = currentImages[word.english];
      const englishStyle = getFontSizeStyle(fontSize, 'english', cardsPerPage);

      return `
        <div class="flashcard ${cardClass}">
          <div class="flashcard-image" style="position: relative;">
            ${imageUrl 
              ? `<img src="${imageUrl}" alt="${word.english}" 
                     style="max-width: 100%; max-height: 100%; object-fit: contain;">`
              : `<div class="text-gray-400 text-4xl">📷</div>`
            }
          </div>
          <div class="flashcard-text">
            <div class="flashcard-english" style="${englishStyle}">${word.english}</div>
          </div>
        </div>
      `;
    }).join('');

    // Fill empty spaces if needed
    const emptyCards = Math.max(0, cardsPerPage - words.length);
    const emptyCardsHtml = Array(emptyCards).fill().map(() => `
      <div class="flashcard ${cardClass}" style="border: 2px dashed #e5e7eb;">
        <div class="flashcard-image"></div>
        <div class="flashcard-text"></div>
      </div>
    `).join('');

    return `
      <div class="page-container">
        <div class="${gridClass}">
          ${cardsHtml}
          ${emptyCardsHtml}
        </div>
      </div>
    `;
  }

  // Get font size styles based on settings
  function getFontSizeStyle(fontSize, type, cardsPerPage) {
    let baseSize;
    
    if (type === 'english') {
      switch (cardsPerPage) {
        case 8: baseSize = { small: 12, medium: 14, large: 16 }; break;
        case 4: baseSize = { small: 16, medium: 18, large: 20 }; break;
        case 2: baseSize = { small: 20, medium: 24, large: 28 }; break;
        default: baseSize = { small: 16, medium: 18, large: 20 };
      }
    } else {
      switch (cardsPerPage) {
        case 8: baseSize = { small: 10, medium: 11, large: 12 }; break;
        case 4: baseSize = { small: 12, medium: 14, large: 16 }; break;
        case 2: baseSize = { small: 16, medium: 18, large: 20 }; break;
        default: baseSize = { small: 12, medium: 14, large: 16 };
      }
    }
    
    return `font-size: ${baseSize[fontSize]}px;`;
  }

  // Print functionality
  function adjustPreviewForPrint() {
    const previewContainer = document.getElementById('previewContainer');
    const printContainer = previewContainer.cloneNode(true);
    printContainer.style.width = '100%';
    printContainer.style.height = 'auto';
    printContainer.style.margin = '0';
    printContainer.style.padding = '0';
    printContainer.style.display = 'grid';
    printContainer.style.gridTemplateColumns = 'repeat(auto-fit, minmax(200px, 1fr))';
    printContainer.style.gap = '10px';

    document.body.appendChild(printContainer);

    setTimeout(() => {
      window.print();
      document.body.removeChild(printContainer);
    }, 500);
  }

  async function printCards() {
    if (currentWords.length === 0) {
      alert('Please generate flash cards first');
      return;
    }

    try {
      const originalText = printBtn.textContent;
      printBtn.disabled = true;
      printBtn.textContent = 'Preparing to print...';

      await waitForImagesToLoad();

      printBtn.textContent = 'Opening print dialog...';

      adjustPreviewForPrint();

      setTimeout(() => {
        printBtn.disabled = false;
        printBtn.textContent = originalText;
      }, 1000);
    } catch (error) {
      console.error('Error preparing to print:', error);
      printBtn.disabled = false;
      printBtn.textContent = 'Print Cards';
    }
  }

  // Wait for all images to load
  function waitForImagesToLoad() {
    return new Promise((resolve) => {
      const images = document.querySelectorAll('.flashcard-image img');
      
      if (images.length === 0) {
        console.log('No images found, proceeding...');
        resolve();
        return;
      }
      
      let loadedCount = 0;
      let totalImages = images.length;
      
      console.log(`Waiting for ${totalImages} images to load...`);
      
      function imageLoaded() {
        loadedCount++;
        console.log(`Image ${loadedCount}/${totalImages} loaded`);
        
        if (loadedCount >= totalImages) {
          console.log('All images loaded, proceeding with PDF generation');
          resolve();
        }
      }
      
      images.forEach((img, index) => {
        if (img.complete) {
          console.log(`Image ${index + 1} already loaded`);
          imageLoaded();
        } else {
          img.addEventListener('load', imageLoaded);
          img.addEventListener('error', () => {
            console.log(`Image ${index + 1} failed to load, but counting as complete`);
            imageLoaded();
          });
        }
      });
      
      // Fallback timeout in case some images never trigger events
      setTimeout(() => {
        if (loadedCount < totalImages) {
          console.log(`Timeout reached, proceeding with ${loadedCount}/${totalImages} images loaded`);
          resolve();
        }
      }, 5000);
    });
  }

  // Download PDF functionality
  async function downloadPdf() {
    if (currentWords.length === 0) {
      alert('Please generate flash cards first');
      return;
    }

    // Show loading state for PDF button
    const originalText = downloadPdfBtn.textContent;
    downloadPdfBtn.disabled = true;
    downloadPdfBtn.textContent = 'Generating PDF...';

    try {
      console.log('Starting PDF generation...');
      
      // Wait for all images to load
      await waitForImagesToLoad();
      
      const { jsPDF } = window.jspdf;
      const pdf = new jsPDF({
        orientation: 'portrait',
        unit: 'mm',
        format: 'a4'
      });
      
      // Get all page containers
      const pages = document.querySelectorAll('.page-container');
      console.log('Found', pages.length, 'pages to convert to PDF');
      
      if (pages.length === 0) {
        throw new Error('No pages found to convert to PDF');
      }
      
      for (let i = 0; i < pages.length; i++) {
        downloadPdfBtn.textContent = `Processing page ${i + 1}/${pages.length}...`;
        
        if (i > 0) {
          pdf.addPage();
        }
        
        console.log(`Converting page ${i + 1}/${pages.length} to canvas...`);
        
        const canvas = await html2canvas(pages[i], {
          scale: 2,
          useCORS: true,
          allowTaint: true,
          backgroundColor: '#ffffff',
          width: pages[i].offsetWidth,
          height: pages[i].offsetHeight,
          logging: false,
          onclone: (clonedDoc) => {
            // Ensure images are visible in the cloned document
            const clonedImages = clonedDoc.querySelectorAll('.flashcard-image img');
            clonedImages.forEach(img => {
              img.style.display = 'block';
            });
          }
        });
        
        const imgData = canvas.toDataURL('image/png');
        const imgWidth = 210; // A4 width in mm
        const pageHeight = 297; // A4 height in mm
        const imgHeight = (canvas.height * imgWidth) / canvas.width;
        
        // Center the image if it's smaller than the page
        const yPosition = imgHeight < pageHeight ? (pageHeight - imgHeight) / 2 : 0;
        
        pdf.addImage(imgData, 'PNG', 0, yPosition, imgWidth, Math.min(imgHeight, pageHeight));
        console.log(`Successfully added page ${i + 1} to PDF`);
      }
      
      downloadPdfBtn.textContent = 'Saving PDF...';
      
      const filename = `flashcards_${currentWords.length}_words.pdf`;
      pdf.save(filename);
      console.log(`PDF saved successfully as: ${filename}`);
      
      // Show success message
      alert(`PDF generated successfully!\n\n${pages.length} page(s) with ${currentWords.length} word(s)\nSaved as: ${filename}`);
      
    } catch (error) {
      console.error('Error generating PDF:', error);
      alert(`Failed to generate PDF: ${error.message}\n\nPlease try again or check the browser console for more details.`);
    } finally {
      // Reset button state
      downloadPdfBtn.disabled = false;
      downloadPdfBtn.textContent = originalText;
    }
  }

  // Cycle to next image for a word
  function cycleImage(word) {
    if (!imageCache[word] || imageCache[word].length <= 1) {
      console.log(`No additional images available for "${word}"`);
      return currentImages[word];
    }
    
    // Move to next image
    currentImageIndex[word] = (currentImageIndex[word] + 1) % imageCache[word].length;
    const newImage = imageCache[word][currentImageIndex[word]];
    
    // Update current images
    currentImages[word] = newImage;
    
    console.log(`Cycled to image ${currentImageIndex[word] + 1}/${imageCache[word].length} for "${word}"`);
    updateStatus(`Changed image for "${word}" (${currentImageIndex[word] + 1}/${imageCache[word].length} available)`);
    
    return newImage;
  }

  // Handle image click to cycle through alternatives
  document.addEventListener('click', function(event) {
    const target = event.target;
    
    // Check if an image inside flashcard is clicked
    if (target.tagName === 'IMG' && target.closest('.flashcard')) {
      const flashcard = target.closest('.flashcard');
      const englishWord = flashcard.querySelector('.flashcard-english').textContent.trim();
      
      console.log('Image clicked for word:', englishWord);
      
      // Cycle image for the clicked word
      const newImage = cycleImage(englishWord);
      
      // Update the image src in the DOM
      if (newImage) {
        target.src = newImage;
      }
    }
  });

  // Context menu creation
  document.addEventListener('contextmenu', function(event) {
    event.preventDefault();
    const target = event.target;
    if (target.tagName === 'IMG' && target.closest('.flashcard-image')) {
      const word = target.alt;
      createContextMenu(word, target);
    }
  });

  function createContextMenu(word, element) {
    const menu = document.createElement('div');
    menu.className = 'context-menu';
    menu.style.position = 'absolute';
    menu.style.top = `${event.clientY}px`;
    menu.style.left = `${event.clientX}px`;
    menu.style.background = '#fff';
    menu.style.border = '1px solid #ccc';
    menu.style.boxShadow = '0 2px 5px rgba(0,0,0,0.2)';
    menu.style.zIndex = '1000';

    const searchAgainOption = document.createElement('div');
    searchAgainOption.textContent = 'Search Again';
    searchAgainOption.style.padding = '8px';
    searchAgainOption.style.cursor = 'pointer';
    searchAgainOption.addEventListener('click', async () => {
      console.log(`Searching again for: ${word}`);
      const images = await fetchCombinedImages(word, '');
      if (images.length > 0) {
        currentImages[word] = images[0];
        imageCache[word] = images;
        element.src = images[0];
        console.log(`Updated image for ${word}`);
      }
      document.body.removeChild(menu);
    });

    const addKeywordOption = document.createElement('div');
    addKeywordOption.textContent = 'Add Keyword to Search';
    addKeywordOption.style.padding = '8px';
    addKeywordOption.style.cursor = 'pointer';
    addKeywordOption.addEventListener('click', () => {
      const keyword = prompt('Enter a keyword to refine the search:', '');
      if (keyword) {
        console.log(`Adding keyword to search for ${word}: ${keyword}`);
        const images = fetchCombinedImages(`${word} ${keyword}`, '');
        if (images.length > 0) {
          currentImages[word] = images[0];
          imageCache[word] = images;
          element.src = images[0];
          console.log(`Updated image for ${word} with keyword: ${keyword}`);
        }
      }
      document.body.removeChild(menu);
    });

    menu.appendChild(searchAgainOption);
    menu.appendChild(addKeywordOption);

    document.body.appendChild(menu);

    document.addEventListener('click', () => {
      if (menu.parentElement) {
        document.body.removeChild(menu);
      }
    }, { once: true });
  }

  // Global function to handle image changing (called from onclick)
  window.changeCardImage = function(word, element) {
    createContextMenu(word, element);
  };

  // Search for OpenMoji images based on word
  function findOpenMojiImages(englishWord, koreanWord) {
    const openmojiPath = '../../../Assets/Images/openmoji/';
    let foundImages = [];
    
    // Search by English word
    if (englishWord && openMojiMap[englishWord.toLowerCase()]) {
      foundImages = openMojiMap[englishWord.toLowerCase()].map(filename => openmojiPath + filename);
    }
    
    // Search by Korean word if no English match
    if (foundImages.length === 0 && koreanWord && openMojiMap[koreanWord]) {
      foundImages = openMojiMap[koreanWord].map(filename => openmojiPath + filename);
    }
    
    // Search for partial matches in the word
    if (foundImages.length === 0) {
      const searchTerms = [englishWord, koreanWord].filter(Boolean);
      for (const term of searchTerms) {
        if (!term) continue;
        const lowerTerm = term.toLowerCase();
        for (const [key, files] of Object.entries(openMojiMap)) {
          if (key.includes(lowerTerm) || lowerTerm.includes(key)) {
            foundImages = files.map(filename => openmojiPath + filename);
            break;
          }
        }
        if (foundImages.length > 0) break;
      }
    }
    
    console.log(`🎨 OpenMoji search for "${englishWord}" / "${koreanWord}": found ${foundImages.length} images`);
    return foundImages;
  }
  
  // Event Listeners
  wordListTextarea.addEventListener('input', updateWordCount);
  generateWordsBtn.addEventListener('click', generateWordsWithAI);
  generateCardsBtn.addEventListener('click', generateFlashCards);
  printBtn.addEventListener('click', printCards);
  downloadPdfBtn.addEventListener('click', downloadPdf);
  
  // Settings change listeners
  fontSizeSelect.addEventListener('change', () => {
    if (currentWords.length > 0) {
      generateFlashCards();
    }
  });
  
  showKoreanCheckbox.addEventListener('change', () => {
    if (currentWords.length > 0) {
      generateFlashCards();
    }
  });

  // Initialize
  console.log('Flash Card Maker initialized');
  console.log('Current URL:', window.location.href);
  console.log('Base URL for API calls:', getBaseUrl());
  console.log('Origin:', window.location.origin);
  console.log('Pathname:', window.location.pathname);
  
  // Set default values for UI elements
  fontSizeSelect.value = 'large';
  showKoreanCheckbox.checked = false;
  imageQualitySelect.value = 'standard';

  updateWordCount();
  updateStatus(`Initialized. Base URL: ${getBaseUrl()}`);
  
  // Test Pixabay connection on page load
  setTimeout(() => {
    testPixabayConnection();
  }, 1000);
  testPixabayConnection();
});
