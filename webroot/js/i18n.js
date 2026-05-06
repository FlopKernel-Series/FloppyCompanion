// i18n.js - Internationalization Module

const I18N = {
    currentLang: 'en',
    fallbackLang: 'en',
    strings: {},
    fallbackStrings: {},
    featureStrings: {},
    fallbackFeatureStrings: {},
    availableLanguages: [
        { code: 'en', name: 'English', dir: 'ltr' },
        { code: 'es', name: 'Español', dir: 'ltr' },
        { code: 'pl', name: 'Polski', dir: 'ltr' },
        { code: 'pt_BR', name: 'Português (Brasil)', dir: 'ltr' },
        { code: 'tr', name: 'Türkçe', dir: 'ltr' },
        { code: 'vi', name: 'Tiếng Việt', dir: 'ltr' },
        { code: 'uk', name: 'Українська', dir: 'ltr' },
        { code: 'ru', name: 'Русский', dir: 'ltr' },
        { code: 'ar', name: 'العربية', dir: 'rtl' },
        { code: 'az', name: 'Azərbaycanca', dir: 'ltr' }
    ],

    async loadLanguagesManifest() {
        try {
            const response = await fetch('lang/languages.json');
            if (!response.ok) throw new Error('Failed to load language manifest');
            const data = await response.json();

            if (data && typeof data.fallback === 'string' && data.fallback) {
                this.fallbackLang = data.fallback;
            }

            if (data && Array.isArray(data.languages) && data.languages.length > 0) {
                const unique = new Map();
                data.languages
                    .filter(lang => lang && typeof lang.code === 'string' && typeof lang.name === 'string')
                    .forEach((lang) => {
                        const normalized = this.normalizeLanguageCode(lang.code);
                        if (!normalized || unique.has(normalized)) return;
                        unique.set(normalized, {
                            code: normalized,
                            name: lang.name,
                            dir: lang.dir || this.getDir(normalized)
                        });
                    });
                this.availableLanguages = Array.from(unique.values());
            }
        } catch (e) {
            console.error('Failed to load language manifest:', e);
        }
    },

    getLanguageMeta(code) {
        const normalized = this.normalizeLanguageCode(code);
        return this.availableLanguages.find(lang => lang.code === normalized);
    },

    getLanguageName(code) {
        const lang = this.getLanguageMeta(code);
        return lang ? lang.name : code;
    },

    normalizeLanguageCode(code) {
        if (!code || typeof code !== 'string') return '';
        const sanitized = code.trim().replace(/-/g, '_');
        if (!sanitized) return '';
        const parts = sanitized.split('_').filter(Boolean);
        if (parts.length === 0) return '';
        if (parts.length === 1) return parts[0].toLowerCase();
        return `${parts[0].toLowerCase()}_${parts[1].toUpperCase()}`;
    },

    toHtmlLang(code) {
        return this.normalizeLanguageCode(code).replace('_', '-');
    },

    resolveSupportedLanguage(code) {
        const normalized = this.normalizeLanguageCode(code);
        if (!normalized) return '';

        const exact = this.availableLanguages.find(lang => lang.code === normalized);
        if (exact) return exact.code;

        const base = normalized.split('_')[0];
        const baseMatch = this.availableLanguages.find(lang => lang.code === base);
        return baseMatch ? baseMatch.code : '';
    },

    // Get direction for language
    getDir(code) {
        const meta = this.getLanguageMeta(code);
        if (meta && meta.dir) return meta.dir;
        const rtlLangs = ['ar', 'he', 'fa', 'ur'];
        const base = this.normalizeLanguageCode(code).split('_')[0];
        return rtlLangs.includes(base) ? 'rtl' : 'ltr';
    },

    // Initialize i18n system
    async init() {
        await this.loadLanguagesManifest();

        // Load saved preference or detect from browser
        const saved = this.resolveSupportedLanguage(localStorage.getItem('floppy_lang'));
        if (saved) {
            this.currentLang = saved;
        } else {
            // Try to detect from browser
            const browserLang = this.resolveSupportedLanguage(navigator.language);
            if (browserLang) {
                this.currentLang = browserLang;
            }
        }

        // Set initial direction
        document.documentElement.dir = this.getDir(this.currentLang);
        document.documentElement.lang = this.toHtmlLang(this.currentLang);

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
        document.dispatchEvent(new CustomEvent('languageChanged', { detail: { lang: this.currentLang, dir: this.getDir(this.currentLang) } }));
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
        let value = this.resolveTranslationValue(key);

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

    resolveTranslationValue(key, seen = new Set()) {
        if (!key || typeof key !== 'string') return undefined;

        if (seen.has(key)) {
            console.warn(`Circular translation reference: ${[...seen, key].join(' -> ')}`);
            return undefined;
        }

        seen.add(key);

        const keys = key.split('.');
        let value = this.getNestedValue(this.strings, keys);

        // Fallback to English if not found
        if (value === undefined) {
            value = this.getNestedValue(this.fallbackStrings, keys);
        }

        if (typeof value === 'string' && /^@[A-Za-z0-9_.-]+$/.test(value)) {
            return this.resolveTranslationValue(value.slice(1), seen);
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
            let params = {};
            const paramsAttr = el.getAttribute('data-i18n-params');
            if (paramsAttr) {
                try {
                    params = JSON.parse(paramsAttr);
                } catch (e) {
                    console.warn('Invalid i18n params:', paramsAttr);
                }
            }
            
            const translation = this.t(key, params);

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
            // Support params for HTML too if needed, though rare
            let params = {};
            const paramsAttr = el.getAttribute('data-i18n-params');
            if (paramsAttr) {
                try {
                    params = JSON.parse(paramsAttr);
                } catch (e) {}
            }
            el.innerHTML = this.t(key, params);
        });
    },

    // Set language and reload
    async setLanguage(code) {
        const resolvedCode = this.resolveSupportedLanguage(code);
        if (!resolvedCode) return;

        this.currentLang = resolvedCode;
        localStorage.setItem('floppy_lang', resolvedCode);

        if (resolvedCode === this.fallbackLang) {
            this.strings = this.fallbackStrings;
            this.featureStrings = this.fallbackFeatureStrings;
        } else {
            await this.loadLanguage(resolvedCode, false);
            await this.loadFeatureStrings(resolvedCode, false);
        }

        this.applyTranslations();

        // Update direction
        document.documentElement.dir = this.getDir(resolvedCode);
        document.documentElement.lang = this.toHtmlLang(resolvedCode);

        // Dispatch event for dynamic content
        document.dispatchEvent(new CustomEvent('languageChanged', { detail: { lang: resolvedCode, dir: this.getDir(resolvedCode) } }));
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
