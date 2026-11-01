# Translation Guide

Want to translate FloppyCompanion? Great! Here's how:

## Quick Start

### New Translation
1. Copy `repo/webroot/lang/en.json` and `repo/webroot/lang/en_feat.json`
2. Rename them to your language code (e.g., `fr.json`, `de.json`, or `pt_BR.json` if you need a region-specific locale)
3. Translate the text (keep the keys, structure, HTML tags, and placeholders like `{path}`)
4. Add your language entry to `repo/webroot/lang/languages.json`
5. Add translator credits for the language in `repo/webroot/credits.json`

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

After creating your translation files, add the language to `repo/webroot/lang/languages.json`.

Example:

```json
{
  "code": "pt_BR",
  "name": "Português (Brasil)",
  "dir": "ltr"
}
```

Use a two-letter language code when possible, or `language_REGION` when you need a regional variant like `pt_BR` or `es_AR`. Use the native language name for `name`, and `rtl` only for right-to-left languages.

That's it! The dropdown will show your language automatically.

## Installer and module manager

Installer messages and the module description shown in the manager use shell
translations in `repo/translations/{code}/strings.sh`. Copy
`repo/translations/strings.sh` into a folder named for the locale code and
translate the values while keeping the `STR_` variable names and `%s`
placeholders unchanged. Use a hyphen for region-specific folders such as
`pt-BR`; Android locale underscores are normalized automatically.

The installer and boot service detect the system language and fall back to
English when a translation is unavailable. The service adds the detected
kernel information to the localized module description after boot.
