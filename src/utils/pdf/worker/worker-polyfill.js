/**
 * Minimal DOM polyfill for PDF.js inside Web Workers.
 */
if (typeof self !== 'undefined' && typeof document === 'undefined') {
    self.document = {
        createElement: (tag) => {
            if (tag === 'canvas') {
                return new OffscreenCanvas(1, 1);
            }
            return {
                style: {},
                appendChild: () => { },
                removeChild: () => { },
                setAttribute: () => { },
                getContext: () => null,
            };
        },
        documentElement: { style: {} },
        body: {
            appendChild: () => { },
            removeChild: () => { },
            style: {}
        },
        visibilityState: 'visible',
        addEventListener: () => { },
        removeEventListener: () => { },
        querySelector: () => null,
        querySelectorAll: () => [],
        getElementById: () => null,
        getElementsByTagName: () => [],
        getElementsByClassName: () => [],
        createTextNode: () => ({ nodeValue: '' }),
        createComment: () => ({ nodeValue: '' }),
    };

    // Optional — only if some lib checks for window
    if (typeof self.window === 'undefined') {
        self.window = self;
    }

    // ❌ DO NOT TOUCH location
    // ❌ DO NOT ASSIGN navigator
    // location & navigator already exist in WorkerGlobalScope
}
