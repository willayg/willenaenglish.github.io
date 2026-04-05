// Simple SFX utility
const WA_AUDIO_SOUND_KEY = 'wa.audio.sound.enabled';

function isSoundEnabled() {
  try {
    return localStorage.getItem(WA_AUDIO_SOUND_KEY) === '1';
  } catch {
    return false;
  }
}

export function playSFX(name) {
  if (!isSoundEnabled()) return;
  const audioMap = {
    correct: 'assets/audio/right-answer.mp3',
    wrong: 'assets/audio/wrong-answer.mp3',
    wrong2: 'assets/audio/wrong-answer2.mp3',
    kindaRight: 'assets/audio/kinda-right-answer.mp3',
    end: 'assets/audio/game-end.mp3',
    'begin-the-game': 'assets/audio/begin-the-game.mp3',
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
