All notable changes to FloppyCompanion will be documented in this file.

## v1.2.0
## Added
- Automatic system-language detection for installer messages and the module description displayed in the manager.
- A shared locale loader that checks Android’s selected locale, system properties, and activity configuration, then falls back to English.
- Installer and manager translations for Arabic, Azerbaijani, Spanish, Polish, Brazilian Portuguese, Russian, Albanian, Turkish, Ukrainian, and Vietnamese.
- A Russian project README with language links at the top of both README files.
## Changed
- Localized installer output, including kernel detection, build details, unsupported-version notices, icon messages, and installation status.
- Localized the module description and detected-kernel information refreshed by the boot service.
- Included the translations/ directory in generated module packages.
- Updated the translation guide with instructions for translating installer and manager strings.
- Normalized translation shell files to LF line endings for compatibility with Android shells.
  
## Validation
- Checked shell syntax for the installer and translation scripts.
vVerified that all locales contain the same translation keys and matching format placeholders.

## v1.1.1
- Many improvements to UI to make more faithful to MD3.
- Add support for Dynamic Colors "Monet" to UI.
- New language prompt on first run.
- Fix clipping tooltips.
- AOSP Mode state now read for Exynos 2100.
- New Thermal monitor section.
- New Voltage monitor section (Exynos only).
- Exynos Frequency Clamp support (only Floppy2100 for now).
- Sound control fixes for Trinket.
- New languages: Albanian, Polish.
- New icons for WebUI shortcuts.
- Fix some lags on the UI.

(Any changes not mentioned above are instead shown below in PRs).

### PRs
* Update Vietnamese by @ThePrimalPea in https://github.com/FlopKernel-Series/FloppyCompanion/pull/28
* module: Add High Touch Polling Toggle Toggle by @milxnaq in https://github.com/FlopKernel-Series/FloppyCompanion/pull/29
* build.sh: Silence output from `make` and `curl` by @milxnaq in https://github.com/FlopKernel-Series/FloppyCompanion/pull/31
* lang: Import Polish translations by @milxnaq in https://github.com/FlopKernel-Series/FloppyCompanion/pull/30
* Add Albanian standard dialect support by @3q5i in https://github.com/FlopKernel-Series/FloppyCompanion/pull/33
* Fix some translations in albanian by @3q5i in https://github.com/FlopKernel-Series/FloppyCompanion/pull/34
* Add Albanian (Standard Dialect) to languages list by @3q5i in https://github.com/FlopKernel-Series/FloppyCompanion/pull/35
* treewide: Add SPDX License headers by @milxnaq in https://github.com/FlopKernel-Series/FloppyCompanion/pull/36
* Update ar.json by @maydoxx in https://github.com/FlopKernel-Series/FloppyCompanion/pull/38

## v1.1.0
- Support for FloppyKernel for **Exynos 2100**.
- New improved BeerCSS-based MD3 user interface!
- Introduced WebUI simulator (for developers).
- i18n language system overhaul.
- Fixed several bugs in Tweaks.
#### PRs:
* module: lang: Update Turkish translations by @NotZezu in https://github.com/FlopKernel-Series/FloppyCompanion/pull/10
* module: lang: Update Ukrainian translations by @NiFate in https://github.com/FlopKernel-Series/FloppyCompanion/pull/11
* Add Arabic translation because I CAN by @maydoxx in https://github.com/FlopKernel-Series/FloppyCompanion/pull/12
* add azerbaijani language by @akifakif32 in https://github.com/FlopKernel-Series/FloppyCompanion/pull/14
* Update README.md by @maydoxx in https://github.com/FlopKernel-Series/FloppyCompanion/pull/15
* Update TRANSLATORS.md by @maydoxx in https://github.com/FlopKernel-Series/FloppyCompanion/pull/17
* lang: tweaks/lmkd: Adding lmkd prop settings for the Ukrainian language by @NiFate in https://github.com/FlopKernel-Series/FloppyCompanion/pull/16
* Add Vietnamese language by @ThePrimalPea in https://github.com/FlopKernel-Series/FloppyCompanion/pull/18
* Update Vietnamese translation by @ThePrimalPea in https://github.com/FlopKernel-Series/FloppyCompanion/pull/19
* Sync Vietnamese to source by @ThePrimalPea in https://github.com/FlopKernel-Series/FloppyCompanion/pull/20
* Minor fix by @ThePrimalPea in https://github.com/FlopKernel-Series/FloppyCompanion/pull/21
* Update ru.json by @golkov1993 in https://github.com/FlopKernel-Series/FloppyCompanion/pull/23
* Update Vietnamese by @ThePrimalPea in https://github.com/FlopKernel-Series/FloppyCompanion/pull/22
* Updated and added new strings in to Russian by @golkov1993 in https://github.com/FlopKernel-Series/FloppyCompanion/pull/24
* lang: uk: Update translation by @NiFate in https://github.com/FlopKernel-Series/FloppyCompanion/pull/25
* Update Vietnamese by @ThePrimalPea in https://github.com/FlopKernel-Series/FloppyCompanion/pull/26
* Shorten 'Сохранить и применить' to 'Сохр./Прим.' by @LegacyFreeman in https://github.com/FlopKernel-Series/FloppyCompanion/pull/27

## v1.0.2

- A ton of UI backend improvements for stability.
- Improved presets and defaults system for consistency and to fix some bugs.
- Visual improvements.
- Preset deleting support
- WebUI X support (untested)
- Translate more things!
- Add basic (for now) Monitor tab for checking status on Memory and CPU.
#### PRs:
- Enhance Preset System: Robustness, Persistence, and Full Localization by @MematiBas42 in #4
- feat: add high-resolution WebUI icon and update module.prop by @MematiBas42 in #5
- module: lang: Update Ukrainian translations by @NiFate in #7
- module: lang: Update Turkish translations by @NotZezu in #8

## v1.0.1-hotfix

- Added update.json support.
- Added uninstall script to cleanup module data dir on removal.

## v1.0.1

- New translations: Turkish, Ukrainian.
- `module: features: Mark uname_bpf_spoof as Read-Only`
- `module: webui/features: Correctly interpret readonly flag`
- tweaks: Fix several UI inconsistencies and improved UI.
- UI accommodations to make it friendlier for some languages.
- Other minor UI changes.

### Credits

- @MematiBas42 (Turkish translation)
- @NotZezu (Turkish translation)
- @NiFate (Ukrainian translation)

## v1.0.0

- Initial release.
