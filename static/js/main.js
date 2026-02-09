/**
 * GitUnderstand - Main utility functions
 *
 * Contains shared utilities: copy, toggle, slider, form submission,
 * and result display helpers.
 */

// ---------------------------------------------------------------------------
// Directory-tree file toggling
// ---------------------------------------------------------------------------

function getFileName(element) {
    const indentSize = 4;
    let path = '';
    let prevIndentLevel = null;

    while (element) {
        const line = element.textContent;
        const index = line.search(/[a-zA-Z0-9_.-]/);
        const indentLevel = index / indentSize;

        // Stop when we reach or go above the top-level directory
        if (indentLevel <= 1) {
            break;
        }

        // Only include directories that are one level above the previous
        if (prevIndentLevel === null || indentLevel === prevIndentLevel - 1) {
            const fileName = line.substring(index).trim();
            path = fileName + path;
            prevIndentLevel = indentLevel;
        }

        element = element.previousElementSibling;
    }

    return path;
}

function toggleFile(element) {
    const patternInput = document.getElementById('pattern');
    const patternFiles = patternInput.value ? patternInput.value.split(',').map((item) => item.trim()) : [];

    const directoryContainer = document.getElementById('directory-structure-container');
    const treeLineElements = Array.from(directoryContainer.children).filter((child) => child.tagName === 'PRE');

    // Skip the first two tree lines (header and repository name)
    if (treeLineElements[0] === element || treeLineElements[1] === element) {
        return;
    }

    element.classList.toggle('line-through');
    element.classList.toggle('text-gray-500');

    const fileName = getFileName(element);
    const fileIndex = patternFiles.indexOf(fileName);

    if (fileIndex !== -1) {
        patternFiles.splice(fileIndex, 1);
    } else {
        patternFiles.push(fileName);
    }

    patternInput.value = patternFiles.join(', ');
}

// ---------------------------------------------------------------------------
// Copy functionality
// ---------------------------------------------------------------------------

function copyText(className) {
    let textToCopy;

    if (className === 'directory-structure') {
        // For directory structure, get the hidden input value
        const hiddenInput = document.getElementById('directory-structure-content');
        if (!hiddenInput) { return; }
        textToCopy = hiddenInput.value;
    } else {
        // For other elements, get the textarea value
        const textarea = document.querySelector(`.${ className }`);
        if (!textarea) { return; }
        textToCopy = textarea.value;
    }

    const button = document.querySelector(`button[onclick="copyText('${className}')"]`);
    if (!button) { return; }

    navigator.clipboard.writeText(textToCopy)
        .then(() => {
            const originalContent = button.innerHTML;
            button.innerHTML = 'Copied!';
            setTimeout(() => {
                button.innerHTML = originalContent;
            }, 1000);
        })
        .catch((err) => {
            console.error('Failed to copy text:', err);
            const originalContent = button.innerHTML;
            button.innerHTML = 'Failed to copy';
            setTimeout(() => {
                button.innerHTML = originalContent;
            }, 1000);
        });
}

// ---------------------------------------------------------------------------
// Result display helpers
// ---------------------------------------------------------------------------

function showLoading() {
    document.getElementById('results-loading').style.display = 'block';
    document.getElementById('results-section').style.display = 'none';
    document.getElementById('results-error').style.display = 'none';

    // Reset progress bar
    const progressBar = document.getElementById('progress-bar-fill');
    const progressText = document.getElementById('progress-stage-text');
    const progressDetail = document.getElementById('progress-detail-text');
    if (progressBar) { progressBar.style.width = '0%'; }
    if (progressText) { progressText.textContent = 'Preparing...'; }
    if (progressDetail) { progressDetail.textContent = 'Initializing...'; }
}

function showResults() {
    document.getElementById('results-loading').style.display = 'none';
    document.getElementById('results-section').style.display = 'block';
    document.getElementById('results-error').style.display = 'none';
}

function showError(msg) {
    document.getElementById('results-loading').style.display = 'none';
    document.getElementById('results-section').style.display = 'none';
    const errorDiv = document.getElementById('results-error');
    errorDiv.innerHTML = msg;
    errorDiv.style.display = 'block';
}

// ---------------------------------------------------------------------------
// Form data collection
// ---------------------------------------------------------------------------

function collectFormData(form) {
    const json_data = {};
    const inputText = form.querySelector('[name="input_text"]');
    const token = form.querySelector('[name="token"]');
    const hiddenInput = document.getElementById('max_file_size_kb');
    const patternType = document.getElementById('pattern_type');
    const pattern = document.getElementById('pattern');

    const outputFormat = document.getElementById('output_format');

    if (inputText) { json_data.input_text = inputText.value; }
    if (token) { json_data.token = token.value; }
    if (hiddenInput) { json_data.max_file_size = hiddenInput.value; }
    if (patternType) { json_data.pattern_type = patternType.value; }
    if (pattern) { json_data.pattern = pattern.value; }
    if (outputFormat) { json_data.output_format = outputFormat.value; }

    const targetModel = document.getElementById('target_model');
    if (targetModel && targetModel.value) { json_data.target_model = targetModel.value; }

    return json_data;
}

// ---------------------------------------------------------------------------
// Button loading state
// ---------------------------------------------------------------------------

function setButtonLoadingState(submitButton, isLoading) {
    if (!isLoading) {
        submitButton.disabled = false;
        submitButton.innerHTML = submitButton.getAttribute('data-original-content') || 'Submit';
        submitButton.classList.remove('bg-[#ffb14d]');
        return;
    }

    if (!submitButton.getAttribute('data-original-content')) {
        submitButton.setAttribute('data-original-content', submitButton.innerHTML);
    }

    submitButton.disabled = true;
    submitButton.innerHTML = `
        <div class="flex items-center justify-center">
            <svg class="animate-spin h-5 w-5 text-gray-900" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
                <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
            </svg>
            <span class="ml-2">Processing...</span>
        </div>
    `;
    submitButton.classList.add('bg-[#ffb14d]');
}

// ---------------------------------------------------------------------------
// Successful response handler
// ---------------------------------------------------------------------------

function formatTokenCount(count) {
    if (count >= 1000000) {
        return `${(count / 1000000).toFixed(1)}M`;
    }
    if (count >= 1000) {
        return `${(count / 1000).toFixed(1)}k`;
    }
    return String(count);
}

function renderTokenCounts(tokenCounts) {
    const widget = document.getElementById('token-counts-widget');
    const grid = document.getElementById('token-counts-grid');
    if (!widget || !grid || !tokenCounts || Object.keys(tokenCounts).length === 0) {
        if (widget) { widget.classList.add('hidden'); }
        return;
    }

    grid.innerHTML = '';
    for (const [model, count] of Object.entries(tokenCounts)) {
        const label = document.createElement('span');
        label.className = 'text-gray-600';
        label.textContent = model;

        const value = document.createElement('span');
        value.className = 'font-bold text-gray-900 text-right';
        value.textContent = formatTokenCount(count);

        grid.appendChild(label);
        grid.appendChild(value);
    }

    widget.classList.remove('hidden');
}

