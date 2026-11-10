# OpenWootility

**UNOFFICIAL Wootility** · Made by **wyktdev** with love.

An independent keyboard editor for the Wooting lineup. Explore each model offline or connect a keyboard in Edge or Chrome to see which controls its HID interfaces and firmware support.

| Version | Open |
| --- | --- |
| Web | [Open Keyboard Studio](https://wyktdev.github.io/OpenWootility-Studio/) |
| Windows x64 | [Download OpenWootility.exe](https://github.com/wyktdev/OpenWootility-Studio/releases/latest/download/OpenWootility.exe). The unsigned launcher opens a standalone Edge window. |

## Workspaces

- **Performance** edits profile and per-key actuation, Rapid Trigger, separate press and release sensitivity, and per-key continuous mode. Quick starts stage typing, balanced, or fast-response defaults.
- **Lighting** has Select All, key groups, brush painting, gradients, static hardware preview, and seven base styles with adjustable brightness, speed, and supported lock-indicator colors.
- **Lightbar** shows the ten colors reported by the connected 80HE or 80HE+ above the arrow cluster. In Lighting, use **Connect for live colors** if the board is in demo mode. The app can reconnect to one keyboard already allowed by the browser. Click the strip to edit the base layer, sample colors from selected keys, or apply a recipe. Unsaved edits have their own preview in the editor. Saving preserves the slot's existing indicator layers.
- **Keymap** reads base and Fn layers and supports binding search and keystroke capture. A layer inherited from the first slot is editable from that slot.
- **Advanced keys** edits Dynamic Keystroke, Mod Tap, Toggle Key, Rappy Snappy, and Snappy Tappy. The editor shows actions by key and layer.
- **Monitor** reads physical key positions, 10-bit travel, and actuation on the newer analog interface. Millimeters use the switch and spacer data supplied by the keyboard. The monitor reports percent when it lacks that data. Select keys to compare their recorded peaks and export the results as CSV. Demo mode simulates travel from key presses.
- **Profiles** switches onboard slots on supported firmware and saves browser-local profiles and portable JSON presets. Presets are specific to a model, physical layout, and layer.
- **Device** shows available HID capabilities and the model library.

Edits are staged in the browser with undo and redo. **Review & save** lists the sections before a device write. The editor checks the active slot and the original bytes before sending changes, then checks the device's read-back. If a write fails partway, read the keyboard again to reconcile the current state.

## Compatibility

| Keyboard | Offline workspace | Onboard editing |
| --- | --- | --- |
| One, Two, Two Lekker, Two HE AVR, 60HE AVR | ANSI and ISO | Local profiles, with static RGB preview and analog travel where the USB interfaces support them |
| Two HE ARM, 60HE ARM, 60HE+ | ANSI and ISO | ARM profile format, subject to firmware and successful device read |
| 60HE v2, 80HE+ | ANSI, ISO, and split-space variants | ARM profile format, subject to firmware and successful device read |
| 80HE | ANSI, ISO, and JIS | ARM profile format, subject to firmware and successful device read |
| UwU and UwU RGB | Keypad | ARM profile format, subject to firmware and successful device read. RGB is available on the RGB model |

Onboard configuration is experimental and requires ARM firmware 2.10 or newer, with a recognized layout and compatible profile replies. Lighting core and advanced keys currently support the first onboard slot and single-report messages. Legacy or unsupported connections can still use local profiles. An 80HE running firmware 2.14.2 supplied read-only fixtures. Simulated devices exercised writes and read-back failures. Firmware updates, calibration, gamepad mapping, system settings, and linked profiles are outside this release.

80HE and 80HE+ lightbar settings save to the active slot when firmware supplies a compatible lightbar profile. The editor changes that slot's base look and keeps its existing conditional effects and global profile data.

## Build and run

The web editor has no package dependencies. Serve `docs/` on HTTPS or localhost. GitHub Pages publishes it directly.

With [Go 1.24 or newer](https://go.dev/doc/install) on Windows:

```powershell
go build -trimpath -ldflags "-s -w -H=windowsgui" -o OpenWootility.exe .
```

For local development, run `go run . -serve` and open [localhost:8769](http://localhost:8769) in Edge or Chrome.

Run `node --test` to check analog report parsing, per-switch travel conversion, and lightbar profile encoding.

## Interoperability and credits

OpenWootility contains its own application code and artwork. It is independent of Wooting Technologies B.V. and uses the product names to identify compatible hardware. The implementation references the public [Wooting RGB SDK](https://github.com/WootingKb/wooting-rgb-sdk), [Wooting Analog SDK](https://github.com/WootingKb/wooting-analog-sdk), [Wooting WebHID analog example](https://github.com/WootingKb/switchy-tax-fraud/blob/main/src/components/ConnectDevice.tsx), and [OpenMouse ARM protocol notes](https://github.com/OpenMouse-Project/keyboard-protocol/blob/3f9158fe83d7d04ae0b86e4ff26442359ec177c7/docs/wooting-support.md). This project is under the [MIT License](LICENSE).
