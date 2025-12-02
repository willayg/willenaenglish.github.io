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
        // Show name or username in modal
        let name = localStorage.getItem('name') || '';
        let username = localStorage.getItem('username') || '';
        // Try to extract from dashboard header if not found
        if (!name && !username) {
          // Try to find a header element with the username (e.g., top right of dashboard)
          // Try common selectors
          let headerUser = document.querySelector('.dashboard-header-username, .header-username, .user-name, .username, .user, .profile-name, .profile-username');
          if (!headerUser) {
            // Try to find a likely element in the header area
            const header = document.querySelector('header, .dashboard-header, .main-header');
            if (header) {
              // Find a span/div with text content
              headerUser = header.querySelector('span,div');
            }
          }
          if (!headerUser) {
            // Try to find the last text node in the header bar (e.g., "William")
            const nav = document.querySelector('nav');
            if (nav) {
              const textNodes = Array.from(nav.childNodes).filter(n => n.nodeType === 3 && n.textContent.trim().length > 0);
              if (textNodes.length > 0) {
                username = textNodes[textNodes.length - 1].textContent.trim();
              }
            }
          } else {
            username = headerUser.textContent.trim();
          }
        }
        const usernameDisplay = shadow.getElementById('feedbackUsernameDisplay');
        let displayText = '';
        if (name) {
          displayText = `Name: <b>${name}</b>`;
        } else if (username) {
          displayText = `User: <b>${username}</b>`;
        } else {
          displayText = '<span style="color:#c00">Not logged in</span>';
        }
        if (usernameDisplay) {
          usernameDisplay.style = 'text-align:right; font-size:0.95em; color:#555; margin-bottom:8px;';
          usernameDisplay.innerHTML = displayText;
        }
        // Debug log
        console.log('[FeedbackModal] name:', name, 'username:', username, 'displayText:', displayText, 'usernameDisplay:', usernameDisplay);
        
        // Close logic
        shadow.getElementById('feedbackModalCloseBtn').onclick = () => this.remove();
        shadow.getElementById('feedbackCancelBtn').onclick = () => this.remove();
        shadow.getElementById('feedbackModalBg').onclick = (e) => {
          if (e.target === shadow.getElementById('feedbackModalBg')) this.remove();
        };
        
        // Submit logic
        shadow.getElementById('feedbackSubmitBtn').onclick = async () => {
          const text = shadow.getElementById('feedbackText').value.trim();
          if (text.length < 3) {
            shadow.getElementById('feedbackText').focus();
            return;
          }
          // Get username from localStorage
          const username = localStorage.getItem('username') || localStorage.getItem('name') || '';
          if (!username) {
            alert('Username not found. Please refresh the page and try again.');
            return;
          }
          // Prepare payload (only feedback and username)
          const payload = {
            feedback: text,
            username
          };
          try {
            const resp = await fetch('/.netlify/functions/supabase_proxy_fixed?feedback', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ action: 'insert_feedback', data: payload })
            });
            const result = await resp.json();
            if (resp.ok && result.success) {
              this.remove();
              alert('Thank you for your feedback!');
            } else {
              alert('Error sending feedback: ' + (result.error || 'Unknown error'));
            }
          } catch (err) {
            alert('Network error: ' + err.message);
          }
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
