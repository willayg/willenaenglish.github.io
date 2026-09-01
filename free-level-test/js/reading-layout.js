const root=document.querySelector('#app');

function isEmojiPassage(text){
  const value=String(text||'').trim();
  if(!value)return false;
  try{
    return /\p{Extended_Pictographic}/u.test(value)&&!/[\p{L}\p{N}]/u.test(value);
  }catch(_){
    return value.length<=12&&!/[A-Za-z0-9가-힣]/.test(value);
  }
}

function formatReadingPrompt(){
  const prompt=root?.querySelector('.question-card > .prompt');
  if(!prompt||prompt.dataset.readingFormatted==='true')return;

  const raw=prompt.textContent||'';
  const breakAt=raw.lastIndexOf('\n');
  if(breakAt<1)return;

  const passage=raw.slice(0,breakAt).trim();
  const question=raw.slice(breakAt+1).trim();
  if(!passage||!question)return;

  const wrapper=document.createElement('div');
  wrapper.className='reading-content';

  const passageBox=document.createElement('div');
  passageBox.className='reading-passage'+(isEmojiPassage(passage)?' emoji-passage':'');
  passageBox.textContent=passage;

  const questionText=document.createElement('p');
  questionText.className='prompt reading-question';
  questionText.dataset.readingFormatted='true';
  questionText.textContent=question;

  wrapper.append(passageBox,questionText);
  prompt.replaceWith(wrapper);
}

const observer=new MutationObserver(formatReadingPrompt);
if(root)observer.observe(root,{childList:true,subtree:true});
formatReadingPrompt();
