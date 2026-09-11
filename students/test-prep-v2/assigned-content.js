const norm=s=>String(s??'').trim();
const lower=s=>norm(s).toLowerCase();

function normalizeSections(raw){
  const seen=new Set(),out=[];
  for(const value of Array.isArray(raw)?raw:[]){
    const key=lower(value);
    if(!key||seen.has(key))continue;
    seen.add(key);out.push(key);
  }
  return out;
}

function lessonRow(row,index){
  const label=norm(row?.lesson||row?.label||row?.unit_label||`Lesson ${index+1}`);
  if(!label)return null;
  return{
    key:`lesson:${row?.unit_id||label}`,
    kind:'lesson',
    lesson:label,
    label,
    unitId:row?.unit_id?String(row.unit_id):null,
    sections:normalizeSections(row?.sections),
    source:row||{}
  };
}

function externalRow(row,index){
  const label=norm(row?.lesson||row?.label||row?.unit_label||`외부지문 ${index+1}`);
  if(!label||!row?.unit_id)return null;
  return{
    key:`external:${row.unit_id}`,
    kind:'external_passage',
    lesson:label,
    label,
    unitId:String(row.unit_id),
    sections:normalizeSections(row?.sections),
    source:row||{}
  };
}

export function assignedUnits(plan){
  const scope=plan?.group?.scope||{};
  const lessons=Array.isArray(scope.lessons)?scope.lessons.map(lessonRow).filter(Boolean):[];
  const external=Array.isArray(scope.external_passages)?scope.external_passages.map(externalRow).filter(Boolean):[];
  let rows=[...lessons,...external];
  if(!rows.length){
    rows=(plan?.units||[]).map((lesson,index)=>lessonRow({lesson,sections:plan?.practice_types||[]},index)).filter(Boolean);
  }
  const seen=new Set();
  return rows.filter(row=>{const key=row.unitId?`${row.kind}:${row.unitId}`:`${row.kind}:${row.lesson}`;if(seen.has(key))return false;seen.add(key);return true});
}

export function findAssignedUnit(plan,lesson){
  return assignedUnits(plan).find(row=>String(row.lesson)===String(lesson))||null;
}

export function sectionsForAssignedUnit(unit){
  const sections=new Set((unit?.sections||[]).map(lower));
  if(sections.has('vocabulary'))sections.add('vocab_test');
  if(unit?.kind==='lesson')sections.add('sentences');
  else if(sections.has('sentences'))sections.add('sentences');
  return sections;
}

export function splitAssignedUnits(plan){
  const all=assignedUnits(plan);
  return{
    all,
    lessons:all.filter(x=>x.kind==='lesson'),
    external:all.filter(x=>x.kind==='external_passage')
  };
}

export function assignedUnitTypeLabel(unit){
  return unit?.kind==='external_passage'?'외부지문':'교과서';
}
