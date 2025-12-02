const conditionalSentences = [
  // First conditionals
  { original: "If it rains, I will stay home.", chunks: ["If it", "rains,", "I will", "stay home."] },
  { original: "If you study hard, you will pass the exam.", chunks: ["If you", "study hard,", "you will", "pass the exam."] },
  { original: "If she calls, I will answer.", chunks: ["If she", "calls,", "I will", "answer."] },
  { original: "If they invite us, we will go.", chunks: ["If they", "invite us,", "we will", "go."] },
  { original: "If he finishes early, he will help us.", chunks: ["If he", "finishes early,", "he will", "help us."] },
  { original: "If you eat too much, you will feel sick.", chunks: ["If you", "eat too much,", "you will", "feel sick."] },
  { original: "If I see her, I will tell her the news.", chunks: ["If I", "see her,", "I will", "tell her the news."] },
  { original: "If we leave now, we will arrive on time.", chunks: ["If we", "leave now,", "we will", "arrive on time."] },
  { original: "If it snows, we will build a snowman.", chunks: ["If it", "snows,", "we will", "build a snowman."] },
  { original: "If you don't hurry, you will miss the bus.", chunks: ["If you", "don't hurry,", "you will", "miss the bus."] },
  { original: "If you touch fire, you will get burned.", chunks: ["If you", "touch fire,", "you will", "get burned."] },
  { original: "If I am late, start without me.", chunks: ["If I", "am late,", "start", "without me."] },
  { original: "If you need help, ask your teacher.", chunks: ["If you", "need help,", "ask", "your teacher."] },
  { original: "If the sun shines, we will go to the park.", chunks: ["If the sun", "shines,", "we will", "go to the park."] },
  { original: "If you are tired, take a rest.", chunks: ["If you", "are tired,", "take", "a rest."] },
  { original: "If you finish your homework, you can play games.", chunks: ["If you", "finish your homework,", "you can", "play games."] },
  { original: "If the phone rings, answer it.", chunks: ["If the phone", "rings,", "answer", "it."] },
  { original: "If you see Tom, say hello.", chunks: ["If you", "see Tom,", "say", "hello."] },
  { original: "If you are hungry, eat something.", chunks: ["If you", "are hungry,", "eat", "something."] },
  { original: "If you don't understand, ask a question.", chunks: ["If you", "don't understand,", "ask", "a question."] },

  // Second conditionals
  { original: "If I could do anything, I would go to the moon.", chunks: ["If I", "could do anything,", "I would", "go to the moon."] },
  { original: "If I had a million dollars, I would travel the world.", chunks: ["If I", "had a million dollars,", "I would", "travel the world."] },
  { original: "If she were here, she would help us.", chunks: ["If she", "were here,", "she would", "help us."] },
  { original: "If I were you, I would study more.", chunks: ["If I", "were you,", "I would", "study more."] },
  { original: "If we lived by the sea, we would swim every day.", chunks: ["If we", "lived by the sea,", "we would", "swim every day."] },
  { original: "If he knew the answer, he would tell us.", chunks: ["If he", "knew the answer,", "he would", "tell us."] },
  { original: "If I could fly, I would visit every country.", chunks: ["If I", "could fly,", "I would", "visit every country."] },
  { original: "If you could meet anyone, who would you meet?", chunks: ["If you", "could meet anyone,", "who would", "you meet?"] },
  { original: "If I had more time, I would learn another language.", chunks: ["If I", "had more time,", "I would", "learn another language."] },
  { original: "If it were sunny, we would have a picnic.", chunks: ["If it", "were sunny,", "we would", "have a picnic."] },

  // Wish sentences
  { original: "I wish I could go to the party.", chunks: ["I wish", "I could", "go to", "the party."] },
  { original: "She wishes she could play outside.", chunks: ["She wishes", "she could", "play", "outside."] },
  { original: "He wishes he could speak Spanish.", chunks: ["He wishes", "he could", "speak", "Spanish."] },
  { original: "They wish they could travel more.", chunks: ["They wish", "they could", "travel", "more."] },
  { original: "We wish we could see the stars.", chunks: ["We wish", "we could", "see", "the stars."] },
  { original: "I wish I could eat ice cream every day.", chunks: ["I wish", "I could", "eat ice cream", "every day."] },
  { original: "She wishes she could visit Paris.", chunks: ["She wishes", "she could", "visit", "Paris."] },
  { original: "He wishes he could play the guitar.", chunks: ["He wishes", "he could", "play", "the guitar."] },
  { original: "I wish I could have a pet dog.", chunks: ["I wish", "I could", "have", "a pet dog."] },
  { original: "They wish they could win the game.", chunks: ["They wish", "they could", "win", "the game."] },

  // If you could... questions
  { original: "If you could go anywhere, where would you go?", chunks: ["If you", "could go anywhere,", "where would", "you go?"] },
  { original: "If you could do anything, what would you do?", chunks: ["If you", "could do anything,", "what would", "you do?"] },
  { original: "If you could have any pet, what would you choose?", chunks: ["If you", "could have any pet,", "what would", "you choose?"] },
  { original: "If you could eat only one food, what would it be?", chunks: ["If you", "could eat only one food,", "what would", "it be?"] },
  { original: "If you could meet a famous person, who would it be?", chunks: ["If you", "could meet a famous person,", "who would", "it be?"] },
  { original: "If you could live anywhere, where would you live?", chunks: ["If you", "could live anywhere,", "where would", "you live?"] },
  { original: "If you could be any animal, what would you be?", chunks: ["If you", "could be any animal,", "what would", "you be?"] },
  { original: "If you could have any superpower, what would it be?", chunks: ["If you", "could have any superpower,", "what would", "it be?"] },
  { original: "If you could change one thing, what would you change?", chunks: ["If you", "could change one thing,", "what would", "you change?"] },
  { original: "If you could travel in time, where would you go?", chunks: ["If you", "could travel in time,", "where would", "you go?"] }
];

export default conditionalSentences;