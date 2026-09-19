const TEMPLATE_URL='/components/burger-menu.html?v=20260919-header-menu-3';
const MODULE_URL='/components/burger-menu.js?v=20260919-header-menu-3';

export async function mountTeacherHeaderMenu(){
  if(!document.getElementById('burger-menu-template')){
    const response=await fetch(TEMPLATE_URL,{cache:'no-store'});
    if(!response.ok)throw new Error('Could not load teacher header menu template');
    const holder=document.createElement('div');
    holder.innerHTML=await response.text();
    const template=holder.querySelector('#burger-menu-template');
    if(!template)throw new Error('Teacher header menu template is invalid');
    document.body.appendChild(template);
  }

  const mod=await import(MODULE_URL);
  if(typeof mod.insertBurgerMenu!=='function')throw new Error('Teacher header menu module is invalid');
  mod.insertBurgerMenu();
}