function handleSuccessfulResponse(data) {
    showResults();

    // Store the digest_url for download functionality
    window.currentDigestUrl = data.digest_url;

    // Set plain text content for summary, tree, and content
    document.getElementById('result-summary').value = data.summary || '';
    document.getElementById('directory-structure-content').value = data.tree || '';
    document.getElementById('result-content').value = data.content || '';

    // Render token counts widget
    renderTokenCounts(data.token_counts);

    // Handle smart chunking
    if (data.chunks && data.chunks.length > 1) {
        renderChunkNavigation(data.chunks, data.target_model);
    } else {
        hideChunkNavigation();
    }

    // Render interactive tree if JSON tree data is available
    if (data.tree_structure) {
        renderInteractiveTree(data.tree_structure);
    } else {
        // Fallback: populate directory structure lines as clickable <pre> elements
        const dirPre = document.getElementById('directory-structure-pre');
        const interactiveTree = document.getElementById('interactive-tree');
        const toolbar = document.getElementById('tree-toolbar');

        if (interactiveTree) { interactiveTree.classList.add('hidden'); }
        if (toolbar) { toolbar.classList.add('hidden'); }
        if (dirPre) { dirPre.classList.remove('hidden'); }

        if (dirPre && data.tree) {
            dirPre.innerHTML = '';
            data.tree.split('\n').forEach((line) => {
                const pre = document.createElement('pre');
                pre.setAttribute('name', 'tree-line');
                pre.className = 'cursor-pointer hover:line-through hover:text-gray-500';
                pre.textContent = line;
                pre.onclick = function () { toggleFile(this); };
                dirPre.appendChild(pre);
            });
        }
    }

    // Show view toggle for text output format (other formats have different separators)
    const viewToggle = document.getElementById('view-toggle');
    if (viewToggle) {
        const fmt = (data.output_format || 'text').toLowerCase();
        viewToggle.classList.toggle('hidden', fmt !== 'text');
    }

    // Reset highlighted content view
    const highlighted = document.getElementById('highlighted-content');
    if (highlighted) {
        highlighted.innerHTML = '';
        delete highlighted.dataset.rendered;
        highlighted.classList.add('hidden');
    }
    const plainWrapper = document.getElementById('plain-content-wrapper');
    if (plainWrapper) { plainWrapper.classList.remove('hidden'); }

    // Reset view toggle buttons
    const btnPlain = document.getElementById('btn-plain-view');
    const btnHighlight = document.getElementById('btn-highlight-view');
    if (btnPlain) { btnPlain.className = btnPlain.className.replace('bg-[#E8F0FE]', 'bg-[#ffc480]'); }
    if (btnHighlight) { btnHighlight.className = btnHighlight.className.replace('bg-[#ffc480]', 'bg-[#E8F0FE]'); }

    // Extract digest ID from digest_url for AI summaries
    window.currentDigestId = data.digest_url ? data.digest_url.split('/').pop() : null;

    // Check AI summary availability
    checkAISummaryAvailable();

    // Scroll to results
    document.getElementById('results-section').scrollIntoView({ behavior: 'smooth', block: 'start' });
}

// ---------------------------------------------------------------------------
// Smart Chunking UI
// ---------------------------------------------------------------------------

// Store current chunks data globally for copy/navigation
window.currentChunks = null;
window.currentChunkIndex = 0;

function renderChunkNavigation(chunks, targetModel) {
    window.currentChunks = chunks;
    window.currentChunkIndex = 0;

    const nav = document.getElementById('chunk-navigation');
    const tabs = document.getElementById('chunk-tabs');
    const info = document.getElementById('chunk-info');
    const model = document.getElementById('chunk-model');
    const copyChunkBtn = document.getElementById('copy-chunk-btn');

    if (!nav || !tabs) { return; }

    nav.style.display = 'block';
    if (copyChunkBtn) { copyChunkBtn.style.display = 'block'; }

    if (model) { model.textContent = targetModel ? ('Chunked for ' + targetModel) : ''; }

    // Build tab buttons
    tabs.innerHTML = '';
    chunks.forEach((chunk, idx) => {
        const btn = document.createElement('button');
        btn.className = idx === 0
            ? 'px-3 py-1 text-sm font-mono border-[3px] border-gray-900 rounded bg-[#ffc480] font-bold'
            : 'px-3 py-1 text-sm font-mono border-[3px] border-gray-900 rounded bg-[#E8F0FE] hover:bg-[#ffc480] transition-colors';
        btn.textContent = 'Chunk ' + (idx + 1) + ' (' + formatTokenCount(chunk.token_count) + ')';
        btn.setAttribute('data-chunk-index', String(idx));
        btn.onclick = function () { selectChunk(chunks, idx); };
        tabs.appendChild(btn);
    });

    // Show first chunk
    selectChunk(chunks, 0);
}

function selectChunk(chunks, index) {
    if (index < 0 || index >= chunks.length) { return; }

    window.currentChunkIndex = index;
    const chunk = chunks[index];

    // Update content textarea
    document.getElementById('result-content').value = chunk.content || '';

    // Reset highlighted view so it re-renders for this chunk
    const highlighted = document.getElementById('highlighted-content');
    if (highlighted && highlighted.dataset.rendered) {
        delete highlighted.dataset.rendered;
        // If currently viewing highlighted, re-render immediately
        if (!highlighted.classList.contains('hidden')) {
            renderHighlightedContent(chunk.content);
        }
    }

    // Update info line
    const info = document.getElementById('chunk-info');
    if (info) {
        info.textContent = 'Chunk ' + (index + 1) + '/' + chunk.total_chunks
            + ' \u00B7 ' + chunk.files.length + ' files \u00B7 '
            + formatTokenCount(chunk.token_count) + ' tokens';
    }

    // Update active tab styling
    const tabs = document.getElementById('chunk-tabs');
    if (tabs) {
        Array.from(tabs.children).forEach((btn, idx) => {
            if (idx === index) {
                btn.className = 'px-3 py-1 text-sm font-mono border-[3px] border-gray-900 rounded bg-[#ffc480] font-bold';
            } else {
                btn.className = 'px-3 py-1 text-sm font-mono border-[3px] border-gray-900 rounded bg-[#E8F0FE] hover:bg-[#ffc480] transition-colors';
            }
        });
    }
}

function hideChunkNavigation() {
    window.currentChunks = null;
    window.currentChunkIndex = 0;

    const nav = document.getElementById('chunk-navigation');
    const copyChunkBtn = document.getElementById('copy-chunk-btn');
    if (nav) { nav.style.display = 'none'; }
    if (copyChunkBtn) { copyChunkBtn.style.display = 'none'; }
}

function copyCurrentChunk() {
    if (!window.currentChunks || window.currentChunks.length === 0) { return; }

    const chunk = window.currentChunks[window.currentChunkIndex];
    if (!chunk) { return; }

    const button = document.querySelector('[onclick="copyCurrentChunk()"]');
    if (!button) { return; }

    const originalContent = button.innerHTML;

    navigator.clipboard.writeText(chunk.content)
        .then(() => {
            button.innerHTML = 'Copied!';
            setTimeout(() => { button.innerHTML = originalContent; }, 1000);
        })
        .catch((err) => {
            console.error('Failed to copy chunk:', err);
            button.innerHTML = 'Failed';
            setTimeout(() => { button.innerHTML = originalContent; }, 1000);
        });
}

// ---------------------------------------------------------------------------
// Interactive Tree (8A)
// ---------------------------------------------------------------------------

const EXT_COLORS = {
    '.py': '#3572A5', '.js': '#f1e05a', '.ts': '#3178c6', '.tsx': '#3178c6',
    '.jsx': '#f1e05a', '.go': '#00ADD8', '.rs': '#dea584', '.java': '#b07219',
    '.cpp': '#f34b7d', '.c': '#555555', '.h': '#555555', '.cs': '#178600',
    '.swift': '#F05138', '.kt': '#A97BFF', '.rb': '#701516', '.php': '#4F5D95',
    '.html': '#e34c26', '.css': '#663399', '.scss': '#c6538c', '.json': '#292929',
    '.yml': '#cb171e', '.yaml': '#cb171e', '.md': '#083fa1', '.sql': '#e38c00',
    '.sh': '#89e051', '.bash': '#89e051', '.dockerfile': '#384d54',
    '.toml': '#9c4221', '.xml': '#0060ac', '.vue': '#41b883', '.svelte': '#ff3e00',
};

function getFileExtColor(name) {
    const idx = name.lastIndexOf('.');
    if (idx === -1) { return '#6b7280'; }
    return EXT_COLORS[name.substring(idx).toLowerCase()] || '#6b7280';
}

function formatFileSize(bytes) {
    if (bytes == null || bytes === 0) { return ''; }
    if (bytes >= 1048576) { return (bytes / 1048576).toFixed(1) + ' MB'; }
    if (bytes >= 1024) { return (bytes / 1024).toFixed(1) + ' kB'; }
    return bytes + ' B';
}

function renderInteractiveTree(treeData) {
    const container = document.getElementById('interactive-tree');
    const plainPre = document.getElementById('directory-structure-pre');
    const toolbar = document.getElementById('tree-toolbar');
    if (!container) { return; }

    container.innerHTML = '';
    container.classList.remove('hidden');
    if (plainPre) { plainPre.classList.add('hidden'); }
    if (toolbar) { toolbar.classList.remove('hidden'); }

    const rootEl = _buildTreeNode(treeData, true);
    container.appendChild(rootEl);
}

