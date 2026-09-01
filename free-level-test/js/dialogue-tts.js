const dialogueMap=new Map(Object.entries({"Hello! My name is Amy.":[{"role":"girl","text":"Hello! My name is Amy."}],"How are you? I'm happy.":[{"role":"boy","text":"How are you?"},{"role":"girl","text":"I'm happy."}],"It is a cat.":[{"role":"girl","text":"It is a cat."}],"This is a red apple.":[{"role":"boy","text":"This is a red apple."}],"My name is Ben. I am seven.":[{"role":"boy","text":"My name is Ben. I am seven."}],"Can you swim? Yes, I can.":[{"role":"girl","text":"Can you swim?"},{"role":"boy","text":"Yes, I can."}],"That is a big dog.":[{"role":"girl","text":"That is a big dog."}],"How are you? I'm tired.":[{"role":"boy","text":"How are you?"},{"role":"girl","text":"I'm tired."}],"Happy birthday, Tom!":[{"role":"girl","text":"Happy birthday, Tom!"}],"I can jump, but I can't swim.":[{"role":"boy","text":"I can jump, but I can't swim."}],"I like bananas, but I don't like apples.":[{"role":"girl","text":"I like bananas, but I don't like apples."}],"What do you want? I want some juice.":[{"role":"girl","text":"What do you want?"},{"role":"boy","text":"I want some juice."}],"I have a blue pencil and a red pen.":[{"role":"boy","text":"I have a blue pencil and a red pen."}],"The ball is under the chair.":[{"role":"girl","text":"The ball is under the chair."}],"Open your book, please.":[{"role":"girl","text":"Open your book, please."}],"May I come in? Yes, you may.":[{"role":"girl","text":"May I come in?"},{"role":"boy","text":"Yes, you may."}],"I can ride a bike, but I can't drive a car.":[{"role":"boy","text":"I can ride a bike, but I can't drive a car."}],"Do you have a ruler? No, I don't. I have a pencil.":[{"role":"boy","text":"Do you have a ruler?"},{"role":"girl","text":"No, I don't. I have a pencil."}],"The elephant is big. The mouse is small.":[{"role":"girl","text":"The elephant is big. The mouse is small."}],"Do you like soccer? No, I don't. I like basketball.":[{"role":"boy","text":"Do you like soccer?"},{"role":"girl","text":"No, I don't. I like basketball."}],"There is a cat under the table.":[{"role":"girl","text":"There is a cat under the table."}],"There are four birds in the tree.":[{"role":"boy","text":"There are four birds in the tree."}],"These are my shoes. Those are my brother's shoes.":[{"role":"girl","text":"These are my shoes. Those are my brother's shoes."}],"Can your friends play tennis? Yes, they can.":[{"role":"girl","text":"Can your friends play tennis?"},{"role":"boy","text":"Yes, they can."}],"What do you want? I want a sandwich and some milk.":[{"role":"boy","text":"What do you want?"},{"role":"girl","text":"I want a sandwich and some milk."}],"My favorite animal is the dolphin because it can swim fast.":[{"role":"boy","text":"My favorite animal is the dolphin because it can swim fast."}],"Is there a computer in the classroom? No, there isn't.":[{"role":"girl","text":"Is there a computer in the classroom?"},{"role":"boy","text":"No, there isn't."}],"The teacher is in the classroom. The students are outside.":[{"role":"girl","text":"The teacher is in the classroom. The students are outside."}],"We like pizza, but we don't like hamburgers.":[{"role":"boy","text":"We like pizza, but we don't like hamburgers."}],"Can I use your pencil? Sure. Here you are.":[{"role":"girl","text":"Can I use your pencil?"},{"role":"boy","text":"Sure. Here you are."}],"Daniel gets up at seven and goes to school at eight.":[{"role":"boy","text":"Daniel gets up at seven and goes to school at eight."}],"My sister is reading a book in her room.":[{"role":"girl","text":"My sister is reading a book in her room."}],"Mina usually walks to school, but today she is taking the bus.":[{"role":"boy","text":"Mina usually walks to school, but today she is taking the bus."}],"My father is a cook. He works in a restaurant.":[{"role":"girl","text":"My father is a cook. He works in a restaurant."}],"Does Leo have a bike? No, he doesn't. He has a skateboard.":[{"role":"boy","text":"Does Leo have a bike?"},{"role":"girl","text":"No, he doesn't. He has a skateboard."}],"Emma likes to draw, but she doesn't like to sing.":[{"role":"girl","text":"Emma likes to draw, but she doesn't like to sing."}],"The children are playing soccer because the weather is nice.":[{"role":"boy","text":"The children are playing soccer because the weather is nice."}],"What is your mother doing? She is making dinner.":[{"role":"boy","text":"What is your mother doing?"},{"role":"girl","text":"She is making dinner."}],"Jake doesn't watch television in the morning. He watches it after dinner.":[{"role":"girl","text":"Jake doesn't watch television in the morning. He watches it after dinner."}],"Sara wants to go to the park, but it is raining, so she stays home.":[{"role":"boy","text":"Sara wants to go to the park, but it is raining, so she stays home."}]}));
const synth=window.speechSynthesis;
if(synth){
 const nativeSpeak=synth.speak.bind(synth);
 const englishVoices=()=>synth.getVoices().filter(v=>String(v.lang||"").toLowerCase().startsWith("en"));
 function pickVoice(role){
  const voices=englishVoices();
  if(!voices.length)return null;
  const female=/samantha|ava|zira|susan|hazel|karen|moira|tessa|veena|female/i;
  const male=/daniel|alex|fred|david|mark|george|male/i;
  const wanted=role==="girl"?female:male;
  const avoided=role==="girl"?male:female;
  return voices.find(v=>wanted.test(v.name))||voices.find(v=>!avoided.test(v.name))||voices[role==="boy"&&voices.length>1?1:0];
 }
 synth.speak=function(original){
  const parts=dialogueMap.get(String(original?.text||"").trim());
  if(!parts){nativeSpeak(original);return;}
  let index=0,failed=false;
  const next=()=>{
   if(index>=parts.length){if(!failed&&typeof original.onend==="function")original.onend(new Event("end"));return;}
   const part=parts[index++];
   const u=new SpeechSynthesisUtterance(part.text);
   u.lang=original.lang||"en-US";u.rate=original.rate||.9;u.pitch=original.pitch||1;u.volume=original.volume||1;
   const voice=pickVoice(part.role);if(voice)u.voice=voice;
   u.onend=()=>setTimeout(next,120);
   u.onerror=e=>{failed=true;if(typeof original.onerror==="function")original.onerror(e)};
   nativeSpeak(u);
  };
  next();
 };
}
