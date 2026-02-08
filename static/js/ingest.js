/**
 * GitUnderstand - Ingest form handling
 *
 * Handles the ingest form pattern changes, access settings toggle,
 * and auto-submit on page load when a URL is pre-filled.
 */

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
        element.classList.remove('text-gray-500');
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