function _buildTreeNode(node, isRoot) {
    const wrapper = document.createElement('div');
    wrapper.className = 'tree-node';
    wrapper.dataset.path = node.path || '';
    wrapper.dataset.name = (node.name || '').toLowerCase();

    const isDir = node.type === 'directory';
    const row = document.createElement('div');
    row.className = 'flex items-center gap-1 py-[1px] tree-node-label';

    if (isDir) {
        // Toggle arrow
        const arrow = document.createElement('span');
        arrow.className = 'tree-toggle expanded';
        arrow.textContent = '\u25B6';
        arrow.onclick = function (e) {
            e.stopPropagation();
            _toggleTreeDir(wrapper);
        };
        row.appendChild(arrow);

        // Folder icon
        const icon = document.createElement('span');
        icon.textContent = '\uD83D\uDCC1';
        icon.className = 'text-sm';
        row.appendChild(icon);

        // Name
        const nameSpan = document.createElement('span');
        nameSpan.textContent = node.name + '/';
        nameSpan.className = 'font-bold text-gray-800';
        row.appendChild(nameSpan);

        // File count
        if (node.children && node.children.length > 0) {
            const count = document.createElement('span');
            count.className = 'text-xs text-gray-400 ml-1';
            count.textContent = '(' + _countFiles(node) + ')';
            row.appendChild(count);
        }
    } else {
        // Spacer for alignment (matches toggle width)
        const spacer = document.createElement('span');
        spacer.className = 'inline-block w-4';
        row.appendChild(spacer);

        // Colored dot
        const dot = document.createElement('span');
        dot.className = 'inline-block w-2 h-2 rounded-full mr-1 flex-shrink-0';
        dot.style.backgroundColor = getFileExtColor(node.name || '');
        row.appendChild(dot);

        // Name
        const nameSpan = document.createElement('span');
        nameSpan.textContent = node.name;
        nameSpan.className = 'text-gray-700';
        row.appendChild(nameSpan);

        // Size
        const sizeStr = formatFileSize(node.size);
        if (sizeStr) {
            const size = document.createElement('span');
            size.className = 'text-xs text-gray-400 ml-auto pl-2 tabular-nums';
            size.textContent = sizeStr;
            row.appendChild(size);
        }
    }

    wrapper.appendChild(row);

    // Children
    if (isDir && node.children && node.children.length > 0) {
        const childContainer = document.createElement('div');
        childContainer.className = 'tree-children';
        node.children.forEach((child) => {
            childContainer.appendChild(_buildTreeNode(child, false));
        });
        wrapper.appendChild(childContainer);
    }

    return wrapper;
}

function _countFiles(node) {
    if (node.type !== 'directory') { return 1; }
    if (!node.children) { return 0; }
    return node.children.reduce((sum, c) => sum + _countFiles(c), 0);
}

function _toggleTreeDir(nodeEl) {
    const arrow = nodeEl.querySelector(':scope > .tree-node-label > .tree-toggle');
    const children = nodeEl.querySelector(':scope > .tree-children');
    if (!arrow || !children) { return; }

    const isExpanded = arrow.classList.contains('expanded');
    arrow.classList.toggle('expanded', !isExpanded);
    children.classList.toggle('collapsed', isExpanded);
}

function expandAllTree() {
    document.querySelectorAll('#interactive-tree .tree-toggle').forEach((arrow) => {
        arrow.classList.add('expanded');
    });
    document.querySelectorAll('#interactive-tree .tree-children').forEach((c) => {
        c.classList.remove('collapsed');
    });
}

function collapseAllTree() {
    document.querySelectorAll('#interactive-tree .tree-toggle').forEach((arrow) => {
        arrow.classList.remove('expanded');
    });
    document.querySelectorAll('#interactive-tree .tree-children').forEach((c) => {
        c.classList.add('collapsed');
    });
}

function filterTree(query) {
    const q = (query || '').toLowerCase().trim();
    const container = document.getElementById('interactive-tree');
    if (!container) { return; }

    const allNodes = container.querySelectorAll('.tree-node');

    if (!q) {
        // Show everything
        allNodes.forEach((n) => { n.style.display = ''; });
        return;
    }

    // First hide all, then show matches + their ancestors
    allNodes.forEach((n) => { n.style.display = 'none'; });

    allNodes.forEach((n) => {
        const name = n.dataset.name || '';
        const path = (n.dataset.path || '').toLowerCase();
        if (name.includes(q) || path.includes(q)) {
            // Show this node and all ancestors
            let el = n;
            while (el) {
                el.style.display = '';
                // Expand parent dirs
                const arrow = el.querySelector(':scope > .tree-node-label > .tree-toggle');
                const children = el.querySelector(':scope > .tree-children');
                if (arrow) { arrow.classList.add('expanded'); }
                if (children) { children.classList.remove('collapsed'); }

                el = el.parentElement?.closest('.tree-node') || null;
            }
        }
    });
}

// ---------------------------------------------------------------------------
// Syntax Highlighting (8B)
// ---------------------------------------------------------------------------

const EXT_TO_PRISM = {
    '.py': 'python', '.js': 'javascript', '.ts': 'typescript', '.tsx': 'tsx',
    '.jsx': 'jsx', '.go': 'go', '.rs': 'rust', '.java': 'java',
    '.cpp': 'cpp', '.c': 'c', '.h': 'c', '.cs': 'csharp',
    '.swift': 'swift', '.kt': 'kotlin', '.rb': 'ruby', '.php': 'php',
    '.html': 'html', '.css': 'css', '.scss': 'scss', '.json': 'json',
    '.yml': 'yaml', '.yaml': 'yaml', '.md': 'markdown', '.sql': 'sql',
    '.sh': 'bash', '.bash': 'bash', '.dockerfile': 'docker',
    '.toml': 'toml', '.xml': 'xml', '.vue': 'markup', '.svelte': 'javascript',
    '.r': 'r', '.lua': 'lua', '.dart': 'dart', '.pl': 'perl',
    '.ex': 'elixir', '.exs': 'elixir', '.hs': 'haskell', '.clj': 'clojure',
    '.scala': 'scala', '.erl': 'erlang', '.ini': 'ini', '.cfg': 'ini',
    '.makefile': 'makefile', '.mk': 'makefile',
};

const SEPARATOR = '================================================';

function detectPrismLanguage(filePath) {
    if (!filePath) { return 'plain'; }
    const name = filePath.split('/').pop() || '';

    // Special filenames
    const lower = name.toLowerCase();
    if (lower === 'dockerfile') { return 'docker'; }
    if (lower === 'makefile' || lower === 'gnumakefile') { return 'makefile'; }
    if (lower.endsWith('.env') || lower.startsWith('.env')) { return 'bash'; }

    const idx = name.lastIndexOf('.');
    if (idx === -1) { return 'plain'; }
    return EXT_TO_PRISM[name.substring(idx).toLowerCase()] || 'plain';
}

function parseContentBlocks(content) {
    if (!content) { return []; }

    const blocks = [];
    // Split on separator lines. Each file block is:
    // SEPARATOR\nFILE: path\nSEPARATOR\ncontent
    const parts = content.split(SEPARATOR);

    for (let i = 0; i < parts.length; i++) {
        const part = parts[i];
        if (!part.trim()) { continue; }

        const lines = part.split('\n');
        let filePath = null;
        let contentStart = 0;

        for (let j = 0; j < lines.length; j++) {
            const line = lines[j].trim();
            if (line.startsWith('FILE:') || line.startsWith('DIRECTORY:') || line.startsWith('SYMLINK:')) {
                filePath = line.split(':').slice(1).join(':').trim();
                // Content starts after the next separator (which is consumed by the split)
                contentStart = j + 1;
                break;
            }
        }

        if (filePath) {
            const fileContent = lines.slice(contentStart).join('\n').trim();
            if (fileContent) {
                blocks.push({ path: filePath, content: fileContent });
            }
        }
    }

    return blocks;
}

