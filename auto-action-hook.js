/**
 * TypingMind Extension: Auto Action Hook
 * Author: CaptainKousto
 */

(function() {
  'use strict';

  console.log('[AutoActionHook] Script loaded. Initializing...');

  const STORAGE_KEY = 'auto_action_hook_settings';
  const DEFAULT_SETTINGS = {
    approvalMode: 'manual',
    triggerText: '[NEEDS_APPROVAL]',
    autoResponseText: 'Yes, approved. Please continue.'
  };

  let settings = loadSettings();
  let observer = null;
  let uiObserver = null;

  function loadSettings() {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        return { ...DEFAULT_SETTINGS, ...JSON.parse(stored) };
      }
    } catch (e) {
      console.error('[AutoActionHook] Error loading settings:', e);
    }
    return { ...DEFAULT_SETTINGS };
  }

  function saveSettings(newSettings) {
    settings = newSettings;
    localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
    startObserver();
    console.log('[AutoActionHook] Settings saved:', settings);
  }

  function injectStyles() {
    const style = document.createElement('style');
    style.textContent = `
      .aah-modal-overlay {
        position: fixed; top: 0; left: 0; width: 100%; height: 100%;
        background: rgba(0, 0, 0, 0.5); z-index: 9999;
        display: flex; align-items: center; justify-content: center;
      }
      .aah-modal {
        background: #1f2937; color: #fff;
        padding: 20px; border-radius: 8px; width: 400px; max-width: 90%;
        box-shadow: 0 4px 6px rgba(0,0,0,0.1);
        font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
      }
      .aah-modal h2 { margin-top: 0; font-size: 1.2rem; }
      .aah-form-group { margin-bottom: 15px; }
      .aah-form-group label { display: block; margin-bottom: 5px; font-weight: bold; font-size: 0.9rem; }
      .aah-form-group input, .aah-form-group select {
        width: 100%; padding: 8px; border: 1px solid #444; border-radius: 4px;
        background: #111827; color: #fff;
        box-sizing: border-box;
      }
      .aah-modal-actions { display: flex; justify-content: flex-end; gap: 10px; margin-top: 20px; }
      .aah-btn {
        padding: 8px 16px; border: none; border-radius: 4px; cursor: pointer;
        font-weight: bold;
      }
      .aah-btn-primary { background: #007bff; color: white; }
      .aah-btn-secondary { background: #6c757d; color: white; }
      .aah-sidebar-btn {
        margin: 10px; padding: 8px; border-radius: 4px; cursor: pointer;
        border: 1px solid #444;
        background: #111827; color: #fff; width: calc(100% - 20px);
        text-align: left; display: flex; align-items: center; gap: 8px;
        font-size: 14px;
      }
      .aah-sidebar-btn:hover { background: #374151; }
    `;
    document.head.appendChild(style);
  }

  function injectSidebarButton() {
    if (document.getElementById('aah-sidebar-btn')) return;

    // Look for the standard aside element used in modern web apps
    const sidebar = document.querySelector('aside') || 
                   document.querySelector('[class*="sidebar"]') ||
                   document.querySelector('[data-element-id="sidebar-container"]');
                   
    if (!sidebar) {
      // Use a MutationObserver to wait for the sidebar to appear
      if (!uiObserver) {
        uiObserver = new MutationObserver(() => injectSidebarButton());
        uiObserver.observe(document.body, { childList: true, subtree: true });
      }
      return;
    }

    // Disconnect the observer once the button is injected
    if (uiObserver) {
      uiObserver.disconnect();
      uiObserver = null;
    }

    const btn = document.createElement('button');
    btn.id = 'aah-sidebar-btn';
    btn.className = 'aah-sidebar-btn';
    btn.innerHTML = '⚡ Auto Action Hook';
    btn.onclick = openModal;
    
    sidebar.appendChild(btn);
    console.log('[AutoActionHook] Sidebar button injected.');
  }

  function openModal() {
    if (document.getElementById('aah-modal-overlay')) return;

    const overlay = document.createElement('div');
    overlay.id = 'aah-modal-overlay';
    overlay.className = 'aah-modal-overlay';
    
    overlay.innerHTML = `
      <div class="aah-modal">
        <h2>⚡ Auto Action Hook Settings</h2>
        <div class="aah-form-group">
          <label>Approval Mode</label>
          <select id="aah-mode">
            <option value="manual">Manual (Pause for each action)</option>
            <option value="auto">Auto (Autonomous, stop if dangerous)</option>
            <option value="ignore">Ignore (Never stop)</option>
          </select>
        </div>
        <div class="aah-form-group">
          <label>Trigger Text (in LLM output)</label>
          <input type="text" id="aah-trigger" placeholder="[NEEDS_APPROVAL]">
        </div>
        <div class="aah-form-group">
          <label>Auto Response Text</label>
          <input type="text" id="aah-response" placeholder="Yes, approved. Please continue.">
        </div>
        <div class="aah-modal-actions">
          <button id="aah-save" class="aah-btn aah-btn-primary">Save</button>
          <button id="aah-cancel" class="aah-btn aah-btn-secondary">Cancel</button>
        </div>
      </div>
    `;

    document.body.appendChild(overlay);

    document.getElementById('aah-mode').value = settings.approvalMode;
    document.getElementById('aah-trigger').value = settings.triggerText;
    document.getElementById('aah-response').value = settings.autoResponseText;

    document.getElementById('aah-save').onclick = () => {
      const newSettings = {
        approvalMode: document.getElementById('aah-mode').value,
        triggerText: document.getElementById('aah-trigger').value,
        autoResponseText: document.getElementById('aah-response').value
      };
      saveSettings(newSettings);
      overlay.remove();
    };

    document.getElementById('aah-cancel').onclick = () => overlay.remove();
    overlay.onclick = (e) => { if (e.target === overlay) overlay.remove(); };
  }

  function setNativeValue(element, value) {
    const prototype = Object.getPrototypeOf(element);
    const prototypeValueSetter = Object.getOwnPropertyDescriptor(prototype, 'value').set;
    if (prototypeValueSetter) {
      prototypeValueSetter.call(element, value);
    }
    element.dispatchEvent(new Event('input', { bubbles: true }));
  }

  function triggerAutoResponse() {
    const textarea = document.querySelector('textarea[data-element-id="chat-input-textarea"]') || 
                     document.querySelector('textarea');
    if (textarea) {
      setNativeValue(textarea, settings.autoResponseText);
      setTimeout(() => {
        const sendButton = document.querySelector('button[data-element-id="send-chat-message-button"]') || 
                           document.querySelector('button[aria-label*="Send"]') || 
                           document.querySelector('button[type="submit"]');
        if (sendButton) {
          sendButton.click();
          console.log('[AutoActionHook] Auto-response sent.');
        }
      }, 100);
    }
  }

  function startObserver() {
    if (observer) observer.disconnect();

    if (settings.approvalMode === 'manual') {
      console.log('[AutoActionHook] Manual mode active. Observer stopped.');
      return;
    }

    observer = new MutationObserver((mutations) => {
      for (const mutation of mutations) {
        for (const node of mutation.addedNodes) {
          if (node.nodeType === 1) {
            const messages = node.matches('[class*="message"], [class*="assistant"]') ? [node] : node.querySelectorAll('[class*="message"], [class*="assistant"]');
            messages.forEach(msg => {
              if (msg.dataset.aahProcessed) return;
              if (msg.textContent && msg.textContent.includes(settings.triggerText)) {
                msg.dataset.aahProcessed = 'true';
                console.log('[AutoActionHook] Trigger detected:', settings.triggerText);
                setTimeout(triggerAutoResponse, 500);
              }
            });
          }
        }
      }
    });

    observer.observe(document.body, { childList: true, subtree: true });
    console.log('[AutoActionHook] Observer started in', settings.approvalMode, 'mode.');
  }

  function init() {
    console.log('[AutoActionHook] Initializing extension...');
    injectStyles();
    injectSidebarButton();
    startObserver();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
