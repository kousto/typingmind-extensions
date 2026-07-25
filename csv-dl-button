(function() {
  'use strict';

  /* ============================================================
   * CSV Download Button Extension for TypingMind
   * Detects CSV content in AI responses (code blocks or plain text)
   * and injects a "Download CSV" button.
   * ============================================================ */

  const EXTENSION_NAME = 'csv-download-ext';
  const PROCESSED_ATTR = 'data-csv-processed';

  /* --- Helper: Check if a string looks like CSV --- */
  function looksLikeCSV(text) {
    const lines = text.trim().split('\n').filter(l => l.trim().length > 0);
    if (lines.length < 2) return false;

    // Check if at least 60% of lines contain a comma or semicolon
    let delimiterCount = 0;
    let commaLines = 0;
    let semicolonLines = 0;

    for (const line of lines) {
      if (line.includes(',')) commaLines++;
      if (line.includes(';')) semicolonLines++;
    }

    const delimiter = commaLines >= semicolonLines ? ',' : ';';
    delimiterCount = delimiter === ',' ? commaLines : semicolonLines;

    const ratio = delimiterCount / lines.length;
    if (ratio < 0.6) return false;

    // Check that multiple lines have a consistent number of delimiters
    const counts = lines.map(line => {
      let count = 0;
      let inQuotes = false;
      for (let i = 0; i < line.length; i++) {
        if (line[i] === '"') inQuotes = !inQuotes;
        if (line[i] === delimiter && !inQuotes) count++;
      }
      return count;
    });

    // At least the first two lines should have the same delimiter count > 0
    if (counts[0] === 0) return false;
    const consistent = counts.slice(0, Math.min(5, counts.length))
      .every(c => c === counts[0]);

    return consistent;
  }

  /* --- Helper: Trigger file download --- */
  function downloadCSV(content, filename) {
    const blob = new Blob([content], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename || 'export.csv';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  /* --- Helper: Generate a filename from the chat context --- */
  function generateFilename(responseBlock) {
    const titleEl = document.querySelector('[data-element-id="current-chat-title"]');
    let base = 'csv-export';
    if (titleEl) {
      const titleText = titleEl.textContent.trim();
      if (titleText) {
        base = titleText
          .toLowerCase()
          .replace(/[^a-z0-9]+/g, '-')
          .replace(/^-+|-+$/g, '')
          .substring(0, 40) || 'csv-export';
      }
    }
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-').substring(0, 19);
    return `${base}-${timestamp}.csv`;
  }

  /* --- Helper: Create the download button --- */
  function createDownloadButton(csvContent, filename, isDark) {
    const btn = document.createElement('button');
    btn.className = [
      'csv-download-btn',
      'inline-flex',
      'items-center',
      'gap-1.5',
      'px-2.5',
      'py-1',
      'rounded-lg',
      'text-xs',
      'font-medium',
      'transition-all',
      isDark
        ? 'bg-emerald-600 hover:bg-emerald-500 text-white'
        : 'bg-emerald-500 hover:bg-emerald-600 text-white'
    ].join(' ');
    btn.style.cursor = 'pointer';
    btn.innerHTML = `
      <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
        <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
        <polyline points="7 10 12 15 17 10"></polyline>
        <line x1="12" y1="15" x2="12" y2="3"></line>
      </svg>
      Download CSV
    `;
    btn.addEventListener('click', function(e) {
      e.preventDefault();
      e.stopPropagation();
      downloadCSV(csvContent, filename);
    });
    return btn;
  }

  /* --- Helper: Check if generation is finished --- */
  function isGenerationFinished() {
    return !document.querySelector('button[data-element-id="stop-generating-button"]');
  }

  /* --- Helper: Detect dark mode --- */
  function isDarkMode() {
    return document.documentElement.classList.contains('dark') ||
           document.querySelector('.dark') !== null;
  }

  /* --- Core: Process a single <pre> code block --- */
  function processCodeBlock(preElement, responseBlock) {
    if (preElement.hasAttribute(PROCESSED_ATTR)) return;
    preElement.setAttribute(PROCESSED_ATTR, 'true');

    const codeElement = preElement.querySelector('code');
    if (!codeElement) return;

    const rawText = codeElement.textContent || '';
    if (!rawText.trim()) return;

    // Check if the language class explicitly says "csv"
    const langClass = Array.from(codeElement.classList).find(c => c.startsWith('language-'));
    const isExplicitCSV = langClass === 'language-csv';

    // Also check the parent <pre> for a data-language attribute (some renderers)
    const preLang = preElement.getAttribute('data-language') || '';
    const isPreLangCSV = preLang.toLowerCase() === 'csv';

    // If not explicitly CSV, check if the content looks like CSV
    const isContentCSV = looksLikeCSV(rawText);

    if (!isExplicitCSV && !isPreLangCSV && !isContentCSV) return;

    const filename = generateFilename(responseBlock);
    const dark = isDarkMode();
    const btn = createDownloadButton(rawText, filename, dark);

    // Try to find an existing code block header bar
    // TypingMind typically renders code blocks with a header containing language + copy button
    let header = preElement.previousElementSibling;
    
    // Check if the previous sibling is a header bar (contains "Copy" button or language label)
    if (header && header.querySelector('button')) {
      // Append our button to the existing header
      header.appendChild(btn);
    } else {
      // No existing header — create our own wrapper
      const wrapper = document.createElement('div');
      wrapper.className = 'flex items-center justify-end gap-2 mb-1 mt-2';
      wrapper.appendChild(btn);
      preElement.parentNode.insertBefore(wrapper, preElement);
    }
  }

  /* --- Core: Process all code blocks in an AI response --- */
  function processAIResponse(aiResponseEl) {
    if (aiResponseEl.hasAttribute(PROCESSED_ATTR)) return;

    // Don't process while the LLM is still generating
    if (!isGenerationFinished()) return;

    const responseBlock = aiResponseEl.closest('[data-element-id="response-block"]');
    if (!responseBlock) return;

    // Process all <pre> blocks inside this response
    const preBlocks = aiResponseEl.querySelectorAll('pre');
    let foundCSV = false;

    preBlocks.forEach(pre => {
      processCodeBlock(pre, responseBlock);
      if (pre.querySelector('.csv-download-btn')) foundCSV = true;
    });

    // Also check for CSV in plain text (no code block)
    // Clone the node and remove thinking-block before reading text
    if (!foundCSV) {
      const clone = aiResponseEl.cloneNode(true);
      const thinkingBlock = clone.querySelector('[data-element-id="thinking-block"]');
      if (thinkingBlock) thinkingBlock.remove();

      // Remove already-processed code blocks from the clone
      clone.querySelectorAll('pre').forEach(p => p.remove());

      const plainText = clone.textContent || '';
      if (looksLikeCSV(plainText) && plainText.trim().length > 20) {
        // Only add a download button in the additional-actions container
        const actionsContainer = responseBlock.querySelector(
          '[data-element-id="additional-actions-of-response-container"]'
        );
        if (actionsContainer && !actionsContainer.querySelector('.csv-download-btn')) {
          const filename = generateFilename(responseBlock);
          const dark = isDarkMode();
          const btn = createDownloadButton(plainText.trim(), filename, dark);
          const wrapper = document.createElement('div');
          wrapper.className = 'flex items-center w-full';
          wrapper.appendChild(btn);
          actionsContainer.appendChild(wrapper);
          foundCSV = true;
        }
      }
    }

    if (foundCSV) {
      aiResponseEl.setAttribute(PROCESSED_ATTR, 'true');
    }
  }

  /* --- Core: Scan all AI responses --- */
  function scanAllResponses() {
    const responses = document.querySelectorAll('[data-element-id="ai-response"]');
    responses.forEach(processAIResponse);
  }

  /* --- MutationObserver: Watch for DOM changes --- */
  let scanTimeout = null;

  function scheduleScan() {
    if (scanTimeout) clearTimeout(scanTimeout);
    scanTimeout = setTimeout(() => {
      scanAllResponses();
      scanTimeout = null;
    }, 500);
  }

  const observer = new MutationObserver(function(mutations) {
    let shouldScan = false;
    for (const mutation of mutations) {
      if (mutation.addedNodes.length > 0 || mutation.type === 'characterData') {
        shouldScan = true;
        break;
      }
    }
    if (shouldScan) scheduleScan();
  });

  /* --- Leader Election (Multi-tab support) --- */
  const channel = new BroadcastChannel('typingmind-extension-leader');
  let isLeader = false;

  function electLeader() {
    // Simple leader election using localStorage
    const leaderId = 'csv-download-' + Date.now() + '-' + Math.random().toString(36).substr(2, 9);
    const stored = localStorage.getItem('tm-csv-leader');

    if (!stored) {
      localStorage.setItem('tm-csv-leader', leaderId);
      isLeader = true;
    } else {
      // Check if leader is stale (older than 10 seconds heartbeat)
      const parts = stored.split('-');
      const timestamp = parseInt(parts[2]);
      if (Date.now() - timestamp > 10000) {
        localStorage.setItem('tm-csv-leader', leaderId);
        isLeader = true;
      } else {
        isLeader = false;
      }
    }

    if (isLeader) {
      // Start heartbeat
      setInterval(() => {
        const newId = 'csv-download-' + Date.now() + '-' + Math.random().toString(36).substr(2, 9);
        localStorage.setItem('tm-csv-leader', newId);
      }, 5000);

      // Start observing
      const chatContainer = document.querySelector('[data-element-id="chat-space-middle-part"]');
      if (chatContainer) {
        observer.observe(chatContainer, {
          childList: true,
          subtree: true,
          characterData: true
        });
      } else {
        // Fallback: observe the whole body
        observer.observe(document.body, {
          childList: true,
          subtree: true,
          characterData: true
        });
      }

      // Initial scan
      scanAllResponses();
    }
  }

  // Listen for leader changes
  channel.onmessage = function(event) {
    if (event.data.type === 'leader-still-alive') {
      isLeader = false;
    }
  };

  /* --- Initialize --- */
  function init() {
    // Wait for the chat container to be available
    function tryInit() {
      const chatContainer = document.querySelector('[data-element-id="chat-space-middle-part"]');
      if (chatContainer) {
        electLeader();
      } else {
        setTimeout(tryInit, 1000);
      }
    }
    tryInit();
  }

  // Start when DOM is ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