function renderHighlightedContent(content) {
    const container = document.getElementById('highlighted-content');
    if (!container) { return; }

    container.innerHTML = '';

    const blocks = parseContentBlocks(content);
    if (blocks.length === 0) {
        container.innerHTML = '<p class="text-gray-500 p-4">No file blocks found to highlight.</p>';
        return;
    }

    blocks.forEach((block, idx) => {
        const lang = detectPrismLanguage(block.path);
        const blockEl = document.createElement('div');
        blockEl.className = 'highlighted-file-block';

        // Header
        const header = document.createElement('div');
        header.className = 'highlighted-file-header';

        const pathSpan = document.createElement('span');
        pathSpan.textContent = block.path;
        header.appendChild(pathSpan);

        const copyBtn = document.createElement('button');
        copyBtn.className = 'text-xs px-2 py-0.5 rounded bg-gray-700 hover:bg-gray-600 text-gray-200 transition-colors';
        copyBtn.textContent = 'Copy';
        copyBtn.onclick = function () { copySingleFile(copyBtn, idx); };
        header.appendChild(copyBtn);

        blockEl.appendChild(header);

        // Body
        const body = document.createElement('div');
        body.className = 'highlighted-file-body';

        const lineCount = block.content.split('\n').length;
        if (lineCount > 5000) {
            // Skip highlighting for very large files
            const pre = document.createElement('pre');
            pre.className = 'text-sm font-mono whitespace-pre-wrap';
            pre.textContent = block.content;
            const note = document.createElement('p');
            note.className = 'text-xs text-gray-400 mb-2';
            note.textContent = `(${lineCount.toLocaleString()} lines \u2014 syntax highlighting skipped for performance)`;
            body.appendChild(note);
            body.appendChild(pre);
        } else {
            const pre = document.createElement('pre');
            pre.className = `language-${lang}`;
            const code = document.createElement('code');
            code.className = `language-${lang}`;
            code.textContent = block.content;
            pre.appendChild(code);
            body.appendChild(pre);
        }

        blockEl.appendChild(body);
        container.appendChild(blockEl);
    });

    // Store blocks for copy
    container._parsedBlocks = blocks;

    // Trigger Prism highlighting
    if (typeof Prism !== 'undefined' && Prism.highlightAllUnder) {
        Prism.highlightAllUnder(container);
    }

    container.dataset.rendered = 'true';
}

window._highlightedBlocks = [];

function copySingleFile(button, index) {
    const container = document.getElementById('highlighted-content');
    if (!container || !container._parsedBlocks) { return; }

    const block = container._parsedBlocks[index];
    if (!block) { return; }

    const original = button.textContent;
    navigator.clipboard.writeText(block.content)
        .then(() => {
            button.textContent = 'Copied!';
            setTimeout(() => { button.textContent = original; }, 1000);
        })
        .catch(() => {
            button.textContent = 'Failed';
            setTimeout(() => { button.textContent = original; }, 1000);
        });
}

function setContentView(mode) {
    const plainWrapper = document.getElementById('plain-content-wrapper');
    const highlighted = document.getElementById('highlighted-content');
    const btnPlain = document.getElementById('btn-plain-view');
    const btnHighlight = document.getElementById('btn-highlight-view');

    if (!plainWrapper || !highlighted) { return; }

    if (mode === 'highlighted') {
        plainWrapper.classList.add('hidden');
        highlighted.classList.remove('hidden');
        if (btnPlain) { btnPlain.className = btnPlain.className.replace('bg-[#ffc480]', 'bg-[#E8F0FE]'); }
        if (btnHighlight) { btnHighlight.className = btnHighlight.className.replace('bg-[#E8F0FE]', 'bg-[#ffc480]'); }

        // Lazy render
        if (!highlighted.dataset.rendered) {
            const content = document.getElementById('result-content').value;
            renderHighlightedContent(content);
        }
    } else {
        plainWrapper.classList.remove('hidden');
        highlighted.classList.add('hidden');
        if (btnPlain) { btnPlain.className = btnPlain.className.replace('bg-[#E8F0FE]', 'bg-[#ffc480]'); }
        if (btnHighlight) { btnHighlight.className = btnHighlight.className.replace('bg-[#ffc480]', 'bg-[#E8F0FE]'); }
    }
}

// ---------------------------------------------------------------------------
// AI Summary & Chat (Phase 7)
// ---------------------------------------------------------------------------

window.currentDigestId = null;
window._aiAvailable = false;
window._chatHistory = [];
window._chatBusy = false;

const AI_TYPE_LABELS = {
    architecture: 'Architecture Overview',
    code_review: 'Code Review',
    onboarding: 'Onboarding Guide',
    security: 'Security Audit',
};

function checkAISummaryAvailable(attempt) {
    if (attempt === undefined) { attempt = 0; }
    var maxAttempts = 3;
    var section = document.getElementById('ai-analysis-section');
    if (!section) { return; }

    // Always show the AI section after ingest
    section.classList.remove('hidden');

    fetch('/api/summary/available')
        .then(function (r) { return r.json(); })
        .then(function (data) {
            window._aiAvailable = !!data.available;
            var notice = document.getElementById('ai-not-configured');
            if (notice) {
                notice.classList.toggle('hidden', window._aiAvailable);
            }
            // Disable buttons if not available
            _toggleAIButtons(!window._aiAvailable);

            // Update quota display
            if (data.quota) { _updateQuotaDisplay(data.quota); }

            // Setup floating AI button
            _setupAIFloatButton();

            // Restore chat history from sessionStorage
            if (window._aiAvailable) {
                _restoreChatHistory();
            }

            // Retry if not available and attempts remain (handles Cloud Run cold starts)
            if (!window._aiAvailable && attempt < maxAttempts) {
                setTimeout(function () {
                    checkAISummaryAvailable(attempt + 1);
                }, 2000 * (attempt + 1));
            }
        })
        .catch(function () {
            window._aiAvailable = false;
            var notice = document.getElementById('ai-not-configured');
            if (notice) { notice.classList.remove('hidden'); }
            _toggleAIButtons(true);

            // Retry on network error
            if (attempt < maxAttempts) {
                setTimeout(function () {
                    checkAISummaryAvailable(attempt + 1);
                }, 2000 * (attempt + 1));
            }
        });
}

function _updateQuotaDisplay(quota) {
    var el = document.getElementById('ai-quota-display');
    if (!el) { return; }
    var remaining = quota.remaining;
    var limit = quota.limit;
    var color = remaining > 2 ? 'text-green-600' : remaining > 0 ? 'text-amber-600' : 'text-red-600';
    el.innerHTML = '<span class="' + color + ' font-medium">' + remaining + '/' + limit + '</span> AI requests remaining';
    el.classList.remove('hidden');
}

function _toggleAIButtons(disabled) {
    document.querySelectorAll('.ai-type-btn').forEach((btn) => {
        btn.disabled = disabled;
        if (disabled) {
            btn.classList.add('opacity-50', 'cursor-not-allowed');
        } else {
            btn.classList.remove('opacity-50', 'cursor-not-allowed');
        }
    });
    const chatInput = document.getElementById('chat-input');
    const chatSend = document.getElementById('chat-send-btn');
    if (chatInput) { chatInput.disabled = disabled; }
    if (chatSend) {
        chatSend.disabled = disabled;
        if (disabled) {
            chatSend.classList.add('opacity-50', 'cursor-not-allowed');
        } else {
            chatSend.classList.remove('opacity-50', 'cursor-not-allowed');
        }
    }
}

// ---------------------------------------------------------------------------
// Tab switching between Summaries and Chat
// ---------------------------------------------------------------------------

function switchAITab(tab) {
    const summariesPanel = document.getElementById('ai-summaries-panel');
    const chatPanel = document.getElementById('ai-chat-panel');
    const tabSummaries = document.getElementById('ai-tab-summaries');
    const tabChat = document.getElementById('ai-tab-chat');

    if (tab === 'chat') {
        if (summariesPanel) { summariesPanel.classList.add('hidden'); }
        if (chatPanel) { chatPanel.classList.remove('hidden'); }
        if (tabSummaries) { tabSummaries.className = tabSummaries.className.replace('bg-[#ffc480]', 'bg-[#E8F0FE]'); }
        if (tabChat) { tabChat.className = tabChat.className.replace('bg-[#E8F0FE]', 'bg-[#ffc480]'); }
        // Focus chat input
        const input = document.getElementById('chat-input');
        if (input) { setTimeout(() => input.focus(), 100); }
    } else {
        if (summariesPanel) { summariesPanel.classList.remove('hidden'); }
        if (chatPanel) { chatPanel.classList.add('hidden'); }
        if (tabSummaries) { tabSummaries.className = tabSummaries.className.replace('bg-[#E8F0FE]', 'bg-[#ffc480]'); }
        if (tabChat) { tabChat.className = tabChat.className.replace('bg-[#ffc480]', 'bg-[#E8F0FE]'); }
    }
}

