// i18n.js - Internationalization Module

const I18N = {
    currentLang: 'en',
    fallbackLang: 'en',
    strings: {},
    fallbackStrings: {},
    featureStrings: {},
    fallbackFeatureStrings: {},
    availableLanguages: [
        { code: 'en', name: 'English' },
        { code: 'es', name: 'Español' }
    ],

    // Initialize i18n system
    async init() {
        // Load saved preference or detect from browser
        const saved = localStorage.getItem('floppy_lang');
        if (saved && this.availableLanguages.some(l => l.code === saved)) {
            this.currentLang = saved;
        } else {
            // Try to detect from browser
            const browserLang = navigator.language.split('-')[0];
            if (this.availableLanguages.some(l => l.code === browserLang)) {
                this.currentLang = browserLang;
            }
        }

        // Always load fallback first
        await this.loadLanguage(this.fallbackLang, true);
        await this.loadFeatureStrings(this.fallbackLang, true);

        // Load current language if different from fallback
        if (this.currentLang !== this.fallbackLang) {
            await this.loadLanguage(this.currentLang, false);
            await this.loadFeatureStrings(this.currentLang, false);
        }

        this.applyTranslations();

        // Dispatch event so components can update with the loaded language
        document.dispatchEvent(new CustomEvent('languageChanged', { detail: { lang: this.currentLang } }));
    },

    // Load a language file
    async loadLanguage(code, isFallback = false) {
        try {
            const response = await fetch(`lang/${code}.json`);
            if (!response.ok) throw new Error(`Failed to load ${code}`);
            const data = await response.json();

            if (isFallback) {
                this.fallbackStrings = data;
            } else {
                this.strings = data;
            }
        } catch (e) {
            console.error(`Failed to load language ${code}:`, e);
        }
    },

    // Load feature translation file
    async loadFeatureStrings(code, isFallback = false) {
        try {
            const response = await fetch(`lang/${code}_feat.json`);
            if (!response.ok) throw new Error(`Failed to load ${code}_feat`);
            const data = await response.json();

            if (isFallback) {
                this.fallbackFeatureStrings = data;
            } else {
                this.featureStrings = data;
            }
        } catch (e) {
            console.error(`Failed to load feature strings ${code}:`, e);
        }
    },

    // Get translation by dot-notation key
    t(key, replacements = {}) {
        const keys = key.split('.');
        let value = this.getNestedValue(this.strings, keys);

        // Fallback to English if not found
        if (value === undefined) {
            value = this.getNestedValue(this.fallbackStrings, keys);
        }

        // Return key if still not found
        if (value === undefined) {
            console.warn(`Missing translation: ${key}`);
            return key;
        }

        // Handle replacements like {path}
        if (typeof value === 'string') {
            Object.keys(replacements).forEach(k => {
                value = value.replace(`{${k}}`, replacements[k]);
            });
        }

        return value;
    },

    // Get feature translation
    // tf('superfloppy', 'title', null, '1280') -> checks 1280.superfloppy first
    tf(featureKey, field, optionVal = null, family = null) {
        let value;

        const tryGet = (namespace) => {
            if (!namespace || !this.featureStrings[namespace]) return undefined;
            const feat = this.featureStrings[namespace][featureKey];
            if (!feat) return undefined;

            if (optionVal !== null) {
                if (feat.options && feat.options[optionVal]) {
                    return feat.options[optionVal][field];
                }
            } else {
                return feat[field];
            }
        };

        const tryGetFallback = (namespace) => {
            if (!namespace || !this.fallbackFeatureStrings[namespace]) return undefined;
            const feat = this.fallbackFeatureStrings[namespace][featureKey];
            if (!feat) return undefined;

            if (optionVal !== null) {
                if (feat.options && feat.options[optionVal]) {
                    return feat.options[optionVal][field];
                }
            } else {
                return feat[field];
            }
        };

        // 1. Try Specific Family (Current Lang)
        if (family) {
            value = tryGet(family);
        }

        // 2. Try Global (Current Lang)
        if (value === undefined) {
            // Helper for global (root) lookup
            const feat = this.featureStrings[featureKey];
            if (feat) {
                if (optionVal !== null) {
                    if (feat.options && feat.options[optionVal]) {
                        value = feat.options[optionVal][field];
                    }
                } else {
                    value = feat[field];
                }
            }
        }

        // 3. Try Specific Family (Fallback Lang)
        if (value === undefined && family) {
            value = tryGetFallback(family);
        }

        // 4. Try Global (Fallback Lang)
        if (value === undefined) {
            const feat = this.fallbackFeatureStrings[featureKey];
            if (feat) {
                if (optionVal !== null) {
                    if (feat.options && feat.options[optionVal]) {
                        value = feat.options[optionVal][field];
                    }
                } else {
                    value = feat[field];
                }
            }
        }

        return value; // Return undefined if not found (caller will use original)
    },

    // Helper to get nested object value
    getNestedValue(obj, keys) {
        return keys.reduce((o, k) => (o && o[k] !== undefined) ? o[k] : undefined, obj);
    },

    // Apply translations to all elements with data-i18n attribute
    applyTranslations() {
        document.querySelectorAll('[data-i18n]').forEach(el => {
            const key = el.getAttribute('data-i18n');
            const translation = this.t(key);

            // Check for data-i18n-attr for attribute translations
            const attr = el.getAttribute('data-i18n-attr');
            if (attr) {
                el.setAttribute(attr, translation);
            } else {
                el.textContent = translation;
            }
        });

        // Also handle data-i18n-html for HTML content
        document.querySelectorAll('[data-i18n-html]').forEach(el => {
            const key = el.getAttribute('data-i18n-html');
            el.innerHTML = this.t(key);
        });
    },

    // Set language and reload
    async setLanguage(code) {
        if (!this.availableLanguages.some(l => l.code === code)) return;

        this.currentLang = code;
        localStorage.setItem('floppy_lang', code);

        if (code === this.fallbackLang) {
            this.strings = this.fallbackStrings;
            this.featureStrings = this.fallbackFeatureStrings;
        } else {
            await this.loadLanguage(code, false);
            await this.loadFeatureStrings(code, false);
        }

        this.applyTranslations();

        // Dispatch event for dynamic content
        document.dispatchEvent(new CustomEvent('languageChanged', { detail: { lang: code } }));
    }
};

// Global shorthand
function t(key, replacements) {
    return I18N.t(key, replacements);
}

function tf(featureKey, field, optionVal = null, family = null) {
    return I18N.tf(featureKey, field, optionVal, family);
}

// Export for module usage
window.I18N = I18N;
window.t = t;
window.tf = tf;

