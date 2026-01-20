const fs = require('fs');

// Fix imperatives
const imperatives = [
  { id: "imperatives_suggestions_1", word: "lets_play_soccer", en: "Let's play soccer!", ko: "축구하자!", exampleSentence: "Let's play soccer after school.", exampleSentenceKo: "축구하자!", emoji: "⚽", target: "Let's play", detractors: ["You play", "He plays", "Playing"] },
  { id: "imperatives_suggestions_2", word: "please_sit_down", en: "Please sit down.", ko: "앉아 주세요.", exampleSentence: "Please sit down in your seat.", exampleSentenceKo: "앉아 주세요.", emoji: "🪑", target: "sit", detractors: ["sits", "sat", "sitting"] },
  { id: "imperatives_suggestions_3", word: "dont_run", en: "Don't run!", ko: "뛰지 마세요!", exampleSentence: "Don't run in the hallway.", exampleSentenceKo: "뛰지 마세요!", emoji: "🚫🏃", target: "Don't run", detractors: ["Not running", "He runs", "You running"] },
  { id: "imperatives_suggestions_4", word: "help_your_friend", en: "Help your friend.", ko: "친구를 도와주세요.", exampleSentence: "Help your friend with the homework.", exampleSentenceKo: "친구를 도와주세요.", emoji: "🤝", target: "Help", detractors: ["Helps", "Helped", "Helping"] },
  { id: "imperatives_suggestions_5", word: "try_again", en: "Try again.", ko: "다시 해 보세요.", exampleSentence: "Try the puzzle again.", exampleSentenceKo: "다시 해 보세요.", emoji: "🧩", target: "Try", detractors: ["Tries", "Tried", "Trying"] },
  { id: "imperatives_suggestions_6", word: "be_quiet", en: "Be quiet.", ko: "조용히 하세요.", exampleSentence: "Be quiet in the library.", exampleSentenceKo: "조용히 하세요.", emoji: "🤫", target: "Be", detractors: ["Is", "Being", "Was"] },
  { id: "imperatives_suggestions_7", word: "dont_forget_rules", en: "Don't forget the rules.", ko: "규칙을 잊지 마세요.", exampleSentence: "Don't forget the rules of the game.", exampleSentenceKo: "규칙을 잊지 마세요.", emoji: "📏", target: "Don't forget", detractors: ["Not forgetting", "He forgets", "You forgot"] },
  { id: "imperatives_suggestions_8", word: "lets_go_home", en: "Let's go home.", ko: "집에 가자.", exampleSentence: "Let's go home now.", exampleSentenceKo: "집에 가자.", emoji: "🏠", target: "Let's go", detractors: ["You go", "He goes", "Going"] },
  { id: "imperatives_suggestions_9", word: "please_wash_hands", en: "Please wash your hands.", ko: "손을 씻어 주세요.", exampleSentence: "Please wash your hands before dinner.", exampleSentenceKo: "손을 씻어 주세요.", emoji: "🧼", target: "wash", detractors: ["washes", "washed", "washing"] },
  { id: "imperatives_suggestions_10", word: "dont_eat_in_library", en: "Don't eat in the library.", ko: "도서관에서 먹지 마세요.", exampleSentence: "Don't eat in the library to keep it clean.", exampleSentenceKo: "도서관에서 먹지 마세요.", emoji: "🚫🍽️", target: "Don't eat", detractors: ["Not eating", "He eats", "You ate"] },
  { id: "imperatives_suggestions_11", word: "come_here", en: "Come here.", ko: "여기로 오세요.", exampleSentence: "Come here and show me your drawing.", exampleSentenceKo: "여기로 오세요.", emoji: "👉", target: "Come", detractors: ["Comes", "Came", "Coming"] },
  { id: "imperatives_suggestions_12", word: "wait_for_me", en: "Wait for me.", ko: "기다려 주세요.", exampleSentence: "Wait for me at the gate.", exampleSentenceKo: "기다려 주세요.", emoji: "⏳", target: "Wait", detractors: ["Waits", "Waited", "Waiting"] },
  { id: "imperatives_suggestions_13", word: "stop_that", en: "Stop that.", ko: "그만해.", exampleSentence: "Stop that or you will get hurt.", exampleSentenceKo: "그만해.", emoji: "✋", target: "Stop", detractors: ["Stops", "Stopped", "Stopping"] },
  { id: "imperatives_suggestions_14", word: "take_a_break", en: "Take a break.", ko: "잠깐 쉬세요.", exampleSentence: "Take a break during your study.", exampleSentenceKo: "잠깐 쉬세요.", emoji: "🛌", target: "Take", detractors: ["Takes", "Took", "Taking"] },
  { id: "imperatives_suggestions_15", word: "read_this_aloud", en: "Read this aloud.", ko: "이거 큰 소리로 읽어 보세요.", exampleSentence: "Read this aloud for practice.", exampleSentenceKo: "이거 큰 소리로 읽어 보세요.", emoji: "📣", target: "Read", detractors: ["Reads", "Reading", "Readed"] }
];
fs.writeFileSync('Games/english_arcade/data/grammar/level3/imperatives_suggestions.json', JSON.stringify(imperatives, null, 2));
console.log('Imperatives updated');