// ---------------------------------------------------------------------------
// Summary generation (existing, refined)
// ---------------------------------------------------------------------------

function generateAISummary(summaryType) {
    if (!window._aiAvailable) {
        showAIError('AI features are not configured. Set CLAUDE_API_KEY to enable.');
        return;
    }
    if (!window.currentDigestId) {
        showAIError('No digest available. Please ingest a repository first.');
        return;
    }

    const loading = document.getElementById('ai-loading');
    const result = document.getElementById('ai-result');
    const error = document.getElementById('ai-error');
    const loadingText = document.getElementById('ai-loading-text');

    // Reset state
    if (result) { result.classList.add('hidden'); }
    if (error) { error.classList.add('hidden'); }
    if (loading) {
        loading.classList.remove('hidden');
        if (loadingText) {
            loadingText.textContent = 'Generating ' + (AI_TYPE_LABELS[summaryType] || summaryType).toLowerCase() + '...';
        }
    }

    // Highlight active button
    document.querySelectorAll('.ai-type-btn').forEach((btn) => {
        if (btn.dataset.aiType === summaryType) {
            btn.classList.remove('bg-[#E8F0FE]');
            btn.classList.add('bg-[#ffc480]');
        } else {
            btn.classList.remove('bg-[#ffc480]');
            btn.classList.add('bg-[#E8F0FE]');
        }
    });

    // SSE stream for summary generation
    _readSSEStream('/api/summary/stream', {
        digest_id: window.currentDigestId,
        summary_type: summaryType,
    }, handleAISummaryEvent, (err) => showAIError('Network error: ' + err.message));
}

function handleAISummaryEvent(event) {
    const { type, payload } = event;
    const loading = document.getElementById('ai-loading');
    const loadingText = document.getElementById('ai-loading-text');

    switch (type) {
        case 'generating':
            if (loadingText) {
                loadingText.textContent = payload.message || 'Generating...';
            }
            break;

        case 'complete': {
            if (loading) { loading.classList.add('hidden'); }

            const result = document.getElementById('ai-result');
            const resultType = document.getElementById('ai-result-type');
            const resultContent = document.getElementById('ai-result-content');
            const cachedBadge = document.getElementById('ai-cached-badge');

            if (result) { result.classList.remove('hidden'); }
            if (resultType) {
                resultType.textContent = AI_TYPE_LABELS[payload.summary_type] || payload.summary_type;
            }
            if (resultContent) {
                renderMarkdownContent(payload.content, resultContent);
            }
            if (cachedBadge) {
                cachedBadge.classList.toggle('hidden', !payload.cached);
            }

            // Update quota display if returned
            if (payload.quota) { _updateQuotaDisplay(payload.quota); }

            // Store for copy
            window._lastAISummary = payload.content || '';
            break;
        }

        case 'error':
            if (loading) { loading.classList.add('hidden'); }
            showAIError(payload.message || 'An error occurred during AI analysis.');
            break;

        default:
            console.warn('Unknown AI SSE event type:', type);
    }
}

function showAIError(message) {
    const loading = document.getElementById('ai-loading');
    const error = document.getElementById('ai-error');
    const errorContent = document.getElementById('ai-error-content');

    if (loading) { loading.classList.add('hidden'); }
    if (error) { error.classList.remove('hidden'); }
    if (errorContent) { errorContent.textContent = message; }
}

function copyAISummary() {
    const text = window._lastAISummary || '';
    if (!text) { return; }

    const button = document.querySelector('[onclick="copyAISummary()"]');
    if (!button) { return; }

    const original = button.textContent;
    navigator.clipboard.writeText(text)
        .then(() => {
            button.textContent = 'Copied!';
            setTimeout(() => { button.textContent = original; }, 1000);
        })
        .catch(() => {
            button.textContent = 'Failed';
            setTimeout(() => { button.textContent = original; }, 1000);
        });
}

// ---------------------------------------------------------------------------
// Chat functionality
// ---------------------------------------------------------------------------

function sendChatMessage() {
    const input = document.getElementById('chat-input');
    if (!input) { return; }

    const message = input.value.trim();
    if (!message) { return; }
    if (window._chatBusy) { return; }

    if (!window._aiAvailable) {
        _appendChatError('AI features are not configured. Set CLAUDE_API_KEY to enable.');
        return;
    }
    if (!window.currentDigestId) {
        _appendChatError('No digest available. Please ingest a repository first.');
        return;
    }

    // Clear input and reset textarea height
    input.value = '';
    input.style.height = 'auto';

    // Hide suggestions after first message
    const suggestions = document.getElementById('chat-suggestions');
    if (suggestions) { suggestions.classList.add('hidden'); }

    // Add user message to UI
    _appendChatMessage('user', message);

    // Add to history and persist
    window._chatHistory.push({ role: 'user', content: message });
    _saveChatHistory();

    // Show thinking indicator
    const thinkingId = _appendChatThinking();

    // Mark busy
    window._chatBusy = true;
    _setChatInputState(true);

    // Send to API
    _readSSEStream('/api/chat/stream', {
        digest_id: window.currentDigestId,
        message: message,
        history: window._chatHistory.slice(0, -1), // Send all except the latest (which is the current message)
    }, (event) => {
        _handleChatEvent(event, thinkingId);
    }, (err) => {
        _removeChatThinking(thinkingId);
        _appendChatError('Network error: ' + err.message);
        window._chatBusy = false;
        _setChatInputState(false);
    });
}

function askQuickQuestion(question) {
    const input = document.getElementById('chat-input');
    if (input) { input.value = question; }
    // Switch to chat tab first
    switchAITab('chat');
    sendChatMessage();
}

function clearChat() {
    window._chatHistory = [];
    _saveChatHistory();
    const container = document.getElementById('chat-messages');
    if (!container) { return; }

    // Reset to welcome message with new avatar style
    container.innerHTML = '';
    const welcome = document.createElement('div');
    welcome.className = 'chat-msg-assistant flex gap-3 animate-fade-in';
    welcome.innerHTML = '<div class="w-8 h-8 rounded-lg bg-[#ffc480] border-[2px] border-gray-900 flex items-center justify-center flex-shrink-0">'
        + '<svg class="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">'
        + '<path stroke-linecap="round" stroke-linejoin="round" d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09z"/>'
        + '</svg></div>'
        + '<div class="bg-[#fff4da] border-[2px] border-gray-900 rounded-lg p-3 max-w-[80%]">'
        + '<p class="text-sm text-gray-800 font-medium">Hello! I have full context of this repository.</p>'
        + '<p class="text-sm text-gray-600 mt-1">Ask me about architecture, code patterns, bugs, or anything else.</p>'
        + '</div>';
    container.appendChild(welcome);

    // Show suggestions again
    const suggestions = document.getElementById('chat-suggestions');
    if (suggestions) { suggestions.classList.remove('hidden'); }
}

function _handleChatEvent(event, thinkingId) {
    const { type, payload } = event;

    switch (type) {
        case 'thinking':
            // Already showing thinking indicator
            break;

        case 'complete': {
            _removeChatThinking(thinkingId);
            const content = payload.content || '';
            _appendChatMessage('assistant', content);

            // Add to history and persist
            window._chatHistory.push({ role: 'assistant', content: content });
            _saveChatHistory();

            // Update quota display
            if (payload.quota) { _updateQuotaDisplay(payload.quota); }

            window._chatBusy = false;
            _setChatInputState(false);

            // Focus input for next message
            const input = document.getElementById('chat-input');
            if (input) { input.focus(); }
            break;
        }

        case 'error':
            _removeChatThinking(thinkingId);
            _appendChatError(payload.message || 'An error occurred.');
            window._chatBusy = false;
            _setChatInputState(false);
            break;

        default:
            console.warn('Unknown chat SSE event type:', type);
    }
}

