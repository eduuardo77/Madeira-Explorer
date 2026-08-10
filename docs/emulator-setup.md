# Turning on the emulator — the one step that needs you

Everything for the Android emulator is downloaded and configured
(`tools/fetch-android-emulator.sh`, run 2026-08-10). It refuses to start for one reason:

```
ERROR | x86_64 emulation currently requires hardware acceleration!
```

**Your CPU supports virtualization; your BIOS has it switched off.** Measured, not guessed:

```
Hyper-V Requirements:  VM Monitor Mode Extensions: Yes      ← the CPU can do it
                       Virtualization Enabled In Firmware: No   ← the BIOS says no
                       Second Level Address Translation: Yes
```

This is a firmware setting. It cannot be changed from inside Windows by any program, including
this one, and it is the only thing standing between the project and seeing its own map.

**Your machine:** Intel Core i5-10400F, ASUS PRIME H410M-R.

---

## Step 1 — enable Intel VT-x in the BIOS (once, ~3 minutes)

Easiest route into firmware, no key-mashing during boot:

**Settings ▸ System ▸ Recovery ▸ Advanced startup ▸ Restart now**, then
**Troubleshoot ▸ Advanced options ▸ UEFI Firmware Settings ▸ Restart**.

(Or press **Delete** repeatedly as the machine powers on — that is the key on ASUS boards.)

Once in the ASUS UEFI:

1. Press **F7** for Advanced Mode if it opens in EZ Mode.
2. **Advanced ▸ CPU Configuration**.
3. Set **Intel (VMX) Virtualization Technology** to **Enabled**.
4. **F10** to save and exit.

Nothing else needs changing. This setting is safe, standard, and used by every virtual machine
and container tool; it is off here only because ASUS ships it that way on some boards.

### Check it worked

```bash
systeminfo | grep -i "Virtualization Enabled"
```

Should now say **Yes**.

---

## Step 2 — install the hypervisor driver (once, needs admin)

Already downloaded to `tools/android-sdk/extras/google/Android_Emulator_Hypervisor_Driver/`.
It is Google's driver, shipped through the official Android SDK manager.

Open a terminal **as Administrator** (right-click Windows Terminal or `cmd` ▸ *Run as
administrator*), then:

```
cd C:\Users\eduar\Desktop\Madeira\tools\android-sdk\extras\google\Android_Emulator_Hypervisor_Driver
```

```
silent_install.bat
```

Success looks like `aehd installed` / `STATE : 4 RUNNING`.

**Alternative if you would rather not install a driver:** enable the Windows feature
*Windows Hypervisor Platform* instead (`Turn Windows features on or off`), then reboot. Either
works; the driver is lighter and does not pull in Hyper-V.

---

## Step 3 — back to me

```bash
bash tools/run-emulator.sh
```

A virtual Pixel 6 should boot. From there the app needs an APK, which needs a free Expo
account — see [dev-build.md](dev-build.md) Path A.

---

## What this gets you, and what it does not

**Does:** the first sight of the map rendering offline from the bundled packs, terrain shading,
Portuguese labels (T-063, D-035, D-036); migrations; permission dialogs; and — by replaying a
GPX route through the emulator's location controls — the whole recorder, including the sampling
gate (T-034) and the geofence reshuffle (T-039, T-076).

**Does not:** battery (T-054), OEM background killers, force-quit relaunch, barometer, real GPS
noise, or anything iOS. Those need real hardware — see [dev-build.md](dev-build.md) paths B
and C. CONTEXT §6.6 is unchanged by any of this.
