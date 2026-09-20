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

## To PC-er: sette opp en delt nettverksmappe

Bassengfoto er laget for å kjøre på **samme PC** som Sport In The Box (SITB),
med output-mappen lagret lokalt på den maskinen — det er den anbefalte og mest
driftssikre løsningen (ingen nettverksavhengighet under stevnet).

Hvis fotostasjonen likevel må stå på en **annen PC** enn den som kjører SITB,
kan du dele output-mappen over nettverket (SMB). Sett opp delingen **på
forhånd**, ikke under stevnet, og test at bilder faktisk dukker opp i SITB før
konkurransen starter.

### 1. Del ut mappen på PC-en som kjører SITB ("server")

**Windows:**
1. Høyreklikk mappen SITB leser bilder fra → **Egenskaper** → fanen **Deling**
   → **Avansert deling...**
2. Kryss av **Del denne mappen**, gi den et enkelt navn (f.eks. `SITB-bilder`),
   og trykk **Tillatelser** → gi brukeren/gruppen som fotostasjonen skal
   koble til **Full kontroll** (les/skriv), siden Bassengfoto skal skrive
   filer inn i mappen.
3. Under fanen **Sikkerhet**, kontroller at samme bruker/gruppe har
   Endre/Skriv-rettigheter på selve filsystemnivået (ikke bare delingsnivået).
4. Noter maskinnavnet eller den lokale IP-adressen (`ipconfig` i en
   kommandolinje), f.eks. `\\SITB-PC\SITB-bilder` eller `\\192.168.1.50\SITB-bilder`.
5. Sørg for at Windows-brannmuren tillater "Fil- og skriverdeling" på det
   nettverket dere bruker (helst et eget, lukket stevne-nettverk/switch —
   ikke åpent wifi).

**Mac:**
1. **Systeminnstillinger → Generelt → Deling** (eller **Deling** i eldre
   macOS) → skru på **Fildeling**.
2. Legg til mappen under **Delte mapper**, og gi fotostasjon-brukeren
   **Lese og skrive**-tilgang.
3. Bruk `smb://<mac-ens-navn-eller-IP>/<mappenavn>` fra fotostasjonen.

### 2. Koble til mappen fra fotostasjon-PC-en ("klient")

**Windows:**
1. Åpne Filutforsker → **Denne PC-en** → **Tilknytt nettverksstasjon**.
2. Skriv inn stien (`\\SITB-PC\SITB-bilder`), kryss av **Koble til på nytt ved
   pålogging**, og logg på med brukeren som har tilgang om det spørres om.
3. Den tilkoblede stasjonen (f.eks. `Z:\`) vises nå som en vanlig mappe.

**Mac:**
1. Finder → **Gå til → Koble til server...** (⌘K).
2. Skriv `smb://<SITB-PC-ens-navn-eller-IP>/<mappenavn>` → **Koble til** →
   logg på.
3. Monter gjerne stasjonen ved oppstart (Systeminnstillinger → Brukere og
   grupper → Innloggingsobjekter) så den alltid er tilgjengelig.

### 3. Pek Bassengfoto til den tilkoblede mappen

I Bassengfoto → **Innstillinger** → **Velg mappe...**, naviger til den
tilkoblede nettverksstasjonen/mappen (f.eks. `Z:\` på Windows eller den
monterte mappen under `/Volumes/` på Mac) og velg den som output-mappe.

### Ting å tenke på med nettverksdeling

- **Test i god tid før stevnet.** Ta et testbilde og bekreft at det dukker
  opp i SITB fra den andre maskinen.
- **Stabilt, lukket nettverk.** Bruk kablet nettverk eller et dedikert
  stevne-wifi/switch — ikke del over åpne/offentlige nett. Ustabil wifi kan
  gi trege eller mislykkede skrivinger midt i et løp.
- **Rettigheter.** Bassengfoto må ha skrive-tilgang til mappen; hvis lagring
  feiler, er dette den vanligste årsaken (se feilmeldingen som vises i UI).
- **SITB må lese fra samme sti.** Sørg for at SITB peker på den delte mappen
  sett fra sin egen maskin (ofte den lokale stien på server-PC-en, siden SITB
  som regel kjører på samme maskin som deler ut mappen).
- Reserveplan: ha USB-minnepenn klar for manuell filoverføring hvis nettverket
  skulle falle ut under stevnet.

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
