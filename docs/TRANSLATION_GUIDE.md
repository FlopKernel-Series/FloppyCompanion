# Translation Guide

Want to translate FloppyCompanion? Great! Here's how:

## Quick Start

### New Translation
1. Copy `repo/webroot/lang/en.json` and `repo/webroot/lang/en_feat.json`
2. Rename them to your language code (e.g., `fr.json`, `de.json`)
3. Translate the text (keep the keys, structure, HTML tags, and placeholders like `{path}`)

### Expanding an Existing Translation
If a translation file already exists for your language, just update it with any missing or incomplete translations.

**Note:** You don't need to translate everything at once. Missing translations automatically fall back to English, so you can do partial translations and fill in more later.

### Submitting
Create a PR with your contributions or contact me (@Flopster101) to add them. I'll review and merge them.

## The Two Files

- **`{code}.json`** - Main UI text (buttons, labels, tooltips, etc.)
- **`{code}_feat.json`** - Kernel feature descriptions

Just translate the **values** (text after the colon). Keep everything else the same - keys, HTML tags, placeholders, etc.

## Adding a New Language

After creating your translation files, add the language to `repo/webroot/js/i18n.js`:

```javascript
availableLanguages: [
    { code: 'en', name: 'English' },
    { code: 'es', name: 'Español' },
    { code: 'fr', name: 'Français' }  // Add yours here
],
```

Use the ISO 639-1 language code (2 letters) for `code`, and the native name for `name`.

That's it! The dropdown will show your language automatically.
