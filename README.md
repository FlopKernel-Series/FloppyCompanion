# FloppyCompanion

<p align="center"><img src="docs/images/floppycompanion.png" alt="FloppyCompanion" width="720" /></p>

FloppyCompanion is a KernelSU WebUI module for configuring FloppyKernel variants. It exposes kernel feature toggles, device-specific tweaks, and a presets system through a BeerCSS-backed Material Design interface.

## Requirements
- Root solution:

        - KernelSU (recommended)

        - Magisk (via KernelSU WebUI compatibility)

        - APatch (untested)
- FloppyKernel installed:

        - Floppy1280: v6.2+ supported

        - Floppy2100: v1.0+ supported
        
        - FloppyTrinketMi: v2.0b+ required

Note: If you spoof the kernel version (SusFS, BRENE), feature detection and patching will break.

## How it works
- Reads current kernel cmdline and sysfs state for feature/tweak status.
- Applies feature toggles by patching the boot image (kernel cmdline, kernel tokens, or header).
- Applies tweaks via backend scripts that write to sysfs and persist configs.
- Reapplies everything at boot through service scripts.

## Features
- FloppyKernel feature toggles (per device family)
- Common kernel tweaks (ZRAM, VM, I/O scheduler)
- Platform-specific tweak panels (thermal, undervolt, charging, display, GPU)
- Preset save/load/apply system
- BeerCSS-powered Material Design 3 WebUI with i18n support

## Usage
1. Install the module through KernelSU Manager.
2. Open KernelSU Manager and launch the module WebUI.
3. Apply features and tweaks as needed.
4. (Optional) Save your configuration as a preset.

## Downloads
Releases are published here:
- https://github.com/FlopKernel-Series/FloppyCompanion/releases

Alternative (CI builds via nightly.link):
- https://nightly.link/FlopKernel-Series/FloppyCompanion/workflows/build/master?preview

## Screenshots
<p>
        <img src="docs/images/exy2100/floppy2100_home.jpg" width="240" />
        <img src="docs/images/exy2100/floppy2100_feat.jpg" width="240" />
        <img src="docs/images/exy2100/floppy2100_tweaks.jpg" width="240" />
</p>
<p>
        <img src="docs/images/exy1280/floppy1280_home.jpg" width="240" />
        <img src="docs/images/exy1280/floppy1280_feat.jpg" width="240" />
        <img src="docs/images/exy1280/floppy1280_tweaks.jpg" width="240" />
</p>
<p>
        <img src="docs/images/trinket/floppytrinketmi_home.png" width="240" />
        <img src="docs/images/trinket/floppytrinketmi_feat.png" width="240" />
        <img src="docs/images/trinket/floppytrinketmi_tweaks.png" width="240" />
</p>

## Build
```bash
cd repo
./build.sh
```
The module zip will be emitted by the build script in the repo directory.

## Notes and troubleshooting
- Boot image patching is sensitive. If flashing fails, restore your stock boot image.
- Some experimental features may be hidden or marked risky in the UI.
- If features don’t show up, confirm the kernel name matches a supported FloppyKernel variant.

## Kernel repositories
- https://github.com/FlopKernel-Series/flop_s5e8825_kernel
- https://github.com/FlopKernel-Series/flop_exynos2100_kernel
- https://github.com/FlopKernel-Series/flop_trinket-mi_kernel

## Language support
FloppyCompanion currently supports:
- English
- Spanish
- Portuguese (Brazil)
- Turkish
- Ukrainian
- Vietnamese
- Russian
- Arabic
- Azerbaijani

Translation guide: docs/TRANSLATION_GUIDE.md

## Contributing
Contributions and translations are welcome. See docs/TRANSLATION_GUIDE.md and docs/TRANSLATORS.md.

## Credits
- BeerCSS: https://www.beercss.com/
- FloppyKernel community testers
- Hybrid Mount UI inspiration: https://github.com/Hybrid-Mount/meta-hybrid_mount
- All translators and contributors

## License
GNU GPLv3

## Links
- https://t.me/Floppy1280
- https://t.me/Floppy2100
- https://t.me/FloppyTrinketMi
