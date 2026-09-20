# Bassengfoto

Skrivebordsapp (Electron) for å ta profilbilder av svømmere til scoreboard-systemet
**Sport In The Box**. Appen kjører på samme PC som styrer storskjermgrafikken og
lagrer bildene direkte i mappen Sport In The Box leser fra — ingen sky eller
mobil nødvendig.

## Funksjoner

- **Utøverliste** — importer via CSV-fil eller lim inn tekst (komma/semikolon/tab,
  valgfri overskriftsrad), legg til utøvere manuelt, søk/filtrer, se status
  (fotografert / ikke fotografert) og tidspunkt for siste bilde. Listen lagres
  lokalt i appens datamappe.
- **Filnavn-format** — velg mellom flere formater
  (`[country_short]_[license]`, `[country_short]_[id]`, `[club_name]_[name]`,
  `[license]`, `[id]`) med live forhåndsvisning og varsel om manglende felt.
- **Kamera** — ekte kameratilgang via `getUserMedia`, velg blant alle
  tilkoblede videoenheter (USB-webkamera, capture-kort, innebygd kamera),
  siste valgte kamera huskes. Dra og zoom for å beskjære til kvadrat, og ta
  bilde med mellomromstasten eller museklikk.
- **Grønnskjerm (chroma key)** — skru av/på, plukk nøkkelgrønn-farge direkte
  fra bildet, juster toleranse og kant-utjevning, og velg om
  bakgrunnen skal bli transparent, en valgt farge eller et bakgrunnsbilde.
  Effekten vises i sanntid i forhåndsvisningen.
- **Lagring** — velg output-mappe én gang, og appen skriver PNG-filer
  (600–800 px, transparent hvis grønnskjerm er aktiv) direkte til mappen med
  Node.js `fs`. Appen varsler før en eksisterende fil overskrives.
- **Design** — norsk brukergrensesnitt, lys/mørk modus, store knapper og
  tydelig status tilpasset bruk under et stevne.

## Installere avhengigheter

```bash
npm install
```

## Kjøre appen i utviklingsmodus

```bash
npm run dev
```

(eller `npm start`)

Appen ber om tilgang til kamera første gang — godkjenn dette for at
kameraforhåndsvisningen skal fungere.

## Bygge en installerbar versjon

Legg gjerne inn egne ikonfiler i `build/icon.ico` (Windows) og
`build/icon.icns` (Mac) før du bygger — se `build/README.md`.

```bash
# Windows (.exe via NSIS)
npm run build:win

# Mac (.dmg)
npm run build:mac

# Bygg for gjeldende plattform
npm run build
```

Ferdige installasjonsfiler havner i `dist/`-mappen.

## Bruk

1. Gå til **Innstillinger** og velg output-mappen som Sport In The Box leser
   bilder fra, samt ønsket filnavn-format og bildestørrelse.
2. Importer utøvere via CSV-fil eller ved å lime inn en liste i sidepanelet
   (eller legg til enkeltvis med "+ Legg til").
3. Gå til **Kamera**-fanen, velg riktig kamera fra nedtrekksmenyen, og velg
   en utøver fra listen.
4. Dra i det kvadratiske rasteret for å posisjonere utsnittet, og bruk
   zoom-glidebryteren ved behov.
5. Skru på grønnskjerm-modus om ønskelig, plukk nøkkelgrønn-fargen med
   "Plukk farge fra bilde", og juster toleranse/kant-utjevning.
6. Trykk mellomromstasten eller "Ta bilde"-knappen for å lagre. Appen varsler
   om filen ville overskrive en eksisterende, og bekrefter når bildet er
   lagret.

## Teknisk

- Electron + vanlig HTML/CSS/JS i rendereren (ingen tungt rammeverk).
- `contextBridge`/`preload.js` brukes for trygg IPC mellom renderer og
  Node-siden som leser/skriver filer (utøverliste, innstillinger, bilder).
- Utøverliste og innstillinger lagres som JSON-filer i appens brukerdatamappe
  (`app.getPath('userData')`), og overlever omstart av appen.
- `electron-builder` er satt opp til å pakke appen som `.exe` (Windows,
  NSIS-installer) og `.dmg` (Mac).

## Mappestruktur

```
main.js            Electron main-process (vindu, IPC, filsystem)
preload.js          contextBridge — sikker bro mellom renderer og Node
renderer/
  index.html        UI-oppsett
  style.css         Styling (lys/mørk modus)
  app.js            All applikasjonslogikk (kamera, chroma key, lagring)
build/               Ressurser for electron-builder (ikoner)
```
