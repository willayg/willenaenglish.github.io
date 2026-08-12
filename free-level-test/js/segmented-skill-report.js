(function(){
'use strict';
var root=document.querySelector('#app');
if(!root)return;

function internalLevelFromLabel(text){
 var value=String(text||'').trim();
 var number=Number((value.match(/\d+/)||[])[0]);
 if(!number)return null;
 if(/starter|스타터/i.test(value))return Math.max(1,Math.min(2,number));
 if(/level|레벨/i.test(value))return Math.max(3,Math.min(12,number+2));
 return null;
}

function buildSegments(track,level){
 if(!track||track.querySelector('.report-skill__segment'))return;
 track.innerHTML='';
 track.setAttribute('aria-hidden','true');
 var starter=document.createElement('span');
 starter.className='report-skill__segment is-starter '+(level<=2?'is-current':'is-complete');
 track.appendChild(starter);
 for(var displayLevel=1;displayLevel<=12;displayLevel++){
  var internalLevel=displayLevel+2;
  var segment=document.createElement('span');
  segment.className='report-skill__segment';
  if(internalLevel<level)segment.classList.add('is-complete');
  else if(internalLevel===level)segment.classList.add('is-current');
  track.appendChild(segment);
 }
}

function polishSkillRows(){
 root.querySelectorAll('.report-skill:not(.is-unassessed)').forEach(function(row){
  var label=row.querySelector('.report-skill__level');
  var track=row.querySelector('.report-skill__track');
  var level=internalLevelFromLabel(label&&label.textContent);
  if(level)buildSegments(track,level);
 });
}

function moveFullTestFirst(){
 var holder=root.querySelector('.setup-options[data-key="length"]');
 if(!holder)return;
 var full=holder.querySelector('.setup-option[data-value="50"]');
 if(full&&holder.firstElementChild!==full)holder.insertBefore(full,holder.firstElementChild);
}

function update(){
 moveFullTestFirst();
 polishSkillRows();
}

new MutationObserver(update).observe(root,{childList:true,subtree:true});
update();
})();
