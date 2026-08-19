(function(global){
'use strict';
var URL='https://gxwfsqxyuufqtitspfqg.supabase.co';
var KEY=['sb_publishable_','G-FYhHfDL4OGdL892gY1Zg_','epdbEeqO'].join('');
var cache={};
function text(v){return String(v==null?'':v).trim();}
async function getPatternConcepts(patternId){
  patternId=text(patternId);if(!patternId)return[];
  if(cache[patternId])return cache[patternId];
  cache[patternId]=(async function(){
    try{
      var select='weight,confidence,relationship_type,concept:grammar_concepts(id,code,name)';
      var url=URL+'/rest/v1/pattern_concepts?pattern_id=eq.'+encodeURIComponent(patternId)+'&select='+encodeURIComponent(select)+'&order=weight.desc';
      var r=await fetch(url,{headers:{apikey:KEY,Authorization:'Bearer '+KEY},cache:'no-store'});
      if(!r.ok)throw new Error('Concept taxonomy '+r.status);
      var rows=await r.json();
      return (Array.isArray(rows)?rows:[]).map(function(row){
        var c=row&&row.concept||{};if(!c.id||!c.code)return null;
        return{concept_id:String(c.id),code:String(c.code),name:String(c.name||c.code),weight:Number(row.weight)||1,confidence:Number(row.confidence)||1,relationship_type:String(row.relationship_type||'assesses')};
      }).filter(Boolean);
    }catch(error){console.debug('[WillenaStudyConceptTaxonomy] unavailable',error);return[];}
  })();
  return cache[patternId];
}
global.WillenaStudyConceptTaxonomy={version:'grammar-taxonomy-v1',getPatternConcepts:getPatternConcepts};
})(window);
