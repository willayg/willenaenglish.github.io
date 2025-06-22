import { getPixabayImage } from './images.js';

export function maskWordPairs(wordPairs, testMode) {
  if (testMode === "none") return wordPairs;
  return wordPairs.map(pair => {
    if (testMode === "hide-eng") {
      return { ...pair, eng: "" };
    } else if (testMode === "hide-kor") {
      return { ...pair, kor: "" };
    } else if (testMode === "random") {
      if (Math.random() < 0.5) return { ...pair, eng: "" };
      else return { ...pair, kor: "" };
    }
    return pair;
  });
}

export async function buildWordTableWithPixabay(wordPairs) {
  const images = await Promise.all(wordPairs.map(pair => getPixabayImage(pair.eng)));
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
        ${wordPairs.map((pair, i) => `
          <tr>
            <td>${images[i] && images[i].startsWith('http') 
              ? `<img src="${images[i]}" style="width:40px;height:40px;object-fit:cover;cursor:pointer;" class="pixabay-refresh-img" data-word="${pair.eng}">`
              : (images[i] ? `<span style="font-size:2em;">${images[i]}</span>` : '')}</td>
            <td class="toggle-word" data-index="${i}" data-lang="eng">${pair.eng}</td>
            <td class="toggle-word" data-index="${i}" data-lang="kor">${pair.kor}</td>
          </tr>
        `).join('')}
      </tbody>
    </table>
  `;
}