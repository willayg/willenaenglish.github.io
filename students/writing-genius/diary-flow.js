import {playStudentSfx} from '/students/shared/student-sfx.js?v=20260927-startup2';
import {QuestionRenderer} from '/shared/questions/question-renderer.js?v=20261023-speaking-ai1';
import {judgeSentenceSpeech} from '/students/shared/sentence-speech-tolerance.js?v=20261103-speech1';
const $=id=>document.getElementById(id);
const norm=s=>String(s||'').toLowerCase().replace(/[’‘]/g,"'").replace(/[^a-z0-9']/g,' ').replace(/\s+/g,' ').trim();
const split=s=>(String(s||'').match(/[^.!?\n]+[.!?]+(?=\s|$)/g)||[]).map(x=>x.trim()).filter(x=>/[a-z]/i.test(x));
// Speech transcripts write times differently from lesson text (11am vs 11:00 a.m.).
// Canonicalize common clock readings before word-level edit-distance scoring.
function speechWords(value){
 let s=String(value||'').toLowerCase().replace(/[’‘]/g,"'");
 s=s.replace(/\b(\d{1,2})(?::(00))?\s*(a\s*\.?\s*m\.?|p\s*\.?\s*m\.?)\b/g,(_,hour,_zero,period)=>hour+' '+period.replace(/[^apm]/g,''));
 s=s.replace(/\b(\d{1,2}):00\b/g,'$1');
 s=s.replace(/\b(\d{1,2})\s*o['’]?clock\b/g,'$1');
 const numbers={zero:'0',one:'1',two:'2',three:'3',four:'4',five:'5',six:'6',seven:'7',eight:'8',nine:'9',ten:'10',eleven:'11',twelve:'12'};
 s=s.replace(/\b(zero|one|two|three|four|five|six|seven|eight|nine|ten|eleven|twelve)\b/g,word=>numbers[word]);
 return s.replace(/\b([ap])\s+m\b/g,'$1m').replace(/\b(\d{1,2})(am|pm)\b/g,'$1 $2').replace(/[^a-z0-9']/g,' ').replace(/\s+/g,' ').trim().split(' ').filter(Boolean);
}
// Classroom speaking judge, not a verbatim spelling test.
// Soft costs allow minor grammar/STT differences while preserving word order and meaning.
function spokenAccuracy(expected,heard){
 const a=speechWords(expected),b=speechWords(heard);
 if(!a.length||!b.length)return 0;
 const critical=w=>/^[0-9]+$/.test(w)||/^(am|pm|not|never|no)$/.test(w);
 const soft=w=>/^(a|an|the|to|of|at|in|on|and|is|are|was|were|it|i)$/.test(w);
 const match=(x,y)=>{
  if(x===y)return 0;
  if(critical(x)||critical(y))return 1;
  const stem=w=>w.replace(/(ing|ed|es|s)$/,'');
  if(x.length>=4&&y.length>=4&&stem(x)===stem(y))return .14;
  // A single transcription-letter error should not count like a different word.
  if(x.length>=5&&y.length>=5&&Math.abs(x.length-y.length)<=1){
   let i=0,j=0,d=0;
   while(i<x.length&&j<y.length&&d<2){
    if(x[i]===y[j]){i++;j++;continue}
    d++;
    if(x.length>y.length)i++;else if(y.length>x.length)j++;else{i++;j++}
   }
   if(d+Math.max(x.length-i,y.length-j)<=1)return .22;
  }
  return soft(x)||soft(y)?.38:.65;
 };
 const dp=Array.from({length:a.length+1},()=>Array(b.length+1).fill(0));
 for(let i=1;i<=a.length;i++)dp[i][0]=dp[i-1][0]+(critical(a[i-1])?1:soft(a[i-1])?.3:.65);
 for(let j=1;j<=b.length;j++)dp[0][j]=dp[0][j-1]+(critical(b[j-1])?1:soft(b[j-1])?.25:.45);
 for(let i=1;i<=a.length;i++)for(let j=1;j<=b.length;j++){
  dp[i][j]=Math.min(
   dp[i-1][j]+(critical(a[i-1])?1:soft(a[i-1])?.3:.65),
   dp[i][j-1]+(critical(b[j-1])?1:soft(b[j-1])?.25:.45),
   dp[i-1][j-1]+match(a[i-1],b[j-1])
  );
 }
 // Short or unrelated responses cannot pass through lenient scoring.
 const coverage=Math.min(1,b.length/a.length);
 if(coverage<.65)return Math.min(.7,coverage);
 return Math.max(0,1-dp[a.length][b.length]/Math.max(a.length,b.length));
}
const diaryTopics=[
 {title:'오늘의 일기',en:'My Day',guide:'What happened today? Who were you with? How did you feel?',example:'Today was a busy day. I went to school in the morning. I studied English with my friends. We ate lunch together. After school I played outside. I felt tired but happy.'},
 {title:'주말 계획',en:'Weekend Plans',guide:'Where will you go? Who will you meet? What do you want to do?',example:'This weekend I want to visit a park. I will go there with my family. We might ride our bikes. I want to have a picnic. I hope the weather is sunny. I think it will be fun.'},
 {title:'학교 생활',en:'School Life',guide:'What classes did you have? What happened at school? What did you enjoy?',example:'I went to school early today. My first class was math. I asked my teacher a question. At lunch I talked with my friends. We played soccer after class. I had a good day at school.'},
 {title:'나의 가족',en:'My Family',guide:'Who is in your family? What do you do together? What makes them special?',example:'I live with my family. We like eating dinner together. My sister makes me laugh. My dad helps me with homework. On Sundays we go for a walk. I love spending time with them.'},
 {title:'내가 좋아하는 음식',en:'My Favorite Food',guide:'What food do you like? What does it taste like? When do you eat it?',example:'My favorite food is pizza. I love cheese and tomatoes. My family orders pizza on Fridays. I usually eat two slices. Sometimes I make pizza at home. I want to try a new topping next time.'},
 {title:'친구와의 하루',en:'A Day With Friends',guide:'Who did you meet? What did you do together? How did you feel?',example:'I met my friend after school. We went to the playground. First we played basketball. Then we bought a snack. We talked about our favorite games. I had a great time with my friend.'},
 {title:'나의 취미',en:'My Hobbies',guide:'What do you enjoy doing? When do you do it? Why do you like it?',example:'I like drawing pictures. I usually draw after dinner. My favorite thing to draw is animals. Sometimes I watch drawing videos. I want to get better at coloring. Drawing helps me relax.'},
 {title:'특별했던 날',en:'A Special Day',guide:'What made the day special? Who was there? What happened first and next?',example:'Yesterday was my birthday. My friends came to my house. We played games together. My mom made a cake. Everyone sang a birthday song. It was a day I will remember.'},
 {title:'가고 싶은 곳',en:'A Place I Want to Visit',guide:'Where do you want to go? Why? What would you do there?',example:'I want to visit Jeju Island. I would like to see the sea. I want to walk on the beach. I hope to try delicious food. I would take lots of pictures. I think the trip would be exciting.'},
 {title:'나의 꿈',en:'My Dream',guide:'What do you want to be or do? Why? How can you work toward it?',example:'I want to become a scientist. I enjoy learning about space. I read books about planets. I want to build a robot one day. I will study hard at school. I hope my dream comes true.'}
];
const topicWritingIdeas=[
 {title:'A Mysterious Door',guide:'Fiction · Who finds the door? What happens next? How does the story end?',example:'I found a tiny door behind our school library. Nobody had noticed it before.\n\nI opened it and stepped into a garden full of glowing trees. A small fox asked me to help find its lost key. We searched under the flowers and beside a pond. Finally, I found the key inside an old wooden box.\n\nThe fox thanked me and showed me the way home. I will never forget that strange afternoon.'},
 {title:'Should Kids Have Pets?',guide:'Opinion · State your opinion, give reasons and examples, then conclude.',example:'I think having a pet can be good for children. Pets can teach us how to be responsible.\n\nFirst, children must remember to give pets food and water. They also learn to care for another living thing. For example, my friend walks her dog every morning. However, pets also need time and money.\n\nIn my opinion, families should think carefully before getting a pet. A pet is a friend, but it is also a responsibility.'},
 {title:'The Best Place in My Town',guide:'Description · Introduce the place, describe it with details, and finish with your thoughts.',example:'My favorite place in my town is the park near my house. I go there whenever I have free time.\n\nThe park has tall trees and a small lake. Children ride their bicycles along the paths. There is a playground beside the lake. I like sitting on a bench and watching the ducks.\n\nThis park helps me relax after a busy day. I hope it stays beautiful for many years.'},
 {title:'The Day Everything Turned Blue',guide:'Fiction · Introduce the strange event, show the problem and solution, and end the story.',example:'When I woke up, everything in my room was blue. Even my breakfast looked like blue paint.\n\nAt school, my friends were surprised too. We discovered that a strange cloud was floating over the town. I climbed the hill with my sister to see it. We found a tiny robot that was making blue smoke. I helped the robot fix its broken machine.\n\nThe cloud disappeared before sunset. The next morning, the world had its normal colors again.'},
 {title:'My Dream Invention',guide:'Nonfiction or imagination · Explain your invention, how it works, and why it matters.',example:'I would like to invent a robot that cleans the ocean. Many sea animals are hurt by plastic waste.\n\nMy robot would swim under the water and collect rubbish. It would use a camera to avoid fish. A small boat could collect the plastic from the robot. People could use these robots near beaches and islands.\n\nI hope my invention could help protect sea animals. Even a small invention can make a big difference.'},
 {title:'A Letter to My Future Self',guide:'Personal writing · Introduce your future self, share your hopes, and finish with a message.',example:'Dear future me, I wonder what your life is like now. I hope you are happy and healthy.\n\nToday I enjoy playing guitar and spending time with my friends. I sometimes worry about difficult schoolwork. I hope you still try new things even when they are hard. Please remember the people who helped you grow.\n\nI want you to stay kind and curious. From your younger self, good luck!'},
 {title:'A Trip to Another Planet',guide:'Fiction · Set the scene, describe the adventure, and give the story an ending.',example:'Our spaceship landed on a purple planet. I looked out of the window and saw three moons.\n\nMy team walked carefully across the strange ground. We discovered a river that shone in the dark. Suddenly, a friendly alien appeared beside us. It showed us a beautiful city inside a mountain. We took pictures and thanked our new friend.\n\nAt last, we flew back toward Earth. I knew I would always remember my first space adventure.'},
 {title:'Why Exercise Is Important',guide:'Explanation · Introduce the subject, give reasons and examples, and summarize.',example:'Exercise is important for our bodies and minds. There are many ways to be active every day.\n\nFirst, exercise helps us stay strong and healthy. Running and cycling can also improve our energy. Playing sports with friends teaches us teamwork. Even a short walk can help us feel calmer.\n\nWe do not need to be great athletes to exercise. Small healthy habits can make a difference.'},
 {title:'The Missing School Lunch',guide:'Mystery · Introduce a problem, follow clues, and reveal what happened.',example:'My lunch disappeared from my bag on Monday morning. I was sure I had packed it before school.\n\nI checked my classroom and asked my friends for help. We found a trail of crumbs near the hallway. The crumbs led us to the music room. Behind a chair, we discovered a hungry kitten beside my lunchbox. I gave the kitten some water and called a teacher.\n\nThe mystery was finally solved. I brought an extra sandwich the next day.'},
 {title:'A Person Who Inspires Me',guide:'Nonfiction · Introduce the person, give specific examples, and end with what you learned.',example:'My grandmother is someone I admire. She is kind and always ready to help.\n\nShe grows vegetables in a small garden. Every weekend, she shares them with our family. She also listens carefully when I have a problem. Last year, she taught me how to plant tomatoes.\n\nMy grandmother shows me that little acts of kindness matter. I hope to help others as she does.'}
];

// Additional random-only topics share the same writing scaffolding, but are not all shown in the dropdown.
const extraTopicIdeas=[{"title":"The Robot in My Backpack","guide":"Fiction · Introduce the characters, tell what happened, and finish the story."},{"title":"The Secret Under the Playground","guide":"Fiction · Introduce the characters, tell what happened, and finish the story."},{"title":"My Teacher Is an Alien","guide":"Fiction · Introduce the characters, tell what happened, and finish the story."},{"title":"A Message from the Moon","guide":"Fiction · Introduce the characters, tell what happened, and finish the story."},{"title":"The Day My Shadow Ran Away","guide":"Fiction · Introduce the characters, tell what happened, and finish the story."},{"title":"The Library That Moved","guide":"Fiction · Introduce the characters, tell what happened, and finish the story."},{"title":"A Dragon at the Bus Stop","guide":"Fiction · Introduce the characters, tell what happened, and finish the story."},{"title":"The Tiny City in My Garden","guide":"Fiction · Introduce the characters, tell what happened, and finish the story."},{"title":"The Last Cookie on Earth","guide":"Fiction · Introduce the characters, tell what happened, and finish the story."},{"title":"A Map That Changes","guide":"Fiction · Introduce the characters, tell what happened, and finish the story."},{"title":"The Invisible Bicycle","guide":"Fiction · Introduce the characters, tell what happened, and finish the story."},{"title":"The Midnight School Bell","guide":"Fiction · Introduce the characters, tell what happened, and finish the story."},{"title":"The Cat Who Could Talk","guide":"Fiction · Introduce the characters, tell what happened, and finish the story."},{"title":"A Door Behind the Fridge","guide":"Fiction · Introduce the characters, tell what happened, and finish the story."},{"title":"The Island of Lost Toys","guide":"Fiction · Introduce the characters, tell what happened, and finish the story."},{"title":"A Cloud in My Bedroom","guide":"Fiction · Introduce the characters, tell what happened, and finish the story."},{"title":"The Great Pillow Escape","guide":"Fiction · Introduce the characters, tell what happened, and finish the story."},{"title":"The Time-Traveling Lunchbox","guide":"Fiction · Introduce the characters, tell what happened, and finish the story."},{"title":"My Shoes Took Me Somewhere","guide":"Fiction · Introduce the characters, tell what happened, and finish the story."},{"title":"The Snowman in Summer","guide":"Fiction · Introduce the characters, tell what happened, and finish the story."},{"title":"The Day Gravity Stopped","guide":"Fiction · Introduce the characters, tell what happened, and finish the story."},{"title":"A Friendly Ghost in Class","guide":"Fiction · Introduce the characters, tell what happened, and finish the story."},{"title":"The Mystery of the Blue Key","guide":"Fiction · Introduce the characters, tell what happened, and finish the story."},{"title":"The Forest That Whispered","guide":"Fiction · Introduce the characters, tell what happened, and finish the story."},{"title":"An Unexpected Superpower","guide":"Fiction · Introduce the characters, tell what happened, and finish the story."},{"title":"The Train to Tomorrow","guide":"Fiction · Introduce the characters, tell what happened, and finish the story."},{"title":"The Monster Who Hated Scary Things","guide":"Fiction · Introduce the characters, tell what happened, and finish the story."},{"title":"The Vanishing Classroom","guide":"Fiction · Introduce the characters, tell what happened, and finish the story."},{"title":"The Secret of the Old Clock","guide":"Fiction · Introduce the characters, tell what happened, and finish the story."},{"title":"When All the Phones Disappeared","guide":"Fiction · Introduce the characters, tell what happened, and finish the story."},{"title":"My Funniest School Day","guide":"Personal · Say what happened, describe details, and explain how you felt."},{"title":"A Time I Was Brave","guide":"Personal · Say what happened, describe details, and explain how you felt."},{"title":"The Best Surprise Ever","guide":"Personal · Say what happened, describe details, and explain how you felt."},{"title":"A Day I Would Repeat","guide":"Personal · Say what happened, describe details, and explain how you felt."},{"title":"A Mistake That Taught Me Something","guide":"Personal · Say what happened, describe details, and explain how you felt."},{"title":"My Perfect Saturday","guide":"Personal · Say what happened, describe details, and explain how you felt."},{"title":"A Time I Helped Someone","guide":"Personal · Say what happened, describe details, and explain how you felt."},{"title":"My Favorite Family Tradition","guide":"Personal · Say what happened, describe details, and explain how you felt."},{"title":"A Food I Will Never Forget","guide":"Personal · Say what happened, describe details, and explain how you felt."},{"title":"My First Big Challenge","guide":"Personal · Say what happened, describe details, and explain how you felt."},{"title":"The Best Gift I Ever Got","guide":"Personal · Say what happened, describe details, and explain how you felt."},{"title":"A Day Without My Phone","guide":"Personal · Say what happened, describe details, and explain how you felt."},{"title":"My Most Embarrassing Moment","guide":"Personal · Say what happened, describe details, and explain how you felt."},{"title":"A Friend Who Helped Me","guide":"Personal · Say what happened, describe details, and explain how you felt."},{"title":"An Adventure with My Family","guide":"Personal · Say what happened, describe details, and explain how you felt."},{"title":"A Time I Felt Proud","guide":"Personal · Say what happened, describe details, and explain how you felt."},{"title":"The Happiest Day This Year","guide":"Personal · Say what happened, describe details, and explain how you felt."},{"title":"Something I Want to Learn","guide":"Personal · Say what happened, describe details, and explain how you felt."},{"title":"My Dream Bedroom","guide":"Personal · Say what happened, describe details, and explain how you felt."},{"title":"A Place I Want to Visit","guide":"Personal · Say what happened, describe details, and explain how you felt."},{"title":"My Favorite Childhood Memory","guide":"Personal · Say what happened, describe details, and explain how you felt."},{"title":"A Difficult Choice I Made","guide":"Personal · Say what happened, describe details, and explain how you felt."},{"title":"An Animal I Will Always Remember","guide":"Personal · Say what happened, describe details, and explain how you felt."},{"title":"One Thing That Makes Me Laugh","guide":"Personal · Say what happened, describe details, and explain how you felt."},{"title":"A Rainy Day Adventure","guide":"Personal · Say what happened, describe details, and explain how you felt."},{"title":"Should Schools Have More Breaks?","guide":"Opinion · Say what you think, explain why, and finish with your opinion."},{"title":"Is Homework Helpful?","guide":"Opinion · Say what you think, explain why, and finish with your opinion."},{"title":"Should Children Choose Their Bedtime?","guide":"Opinion · Say what you think, explain why, and finish with your opinion."},{"title":"Are Video Games Good for Kids?","guide":"Opinion · Say what you think, explain why, and finish with your opinion."},{"title":"Should Every Class Have a Pet?","guide":"Opinion · Say what you think, explain why, and finish with your opinion."},{"title":"Is Summer Better Than Winter?","guide":"Opinion · Say what you think, explain why, and finish with your opinion."},{"title":"Should Lunch Be Longer?","guide":"Opinion · Say what you think, explain why, and finish with your opinion."},{"title":"Are Books Better Than Movies?","guide":"Opinion · Say what you think, explain why, and finish with your opinion."},{"title":"Should Students Wear Uniforms?","guide":"Opinion · Say what you think, explain why, and finish with your opinion."},{"title":"Is It Better to Live by the Sea?","guide":"Opinion · Say what you think, explain why, and finish with your opinion."},{"title":"Should Schools Have Gardens?","guide":"Opinion · Say what you think, explain why, and finish with your opinion."},{"title":"Is Learning Music Important?","guide":"Opinion · Say what you think, explain why, and finish with your opinion."},{"title":"Should Children Do Chores?","guide":"Opinion · Say what you think, explain why, and finish with your opinion."},{"title":"Is Teamwork Better Than Working Alone?","guide":"Opinion · Say what you think, explain why, and finish with your opinion."},{"title":"Should We Have a Four-Day School Week?","guide":"Opinion · Say what you think, explain why, and finish with your opinion."},{"title":"Should Everyone Learn to Cook?","guide":"Opinion · Say what you think, explain why, and finish with your opinion."},{"title":"Are Zoos Good for Animals?","guide":"Opinion · Say what you think, explain why, and finish with your opinion."},{"title":"Should Robots Help Teachers?","guide":"Opinion · Say what you think, explain why, and finish with your opinion."},{"title":"Is Being Kind More Important Than Winning?","guide":"Opinion · Say what you think, explain why, and finish with your opinion."},{"title":"Should Students Get More Art Classes?","guide":"Opinion · Say what you think, explain why, and finish with your opinion."},{"title":"Should Phones Be Allowed at School?","guide":"Opinion · Say what you think, explain why, and finish with your opinion."},{"title":"Do Pets Make People Happier?","guide":"Opinion · Say what you think, explain why, and finish with your opinion."},{"title":"Should We Save More Water?","guide":"Opinion · Say what you think, explain why, and finish with your opinion."},{"title":"Is Traveling Better Than Staying Home?","guide":"Opinion · Say what you think, explain why, and finish with your opinion."},{"title":"Should Everyone Plant a Tree?","guide":"Opinion · Say what you think, explain why, and finish with your opinion."},{"title":"How to Care for a Puppy","guide":"Explanation · Introduce the idea, give details and examples, and finish clearly."},{"title":"Why Bees Matter","guide":"Explanation · Introduce the idea, give details and examples, and finish clearly."},{"title":"How to Make a New Friend","guide":"Explanation · Introduce the idea, give details and examples, and finish clearly."},{"title":"Why We Need Sleep","guide":"Explanation · Introduce the idea, give details and examples, and finish clearly."},{"title":"How to Stay Safe on a Bike","guide":"Explanation · Introduce the idea, give details and examples, and finish clearly."},{"title":"Why the Ocean Is Important","guide":"Explanation · Introduce the idea, give details and examples, and finish clearly."},{"title":"How to Plan a Picnic","guide":"Explanation · Introduce the idea, give details and examples, and finish clearly."},{"title":"What Makes a Good Team","guide":"Explanation · Introduce the idea, give details and examples, and finish clearly."},{"title":"How to Reduce Plastic Waste","guide":"Explanation · Introduce the idea, give details and examples, and finish clearly."},{"title":"Why People Learn Languages","guide":"Explanation · Introduce the idea, give details and examples, and finish clearly."},{"title":"How Plants Grow","guide":"Explanation · Introduce the idea, give details and examples, and finish clearly."},{"title":"How to Prepare for a School Trip","guide":"Explanation · Introduce the idea, give details and examples, and finish clearly."},{"title":"Why Exercise Helps Our Mood","guide":"Explanation · Introduce the idea, give details and examples, and finish clearly."},{"title":"What Makes a Healthy Lunch","guide":"Explanation · Introduce the idea, give details and examples, and finish clearly."},{"title":"How to Make a Paper Airplane","guide":"Explanation · Introduce the idea, give details and examples, and finish clearly."},{"title":"Why We Should Recycle","guide":"Explanation · Introduce the idea, give details and examples, and finish clearly."},{"title":"How to Welcome a New Student","guide":"Explanation · Introduce the idea, give details and examples, and finish clearly."},{"title":"What Makes a Good Leader","guide":"Explanation · Introduce the idea, give details and examples, and finish clearly."},{"title":"How to Save Money for Something Special","guide":"Explanation · Introduce the idea, give details and examples, and finish clearly."},{"title":"Why Kind Words Matter","guide":"Explanation · Introduce the idea, give details and examples, and finish clearly."},{"title":"How to Make a Rainy Day Fun","guide":"Explanation · Introduce the idea, give details and examples, and finish clearly."},{"title":"Why Animals Need Habitats","guide":"Explanation · Introduce the idea, give details and examples, and finish clearly."},{"title":"How to Organize Your Desk","guide":"Explanation · Introduce the idea, give details and examples, and finish clearly."},{"title":"What Makes a Great Story","guide":"Explanation · Introduce the idea, give details and examples, and finish clearly."},{"title":"Why We Should Protect Forests","guide":"Explanation · Introduce the idea, give details and examples, and finish clearly."},{"title":"If I Could Fly for One Day","guide":"Imagination · Set the scene, describe your idea, and end it clearly."},{"title":"If Animals Ran Our School","guide":"Imagination · Set the scene, describe your idea, and end it clearly."},{"title":"If I Had a Magic Pencil","guide":"Imagination · Set the scene, describe your idea, and end it clearly."},{"title":"If I Lived Underwater","guide":"Imagination · Set the scene, describe your idea, and end it clearly."},{"title":"If My House Could Walk","guide":"Imagination · Set the scene, describe your idea, and end it clearly."},{"title":"If I Were Principal for a Day","guide":"Imagination · Set the scene, describe your idea, and end it clearly."},{"title":"If I Found a Dinosaur Egg","guide":"Imagination · Set the scene, describe your idea, and end it clearly."},{"title":"If I Could Shrink to Ant Size","guide":"Imagination · Set the scene, describe your idea, and end it clearly."},{"title":"If I Could Talk to Trees","guide":"Imagination · Set the scene, describe your idea, and end it clearly."},{"title":"If My Toys Came Alive","guide":"Imagination · Set the scene, describe your idea, and end it clearly."},{"title":"If I Could Build a Theme Park","guide":"Imagination · Set the scene, describe your idea, and end it clearly."},{"title":"If I Invented a New Holiday","guide":"Imagination · Set the scene, describe your idea, and end it clearly."},{"title":"If I Could Visit the Future","guide":"Imagination · Set the scene, describe your idea, and end it clearly."},{"title":"If I Found a Treasure Chest","guide":"Imagination · Set the scene, describe your idea, and end it clearly."},{"title":"If I Could Change One School Rule","guide":"Imagination · Set the scene, describe your idea, and end it clearly."},{"title":"If I Had a Robot Friend","guide":"Imagination · Set the scene, describe your idea, and end it clearly."},{"title":"If I Could Make a New Planet","guide":"Imagination · Set the scene, describe your idea, and end it clearly."},{"title":"If I Lived in a Castle","guide":"Imagination · Set the scene, describe your idea, and end it clearly."},{"title":"If I Were Invisible for One Hour","guide":"Imagination · Set the scene, describe your idea, and end it clearly."},{"title":"If I Could Swap Places with a Bird","guide":"Imagination · Set the scene, describe your idea, and end it clearly."},{"title":"If I Opened My Own Restaurant","guide":"Imagination · Set the scene, describe your idea, and end it clearly."},{"title":"If I Could Stop Time","guide":"Imagination · Set the scene, describe your idea, and end it clearly."},{"title":"If I Discovered a New Animal","guide":"Imagination · Set the scene, describe your idea, and end it clearly."},{"title":"If I Could Send a Letter to Space","guide":"Imagination · Set the scene, describe your idea, and end it clearly."},{"title":"If I Woke Up as a Giant","guide":"Imagination · Set the scene, describe your idea, and end it clearly."}];
const allTopicIdeas=[...topicWritingIdeas,...extraTopicIdeas.map(item=>({...item,example:''}))];
const el=(tag,cls='',value='')=>{const n=document.createElement(tag);if(cls)n.className=cls;n.textContent=value;return n};
export function createDiaryFlow({draft,review,clarify,speech,finish,teacherFeedback,claimBonus,onExit}){
 const root=$('wgDiaryFlow'),stage=$('dfStage'),actions=$('dfActions'),message=$('dfMessage'),progress=$('dfProgress');
 let current=null,step='topic',feedback=null,practice=[],index=0,mode='write',renderer=null,finalLines=[],spoken=[],reviewSkipped=false,speechSkipped=false,busy=false,autosaveTimer=null,transitionTimer=null,choices={},captureDraft=null;
 function button(label,fn,primary=false){const b=el('button','wg-button '+(primary?'wg-primary':'wg-secondary'),label);b.type='button';b.addEventListener('click',fn);actions.append(b);return b}
 function status(text='',error=false){message.textContent=text;message.classList.toggle('is-error',error)}
 function screen(name,label){clearTimeout(transitionTimer);captureDraft=null;step=name;stage.replaceChildren();actions.replaceChildren();status();progress.textContent=label;root.hidden=false}
 async function persist(){clearTimeout(autosaveTimer);await draft(current)}
 async function close(){if(busy)return;clearTimeout(transitionTimer);clearTimeout(autosaveTimer);if(current?.status!=='submitted'){captureDraft?.();busy=true;status('저장 중…');try{await persist()}catch(e){status('저장 실패: '+(e.message||'다시 시도해 주세요.'),true);busy=false;return}busy=false}root.hidden=true;current=null;await onExit()}
 $('dfExit').addEventListener('click',close);
 function topic(){
  screen('topic','1 · Topic');
  const isTopic=current.kind==='topic';const ideas=isTopic?allTopicIdeas:diaryTopics;
  const heading=el('h2','df-heading',isTopic?'주제 글쓰기':'오늘의 일기');stage.append(heading);
  const selected=ideas.find(t=>t.title===current.title||t.en===current.title);
  const picker=el('div','df-topic-picker');
  const choose=el('button','df-topic-trigger');choose.type='button';choose.setAttribute('aria-expanded','false');
  const menu=el('div','df-topic-menu');menu.hidden=true;
  const titleInput=el('input','df-input');titleInput.type='text';titleInput.maxLength=120;titleInput.placeholder='My own title';titleInput.setAttribute('aria-label','My own diary title');
  const guide=el('p','df-muted df-topic-guide');
  const examplesBtn=el('button','wg-button wg-secondary','예시 일기 보기');examplesBtn.type='button';
  const exampleBox=el('article','df-example df-topic-example');exampleBox.hidden=true;
  const exampleTitle=el('strong',''),exampleText=el('p','');exampleBox.append(exampleTitle,exampleText);
  let active=selected||null;
  function render(){
   choose.textContent=active?(active.title+(active.en?' · '+active.en:'')):'직접 제목 쓰기';
   titleInput.hidden=!!active;
   if(active)current.title=active.title;
   else titleInput.value=current.title||'';
   guide.textContent=active?active.guide:'Write about anything you like. What happened? How did you feel?';
   const example=active||ideas[0];
   exampleTitle.textContent=example.en||example.title;exampleText.textContent=example.example||'Write at least 8 sentences about this topic. Introduce the idea, develop it with details, and finish clearly.';
   [...menu.querySelectorAll('[data-topic-index]')].forEach(btn=>btn.classList.toggle('is-selected',btn.dataset.topicIndex===String(active?ideas.indexOf(active):-1)));
  }
  const closeMenu=()=>{menu.hidden=true;choose.setAttribute('aria-expanded','false')};
  choose.addEventListener('click',()=>{menu.hidden=!menu.hidden;choose.setAttribute('aria-expanded',String(!menu.hidden))});
  (isTopic?[...ideas.slice(0,6),...(selected&&!ideas.slice(0,6).includes(selected)?[selected]:[])]:ideas).forEach((item,i)=>{
   const option=el('button','df-topic-option',item.title+(item.en?' · '+item.en:''));option.type='button';option.dataset.topicIndex=String(ideas.indexOf(item));
   option.addEventListener('click',()=>{active=item;render();closeMenu()});menu.append(option);
  });
  const custom=el('button','df-topic-option','✎ 직접 제목 쓰기 · My Own Topic');custom.type='button';custom.dataset.topicIndex='-1';
  custom.addEventListener('click',()=>{active=null;current.title='';render();closeMenu();titleInput.focus()});menu.append(custom);
  titleInput.addEventListener('input',()=>{current.title=titleInput.value});
  if(isTopic){
   const random=el('button','df-random-topic','Random Topic · 랜덤 주제');random.type='button';random.setAttribute('aria-label','Choose a random writing topic');
   random.onclick=()=>{
    if(random.disabled)return;random.disabled=true;random.classList.add('is-spinning');
    const AudioContext=window.AudioContext||window.webkitAudioContext;
    let audio=null;
    try{if(AudioContext){audio=new AudioContext();void audio.resume().catch(()=>{})}}catch{}
    const tick=(win=false)=>{
      if(!audio||audio.state!=='running')return;
      try{const o=audio.createOscillator(),g=audio.createGain(),t=audio.currentTime;
        o.type='triangle';o.frequency.setValueAtTime(win?680:450,t);o.frequency.exponentialRampToValueAtTime(win?850:260,t+.035);
        g.gain.setValueAtTime(.0001,t);g.gain.exponentialRampToValueAtTime(win?.09:.04,t+.008);g.gain.exponentialRampToValueAtTime(.0001,t+.065);
        o.connect(g);g.connect(audio.destination);o.start(t);o.stop(t+.07)}catch{}
    };
    let spins=0,last=-1;
    const step=()=>{
      let next=Math.floor(Math.random()*ideas.length);
      if(ideas.length>1&&next===last)next=(next+1)%ideas.length;
      last=next;active=ideas[next];render();tick(spins===20);spins++;
      if(spins<21)setTimeout(step,Math.round(50+Math.pow(spins/21,2)*240));
      else{random.disabled=false;random.classList.remove('is-spinning');closeMenu();if(audio)setTimeout(()=>void audio.close().catch(()=>{}),320)}
    };
    step();
   };
   stage.append(random);
  }
  picker.append(choose,menu);
  stage.append(picker,titleInput,guide,examplesBtn,exampleBox);
  examplesBtn.addEventListener('click',()=>{exampleBox.hidden=!exampleBox.hidden;examplesBtn.setAttribute('aria-expanded',String(!exampleBox.hidden))});
  render();
  button('다음',async()=>{if(!current.title.trim()){status('제목을 써 주세요.',true);return}try{await persist();write()}catch(e){status(e.message,true)}},true);
 }
 function write(){
  screen('write','2 · Write');
  const count=el('span','df-count');const area=el('textarea','df-textarea');area.value=current.body||'';area.placeholder=current.kind==='topic'?'Write at least 8 sentences. Use paragraphs for the beginning, middle and ending.':'Write 6–30 complete sentences.';area.maxLength=12000;
  if(current.kind==='topic'){const guide=el('p','df-topic-write-guide','Beginning: introduce your idea or characters. Middle: develop the story or explain with details. Ending: finish clearly. Start a new paragraph for each part.');stage.append(guide)}
  function update(){current.body=area.value;const n=split(area.value).length;count.textContent=n+' sentences';count.classList.toggle('is-invalid',n<(current.kind==='topic'?8:6)||n>30)}
  captureDraft=()=>{current.body=area.value};
  area.addEventListener('input',()=>{update();clearTimeout(autosaveTimer);autosaveTimer=setTimeout(()=>{void persist().catch(e=>status(e.message,true))},1800)});update();stage.append(area,count);
  button('이전',topic);
  button('저장',async()=>{if(busy)return;busy=true;try{await persist();status('임시 저장됨 ✓')}catch(e){status(e.message,true)}finally{busy=false}});
  button('AI Willi 확인',async()=>{
   const count=split(current.body).length;if(count<(current.kind==='topic'?8:6)||count>30){status(current.kind==='topic'?'완성된 영어 문장을 8–30개 작성해 주세요.':'완성된 영어 문장 6–30개 작성해 주세요.',true);return}
   if(busy)return;busy=true;
   reviewLoading();
   try{await persist();feedback=await review(current);summary()}
   catch(e){write();status(e.message||'AI Willi 오류가 발생했어요.',true)}
   finally{busy=false}
  },true);
 }
 function reviewLoading(){
  screen('review-loading','AI Willi');
  const splash=el('section','df-ai-loading');
  splash.setAttribute('role','status');splash.setAttribute('aria-live','polite');
  splash.innerHTML=`
   <div class="df-ai-orbit" aria-hidden="true">
    <svg viewBox="0 0 180 180" fill="none" role="presentation">
      <circle cx="90" cy="90" r="73" class="df-ai-ring"/>
      <circle cx="90" cy="90" r="73" class="df-ai-ring-active"/>
      <g class="df-ai-robot">
        <path d="M90 33v13" stroke="#249aa5" stroke-width="5" stroke-linecap="round"/>
        <circle cx="90" cy="29" r="6" fill="#e75c9d"/>
        <rect x="49" y="47" width="82" height="83" rx="23" fill="#fff" stroke="#249aa5" stroke-width="5"/>
        <rect x="61" y="65" width="58" height="42" rx="13" fill="#e8fbfc" stroke="#8adce2" stroke-width="3"/>
        <g class="df-ai-robot-eyes"><rect x="70" y="79" width="10" height="14" rx="5" fill="#e75c9d"/><rect x="100" y="79" width="10" height="14" rx="5" fill="#e75c9d"/></g>
        <path d="M84 99q6 6 12 0" stroke="#249aa5" stroke-width="3" stroke-linecap="round"/>
        <path d="M49 79H39v24h10M131 79h10v24h-10" stroke="#249aa5" stroke-width="5" stroke-linejoin="round"/>
        <path d="M70 130v10m40-10v10" stroke="#249aa5" stroke-width="5" stroke-linecap="round"/>
      </g>
    </svg>
   </div>
   <h2>AI Willi</h2>
   <p>글을 읽고 있어요</p>
   <div class="df-ai-loading-dots" aria-hidden="true"><i></i><i></i><i></i></div>
  `;
  stage.append(splash);
 }
 function showTeacherFeedback(){
  if(!current?.id||!teacherFeedback)return;
  const entry={...current};
  void teacherFeedback(entry).then(data=>{
   if(entry.id!==current?.id||step!=='finish'||!data)return;
   stage.querySelector('.df-teacher-feedback')?.remove();
   if(!data.feedback&&!(data.bonus_points>0))return;
   const panel=el('section','df-teacher-feedback');
   panel.append(el('h3','','선생님 알림 · Teacher update'));
   if(data.feedback){
    const messageButton=el('button','df-teacher-alert','선생님이 메시지를 보냈어요 · 보기');
    messageButton.type='button';const body=el('p','df-teacher-message',data.feedback);body.hidden=true;
    messageButton.onclick=()=>{body.hidden=!body.hidden;messageButton.setAttribute('aria-expanded',String(!body.hidden))};
    panel.append(messageButton,body);
   }
   const pending=Math.max(0,Number(data.bonus_points||0)-Number(data.claimed_points||0));
   if(pending>0){
    const claim=el('button','df-bonus-claim');claim.type='button';
    const icon=document.createElementNS('http://www.w3.org/2000/svg','svg');icon.setAttribute('viewBox','0 0 64 64');icon.setAttribute('aria-hidden','true');
    icon.innerHTML='<path d="M32 5 38 22 56 23 42 34 47 52 32 42 17 52 22 34 8 23 26 22Z" fill="none" stroke="currentColor" stroke-width="4" stroke-linejoin="round"/><circle cx="32" cy="32" r="5" fill="currentColor"/>';
    claim.append(icon,el('span','','선생님 보너스 +'+pending+'점 · 받기'));
    const result=el('div','df-bonus-result');panel.append(claim,result);
    claim.onclick=async()=>{
     claim.disabled=true;claim.classList.add('is-claiming');
     try{
      const reward=await claimBonus(entry);
      claim.remove();
      if(reward.awarded>0){
       playStudentSfx('complete');setTimeout(()=>playStudentSfx('star'),250);
       const big=el('strong','df-bonus-reveal','+'+reward.awarded+' POINTS!');
       result.append(big,el('p','','보너스 포인트를 받았어요!'));
       try{window.dispatchEvent(new CustomEvent('stars:refresh',{detail:{earned:0}}));localStorage.setItem('stars:refresh',String(Date.now()))}catch{}
      }else result.textContent='이미 받은 보너스예요.';
     }catch(e){claim.disabled=false;claim.classList.remove('is-claiming');result.textContent=e.message||'다시 시도해 주세요.'}
    };
   }else if(data.bonus_points>0)panel.append(el('p','df-bonus-received','보너스 '+data.bonus_points+'점 받음 ✓'));
   stage.append(panel);
  }).catch(()=>{});
 }
 function choiceKey(){return 'willena-diary-choices:'+current.id+':'+current.body.length+':'+current.body.slice(0,32)}
 function saveChoices(){try{localStorage.setItem(choiceKey(),JSON.stringify(choices))}catch{}}
 function loadChoices(){try{const stored=JSON.parse(localStorage.getItem(choiceKey())||'{}');choices=stored&&typeof stored==='object'&&!Array.isArray(stored)?stored:{}}catch{choices={}}}
 function selectedText(change,i){
  const choice=choices[i]||'first';
  return choice==='original'?change.original:choice==='last'&&change.clarified_better?change.clarified_better:change.better;
 }
 function construct(){
  const corrections=(feedback?.improvements||[]).filter(x=>x.original&&x.better);
  const expressions=(feedback?.expressions||[]).filter(x=>x.english);
  practice=[...corrections.map((x,i)=>({target:selectedText(x,i),meaning:(choices[i]==='last'?x.clarified_translation_ko:x.translation_ko)||'',kind:'Correction',original:x.original})),...expressions.map(x=>({target:x.english,meaning:x.meaning_ko||'',kind:'New Expression'}))];
  const original=split(current.body);
  finalLines=original.map(line=>{
   for(let i=0;i<corrections.length;i++){
    const x=corrections[i];
    if(norm(line)===norm(x.original)||line.toLowerCase().includes(String(x.original).trim().toLowerCase()))return selectedText(x,i);
   }
   return line;
  });
 }
 function correctionType(change){
  const a=norm(change.original),b=norm(change.better);
  if(a===b)return 'Punctuation';
  const x=a.split(' '),y=b.split(' ');
  if(Math.abs(x.length-y.length)<=1&&x.filter(w=>!y.includes(w)).length<=1)return 'Grammar';
  return 'Better Expression';
 }
 function changedText(original,better,container){
  const a=String(original).split(/(\s+)/),b=String(better).split(/(\s+)/);
  let i=0,j=0;
  while(i<a.length&&j<b.length&&a[i]===b[j]){container.append(document.createTextNode(b[j]));i++;j++}
  let ai=a.length-1,bj=b.length-1;
  while(ai>=i&&bj>=j&&a[ai]===b[bj]){ai--;bj--}
  const changed=b.slice(j,bj+1).join('');
  if(changed)container.append(el('mark','df-diff',changed));
  container.append(document.createTextNode(b.slice(bj+1).join('')));
 }
 function secondDraft(){
  construct();screen('second-draft','Draft 2 · Revision');
  stage.append(el('h2','df-heading','두 번째 초안 · Draft 2'));
  const info=el('p','df-muted','AI가 고친 문장은 분홍색으로 표시돼요. 아래에서 내용을 추가하거나 바꿔 보세요.');
  stage.append(info);
  const changes=feedback?.improvements||[];
  const sourceParagraphs=String(current.body||'').split(/\n\s*\n/).filter(x=>x.trim());
  const correctedLine=line=>{
    const i=changes.findIndex(x=>norm(x.original)===norm(line));
    return i>=0?{text:selectedText(changes[i],i),changed:selectedText(changes[i],i)!==line}: {text:line,changed:false};
  };
  const originalLines=split(current.body);
  const corrected=originalLines.map(correctedLine);
  const preview=el('section','df-revision-preview');
  preview.append(el('h3','','AI Corrections · 수정된 문장'));
  const paper=el('div','df-revision-paper');
  for(const line of corrected){
    if(line.changed){const original=originalLines[corrected.indexOf(line)]||'';changedText(original,line.text,paper)}
    else paper.append(document.createTextNode(line.text));
    paper.append(document.createTextNode(' '));
  }
  preview.append(paper);
  const changeCount=corrected.filter(x=>x.changed).length;
  preview.append(el('small','df-muted',changeCount?changeCount+' sentences corrected · 분홍색 부분은 AI 수정':'문장 수정 없이 구조만 고칠 수 있어요.'));
  stage.append(preview);
  const structure=feedback?.structure||{};
  if(!feedback?.structure){
   const note=el('aside','df-revision-legacy-note');
   note.append(el('p','','이전 AI 리뷰에는 글의 구성 진단이 없어요. 아래 버튼으로 시작·가운데·마무리 안내를 새로 확인해 보세요.'));
   const reload=el('button','wg-button wg-secondary','구성 피드백 새로 확인');reload.type='button';
   reload.onclick=async()=>{if(busy)return;busy=true;reload.disabled=true;
    try{const updated=await review(current);feedback=updated;secondDraft()}
    catch(e){reload.disabled=false;status(e.message||'구성 피드백을 불러오지 못했어요.',true)}
    finally{busy=false}
   };note.append(reload);stage.append(note);
  }
  const roles=['beginning','middle','ending'];
  const titles=['Beginning · 시작','Middle · 가운데','Ending · 마무리'];
  const defaults=[
   '글의 주제나 등장인물을 간단히 소개해 보세요.',
   '무슨 일이 있었는지 또는 중요한 내용을 한두 문장 더 써 보세요.',
   '어떻게 끝났는지 또는 마지막 생각을 간단히 써 보세요.'
  ];
  // Prefer existing student paragraph breaks. For a single paragraph, provide editable sections
  // using a suggested split without pretending AI has identified exact boundaries.
  let sections;
  if(sourceParagraphs.length>=3){
    sections=[sourceParagraphs[0],sourceParagraphs.slice(1,-1).join('\n\n'),sourceParagraphs.at(-1)];
  }else if(sourceParagraphs.length===2){
    sections=[sourceParagraphs[0],sourceParagraphs[1],''];
  }else{
    const lines=originalLines;
    const start=Math.min(2,lines.length),end=Math.max(start,lines.length-2);
    sections=[lines.slice(0,start).join(' '),lines.slice(start,end).join(' '),lines.slice(end).join(' ')];
  }
  const correctedSection=text=>split(text).map(line=>correctedLine(line).text).join(' ');
  const fields=[];const counter=el('p','df-count');
  const initial=sections.map(correctedSection);
  const cacheKey='wg:topic:draft2:'+current.id+':'+String(feedback.review_round||1);
  try{const saved=JSON.parse(localStorage.getItem(cacheKey)||'null');if(Array.isArray(saved)&&saved.length===3&&saved.every(x=>typeof x==='string'))sections=saved;else sections=initial}catch{sections=initial}
  const allText=()=>fields.map(x=>x.value.trim()).filter(Boolean).join('\n\n');
  captureDraft=()=>{current.body=allText()};
  function update(){const n=split(allText()).length;counter.textContent=n+' sentences';counter.classList.toggle('is-invalid',n<8||n>30);try{localStorage.setItem(cacheKey,JSON.stringify(fields.map(x=>x.value)))}catch{}}
  roles.forEach((role,i)=>{
    const advice=structure[role]||{};
    const box=el('section','df-revision-section'+(advice.needs_work?' needs-work':''));
    const head=el('div','df-revision-section-heading');head.append(el('h3','',titles[i]));
    if(advice.needs_work)head.append(el('span','df-revision-needs','Add or improve · 보완하기'));
    box.append(head);
    if(advice.needs_work){
      box.append(el('p','df-revision-prompt',String(advice.advice_ko||defaults[i]).trim()));
      const example=String(advice.example_en||'').trim();
      if(example)box.append(el('p','df-revision-example','예시 · '+example));
    }
    const field=el('textarea','df-revision-input');field.value=sections[i]||'';field.maxLength=12000;field.placeholder=advice.needs_work?'Write your '+role+' here…':'Write your '+role+' here…';
    field.setAttribute('aria-label',titles[i]);field.addEventListener('input',update);fields.push(field);box.append(field);
    stage.append(box);
  });
  const suggestions=(feedback?.expressions||[]).filter(x=>x.english);
  if(suggestions.length){
   const box=el('section','df-revision-expressions');box.append(el('h3','','New Expressions · 새 표현'));
   box.append(el('p','df-muted','원하는 문장을 골라 알맞은 부분에 추가한 다음, 자신의 글에 맞게 고쳐 보세요.'));
   for(const item of suggestions){
    const card=el('div','df-revision-expression');
    card.append(el('strong','',item.english));
    if(item.meaning_ko)card.append(el('small','',item.meaning_ko));
    const add=el('button','df-revision-starter','글에 추가하기 · Add');
    add.type='button';
    add.onclick=()=>{
     const destination=fields[1]||fields[0];
     if(!destination)return;
     const sentence=String(item.english||'').trim();
     if(!sentence)return;
     destination.value+=(destination.value.trim()?' ':'')+sentence;
     destination.focus();update();add.textContent='추가됨 ✓';add.disabled=true;
    };
    card.append(add);box.append(card);
   }
   stage.append(box);
  }
  stage.append(counter);update();
  button('이전',summary);
  button('임시 저장',async()=>{if(busy)return;busy=true;try{current.body=allText();await persist();status('임시 저장됨 ✓')}catch(e){status(e.message,true)}finally{busy=false}});
  button('Final AI Review · 마지막 확인',async()=>{
    const body=allText(),n=split(body).length;
    if(n<8||n>30){status('8–30개의 완성된 문장이 필요해요.',true);return}
    if(busy)return;busy=true;
    try{
      current.body=body;await persist();reviewLoading();
      const checked=await review(current);
      feedback=checked;choices={};saveChoices();
      try{localStorage.removeItem(cacheKey)}catch{}
      summary();
    }catch(e){secondDraft();status(e.message||'AI 리뷰 오류',true)}
    finally{busy=false}
  },true);
 }
 function summary(){
  construct();screen('review','3 · Review');
  if(current.kind==='topic'&&feedback?.on_topic===false){
   const warning=el('aside','df-topic-structure-tip df-offtopic-warning');
   warning.append(el('strong','','주제 확인 · Topic Check'),el('p','','선택한 주제와 글의 내용이 조금 다른 것 같아요. 계속 쓸 수 있어요! 다만 마지막 평가에서 ‘주제에 맞게 글을 썼어요’의 별 2개와 5점은 받지 못할 수 있어요.'));
   stage.append(warning);
  }
  if(feedback?.praise_ko)stage.append(el('p','df-review-praise',feedback.praise_ko));
  if(current.kind==='topic'&&feedback?.tip_ko){const tip=el('aside','df-topic-structure-tip');tip.append(el('strong','','Beginning · Middle · Ending'),el('p','',feedback.tip_ko));stage.append(tip)}
  const improvements=Array.isArray(feedback?.improvements)?feedback.improvements:[];
  const expressions=Array.isArray(feedback?.expressions)?feedback.expressions:[];
  const heading=el('div','df-review-top');
  heading.append(el('h3','','Sentence Review'),el('span','df-review-progress'));
  stage.append(heading);
  const progressLabel=heading.querySelector('.df-review-progress');
  const refreshProgress=()=>{const n=improvements.filter((_,i)=>choices[i]).length;progressLabel.textContent=n+' / '+improvements.length+' reviewed'};
  if(!improvements.length)stage.append(el('p','df-muted','수정할 문장이 없어요.'));
  improvements.forEach((change,i)=>{
   const card=el('article','df-review-item df-review-compact');
   const header=el('div','df-review-card-head');
   header.append(el('span','df-review-number',(i+1)+' / '+improvements.length),el('span','df-review-kind',correctionType(change)));
   card.append(header);
   if(correctionType(change)!=='Punctuation')card.append(el('p','df-review-original',change.original||''));
   const suggestion=el('p','df-review-better');changedText(change.original,change.better,suggestion);
   if(correctionType(change)==='Punctuation')suggestion.append(el('small','df-inline-note',change.better.includes(',')&&!change.original.includes(',')?' · comma':' · punctuation'));
   card.append(suggestion);
   if(change.translation_ko)card.append(el('p','df-review-korean',change.translation_ko));
   if(change.why_ko&&correctionType(change)!=='Punctuation')card.append(el('p','df-review-explanation',change.why_ko));
   const row=el('div','df-choice-row');
   const options=[['original','Original'],['first','AI correction'],['last','Revised']];
   const controls=[];
   const refresh=()=>{controls.forEach(([key,btn])=>{btn.classList.toggle('is-chosen',(choices[i]||'first')===key);btn.setAttribute('aria-pressed',String((choices[i]||'first')===key))});refreshProgress()};
   for(const [key,label] of options){
    if(key==='last'&&!change.clarified_better)continue;
    const btn=el('button','df-choice-button',label);btn.type='button';
    btn.addEventListener('click',()=>{choices[i]=key;saveChoices();refresh();construct()});
    controls.push([key,btn]);row.append(btn);
   }
   card.append(row);
   if(change.clarified_better){
    const revised=el('p','df-review-revised',change.clarified_better);
    card.append(revised);
   }else{
    const changeBtn=el('button','df-change-button','Change · 뜻 설명하기');changeBtn.type='button';card.append(changeBtn);
    changeBtn.addEventListener('click',()=>{
     if(card.querySelector('.df-clarify-box'))return;
     const box=el('div','df-clarify-box');
     const input=el('textarea','df-clarify-input');input.placeholder='What did you mean? 영어 또는 한국어';input.maxLength=600;input.setAttribute('aria-label','Clarify your meaning in Korean or English');
     const send=el('button','wg-button wg-primary','다시 제안받기');send.type='button';
     box.append(input,send);card.append(box);input.focus();
     send.addEventListener('click',async()=>{
      if(input.value.trim().length<2){status('뜻을 설명해 주세요.',true);return}
      send.disabled=true;send.textContent='확인 중…';
      try{
       const result=await clarify(current,i,input.value.trim());
       change.clarified_better=result.better;change.clarified_translation_ko=result.translation_ko||'';
       choices[i]='last';saveChoices();construct();
       // Refresh cards without losing the student's review decisions.
       const top=window.scrollY;summary();window.scrollTo({top});
      }catch(e){status(e.message||'다시 시도해 주세요.',true);send.disabled=false;send.textContent='다시 제안받기'}
     });
    });
   }
   stage.append(card);refresh();
  });
  if(expressions.length){
   const section=el('section','df-review-group');
   section.append(el('h3','df-review-heading','New Expressions'));
   expressions.forEach(x=>{
    const line=el('div','df-expression-line');
    line.append(el('strong','',x.english||''),el('span','',x.meaning_ko||''));
    if(current.kind==='diary'){
     const add=el('button','df-revision-starter','일기에 추가하고 다시 확인');
     add.type='button';
     add.onclick=async()=>{
      const sentence=String(x.english||'').trim();
      if(!sentence||busy)return;
      if(split(current.body).length>=30){status('최대 30문장까지 쓸 수 있어요.',true);return}
      busy=true;add.disabled=true;
      const before=current.body;
      try{
       current.body=before.trim()+(before.trim()?' ':'')+sentence;
       await persist();
       reviewLoading();feedback=await review(current);choices={};saveChoices();summary();
      }catch(e){current.body=before;summary();status(e.message||'다시 확인해 주세요.',true)}
      finally{busy=false}
     };
     line.append(add);
    }
    section.append(line)
   });
   stage.append(section);
  }
  refreshProgress();
  button('이전',write);
  if(current.kind==='topic'&&Number(feedback?.review_round||1)<2)button('Draft 2 · 글 고치기',secondDraft,true);
  else button('Finish Review · 연습 시작',()=>{construct();index=0;mode='speaking';if(practice.length)question();else speakingTransition()},true);
 }
 function rendererHost(q){
  const host=el('div','df-question-host sp-shared-question question-card');stage.append(host);renderer=new QuestionRenderer(host);renderer.render(q);
 }
 async function playTarget(text,control){
  if(control.disabled)return;
  control.disabled=true;control.classList.add('is-loading');control.setAttribute('aria-busy','true');status('음성을 불러오고 있어요.');
  try{
   const headers={'Content-Type':'application/json'};
   const token=window.WillenaAPI?.getLocalAccessToken?.();
   if(token)headers.Authorization='Bearer '+token;
   const response=await fetch('/api/vocab-ai-speech',{method:'POST',headers,credentials:'include',cache:'no-store',body:JSON.stringify({action:'listen',text}),signal:AbortSignal.timeout(35000)});
   if(!response.ok)throw Error('듣기 음성을 불러오지 못했어요.');
   const result=await response.json();
   let url=result.audio_url;
   let objectUrl=null;
   if(!url&&result.audio){const bytes=Uint8Array.from(atob(result.audio),c=>c.charCodeAt(0));url=objectUrl=URL.createObjectURL(new Blob([bytes],{type:'audio/mpeg'}))}
   if(!url)throw Error('듣기 음성이 없어요.');
   const audio=new Audio(url);
   try{await audio.play();await new Promise((resolve,reject)=>{audio.onended=resolve;audio.onerror=()=>reject(Error('재생할 수 없어요.'))})}
   finally{if(objectUrl)URL.revokeObjectURL(objectUrl)}
   status('');
  }catch(e){status(e.message,true)}
  finally{control.disabled=false;control.classList.remove('is-loading');control.removeAttribute('aria-busy')}
 }
 function question(){
  const p=practice[index];if(!p){index=0;speakingTransition();return}
  screen('question',(index+1)+' / '+practice.length);
  stage.append(el('p','df-target',p.target));
   if(p.meaning)stage.append(el('p','df-target-korean',p.meaning));
  const listen=el('button','wg-button df-listen');listen.append(el('img','df-headphones'));listen.querySelector('img').src='/shared/svgs/headphones.svg';listen.querySelector('img').alt='';listen.setAttribute('aria-label','듣기');listen.title='듣기';listen.type='button';listen.addEventListener('click',()=>void playTarget(p.target,listen));stage.append(listen);
  const modes=el('div','df-mode-buttons');
  const toggle=el('button','df-mode-toggle');
  toggle.type='button';
  toggle.setAttribute('role','switch');
  toggle.setAttribute('aria-label','말하기 또는 쓰기 선택');
  toggle.setAttribute('aria-checked',String(mode==='speaking'));
  const speak=el('span','df-toggle-speak','말하기');
  const write=el('span','df-toggle-write','쓰기');
  toggle.append(speak,write);
  toggle.classList.toggle('is-speaking',mode==='speaking');
  toggle.classList.toggle('is-writing',mode==='write');
  toggle.addEventListener('click',()=>{mode=mode==='speaking'?'write':'speaking';question()});
  modes.append(toggle);stage.append(modes);
  rendererHost({form:mode==='speaking'?'speaking':'write',prompt:'',context:{},input:{language:'en'},answer:[p.target]});
  button('확인',()=>{
   if(norm(renderer.getResponse())!==norm(p.target)){status('다시 시도해 주세요.',true);return}
   index++;mode='speaking';question();
  },true);
  button('건너뛰기 · Skip',()=>{reviewSkipped=true;index++;mode='speaking';question()});
 }
 async function aiSpeechTranscribe(blob){
  const base64=await new Promise((resolve,reject)=>{const reader=new FileReader();reader.onerror=reject;reader.onload=()=>resolve(String(reader.result).split(',')[1]);reader.readAsDataURL(blob)});
  const token=window.WillenaAPI?.getLocalAccessToken?.();
  const response=await fetch('/api/vocab-ai-speech',{method:'POST',headers:{'Content-Type':'application/json',...(token?{Authorization:'Bearer '+token}:{})},credentials:'include',cache:'no-store',body:JSON.stringify({action:'transcribe',audio_base64:base64,mime_type:blob.type}),signal:AbortSignal.timeout(35000)});
  const data=await response.json().catch(()=>({}));
  if(!response.ok||!data.success)throw Error(data.error||'음성 확인에 실패했어요.');
  return data.transcript||'';
 }
 async function fallbackRecord(target,control,onSuccess){
  if(!navigator.mediaDevices?.getUserMedia||!window.MediaRecorder){status('이 브라우저는 마이크 녹음을 지원하지 않아요.',true);return}
  const mime=['audio/webm;codecs=opus','audio/webm','audio/mp4','audio/ogg;codecs=opus','audio/ogg'].find(x=>MediaRecorder.isTypeSupported(x));
  if(!mime){status('오디오 형식을 지원하지 않아요.',true);return}
  let stream,recorder;
  try{
   stream=await navigator.mediaDevices.getUserMedia({audio:true});
   recorder=new MediaRecorder(stream,{mimeType:mime});const chunks=[];
   recorder.ondataavailable=e=>{if(e.data.size)chunks.push(e.data)};
   const ended=new Promise(resolve=>{recorder.onstop=resolve});
   recorder.start();control.classList.add('is-recording');if(!control.querySelector('.speaking-mic-icon'))control.textContent='녹음 중지';status('말해 주세요.');
   await new Promise(resolve=>{const stop=()=>{control.removeEventListener('click',stop);resolve()};control.addEventListener('click',stop,{once:true});setTimeout(()=>{control.removeEventListener('click',stop);resolve()},12000)});
   if(recorder.state==='recording')recorder.stop();await ended;
   control.classList.remove('is-recording');if(!control.querySelector('.speaking-mic-icon'))control.textContent='다시 말하기';status('음성을 확인하고 있어요.');
   const transcript=await aiSpeechTranscribe(new Blob(chunks,{type:mime}));
   status('');onSuccess(transcript);
  }catch(error){status(error.message||'마이크 오류',true)}
  finally{stream?.getTracks().forEach(t=>t.stop());control.classList.remove('is-recording');if(!control.querySelector('.speaking-mic-icon'))control.textContent='말하기'}
 }
 function speakingTransition(){
  screen('speak-transition','4 · Speak');
  const splash=el('div','df-speak-splash');
  const icon=el('div','df-splash-icon');const iconImg=el('img','df-splash-mic');iconImg.src='/shared/svgs/mic.svg';iconImg.alt='';icon.append(iconImg);
  splash.append(icon,el('h2','','Review complete!'),el('p','','이제 내 글을 소리 내어 읽어 봐요.'),el('small','','Speak each sentence to continue.'));
  stage.append(splash);
  let started=false;
  const start=()=>{if(started||step!=='speak-transition')return;started=true;index=0;lineSpeech()};
  button('말하기 시작',start,true);
  transitionTimer=setTimeout(start,2200);
 }
 function lineSpeech(){
  if(index>=finalLines.length){complete();return}
  screen('speech','Speak · '+(index+1)+' / '+finalLines.length);
  const flow=el('div','df-teleprompter');
  flow.setAttribute('aria-label','Speaking teleprompter');
  if(index>0)flow.append(el('p','df-tele-line df-tele-done',finalLines[index-1]));
  for(let offset=0;offset<5&&index+offset<finalLines.length;offset++){
   const line=el('p','df-tele-line '+(offset===0?'df-tele-active':'df-tele-next df-tele-next-'+offset),finalLines[index+offset]);
   flow.append(line);
  }
  stage.append(flow);
  const target=finalLines[index];
  // Use the exact shared QuestionRenderer microphone from the review activity.
  rendererHost({form:'speaking',prompt:'',context:{},input:{language:'en'},answer:[target]});
  const mic=stage.querySelector('[data-speaking-mic]');
  const speechStatus=stage.querySelector('[data-speaking-status]');
  if(current.kind==='topic')button('건너뛰기 · Skip',()=>{speechSkipped=true;index++;lineSpeech()});
  if(!mic)return;
  mic.classList.add('df-tele-mic');
  let accepted=false;
  const judge=answer=>{
   if(accepted||step!=='speech')return;
   const tolerant=judgeSentenceSpeech(target,answer);
   const score=tolerant.correct?1:spokenAccuracy(target,answer);
   if(score<.75){
    status('다시 한번 말해 보세요.',true);
    return;
   }
   accepted=true;
   spoken.push(answer);
   mic.disabled=true;
   status('✓ 잘했어요!');
   flow.classList.add('df-tele-advance');
   setTimeout(()=>{if(step==='speech'){index++;lineSpeech()}},480);
  };
  if(window.SpeechRecognition||window.webkitSpeechRecognition){
   renderer.onSpeechResult=alternatives=>{
    const candidates=Array.isArray(alternatives)?alternatives:[alternatives];
    const best=candidates.map(answer=>({answer,score:judgeSentenceSpeech(target,answer).correct?1:spokenAccuracy(target,answer)})).sort((a,b)=>b.score-a.score)[0];
    if(best)judge(best.answer);
   };
  }else{
   mic.disabled=false;
   if(speechStatus)speechStatus.textContent='마이크를 눌러 말해 보세요.';
   let processing=false;
   mic.addEventListener('click',()=>{
    if(processing||mic.classList.contains('is-recording'))return;
    processing=true;
    void fallbackRecord(target,mic,judge).finally(()=>{processing=false});
   });
  }
 }
 function rewardCard(reward){
  stage.replaceChildren();
  const award=document.createElement('student-reward-celebration');
  award.setAttribute('label',current.kind==='topic'?'TOPIC WRITING COMPLETE':'DAILY DIARY COMPLETE');
  award.setAttribute('percent','100');award.setAttribute('star-max',current.kind==='topic'?'8':'5');
  award.setAttribute('stars',String(reward.stars??5));
  award.setAttribute('points',String(reward.points||0));
  stage.append(award);
  if(current.kind==='topic'&&reward.rubric){
   const box=el('section','df-topic-rubric');
   box.append(el('h3','','글쓰기 평가표'));
   const table=el('table','df-topic-rubric-table');
   const head=el('thead','');const header=el('tr','');
   for(const name of ['평가 기준','별','점수'])header.append(el('th','',name));
   head.append(header);table.append(head);
   const body=el('tbody','');
   let earnedStars=0,earnedPoints=0;
   for(const [key,label] of [['topic','주제에 맞게 글을 썼어요'],['structure','시작·가운데·마무리를 사용했어요'],['review','건너뛰지 않고 복습했어요'],['speaking','수정한 글을 끝까지 읽었어요']]){
    const ok=reward.rubric[key]===true;
    const row=el('tr',ok?'is-earned':'is-missed');
    const reason=el('td','',label);
    const stars=el('td','df-rubric-stars',ok?'★★':'—');
    const points=el('td','df-rubric-points',ok?'+5점':'0점');
    row.append(reason,stars,points);body.append(row);
    if(ok){earnedStars+=2;earnedPoints+=5}
   }
   const total=el('tr','df-rubric-total');
   total.append(el('th','','합계'),el('th','',earnedStars+' / 8 ★'),el('th','',earnedPoints+' / 20점'));
   body.append(total);table.append(body);box.append(table);stage.append(box);
  }else stage.append(el('p','df-reward-breakdown',(reward.sentences||split(current.body).length)+' sentences × 5 points'));
 }
 async function complete(){
  if(busy)return;busy=true;
  screen('finish','Complete');stage.append(el('h2','df-heading',current.kind==='topic'?'글쓰기 완료':'일기 완료'));
  status('보상을 확인하고 있어요…');
  button('메인 메뉴',close,true);
  try{
   if(!current._speechSaved){if(current.kind==='topic'&&speechSkipped){current._speechSaved=true}else{await speech(current,spoken.join(' '),finalLines);current._speechSaved=true}}
   const reward=await finish(current,{reviewComplete:!reviewSkipped,speakingComplete:!speechSkipped&&spoken.length===finalLines.length});
   rewardCard(reward);
   status('완료했습니다!');
   showTeacherFeedback();
  }catch(e){
   // Submission may already be committed; never imply the entire diary failed.
   const submitted=current?.status==='submitted'||String(e?.message||'').includes('reward');
   status(submitted?'일기는 제출됐어요. 보상을 다시 확인해 주세요.':'저장 또는 보상 확인에 실패했어요. 다시 시도해 주세요.',true);
   button('보상 다시 확인',complete);
   showTeacherFeedback();
  }finally{busy=false}
 }
 return {open(entry,saved){clearTimeout(autosaveTimer);current={...entry,_speechSaved:entry.status==='submitted'};feedback=saved?.original_body===entry.body&&saved?.feedback?.review_version===2&&(entry.kind!=='topic'||saved.feedback.reviewed_title===entry.title)?saved.feedback:null;choices={};captureDraft=null;loadChoices();spoken=[];reviewSkipped=false;speechSkipped=false;index=0;root.hidden=false;if(entry.status==='submitted'){void complete()}else if(feedback)summary();else topic()},close};
}
