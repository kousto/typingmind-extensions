(function() {
  'use strict';

  /* ============================================================
   * CSV Download Extension for TypingMind — v5
   * - No duplicate buttons (fixed parent.closest check)
   * - Button styled exactly like "Copy code" (no green bg)
   * ============================================================ */

  var PROCESSED_ATTR = 'data-csv-btn-added';
  var BTN_CLASS = 'tm-csv-download-btn';
  var STATUS_BTN_ID = 'tm-csv-status-btn';
  var STATUS_DOT_ID = 'tm-csv-status-dot';
  var csvDetectedCount = 0;

  /* ============================================================
   * PART 1: SIDEBAR STATUS BUTTON
   * ============================================================ */

  function isDarkMode() {
    return document.documentElement.classList.contains('dark');
  }

  function createStatusButton() {
    if (document.getElementById(STATUS_BTN_ID)) return;

    var hookBtn = document.querySelector('[data-element-id="workspace-tab-auto-action-hook"]');
    if (!hookBtn) return;

    var btn = document.createElement('button');
    btn.id = STATUS_BTN_ID;
    btn.className = hookBtn.className;
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

    btn.addEventListener('click', function(e) {
      e.preventDefault();
      e.stopPropagation();
      scanAllResponses();
    });

    hookBtn.parentNode.insertBefore(btn, hookBtn.nextSibling);
  }

  function updateStatusDot(detected) {
    var dot = document.getElementById(STATUS_DOT_ID);
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

    var btn = document.getElementById(STATUS_BTN_ID);
    if (btn) {
      btn.title = 'CSV Download Extension: ' + csvDetectedCount + ' CSV detected — click to re-scan';
    }
  }

  function watchForHookButton() {
    var sidebarObserver = new MutationObserver(function() {
      if (!document.getElementById(STATUS_BTN_ID)) {
        createStatusButton();
      }
    });

    var sidebar = document.querySelector('[data-element-id="workspace-bar"]');
    if (sidebar) {
      sidebarObserver.observe(sidebar, { childList: true, subtree: true });
    } else {
      setTimeout(watchForHookButton, 1000);
    }
  }

  /* ============================================================
   * PART 2: CSV DETECTION + DOWNLOAD
   * ============================================================ */

  function looksLikeCSV(text) {
    var trimmed = text.trim();
    if (trimmed.length < 10) return false;

    var lines = trimmed.split('\n').filter(function(l) { return l.trim().length > 0; });
    if (lines.length < 2) return false;

    var commaLines = 0, semicolonLines = 0, tabLines = 0;
    for (var i = 0; i < lines.length; i++) {
      if (lines[i].indexOf(',') !== -1) commaLines++;
      if (lines[i].indexOf(';') !== -1) semicolonLines++;
      if (lines[i].indexOf('\t') !== -1) tabLines++;
    }

    var delimiter = ',';
    var delimiterLines = commaLines;
    if (semicolonLines > commaLines && semicolonLines > tabLines) {
      delimiter = ';'; delimiterLines = semicolonLines;
    } else if (tabLines > commaLines && tabLines > semicolonLines) {
      delimiter = '\t'; delimiterLines = tabLines;
    }

    if (delimiterLines / lines.length < 0.5) return false;

    var sample = lines.slice(0, Math.min(5, lines.length));
    var counts = sample.map(function(line) {
      var count = 0, inQuotes = false;
      for (var i = 0; i < line.length; i++) {
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

  /* --- Create download button with EXACT SAME style as "Copy code" --- */
  function createDownloadButton(csvContent) {
    var btn = document.createElement('button');
    /* These classes are copied from TypingMind's "Copy code" button */
    btn.className = BTN_CLASS + ' '
      + 'rounded-full flex items-center gap-1 '
      + 'dark:bg-gray-900 dark:text-white '
      + 'py-1 px-2.5 text-xs font-light text-gray-900 font-sans select-none';
    btn.style.cssText = 'cursor:pointer;gap:4px;';
    btn.innerHTML =
      '<svg class="w-3 h-3" width="18px" height="18px" viewBox="0 0 18 18" xmlns="http://www.w3.org/2000/svg">' +
        '<g fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5">' +
          '<path d="M9 12.5V2.25"></path>' +
          '<polyline points="5.5 6 9 2.25 12.5 6"></polyline>' +
          '<path d="M3.25 9v6a.75.75 0 0 0 .75.75h10a.75.75 0 0 0 .75-.75V9"></path>' +
        '</g>' +
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

    /* --- Strategy 1: <pre> code blocks --- */
    var allPreBlocks = aiResponseEl.querySelectorAll('pre');

    allPreBlocks.forEach(function(pre) {
      if (pre.querySelector('.' + BTN_CLASS)) return; // already has button

      /* ============================================================
       * FIX: Skip nested <pre> elements
       * Element.closest() includes the element itself, so we check
       * the PARENT. If any ancestor <pre> exists, this is a nested pre.
       * ============================================================ */
      if (pre.parentElement && pre.parentElement.closest('pre')) return;

      /* Find the <code> element inside */
      var codeEl = pre.querySelector('code');
      if (!codeEl) return;

      var rawText = codeEl.textContent || '';
      if (!rawText.trim()) return;

      /* Check explicit CSV language */
      var langClass = null;
      codeEl.classList.forEach(function(c) {
        if (c.indexOf('language-') === 0) langClass = c;
      });
      var isExplicitCSV = langClass === 'language-csv';

      var preLang = (pre.getAttribute('data-language') || '').toLowerCase();
      var isPreLangCSV = preLang === 'csv';

      /* Check the language label in the header */
      var langLabel = pre.querySelector('.sticky span');
      var labelLang = langLabel ? (langLabel.textContent || '').toLowerCase().trim() : '';
      var isLabelCSV = labelLang === 'csv';

      var isContentCSV = looksLikeCSV(rawText);

      if (!isExplicitCSV && !isPreLangCSV && !isLabelCSV && !isContentCSV) return;

      /* Find the code-block header (sticky div) and the Copy code button */
      var headerDiv = pre.querySelector('.sticky');
      var copyBtn = headerDiv ? headerDiv.querySelector('button') : null;

      if (headerDiv && copyBtn) {
        /* Check if a button group already exists */
        var existingGroup = copyBtn.parentElement;
        if (existingGroup && existingGroup.getAttribute('data-csv-btn-group') === 'true') {
          /* Group already exists, just prepend our button */
          existingGroup.insertBefore(createDownloadButton(rawText), copyBtn);
        } else {
          /* Create a new group: [Download CSV] [Copy code] */
          var btnGroup = document.createElement('div');
          btnGroup.className = 'flex items-center gap-1';
          btnGroup.setAttribute('data-csv-btn-group', 'true');

          /* Move the copy button into the group */
          headerDiv.insertBefore(btnGroup, copyBtn);
          btnGroup.appendChild(copyBtn);
          /* Insert our button before the copy button */
          btnGroup.insertBefore(createDownloadButton(rawText), copyBtn);
        }

        buttonAdded = true;
      } else {
        /* Fallback: insert before the <pre> block */
        var wrapper = document.createElement('div');
        wrapper.style.cssText = 'display:flex;justify-content:flex-end;margin-bottom:4px;margin-top:8px;';
        wrapper.appendChild(createDownloadButton(rawText));
        pre.parentNode.insertBefore(wrapper, pre);
        buttonAdded = true;
      }
    });

    /* --- Strategy 2: plain text CSV (no code block) --- */
    if (!buttonAdded) {
      var clone = aiResponseEl.cloneNode(true);
      var thinking = clone.querySelector('[data-element-id="thinking-block"]');
      if (thinking) thinking.remove();
      clone.querySelectorAll('pre').forEach(function(p) { p.remove(); });
      clone.querySelectorAll('table').forEach(function(t) { t.remove(); });

      var plainText = (clone.textContent || '').trim();
      if (looksLikeCSV(plainText) && plainText.length > 20) {
        var responseBlock = aiResponseEl.closest('[data-element-id="response-block"]');
        if (responseBlock) {
          var actionsContainer = responseBlock.querySelector(
            '[data-element-id="additional-actions-of-response-container"]'
          );
          if (actionsContainer && !actionsContainer.querySelector('.' + BTN_CLASS)) {
            var wrapper2 = document.createElement('div');
            wrapper2.style.cssText = 'display:flex;justify-content:flex-end;width:100%;';
            wrapper2.appendChild(createDownloadButton(plainText));
            actionsContainer.appendChild(wrapper2);
            buttonAdded = true;
          }
        }
      }
    }

    if (buttonAdded) {
      updateStatusDot(true);
    } else {
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
    console.log('[CSV Download Extension v5] Initializing...');

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
        console.log('[CSV Download Extension v5] Observing chat area');
      } else {
        setTimeout(startObserving, 2000);
      }
    }

    startObserving();
    setTimeout(scanAllResponses, 1500);
    setInterval(scanAllResponses, 5000);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
