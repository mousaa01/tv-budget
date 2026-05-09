# TV Budget — Samsung Tizen sideload

This packages the app as a **hosted web widget** for Samsung Smart TVs. The widget is a tiny shell — actual app code lives at https://tv-budget.vercel.app and updates automatically when you push to GitHub. Sideload once, never again.

**Confirmed target:** UN58TU7000FXZC (2020, Tizen 5.5).

---

## One-time setup (~30 min)

### 1. Install Tizen Studio

Download from https://developer.tizen.org/development/tizen-studio/download (pick the "with IDE" installer, ~600 MB).

After install, open **Package Manager** and install:
- **Tizen Studio → 5.5 Tizen TV Extensions** (under "Extension SDK" tab)
- **Samsung Certificate Extension** (under "Extension SDK" tab)

### 2. Create a Samsung certificate

1. Open Tizen Studio → menu **Tools → Certificate Manager**
2. Click **+** → **Samsung** → **TV** → enter any name (e.g. `tvbudget`)
3. Author certificate: any name, password — **save the password**
4. Distributor certificate: pick **TV** profile, sign in with your Samsung account, type your TV's DUID (you'll get this in step 3)

### 3. Put the TV in developer mode

On the TV:
1. Open the **Apps** screen
2. Type `12345` on the on-screen keypad (or remote number keys) — a Developer Mode dialog appears
3. Toggle **Developer Mode** = ON
4. Enter your PC's **IP address** (find on PC with `ipconfig` → IPv4)
5. Reboot the TV

To find DUID: in Tizen Studio → **Device Manager** → connect to the TV → right-click → **DUID**. Paste that DUID back into the distributor cert step above.

### 4. Connect to TV from Tizen Studio

1. Tizen Studio → **Device Manager** (the icon that looks like a screen with arrows)
2. Click **Remote Device Manager** → **+** → enter TV IP, port `26101` → **Add**
3. Toggle **Connection** = ON. The TV may pop up a "Allow connection?" prompt — accept it.

---

## Build & install the .wgt

From the project root:

```powershell
npm run build:tizen
```

That runs `node scripts/package-tizen.js` which produces `tizen/TVBudget.wgt` (a zip of `config.xml` + `icon.png`).

Then in Tizen Studio:

1. **File → Import → Tizen → Tizen Project** → pick the `tizen/` folder
2. Right-click the imported project → **Properties → Tizen Signing Profile** → select your `tvbudget` profile
3. Right-click → **Build Signed Package**
4. Right-click → **Run As → Tizen Web Application** (with your TV selected as the target device)

The "TV Budget" icon now appears on the TV's **Apps** row, alongside YouTube/Netflix.

> **Tip:** If you skip the IDE entirely, you can sign + install via CLI:
> ```powershell
> tizen package -t wgt -s tvbudget -- tizen
> tizen install -n tizen/TVBudget.wgt -t <TV-device-name>
> ```
> (Add `C:\tizen-studio\tools\ide\bin` to PATH first.)

---

## Updating the app

Just push to GitHub. Vercel redeploys, and the next time you launch "TV Budget" on the TV, it loads the new code. **No re-sideload needed.**

The only time you'd repackage the .wgt is if you change `tizen/config.xml` or the icon.

---

## Troubleshooting

- **"Application install failed (115)"** = certificate not trusted. Re-do the distributor cert with the correct DUID.
- **Black screen on launch** = network problem. The TV must reach `tv-budget.vercel.app`. Test with the Internet app first.
- **OAuth sign-in loops** = Google needs the redirect URI `https://tv-budget.vercel.app/` whitelisted in the OAuth client. (Already done.)
- **App vanishes from Apps row** = developer-mode certificates expire periodically. Re-create the distributor certificate and reinstall.