function _appendChatMessage(role, content) {
    const container = document.getElementById('chat-messages');
    if (!container) { return; }

    const wrapper = document.createElement('div');
    wrapper.className = 'animate-fade-in';
    const timeStr = _formatTimeAgo(new Date());

    if (role === 'user') {
        wrapper.className += ' chat-msg-user flex gap-3 justify-end';
        wrapper.innerHTML = '<div class="bg-[#E8F0FE] border-[2px] border-gray-900 rounded-lg p-3 max-w-[80%]">'
            + '<p class="text-sm text-gray-800 whitespace-pre-wrap">' + _escapeHtml(content) + '</p>'
            + '<span class="text-[10px] text-gray-400 mt-1 block text-right">' + timeStr + '</span>'
            + '</div>'
            + '<div class="w-8 h-8 rounded-lg bg-[#E8F0FE] border-[2px] border-gray-900 flex items-center justify-center flex-shrink-0 text-xs font-bold">You</div>';
    } else {
        wrapper.className += ' chat-msg-assistant flex gap-3';
        const avatarHtml = '<div class="w-8 h-8 rounded-lg bg-[#ffc480] border-[2px] border-gray-900 flex items-center justify-center flex-shrink-0">'
            + '<svg class="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">'
            + '<path stroke-linecap="round" stroke-linejoin="round" d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09z"/>'
            + '</svg></div>';
        const bubble = document.createElement('div');
        bubble.className = 'bg-[#fff4da] border-[2px] border-gray-900 rounded-lg p-3 max-w-[80%]';

        const contentDiv = document.createElement('div');
        contentDiv.className = 'text-sm leading-relaxed';
        renderMarkdownContent(content, contentDiv);
        bubble.appendChild(contentDiv);

        // Footer with timestamp and copy
        const footer = document.createElement('div');
        footer.className = 'flex items-center justify-between mt-2 pt-1.5 border-t border-gray-200';

        const time = document.createElement('span');
        time.className = 'text-[10px] text-gray-400';
        time.textContent = timeStr;
        footer.appendChild(time);

        const copyBtn = document.createElement('button');
        copyBtn.className = 'text-[10px] text-gray-400 hover:text-gray-600 transition-colors flex items-center gap-1';
        copyBtn.innerHTML = '<svg class="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 5H6a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2v-1M8 5a2 2 0 002 2h2a2 2 0 002-2M8 5a2 2 0 012-2h2a2 2 0 012 2"/></svg> Copy';
        copyBtn.onclick = function () {
            navigator.clipboard.writeText(content).then(function () {
                copyBtn.innerHTML = '<svg class="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"/></svg> Copied';
                setTimeout(function () {
                    copyBtn.innerHTML = '<svg class="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 5H6a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2v-1M8 5a2 2 0 002 2h2a2 2 0 002-2M8 5a2 2 0 012-2h2a2 2 0 012 2"/></svg> Copy';
                }, 1500);
            });
        };
        footer.appendChild(copyBtn);
        bubble.appendChild(footer);

        const avatarEl = document.createElement('div');
        avatarEl.innerHTML = avatarHtml;
        wrapper.appendChild(avatarEl.firstChild);
        wrapper.appendChild(bubble);
    }

    container.appendChild(wrapper);
    container.scrollTop = container.scrollHeight;
}

function _formatTimeAgo(date) {
    var now = new Date();
    var diff = Math.floor((now - date) / 1000);
    if (diff < 60) { return 'just now'; }
    if (diff < 3600) { return Math.floor(diff / 60) + 'm ago'; }
    if (diff < 86400) { return Math.floor(diff / 3600) + 'h ago'; }
    return date.toLocaleDateString();
}

function _appendChatThinking() {
    const container = document.getElementById('chat-messages');
    if (!container) { return null; }

    const id = 'thinking-' + Date.now();
    const wrapper = document.createElement('div');
    wrapper.id = id;
    wrapper.className = 'chat-msg-assistant flex gap-3 animate-fade-in';
    wrapper.innerHTML = '<div class="w-8 h-8 rounded-lg bg-[#ffc480] border-[2px] border-gray-900 flex items-center justify-center flex-shrink-0">'
        + '<svg class="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">'
        + '<path stroke-linecap="round" stroke-linejoin="round" d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09z"/>'
        + '</svg></div>'
        + '<div class="bg-[#fff4da] border-[2px] border-gray-900 rounded-lg px-4 py-3 flex items-center gap-1.5">'
        + '<span class="w-1.5 h-1.5 bg-gray-500 rounded-full typing-dot"></span>'
        + '<span class="w-1.5 h-1.5 bg-gray-500 rounded-full typing-dot"></span>'
        + '<span class="w-1.5 h-1.5 bg-gray-500 rounded-full typing-dot"></span>'
        + '</div>';

    container.appendChild(wrapper);
    container.scrollTop = container.scrollHeight;
    return id;
}

function _removeChatThinking(id) {
    if (!id) { return; }
    const el = document.getElementById(id);
    if (el) { el.remove(); }
}

function _appendChatError(message) {
    const container = document.getElementById('chat-messages');
    if (!container) { return; }

    // Detect rate limit errors and show a friendly message
    const isRateLimit = /rate.limit|429|too many requests|wait.*minute/i.test(message);
    const friendlyMsg = isRateLimit
        ? 'Rate limit reached — the AI is temporarily busy. Please wait a moment and try again.'
        : message;

    const wrapper = document.createElement('div');
    wrapper.className = 'chat-msg-error flex gap-3 animate-fade-in';

    const retryBtn = isRateLimit
        ? '<button onclick="this.closest(\'.chat-msg-error\').remove()" '
          + 'class="mt-2 text-xs font-semibold text-amber-700 bg-amber-100 border border-amber-300 '
          + 'rounded-md px-3 py-1 hover:bg-amber-200 transition-colors cursor-pointer">'
          + 'Dismiss</button>'
        : '';

    const bgColor = isRateLimit ? 'bg-amber-50' : 'bg-red-50';
    const borderColor = isRateLimit ? 'border-amber-300' : 'border-red-300';
    const textColor = isRateLimit ? 'text-amber-800' : 'text-red-700';
    const iconBg = isRateLimit ? 'bg-amber-100' : 'bg-red-100';
    const iconBorder = isRateLimit ? 'border-amber-400' : 'border-red-400';
    const iconColor = isRateLimit ? 'text-amber-600' : 'text-red-600';
    const icon = isRateLimit ? '⏳' : '!';

    wrapper.innerHTML = '<div class="w-8 h-8 rounded-lg ' + iconBg + ' border-[2px] ' + iconBorder + ' flex items-center justify-center flex-shrink-0 text-xs font-bold ' + iconColor + '">' + icon + '</div>'
        + '<div class="' + bgColor + ' border-[2px] ' + borderColor + ' rounded-lg p-3 max-w-[80%]">'
        + '<p class="text-sm ' + textColor + '">' + _escapeHtml(friendlyMsg) + '</p>'
        + retryBtn + '</div>';

    container.appendChild(wrapper);
    container.scrollTop = container.scrollHeight;
}

function _setChatInputState(busy) {
    const input = document.getElementById('chat-input');
    const btn = document.getElementById('chat-send-btn');
    if (input) {
        input.disabled = busy;
        input.placeholder = busy ? 'Waiting for response...' : 'Ask about this codebase...';
    }
    if (btn) {
        btn.disabled = busy;
        if (busy) {
            btn.classList.add('opacity-50');
        } else {
            btn.classList.remove('opacity-50');
        }
    }
}

function _escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

// ---------------------------------------------------------------------------
// Shared SSE reader
// ---------------------------------------------------------------------------

function _readSSEStream(url, body, onEvent, onError) {
    fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
    })
        .then(async (response) => {
            if (!response.ok) {
                let data;
                try { data = await response.json(); } catch { data = {}; }
                let errMsg = data.error || data.detail || 'Request failed';
                if (response.status === 429) {
                    errMsg = 'Rate limit exceeded. Please wait a moment before trying again.';
                }
                onEvent({ type: 'error', payload: { message: errMsg } });
                return;
            }

            const reader = response.body.getReader();
            const decoder = new TextDecoder();
            let buffer = '';

            while (true) {
                const { value, done } = await reader.read();
                if (done) { break; }

                buffer += decoder.decode(value, { stream: true });
                const events = buffer.split('\n\n');
                buffer = events.pop();

                for (const eventStr of events) {
                    if (!eventStr.trim()) { continue; }
                    const lines = eventStr.split('\n');
                    for (const line of lines) {
                        if (line.startsWith('data: ')) {
                            try {
                                const sseEvent = JSON.parse(line.slice(6));
                                onEvent(sseEvent);
                            } catch (e) {
                                console.error('Failed to parse SSE event:', e, line);
                            }
                        }
                    }
                }
            }
        })
        .catch(onError);
}

