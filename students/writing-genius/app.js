// Writing Genius: flexible writing. Student-owned drafts, teacher-visible submissions.
// Reuses the existing auth gateway, student header, Word Genius theme and visual tokens.
import {studentIdentity,signedInProfile} from '/students/sentence-genius/content.js?v=20261024-wg-auth1';
import {createDiaryFlow} from './diary-flow.js?v=20261114-kind-filter1';
import {QuestionRenderer} from '/shared/questions/question-renderer.js?v=20261023-speaking-ai1';
import {createSentencePractice} from './sentence-practice.js?v=20261104-unit-tab-label1';
const API_BASE='https://fiieuiktlsivwfgyivai.supabase.co/rest/v1/';
const KEY='sb_publishable_e-K50PquV9gHdfmefG6tmg_o-vVSl0e';
const NAV='willenaWritingGeniusNav';
function requestDeadline(promise,ms=15000){
 return new Promise((resolve,reject)=>{
  const timer=setTimeout(()=>reject(new Error('서버 응답 시간이 너무 길어요. 다시 시도해 주세요.')),ms);
  Promise.resolve(promise).then(
   value=>{clearTimeout(timer);resolve(value)},
   error=>{clearTimeout(timer);reject(error)}
  );
 });
}
const $=id=>document.getElementById(id);
const modeNames={sentence:'문장 쓰기',diary:'오늘의 일기',topic:'주제 글쓰기'};
const prompts={
  sentence:[
    {key:'free',title:'자유롭게 쓰기',help:'무엇이든 자유롭게 영어 문장을 써 보세요. / Write anything you like.',starters:['I like…','I can…','I want to…','My favorite…']},
    {key:'my-day',title:'나의 하루',help:'오늘 한 일을 한두 문장으로 말해 볼까요?',starters:['Today I…','I went to…','I played…']},
    {key:'my-friend',title:'나의 친구',help:'친구를 소개해 보세요. / Tell us about a friend.',starters:['My friend is…','We like to…','My friend can…']},
    {key:'my-school',title:'학교 이야기',help:'학교나 영어 학원에서 있었던 일을 써 보세요.',starters:['At school, I…','My teacher…','I learned…']}
  ],
  diary:[
    {key:'today',title:'오늘 있었던 일',help:'무슨 일이 있었나요? 어떤 기분이었나요? / What happened today?',starters:['Today I…','I felt…','After school, I…','My favorite part was…']},
    {key:'happy',title:'오늘 좋았던 일',help:'오늘 기분 좋았던 일을 적어 보세요.',starters:['I was happy because…','Today was…','I enjoyed…']},
    {key:'new',title:'오늘 배운 것',help:'오늘 새로 배운 것이나 시도한 것은 무엇인가요?',starters:['Today I learned…','I tried…','It was…']}
  ],
  topic:[
    {key:'favourite-food',title:'My Favorite Food',help:'What is your favorite food? What does it taste like? Why do you like it?',starters:['My favorite food is…','It tastes…','I like it because…','First,…']},
    {key:'dream-pet',title:'My Dream Pet',help:'What animal would you like? What would you do together?',starters:['I want to have…','It would…','We could…']},
    {key:'best-day',title:'The Best Day',help:'Describe a great day. Where would you go? Who would come?',starters:['My best day would…','I would go…','We would…','Finally,…']},
    {key:'hero',title:'A Person I Admire',help:'Who do you admire? What makes this person special?',starters:['I admire…','This person is…','I admire them because…']},
    {key:'my-town',title:'My Town',help:'What is your town like? Where do you like to go?',starters:['I live in…','There is…','My favorite place is…']},
    {key:'own',title:'My Own Topic',help:'Choose any topic. Think of a beginning, details, and an ending.',starters:['I think…','First,…','Also,…','In the end,…']}
  ]
};
/* Original textbook-aligned topic prompts. Keep user-defined topics unrestricted. */
prompts.topic.push(...[
  {
    "key": "buzz6-u1-w1",
    "title": "A Day in the City",
    "help": "Describe a trip through a city. Say where you went, what you saw, and whether you have visited before.",
    "starters": []
  },
  {
    "key": "buzz6-u1-w2",
    "title": "My Favorite City",
    "help": "Write about \"My Favorite City\" using vocabulary from Unit 1. Include examples of present perfect: for, since, ever, never.",
    "starters": []
  },
  {
    "key": "buzz6-u1-w3",
    "title": "A Train Journey",
    "help": "Write about \"A Train Journey\" using vocabulary from Unit 1. Include examples of present perfect: for, since, ever, never.",
    "starters": []
  },
  {
    "key": "buzz6-u2-w1",
    "title": "A Weather Forecast",
    "help": "Describe the weather today and predict what will happen tomorrow.",
    "starters": []
  },
  {
    "key": "buzz6-u2-w2",
    "title": "My Favorite Season",
    "help": "Write about \"My Favorite Season\" using vocabulary from Unit 2. Include examples of going to and will.",
    "starters": []
  },
  {
    "key": "buzz6-u2-w3",
    "title": "A Snowy Weekend",
    "help": "Write about \"A Snowy Weekend\" using vocabulary from Unit 2. Include examples of going to and will.",
    "starters": []
  },
  {
    "key": "buzz6-u3-w1",
    "title": "Our Green School",
    "help": "Explain things your class has already done to help the environment and what you have not done yet.",
    "starters": []
  },
  {
    "key": "buzz6-u3-w2",
    "title": "An Environment Challenge",
    "help": "Write about \"An Environment Challenge\" using vocabulary from Unit 3. Include examples of present perfect: already, just, yet.",
    "starters": []
  },
  {
    "key": "buzz6-u3-w3",
    "title": "A Recycling Idea",
    "help": "Write about \"A Recycling Idea\" using vocabulary from Unit 3. Include examples of present perfect: already, just, yet.",
    "starters": []
  },
  {
    "key": "buzz6-u4-w1",
    "title": "The Surprise Performance",
    "help": "Tell a short story about something unexpected happening during a play.",
    "starters": []
  },
  {
    "key": "buzz6-u4-w2",
    "title": "Behind the Curtain",
    "help": "Write about \"Behind the Curtain\" using vocabulary from Unit 4. Include examples of past progressive + simple past.",
    "starters": []
  },
  {
    "key": "buzz6-u4-w3",
    "title": "The Day the Lights Went Out",
    "help": "Write about \"The Day the Lights Went Out\" using vocabulary from Unit 4. Include examples of past progressive + simple past.",
    "starters": []
  },
  {
    "key": "buzz6-u5-w1",
    "title": "A Food From Another Country",
    "help": "Explain how a favorite food is prepared or served.",
    "starters": []
  },
  {
    "key": "buzz6-u5-w2",
    "title": "A Special Restaurant",
    "help": "Write about \"A Special Restaurant\" using vocabulary from Unit 5. Include examples of simple present passive.",
    "starters": []
  },
  {
    "key": "buzz6-u5-w3",
    "title": "How We Make Lunch",
    "help": "Write about \"How We Make Lunch\" using vocabulary from Unit 5. Include examples of simple present passive.",
    "starters": []
  },
  {
    "key": "buzz6-u6-w1",
    "title": "My Technology Tips",
    "help": "Explain what happens when people use everyday apps and devices.",
    "starters": []
  },
  {
    "key": "buzz6-u6-w2",
    "title": "A Helpful App",
    "help": "Write about \"A Helpful App\" using vocabulary from Unit 6. Include examples of zero conditional.",
    "starters": []
  },
  {
    "key": "buzz6-u6-w3",
    "title": "A Day Without the Internet",
    "help": "Write about \"A Day Without the Internet\" using vocabulary from Unit 6. Include examples of zero conditional.",
    "starters": []
  },
  {
    "key": "buzz6-u7-w1",
    "title": "The Camping Trip",
    "help": "Write a plan for a camping trip and explain what you will do if something unexpected happens.",
    "starters": []
  },
  {
    "key": "buzz6-u7-w2",
    "title": "An Adventure on a Hill",
    "help": "Write about \"An Adventure on a Hill\" using vocabulary from Unit 7. Include examples of first conditional.",
    "starters": []
  },
  {
    "key": "buzz6-u7-w3",
    "title": "A Map to a Secret Place",
    "help": "Write about \"A Map to a Secret Place\" using vocabulary from Unit 7. Include examples of first conditional.",
    "starters": []
  },
  {
    "key": "buzz6-u8-w1",
    "title": "A Space Discovery",
    "help": "Imagine that you discover a strange object in space and decide what it might be.",
    "starters": []
  },
  {
    "key": "buzz6-u8-w2",
    "title": "Life on a Space Station",
    "help": "Write about \"Life on a Space Station\" using vocabulary from Unit 8. Include examples of modals of possibility/certainty.",
    "starters": []
  },
  {
    "key": "buzz6-u8-w3",
    "title": "My New Planet",
    "help": "Write about \"My New Planet\" using vocabulary from Unit 8. Include examples of modals of possibility/certainty.",
    "starters": []
  }
]);
/* Buzz 3 original textbook-aligned writing prompts */
prompts.topic.push(...[{"key":"buzz3-u1-w1","title":"My Morning Routine","help":"Write about my morning routine. Use simple sentences and vocabulary from Buzz 3 Unit 1. Practice simple present routines and time.","starters":[]},{"key":"buzz3-u1-w2","title":"A Busy School Day","help":"Write about a busy school day. Use simple sentences and vocabulary from Buzz 3 Unit 1. Practice simple present routines and time.","starters":[]},{"key":"buzz3-u1-w3","title":"My Family's Weekend","help":"Write about my family's weekend. Use simple sentences and vocabulary from Buzz 3 Unit 1. Practice simple present routines and time.","starters":[]},{"key":"buzz3-u2-w1","title":"Things I Can Do","help":"Write about things i can do. Use simple sentences and vocabulary from Buzz 3 Unit 2. Practice can/can't and like/don't like.","starters":[]},{"key":"buzz3-u2-w2","title":"My Favorite Hobby","help":"Write about my favorite hobby. Use simple sentences and vocabulary from Buzz 3 Unit 2. Practice can/can't and like/don't like.","starters":[]},{"key":"buzz3-u2-w3","title":"A Talent Show","help":"Write about a talent show. Use simple sentences and vocabulary from Buzz 3 Unit 2. Practice can/can't and like/don't like.","starters":[]},{"key":"buzz3-u3-w1","title":"My Dream Room","help":"Write about my dream room. Use simple sentences and vocabulary from Buzz 3 Unit 3. Practice there is/are and home prepositions.","starters":[]},{"key":"buzz3-u3-w2","title":"Our Kitchen","help":"Write about our kitchen. Use simple sentences and vocabulary from Buzz 3 Unit 3. Practice there is/are and home prepositions.","starters":[]},{"key":"buzz3-u3-w3","title":"A Beautiful Home","help":"Write about a beautiful home. Use simple sentences and vocabulary from Buzz 3 Unit 3. Practice there is/are and home prepositions.","starters":[]},{"key":"buzz3-u4-w1","title":"My Trip Yesterday","help":"Write about my trip yesterday. Use simple sentences and vocabulary from Buzz 3 Unit 4. Practice was/were and past experiences.","starters":[]},{"key":"buzz3-u4-w2","title":"A Day at the Water Park","help":"Write about a day at the water park. Use simple sentences and vocabulary from Buzz 3 Unit 4. Practice was/were and past experiences.","starters":[]},{"key":"buzz3-u4-w3","title":"My Favorite Place to Visit","help":"Write about my favorite place to visit. Use simple sentences and vocabulary from Buzz 3 Unit 4. Practice was/were and past experiences.","starters":[]},{"key":"buzz3-u5-w1","title":"My Best Friend","help":"Write about my best friend. Use simple sentences and vocabulary from Buzz 3 Unit 5. Practice have/has and descriptions.","starters":[]},{"key":"buzz3-u5-w2","title":"People in My Family","help":"Write about people in my family. Use simple sentences and vocabulary from Buzz 3 Unit 5. Practice have/has and descriptions.","starters":[]},{"key":"buzz3-u5-w3","title":"Our Class Team","help":"Write about our class team. Use simple sentences and vocabulary from Buzz 3 Unit 5. Practice have/has and descriptions.","starters":[]},{"key":"buzz3-u6-w1","title":"A Day in the City","help":"Write about a day in the city. Use simple sentences and vocabulary from Buzz 3 Unit 6. Practice present progressive.","starters":[]},{"key":"buzz3-u6-w2","title":"At the Museum","help":"Write about at the museum. Use simple sentences and vocabulary from Buzz 3 Unit 6. Practice present progressive.","starters":[]},{"key":"buzz3-u6-w3","title":"My Weekend Plans in Town","help":"Write about my weekend plans in town. Use simple sentences and vocabulary from Buzz 3 Unit 6. Practice present progressive.","starters":[]},{"key":"buzz3-u7-w1","title":"A Job I Want","help":"Write about a job i want. Use simple sentences and vocabulary from Buzz 3 Unit 7. Practice simple present questions and jobs.","starters":[]},{"key":"buzz3-u7-w2","title":"A Helpful Worker","help":"Write about a helpful worker. Use simple sentences and vocabulary from Buzz 3 Unit 7. Practice simple present questions and jobs.","starters":[]},{"key":"buzz3-u7-w3","title":"Jobs in My Family","help":"Write about jobs in my family. Use simple sentences and vocabulary from Buzz 3 Unit 7. Practice simple present questions and jobs.","starters":[]},{"key":"buzz3-u8-w1","title":"Our Adventure in the Forest","help":"Write about our adventure in the forest. Use simple sentences and vocabulary from Buzz 3 Unit 8. Practice there was/were and could/couldn't.","starters":[]},{"key":"buzz3-u8-w2","title":"A Trip to the River","help":"Write about a trip to the river. Use simple sentences and vocabulary from Buzz 3 Unit 8. Practice there was/were and could/couldn't.","starters":[]},{"key":"buzz3-u8-w3","title":"The Best Place Outdoors","help":"Write about the best place outdoors. Use simple sentences and vocabulary from Buzz 3 Unit 8. Practice there was/were and could/couldn't.","starters":[]}]);
/* Buzz 4 textbook-aligned topics */
prompts.topic.push(...[{"key":"buzz4-u1-w1","title":"My Healthy Week","help":"Write about \"My Healthy Week\". Use words from Buzz 4 Unit 1. Try to include frequency adverbs and healthy habits.","starters":[]},{"key":"buzz4-u1-w2","title":"How I Stay Healthy","help":"Write about \"How I Stay Healthy\". Use words from Buzz 4 Unit 1. Try to include frequency adverbs and healthy habits.","starters":[]},{"key":"buzz4-u1-w3","title":"My Favorite Sport","help":"Write about \"My Favorite Sport\". Use words from Buzz 4 Unit 1. Try to include frequency adverbs and healthy habits.","starters":[]},{"key":"buzz4-u2-w1","title":"My Favorite Recipe","help":"Write about \"My Favorite Recipe\". Use words from Buzz 4 Unit 2. Try to include countable and uncountable nouns.","starters":[]},{"key":"buzz4-u2-w2","title":"Cooking With My Family","help":"Write about \"Cooking With My Family\". Use words from Buzz 4 Unit 2. Try to include countable and uncountable nouns.","starters":[]},{"key":"buzz4-u2-w3","title":"How to Make a Snack","help":"Write about \"How to Make a Snack\". Use words from Buzz 4 Unit 2. Try to include countable and uncountable nouns.","starters":[]},{"key":"buzz4-u3-w1","title":"Helping at Home","help":"Write about \"Helping at Home\". Use words from Buzz 4 Unit 3. Try to include regular simple past.","starters":[]},{"key":"buzz4-u3-w2","title":"A Family Party","help":"Write about \"A Family Party\". Use words from Buzz 4 Unit 3. Try to include regular simple past.","starters":[]},{"key":"buzz4-u3-w3","title":"My Weekend Chores","help":"Write about \"My Weekend Chores\". Use words from Buzz 4 Unit 3. Try to include regular simple past.","starters":[]},{"key":"buzz4-u4-w1","title":"A Trip to the Past","help":"Write about \"A Trip to the Past\". Use words from Buzz 4 Unit 4. Try to include irregular simple past.","starters":[]},{"key":"buzz4-u4-w2","title":"An Old Object","help":"Write about \"An Old Object\". Use words from Buzz 4 Unit 4. Try to include irregular simple past.","starters":[]},{"key":"buzz4-u4-w3","title":"A Historical Town","help":"Write about \"A Historical Town\". Use words from Buzz 4 Unit 4. Try to include irregular simple past.","starters":[]},{"key":"buzz4-u5-w1","title":"Our School Rules","help":"Write about \"Our School Rules\". Use words from Buzz 4 Unit 5. Try to include school rules and must/mustn't.","starters":[]},{"key":"buzz4-u5-w2","title":"My Favorite Place at School","help":"Write about \"My Favorite Place at School\". Use words from Buzz 4 Unit 5. Try to include school rules and must/mustn't.","starters":[]},{"key":"buzz4-u5-w3","title":"A Kind Classmate","help":"Write about \"A Kind Classmate\". Use words from Buzz 4 Unit 5. Try to include school rules and must/mustn't.","starters":[]},{"key":"buzz4-u6-w1","title":"My Next Vacation","help":"Write about \"My Next Vacation\". Use words from Buzz 4 Unit 6. Try to include going to future plans.","starters":[]},{"key":"buzz4-u6-w2","title":"What I Will Pack","help":"Write about \"What I Will Pack\". Use words from Buzz 4 Unit 6. Try to include going to future plans.","starters":[]},{"key":"buzz4-u6-w3","title":"A Dream Camping Trip","help":"Write about \"A Dream Camping Trip\". Use words from Buzz 4 Unit 6. Try to include going to future plans.","starters":[]},{"key":"buzz4-u7-w1","title":"My Favorite Wild Animal","help":"Write about \"My Favorite Wild Animal\". Use words from Buzz 4 Unit 7. Try to include comparatives and superlatives.","starters":[]},{"key":"buzz4-u7-w2","title":"The Fastest Animals","help":"Write about \"The Fastest Animals\". Use words from Buzz 4 Unit 7. Try to include comparatives and superlatives.","starters":[]},{"key":"buzz4-u7-w3","title":"A Rainforest Adventure","help":"Write about \"A Rainforest Adventure\". Use words from Buzz 4 Unit 7. Try to include comparatives and superlatives.","starters":[]},{"key":"buzz4-u8-w1","title":"My Favorite TV Show","help":"Write about \"My Favorite TV Show\". Use words from Buzz 4 Unit 8. Try to include relative pronouns and present progressive.","starters":[]},{"key":"buzz4-u8-w2","title":"A Fun Day at Home","help":"Write about \"A Fun Day at Home\". Use words from Buzz 4 Unit 8. Try to include relative pronouns and present progressive.","starters":[]},{"key":"buzz4-u8-w3","title":"Let's Make Something","help":"Write about \"Let's Make Something\". Use words from Buzz 4 Unit 8. Try to include relative pronouns and present progressive.","starters":[]}]);
/* Everybody Up 5 original curriculum topics */
prompts.topic.push(...[{"key":"eu3e5-u1-w1","title":"My Best Vacation","help":"Write about \"My Best Vacation\" using vocabulary from Everybody Up 5 Unit 1. Try to include past experiences and feelings.","starters":[]},{"key":"eu3e5-u1-w2","title":"An Exciting Ride","help":"Write about \"An Exciting Ride\" using vocabulary from Everybody Up 5 Unit 1. Try to include past experiences and feelings.","starters":[]},{"key":"eu3e5-u1-w3","title":"A Day I'll Remember","help":"Write about \"A Day I'll Remember\" using vocabulary from Everybody Up 5 Unit 1. Try to include past experiences and feelings.","starters":[]},{"key":"eu3e5-u2-w1","title":"Camping in the Forest","help":"Write about \"Camping in the Forest\" using vocabulary from Everybody Up 5 Unit 2. Try to include past progressive and comparisons.","starters":[]},{"key":"eu3e5-u2-w2","title":"Our Campfire","help":"Write about \"Our Campfire\" using vocabulary from Everybody Up 5 Unit 2. Try to include past progressive and comparisons.","starters":[]},{"key":"eu3e5-u2-w3","title":"A Cave Adventure","help":"Write about \"A Cave Adventure\" using vocabulary from Everybody Up 5 Unit 2. Try to include past progressive and comparisons.","starters":[]},{"key":"eu3e5-u3-w1","title":"Planning Our Class Party","help":"Write about \"Planning Our Class Party\" using vocabulary from Everybody Up 5 Unit 3. Try to include party plans and future intentions.","starters":[]},{"key":"eu3e5-u3-w2","title":"A Surprise for My Friend","help":"Write about \"A Surprise for My Friend\" using vocabulary from Everybody Up 5 Unit 3. Try to include party plans and future intentions.","starters":[]},{"key":"eu3e5-u3-w3","title":"My Perfect Party","help":"Write about \"My Perfect Party\" using vocabulary from Everybody Up 5 Unit 3. Try to include party plans and future intentions.","starters":[]},{"key":"eu3e5-u4-w1","title":"Protect the Rainforest","help":"Write about \"Protect the Rainforest\" using vocabulary from Everybody Up 5 Unit 4. Try to include animal comparisons and habitats.","starters":[]},{"key":"eu3e5-u4-w2","title":"My Favorite Wild Animal","help":"Write about \"My Favorite Wild Animal\" using vocabulary from Everybody Up 5 Unit 4. Try to include animal comparisons and habitats.","starters":[]},{"key":"eu3e5-u4-w3","title":"The World's Fastest Animals","help":"Write about \"The World's Fastest Animals\" using vocabulary from Everybody Up 5 Unit 4. Try to include animal comparisons and habitats.","starters":[]},{"key":"eu3e5-u5-w1","title":"How I Study Well","help":"Write about \"How I Study Well\" using vocabulary from Everybody Up 5 Unit 5. Try to include adverbs and study habits.","starters":[]},{"key":"eu3e5-u5-w2","title":"A Busy School Day","help":"Write about \"A Busy School Day\" using vocabulary from Everybody Up 5 Unit 5. Try to include adverbs and study habits.","starters":[]},{"key":"eu3e5-u5-w3","title":"My Healthy Habits","help":"Write about \"My Healthy Habits\" using vocabulary from Everybody Up 5 Unit 5. Try to include adverbs and study habits.","starters":[]},{"key":"eu3e5-u6-w1","title":"How to Make Something","help":"Write about \"How to Make Something\" using vocabulary from Everybody Up 5 Unit 6. Try to include quantities and instructions.","starters":[]},{"key":"eu3e5-u6-w2","title":"My Favorite Recipe","help":"Write about \"My Favorite Recipe\" using vocabulary from Everybody Up 5 Unit 6. Try to include quantities and instructions.","starters":[]},{"key":"eu3e5-u6-w3","title":"Build a Model","help":"Write about \"Build a Model\" using vocabulary from Everybody Up 5 Unit 6. Try to include quantities and instructions.","starters":[]},{"key":"eu3e5-u7-w1","title":"A Country I'd Like to Visit","help":"Write about \"A Country I'd Like to Visit\" using vocabulary from Everybody Up 5 Unit 7. Try to include travel experiences and the present perfect.","starters":[]},{"key":"eu3e5-u7-w2","title":"My Travel Adventure","help":"Write about \"My Travel Adventure\" using vocabulary from Everybody Up 5 Unit 7. Try to include travel experiences and the present perfect.","starters":[]},{"key":"eu3e5-u7-w3","title":"A Trip to Australia","help":"Write about \"A Trip to Australia\" using vocabulary from Everybody Up 5 Unit 7. Try to include travel experiences and the present perfect.","starters":[]},{"key":"eu3e5-u8-w1","title":"How I Use Computers","help":"Write about \"How I Use Computers\" using vocabulary from Everybody Up 5 Unit 8. Try to include computer actions and the present perfect.","starters":[]},{"key":"eu3e5-u8-w2","title":"Technology at Home","help":"Write about \"Technology at Home\" using vocabulary from Everybody Up 5 Unit 8. Try to include computer actions and the present perfect.","starters":[]},{"key":"eu3e5-u8-w3","title":"My Favorite Website","help":"Write about \"My Favorite Website\" using vocabulary from Everybody Up 5 Unit 8. Try to include computer actions and the present perfect.","starters":[]}]);
/* Everybody Up 6 curriculum writing topics */
prompts.topic.push(...[{"key":"eu3e6-u1-w1","title":"Giving Directions","help":"Write about \"Giving Directions\" using vocabulary and ideas from Everybody Up 6 Unit 1.","starters":[]},{"key":"eu3e6-u1-w2","title":"A Trip Across Town","help":"Write about \"A Trip Across Town\" using vocabulary and ideas from Everybody Up 6 Unit 1.","starters":[]},{"key":"eu3e6-u1-w3","title":"My Favorite Way to Travel","help":"Write about \"My Favorite Way to Travel\" using vocabulary and ideas from Everybody Up 6 Unit 1.","starters":[]},{"key":"eu3e6-u2-w1","title":"Helping Our Community","help":"Write about \"Helping Our Community\" using vocabulary and ideas from Everybody Up 6 Unit 2.","starters":[]},{"key":"eu3e6-u2-w2","title":"A Volunteer Project","help":"Write about \"A Volunteer Project\" using vocabulary and ideas from Everybody Up 6 Unit 2.","starters":[]},{"key":"eu3e6-u2-w3","title":"How to Be Responsible","help":"Write about \"How to Be Responsible\" using vocabulary and ideas from Everybody Up 6 Unit 2.","starters":[]},{"key":"eu3e6-u3-w1","title":"My Favorite Technology","help":"Write about \"My Favorite Technology\" using vocabulary and ideas from Everybody Up 6 Unit 3.","starters":[]},{"key":"eu3e6-u3-w2","title":"How I Use My Smartphone","help":"Write about \"How I Use My Smartphone\" using vocabulary and ideas from Everybody Up 6 Unit 3.","starters":[]},{"key":"eu3e6-u3-w3","title":"Internet Safety Tips","help":"Write about \"Internet Safety Tips\" using vocabulary and ideas from Everybody Up 6 Unit 3.","starters":[]},{"key":"eu3e6-u4-w1","title":"My Healthy Routine","help":"Write about \"My Healthy Routine\" using vocabulary and ideas from Everybody Up 6 Unit 4.","starters":[]},{"key":"eu3e6-u4-w2","title":"Good and Bad Habits","help":"Write about \"Good and Bad Habits\" using vocabulary and ideas from Everybody Up 6 Unit 4.","starters":[]},{"key":"eu3e6-u4-w3","title":"Advice for a Friend","help":"Write about \"Advice for a Friend\" using vocabulary and ideas from Everybody Up 6 Unit 4.","starters":[]},{"key":"eu3e6-u5-w1","title":"My Favorite Place in Town","help":"Write about \"My Favorite Place in Town\" using vocabulary and ideas from Everybody Up 6 Unit 5.","starters":[]},{"key":"eu3e6-u5-w2","title":"A New Community Center","help":"Write about \"A New Community Center\" using vocabulary and ideas from Everybody Up 6 Unit 5.","starters":[]},{"key":"eu3e6-u5-w3","title":"A Day at the Museum","help":"Write about \"A Day at the Museum\" using vocabulary and ideas from Everybody Up 6 Unit 5.","starters":[]},{"key":"eu3e6-u6-w1","title":"Save Our Planet","help":"Write about \"Save Our Planet\" using vocabulary and ideas from Everybody Up 6 Unit 6.","starters":[]},{"key":"eu3e6-u6-w2","title":"Our School Recycling Plan","help":"Write about \"Our School Recycling Plan\" using vocabulary and ideas from Everybody Up 6 Unit 6.","starters":[]},{"key":"eu3e6-u6-w3","title":"How to Save Energy","help":"Write about \"How to Save Energy\" using vocabulary and ideas from Everybody Up 6 Unit 6.","starters":[]},{"key":"eu3e6-u7-w1","title":"Design an Advertisement","help":"Write about \"Design an Advertisement\" using vocabulary and ideas from Everybody Up 6 Unit 7.","starters":[]},{"key":"eu3e6-u7-w2","title":"My Favorite Product","help":"Write about \"My Favorite Product\" using vocabulary and ideas from Everybody Up 6 Unit 7.","starters":[]},{"key":"eu3e6-u7-w3","title":"A Poster for Our School","help":"Write about \"A Poster for Our School\" using vocabulary and ideas from Everybody Up 6 Unit 7.","starters":[]},{"key":"eu3e6-u8-w1","title":"Communication Then and Now","help":"Write about \"Communication Then and Now\" using vocabulary and ideas from Everybody Up 6 Unit 8.","starters":[]},{"key":"eu3e6-u8-w2","title":"A Helpful Website","help":"Write about \"A Helpful Website\" using vocabulary and ideas from Everybody Up 6 Unit 8.","starters":[]},{"key":"eu3e6-u8-w3","title":"Writing a Good Message","help":"Write about \"Writing a Good Message\" using vocabulary and ideas from Everybody Up 6 Unit 8.","starters":[]}]);
/* Skills World Reading with Writing 6 curriculum topics */
prompts.topic.push(...[{"key":"skillsworld6-u1-w1","title":"Describe an Amazing Sea Animal","help":"Write about \"Describe an Amazing Sea Animal\". Follow the Unit 1 writing goal: Detailed description. Include an introduction, supporting details and conclusion.","starters":[]},{"key":"skillsworld6-u1-w2","title":"Describe an Underwater Exhibit","help":"Write about \"Describe an Underwater Exhibit\". Follow the Unit 1 writing goal: Detailed description. Include an introduction, supporting details and conclusion.","starters":[]},{"key":"skillsworld6-u2-w1","title":"My First Diving Adventure","help":"Write about \"My First Diving Adventure\". Follow the Unit 2 writing goal: Sequencing. Include an introduction, supporting details and conclusion.","starters":[]},{"key":"skillsworld6-u2-w2","title":"A Surprising Sea Animal","help":"Write about \"A Surprising Sea Animal\". Follow the Unit 2 writing goal: Sequencing. Include an introduction, supporting details and conclusion.","starters":[]},{"key":"skillsworld6-u3-w1","title":"A Safety Magazine Article","help":"Write about \"A Safety Magazine Article\". Follow the Unit 3 writing goal: Magazine article. Include an introduction, supporting details and conclusion.","starters":[]},{"key":"skillsworld6-u3-w2","title":"What to Wear on an Adventure","help":"Write about \"What to Wear on an Adventure\". Follow the Unit 3 writing goal: Magazine article. Include an introduction, supporting details and conclusion.","starters":[]},{"key":"skillsworld6-u4-w1","title":"A Magazine Guide to Winter Clothes","help":"Write about \"A Magazine Guide to Winter Clothes\". Follow the Unit 4 writing goal: Headlines, pictures, hook. Include an introduction, supporting details and conclusion.","starters":[]},{"key":"skillsworld6-u4-w2","title":"The Best Tips for a School Trip","help":"Write about \"The Best Tips for a School Trip\". Follow the Unit 4 writing goal: Headlines, pictures, hook. Include an introduction, supporting details and conclusion.","starters":[]},{"key":"skillsworld6-u5-w1","title":"How to Get to My School","help":"Write about \"How to Get to My School\". Follow the Unit 5 writing goal: Process essay. Include an introduction, supporting details and conclusion.","starters":[]},{"key":"skillsworld6-u5-w2","title":"Directions to a Museum","help":"Write about \"Directions to a Museum\". Follow the Unit 5 writing goal: Process essay. Include an introduction, supporting details and conclusion.","starters":[]},{"key":"skillsworld6-u6-w1","title":"How to Walk Across Town","help":"Write about \"How to Walk Across Town\". Follow the Unit 6 writing goal: Purpose phrases. Include an introduction, supporting details and conclusion.","starters":[]},{"key":"skillsworld6-u6-w2","title":"Finding a Place by the River","help":"Write about \"Finding a Place by the River\". Follow the Unit 6 writing goal: Purpose phrases. Include an introduction, supporting details and conclusion.","starters":[]},{"key":"skillsworld6-u7-w1","title":"A Review of a Language App","help":"Write about \"A Review of a Language App\". Follow the Unit 7 writing goal: Review. Include an introduction, supporting details and conclusion.","starters":[]},{"key":"skillsworld6-u7-w2","title":"Languages Spoken in My Community","help":"Write about \"Languages Spoken in My Community\". Follow the Unit 7 writing goal: Review. Include an introduction, supporting details and conclusion.","starters":[]},{"key":"skillsworld6-u8-w1","title":"Review a Bilingual Learning Tool","help":"Write about \"Review a Bilingual Learning Tool\". Follow the Unit 8 writing goal: Examples. Include an introduction, supporting details and conclusion.","starters":[]},{"key":"skillsworld6-u8-w2","title":"My Favorite Foreign Language","help":"Write about \"My Favorite Foreign Language\". Follow the Unit 8 writing goal: Examples. Include an introduction, supporting details and conclusion.","starters":[]},{"key":"skillsworld6-u9-w1","title":"Compare Two Friends","help":"Write about \"Compare Two Friends\". Follow the Unit 9 writing goal: Comparative report. Include an introduction, supporting details and conclusion.","starters":[]},{"key":"skillsworld6-u9-w2","title":"How Our Personalities Are Different","help":"Write about \"How Our Personalities Are Different\". Follow the Unit 9 writing goal: Comparative report. Include an introduction, supporting details and conclusion.","starters":[]},{"key":"skillsworld6-u10-w1","title":"Two People I Admire","help":"Write about \"Two People I Admire\". Follow the Unit 10 writing goal: Contrasts. Include an introduction, supporting details and conclusion.","starters":[]},{"key":"skillsworld6-u10-w2","title":"An Active Person and a Quiet Person","help":"Write about \"An Active Person and a Quiet Person\". Follow the Unit 10 writing goal: Contrasts. Include an introduction, supporting details and conclusion.","starters":[]},{"key":"skillsworld6-u11-w1","title":"Research an Amazing National Park","help":"Write about \"Research an Amazing National Park\". Follow the Unit 11 writing goal: Research report. Include an introduction, supporting details and conclusion.","starters":[]},{"key":"skillsworld6-u11-w2","title":"Research a Famous Landmark","help":"Write about \"Research a Famous Landmark\". Follow the Unit 11 writing goal: Research report. Include an introduction, supporting details and conclusion.","starters":[]},{"key":"skillsworld6-u12-w1","title":"An Expedition to Antarctica","help":"Write about \"An Expedition to Antarctica\". Follow the Unit 12 writing goal: Synonyms. Include an introduction, supporting details and conclusion.","starters":[]},{"key":"skillsworld6-u12-w2","title":"Could People Live on Mars?","help":"Write about \"Could People Live on Mars?\". Follow the Unit 12 writing goal: Synonyms. Include an introduction, supporting details and conclusion.","starters":[]}]);
/* Skills World 2 original writing topics */
prompts.topic.push(...[{"key":"skillsworld2-u1-w1","title":"My Favorite Picture","help":"Write about \"My Favorite Picture\" using Level 2 language. Writing focus: conversation.","starters":[]},{"key":"skillsworld2-u1-w2","title":"More About My Favorite Picture","help":"Write about \"My Favorite Picture\" using Level 2 language. Writing focus: conversation.","starters":[]},{"key":"skillsworld2-u2-w1","title":"Let's Make Something","help":"Write about \"Let's Make Something\" using Level 2 language. Writing focus: names and capital letters.","starters":[]},{"key":"skillsworld2-u2-w2","title":"More About Let's Make Something","help":"Write about \"Let's Make Something\" using Level 2 language. Writing focus: names and capital letters.","starters":[]},{"key":"skillsworld2-u3-w1","title":"A Shopping Trip","help":"Write about \"A Shopping Trip\" using Level 2 language. Writing focus: email.","starters":[]},{"key":"skillsworld2-u3-w2","title":"More About A Shopping Trip","help":"Write about \"A Shopping Trip\" using Level 2 language. Writing focus: email.","starters":[]},{"key":"skillsworld2-u4-w1","title":"Write an Email to a Friend","help":"Write about \"Write an Email to a Friend\" using Level 2 language. Writing focus: description words.","starters":[]},{"key":"skillsworld2-u4-w2","title":"More About Write an Email to a Friend","help":"Write about \"Write an Email to a Friend\" using Level 2 language. Writing focus: description words.","starters":[]},{"key":"skillsworld2-u5-w1","title":"My Funniest Game","help":"Write about \"My Funniest Game\" using Level 2 language. Writing focus: story.","starters":[]},{"key":"skillsworld2-u5-w2","title":"More About My Funniest Game","help":"Write about \"My Funniest Game\" using Level 2 language. Writing focus: story.","starters":[]},{"key":"skillsworld2-u6-w1","title":"A Day at the Playground","help":"Write about \"A Day at the Playground\" using Level 2 language. Writing focus: character and setting.","starters":[]},{"key":"skillsworld2-u6-w2","title":"More About A Day at the Playground","help":"Write about \"A Day at the Playground\" using Level 2 language. Writing focus: character and setting.","starters":[]},{"key":"skillsworld2-u7-w1","title":"A Hero in My Town","help":"Write about \"A Hero in My Town\" using Level 2 language. Writing focus: paragraph.","starters":[]},{"key":"skillsworld2-u7-w2","title":"More About A Hero in My Town","help":"Write about \"A Hero in My Town\" using Level 2 language. Writing focus: paragraph.","starters":[]},{"key":"skillsworld2-u8-w1","title":"Someone Who Helps Animals","help":"Write about \"Someone Who Helps Animals\" using Level 2 language. Writing focus: in to show location.","starters":[]},{"key":"skillsworld2-u8-w2","title":"More About Someone Who Helps Animals","help":"Write about \"Someone Who Helps Animals\" using Level 2 language. Writing focus: in to show location.","starters":[]},{"key":"skillsworld2-u9-w1","title":"My Favorite Food","help":"Write about \"My Favorite Food\" using Level 2 language. Writing focus: opinion.","starters":[]},{"key":"skillsworld2-u9-w2","title":"More About My Favorite Food","help":"Write about \"My Favorite Food\" using Level 2 language. Writing focus: opinion.","starters":[]},{"key":"skillsworld2-u10-w1","title":"Food I Like and Dislike","help":"Write about \"Food I Like and Dislike\" using Level 2 language. Writing focus: and and but.","starters":[]},{"key":"skillsworld2-u10-w2","title":"More About Food I Like and Dislike","help":"Write about \"Food I Like and Dislike\" using Level 2 language. Writing focus: and and but.","starters":[]},{"key":"skillsworld2-u11-w1","title":"My School Day","help":"Write about \"My School Day\" using Level 2 language. Writing focus: schedule.","starters":[]},{"key":"skillsworld2-u11-w2","title":"More About My School Day","help":"Write about \"My School Day\" using Level 2 language. Writing focus: schedule.","starters":[]},{"key":"skillsworld2-u12-w1","title":"My Weekend Schedule","help":"Write about \"My Weekend Schedule\" using Level 2 language. Writing focus: a.m. and p.m..","starters":[]},{"key":"skillsworld2-u12-w2","title":"More About My Weekend Schedule","help":"Write about \"My Weekend Schedule\" using Level 2 language. Writing focus: a.m. and p.m..","starters":[]}]);
/* Skills World 3 original writing topics */
prompts.topic.push(...[{"key":"skillsworld3-u1-w1","title":"Describe My Art Project","help":"Write about \"Describe My Art Project\" using Level 3 language. Writing focus: description.","starters":[]},{"key":"skillsworld3-u1-w2","title":"More About Describe My Art Project","help":"Write about \"Describe My Art Project\" using Level 3 language. Writing focus: description.","starters":[]},{"key":"skillsworld3-u2-w1","title":"How to Make a Picture","help":"Write about \"How to Make a Picture\" using Level 3 language. Writing focus: details.","starters":[]},{"key":"skillsworld3-u2-w2","title":"More About How to Make a Picture","help":"Write about \"How to Make a Picture\" using Level 3 language. Writing focus: details.","starters":[]},{"key":"skillsworld3-u3-w1","title":"Why I Like My Clothes","help":"Write about \"Why I Like My Clothes\" using Level 3 language. Writing focus: persuasive text.","starters":[]},{"key":"skillsworld3-u3-w2","title":"More About Why I Like My Clothes","help":"Write about \"Why I Like My Clothes\" using Level 3 language. Writing focus: persuasive text.","starters":[]},{"key":"skillsworld3-u4-w1","title":"The Best Clothes for Winter","help":"Write about \"The Best Clothes for Winter\" using Level 3 language. Writing focus: opinions and reasons.","starters":[]},{"key":"skillsworld3-u4-w2","title":"More About The Best Clothes for Winter","help":"Write about \"The Best Clothes for Winter\" using Level 3 language. Writing focus: opinions and reasons.","starters":[]},{"key":"skillsworld3-u5-w1","title":"How to Find My School","help":"Write about \"How to Find My School\" using Level 3 language. Writing focus: process paragraph.","starters":[]},{"key":"skillsworld3-u5-w2","title":"More About How to Find My School","help":"Write about \"How to Find My School\" using Level 3 language. Writing focus: process paragraph.","starters":[]},{"key":"skillsworld3-u6-w1","title":"A Walk Through the City","help":"Write about \"A Walk Through the City\" using Level 3 language. Writing focus: sequence words.","starters":[]},{"key":"skillsworld3-u6-w2","title":"More About A Walk Through the City","help":"Write about \"A Walk Through the City\" using Level 3 language. Writing focus: sequence words.","starters":[]},{"key":"skillsworld3-u7-w1","title":"A Job I Admire","help":"Write about \"A Job I Admire\" using Level 3 language. Writing focus: outline.","starters":[]},{"key":"skillsworld3-u7-w2","title":"More About A Job I Admire","help":"Write about \"A Job I Admire\" using Level 3 language. Writing focus: outline.","starters":[]},{"key":"skillsworld3-u8-w1","title":"My Future Job","help":"Write about \"My Future Job\" using Level 3 language. Writing focus: main ideas and details.","starters":[]},{"key":"skillsworld3-u8-w2","title":"More About My Future Job","help":"Write about \"My Future Job\" using Level 3 language. Writing focus: main ideas and details.","starters":[]},{"key":"skillsworld3-u9-w1","title":"Describe My Home","help":"Write about \"Describe My Home\" using Level 3 language. Writing focus: journal entry.","starters":[]},{"key":"skillsworld3-u9-w2","title":"More About Describe My Home","help":"Write about \"Describe My Home\" using Level 3 language. Writing focus: journal entry.","starters":[]},{"key":"skillsworld3-u10-w1","title":"A Day in My House","help":"Write about \"A Day in My House\" using Level 3 language. Writing focus: dates.","starters":[]},{"key":"skillsworld3-u10-w2","title":"More About A Day in My House","help":"Write about \"A Day in My House\" using Level 3 language. Writing focus: dates.","starters":[]},{"key":"skillsworld3-u11-w1","title":"My Favorite Free-Time Activity","help":"Write about \"My Favorite Free-Time Activity\" using Level 3 language. Writing focus: story.","starters":[]},{"key":"skillsworld3-u11-w2","title":"More About My Favorite Free-Time Activity","help":"Write about \"My Favorite Free-Time Activity\" using Level 3 language. Writing focus: story.","starters":[]},{"key":"skillsworld3-u12-w1","title":"A Camping Adventure","help":"Write about \"A Camping Adventure\" using Level 3 language. Writing focus: setting.","starters":[]},{"key":"skillsworld3-u12-w2","title":"More About A Camping Adventure","help":"Write about \"A Camping Adventure\" using Level 3 language. Writing focus: setting.","starters":[]}]);
const exampleDiaries=[
 {title:'A Fun Saturday',text:'Today was a wonderful Saturday. I woke up early in the morning. I ate pancakes with my family. After breakfast, we went to the park. I rode my bicycle with my sister. We came home feeling tired but happy.'},
 {title:'My Day at School',text:'I went to school with my friend today. Our first class was English. We learned some new words together. At lunchtime, I ate rice and soup. After school, I played football outside. I had a busy but exciting day.'},
 {title:'A Rainy Day',text:'It rained a lot this morning. I took my umbrella to school. I saw big puddles on the street. During break time, I read a funny book. When I got home, I drank warm milk. I hope the sun comes out tomorrow.'},
 {title:'A Happy Surprise',text:'Today I had a lovely surprise. My grandmother came to visit us. She brought some fresh strawberries. We made a sweet dessert together. I told her about my day at school. I was happy to spend time with her.'}
];
let diaryRecognition=null,diaryTranscript='',diaryInterim='',diaryBusy=false,diaryReviewBody='';
const fullDiarySentences=text=>String(text||'').trim().match(/[^.!?\n]+[.!?]+(?=\s|$)/g)?.map(x=>x.trim()).filter(x=>/[a-z]/i.test(x))||[];
const state={student:null,entries:[],active:null,filter:'all',timer:0,loading:false,creativeAllowed:false};
const fmtDate=s=>{if(!s)return'';const d=new Date(s);return Number.isNaN(d.getTime())?String(s).slice(0,10):d.toLocaleDateString('ko-KR',{month:'short',day:'numeric',year:'numeric'})};
const seoulDate=()=>{const parts=Object.fromEntries(new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Seoul',year:'numeric',month:'2-digit',day:'2-digit'}).formatToParts(new Date()).map(x=>[x.type,x.value]));return parts.year+'-'+parts.month+'-'+parts.day};
const wordCount=s=>String(s||'').trim().match(/\b[\p{L}\p{N}][\p{L}\p{N}'’-]*\b/gu)?.length||0;
const sentenceCount=s=>String(s||'').split(/[.!?]+(?:\s|$)/).map(x=>x.trim()).filter(Boolean).length;
const el=(tag,cls,text)=>{const node=document.createElement(tag);if(cls)node.className=cls;if(text!==undefined)node.textContent=text;return node};
const todayTitle=date=>date===seoulDate()?'오늘의 일기':date+' 일기';
const validKind=kind=>Object.hasOwn(modeNames,kind)?kind:'sentence';
function notice(message='',error=false){const node=$('wgNotice');node.textContent=message;node.classList.toggle('is-error',error)}
function saveState(message='',error=false){const node=$('wgSaveState');node.textContent=message;node.classList.toggle('is-error',error)}
function navState(screen,id){return {[NAV]:true,screen,id:id||null,depth:screen==='editor'?1:0}}
function show(name){
 $('wgHome').hidden=name!=='home';$('wgEditor').hidden=name!=='editor';$('wgPractice').hidden=name!=='practice';
 // Reuse the SAME mounted Mission HAM on the Sentence Writing picker.
 // Moving its node preserves mission state and avoids another API subscription.
 const basket=$('appMissionBasket'),picker=$('spPicker'),home=$('wgHome');
 if(basket&&picker&&home){
  if(name==='practice'&&picker.firstElementChild!==basket)picker.prepend(basket);
  else if(name!=='practice'&&basket.parentElement!==home)home.prepend(basket);
 }
 notice('');
}
function togglePortfolio(open){
  $('wgPortfolio').hidden=!open;
  $('wgOpenLibrary').hidden=open;
  document.querySelector('.wg-mode-grid').hidden=open;
  $('wgOpenLibrary').setAttribute('aria-expanded',String(open));
  if(open){renderLibrary();window.scrollTo({top:0,behavior:'auto'});}
}
function renderLibrary(){
  const root=$('wgLibrary');root.replaceChildren();
  const published=state.entries.filter(e=>e.status==='submitted').length;
  const diaries=state.entries.filter(e=>e.kind==='diary').length;
  $('wgSummary').textContent=state.entries.length+'개의 글 · 일기 '+diaries+'개 · 제출 '+published+'개';
  const rows=state.entries.filter(e=>state.filter==='all'||e.status===state.filter);
  if(!rows.length){root.append(el('div','wg-empty',state.filter==='all'?'아직 쓴 글이 없어요. 위에서 시작해 보세요!':'이 상태의 글이 없어요.'));return}
  for(const entry of rows){
    const button=el('button','wg-library-item');button.type='button';
    const main=el('span','wg-library-main'),title=el('strong','',entry.title||modeNames[entry.kind]);
    const secondary=el('small','',modeNames[entry.kind]+' · '+fmtDate(entry.writing_date)+(entry.kind==='diary'?'':' · '+fmtDate(entry.updated_at)));
    const excerpt=el('span','wg-excerpt',(entry.body||'').trim().replace(/\s+/g,' ').slice(0,150)||'내용을 이어서 써 보세요');
    main.append(title,secondary,excerpt);
    const side=el('span','wg-library-meta'),pill=el('span','wg-status-pill'+(entry.status==='submitted'?' is-submitted':''),
      entry.status==='submitted'?'제출 완료':'임시 저장');
    side.append(pill,el('span','wg-library-arrow','›'));button.append(main,side);
    button.addEventListener('click',()=>openEditor(entry));
    root.append(button);
  }
}
async function authToken(force=false){
  let token=!force?window.WillenaAPI?.getLocalAccessToken?.()||'':'';
  if(token)return token;
  const endpoint='/.netlify/functions/supabase_auth?action=refresh&_='+Date.now();
  const response=await (window.WillenaAPI?.fetch?
    window.WillenaAPI.fetch(endpoint,{credentials:'include',cache:'no-store'}):
    fetch(endpoint,{credentials:'include',cache:'no-store'}));
  const body=await response.json().catch(()=>({}));
  if(!response.ok||!body.access_token)throw new Error('로그인이 만료됐어요. 다시 로그인해 주세요.');
  window.WillenaAPI?.setLocalTokens?.(body.access_token,body.refresh_token||'');
  return body.access_token;
}
async function databaseApi(table,method,path='',body=null){
  const call=async token=>fetch(API_BASE+table+path,{method,cache:'no-store',
    headers:{apikey:KEY,Authorization:'Bearer '+token,
      ...(body?{'Content-Type':'application/json',Prefer:'return=representation'}:{})},
    ...(body?{body:JSON.stringify(body)}:{})});
  let response=await call(await authToken());
  if(response.status===401)response=await call(await authToken(true));
  const result=await response.json().catch(()=>null);
  if(!response.ok){
    const error=new Error(result?.message||result?.error||'글 저장에 실패했어요. 다시 시도해 주세요.');
    error.code=result?.code||'';throw error;
  }
  return result;
}
const api=(method,path='',body=null)=>databaseApi('writing_genius_entries',method,path,body);
async function reloadEntries(){
  const list=await api('GET','?select=id,student_id,kind,title,prompt_key,prompt_text,body,writing_date,status,created_at,updated_at,submitted_at&order=updated_at.desc&limit=160');
  if(!Array.isArray(list))throw new Error('글 목록을 불러오지 못했어요.');
  state.entries=list.filter(row=>row.student_id===state.student.id);
  renderLibrary();
}
function setPromptOptions(kind,selected){
  const select=$('wgPromptSelect');select.replaceChildren();
  for(const p of prompts[kind]){
    const option=el('option','',p.title);option.value=p.key;select.append(option);
  }
  select.value=prompts[kind].some(p=>p.key===selected)?selected:prompts[kind][0].key;
  renderHelp();
}
function renderHelp(){
  if(!state.active)return;
  const p=prompts[state.active.kind].find(p=>p.key===$('wgPromptSelect').value)||prompts[state.active.kind][0];
  $('wgPromptHelp').textContent=p.help;
  const root=$('wgStarters');root.replaceChildren();
  for(const starter of p.starters){
    const b=el('button','',starter);b.type='button';b.addEventListener('click',()=>insertStarter(starter));
    root.append(b);
  }
}
function updateCounts(){
  const body=$('wgBody').value;
  $('wgCounts').textContent=wordCount(body)+' words · '+sentenceCount(body)+' sentences';
}
function setReadOnly(readOnly){
  $('wgTitle').readOnly=readOnly;
  $('wgPromptSelect').disabled=readOnly;
  $('wgBody').readOnly=readOnly;
  $('wgSave').hidden=readOnly;$('wgSubmit').hidden=readOnly;
  $('wgIdeasToggle').disabled=readOnly;
  $('wgComplete').hidden=!readOnly;
  if(state.active?.kind==='diary')$('wgDiaryGuide').hidden=false;
  $('wgEditor').classList.toggle('is-submitted',readOnly);
  $('wgHeading').textContent=readOnly?'제출한 글':modeNames[state.active?.kind]||'글쓰기';
}
function showEditor(entry){
  state.active={...entry,rev:0,savedRev:0,persisted:!!entry.persisted,dirty:false,saving:null};
  const a=state.active;
  $('wgKind').textContent=({sentence:'FREE SENTENCES',diary:'DAILY DIARY',topic:'TOPIC WRITING'})[a.kind];
  $('wgDate').textContent=a.kind==='diary'?a.writing_date:fmtDate(a.writing_date);
  $('wgTitle').value=a.title||'';
  $('wgBody').value=a.body||'';
  setPromptOptions(a.kind,a.prompt_key);
  setReadOnly(a.status==='submitted');
  $('wgIdeas').hidden=true;$('wgIdeasToggle').setAttribute('aria-expanded','false');
  $('wgIdeasToggle').querySelector('span').textContent='보기';
  document.querySelectorAll('.wg-checklist input').forEach(x=>x.checked=false);
  $('wgDiaryGuide').hidden=a.kind!=='diary';
  if(a.kind==='diary')setDiaryStep(1);else {$('wgDiarySteps').hidden=true;$('wgDiaryNavigation').hidden=true;$('wgPaperScreen').hidden=false;$('wgTitle').closest('.wg-field').hidden=false;$('wgPromptRow').hidden=false;}
  $('wgDiaryReview').hidden=true;
  $('wgSubmit').textContent=a.kind==='diary'?'AI Willi 확인하기':'글 제출하기';
  diaryTranscript='';diaryInterim='';diaryReviewBody='';

  updateCounts();saveState(a.persisted?'저장됨':'새 글');
  if(a.kind==='diary'&&a.persisted&&a.status!=='submitted')void restoreDiaryReview(a);
  show('editor');window.scrollTo({top:0,behavior:'auto'});
  if(a.kind==='diary'||a.kind==='topic')diaryFlow.open(a);
  else $('wgDiaryFlow').hidden=true;
}
function createEntry(kind){
  const prompt=prompts[kind][0],date=seoulDate();
  return {id:crypto.randomUUID(),student_id:state.student.id,kind,
    title:kind==='diary'?todayTitle(date):kind==='topic'?prompt.title:'',
    prompt_key:prompt.key,prompt_text:prompt.help,body:'',
    writing_date:date,status:'draft',created_at:new Date().toISOString(),
    updated_at:new Date().toISOString(),persisted:false};
}
function openEditor(entry,fromPop=false){
  if(state.active?.dirty){notice('변경된 글을 먼저 저장해 주세요.',true);return}
  clearTimeout(state.timer);
  const saved={...entry,persisted:entry.persisted!==false};
  showEditor(saved);
  if(!fromPop){
    if(history.state?.[NAV]&&history.state.screen==='editor')history.replaceState(navState('editor',entry.id),'');
    else history.pushState(navState('editor',entry.id),'');
  }
}
function start(kind){
  kind=validKind(kind);
  if(kind!=='sentence'&&state.creativeAllowed===false){
    notice('일기와 주제 글쓰기는 레벨 4 이상 학생만 이용할 수 있어요. 문장 연습은 할 수 있어요.',true);
    return;
  }
  if(kind==='sentence'){
    state.active=null;show('practice');
    if(!(history.state?.[NAV]&&history.state.screen==='practice'))history.pushState(navState('practice'),'');
    void practice.open(state.student).catch(error=>notice('문장 연습을 불러오지 못했어요. '+error.message,true));
    return;
  }
  if(kind==='diary'){
    const existing=state.entries.find(e=>e.kind==='diary'&&e.writing_date===seoulDate());
    if(existing){openEditor(existing);return}
  }
  openEditor(createEntry(kind));
}
function readForm(){
  const active=state.active,p=prompts[active.kind].find(p=>p.key===$('wgPromptSelect').value)||prompts[active.kind][0];
  return {id:active.id,student_id:state.student.id,kind:active.kind,title:$('wgTitle').value.trim(),
    prompt_key:p.key,prompt_text:p.help,body:$('wgBody').value,writing_date:active.writing_date,status:'draft'};
}
function markDirty(){
  const active=state.active;if(!active||active.status==='submitted')return;
  active.rev++;active.dirty=true;
  if(active.kind==='diary'||active.kind==='topic'){$('wgDiaryReview').hidden=true;diaryReviewBody='';diaryTranscript='';}
  saveState('저장 전…');updateCounts();clearTimeout(state.timer);
  state.timer=setTimeout(()=>{void saveEntry()},1100);
}
function insertStarter(starter){
  const field=$('wgBody');if(field.readOnly)return;
  const a=field.selectionStart,b=field.selectionEnd,text=field.value;
  const prefix=a>0&&text[a-1]!== '\n'&&text[a-1]!==' '?' ':'';
  const value=starter.endsWith('…')?starter.slice(0,-1):starter;
  field.value=text.slice(0,a)+prefix+value+text.slice(b);
  const caret=a+prefix.length+value.length;field.focus();field.setSelectionRange(caret,caret);
  markDirty();
}
async function saveEntry({submit=false,force=false}={}){
  const entry=state.active;if(!entry)return false;
  clearTimeout(state.timer);
  if(entry.saving){try{await entry.saving}catch{};if(state.active!==entry)return false}
  if(!submit&&!force&&!entry.dirty)return true;
  const data=readForm();data.status=(submit||entry.status==='submitted')?'submitted':'draft';
  if(submit&&data.body.trim().length<3){notice('영어 문장을 먼저 써 주세요.',true);$('wgBody').focus();return false}
  const snapshotRev=entry.rev;
  saveState(submit?'제출하는 중…':'저장 중…');
  $('wgSave').disabled=true;$('wgSubmit').disabled=true;
  const task=(async()=>{
    const payload=entry.persisted?
      {title:data.title,prompt_key:data.prompt_key,prompt_text:data.prompt_text,body:data.body,status:data.status}:
      data;
    const path=entry.persisted?'?id=eq.'+encodeURIComponent(entry.id):'';
    const rows=await api(entry.persisted?'PATCH':'POST',path,payload);
    if(!Array.isArray(rows)||!rows[0])throw new Error('저장 결과가 비어 있어요. 다시 시도해 주세요.');
    entry.persisted=true;
    entry.savedRev=snapshotRev;
    if(entry.rev===snapshotRev){
      entry.dirty=false;entry.status=data.status;saveState(submit?'제출 완료':'저장됨');
    }else{
      entry.dirty=true;saveState('새 변경사항 저장 전…');
    }
    const saved=rows[0];
    const old=state.entries.findIndex(e=>e.id===saved.id);
    if(old>=0)state.entries[old]=saved;else state.entries.unshift(saved);
    state.entries.sort((a,b)=>new Date(b.updated_at)-new Date(a.updated_at));
    return true;
  })();
  entry.saving=task;
  try{
    await task;
    if(submit){
      if(entry.rev!==snapshotRev){notice('글이 변경되어 다시 제출해야 해요.',true);return false}
      setReadOnly(true);notice('선생님에게 글을 제출했어요 ✓');
      void window.WillenaMissionBasket?.recordCompletedActivity?.(entry.kind+':'+entry.id,'writing-genius');
    }else if(entry.dirty){
      state.timer=setTimeout(()=>void saveEntry(),350);
    }
    return true;
  }catch(error){
    saveState('저장 안 됨 · 다시 시도',true);
    if(error.code==='23505'&&entry.kind==='diary'){
      notice('오늘의 일기가 이미 있어요. 글 목록에서 다시 열어 주세요.',true);
    }else notice(error.message,true);
    entry.dirty=true;return false;
  }finally{
    if(entry.saving===task)entry.saving=null;
    $('wgSave').disabled=false;$('wgSubmit').disabled=false;
  }
}
async function backHome(fromPop=false){
  const entry=state.active;
  if(entry&&entry.dirty){
    const okay=await saveEntry({force:true});
    if(!okay){if(fromPop)history.pushState(navState('editor',entry.id),'');return}
  }else if(entry?.saving)await entry.saving.catch(()=>{});
  clearTimeout(state.timer);state.active=null;show('home');
  try{await reloadEntries()}catch(error){notice(error.message,true)}
  if(!fromPop){
    if(history.state?.[NAV]&&history.state.screen==='editor')history.replaceState(navState('home'),'');
    else history.replaceState(navState('home'),'');
  }
  window.scrollTo({top:0,behavior:'auto'});
}
async function popRoute(){
  const nav=history.state;
  if(nav?.[NAV]&&nav.screen==='practice'){
    show('practice');
    if(!practice.active)await practice.open(state.student).catch(error=>notice(error.message,true));
    return;
  }
  if(practice.active){
    const safe=await practice.closeForNavigation();
    if(!safe){history.pushState(navState('practice'),'');return}
  }
  if(nav?.[NAV]&&nav.screen==='editor'&&nav.id){
    const match=state.entries.find(e=>e.id===nav.id);
    if(match){openEditor(match,true);return}
  }
  await backHome(true);
}
async function bootstrap(){
  $('wgHome').hidden=true;$('wgEditor').hidden=true;
  notice('글을 불러오는 중…');
  try{
    const identity=await requestDeadline(studentIdentity());
    if(!identity.id)throw new Error('로그인 정보를 찾을 수 없어요.');
    state.student=identity;
    // The cookie-backed whoami response is not guaranteed to include class.
    // Resolve the same profile used by Sentence Genius before listing books.
    const profile=await requestDeadline(signedInProfile(identity.id));
    if(!['student','teacher','admin'].includes(profile.role))throw Error('학생 계정으로 로그인해 주세요.');
    if(!state.student.className)state.student.className=profile.className;
    await requestDeadline(authToken());
    // Eligibility limits creative writing only; Sentence Writing remains accessible.
    try{
      const eligibility=await requestDeadline(databaseApi('rpc/writing_genius_access_v1','POST','',{}));
      state.creativeAllowed=eligibility?.allowed===true;
    }catch(error){
      state.creativeAllowed=false;
      console.warn('[Writing Genius] Creative-writing eligibility unavailable:',error);
    }
    for(const kind of ['diary','topic']){
      const button=document.querySelector('[data-start="'+kind+'"]');
      if(button){
        button.disabled=!state.creativeAllowed;
        button.title=state.creativeAllowed?'':'레벨 4 이상 학생만 이용할 수 있어요';
      }
    }
    await requestDeadline(reloadEntries());
    // A teacher's continuation mission resumes the exact existing draft.
    // It never creates another entry or advances submission status.
    const draftId=new URLSearchParams(location.search).get('draft');
    if(draftId){
      try{
        const missions=await requestDeadline(databaseApi('rpc/writing_genius_student_draft_missions_v1','POST','',{}));
        const mission=(missions.entries||[]).find(row=>row.entry_id===draftId);
        const existing=state.entries.find(entry=>entry.id===draftId&&entry.status==='draft');
        if(!mission||!existing)throw Error('이 글쓰기 미션을 찾을 수 없어요.');
        openEditor(existing);
        let banner=document.getElementById('wgDraftTeacherMessage');
        if(!banner){
          banner=el('section','wg-draft-teacher-message');
          banner.id='wgDraftTeacherMessage';
          banner.style.cssText='margin:12px 0;padding:16px;border:1px solid #b7e8ed;border-radius:14px;background:#f3fcfd;color:#244a54;';
          $('wgEditor').prepend(banner);
        }
        banner.replaceChildren(el('strong','','선생님 피드백 · Teacher feedback'),
          el('p','',''+(mission.feedback_text||'글을 마무리해 주세요. 이어서 수정하고 제출하세요.')),
          el('small','','미션: 이어 쓰기 → 최종 수정 → 말하기 → 제출'));
        return;
      }catch(error){show('home');notice(error.message,true);return}
    }
    // Open the exact writing task selected in Mission HAM.
    const homeworkId=new URLSearchParams(location.search).get('homework');
    if(homeworkId){
      try{
        const route='/.netlify/functions/homework_api?action=list_assignments&mode=student';
        const response=await (window.WillenaAPI?.fetch?window.WillenaAPI.fetch(route,{credentials:'include'}):fetch(route,{credentials:'include'}));
        const data=await response.json();
        if(!response.ok||!data.success)throw Error('숙제를 확인할 수 없어요.');
        const hw=(data.assignments||[]).find(a=>a.id===homeworkId);
        if(!hw||String(hw.list_meta?.creative_type||hw.list_meta?.source_type)!=='writing_genius')throw Error('이 글쓰기 숙제를 찾을 수 없어요.');
        const kind=hw.list_meta?.kind;
        if((kind==='topic'||kind==='diary')&&!state.creativeAllowed)throw Error('일기와 주제 글쓰기는 레벨 4 이상 학생만 이용할 수 있어요.');
        if(kind==='topic'){
          const key='homework-'+hw.id;
          const custom={key,title:hw.title||'Topic writing',help:hw.list_meta?.prompt_text||hw.description||hw.title||'Write about this topic.',starters:[]};
          if(!prompts.topic.some(p=>p.key===key))prompts.topic.push(custom);
          const existing=state.entries.find(e=>e.kind==='topic'&&e.prompt_key===key);
          if(existing)openEditor(existing);
          else{
            const draft=createEntry('topic');
            draft.title=custom.title;draft.prompt_key=key;draft.prompt_text=custom.help;
            openEditor(draft);
          }
        }else if(kind==='sentence'){
          const bookId=hw.list_meta?.book_id,unitId=hw.list_meta?.unit_id;
          if(!bookId||!unitId)throw Error('교재 또는 단원이 지정되지 않은 문장 숙제예요.');
          show('practice');
          if(!(history.state?.[NAV]&&history.state.screen==='practice'))history.pushState(navState('practice'),'');
          await practice.open(state.student,{assignmentId:hw.id,bookId,unitId});
        }else if(kind==='diary'){
          const key='homework-'+hw.id;
          const custom={key,title:hw.title||'Daily diary',help:hw.list_meta?.prompt_text||hw.description||'Write your diary.',starters:[]};
          if(!prompts.diary.some(p=>p.key===key))prompts.diary.push(custom);
          const existing=state.entries.find(e=>e.kind==='diary'&&e.prompt_key===key);
          if(existing)openEditor(existing);
          else{
            const draft=createEntry('diary');
            draft.prompt_key=key;draft.prompt_text=custom.help;draft.title=custom.title;
            openEditor(draft);
          }
        }
        else throw Error('지원하지 않는 글쓰기 숙제예요.');
        return;
      }catch(e){notice(e.message,true)}
    }
    if(homeworkId)return;
    if(!history.state?.[NAV])history.replaceState(navState('home'),'');
    const route=history.state;
    if(route?.screen==='practice'){show('practice');await practice.open(state.student);return}
    const match=route?.screen==='editor'?state.entries.find(e=>e.id===route.id):null;
    if(match)openEditor(match,true);else show('home');
  }catch(error){
    show('home');notice(error.message+' 로그인 페이지에서 다시 시도해 주세요.',true);
  }finally{
    window.WillenaHomeworkDeepLinkSplash?.hide();
  }
}
let diaryStep=1,correctionIndex=0,corrections=[],diaryMode='write';
let diaryQuestionRenderer=null,diaryFullRenderer=null;
function setDiaryStep(step){
 if(!['diary','topic'].includes(state.active?.kind))return;
 diaryStep=step;
 $('wgDiarySteps').hidden=false;
 [...$('wgDiarySteps').children].forEach((node,i)=>node.classList.toggle('is-current',i===step-1));
 const visible=(id,yes)=>{$(id).hidden=!yes};
 visible('wgDiaryGuide',step===1);
 visible('wgPromptRow',step===1);
 visible('wgTitle',step===1);
 // The title's label is the parent of the input.
 $('wgTitle').closest('.wg-field').hidden=step!==1;
 visible('wgPaperScreen',step===2);
 visible('wgDiaryReview',step===3||step===4);
 visible('wgDiaryFeedback',step===3);
 visible('wgDiaryCorrection',step===4&&corrections.length>0&&correctionIndex<corrections.length);
 visible('wgDiarySpeaking',step===4&&correctionIndex>=corrections.length);
 visible('wgDiaryNavigation',step!==4);
 $('wgDiaryPrev').disabled=step===1;
 $('wgDiaryNext').textContent=step===2?'AI Willi 확인하기':'다음';
 $('wgSubmit').hidden=true;
 $('wgSave').hidden=step!==2;
 $('wgIdeasToggle').closest('.wg-help').hidden=step!==2;
 $('wgDiaryReviewStatus').hidden=step===1 || step===4;
}
function normalizeDiarySentence(value){return String(value||'').toLowerCase().replace(/[^a-z0-9']/g,' ').replace(/\s+/g,' ').trim()}
function diaryQuestion(item,mode){
 const target=item?.better||item?.english||'';
 return {form:mode==='speaking'?'speaking':'write',input:{language:'en'},prompt:'',context:{sentence:target},answer:[target]};
}
function showCurrentCorrection(){
 const item=corrections[correctionIndex];
 if(!item){showWholeDiary();return}
 setDiaryStep(4);
 $('wgDiaryQuestionCount').textContent=(correctionIndex+1)+' / '+corrections.length;
 $('wgDiaryQuestionLabel').textContent=item.original?'Sentence Correction':'New Expression';
 $('wgDiaryCorrectionTarget').textContent=item.why_ko||item.meaning_ko||'';
 $('wgDiaryCorrectionStatus').textContent='';
 diaryQuestionRenderer=new QuestionRenderer($('wgDiaryQuestionHost'));
 diaryQuestionRenderer.render(diaryQuestion(item,diaryMode));
 $('wgDiaryCorrectionCheck').disabled=false;
}
function acceptCorrection(){
 const target=corrections[correctionIndex]?.better||corrections[correctionIndex]?.english||'';
 const answer=diaryQuestionRenderer?.getResponse?.()||'';
 if(normalizeDiarySentence(answer)!==normalizeDiarySentence(target)){
  $('wgDiaryCorrectionStatus').textContent='다시 시도해 주세요.';
  return;
 }
 correctionIndex++;showCurrentCorrection();
}
function showWholeDiary(){
 setDiaryStep(4);
 $('wgDiaryFullText').textContent=$('wgBody').value;
 diaryFullRenderer=new QuestionRenderer($('wgDiaryFullSpeechHost'));
 diaryFullRenderer.render({form:'speaking',prompt:'',context:{},answer:[$('wgBody').value]});
 $('wgDiarySpeechStatus').textContent='';
}
async function diaryRequest(action,entryId,transcript,chosenLines){
 const call=async access=>fetch('/api/writing-genius-diary',{method:'POST',credentials:'include',cache:'no-store',
  headers:{Authorization:'Bearer '+access,'Content-Type':'application/json'},
  body:JSON.stringify({action,entry_id:entryId,...(transcript?{transcript}:{}),...(chosenLines?{chosen_lines:chosenLines}:{})}),signal:AbortSignal.timeout(action==='review'?80000:20000)});
 let response=await call(await authToken());
 if(response.status===401)response=await call(await authToken(true));
 const data=await response.json().catch(()=>({}));
 if(!response.ok||!data.success)throw Error(data.error||'AI Willi를 사용할 수 없어요.');
 return data;
}
function showDiaryFeedback(feedback){
 const root=$('wgDiaryFeedback');root.replaceChildren();
 const p=el('p','wg-diary-praise',feedback.praise_ko||'좋은 일기예요!');root.append(p);
 const count=(feedback.improvements||[]).length+(feedback.expressions||[]).length;
 root.append(el('p','wg-diary-tip',feedback.tip_ko||''));
 root.append(el('p','wg-diary-success',count?count+' sentences to practise':'좋은 문장은 그대로 유지해요.'));
 $('wgDiaryReview').hidden=false;
}
async function restoreDiaryReview(entry){
 try{
  const rows=await databaseApi('writing_genius_diary_reviews','GET','?select=original_body,feedback,spoken_at&entry_id=eq.'+encodeURIComponent(entry.id)+'&limit=1');
  if(state.active?.id!==entry.id||!Array.isArray(rows)||!rows[0]||rows[0].original_body!==$('wgBody').value)return;
  diaryReviewBody=rows[0].original_body;showDiaryFeedback(rows[0].feedback);
  setDiaryStep(3);
  if(rows[0].spoken_at){$('wgDiarySpeechStatus').textContent='말하기를 완료했어요. 제출 버튼을 눌러 주세요.';$('wgSubmit').textContent='일기 제출 완료하기';}
 }catch(error){console.warn('[Writing Genius] saved diary feedback unavailable',error)}
}
function diaryStatus(message='',error=false){
 const node=$('wgDiaryReviewStatus');if(!node)return;
 node.hidden=!message;node.textContent=message;node.classList.toggle('is-error',error);
}
async function reviewDiary(){
 if(diaryBusy||!state.active||state.active.kind!=='diary')return;
 diaryStatus('');
 const lines=fullDiarySentences($('wgBody').value);
 if(lines.length<6||lines.length>30||lines.some(line=>wordCount(line)<2)){
  diaryStatus('6~30개의 완성된 영어 문장을 써 주세요. 각 문장에 마침표, 물음표 또는 느낌표가 필요해요.',true);
  $('wgDiaryReviewStatus').scrollIntoView({block:'nearest'});
  $('wgBody').focus();return;
 }
 diaryBusy=true;$('wgSubmit').disabled=true;
 diaryStatus('일기를 저장하고 AI Willi에게 보내고 있어요…');
 try{
  const saved=await saveEntry({force:true});
  if(!saved){diaryStatus('일기 저장에 실패했어요. 다시 시도해 주세요.',true);return;}
  const current=state.active;
  const old=await databaseApi('writing_genius_diary_reviews','GET','?select=original_body,feedback,spoken_at&entry_id=eq.'+encodeURIComponent(current.id)+'&limit=1').catch(()=>null);
  if(Array.isArray(old)&&old[0]?.original_body===$('wgBody').value&&old[0].spoken_at){
    await saveEntry({submit:true,force:true});return;
  }
  diaryStatus('AI Willi (Luna)가 일기를 검토하고 있어요…');
  const result=await diaryRequest('review',current.id);
  if(state.active?.id!==current.id)return;
  diaryReviewBody=$('wgBody').value;
  showDiaryFeedback(result.feedback);
  $('wgDiarySpeechStatus').textContent='일기 전체를 처음부터 끝까지 읽어 주세요.';

  diaryTranscript='';diaryInterim='';
  setDiaryStep(3);
  diaryStatus('AI 피드백을 확인하고 일기 전체를 말해 주세요.');
 }catch(error){diaryStatus('AI Willi 오류: '+error.message,true);console.error('[Writing Genius] diary review failed',error)}
 finally{diaryBusy=false;$('wgSubmit').disabled=false}
}
async function checkDiarySpeech(){
 if(diaryBusy||state.active?.kind!=='diary')return;
 const entry=state.active;
 if(diaryReviewBody!==$('wgBody').value){notice('일기가 수정됐어요. 다시 AI Willi의 확인을 받아 주세요.',true);return}
 const fullTranscript=diaryFullRenderer?.getResponse?.()||'';
 if(!fullTranscript.trim()){$('wgDiarySpeechStatus').textContent='일기를 읽어 주세요.';return}
 diaryBusy=true;
 try{
  $('wgDiarySpeechStatus').textContent='전체 일기를 확인하고 있어요…';
  const result=await diaryRequest('speech',entry.id,fullTranscript);
  $('wgDiarySpeechStatus').textContent='말하기 완료! 인식률 '+result.coverage+'%. 일기를 제출하고 있어요.';
  const submitted=await saveEntry({submit:true,force:true});
  if(submitted){$('wgDiaryReview').hidden=true;notice('오늘의 일기와 말하기를 완료했어요! ✓')}
 }catch(error){$('wgDiarySpeechStatus').textContent=error.message}
 finally{diaryBusy=false}
}
$('wgDiaryNext').addEventListener('click',()=>{
 if(diaryStep===1){if(!$('wgTitle').value.trim()){diaryStatus('제목을 먼저 써 주세요.',true);return}setDiaryStep(2)}
 else if(diaryStep===2)void reviewDiary();
 else if(diaryStep===3)showCurrentCorrection();
});
$('wgDiaryPrev').addEventListener('click',()=>{if(diaryStep===2)setDiaryStep(1);else if(diaryStep===3)setDiaryStep(2)});
$('wgDiaryCorrectionCheck').addEventListener('click',acceptCorrection);
$('wgDiaryModeWrite').addEventListener('click',()=>{diaryMode='write';showCurrentCorrection()});
$('wgDiaryModeSpeak').addEventListener('click',()=>{diaryMode='speaking';showCurrentCorrection()});
const diaryFlow=createDiaryFlow({
 draft:async entry=>{
  $('wgTitle').value=entry.title;$('wgBody').value=entry.body;
  const saved=await saveEntry({force:true});if(!saved)throw Error('일기를 저장하지 못했어요.');
 },
 review:async entry=>{const result=await diaryRequest('review',entry.id);return result.feedback},
 clarify:async(entry,i,clarification)=>{const token=await authToken();const response=await fetch('/api/writing-genius-diary',{method:'POST',credentials:'include',cache:'no-store',headers:{Authorization:'Bearer '+token,'Content-Type':'application/json'},body:JSON.stringify({action:'clarify',entry_id:entry.id,correction_index:i,clarification}),signal:AbortSignal.timeout(45000)});const data=await response.json().catch(()=>({}));if(!response.ok||!data.success)throw Error(data.error||'다시 확인하지 못했어요.');return data},
 speech:async(entry,transcript,chosenLines)=>diaryRequest('speech',entry.id,transcript,chosenLines),
 teacherFeedback:async entry=>databaseApi('rpc/writing_genius_student_feedback_v1','POST','',{p_entry_id:entry.id}),
 claimBonus:async entry=>databaseApi('rpc/writing_genius_claim_bonus_v1','POST','',{p_entry_id:entry.id}),
 finish:async(entry,completion={})=>{
  if(state.active?.status!=='submitted'){
   const submitted=await saveEntry({submit:true,force:true});
   if(!submitted)throw Error('제출에 실패했어요.');
  }
  const reward=await databaseApi(entry.kind==='topic'?'rpc/award_writing_topic_v1':'rpc/award_writing_diary_v1','POST','',entry.kind==='topic'?{p_entry_id:entry.id,p_review_complete:completion.reviewComplete===true,p_spoken_complete:completion.speakingComplete===true}:{p_entry_id:entry.id});
  window.dispatchEvent(new CustomEvent('stars:refresh',{detail:{earned:reward.awarded?reward.stars:0}}));
  try{localStorage.setItem('stars:refresh',String(Date.now()))}catch{}
  return reward;
 },
 onExit:()=>backHome(),
 listDrafts:async kind=>{await reloadEntries();return state.entries.filter(entry=>entry.kind===kind&&entry.status==='draft'&&entry.submitted_at==null);},
 loadDraft:entry=>openEditor(entry)
});
const examplesRoot=$('wgDiaryExamplesList');
for(const example of exampleDiaries){
 const card=el('article','wg-diary-example');
 card.append(el('h3','',example.title),el('p','',example.text));
 examplesRoot.append(card);
}
$('wgDiaryExamplesOpen').addEventListener('click',()=>$('wgDiaryExamples').showModal());
$('wgDiaryExamplesClose').addEventListener('click',()=>$('wgDiaryExamples').close());
$('wgDiarySpeakCheck').addEventListener('click',()=>void checkDiarySpeech());
async function writingGrade(sessionId,questionIndex,answer){
  const call=async token=>fetch('/api/writing-genius-grade',{method:'POST',
    headers:{Authorization:'Bearer '+token,'Content-Type':'application/json'},
    credentials:'include',cache:'no-store',
    body:JSON.stringify({session_id:sessionId,question_index:questionIndex,answer}),
    signal:AbortSignal.timeout(28000)});
  let response=await call(await authToken());
  if(response.status===401)response=await call(await authToken(true));
  const data=await response.json().catch(()=>null);
  if(!response.ok||data?.success!==true){
    const error=new Error(data?.error||'AI Willi를 사용할 수 없어요.');
    error.code=data?.code||'';
    error.quota=data?.quota||null;
    throw error;
  }
  return data;
}
async function writingQuota(){
  const call=async token=>fetch('/api/writing-genius-grade?usage=1',{
    method:'GET',headers:{Authorization:'Bearer '+token},
    credentials:'include',cache:'no-store',signal:AbortSignal.timeout(12000)
  });
  let response=await call(await authToken());
  if(response.status===401)response=await call(await authToken(true));
  const data=await response.json().catch(()=>null);
  if(!response.ok||data?.success!==true||!data.quota)throw Error('Quota unavailable');
  return data.quota;
}
const practice=createSentencePractice({
  api:(method,path='',body=null)=>databaseApi('writing_genius_sentence_sessions',method,path,body),
  checksApi:(method,path='',body=null)=>databaseApi('writing_genius_sentence_checks',method,path,body),
  rewardsApi:()=>databaseApi('rpc/wg_sentence_unit_rewards_v1','POST','',{}),
  gradeSentence:writingGrade,
  quotaApi:writingQuota,
  onExit:()=>backHome()
});
document.querySelectorAll('[data-start]').forEach(button=>button.addEventListener('click',()=>{if(state.student)start(button.dataset.start)}));
$('wgOpenLibrary').addEventListener('click',()=>togglePortfolio(true));
$('wgCloseLibrary').addEventListener('click',()=>togglePortfolio(false));
$('wgHistoryFilter').addEventListener('change',e=>{state.filter=e.target.value;renderLibrary()});
$('wgBack').addEventListener('click',()=>void backHome());
$('wgSave').addEventListener('click',()=>void saveEntry({force:true}));
$('wgSubmit').addEventListener('click',()=>{if(state.active?.kind==='diary'){if(diaryStep===4)void checkDiarySpeech();else void reviewDiary()}else void saveEntry({submit:true,force:true});});
$('wgRevise').addEventListener('click',()=>{
  if(!state.active)return;
  if(state.active.kind==='diary'){notice('오늘의 일기는 이미 제출했어요. 내일 새 일기를 쓸 수 있어요.');return}state.active.status='draft';setReadOnly(false);
  markDirty();$('wgBody').focus();notice('고쳐 쓴 뒤 다시 제출할 수 있어요.');
});
$('wgTitle').addEventListener('input',markDirty);
$('wgBody').addEventListener('input',markDirty);
$('wgPromptSelect').addEventListener('change',()=>{
  const a=state.active;if(!a)return;
  const prev=prompts[a.kind].find(p=>p.key===a.prompt_key);
  const next=prompts[a.kind].find(p=>p.key===$('wgPromptSelect').value);
  if(next&&a.kind==='topic'&&(!$('wgTitle').value.trim()||$('wgTitle').value===prev?.title))
    $('wgTitle').value=next.title;
  a.prompt_key=$('wgPromptSelect').value;renderHelp();markDirty();
});
$('wgIdeasToggle').addEventListener('click',()=>{
  const open=$('wgIdeas').hidden;$('wgIdeas').hidden=!open;
  $('wgIdeasToggle').setAttribute('aria-expanded',String(open));
  $('wgIdeasToggle').querySelector('span').textContent=open?'닫기':'보기';
});
window.addEventListener('popstate',()=>void popRoute());
window.addEventListener('beforeunload',event=>{
  if(state.active?.dirty){event.preventDefault();event.returnValue='';}
});

async function previewRewardSound(){try{const sfx=await import('/students/shared/student-sfx.js?v=20260927-startup2');sfx.playStudentSfx('complete');setTimeout(()=>sfx.playStudentSfx('star'),220)}catch{}}
function installTeacherRewardPreview(){
 if(new URLSearchParams(location.search).get('rewardPreview')!=='1')return;
 const layer=document.createElement('div');layer.className='wg-reward-demo-layer';
 layer.innerHTML='<section class="wg-reward-demo" role="dialog" aria-modal="true" aria-label="Teacher feedback reward preview"><button type="button" class="wg-demo-close" aria-label="Close preview">×</button><small>TEST PREVIEW · 실제 포인트는 지급되지 않습니다</small><h2>선생님 알림</h2><button class="wg-demo-message" type="button">선생님이 메시지를 보냈어요 · 보기</button><p class="wg-demo-message-body" hidden>Great work! I enjoyed reading your diary. Keep practising your English!</p><button class="wg-demo-claim" type="button"><svg viewBox="0 0 64 64" aria-hidden="true"><path d="M32 5 38 22 56 23 42 34 47 52 32 42 17 52 22 34 8 23 26 22Z" fill="none" stroke="currentColor" stroke-width="4" stroke-linejoin="round"/><circle cx="32" cy="32" r="5" fill="currentColor"/></svg>선생님 보너스 +20점 · 받기</button><div class="wg-demo-result" aria-live="polite"></div><button class="wg-demo-reset" type="button">다시 테스트</button></section>';
 document.body.append(layer);
 const close=()=>{layer.remove();const url=new URL(location.href);url.searchParams.delete('rewardPreview');history.replaceState({},'',url)};
 layer.querySelector('.wg-demo-close').onclick=close;
 layer.querySelector('.wg-demo-message').onclick=()=>{const body=layer.querySelector('.wg-demo-message-body');body.hidden=!body.hidden};
 const claim=layer.querySelector('.wg-demo-claim'),result=layer.querySelector('.wg-demo-result');
 claim.onclick=()=>{void previewRewardSound();claim.hidden=true;result.textContent='+20 POINTS!';result.classList.remove('is-playing');void result.offsetWidth;result.classList.add('is-playing')};
 layer.querySelector('.wg-demo-reset').onclick=()=>{claim.hidden=false;result.textContent='';result.classList.remove('is-playing');layer.querySelector('.wg-demo-message-body').hidden=true};
}
installTeacherRewardPreview();
void bootstrap();
