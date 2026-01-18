# FloppyCompanion

<p align="center"><img src="docs/images/floppycompanion.png" alt="FloppyCompanion" width="720" /></p>

A WebUI module companion for configuring FloppyKernel. Provides a web-based UI to toggle kernel features and tweak kernel parameters.

## Feature overview

- **FloppyKernel features management**: Enable/disable kernel features specific to FloppyKernel, depending on your platform.
- **Common kernel tweaks**: Configure some common, generic kernel tweaks. See below.
- **Platform-specific tweaks**: Device-specific options for the running FloppyKernel variant.
- **Presets system**: Save and apply custom configuration presets.
- **Material design 3 UI**: Modern interface to align with Android's UI.

## Supported toggleable features

### Floppy1280

- **Unlocked Mode**: CPU and GPU clock tweaks
  - Enabled (Overclock): CL0 = 2.2 GHz (OC), CL1 = 2.496 GHz (OC), GPU = 1.209 GHz (OC)
  - CoolFloppy (Underclock): CL0 = 2.0 GHz (stock), CL1 = 2.112 GHz (UC), GPU = 897 MHz (stock), UV enabled
  - BalancedFloppy (Overclock): CL0 = 2.2 GHz (OC), CL1 = 2.4 GHz (stock), GPU = 897 MHz (stock)
- **EMS Efficient Mode**: Enable EMS efficient scheduler mode

<details>
<summary>⚠️ Experimental Features</summary>

- **Force Permissive**: Force SELinux Permissive mode (for developers)
- **Unlocked Mode - MegaFloppy**: CL0 = 2.2 GHz (OC), CL1 = 2.6 GHz (OC), GPU = 1.209 GHz (OC) (risky)
- **Unlocked Mode - UltraFloppy**: CL0 = 2.2 GHz (OC), CL1 = 2.704 GHz (OC), GPU = 1.209 GHz (OC) (risky)

</details>

### FloppyTrinketMi

- **Kill Init Protection**: Allow Power HALs and init scripts to modify kernel knobs
- **Legacy Timestamp**: Fixes video recording length issues on ROMs with legacy camera HALs
- **Disable MSM Boost**: Prevent MSM Performance from overwriting CPU min/max frequencies

<details>
<summary>⚠️ Experimental Features</summary>

- **Force Warm Reboot**: Preserve RAM on reboot (debugging only, can cause broken WiFi)
- **BPF Spoofing**: Spoof Linux version for BPF support (managed externally)

</details>

## Available tweaks

### Common tweaks

Available on all supported platforms:

- **ZRAM**: Configure compressed RAM block device size and algorithm
- **Memory**: Adjust Linux Virtual Memory (VM) subsystem parameters (swappiness, dirty pages, cache pressure, etc.)
- **I/O Scheduler**: Configure I/O scheduler algorithm for storage devices

### Platform-specific tweaks

#### Floppy1280

- **Thermal Modes**: Control Big cluster CPU throttling (Disabled, Stock, Custom, Performance)
- **Undervolt**: Reduce voltage for CPU clusters and GPU to save power and reduce heat
- **Misc Tweaks**:
  - Block Ear Detect Mode 3
  - GPU Clock Lock
  - GPU Overclock toggle

#### FloppyTrinketMi

- **Sound Control**: Adjust headphone and microphone gain, split L/R channels
- **Charging**: Configure bypass charging and USB fast charge
- **Display**: Control HBM (High Brightness Mode) and CABC (Content Adaptive Backlight Control)
- **Adreno Tweaks**:
  - Adrenoboost: Replacement boosting algorithm for Adreno GPUs
  - Adrenoidler: Algorithm to make GPU boosting less aggressive
- **Misc Tweaks**:
  - MSM Performance Touchboost

## Language support

FloppyCompanion currently supports the following languages:

- English
- Spanish

Want to help translate? Check out the [Translation Guide](docs/TRANSLATION_GUIDE.md).

## Screenshots

### Floppy1280

<table>
<tr>
<td width="50%"><img src="docs/images/exy1280/floppy1280_home.jpg" alt="Home" width="300"></td>
<td width="50%"><img src="docs/images/exy1280/floppy1280_feat.jpg" alt="Features" width="300"></td>
</tr>
<tr>
<td width="50%"><img src="docs/images/exy1280/floppy1280_tweaks.jpg" alt="Tweaks" width="300"></td>
<td width="50%"><img src="docs/images/exy1280/floppy1280_about.jpg" alt="About" width="300"></td>
</tr>
</table>

### FloppyTrinketMi

<table>
<tr>
<td width="50%"><img src="docs/images/trinket/floppytrinketmi_home.png" alt="Home" width="300"></td>
<td width="50%"><img src="docs/images/trinket/floppytrinketmi_feat.png" alt="Features" width="300"></td>
</tr>
<tr>
<td width="50%"><img src="docs/images/trinket/floppytrinketmi_tweaks.png" alt="Tweaks" width="300"></td>
<td width="50%"><img src="docs/images/trinket/floppytrinketmi_about.png" alt="About" width="300"></td>
</tr>
</table>

## Installation

1. Download the latest release from the [releases page](https://github.com/FlopKernel-Series/FloppyCompanion/releases)
2. Install via KernelSU Manager
3. Open KernelSU Manager and navigate to the FloppyCompanion module
4. Tap "Open" to launch the web interface

## Requirements

For FloppyCompanion **v1.0**:
- FloppyKernel installed on your device.
  - **Floppy1280**: Version v6.2 or newer is supported (older versions might work but are unsupported)
  - **FloppyTrinketMi**: Version v2.0b or newer is required.
- KernelSU or a compatible fork of KSU.

>[!NOTE]
>Apatch should in theory be supported, however it has been untested, and Apatch doesn't currently work on Floppy1280 anyway.

## Kernel repositories

- [Floppy1280 Kernel](https://github.com/FlopKernel-Series/flop_s5e8825_kernel)
- [FloppyTrinketMi Kernel](https://github.com/FlopKernel-Series/flop_trinket-mi_kernel)

## TODO

- [ ] Monitor tab to see system resources
- [ ] Make presets system less janky
- [ ] "Create shortcut" support for compatible managers

## Contributing

Contributions are welcome! If you'd like to help translate FloppyCompanion to your language, check out the [Translation Guide](docs/TRANSLATION_GUIDE.md).

## Credits
* FloppyKernel community for thoroughly testing this module pre-v1.0.
* [Hybrid Mount](https://github.com/Hybrid-Mount/meta-hybrid_mount) as inspiration for the UI layout initially.
* [Anyone who contributed to translations!](docs/TRANSLATORS.md)

## License

See [LICENSE](LICENSE) file for details.

## Links

- [Floppy1280 Telegram Channel](https://t.me/Floppy1280)
- [FloppyTrinketMi Telegram Channel](https://t.me/FloppyTrinketMi)
