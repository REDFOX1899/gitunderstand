/**
 * GitUnderstand - Ingest form handling
 *
 * Handles the ingest form pattern changes, access settings toggle,
 * preset profiles, and auto-submit on page load when a URL is pre-filled.
 */

// ---------------------------------------------------------------------------
// Preset Profiles
// ---------------------------------------------------------------------------

const PRESETS = {
    'code-review': {
        pattern_type: 'include',
        pattern: '*.py, *.js, *.ts, *.tsx, *.jsx, *.go, *.rs, *.java, *.cpp, *.c, *.h, *.cs, *.swift, *.kt, *.rb, *.php',
        output_format: null, // keep current
    },
    'documentation': {
        pattern_type: 'include',
        pattern: '*.md, *.rst, *.txt, *.doc, README*',
        output_format: 'markdown',
    },
    'architecture': {
        pattern_type: 'exclude',
        pattern: '*test*, *spec*, *__pycache__*, *.png, *.jpg, *.svg, *.gif, *.ico, node_modules/, dist/, build/',
        output_format: null,
    },
    'full-digest': {
        pattern_type: 'exclude',
        pattern: '',
        output_format: 'text',
    },
};

let _activePreset = null;

function applyPreset(presetName) {
    const preset = PRESETS[presetName];
    if (!preset) { return; }

    // Toggle: clicking active preset resets to full-digest
    if (_activePreset === presetName) {
        applyPreset('full-digest');
        return;
    }

    const patternTypeSelect = document.getElementById('pattern_type');
    const patternInput = document.getElementById('pattern');
    const outputFormatSelect = document.getElementById('output_format');

    if (patternTypeSelect) { patternTypeSelect.value = preset.pattern_type; }
    if (patternInput) { patternInput.value = preset.pattern; }
    if (preset.output_format && outputFormatSelect) {
        outputFormatSelect.value = preset.output_format;
    }

    _activePreset = presetName;
    _updatePresetButtons();
}

function _updatePresetButtons() {
    document.querySelectorAll('[data-preset]').forEach((btn) => {
        const isActive = btn.dataset.preset === _activePreset;
        btn.classList.toggle('bg-primary', isActive);
        btn.classList.toggle('text-primary-foreground', isActive);
        btn.classList.toggle('border-primary', isActive);
        btn.classList.toggle('bg-secondary', !isActive);
        btn.classList.toggle('border-stone-200', !isActive);
        btn.classList.toggle('font-semibold', isActive);
    });
}

function _detectManualEdit() {
    // If user manually edits pattern, deactivate preset indicator
    if (_activePreset) {
        const preset = PRESETS[_activePreset];
        const patternInput = document.getElementById('pattern');
        const patternTypeSelect = document.getElementById('pattern_type');

        if (patternInput && patternTypeSelect) {
            const currentPattern = patternInput.value;
            const currentType = patternTypeSelect.value;
            if (currentPattern !== preset.pattern || currentType !== preset.pattern_type) {
                _activePreset = null;
                _updatePresetButtons();
            }
        }
    }
}

// ---------------------------------------------------------------------------
// Pattern type change handler
// ---------------------------------------------------------------------------

function changePattern() {
    const dirPre = document.getElementById('directory-structure-pre');
    if (!dirPre) { return; }

    const treeLineElements = Array.from(dirPre.querySelectorAll('pre[name="tree-line"]'));

    // Skip the first two tree line elements (header and repo name)
    treeLineElements.slice(2).forEach((element) => {
        element.classList.remove('line-through');
        element.classList.remove('text-stone-400');
    });

    // Reset the pattern input field
    const patternInput = document.getElementById('pattern');
    if (patternInput) {
        patternInput.value = '';
    }
}

// ---------------------------------------------------------------------------
// Private repository / PAT toggle
// ---------------------------------------------------------------------------

function toggleAccessSettings() {
    const container = document.getElementById('accessSettingsContainer');
    const examples = document.getElementById('exampleRepositories');
    const show = document.getElementById('showAccessSettings')?.checked;

    container?.classList.toggle('hidden', !show);
    examples?.classList.toggle('lg:mt-0', show);
}

// ---------------------------------------------------------------------------
// Auto-submit on page load (for pre-filled URLs)
// ---------------------------------------------------------------------------

document.addEventListener('DOMContentLoaded', () => {
    toggleAccessSettings();
    changePattern();

    // Listen for manual edits to pattern fields to deactivate preset
    const patternInput = document.getElementById('pattern');
    const patternTypeSelect = document.getElementById('pattern_type');
    if (patternInput) { patternInput.addEventListener('input', _detectManualEdit); }
    if (patternTypeSelect) { patternTypeSelect.addEventListener('change', _detectManualEdit); }

    const urlInput = document.getElementById('input_text');
    const form = document.getElementById('ingestForm');

    if (urlInput && urlInput.value.trim() && form) {
        const submitEvent = new SubmitEvent('submit', {
            cancelable: true,
            bubbles: true
        });

        Object.defineProperty(submitEvent, 'target', {
            value: form,
            enumerable: true
        });
        handleSubmit(submitEvent, true);
    }
});

// Make them available to existing inline attributes
window.changePattern = changePattern;
window.toggleAccessSettings = toggleAccessSettings;
window.applyPreset = applyPreset;
