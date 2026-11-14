// Shared Willena numeric keypad. Reusable with any text input and confirmation action.
// No input values are stored or transmitted by the keypad itself.
let stylesReady=false;
function styles(){
 if(stylesReady||document.getElementById('willenaNumpadStyles')){stylesReady=true;return}
 const style=document.createElement('style');style.id='willenaNumpadStyles';
 style.textContent=`
 .willena-numpad{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:9px;margin:14px 0 2px;touch-action:manipulation}
 .willena-numpad button{min-height:56px;border:1.5px solid #c8e9ed;border-radius:13px;background:white;color:#24515a;font:800 1.45rem Poppins,system-ui,sans-serif;cursor:pointer;touch-action:manipulation}
 .willena-numpad button:active{background:#e9fbfc;transform:translateY(1px)}
 .willena-numpad .wnp-delete{color:#e15f9d;font-size:1rem}
 .willena-numpad .wnp-submit{background:#ecfbfc;border-color:#65cdd5;color:#e15f9d;font-size:1rem}
 .willena-numpad button:disabled{opacity:.45;cursor:not-allowed}
 .willena-numpad + .wnp-help{text-align:center;font-size:.77rem;color:#687f87;margin:6px 0}
 @media(max-height:700px){.willena-numpad button{min-height:43px}.willena-numpad{gap:5px;margin-top:7px}}
 `;
 document.head.append(style);stylesReady=true;
}
export function mountWillenaNumpad({input,container,onConfirm,maxLength=4}={}){
 if(!(input instanceof HTMLInputElement)||!container)throw new Error('A text input and container are required');
 styles();
 const limit=Math.max(1,Math.min(20,Number(maxLength)||4));
 const existing=container.querySelector('.willena-numpad');
 existing?.remove();
 const pad=document.createElement('div');pad.className='willena-numpad';pad.setAttribute('role','group');pad.setAttribute('aria-label','숫자 키패드');
 const button=(text,cls='',label=text)=>{
  const b=document.createElement('button');b.type='button';b.textContent=text;b.className=cls;b.setAttribute('aria-label',label);pad.append(b);return b;
 };
 const update=next=>{
  input.value=String(next).replace(/\D/g,'').slice(0,limit);
  input.dispatchEvent(new Event('input',{bubbles:true}));
 };
 for(const key of ['1','2','3','4','5','6','7','8','9']){
  button(key).addEventListener('click',()=>update(input.value+key));
 }
 button('지우기','wnp-delete','마지막 숫자 지우기').addEventListener('click',()=>update(input.value.slice(0,-1)));
 button('0').addEventListener('click',()=>update(input.value+'0'));
 const confirm=button('확인','wnp-submit','입력한 숫자 확인');
 confirm.addEventListener('click',()=>{if(typeof onConfirm==='function')onConfirm(input.value)});
 container.append(pad);
 input.setAttribute('inputmode','none');
 input.setAttribute('autocomplete','off');
 input.setAttribute('readonly','');
 input.setAttribute('aria-label',input.getAttribute('aria-label')||'숫자 입력');
 input.addEventListener('keydown',e=>{if(e.key==='Enter'){e.preventDefault();onConfirm?.(input.value)}});
 return {element:pad,clear:()=>update(''),destroy:()=>{pad.remove();input.removeAttribute('readonly');input.removeAttribute('inputmode')}};
}
