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

function headphoneSvg(){
  return `
    <svg class="listen-headphone-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false">
      <path d="M4 14v-2a8 8 0 0 1 16 0v2"></path>
      <path d="M18 19h1a2 2 0 0 0 2-2v-3a2 2 0 0 0-2-2h-1z"></path>
      <path d="M6 19H5a2 2 0 0 1-2-2v-3a2 2 0 0 1 2-2h1z"></path>
    </svg>`;
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

  const hiddenLabel=button.querySelector("span");
  button.insertAdjacentHTML("afterbegin",headphoneSvg());
  if(hiddenLabel)button.appendChild(hiddenLabel);
  button.setAttribute("aria-label",document.documentElement.lang==="ko"?"음성 듣기":"Play audio");
  button.addEventListener("click",markHelpSeen,{once:true});
}

function scan(){
  document.querySelectorAll(".listening-panel").forEach(compactPanel);
}

new MutationObserver(scan).observe(document.documentElement,{childList:true,subtree:true});
scan();