// Fix adjectives_people - use different adjectives as distractors
const adjPeople = [
  { id: "adjectives_people_1", word: "friendly", en: "She is very friendly.", ko: "그녀는 매우 친절해요.", exampleSentence: "She is very friendly to everyone she meets.", exampleSentenceKo: "그녀는 매우 친절해요.", base: "friendly", detractors: ["helpful", "kind", "shy"], emoji: "😊" },
  { id: "adjectives_people_2", word: "smart", en: "He is smart and quick.", ko: "그는 똑똑하고 빨라요.", exampleSentence: "He is smart and quick at solving puzzles.", exampleSentenceKo: "그는 똑똑하고 빨라요.", base: "smart", detractors: ["clever", "bright", "slow"], emoji: "🧠" },
  { id: "adjectives_people_3", word: "funny", en: "My friend is very funny.", ko: "내 친구는 매우 재미있어요.", exampleSentence: "My friend is very funny and makes everyone laugh.", exampleSentenceKo: "내 친구는 매우 재미있어요.", base: "funny", detractors: ["serious", "boring", "silly"], emoji: "😂" },
  { id: "adjectives_people_4", word: "tall", en: "She is taller than her sister.", ko: "그녀는 언니보다 키가 커요.", exampleSentence: "She is taller than her sister by ten centimeters.", exampleSentenceKo: "그녀는 언니보다 키가 커요.", base: "taller", detractors: ["shorter", "smaller", "bigger"], emoji: "📏" },
  { id: "adjectives_people_5", word: "kind", en: "He is kind to everyone.", ko: "그는 모두에게 친절해요.", exampleSentence: "He is kind to everyone at school.", exampleSentenceKo: "그는 모두에게 친절해요.", base: "kind", detractors: ["friendly", "nice", "mean"], emoji: "💖" },
  { id: "adjectives_people_6", word: "shy", en: "He feels shy in new places.", ko: "그는 새로운 곳에서 수줍어해요.", exampleSentence: "He feels shy in new places but opens up later.", exampleSentenceKo: "그는 새로운 곳에서 수줍어해요.", base: "shy", detractors: ["brave", "quiet", "nervous"], emoji: "😳" },
  { id: "adjectives_people_7", word: "brave", en: "The firefighter is brave.", ko: "그 소방관은 용감해요.", exampleSentence: "The firefighter is brave and saves many lives.", exampleSentenceKo: "그 소방관은 용감해요.", base: "brave", detractors: ["strong", "scared", "careful"], emoji: "🦸" },
  { id: "adjectives_people_8", word: "polite", en: "She is polite at school.", ko: "그녀는 학교에서 예의 바라요.", exampleSentence: "She is polite at school and respects her teachers.", exampleSentenceKo: "그녀는 학교에서 예의 바라요.", base: "polite", detractors: ["rude", "nice", "quiet"], emoji: "🙏" },
  { id: "adjectives_people_9", word: "rude", en: "The man was rude to the clerk.", ko: "그 남자는 점원에게 무례했어요.", exampleSentence: "The man was rude to the clerk at the store.", exampleSentenceKo: "그 남자는 점원에게 무례했어요.", base: "rude", detractors: ["polite", "mean", "angry"], emoji: "😤" }
];
fs.writeFileSync('Games/english_arcade/data/grammar/level3/adjectives_people.json', JSON.stringify(adjPeople, null, 2));
console.log('Adjectives people updated');

