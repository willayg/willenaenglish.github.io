import { getPixabayImage } from './images.js';

export function hideRandomLetters(word, numLettersToHide = 1) {
  if (!word || word.length < 2) return word;
  const letters = word.split('');
  const letterIndices = letters.map((c, i) => /[a-zA-Z]/.test(c) ? i : -1).filter(i => i > 0); // don't hide first letter
  if (letterIndices.length === 0) return word;

  numLettersToHide = Math.max(1, Math.min(numLettersToHide, word.length - 1));

  for (let i = 0; i < numLettersToHide && letterIndices.length > 0; i++) {
    const randomIndex = Math.floor(Math.random() * letterIndices.length);
    const idx = letterIndices.splice(randomIndex, 1)[0];
    letters[idx] = '_';
  }

  return letters.join('');
}

export function maskWordPairs(wordPairs, testMode, numLettersToHide = 1) {
  if (testMode === "none") return wordPairs;
  return wordPairs.map(pair => {
    if (testMode === "hide-eng") {
      return { ...pair, eng: "" };
    } else if (testMode === "hide-kor") {
      return { ...pair, kor: "" };
    } else if (testMode === "random") {
      if (Math.random() < 0.5) return { ...pair, eng: "" };
      else return { ...pair, kor: "" };
    } else if (testMode === "hide-random-letters") {
      // Hide multiple random letters in the English word only
      return { ...pair, eng: hideRandomLetters(pair.eng, numLettersToHide), kor: pair.kor };
    }
    return pair;
  });
}

export async function buildWordTableWithPixabay(originalPairs, maskedPairs, imageSize = 40) {
  const images = await Promise.all(
    originalPairs.map(pair => getPixabayImage(pair.eng))
  );

  return `
    <table>
      <thead>
        <tr>
          <th>Image</th>
          <th>English</th>
          <th>Korean</th>
        </tr>
      </thead>
      <tbody>
        ${maskedPairs.map((pair, i) => `
          <tr>
            <td>
              ${images[i] && images[i].startsWith('http')
                ? `<img src="${images[i]}" style="width:${imageSize}px;height:${imageSize}px;object-fit:cover;cursor:pointer;" class="pixabay-refresh-img" data-word="${originalPairs[i].eng}">`
                : (images[i] ? `<span style="font-size:2em;">${images[i]}</span>` : '')}
            </td>
            <td class="toggle-word" data-index="${i}" data-lang="eng">${pair.eng}</td>
            <td class="toggle-word" data-index="${i}" data-lang="kor">${pair.kor}</td>
          </tr>
        `).join('')}
      </tbody>
    </table>
  `;
}