/**
 * TypingMind Extension: Auto Action Hook
 * Author: CaptainKousto
 * Version: 6.1
 */

console.log('[AutoActionHook] Script loaded. Initializing v6.1...');

(function() {
  'use strict';

  const STORAGE_KEY = 'auto_action_hook_settings';
  const LOG_KEY = 'auto_action_hook_log';
  const CHANNEL_NAME = 'typingmind-extension-leader';
  const DEFAULT_SETTINGS = {
    enabled: false,
    approvalMode: 'auto',
    triggerText: '[NEEDS_APPROVAL]',
    autoResponseText: 'Yes, approved. Please continue.'
  };

  let settings = loadSettings();
  let observer = null;
  let uiObserver = null;
  let layoutObserver = null;
  let isLeader = false;
  let channel = null;

  // ─────────────────────────────────────────────────────────
  // MULTI-TAB LEADER ELECTION
  // ─────────────────────────────────────────────────────────
  function initLeaderElection() {
    if (!('BroadcastChannel' in window)) {
      isLeader = true;
      console.log('[AutoActionHook] BroadcastChannel not supported. Single-tab mode.');
      return;
    }

    channel = new BroadcastChannel(CHANNEL_NAME);
    const tabId = `tab_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

    channel.onmessage = (event) => {
      const msg = event.data;
      if (!msg || !msg.type) return;

      if (msg.type === 'request-leader' && isLeader) {
        channel.postMessage({ type: 'iam-leader', id: tabId });
      }

      if (msg.type === 'iam-leader' && msg.id !== tabId) {
        isLeader = false;
        console.log('[AutoActionHook] Follower mode. Another tab is the leader.');
        if (observer) { observer.disconnect(); observer = null; }
      }

      if (msg.type === 'leader-unloading' && isLeader === false) {
        setTimeout(() => electLeader(tabId), 500);
      }
    };

    electLeader(tabId);
  }

  function electLeader(tabId) {
    channel.postMessage({ type: 'request-leader' });
    setTimeout(() => {
      if (!isLeader) {
        isLeader = true;
        channel.postMessage({ type: 'iam-leader', id: tabId });
        console.log('[AutoActionHook] Leader mode. This tab will handle auto-responses.');
        startObserver();
      }
    }, 500);
  }

  window.addEventListener('beforeunload', () => {
    if (isLeader && channel) {
      channel.postMessage({ type: 'leader-unloading' });
    }
  });

  // ─────────────────────────────────────────────────────────
  // SETTINGS & LOG
  // ─────────────────────────────────────────────────────────
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
    updateStatusIndicator();
    startObserver();
  }

  function loadLog() {
    try {
      const stored = localStorage.getItem(LOG_KEY);
      if (stored) return JSON.parse(stored);
    } catch (e) {}
    return [];
  }

  function addToLog(entry) {
    const log = loadLog();
    log.unshift({
      timestamp: new Date().toISOString(),
      trigger: entry.trigger,
      response: entry.response,
      status: entry.status || 'success'
    });
    if (log.length > 20) log.length = 20;
    localStorage.setItem(LOG_KEY, JSON.stringify(log));
  }

  // ─────────────────────────────────────────────────────────
  // STYLES
  // ─────────────────────────────────────────────────────────
  function injectStyles() {
    if (document.getElementById('aah-styles')) return;
    const style = document.createElement('style');
    style.id = 'aah-styles';
    style.textContent = `
      .aah-modal-overlay { position: fixed; top: 0; left: 0; width: 100%; height: 100%; background: rgba(0,0,0,0.6); backdrop-filter: blur(4px); z-index: 99999; display: flex; align-items: center; justify-content: center; }
      .aah-modal { background-color: rgb(39, 39, 42); color: white; width: 100%; max-width: 32rem; max-height: 90vh; border-radius: 0.5rem; padding: 1.5rem; border: 1px solid rgba(255,255,255,0.1); box-shadow: 0 20px 25px -5px rgba(0,0,0,0.3); font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; overflow-y: auto; }
      .aah-modal h2 { margin-top: 0; font-size: 1.25rem; font-weight: 600; margin-bottom: 0.5rem; }
      
      /* Toggle Switch */
      .aah-toggle-container { display: flex; align-items: center; justify-content: space-between; margin-bottom: 1.5rem; padding-bottom: 1rem; border-bottom: 1px solid rgba(255,255,255,0.1); }
      .aah-toggle-label { font-size: 0.875rem; font-weight: 500; color: #d4d4d8; }
      .aah-toggle-switch { position: relative; width: 44px; height: 24px; }
      .aah-toggle-switch input { opacity: 0; width: 0; height: 0; }
      .aah-toggle-slider { position: absolute; cursor: pointer; top: 0; left: 0; right: 0; bottom: 0; background-color: rgb(82,82,91); border-radius: 24px; transition: 0.3s; }
      .aah-toggle-slider:before { position: absolute; content: ""; height: 18px; width: 18px; left: 3px; bottom: 3px; background-color: white; border-radius: 50%; transition: 0.3s; }
      .aah-toggle-switch input:checked + .aah-toggle-slider { background-color: rgb(37,99,235); }
      .aah-toggle-switch input:checked + .aah-toggle-slider:before { transform: translateX(20px); }

      .aah-form-group { margin-bottom: 1rem; }
      .aah-form-group label { display: block; margin-bottom: 0.5rem; font-size: 0.875rem; font-weight: 500; color: #d4d4d8; }
      .aah-form-group input, .aah-form-group select { width: 100%; padding: 0.5rem 0.75rem; background-color: rgb(63,63,70); border: 1px solid rgb(82,82,91); color: white; border-radius: 0.375rem; box-sizing: border-box; }
      .aah-form-group input:focus, .aah-form-group select:focus { border-color: rgb(59,130,246); outline: none; box-shadow: 0 0 0 2px rgba(59,130,246,0.2); }
      .aah-form-group select:disabled { opacity: 0.4; cursor: not-allowed; }
      .aah-form-group input:disabled { opacity: 0.4; cursor: not-allowed; }
      .aah-modal-actions { display: flex; justify-content: flex-end; gap: 0.5rem; margin-top: 1.5rem; }
      .aah-btn { padding: 0.5rem 1rem; border: none; border-radius: 0.375rem; cursor: pointer; font-weight: 500; font-size: 0.875rem; }
      .aah-btn-primary { background-color: rgb(37,99,235); color: white; }
      .aah-btn-primary:hover { background-color: rgb(29,78,216); }
      .aah-btn-secondary { background-color: rgb(82,82,91); color: white; }
      .aah-btn-secondary:hover { background-color: rgb(63,63,70); }

      /* Status Dot */
      .aah-status-dot { position: absolute; top: -3px; right: -6px; width: 8px; height: 8px; border-radius: 50%; z-index: 10; display: none; }
      .aah-status-dot.active { background-color: rgb(34, 197, 94); display: block; }
      .aah-status-dot.manual { background-color: rgb(234, 179, 8); display: block; }
      .aah-status-dot.disabled { background-color: rgb(107, 114, 128); display: block; }

      /* Action Log */
      .aah-log-section { margin-top: 1.5rem; padding-top: 1rem; border-top: 1px solid rgba(255,255,255,0.1); }
      .aah-log-title { font-size: 0.875rem; font-weight: 600; color: #d4d4d8; margin-bottom: 0.75rem; }
      .aah-log-list { max-height: 200px; overflow-y: auto; }
      .aah-log-entry { display: flex; align-items: flex-start; gap: 0.5rem; padding: 0.5rem; background-color: rgba(63,63,70,0.5); border-radius: 0.25rem; margin-bottom: 0.25rem; font-size: 0.75rem; }
      .aah-log-time { color: #a1a1aa; white-space: nowrap; }
      .aah-log-trigger { color: #fbbf24; font-weight: 500; }
      .aah-log-response { color: #34d399; }
      .aah-log-error { color: #ef4444; }
      .aah-log-empty { color: #71717a; font-size: 0.75rem; text-align: center; padding: 1rem; }
      .aah-log-clear { margin-top: 0.5rem; font-size: 0.6875rem; color: #a1a1aa; cursor: pointer; background: none; border: none; padding: 0; text-decoration: underline; }
      .aah-log-clear:hover { color: #d4d4d8; }
    `;
    document.head.appendChild(style);
  }

  // ─────────────────────────────────────────────────────────
  // SIDEBAR BUTTON
  // ─────────────────────────────────────────────────────────
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

    const iconSVG = `<svg class="w-[18px] h-[18px] flex-shrink-0" width="18px" height="18px" viewBox="0 0 18 18" xmlns="http://www.w3.org/2000/svg"><path fill="currentColor" d="M10.5,1.5L3,9.75h4.5l-1.5,6.75L13.5,8.25H9l1.5-6.75z"></path></svg>`;
    const statusDot = `<div id="aah-status-dot" class="aah-status-dot"></div>`;

    const expandedHTML = `
      <div class="relative w-4 h-4 flex-shrink-0">${iconSVG}${statusDot}</div>
      <span class="font-normal mx-auto self-stretch text-center text-xs leading-4 md:leading-none w-full md:w-[51px]" style="hyphens: auto; word-break: break-word;">Hook</span>
    `;

    const renderLikeSettings = () => {
      const settingsBtn = document.querySelector('button[data-element-id="workspace-tab-settings"]');
      if (!settingsBtn) return;

      const isPinned = settingsBtn.classList.contains("w-9") && settingsBtn.classList.contains("h-9");
      const classesToExclude = ['active', 'selected'];
      const filteredClasses = Array.from(settingsBtn.classList).filter(
        cls => !classesToExclude.includes(cls) && !cls.startsWith('aria-')
      ).join(' ');
      btn.className = filteredClasses;
      btn.style.cursor = "pointer";

      if (isPinned) {
        btn.setAttribute("data-tooltip-content", "Auto Action Hook");
        btn.innerHTML = `<div class="relative w-[18px] h-[18px] flex-shrink-0">${iconSVG}${statusDot}</div>`;
      } else {
        btn.removeAttribute("data-tooltip-content");
        btn.innerHTML = expandedHTML;
      }

      updateStatusIndicator();
    };

    renderLikeSettings();
    btn.onclick = openModal;
    anchorButton.parentNode.insertBefore(btn, anchorButton.nextSibling);

    const settingsBtn = document.querySelector('button[data-element-id="workspace-tab-settings"]');
    if (settingsBtn) {
      layoutObserver = new MutationObserver(renderLikeSettings);
      layoutObserver.observe(settingsBtn, { attributes: true, attributeFilter: ["class"], childList: true });
    }

    return true;
  }

  // ─────────────────────────────────────────────────────────
  // STATUS INDICATOR
  // ─────────────────────────────────────────────────────────
  function updateStatusIndicator() {
    const dot = document.getElementById('aah-status-dot');
    if (!dot) return;

    dot.className = 'aah-status-dot';
    if (!settings.enabled) {
      dot.classList.add('disabled');
    } else if (settings.approvalMode === 'manual') {
      dot.classList.add('manual');
    } else if (settings.approvalMode === 'auto') {
      dot.classList.add('active');
    }
  }

  // ─────────────────────────────────────────────────────────
  // FULL MODAL
  // ─────────────────────────────────────────────────────────
  function openModal() {
    if (document.getElementById('aah-modal-overlay')) return;

    const logHtml = renderActionLog();

    const overlay = document.createElement('div');
    overlay.id = 'aah-modal-overlay';
    overlay.className = 'aah-modal-overlay';
    overlay.innerHTML = `
      <div class="aah-modal">
        <h2>⚡ Auto Action Hook</h2>
        
        <div class="aah-toggle-container">
          <span class="aah-toggle-label">Enable Hook</span>
          <label class="aah-toggle-switch">
            <input type="checkbox" id="aah-enabled-toggle" ${settings.enabled ? 'checked' : ''}>
            <span class="aah-toggle-slider"></span>
          </label>
        </div>

        <div class="aah-form-group">
          <label>Approval Mode</label>
          <select id="aah-mode" ${!settings.enabled ? 'disabled' : ''}>
            <option value="manual">Manual (Fill textarea, wait for Enter)</option>
            <option value="auto">Auto (Fill and send automatically)</option>
          </select>
        </div>
        <div class="aah-form-group">
          <label>Trigger Text (in LLM output)</label>
          <input type="text" id="aah-trigger" placeholder="[NEEDS_APPROVAL]" ${!settings.enabled ? 'disabled' : ''}>
        </div>
        <div class="aah-form-group">
          <label>Auto Response Text</label>
          <input type="text" id="aah-response" placeholder="Yes, approved. Please continue." ${!settings.enabled ? 'disabled' : ''}>
        </div>
        <div class="aah-modal-actions">
          <button id="aah-cancel" class="aah-btn aah-btn-secondary">Cancel</button>
          <button id="aah-save" class="aah-btn aah-btn-primary">Save</button>
        </div>

        <div class="aah-log-section">
          <div class="aah-log-title">Recent Automated Actions (Last 5)</div>
          <div class="aah-log-list" id="aah-log-list">${logHtml}</div>
          <button class="aah-log-clear" id="aah-log-clear">Clear log</button>
        </div>
      </div>
    `;

    document.body.appendChild(overlay);

    const toggle = document.getElementById('aah-enabled-toggle');
    const modeSelect = document.getElementById('aah-mode');
    const triggerInput = document.getElementById('aah-trigger');
    const responseInput = document.getElementById('aah-response');

    modeSelect.value = settings.approvalMode;
    triggerInput.value = settings.triggerText;
    responseInput.value = settings.autoResponseText;

    // Toggle handler
    toggle.onchange = () => {
      const enabled = toggle.checked;
      modeSelect.disabled = !enabled;
      triggerInput.disabled = !enabled;
      responseInput.disabled = !enabled;
    };

    document.getElementById('aah-save').onclick = () => {
      saveSettings({
        enabled: toggle.checked,
        approvalMode: modeSelect.value,
        triggerText: triggerInput.value,
        autoResponseText: responseInput.value
      });
      overlay.remove();
    };

    document.getElementById('aah-cancel').onclick = () => overlay.remove();
    overlay.onclick = (e) => { if (e.target === overlay) overlay.remove(); };

    document.getElementById('aah-log-clear').onclick = () => {
      localStorage.removeItem(LOG_KEY);
      document.getElementById('aah-log-list').innerHTML = '<div class="aah-log-empty">No actions logged yet.</div>';
    };
  }

  function renderActionLog() {
    const log = loadLog();
    if (log.length === 0) {
      return '<div class="aah-log-empty">No actions logged yet.</div>';
    }

    return log.slice(0, 5).map(entry => {
      const time = new Date(entry.timestamp).toLocaleTimeString();
      const statusClass = entry.status === 'error' ? 'aah-log-error' : 'aah-log-response';
      const statusIcon = entry.status === 'error' ? '❌' : '✅';
      return `
        <div class="aah-log-entry">
          <span class="aah-log-time">${time}</span>
          <span class="aah-log-trigger">${escapeHtml(entry.trigger)}</span>
          <span class="${statusClass}">${statusIcon} ${escapeHtml(entry.response)}</span>
        </div>
      `;
    }).join('');
  }

  // ─────────────────────────────────────────────────────────
  // REACT COMPATIBILITY
  // ─────────────────────────────────────────────────────────
  function setNativeValue(element, value) {
    const prototype = Object.getPrototypeOf(element);
    const prototypeValueSetter = Object.getOwnPropertyDescriptor(prototype, 'value').set;
    if (prototypeValueSetter) {
      prototypeValueSetter.call(element, value);
    }
    element.dispatchEvent(new Event('input', { bubbles: true }));
  }

  // ─────────────────────────────────────────────────────────
  // AUTO RESPONSE TRIGGER
  // ─────────────────────────────────────────────────────────
  function triggerAutoResponse() {
    const textarea = document.querySelector('textarea[data-element-id="chat-input-textarea"]') || document.querySelector('textarea');
    if (textarea) {
      setNativeValue(textarea, settings.autoResponseText);

      setTimeout(() => {
        if (settings.approvalMode === 'manual') {
          console.log('[AutoActionHook] Manual mode: textarea filled, waiting for user to press Enter.');
          addToLog({ trigger: settings.triggerText, response: settings.autoResponseText + ' (manual)', status: 'success' });
          return;
        }

        const sendButton = document.querySelector('button[data-element-id="send-chat-message-button"]') ||
                           document.querySelector('button[aria-label*="Send"]');
        if (sendButton && !sendButton.disabled) {
          sendButton.click();
          console.log('[AutoActionHook] Auto-response sent via click.');
          addToLog({ trigger: settings.triggerText, response: settings.autoResponseText, status: 'success' });
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
          console.log('[AutoActionHook] Auto-response sent via Enter key.');
          addToLog({ trigger: settings.triggerText, response: settings.autoResponseText, status: 'success' });
        }
      }, 200);
    } else {
      console.error('[AutoActionHook] Textarea not found!');
      addToLog({ trigger: settings.triggerText, response: 'Error: Textarea not found', status: 'error' });
    }
  }

  // ─────────────────────────────────────────────────────────
  // CONTENT FILTERING
  // ─────────────────────────────────────────────────────────
  function getActualResponseText(element) {
    const clone = element.cloneNode(true);
    const thinkingBlock = clone.querySelector('[data-element-id="thinking-block"]');
    if (thinkingBlock) thinkingBlock.remove();
    return clone.textContent.trim();
  }

  // ─────────────────────────────────────────────────────────
  // TRIGGER DETECTION
  // ─────────────────────────────────────────────────────────
  function checkForTrigger() {
    if (!isLeader) return;
    if (!settings.enabled) return;
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

      if (settings.approvalMode === 'manual') {
        const textarea = document.querySelector('textarea[data-element-id="chat-input-textarea"]') || document.querySelector('textarea');
        if (textarea) {
          setNativeValue(textarea, settings.autoResponseText);
          addToLog({ trigger: settings.triggerText, response: settings.autoResponseText + ' (manual)', status: 'success' });
          console.log('[AutoActionHook] Manual mode: textarea filled.');
        }
      } else {
        setTimeout(triggerAutoResponse, 500);
      }
    }
  }

  // ─────────────────────────────────────────────────────────
  // OBSERVER
  // ─────────────────────────────────────────────────────────
  function startObserver() {
    if (observer) observer.disconnect();

    if (!settings.enabled) {
      console.log('[AutoActionHook] Hook disabled. Observer stopped.');
      return;
    }

    if (!isLeader) {
      console.log('[AutoActionHook] Not the leader tab. Observer not started.');
      return;
    }

    observer = new MutationObserver(() => {
      checkForTrigger();
    });

    observer.observe(document.body, { childList: true, subtree: true, characterData: true });
    console.log('[AutoActionHook] Observer started in', settings.approvalMode, 'mode.');
  }

  // ─────────────────────────────────────────────────────────
  // UTILITIES
  // ─────────────────────────────────────────────────────────
  function escapeHtml(str) {
    if (!str) return '';
    return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }

  // ─────────────────────────────────────────────────────────
  // INIT
  // ─────────────────────────────────────────────────────────
  function init() {
    injectStyles();

    if (!insertSidebarButton()) {
      uiObserver = new MutationObserver(() => insertSidebarButton());
      uiObserver.observe(document.body, { childList: true, subtree: true });
    }

    initLeaderElection();
    startObserver();

    setInterval(updateStatusIndicator, 2000);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
