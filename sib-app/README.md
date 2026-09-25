# SIB Kontroll – iPad-app (Expo)

Fjernkontroll for **Sport In The Box** som egen app på iPad (og iPhone/Android).
Appen snakker **direkte** med SIB sitt REST-API på lokalnettet. Det trengs ingen
server eller PC-program i tillegg.

```
iPad (SIB Kontroll)  ──wifi──►  Sport In The Box-API (http://<SIB-PC>:8080)
```

## Funksjoner

| Fane | Hva den gjør |
|---|---|
| **Hurtigknapper** | Alle QuickButtons i gruppene sine, med farge, ikon og hurtigtast. Trykk for å trigge. |
| **Rundown** | Velg rundown, se alle elementer. Trykk på en rad for å kjøre den. Kjør forrige/valgt/neste, flytt markering opp/ned, vis rundownen i SIB. Markeringen følger SIB live (hvert 2. sekund). |
| **Spillelister** | Start fra begynnelsen, fortsett fra sist, eller spill en bestemt fil. |
| **Streaming** | Se strømmer, start og stopp (med bekreftelse før stopp). |
| **Innstillinger** | SIB-adresse, API-passord (lagres i nøkkelringen), spilleliste-ID-er, «hold skjermen våken», og felt for egendefinerte API-kall. |

Vibrasjon (haptikk) og en kort melding bekrefter hver kommando. Tilkoblingsstatus vises øverst.

## Kom i gang på iPaden – raskest med Expo Go

1. Installer **Expo Go** fra App Store på iPaden.
2. På en PC/Mac på samme wifi (med [Node.js](https://nodejs.org) installert):

   ```bash
   cd sib-app
   npm install
   npx expo start
   ```

3. Skann QR-koden med kameraet på iPaden, så åpnes appen i Expo Go.
4. Tillat **Lokalt nettverk** når iPaden spør.
5. Gå til **Innstillinger**, skriv inn IP-adressen til SIB-PC-en (f.eks. `192.168.1.50`;
   port 8080 legges til automatisk), eventuelt passord, og trykk **Lagre**.

> Finn IP-adressen på SIB-PC-en med `ipconfig` i en kommandolinje (IPv4-adresse).
> REST-API-et må være skrudd på i Sport In The Box.

## Egen app på iPaden (uten Expo Go)

Bygg med [EAS](https://docs.expo.dev/build/introduction/) i skyen. Du trenger ikke Mac eller Xcode,
men du trenger en Apple Developer-konto.

```bash
npm install -g eas-cli      # eller bruk npx eas-cli@latest
eas login
eas build --platform ios --profile preview      # intern installasjon (ad hoc) på registrerte iPader
# eller
eas build --platform ios --profile production   # for TestFlight / App Store
eas submit --platform ios                       # last opp til TestFlight
```

Med `preview` ber EAS deg registrere iPaden (`eas device:create`), og du får en lenke du
åpner på iPaden for å installere appen. Med `production` + `eas submit` legges appen i
TestFlight, og den kan installeres derfra.

## Test uten Sport In The Box

`../sib-kontroll/mock-sib.js` etterligner SIB-API-et med eksempeldata fra dokumentasjonen:

```bash
node ../sib-kontroll/mock-sib.js     # port 8080, valgfritt MOCK_PASSWORD=hemmelig
```

Pek appen til IP-adressen til maskinen som kjører mocken, og legg inn spilleliste-ID `1` og `5`.

## Utvikling

```bash
npm run typecheck   # TypeScript
npm run lint        # ESLint
```

```
src/
  app/                  Skjermer (Expo Router)
    _layout.tsx         Rot: innstillinger, holde skjermen våken, toast
    (tabs)/             Fanene: index (hurtigknapper), rundown, playlists, streams, settings
  components/ui.tsx     Felles knapper, statusmerke, toast
  lib/sib.ts            API-klient, stier og typer for SIB REST V2
  lib/store.tsx         App-tilstand: innstillinger, tilkoblingssjekk, kommandoer
```

Merk: iOS-oppsettet i `app.json` tillater vanlig `http` (SIB-API-et har ikke https) og ber om
tilgang til lokalt nettverk.
