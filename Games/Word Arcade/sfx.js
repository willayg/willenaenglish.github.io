// Simple SFX utility
export function playSFX(name) {
  const audioMap = {
    correct: 'assets/audio/right-answer.mp3',
    wrong: 'assets/audio/wrong-answer.mp3',
    wrong2: 'assets/audio/wrong-answer2.mp3',
    kindaRight: 'assets/audio/kinda-right-answer.mp3',
    end: 'assets/audio/game-end.mp3',
  };
  const src = audioMap[name];
  if (src) {
    const audio = new Audio(src);
    audio.volume = 0.7;
    audio.onerror = function() {
      console.error('SFX file not found or failed to play:', src);
    };
    audio.play().catch(err => {
      console.error('SFX play error:', err);
    });
  }
}
