export const imageCache = {}; // { word: { images: [...], index: 0 } }

export const emojiMap = {
  apple: "🍎",
  dog: "🐶",
  cat: "🐱",
  // ...add more as needed
};

export async function getPixabayImage(query, next = false) {
  if (!query) return "";
  const imageType = document.getElementById('pixabayImageType')?.value || "all";
  // Emoji mode
  if (imageType === "emoji") {
    return emojiMap[query?.toLowerCase()] || "❓";
  }
  if (!imageCache[query] || next) {
    const page = Math.floor(Math.random() * 5) + 1;
    const apiPath = window.WillenaAPI ? window.WillenaAPI.getApiUrl('/.netlify/functions/pixabay') : '/.netlify/functions/pixabay';
    const res = await fetch(`${apiPath}?q=${encodeURIComponent(query)}&image_type=${imageType}&safesearch=true&order=popular&per_page=5&page=${page}`);
    const data = await res.json();
    imageCache[query] = { images: data.images || [], index: 0 };
    // Optionally add emoji as last image
    if (emojiMap[query?.toLowerCase()]) {
      imageCache[query].images.push(emojiMap[query.toLowerCase()]);
    }
  }
  if (next && imageCache[query].images.length > 1) {
    imageCache[query].index = (imageCache[query].index + 1) % imageCache[query].images.length;
  }
  return imageCache[query].images[imageCache[query].index] || "";
}

export function clearImageCache() {
  Object.keys(imageCache).forEach(key => delete imageCache[key]);
}

// Legacy/compatibility: support getPixabayImage(word, forceRefresh) signature
// (forceRefresh = true triggers next image)
export async function getPixabayImageCompat(word, forceRefresh = false) {
  return await getPixabayImage(word, forceRefresh);
}
