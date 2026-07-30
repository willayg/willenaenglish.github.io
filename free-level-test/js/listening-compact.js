const HELP_KEY="willena_listening_help_seen_v1";

function helpText(){
  return document.documentElement.lang==="ko"
    ? "헤드폰 버튼을 눌러 음성을 들으세요. 각 문제는 최대 2번 들을 수 있어요."
    : "Tap the headphone button to listen. Each question can be played up to twice.";
}

function markHelpSeen(){
  try{localStorage.setItem(HELP_KEY,"1")}catch{}
  document.querySelectorAll(".listen-help").forEach(el=>el.remove());
}

function shouldShowHelp(){
  try{return localStorage.getItem(HELP_KEY)!=="1"}catch{return true}
}

function compactPanel(panel){
  if(!panel||panel.dataset.compactListening==="1")return;
  const button=panel.querySelector("#playAudio");
  const remaining=panel.querySelector("#playsRemaining");
  if(!button||!remaining)return;

  panel.dataset.compactListening="1";
  const oldIcon=panel.querySelector(".listening-icon");
  const oldInstruction=panel.querySelector("p");
  oldIcon?.remove();
  oldInstruction?.remove();

  if(shouldShowHelp()){
    const help=document.createElement("div");
    help.className="listen-help";
    help.textContent=helpText();
    panel.insertBefore(help,button);
  }

  button.setAttribute("aria-label",document.documentElement.lang==="ko"?"음성 듣기":"Play audio");
  button.addEventListener("click",markHelpSeen,{once:true});
}

function scan(){
  document.querySelectorAll(".listening-panel").forEach(compactPanel);
}

new MutationObserver(scan).observe(document.documentElement,{childList:true,subtree:true});
scan();
