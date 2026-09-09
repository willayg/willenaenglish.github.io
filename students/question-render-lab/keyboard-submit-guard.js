// Prevent the shared keyboard's 확인 tap from falling through to the fixed Check Answer button.
// The shared keyboard currently hides on pointerdown; on touch devices that can leave the
// underlying #check button under the same finger before pointerup/click is delivered.
(() => {
  let guarding = false;

  function isKeyboardEnter(target) {
    return !!target?.closest?.('#willenaSharedKeyboard [data-key="enter"]');
  }

  document.addEventListener('pointerdown', e => {
    if (!isKeyboardEnter(e.target)) return;
    guarding = true;
    e.preventDefault();
    e.stopImmediatePropagation();
  }, true);

  document.addEventListener('pointerup', e => {
    if (!guarding || !isKeyboardEnter(e.target)) return;
    e.preventDefault();
    e.stopImmediatePropagation();

    const submit = document.querySelector('#check');
    if (submit && !submit.disabled) submit.click();

    // Hide only after the physical tap has completed, so the underlying button
    // never becomes the pointer target for this same tap.
    setTimeout(() => {
      document.querySelector('#willenaSharedKeyboard .wkb-hide')?.click();
      guarding = false;
    }, 0);
  }, true);

  document.addEventListener('click', e => {
    if (!guarding || !isKeyboardEnter(e.target)) return;
    e.preventDefault();
    e.stopImmediatePropagation();
  }, true);

  document.addEventListener('pointercancel', () => { guarding = false; }, true);
})();