// Fix adjectives_world - use different adjectives as distractors 
const adjWorld = [
  { id: "adjectives_world_1", word: "beautiful", en: "This city is beautiful.", ko: "이 도시는 아름다워요.", exampleSentence: "This city is beautiful at night with all the lights.", exampleSentenceKo: "이 도시는 아름다워요.", base: "beautiful", detractors: ["pretty", "lovely", "ugly"], emoji: "🌆" },
  { id: "adjectives_world_2", word: "noisy", en: "The street is noisy at night.", ko: "그 거리는 밤에 시끄러워요.", exampleSentence: "The street is noisy at night with cars and people.", exampleSentenceKo: "그 거리는 밤에 시끄러워요.", base: "noisy", detractors: ["quiet", "loud", "busy"], emoji: "🔊" },
  { id: "adjectives_world_3", word: "quiet", en: "The library is quiet.", ko: "도서관은 조용해요.", exampleSentence: "The library is quiet and perfect for studying.", exampleSentenceKo: "도서관은 조용해요.", base: "quiet", detractors: ["noisy", "silent", "calm"], emoji: "🤫" },
  { id: "adjectives_world_4", word: "clean", en: "The kitchen is clean.", ko: "부엌은 깨끗해요.", exampleSentence: "The kitchen is clean after we washed everything.", exampleSentenceKo: "부엌은 깨끗해요.", base: "clean", detractors: ["dirty", "tidy", "messy"], emoji: "🧼" },
  { id: "adjectives_world_5", word: "dirty", en: "The room is dirty.", ko: "그 방은 더러워요.", exampleSentence: "The room is dirty and needs to be cleaned.", exampleSentenceKo: "그 방은 더러워요.", base: "dirty", detractors: ["clean", "messy", "dusty"], emoji: "🗑️" },
  { id: "adjectives_world_6", word: "crowded", en: "The market is crowded on weekends.", ko: "시장은 주말에 붐벼요.", exampleSentence: "The market is crowded on weekends with many shoppers.", exampleSentenceKo: "시장은 주말에 붐벼요.", base: "crowded", detractors: ["empty", "busy", "packed"], emoji: "🛍️" },
  { id: "adjectives_world_7", word: "spacious", en: "The hall is very spacious.", ko: "그 홀은 매우 넓어요.", exampleSentence: "The hall is very spacious for big events.", exampleSentenceKo: "그 홀은 매우 넓어요.", base: "spacious", detractors: ["cramped", "large", "tiny"], emoji: "🏟️" },
  { id: "adjectives_world_8", word: "modern", en: "The museum looks modern.", ko: "그 박물관은 현대적으로 보여요.", exampleSentence: "The museum looks modern with its glass walls.", exampleSentenceKo: "그 박물관은 현대적으로 보여요.", base: "modern", detractors: ["old", "new", "ancient"], emoji: "🏛️" },
  { id: "adjectives_world_9", word: "ancient", en: "The temple is ancient.", ko: "그 사원은 오래됐어요.", exampleSentence: "The temple is ancient and over 1000 years old.", exampleSentenceKo: "그 사원은 오래됐어요.", base: "ancient", detractors: ["modern", "old", "historic"], emoji: "🕍" }
];
fs.writeFileSync('Games/english_arcade/data/grammar/level3/adjectives_world.json', JSON.stringify(adjWorld, null, 2));
console.log('Adjectives world updated');

// Update a_few_vs_a_little with "a lot of" options
const aFewVsALittle = JSON.parse(fs.readFileSync('Games/english_arcade/data/grammar/level3/a_few_vs_a_little.json', 'utf8'));

// Add "a lot of" to all existing detractors
aFewVsALittle.forEach(item => {
  if (item.detractors && !item.detractors.includes('a lot of')) {
    item.detractors.push('a lot of');
  }
});

// Add new sentences with "a lot of"
const aLotOfSentences = [
  { id: "a_few_vs_a_little_16", word: "a_lot_of_friends", en: "She has a lot of friends.", ko: "그녀는 친구가 많아요.", exampleSentence: "She has a lot of friends at school.", exampleSentenceKo: "그녀는 친구가 많아요.", target: "a lot of", detractors: ["a few", "a little", "few"], emoji: "👫" },
  { id: "a_few_vs_a_little_17", word: "a_lot_of_water", en: "We drank a lot of water.", ko: "우리는 물을 많이 마셨어요.", exampleSentence: "We drank a lot of water after playing sports.", exampleSentenceKo: "우리는 물을 많이 마셨어요.", target: "a lot of", detractors: ["a little", "a few", "some"], emoji: "💧" },
  { id: "a_few_vs_a_little_18", word: "a_lot_of_books", en: "The library has a lot of books.", ko: "도서관에는 책이 많아요.", exampleSentence: "The library has a lot of books to read.", exampleSentenceKo: "도서관에는 책이 많아요.", target: "a lot of", detractors: ["a few", "a little", "many"], emoji: "📚" },
  { id: "a_few_vs_a_little_19", word: "a_lot_of_money", en: "He saved a lot of money.", ko: "그는 돈을 많이 저축했어요.", exampleSentence: "He saved a lot of money for his trip.", exampleSentenceKo: "그는 돈을 많이 저축했어요.", target: "a lot of", detractors: ["a little", "a few", "some"], emoji: "💰" },
  { id: "a_few_vs_a_little_20", word: "a_lot_of_homework", en: "We have a lot of homework.", ko: "우리는 숙제가 많아요.", exampleSentence: "We have a lot of homework to finish today.", exampleSentenceKo: "우리는 숙제가 많아요.", target: "a lot of", detractors: ["a little", "a few", "some"], emoji: "📝" }
];

fs.writeFileSync('Games/english_arcade/data/grammar/level3/a_few_vs_a_little.json', JSON.stringify([...aFewVsALittle, ...aLotOfSentences], null, 2));
console.log('a_few_vs_a_little updated with a lot of');

console.log('All JSON files updated successfully!');
