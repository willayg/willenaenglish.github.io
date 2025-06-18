document.addEventListener('DOMContentLoaded', () => {
  const crosswordTab = document.getElementById('crosswordTab');
  const wordsearchTab = document.getElementById('wordsearchTab');
  const crosswordMaker = document.getElementById('crosswordMaker');
  const wordsearchMaker = document.getElementById('wordsearchMaker');

  if (crosswordTab && wordsearchTab && crosswordMaker && wordsearchMaker) {
    crosswordTab.addEventListener('click', () => {
      crosswordMaker.classList.remove('hidden');
      wordsearchMaker.classList.add('hidden');
      crosswordTab.classList.add('bg-[#d6d2e0]');
      wordsearchTab.classList.remove('bg-[#d6d2e0]');
    });
    wordsearchTab.addEventListener('click', () => {
      wordsearchMaker.classList.remove('hidden');
      crosswordMaker.classList.add('hidden');
      wordsearchTab.classList.add('bg-[#d6d2e0]');
      crosswordTab.classList.remove('bg-[#d6d2e0]');
    });
  }
});