/* Shared Genius session identity. Homework is a separate attempt scope, never
   a synonym for permanent unit mastery. Pure helpers: no database writes. */
export function geniusSessionContext({assignmentId=null,bookId=null,unitId=null,mode=null}={}){
 const id=String(assignmentId||'').trim();
 const book=String(bookId||'').trim();
 const unit=String(unitId||'').trim();
 const activity=String(mode||'').trim();
 return Object.freeze({
  kind:id?'homework':'practice',
  isHomework:!!id,
  assignmentId:id||null,
  bookId:book||null,
  unitId:unit||null,
  mode:activity||null,
  progressScope:id?'assignment:'+id:'mastery:'+book+':'+unit,
  recordMastery:!id
 });
}
export function geniusHomeworkFromUrl(url=globalThis.location?.href||''){
 try{
  const p=new URL(url,'https://students.willenaenglish.com').searchParams;
  return String(p.get('homework')||p.get('assignment')||'').trim()||null;
 }catch{return null}
}
export function geniusSessionHeader(context){
 return context?.isHomework?{title:'숙제 / Homework',subtitle:'Assigned work · Separate progress'}:
  {title:'교재 공부',subtitle:'Voluntary practice · Permanent mastery'};
}
