let mockModulePromise=null;

function loadMockModule(){
  if(!mockModulePromise){
    mockModulePromise=import('./mock-test.js?v=1.4.3').catch(error=>{
      mockModulePromise=null;
      throw error;
    });
  }
  return mockModulePromise;
}

export async function renderMockTestPreflight(options){
  const module=await loadMockModule();
  return module.renderMockTestPreflight(options);
}

export function stopMockTest(){
  if(!mockModulePromise)return;
  mockModulePromise.then(module=>module.stopMockTest?.()).catch(error=>console.warn('[mock-test-proxy] stop failed',error));
}
