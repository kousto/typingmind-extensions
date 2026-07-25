(function() {
  'use strict';

  /* ============================================================
   * CSV Download Extension for TypingMind — v3
   * - Sidebar status button (after "Hook")
   * - Green dot when CSV detected
   * - Download CSV button on code blocks
   * ============================================================ */

  const PROCESSED_ATTR = 'data-csv-btn-added';
  const BTN_CLASS = 'tm-csv-download-btn';
  const STATUS_BTN_ID = 'tm-csv-status-btn';
  const STATUS_DOT_ID = 'tm-csv-status-dot';
  let csvDetectedCount = 0;

  /* ============================================================
   * PART 1: SIDEBAR STATUS BUTTON
   * ============================================================ */

  function isDarkMode() {
    return document.documentElement.classList.contains('dark');
  }

  function createStatusButton() {
    if (document.getElementById(STATUS_BTN_ID)) return;

    const hookBtn = document.querySelector('[data-element-id="workspace-tab-auto-action-hook"]');
    if (!hookBtn) return;

    // Copy the Tailwind classes from Hook button for visual consistency
    const hookClasses = hookBtn.className;

    const btn = document.createElement('button');
    btn.id = STATUS_BTN_ID;
    btn.className = hookClasses;
    btn.setAttribute('data-element-id', 'workspace-tab-csv-status');
    btn.style.cursor = 'pointer';
    btn.innerHTML =
      '<div class="relative w-4 h-4 flex-shrink-0">' +
        '<svg class="w-4 h-4 flex-shrink-0" width="18px" height="18px" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">' +
          '<path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>' +
          '<polyline points="14 2 14 8 20 8"></polyline>' +
          '<line x1="8" y1="13" x2="16" y2="13"></line>' +
          '<line x1="8" y1="17" x2="12" y2="17"></line>' +
        '</svg>' +
        '<div id="' + STATUS_DOT_ID + '" style="' +
          'position:absolute;top:-2px;right:-2px;' +
          'width:8px;height:8px;border-radius:50%;' +
          'background-color:#94a3b8;' +
          'border:1.5px solid ' + (isDarkMode() ? '#1e293b' : '#f1f5f9') + ';' +
          'transition:background-color 0.3s ease;' +
        '"></div>' +
      '</div>' +
      '<span class="font-normal mx-auto self-stretch text-center text-xs leading-4 md:leading-none w-full md:w-[51px]" style="hyphens:auto;word-break:break-word;">CSV</span>';

    btn.title = 'CSV Download Extension: ' + csvDetectedCount + ' CSV detected';

    // Click handler: re-scan all responses
    btn.addEventListener('click', function(e) {
      e.preventDefault();
      e.stopPropagation();
      scanAllResponses();
    });

    // Insert AFTER the Hook button
    hookBtn.parentNode.insertBefore(btn, hookBtn.nextSibling);
  }

  function updateStatusDot(detected) {
    const dot = document.getElementById(STATUS_DOT_ID);
    if (!dot) return;

    if (detected) {
      csvDetectedCount++;
      dot.style.backgroundColor = '#22c55e';
      dot.style.boxShadow = '0 0 6px #22c55e';
      dot.style.border = '1.5px solid ' + (isDarkMode() ? '#1e293b' : '#f1f5f9');
    } else {
      dot.style.backgroundColor = '#94a3b8';
      dot.style.boxShadow = 'none';
    }

    const btn = document.getElementById(STATUS_BTN_ID);
    if (btn) {
      btn.title = 'CSV Download Extension: ' + csvDetectedCount + ' CSV detected — click to re-scan';
    }
  }

  /* Observer to ensure the status button stays in the sidebar */
  function watchForHookButton() {
    const sidebarObserver = new MutationObserver(function() {
      if (!document.getElementById(STATUS_BTN_ID)) {
        createStatusButton();
      }
    });

    const sidebar = document.querySelector('[data-element-id="workspace-bar"]');
    if (sidebar) {
      sidebarObserver.observe(sidebar, { childList: true, subtree: true });
    } else {
      // Retry until sidebar is available
      setTimeout(watchForHookButton, 1000);
    }
  }

  /* ============================================================
   * PART 2: CSV DETECTION + DOWNLOAD
   * ============================================================ */

  function looksLikeCSV(text) {
    const trimmed = text.trim();
    if (trimmed.length < 10) return false;

    const lines = trimmed.split('\n').filter(l => l.trim().length > 0);
    if (lines.length < 2) return false;

    let commaLines = 0, semicolonLines = 0, tabLines = 0;
    for (const line of lines) {
      if (line.includes(',')) commaLines++;
      if (line.includes(';')) semicolonLines++;
      if (line.includes('\t')) tabLines++;
    }

    let delimiter = ',';
    let delimiterLines = commaLines;
    if (semicolonLines > commaLines && semicolonLines > tabLines) {
      delimiter = ';'; delimiterLines = semicolonLines;
    } else if (tabLines > commaLines && tabLines > semicolonLines) {
      delimiter = '\t'; delimiterLines = tabLines;
    }

    if (delimiterLines / lines.length < 0.5) return false;

    const counts = lines.slice(0, Math.min(5, lines.length)).map(function(line) {
      let count = 0, inQuotes = false;
      for (let i = 0; i < line.length; i++) {
        if (line[i] === '"') inQuotes = !inQuotes;
        if (line[i] === delimiter && !inQuotes) count++;
      }
      return count;
    });

    if (counts[0] === 0) return false;
    return counts.every(function(c) { return c === counts[0]; });
  }

  function downloadCSV(content, filename) {
    var blob = new Blob(['\uFEFF' + content], { type: 'text/csv;charset=utf-8;' });
    var url = URL.createObjectURL(blob);
    var link = document.createElement('a');
    link.href = url;
    link.download = filename || 'export.csv';
    link.style.display = 'none';
    document.body.appendChild(link);
    link.click();
    setTimeout(function() {
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
    }, 1000);
  }

  function generateFilename() {
    var titleEl = document.querySelector('[data-element-id="current-chat-title"] span');
    var base = 'csv-export';
    if (titleEl) {
      var text = titleEl.textContent.trim();
      if (text) {
        base = text.toLowerCase()
          .replace(/[^a-z0-9]+/g, '-')
          .replace(/^-+|-+$/g, '')
          .substring(0, 30) || 'csv-export';
      }
    }
    var ts = new Date().toISOString().replace(/[:.]/g, '-').substring(0, 19);
    return base + '-' + ts + '.csv';
  }

  function createDownloadButton(csvContent) {
    var dark = isDarkMode();
    var btn = document.createElement('button');
    btn.className = BTN_CLASS + ' '
      + 'inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg '
      + 'text-xs font-medium transition-all cursor-pointer '
      + (dark
        ? 'bg-emerald-600 hover:bg-emerald-500 text-white'
        : 'bg-emerald-500 hover:bg-emerald-600 text-white');
    btn.style.cssText = 'border:none;outline:none;gap:6px;';
    btn.innerHTML =
      '<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">' +
        '<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>' +
        '<polyline points="7 10 12 15 17 10"></polyline>' +
        '<line x1="12" y1="15" x2="12" y2="3"></line>' +
      '</svg>Download CSV';
    btn.addEventListener('click', function(e) {
      e.preventDefault();
      e.stopPropagation();
      downloadCSV(csvContent, generateFilename());
    });
    return btn;
  }

  /* ============================================================
   * PART 3: PROCESS AI RESPONSES
   * ============================================================ */

  function processAIResponse(aiResponseEl) {
    if (!aiResponseEl || aiResponseEl.hasAttribute(PROCESSED_ATTR)) return;
    aiResponseEl.setAttribute(PROCESSED_ATTR, 'true');

    var buttonAdded = false;

    // Strategy 1: <pre><code> blocks
    var preBlocks = aiResponseEl.querySelectorAll('pre');
    preBlocks.forEach(function(pre) {
      if (pre.querySelector('.' + BTN_CLASS)) return;

      var codeEl = pre.querySelector('code');
      if (!codeEl) return;

      var rawText = codeEl.textContent || '';
      if (!rawText.trim()) return;

      var langClass = Array.from(codeEl.classList).find(function(c) {
        return c.indexOf('language-') === 0;
      });
      var isExplicitCSV = langClass === 'language-csv';
      var preLang = (pre.getAttribute('data-language') || '').toLowerCase();
      var isPreLangCSV = preLang === 'csv';
      var isContentCSV = looksLikeCSV(rawText);

      if (!isExplicitCSV && !isPreLangCSV && !isContentCSV) return;

      var btn = createDownloadButton(rawText);
      var wrapper = document.createElement('div');
      wrapper.style.cssText = 'display:flex;justify-content:flex-end;margin-bottom:4px;margin-top:8px;';
      wrapper.appendChild(btn);
      pre.parentNode.insertBefore(wrapper, pre);

      buttonAdded = true;
    });

    // Strategy 2: plain text CSV (no code block)
    if (!buttonAdded) {
      var clone = aiResponseEl.cloneNode(true);
      var thinking = clone.querySelector('[data-element-id="thinking-block"]');
      if (thinking) thinking.remove();
      clone.querySelectorAll('pre').forEach(function(p) { p.remove(); });

      var plainText = (clone.textContent || '').trim();
      if (looksLikeCSV(plainText) && plainText.length > 20) {
        var responseBlock = aiResponseEl.closest('[data-element-id="response-block"]');
        if (responseBlock) {
          var actionsContainer = responseBlock.querySelector(
            '[data-element-id="additional-actions-of-response-container"]'
          );
          if (actionsContainer && !actionsContainer.querySelector('.' + BTN_CLASS)) {
            var btn = createDownloadButton(plainText);
            var wrapper = document.createElement('div');
            wrapper.style.cssText = 'display:flex;justify-content:flex-end;width:100%;';
            wrapper.appendChild(btn);
            actionsContainer.appendChild(wrapper);
            buttonAdded = true;
          }
        }
      }
    }

    if (buttonAdded) {
      // Light up the green dot!
      updateStatusDot(true);
    } else {
      // Remove processed flag so we can retry
      aiResponseEl.removeAttribute(PROCESSED_ATTR);
    }
  }

  function scanAllResponses() {
    var responses = document.querySelectorAll('[data-element-id="ai-response"]');
    responses.forEach(processAIResponse);
  }

  /* ============================================================
   * PART 4: INIT
   * ============================================================ */

  var scanTimer = null;
  function scheduleScan() {
    if (scanTimer) clearTimeout(scanTimer);
    scanTimer = setTimeout(function() {
      scanAllResponses();
      scanTimer = null;
    }, 800);
  }

  function init() {
    console.log('[CSV Download Extension v3] Initializing...');

    // 1) Inject sidebar status button
    function tryCreateButton() {
      if (!document.getElementById(STATUS_BTN_ID)) {
        createStatusButton();
      }
      if (!document.getElementById(STATUS_BTN_ID)) {
        setTimeout(tryCreateButton, 1000);
      }
    }
    tryCreateButton();
    watchForHookButton();

    // 2) Observe chat area for AI responses
    var observer = new MutationObserver(function(mutations) {
      var shouldScan = false;
      for (var i = 0; i < mutations.length; i++) {
        if (mutations[i].addedNodes.length > 0 || mutations[i].type === 'characterData') {
          shouldScan = true;
          break;
        }
      }
      if (shouldScan) scheduleScan();
    });

    function startObserving() {
      var chatArea = document.querySelector('[data-element-id="chat-space-middle-part"]')
        || document.querySelector('.dynamic-chat-content-container')
        || document.querySelector('main');

      if (chatArea) {
        observer.observe(chatArea, {
          childList: true,
          subtree: true,
          characterData: true
        });
        console.log('[CSV Download Extension v3] Observing chat area');
      } else {
        setTimeout(startObserving, 2000);
      }
    }

    startObserving();

    // 3) Initial scan + periodic safety net
    setTimeout(scanAllResponses, 1500);
    setInterval(scanAllResponses, 5000);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
