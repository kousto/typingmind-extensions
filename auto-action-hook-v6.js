/**
 * TypingMind Extension: Auto Action Hook
 * Author: CaptainKousto
 * Version: 6.0
 */

console.log('[AutoActionHook] Script loaded. Initializing v6.0...');

(function() {
  'use strict';

  const STORAGE_KEY = 'auto_action_hook_settings';
  const LOG_KEY = 'auto_action_hook_log';
  const CHANNEL_NAME = 'typingmind-extension-leader';
  const DEFAULT_SETTINGS = {
    approvalMode: 'disabled',
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
    // Keep only last 20 entries
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
      .aah-modal h2 { margin-top: 0; font-size: 1.25rem; font-weight: 600; margin-bottom: 1.5rem; }
      .aah-form-group { margin-bottom: 1rem; }
      .aah-form-group label { display: block; margin-bottom: 0.5rem; font-size: 0.875rem; font-weight: 500; color: #d4d4d8; }
      .aah-form-group input, .aah-form-group select { width: 100%; padding: 0.5rem 0.75rem; background-color: rgb(63,63,70); border: 1px solid rgb(82,82,91); color: white; border-radius: 0.375rem; box-sizing: border-box; }
      .aah-form-group input:focus, .aah-form-group select:focus { border-color: rgb(59,130,246); outline: none; box-shadow: 0 0 0 2px rgba(59,130,246,0.2); }
      .aah-modal-actions { display: flex; justify-content: flex-end; gap: 0.5rem; margin-top: 1.5rem; }
      .aah-btn { padding: 0.5rem 1rem; border: none; border-radius: 0.375rem; cursor: pointer; font-weight: 500; font-size: 0.875rem; }
      .aah-btn-primary { background-color: rgb(37,99,235); color: white; }
      .aah-btn-primary:hover { background-color: rgb(29,78,216); }
      .aah-btn-secondary { background-color: rgb(82,82,91); color: white; }
      .aah-btn-secondary:hover { background-color: rgb(63,63,70); }
      .aah-btn-danger { background-color: rgb(220,38,38); color: white; }

      /* Status Dot */
      .aah-status-dot { position: absolute; top: -3px; right: -6px; width: 8px; height: 8px; border-radius: 50%; z-index: 10; display: none; }
      .aah-status-dot.active { background-color: rgb(34, 197, 94); display: block; }
      .aah-status-dot.manual { background-color: rgb(234, 179, 8); display: block; }
      .aah-status-dot.disabled { background-color: rgb(107, 114, 128); display: block; }

      /* Popover (Quick Edit) */
      .aah-popover { position: absolute; bottom: calc(100% + 8px); left: 50%; transform: translateX(-50%); background-color: rgb(39, 39, 42); border: 1px solid rgba(255,255,255,0.1); border-radius: 0.5rem; padding: 1rem; width: 280px; z-index: 99998; box-shadow: 0 10px 15px -3px rgba(0,0,0,0.3); font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; }
      .aah-popover::after { content: ''; position: absolute; top: 100%; left: 50%; transform: translateX(-50%); border: 6px solid transparent; border-top-color: rgb(39, 39, 42); }
      .aah-popover-title { font-size: 0.75rem; font-weight: 600; color: #d4d4d8; margin-bottom: 0.75rem; text-transform: uppercase; letter-spacing: 0.05em; }
      .aah-popover select { width: 100%; padding: 0.375rem 0.5rem; background-color: rgb(63,63,70); border: 1px solid rgb(82,82,91); color: white; border-radius: 0.25rem; font-size: 0.75rem; margin-bottom: 0.5rem; box-sizing: border-box; }
      .aah-popover input { width: 100%; padding: 0.375rem 0.5rem; background-color: rgb(63,63,70); border: 1px solid rgb(82,82,91); color: white; border-radius: 0.25rem; font-size: 0.75rem; margin-bottom: 0.5rem; box-sizing: border-box; }
      .aah-popover input:focus, .aah-popover select:focus { border-color: rgb(59,130,246); outline: none; }
      .aah-popover-label { font-size: 0.6875rem; color: #a1a1aa; margin-bottom: 0.25rem; display: block; }
      .aah-popover-actions { display: flex; gap: 0.5rem; margin-top: 0.5rem; }
      .aah-popover-btn { flex: 1; padding: 0.375rem; border: none; border-radius: 0.25rem; cursor: pointer; font-size: 0.75rem; font-weight: 500; }
      .aah-popover-btn-save { background-color: rgb(37,99,235); color: white; }
      .aah-popover-btn-save:hover { background-color: rgb(29,78,216); }
      .aah-popover-btn-full { background-color: rgb(82,82,91); color: white; }
      .aah-popover-btn-full:hover { background-color: rgb(63,63,70); }

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

    // Lightning bolt SVG using currentColor
    const iconSVG = `<svg class="w-[18px] h-[18px] flex-shrink-0" width="18px" height="18px" viewBox="0 0 18 18" xmlns="http://www.w3.org/2000/svg"><path fill="currentColor" d="M10.5,1.5L3,9.75h4.5l-1.5,6.75L13.5,8.25H9l1.5-6.75z"></path></svg>`;

    // Status dot
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
    btn.onclick = togglePopover;
    anchorButton.parentNode.insertBefore(btn, anchorButton.nextSibling);

    // Observe Settings button for layout changes
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
    if (settings.approvalMode === 'disabled') {
      dot.classList.add('disabled');
    } else if (settings.approvalMode === 'manual') {
      dot.classList.add('manual');
    } else if (settings.approvalMode === 'auto' || settings.approvalMode === 'ignore') {
      dot.classList.add('active');
    }
  }

  // ─────────────────────────────────────────────────────────
  // POPOVER (QUICK EDIT)
  // ─────────────────────────────────────────────────────────
  function togglePopover(e) {
    e.stopPropagation();
    if (document.getElementById('aah-popover')) {
      closePopover();
      return;
    }
    showPopover();
  }

  function showPopover() {
    const btn = document.getElementById('aah-sidebar-btn');
    if (!btn) return;

    const btnRect = btn.getBoundingClientRect();

    const popover = document.createElement('div');
    popover.id = 'aah-popover';
    popover.className = 'aah-popover';
    popover.style.position = 'fixed';
    popover.style.bottom = `${window.innerHeight - btnRect.top + 8}px`;
    popover.style.left = `${btnRect.left + btnRect.width / 2}px`;
    popover.style.transform = 'translateX(-50%)';

    popover.innerHTML = `
      <div class="aah-popover-title">⚡ Quick Settings</div>
      <select id="aah-pop-mode">
        <option value="disabled">Disabled</option>
        <option value="manual">Manual</option>
        <option value="auto">Auto</option>
      </select>
      <span class="aah-popover-label">Trigger Text</span>
      <input type="text" id="aah-pop-trigger" placeholder="[NEEDS_APPROVAL]" value="${escapeHtml(settings.triggerText)}">
      <span class="aah-popover-label">Auto Response</span>
      <input type="text" id="aah-pop-response" placeholder="Yes, approved." value="${escapeHtml(settings.autoResponseText)}">
      <div class="aah-popover-actions">
        <button class="aah-popover-btn aah-popover-btn-save" id="aah-pop-save">Save</button>
        <button class="aah-popover-btn aah-popover-btn-full" id="aah-pop-full">Full Settings</button>
      </div>
    `;

    document.body.appendChild(popover);

    document.getElementById('aah-pop-mode').value = settings.approvalMode;

    document.getElementById('aah-pop-save').onclick = () => {
      saveSettings({
        approvalMode: document.getElementById('aah-pop-mode').value,
        triggerText: document.getElementById('aah-pop-trigger').value,
        autoResponseText: document.getElementById('aah-pop-response').value
      });
      closePopover();
    };

    document.getElementById('aah-pop-full').onclick = () => {
      closePopover();
      openModal();
    };

    // Close on outside click
    setTimeout(() => {
      document.addEventListener('click', closePopoverOnOutside);
    }, 0);
  }

  function closePopoverOnOutside(e) {
    const popover = document.getElementById('aah-popover');
    const btn = document.getElementById('aah-sidebar-btn');
    if (popover && !popover.contains(e.target) && e.target !== btn) {
      closePopover();
    }
  }

  function closePopover() {
    const popover = document.getElementById('aah-popover');
    if (popover) popover.remove();
    document.removeEventListener('click', closePopoverOnOutside);
  }

  // ─────────────────────────────────────────────────────────
  // FULL MODAL (WITH ACTION LOG)
  // ─────────────────────────────────────────────────────────
  function openModal() {
    if (document.getElementById('aah-modal-overlay')) return;

    const logHtml = renderActionLog();

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
            <option value="auto">Auto (Autonomous, fill and send)</option>
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

        <div class="aah-log-section">
          <div class="aah-log-title">Recent Automated Actions (Last 5)</div>
          <div class="aah-log-list" id="aah-log-list">${logHtml}</div>
          <button class="aah-log-clear" id="aah-log-clear">Clear log</button>
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
          addToLog({ trigger: settings.triggerText, response: settings.autoResponseText + ' (manual - waiting)', status: 'success' });
          return;
        }

        // Auto mode: send the message
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
    if (settings.approvalMode === 'disabled' || settings.approvalMode === 'manual') return;
    if (!settings.triggerText || settings.triggerText.trim() === '') return;

    // Check if LLM is still generating
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
        // Just fill, don't send
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

    if (settings.approvalMode === 'disabled') {
      console.log('[AutoActionHook] Disabled mode. Observer stopped.');
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

    // Update status indicator periodically (in case DOM re-renders)
    setInterval(updateStatusIndicator, 2000);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