// ---------------------------------------------------------------------------
// Markdown renderer (shared between summaries and chat)
// ---------------------------------------------------------------------------

function renderMarkdownContent(markdown, container) {
    if (!container || !markdown) { return; }

    // Simple markdown-to-HTML conversion for AI output
    let html = markdown
        // Escape HTML entities
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        // Code blocks with language label and copy button
        .replace(/```(\w*)\n([\s\S]*?)```/g, function (match, lang, code) {
            var codeId = 'code-' + Math.random().toString(36).substr(2, 8);
            var langLabel = lang ? '<span class="absolute top-2 right-12 text-[10px] text-gray-400 font-mono uppercase">' + lang + '</span>' : '';
            return '<div class="relative my-3">'
                + langLabel
                + '<button onclick="copyCodeBlock(\'' + codeId + '\')" class="absolute top-2 right-2 text-[10px] text-gray-400 hover:text-gray-200 px-1.5 py-0.5 rounded bg-gray-700 hover:bg-gray-600 transition-colors">Copy</button>'
                + '<pre id="' + codeId + '" class="bg-gray-900 text-gray-100 p-3 rounded-lg text-xs overflow-x-auto font-mono leading-relaxed"><code>' + code + '</code></pre>'
                + '</div>';
        })
        // Inline code
        .replace(/`([^`]+)`/g, '<code class="bg-gray-200 px-1 rounded text-xs font-mono">$1</code>')
        // Headers
        .replace(/^#### (.+)$/gm, '<h4 class="font-bold text-sm mt-3 mb-1">$1</h4>')
        .replace(/^### (.+)$/gm, '<h3 class="font-bold text-base mt-4 mb-1">$1</h3>')
        .replace(/^## (.+)$/gm, '<h2 class="font-bold text-lg mt-4 mb-2">$1</h2>')
        .replace(/^# (.+)$/gm, '<h1 class="font-bold text-xl mt-4 mb-2">$1</h1>')
        // Bold and italic
        .replace(/\*\*\*(.+?)\*\*\*/g, '<strong><em>$1</em></strong>')
        .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
        .replace(/\*(.+?)\*/g, '<em>$1</em>')
        // Unordered lists
        .replace(/^- (.+)$/gm, '<li class="ml-4">$1</li>')
        .replace(/^  - (.+)$/gm, '<li class="ml-8">$1</li>')
        // Ordered lists
        .replace(/^\d+\. (.+)$/gm, '<li class="ml-4 list-decimal">$1</li>')
        // Horizontal rule
        .replace(/^---$/gm, '<hr class="my-3 border-gray-300">')
        // Line breaks (double newlines become paragraphs)
        .replace(/\n\n/g, '</p><p class="my-2">')
        .replace(/\n/g, '<br>');

    // Wrap in paragraph if not already wrapped
    html = '<p class="my-2">' + html + '</p>';

    container.innerHTML = html;
}

function copyCodeBlock(id) {
    var el = document.getElementById(id);
    if (!el) { return; }
    var text = el.textContent;
    var btn = el.parentElement.querySelector('button');
    navigator.clipboard.writeText(text).then(function () {
        if (btn) {
            btn.textContent = 'Copied!';
            setTimeout(function () { btn.textContent = 'Copy'; }, 1500);
        }
    });
}

// ---------------------------------------------------------------------------
// Form submission
// ---------------------------------------------------------------------------

// ---------------------------------------------------------------------------
// SSE Progress UI
// ---------------------------------------------------------------------------

const PROGRESS_STAGES = {
    parsing:    { label: 'Parsing URL',        pct: 5 },
    cloning:    { label: 'Cloning repository',  pct: 25 },
    analyzing:  { label: 'Analyzing files',     pct: 60 },
    formatting: { label: 'Building output',     pct: 85 },
    storing:    { label: 'Saving digest',       pct: 95 },
};

function updateProgress(stage, message, filesProcessed) {
    const loadingDiv = document.getElementById('results-loading');
    if (!loadingDiv || loadingDiv.style.display === 'none') { return; }

    const stageInfo = PROGRESS_STAGES[stage];
    if (!stageInfo) { return; }

    const progressBar = document.getElementById('progress-bar-fill');
    const progressText = document.getElementById('progress-stage-text');
    const progressDetail = document.getElementById('progress-detail-text');

    if (progressBar) { progressBar.style.width = stageInfo.pct + '%'; }
    if (progressText) { progressText.textContent = stageInfo.label; }
    if (progressDetail) {
        if (filesProcessed) {
            progressDetail.textContent = filesProcessed + ' files processed';
        } else {
            progressDetail.textContent = message || '';
        }
    }
}

function handleSSEEvent(event, submitButton) {
    const { type, payload } = event;

    switch (type) {
        case 'parsing':
            updateProgress('parsing', payload.message || 'Parsing...');
            break;
        case 'cloning':
            updateProgress('cloning', payload.message || 'Cloning repository...');
            break;
        case 'analyzing':
            updateProgress('analyzing', payload.message || 'Analyzing files...', payload.files_processed || 0);
            break;
        case 'formatting':
            updateProgress('formatting', payload.message || 'Building output...');
            break;
        case 'storing':
            updateProgress('storing', payload.message || 'Saving digest...');
            break;
        case 'complete':
            setButtonLoadingState(submitButton, false);
            handleSuccessfulResponse(payload);
            break;
        case 'error':
            setButtonLoadingState(submitButton, false);
            showError(`<div class='mb-6 p-4 bg-red-50 border border-red-200 rounded-lg text-red-700'>${payload.error || 'An unknown error occurred.'}</div>`);
            break;
        default:
            console.warn('Unknown SSE event type:', type);
    }
}

// ---------------------------------------------------------------------------
// Form submission (SSE streaming)
// ---------------------------------------------------------------------------

function handleSubmit(event, showLoadingSpinner) {
    if (showLoadingSpinner === undefined) { showLoadingSpinner = false; }
    event.preventDefault();
    const form = event.target || document.getElementById('ingestForm');
    if (!form) { return; }

    // Ensure hidden input is updated before collecting form data
    const slider = document.getElementById('file_size');
    const hiddenInput = document.getElementById('max_file_size_kb');

    if (slider && hiddenInput) {
        hiddenInput.value = logSliderToSize(slider.value);
    }

    if (showLoadingSpinner) {
        showLoading();
    }

    const submitButton = form.querySelector('button[type="submit"]');
    if (!submitButton) { return; }

    const json_data = collectFormData(form);

    if (showLoadingSpinner) {
        setButtonLoadingState(submitButton, true);
    }

    fetch('/api/ingest/stream', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(json_data)
    })
        .then(async (response) => {
            if (!response.ok) {
                // Non-streaming error (validation, rate limit, etc.)
                let data;
                try {
                    data = await response.json();
                } catch {
                    data = {};
                }
                setButtonLoadingState(submitButton, false);
                if (Array.isArray(data.detail)) {
                    const details = data.detail.map((d) => `<li>${d.msg || JSON.stringify(d)}</li>`).join('');
                    showError(`<div class='mb-6 p-4 bg-red-50 border border-red-200 rounded-lg text-red-700'><b>Error(s):</b><ul>${details}</ul></div>`);
                    return;
                }
                showError(`<div class='mb-6 p-4 bg-red-50 border border-red-200 rounded-lg text-red-700'>${data.error || JSON.stringify(data) || 'An error occurred.'}</div>`);
                return;
            }

            // Read the SSE stream via ReadableStream
            const reader = response.body.getReader();
            const decoder = new TextDecoder();
            let buffer = '';

            while (true) {
                const { value, done } = await reader.read();
                if (done) { break; }

                buffer += decoder.decode(value, { stream: true });

                // SSE events are separated by double newlines
                const events = buffer.split('\n\n');
                buffer = events.pop(); // Keep last potentially incomplete chunk

                for (const eventStr of events) {
                    if (!eventStr.trim()) { continue; }

                    const lines = eventStr.split('\n');
                    for (const line of lines) {
                        if (line.startsWith('data: ')) {
                            try {
                                const sseEvent = JSON.parse(line.slice(6));
                                handleSSEEvent(sseEvent, submitButton);
                            } catch (e) {
                                console.error('Failed to parse SSE event:', e, line);
                            }
                        }
                    }
                }
            }
        })
        .catch((error) => {
            setButtonLoadingState(submitButton, false);
            showError(`<div class='mb-6 p-4 bg-red-50 border border-red-200 rounded-lg text-red-700'>${error}</div>`);
        });
}

// ---------------------------------------------------------------------------
// Copy / Download full digest
// ---------------------------------------------------------------------------

function copyFullDigest() {
    const directoryStructure = document.getElementById('directory-structure-content').value;
    const filesContent = document.querySelector('.result-text').value;
    const fullDigest = `${directoryStructure}\n\nFiles Content:\n\n${filesContent}`;
    const button = document.querySelector('[onclick="copyFullDigest()"]');
    const originalText = button.innerHTML;

    navigator.clipboard.writeText(fullDigest).then(() => {
        button.innerHTML = `
            <svg class="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"></path>
            </svg>
            Copied!
        `;
        setTimeout(() => {
            button.innerHTML = originalText;
        }, 2000);
    })
        .catch((err) => {
            console.error('Failed to copy text: ', err);
        });
}

function downloadFullDigest() {
    if (!window.currentDigestUrl) {
        console.error('No digest_url available for download');
        return;
    }

    const button = document.querySelector('[onclick="downloadFullDigest()"]');
    const originalText = button.innerHTML;

    button.innerHTML = `
        <svg class="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"></path>
        </svg>
        Downloading...
    `;

    const a = document.createElement('a');
    a.href = window.currentDigestUrl;
    a.download = 'digest.txt';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);

    button.innerHTML = `
        <svg class="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"></path>
        </svg>
        Downloaded!
    `;

    setTimeout(() => {
        button.innerHTML = originalText;
    }, 2000);
}

// ---------------------------------------------------------------------------
// Slider helpers
// ---------------------------------------------------------------------------

function logSliderToSize(position) {
    const maxPosition = 500;
    const maxValue = Math.log(102400); // 100 MB
    const value = Math.exp(maxValue * (position / maxPosition) ** 1.5);
    return Math.round(value);
}

function formatSize(sizeInKB) {
    if (sizeInKB >= 1024) {
        return `${ Math.round(sizeInKB / 1024) }MB`;
    }
    return `${ Math.round(sizeInKB) }kB`;
}

function initializeSlider() {
    const slider = document.getElementById('file_size');
    const sizeValue = document.getElementById('size_value');
    const hiddenInput = document.getElementById('max_file_size_kb');

    if (!slider || !sizeValue || !hiddenInput) { return; }

    function updateSlider() {
        const value = logSliderToSize(slider.value);
        sizeValue.textContent = formatSize(value);
        slider.style.backgroundSize = `${(slider.value / slider.max) * 100}% 100%`;
        hiddenInput.value = value;
    }

    slider.addEventListener('input', updateSlider);
    updateSlider();
}

// ---------------------------------------------------------------------------
// Example submission
// ---------------------------------------------------------------------------

function submitExample(repoName) {
    const input = document.getElementById('input_text');
    if (input) {
        input.value = repoName;
        input.focus();
    }
}

// ---------------------------------------------------------------------------
// Chat input helpers
// ---------------------------------------------------------------------------

function handleChatKeydown(event) {
    if (event.key === 'Enter' && !event.shiftKey) {
        event.preventDefault();
        sendChatMessage();
    }
}

function autoResizeChatInput(el) {
    el.style.height = 'auto';
    el.style.height = Math.min(el.scrollHeight, 120) + 'px';
}

// ---------------------------------------------------------------------------
// Chat history persistence (sessionStorage)
// ---------------------------------------------------------------------------

function _saveChatHistory() {
    if (window.currentDigestId) {
        try {
            sessionStorage.setItem(
                'chat_' + window.currentDigestId,
                JSON.stringify(window._chatHistory)
            );
        } catch (e) { /* ignore quota errors */ }
    }
}

function _restoreChatHistory() {
    if (!window.currentDigestId) { return; }
    try {
        var saved = sessionStorage.getItem('chat_' + window.currentDigestId);
        if (!saved) { return; }
        var history = JSON.parse(saved);
        if (!Array.isArray(history) || history.length === 0) { return; }

        window._chatHistory = history;
        // Re-render messages
        history.forEach(function (msg) {
            _appendChatMessage(msg.role, msg.content);
        });
        // Hide suggestions if we have history
        var suggestions = document.getElementById('chat-suggestions');
        if (suggestions) { suggestions.classList.add('hidden'); }
    } catch (e) { /* ignore parse errors */ }
}

// ---------------------------------------------------------------------------
// Floating "Ask AI" button
// ---------------------------------------------------------------------------

function scrollToAI() {
    var section = document.getElementById('ai-analysis-section');
    if (section) {
        section.scrollIntoView({ behavior: 'smooth', block: 'start' });
        switchAITab('chat');
        setTimeout(function () {
            var input = document.getElementById('chat-input');
            if (input && !input.disabled) { input.focus(); }
        }, 500);
    }
}

function _setupAIFloatButton() {
    var btn = document.getElementById('ai-float-btn');
    var section = document.getElementById('ai-analysis-section');
    if (!btn || !section) { return; }

    var observer = new IntersectionObserver(function (entries) {
        entries.forEach(function (entry) {
            var resultsVisible = document.getElementById('results-section');
            var isVisible = resultsVisible && resultsVisible.style.display !== 'none';
            btn.classList.toggle('hidden', entry.isIntersecting || !isVisible);
        });
    }, { threshold: 0.1 });

    observer.observe(section);
}

// ---------------------------------------------------------------------------
// Global Enter key handler + keyboard shortcuts
// ---------------------------------------------------------------------------

function setupGlobalEnterHandler() {
    document.addEventListener('keydown', (event) => {
        // Cmd+K / Ctrl+K to focus chat
        if ((event.metaKey || event.ctrlKey) && event.key === 'k') {
            event.preventDefault();
            var chatInput = document.getElementById('chat-input');
            if (chatInput && !chatInput.disabled) {
                switchAITab('chat');
                chatInput.focus();
            }
            return;
        }
        // Escape to clear and blur chat input
        if (event.key === 'Escape') {
            var chatIn = document.getElementById('chat-input');
            if (chatIn && document.activeElement === chatIn) {
                chatIn.value = '';
                chatIn.style.height = 'auto';
                chatIn.blur();
            }
            return;
        }
        // Enter to submit ingest form (but not from textarea)
        if (event.key === 'Enter' && !event.target.matches('textarea')) {
            const form = document.getElementById('ingestForm');
            if (form) {
                handleSubmit(new Event('submit'), true);
            }
        }
    });
}

// ---------------------------------------------------------------------------
// Initialization
// ---------------------------------------------------------------------------

document.addEventListener('DOMContentLoaded', () => {
    initializeSlider();
    setupGlobalEnterHandler();
});

// Make functions available globally for inline event handlers
window.handleSubmit = handleSubmit;
window.handleSSEEvent = handleSSEEvent;
window.updateProgress = updateProgress;
window.toggleFile = toggleFile;
window.copyText = copyText;
window.copyFullDigest = copyFullDigest;
window.downloadFullDigest = downloadFullDigest;
window.submitExample = submitExample;
window.copyCurrentChunk = copyCurrentChunk;
// Phase 8: Interactive tree + syntax highlighting
window.filterTree = filterTree;
window.expandAllTree = expandAllTree;
window.collapseAllTree = collapseAllTree;
window.setContentView = setContentView;
window.copySingleFile = copySingleFile;
// Phase 7: AI summaries + chat
window.generateAISummary = generateAISummary;
window.copyAISummary = copyAISummary;
window.switchAITab = switchAITab;
window.sendChatMessage = sendChatMessage;
window.askQuickQuestion = askQuickQuestion;
window.clearChat = clearChat;
window.checkAISummaryAvailable = checkAISummaryAvailable;
// Phase 8C: Premium UI
window.handleChatKeydown = handleChatKeydown;
window.autoResizeChatInput = autoResizeChatInput;
window.scrollToAI = scrollToAI;
window.copyCodeBlock = copyCodeBlock;
