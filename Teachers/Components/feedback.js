// feedback.js - Handles feedback modal functionality

async function ensureFeedbackModalTemplate() {
  if (!document.getElementById('feedback-modal-template')) {
    const resp = await fetch('/Teachers/components/feedback-modal.html');
    const html = await resp.text();
    const tempDiv = document.createElement('div');
    tempDiv.innerHTML = html;
    document.body.appendChild(tempDiv.firstElementChild);
  }
  
  if (!customElements.get('feedback-modal')) {
    class FeedbackModal extends HTMLElement {
      constructor() {
        super();
        const template = document.getElementById('feedback-modal-template');
        const shadow = this.attachShadow({ mode: 'open' });
        shadow.appendChild(template.content.cloneNode(true));
        
        // Close logic
        shadow.getElementById('feedbackModalCloseBtn').onclick = () => this.remove();
        shadow.getElementById('feedbackCancelBtn').onclick = () => this.remove();
        shadow.getElementById('feedbackModalBg').onclick = (e) => {
          if (e.target === shadow.getElementById('feedbackModalBg')) this.remove();
        };
        
        // Submit logic
        shadow.getElementById('feedbackSubmitBtn').onclick = () => {
          const text = shadow.getElementById('feedbackText').value.trim();
          if (text.length < 3) {
            shadow.getElementById('feedbackText').focus();
            return;
          }
          // TODO: send feedback to backend here
          this.remove();
          alert('Thank you for your feedback!');
        };
      }
    }
    customElements.define('feedback-modal', FeedbackModal);
  }
}

function attachFeedbackToMenu() {
  function tryAttachFeedback(attempts = 0) {
    const burger = document.querySelector('burger-menu');
    if (!burger) return setTimeout(() => tryAttachFeedback(attempts+1), 100);
    const shadow = burger.shadowRoot;
    if (!shadow) return setTimeout(() => tryAttachFeedback(attempts+1), 100);
    const feedbackBtn = shadow.getElementById('feedbackMenuBtn');
    if (feedbackBtn) {
      feedbackBtn.onclick = (e) => {
        e.preventDefault();
        document.body.appendChild(document.createElement('feedback-modal'));
      };
    } else if (attempts < 50) {
      setTimeout(() => tryAttachFeedback(attempts+1), 100);
    }
  }
  tryAttachFeedback();
}

// Initialize feedback system
document.addEventListener('DOMContentLoaded', async function() {
  await ensureFeedbackModalTemplate();
  attachFeedbackToMenu();
});
