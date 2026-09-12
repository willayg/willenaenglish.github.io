export function createPerfDebug({getStatsDiagnostics}={}){
  const startedAt=performance.now();
  const marks={auth:null,ui:null,stats:null};
  function update(){
    if(typeof getStatsDiagnostics==='function')getStatsDiagnostics();
    return marks;
  }
  function mark(name){
    if(Object.prototype.hasOwnProperty.call(marks,name))marks[name]=performance.now()-startedAt;
    return marks[name];
  }
  return{update,mark};
}
