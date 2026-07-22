/**
 * TypingMind Extension: Auto Action Hook
 * Author: CaptainKousto
 * Version: 5.2
 */

console.log('[AutoActionHook] Script loaded. Initializing v5.2...');

(function() {
  'use strict';

  const STORAGE_KEY = 'auto_action_hook_settings';
  const DEFAULT_SETTINGS = {
    approvalMode: 'disabled',
    triggerText: '[NEEDS_APPROVAL]',
    autoResponseText: 'Yes, approved. Please continue.'
  };

  let settings = loadSettings();
  let observer = null;
  let uiObserver = null;
  let layoutObserver = null;

  function loadSettings() {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) return { ...DEFAULT_SETTINGS, ...JSON.parse(stored) };
    } catch (e) {}
    return { ...DEFAULT_SETTINGS };
  }

  function saveSettings(newSettings) {
    settings = newSettings;
    localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
    startObserver();
  }

  function injectStyles() {
    if (document.getElementById('aah-styles')) return;
    const style = document.createElement('style');
    style.id = 'aah-styles';
    style.textContent = `
      .aah-modal-overlay { position: fixed; top: 0; left: 0; width: 100%; height: 100%; background: rgba(0,0,0,0.6); backdrop-filter: blur(4px); z-index: 99999; display: flex; align-items: center; justify-content: center; }
      .aah-modal { background-color: rgb(39, 39, 42); color: white; width: 100%; max-width: 32rem; max-height: 90vh; border-radius: 0.5rem; padding: 1.5rem; border: 1px solid rgba(255,255,255,0.1); box-shadow: 0 20px 25px -5px rgba(0,0,0,0.3); font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; overflow-y: auto; }
      .aah-modal h2 { margin-top: 0; font-size: 1.25rem; font-weight: 600; margin-bottom: 1.5rem; }
      .aah-form-group { margin-bottom: 1rem; }
      .aah-form-group label { display: block; margin-bottom: 0.5rem; font-size: 0.875rem; font-weight: 500; color: #d4d4d8; }
      .aah-form-group input, .aah-form-group select { width: 100%; padding: 0.5rem 0.75rem; background-color: rgb(63,63,70); border: 1px solid rgb(82,82,91); color: white; border-radius: 0.375rem; box-sizing: border-box; }
      .aah-form-group input:focus, .aah-form-group select:focus { border-color: rgb(59,130,246); outline: none; box-shadow: 0 0 0 2px rgba(59,130,246,0.2); }
      .aah-modal-actions { display: flex; justify-content: flex-end; gap: 0.5rem; margin-top: 1.5rem; }
      .aah-btn { padding: 0.5rem 1rem; border: none; border-radius: 0.375rem; cursor: pointer; font-weight: 500; font-size: 0.875rem; }
      .aah-btn-primary { background-color: rgb(37,99,235); color: white; }
      .aah-btn-secondary { background-color: rgb(82,82,91); color: white; }
    `;
    document.head.appendChild(style);
  }

  function insertSidebarButton() {
    if (document.getElementById('aah-sidebar-btn')) return true;

    const anchorButton = document.querySelector('button[data-element-id="workspace-tab-cloudsync"]') || 
                         document.querySelector('button[data-element-id="workspace-tab-chat"]');
                         
    if (!anchorButton?.parentNode) return false;

    if (uiObserver) { uiObserver.disconnect(); uiObserver = null; }

    const btn = document.createElement('button');
    btn.id = 'aah-sidebar-btn';
    btn.setAttribute('data-element-id', 'workspace-tab-auto-action-hook');
    btn.setAttribute('data-tooltip-id', 'global');
    btn.setAttribute('data-tooltip-place', 'right');
    btn.style.cursor = "pointer";

    // Icône SVG Foudre (Lightning Bolt) utilisant currentColor
    const iconSVG = `<svg class="w-[18px] h-[18px] flex-shrink-0" width="18px" height="18px" viewBox="0 0 18 18" xmlns="http://www.w3.org/2000/svg"><path fill="currentColor" d="M10.5,1.5L3,9.75h4.5l-1.5,6.75L13.5,8.25H9l1.5-6.75z"></path></svg>`;
    
    const expandedHTML = `
      <div class="relative w-4 h-4 flex-shrink-0">${iconSVG}</div>
      <span class="font-normal mx-auto self-stretch text-center text-xs leading-4 md:leading-none w-full md:w-[51px]" style="hyphens: auto; word-break: break-word;">Hook</span>
    `;

    // Fonction qui copie l'état (pinned/expanded) du bouton Settings natif
    const renderLikeSettings = () => {
      const settingsBtn = document.querySelector('button[data-element-id="workspace-tab-settings"]');
      if (!settingsBtn) return;

      const isPinned = settingsBtn.classList.contains("w-9") && settingsBtn.classList.contains("h-9");

      // Copie des classes dynamiques
      const classesToExclude = ['active', 'selected'];
      const filteredClasses = Array.from(settingsBtn.classList).filter(
        cls => !classesToExclude.includes(cls) && !cls.startsWith('aria-')
      ).join(' ');
      btn.className = filteredClasses;
      btn.style.cursor = "pointer";

      if (isPinned) {
        btn.setAttribute("data-tooltip-content", "Auto Action Hook");
        btn.innerHTML = iconSVG;
      } else {
        btn.removeAttribute("data-tooltip-content");
        btn.innerHTML = expandedHTML;
      }
    };

    renderLikeSettings();
    btn.onclick = openModal;
    anchorButton.parentNode.insertBefore(btn, anchorButton.nextSibling);

    // Observation du bouton Settings pour adapter le bouton Hook quand la sidebar change de taille
    const settingsBtn = document.querySelector('button[data-element-id="workspace-tab-settings"]');
    if (settingsBtn) {
      layoutObserver = new MutationObserver(renderLikeSettings);
      layoutObserver.observe(settingsBtn, { attributes: true, attributeFilter: ["class"], childList: true });
    }

    return true;
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
            <option value="disabled">Disabled (Hook is turned off)</option>
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
          <button id="aah-cancel" class="aah-btn aah-btn-secondary">Cancel</button>
          <button id="aah-save" class="aah-btn aah-btn-primary">Save</button>
        </div>
      </div>
    `;

    document.body.appendChild(overlay);

    document.getElementById('aah-mode').value = settings.approvalMode;
    document.getElementById('aah-trigger').value = settings.triggerText;
    document.getElementById('aah-response').value = settings.autoResponseText;

    document.getElementById('aah-save').onclick = () => {
      saveSettings({
        approvalMode: document.getElementById('aah-mode').value,
        triggerText: document.getElementById('aah-trigger').value,
        autoResponseText: document.getElementById('aah-response').value
      });
      overlay.remove();
    };

    document.getElementById('aah-cancel').onclick = () => overlay.remove();
    overlay.onclick = (e) => { if (e.target === overlay) overlay.remove(); };
  }

  function setNativeValue(element, value) {
    const prototype = Object.getPrototypeOf(element);
    const prototypeValueSetter = Object.getOwnPropertyDescriptor(prototype, 'value').set;
    if (prototypeValueSetter) prototypeValueSetter.call(element, value);
    element.dispatchEvent(new Event('input', { bubbles: true }));
  }

  function triggerAutoResponse() {
    const textarea = document.querySelector('textarea[data-element-id="chat-input-textarea"]') || document.querySelector('textarea');
    if (textarea) {
      setNativeValue(textarea, settings.autoResponseText);
      
      setTimeout(() => {
        const sendButton = document.querySelector('button[data-element-id="send-chat-message-button"]') || 
                           document.querySelector('button[aria-label*="Send"]');
        if (sendButton && !sendButton.disabled) {
          sendButton.click();
        } else {
          const enterEvent = new KeyboardEvent('keydown', {
            key: 'Enter',
            code: 'Enter',
            keyCode: 13,
            which: 13,
            bubbles: true,
            cancelable: true
          });
          textarea.dispatchEvent(enterEvent);
        }
      }, 200);
    }
  }

  function getActualResponseText(element) {
    const clone = element.cloneNode(true);
    const thinkingBlock = clone.querySelector('[data-element-id="thinking-block"]');
    if (thinkingBlock) thinkingBlock.remove();
    return clone.textContent.trim();
  }

  function checkForTrigger() {
    if (settings.approvalMode === 'disabled' || settings.approvalMode === 'manual') return;
    if (!settings.triggerText || settings.triggerText.trim() === '') return;

    const stopBtn = document.querySelector('button[data-element-id="stop-generating-button"]');
    if (stopBtn) return;

    const allAiResponses = document.querySelectorAll('[data-element-id="ai-response"]');
    if (allAiResponses.length === 0) return;

    const lastMsg = allAiResponses[allAiResponses.length - 1];
    if (!lastMsg) return;

    if (lastMsg.dataset.aahProcessed === 'true') return;

    const actualText = getActualResponseText(lastMsg);
    
    if (actualText.includes(settings.triggerText)) {
      lastMsg.dataset.aahProcessed = 'true';
      console.log('[AutoActionHook] Trigger detected:', settings.triggerText);
      setTimeout(triggerAutoResponse, 500);
    }
  }

  function startObserver() {
    if (observer) observer.disconnect();

    if (settings.approvalMode === 'disabled' || settings.approvalMode === 'manual') return;

    observer = new MutationObserver(() => {
      checkForTrigger();
    });

    observer.observe(document.body, { childList: true, subtree: true, characterData: true });
  }

  function init() {
    injectStyles();
    if (!insertSidebarButton()) {
      uiObserver = new MutationObserver(() => insertSidebarButton());
      uiObserver.observe(document.body, { childList: true, subtree: true });
    }
    startObserver();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
