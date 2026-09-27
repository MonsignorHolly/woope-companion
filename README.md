# Woope Companion

Tray-only Electron app for Windows/macOS/Linux that mirrors what you're doing on
[Woope](https://woope.eu) as Discord Rich Presence. No main window - just a tray icon,
a tiny pairing dialog, and a background poll loop.

## Jak to funguje

1. Appka se spáruje s tvým Woope účtem přes jednorázový 6místný kód (viz níže).
2. Každých 15 sekund se appka zeptá Woope API, co právě děláš (`GET /api/companion/presence`).
3. Podle odpovědi nastaví Discord Rich Presence přes lokální Discord RPC (appka k tomu
   potřebuje běžící desktopový Discord klient).

## Spuštění lokálně

Vyžaduje Node.js 20+.

```bash
npm install
npm run dev
```

`npm run dev` appku jednou zkompiluje, pak drží běžící `tsc --watch` a při každé změně v
`dist/` (tedy po každém uloženém souboru) restartuje Electron proces - nejde o pravé hot
module reloading (Electron main proces nejde za běhu "vyměnit"), ale pro vývoj to stačí.

Další skripty:

| Skript | Co dělá |
| --- | --- |
| `npm run build` | Zkompiluje TypeScript + zkopíruje statické renderer soubory do `dist/` |
| `npm start` | Spustí appku ze zkompilovaného `dist/` (bez watch módu) |
| `npm run dist` | Zabuildí a zabalí instalátor přes electron-builder (viz Packaging) |
| `npm run icons:generate` | Přegeneruje placeholder ikony v `assets/tray/` a `build/icon.png` |

### Přepsání Woope API base URL (dev/test)

Appka defaultně míří na `https://woope.eu`. Pro lokální/staging backend nastav env
proměnnou před spuštěním:

```bash
WOOPE_API_BASE=http://localhost:3000 npm run dev
```

(Na Windows PowerShell: `$env:WOOPE_API_BASE="http://localhost:3000"; npm run dev`)

## Discord Application ID

Appka ho **nemá zapečený** - při startu si ho stáhne z Woope
(`GET /api/companion/config`, hodnota z proměnné `DISCORD_CLIENT_ID` na Vercelu). Nový
instalátor proto není potřeba ani při jeho změně. Pro lokální vývoj ho jde přepsat:

```bash
DISCORD_CLIENT_ID=123456789012345678 npm run dev
```

## Párování jedním klikem

Instalátor registruje odkaz `woope-companion://`. Na Woope v Nastavení → Discord
Rich Presence stačí kliknout na **Propojit** a **Otevřít ve Woope Companion** - appka
dostane kód `woope-companion://pair?code=123456` a spáruje se sama. Ruční zadání kódu
zůstává jako záloha (ikona v liště → Zadat párovací kód).

## Vydání nové verze

Instalátory staví a zveřejňuje GitHub Actions (`.github/workflows/release.yml`) do
GitHub Releases tohoto repozitáře - bez dalších tajných klíčů. Stačí zvýšit `version`
v `package.json` a pushnout tag:

```bash
git tag v0.2.0 && git push origin v0.2.0
```

Soubory mají pevné názvy (`Woope-Companion-Setup.exe`, `Woope-Companion.dmg`,
`Woope-Companion.AppImage`), takže odkazy na webu
(`…/releases/latest/download/<soubor>`) vždy vedou na nejnovější verzi.

Instalátory zatím nejsou podepsané: Windows při prvním spuštění ukáže SmartScreen
(„Další informace → Přesto spustit“), macOS vyžaduje otevření přes pravé tlačítko → Otevřít.

### Rich Presence art assets

V Discord Developer Portalu, v sekci **Rich Presence → Art Assets** dané aplikace, appka
očekává tyto klíče (nahraj obrázky přesně pod těmito názvy):

| Asset key | Kde se použije |
| --- | --- |
| `woope_logo` | Velký obrázek (large image) - vždy, ve všech stavech |
| `icon_community` | Malý obrázek (small image) při aktivitě "V komunitě" |
| `icon_blog` | Malý obrázek při aktivitě "Čte blog" |
| `icon_messages` | Malý obrázek při aktivitě "Píše zprávy" |
| `icon_roleplay` | Malý obrázek při aktivitě "Live roleplay" |
| `icon_idle` | Rezervováno pro budoucí použití - aktuálně se stav "idle" v Discordu vůbec
  nezobrazuje (`clearActivity()`), takže se tento klíč zatím nikde nevolá |

Doporučené rozměry podle Discorda: large image alespoň 512×512, small image alespoň
128×128 (obojí čtvercové).

Do té doby, než tam Holly nahraje finální art, appka běží v pořádku i s prázdnou/žádnou
sadou assetů - Discord v tom případě u daného klíče prostě nic nezobrazí.

### Ikona appky (tray + instalátor)

`assets/tray/*.png` a `build/icon.png` jsou aktuálně vygenerované placeholdery (barevná
tečka / kruh - viz `scripts/generate-icons.js`). Nahraď je klidně přímo vlastními PNG
soubory se stejnými názvy:

- `assets/tray/tray-{connected,idle,disconnected}.png` (16×16) + `...@2x.png` (32×32) -
  ikona v system tray podle stavu připojení.
- `build/icon.png` (ideálně 1024×1024, čtvercové) - odsud electron-builder automaticky
  odvodí `.ico`/`.icns`/atd. pro instalátor.

## Párování appky s Woope účtem

1. Na webu Woope se přihlas a otevři
   [Nastavení → Discord Rich Presence](https://woope.eu/settings/discord-rpc).
2. Klikni na "Vygenerovat párovací kód" - dostaneš 6znakový kód platný 10 minut.
3. V appce Woope Companion (tray ikona → "Zadat párovací kód...", nebo se otevře
   automaticky při prvním spuštění) kód zadej a potvrď.
4. Appka kód vymění za dlouhodobý token (`POST /api/companion/pair/exchange`), zašifruje
   ho přes Electron `safeStorage` (OS keychain/DPAPI) a uloží do
   `<userData>/token.enc`. Token se nikam jinam neukládá a v čitelné podobě appku
   neopouští.
5. Odpojit zařízení jde buď z tray menu ("Odpojit zařízení"), nebo na webu ve stejné
   sekci Nastavení (seznam spárovaných zařízení).

## Packaging

Primární target je Windows (NSIS installer) - Holly appku používá primárně tam.
macOS (`dmg`) a Linux (`AppImage`) targety jsou v konfiguraci pro pohodlí, ale nejsou
testované do stejné hloubky.

```bash
npm run dist
```

Výstup (instalátor) skončí v `release/` (ne v `dist/` - tam je zkompilovaný TypeScript,
electron-builder má vlastní output adresář, aby se ty dvě věci nemíchaly).

## Struktura projektu

```
woope-companion/
├── src/
│   ├── main/            # Electron main process
│   ├── preload/         # contextBridge preload pro pairing okno
│   └── renderer/pairing/ # HTML/CSS/TS pro pairing okno
├── assets/tray/          # Tray ikony (placeholder)
├── build/icon.png        # Ikona appky pro electron-builder (placeholder)
└── scripts/               # Build pomocné skripty (generování ikon, kopie statických souborů)
```
