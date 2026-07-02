# MIDI-Integrationsplan: SuperRack Router als natives MIDI-Gerät

**Status:** Recherche- und Planungsdokument (keine Implementierung)
**Stand:** 2026-07-02
**Branch:** `micha/midi-connector`

## Ziel

Das Modul soll auf dem System als eigenes MIDI-Gerät erscheinen — mindestens ein Input- und ein Output-Port mit eigenem Namen (z. B. „SuperRack Router In" / „SuperRack Router Out") — sodass DAWs und MIDI-Hosts (Cubase, Reaper, Ableton, Waves SuperRack selbst) es direkt als Gerät auswählen können, ohne dass der Nutzer vorher loopMIDI oder ähnliche virtuelle Kabel einrichten muss.

---

## Phase 0 — Bestandsaufnahme

### Sprache, Framework, Runtime, Zielplattformen

| Aspekt | Befund | Quelle im Repo |
|---|---|---|
| Sprache | JavaScript (CommonJS), kein TypeScript | alle `.js`-Dateien |
| Framework | Bitfocus-Companion-Modul, `@companion-module/base` ~1.12.1 | `package.json` |
| Runtime | Node.js ≥18 <23 (`engines`), Manifest-Runtime `node22`, API `nodejs-ipc` 4.0.0 | `package.json`, `companion/manifest.json` |
| Host-Anwendung | Bitfocus Companion ≥ 4.0.0 | `companion/manifest.json` (`compatibility.minimumCompanionVersion`) |
| Zielplattformen | Überall, wo Companion läuft: Windows, macOS, Linux (inkl. Raspberry Pi). Eine minimale OS-Version ist nirgends im Repo festgelegt. | — |
| Weitere Abhängigkeiten | `fastify` ^5.6.2, `@fastify/static` 8 (HTTP-UI) | `package.json` |

> **OF-1 (beantwortet 2026-07-02):** Zielplattformen sind **Windows und macOS**. macOS ist mit virtuellen CoreMIDI-Ports (Welle 1) vollständig bedient; für Windows ist Welle 3 (Windows-MIDI-Services-Backend) priorisiert, bis dahin gilt der dokumentierte loopMIDI-Weg. Linux bleibt über das rtmidi-Backend nutzbar, ist aber keine Zielplattform.

### Prozessmodell und Threading

- Das Modul läuft als **Child-Prozess von Companion** (`nodejs-ipc`), Single-Thread-Event-Loop, kein Worker-Threading.
- Lebenszyklus über die Companion-API in `main.js` (Klasse `ModuleInstance`): `init(config)` → `configUpdated(config)` → `destroy()`. `destroy()` stoppt heute bereits sauber den HTTP-Server (`stopHttpServer`), `configUpdated()` kann den HTTP-Server bei Portwechsel neu starten (`main.js:58–90`).
- **Kein DI-Container.** Das „DI-Muster" des Projekts ist der Modul-Instanz-Kontext: Feature-Module (`actions.js`, `feedbacks.js`, `variables.js`) sind Funktionen, die `self` (die Instanz) erhalten. Eine MIDI-Schicht würde demselben Muster folgen.

### Bestehende Geräte-/Hardware-Anbindungen als Vorbild

- **Es gibt heute keine native Hardware-Anbindung.** MIDI wird indirekt gelöst: `_sendMidiStep()` (`main.js:238–268`) bzw. `applyMidiStepToVariables()` (`lib/midi-map.js:50–79`) schreiben die zu sendende Nachricht in Companion-Variablen (`midi_last_type`, `midi_last_channel`, `midi_last_controller`, `midi_last_value`, `last_action_timestamp`). Ein Companion-Trigger reagiert auf `last_action_timestamp` und lässt eine **Generic-MIDI-Instanz** die Nachricht tatsächlich senden (dokumentiert in `README.md`, „Example: Using with Generic-MIDI").
- **Bestes strukturelles Vorbild im Repo:** der Fastify-HTTP-Server (`ui/http.js`) — ein verwalteter Dienst mit `startHttpServer(instance)`/`stopHttpServer(instance)`, Restart-Guard (`_http.restarting`) und Port-Konfiguration. Ein `MidiService` sollte exakt diesem Lebenszyklus-Muster folgen.

### Build-, Installer- und CI-Pipeline

- `pr-unit-test.yaml`: Corepack/Yarn 4, `yarn install --immutable`, Jest (38 Tests).
- `release-on-version-change.yaml`: baut bei Versionswechsel ein `.tgz` via `companion-module-build` und erstellt ein GitHub-Release.
- **Kein Installer, keine Toolchain für native Abhängigkeiten.** Eine native Dependency (N-API-Addon) ist nur praktikabel, wenn sie **Prebuilds für alle Zielplattformen** mitbringt — ein Kompilieren beim Nutzer scheidet aus (Companion lädt Module als fertige Pakete).
- Governance-Hinweis: `.github/copilot-instructions.md` verlangt minimale Dependencies und warnt vor nativen Bindings. Präzedenzfall dagegen: das **offizielle** `companion-module-generic-midi` nutzt selbst das native `@julusian/midi` (siehe Phase 2) — native MIDI-Bindings sind im Companion-Ökosystem also akzeptiert.

### Fachliche Andockpunkte für MIDI

**Ausgehend (App → MIDI out):**

| App-Ereignis | Heutiger Weg | Künftig direkt senden |
|---|---|---|
| `routeRack(rackId)` → `_executeSequence()` (`main.js:317–378`) | Variablen + Generic-MIDI | Sequenz aus Snapshot-CC + Plugin-CC direkt auf den Out-Port |
| `routeSnapshot(snapshotId)` (`main.js:329`) | dito | einzelner CC |
| `routePlugin(pluginId)` (`main.js:340`) | dito | einzelner CC |
| Mapping-Update über HTTP-UI (`ui/http.js` `/patch/update`) | keins | optional: Bestätigungs-/Sync-Nachricht |

Die Nachrichtentypen sind bereits definiert und validiert: `cc`, `noteon`, `program` mit Kanal 1–16, Datenbytes 0–127, optionalem `delay` (`lib/midi-map.js:1–32`, `validateRackMidiMap`). Schrittabstand `MIDI_STEP_DELAY_MS = 50` (`main.js:10`).

**Eingehend (MIDI in → App):**

| Eingehende Nachricht | Auszulösende Aktion | Vorhandene Logik |
|---|---|---|
| Note On / CC auf konfiguriertem Kanal, Wert = Kanalnummer | Rack-Routing über Channel→Rack-Lookup | exakt die `trigger_channel`-Callback-Logik (`actions.js:47–101`) — heute per Companion-Variable gefüttert, künftig direkt vom In-Port |
| CC/Program (konfigurierbar) | direkte Anwahl Rack / Hot Snapshot (1–6) / Hot Plugin (1–12) | `routeRack`/`routeSnapshot`/`routePlugin` |
| optional: beliebige Nachricht | Feedback-Anzeige (z. B. `sequence_running` als Status zurücksenden) | `feedbacks.js` |

---

## Phase 1 — Technische Optionen pro Plattform

### Windows

#### Option W1: Windows MIDI Services (Microsoft, Rollout 2026)

Aktueller Stand (geprüft 2026-07-02):

- **Rollout:** Windows MIDI Services wird seit **Februar 2026** an Retail-Windows-11 ausgerollt (Versionen **24H2, 25H2, 26H1**; KB5077181, gestaffelter Rollout über ~30 Tage). **Windows 10 wird nicht unterstützt.**
  Quellen: [Windows Experience Blog, 17.02.2026](https://blogs.windows.com/windowsexperience/2026/02/17/making-music-with-midi-just-got-a-real-boost-in-windows-11/), [DevBlog „rollout – known issues and workarounds"](https://devblogs.microsoft.com/windows-music-dev/windows-midi-services-rollout-known-issues-and-workarounds/), [microsoft.github.io/MIDI](https://microsoft.github.io/MIDI/)
- **App SDK:** Das SDK (Runtime + Tools, out-of-band ausgeliefert, seit 01.03.2026 mit verbessertem Settings-App-Installer) erlaubt Apps die **programmatische Erzeugung von Endpoints, insbesondere Virtual Device Endpoints und Loopback-Endpoints**. Eine App kann damit ein vollwertiges MIDI-2.0-„Gerät" sein.
  Quellen: [SDK-Übersicht](https://microsoft.github.io/MIDI/sdk-overview/), [Get Latest](https://microsoft.github.io/MIDI/get-latest/), [Releases microsoft/MIDI](https://github.com/microsoft/MIDI/releases)
- **Sichtbarkeit für MIDI-1.0-Hosts (die entscheidende Frage):** Die klassischen WinMM- und WinRT-MIDI-1.0-APIs wurden auf den neuen MIDI-Service „umgeleitet". Alte DAWs sehen dadurch **auch die von Apps erzeugten virtuellen Endpoints** (automatische Übersetzung MIDI 2.0 → MIDI 1.0 im Service) und profitieren von Multi-Client-Betrieb. Die alten APIs können virtuelle Geräte nur nicht selbst *erzeugen* — genau dafür braucht man das neue SDK.
  Quellen: [Application Backwards Compatibility](https://microsoft.github.io/MIDI/kb/api-back-compat/), [Overview](https://microsoft.github.io/MIDI/overview/)
- **Problem für diesen Stack:** Das SDK ist WinRT-basiert mit offiziellen Projektionen für **C++ und C#**. Eine **offizielle Node.js-Projektion existiert nicht** — andere Sprachen müssen selbst eine WinRT-Projektion erzeugen. Nutzung aus diesem Modul heraus erfordert also entweder ein eigenes N-API-Addon (C++) oder einen kleinen Helper-Prozess (C#/C++), der die virtuellen Endpoints hält.
  Quelle: [SDK-Übersicht, Abschnitt Projektionen](https://microsoft.github.io/MIDI/sdk-overview/)
- **Bekannte Rollout-Probleme:** Es gibt dokumentierte Kompatibilitätsprobleme einzelner Anwendungen während des Rollouts (z. B. Serato bei 24H2/25H2). Für einen Plan heißt das: Feature-Detection statt Annahme, dass der Service da ist.
  Quellen: [DevBlog known issues](https://devblogs.microsoft.com/windows-music-dev/windows-midi-services-rollout-known-issues-and-workarounds/), [Serato-Support-Artikel](https://support.serato.com/hc/en-us/articles/15499410006543)

#### Option W2: teVirtualMIDI / virtualMIDI SDK (Tobias Erichsen)

- Technisch etabliert (Treiber, frei benennbare Ports), **aber:** Die Software ist nur für private, nicht-kommerzielle Nutzung frei. **Jede Verteilung mit eigener Software erfordert vorherige schriftliche Genehmigung/kommerzielle Lizenz** (individuell zu verhandeln; für Lizenznehmer gibt es ein MSI-Merge-Modul).
  Quellen: [virtualMIDI SDK](https://www.tobias-erichsen.de/software/virtualmidi/virtualmidi-sdk.html), [virtualMIDI](https://www.tobias-erichsen.de/software/virtualmidi.html)
- Für ein MIT-lizenziertes Open-Source-Companion-Modul ist das ein erhebliches Lizenz- und Distributionsrisiko → **bekannter Stolperstein, bestätigt**.

#### Option W3: loopMIDI als dokumentierte externe Abhängigkeit (Fallback)

- Nutzer installiert [loopMIDI](https://www.tobias-erichsen.de/software/loopmidi.html) selbst und legt einen Port an; das Modul öffnet diesen Port per Name. Kein eigenes Gerät, aber überall verfügbar (auch Windows 10). Einschränkungen: Ports existieren nur, solange loopMIDI läuft; pro Benutzer; manueller Einrichtungsschritt.

#### Bewertung Windows 10 vs. Windows 11

- **Windows 11 (24H2+):** Mittelfristig ist Windows MIDI Services der richtige Weg — echtes virtuelles Gerät, sichtbar auch für alte WinMM-DAWs. Kurzfristig fehlt die Node.js-Anbindung; der Aufwand (eigenes Addon/Helper) ist deutlich höher als alles andere in diesem Plan.
- **Windows 10:** Es gibt **keinen** lizenzrechtlich sauberen Weg, ohne Treiber-Drittsoftware ein virtuelles Gerät zu erzeugen. loopMIDI (dokumentiert, vom Nutzer installiert) ist hier die realistische Option — dasselbe, was alle vergleichbaren Tools tun (Phase 2).

### macOS

- **CoreMIDI virtuelle Sources/Destinations sind nativ und treiberlos.** Über RtMidi/`openVirtualPort(name)` kann eine App ohne Admin-Rechte eigene Ports erzeugen, die jede DAW sofort sieht.
  Quellen: [node-midi README (Virtual Ports: „On OS X and Linux ALSA…")](https://github.com/justinlatimer/node-midi), [RtMidi-Issue #332](https://github.com/thestk/rtmidi/issues/332)

### Linux

- **ALSA virtuelle Ports** funktionieren analog über RtMidi/`openVirtualPort(name)`; alternativ Kernel-Modul `snd-virmidi` (hier unnötig, da die App die Ports selbst erzeugen kann).
  Quelle: [node-midi README](https://github.com/justinlatimer/node-midi)

### Bibliotheken passend zum Stack (Node.js)

| Bibliothek | Virtuelle Ports Win / mac / Linux | Lizenz | Wartung | Paketquelle | Anmerkung |
|---|---|---|---|---|---|
| **`@julusian/midi`** (RtMidi-Wrapper, Fork von node-midi) | ✗ / ✓ / ✓ | MIT | aktiv gepflegt, Prebuilds für gängige Plattformen | [npm](https://www.npmjs.com/package/@julusian/midi), [GitHub](https://github.com/Julusian/node-midi) | Maintainer ist Companion-Core-Entwickler; wird vom offiziellen generic-midi-Modul genutzt → **erste Wahl** |
| `midi` (originales node-midi) | ✗ / ✓ / ✓ | MIT | stagnierend | [npm](https://www.npmjs.com/package/midi), [GitHub](https://github.com/justinlatimer/node-midi) | von `@julusian/midi` abgelöst |
| `easymidi` | wie darunterliegendes node-midi | MIT | mäßig | [GitHub](https://github.com/dinchak/node-easymidi) | Convenience-Layer, bringt keine neuen Fähigkeiten |
| `node-rtpmidi` | Netzwerk statt lokaler Ports | MIT | kaum gepflegt (1 Maintainer, kein Recovery Journal) | [GitHub](https://github.com/jdachtera/node-rtpmidi), [npm](https://www.npmjs.com/package/rtpmidi) | siehe rtpMIDI in Phase 2 |
| Windows MIDI Services App SDK | ✓ (nur Win11 24H2+) | MIT (SDK) | Microsoft, aktiv | [GitHub microsoft/MIDI](https://github.com/microsoft/MIDI/releases) | **kein npm-Paket / keine Node-Projektion** — nur über eigenes N-API-Addon oder Helper-Prozess nutzbar |
| JUCE, DryWetMIDI, NAudio.Midi, python-rtmidi/mido | — | div. | div. | — | passen nicht zum Node.js-Stack dieses Moduls; nur relevant, falls ein separater Helper-Prozess in C++/C#/Python gebaut würde |

**Zentrale RtMidi-Einschränkung (bestätigt):** `openVirtualPort()` ist unter Windows/WinMM **nicht implementierbar** („cannot be implemented in Windows MM MIDI API"). Quellen: [node-midi-Issue #104](https://github.com/justinlatimer/node-midi/issues/104), [rtmidi-Issue #332](https://github.com/thestk/rtmidi/issues/332).

---

## Phase 2 — Vergleich mit existierenden Implementierungen

| Tool | Ansatz pro OS | Bibliothek | Bekannte Schwächen / Lehren |
|---|---|---|---|
| **Bitfocus Companion generic-midi** | Öffnet nur **vorhandene** Ports; Windows: loopMIDI/virtuelle Kabel erforderlich („platform-independent when using virtual ports like LoopMIDI or Bome") | `@julusian/midi` ^3.6.1 ([package.json](https://raw.githubusercontent.com/bitfocus/companion-module-generic-midi/main/package.json)) | Erzeugt selbst **keine** virtuellen Ports — genau die Lücke, die dieses Vorhaben schließen will. Quellen: [Repo](https://github.com/bitfocus/companion-module-generic-midi), [HELP.md](https://github.com/bitfocus/companion-bundled-modules/blob/main/generic-midi/companion/HELP.md), [Companion-Issue #365](https://github.com/bitfocus/companion/issues/365) |
| **Open Stage Control** | macOS/Linux: virtuelle Ports; Windows: dokumentiert loopMIDI | python-rtmidi (Server) | Port-Auswahl über Indexnummern ist fragil; Doku empfiehlt Portnamen ohne Leerzeichen. Quellen: [MIDI-Doku](https://openstagecontrol.ammd.net/docs/midi/midi-configuration/), [Tutorial VI-Control](https://vi-control.net/community/threads/open-stage-control-tutorial-an-alternative-to-lemur-and-touchosc.72643/) |
| **Chataigne / TouchOSC Bridge / MIDI Mixer / OBS-MIDI** | gleiches Muster: nativ virtuell auf macOS/Linux, loopMIDI-Anleitung für Windows | JUCE (Chataigne) bzw. RtMidi-Derivate | Durchgängiges Ökosystem-Muster: **niemand** verteilt teVirtualMIDI mit; alle dokumentieren loopMIDI. Quellen exemplarisch: [Morningstar-Anleitung „Creating Virtual MIDI Ports in Windows"](https://manuals.morningstar.io/mc-midi-controller/creating-virtual-midi-ports-in-windows-os), [Ableton-Hilfe „Setting up a virtual MIDI bus"](https://help.ableton.com/hc/en-us/articles/209774225-Setting-up-a-virtual-MIDI-bus) |
| **rtpMIDI / Network MIDI** | Transport über Netzwerk (Apple-Protokoll; Windows-Treiber von Tobias Erichsen) | `node-rtpmidi` o. ä. | DAW sieht die App erst nach Session-Einrichtung im rtpMIDI-Panel → verlagert den manuellen Schritt nur, löst ihn nicht; Node-Implementierung schwach gepflegt, kein Recovery Journal. Quellen: [node-rtpmidi](https://github.com/jdachtera/node-rtpmidi), [RTP-MIDI Wikipedia](https://en.wikipedia.org/wiki/RTP-MIDI), [McLaren Labs „State of Network MIDI"](https://mclarenlabs.com/blog/2019/09/14/the-state-of-network-midi-2019/) |

**Erkannte Muster (übernehmen):**
1. Virtuelle Ports auf macOS/Linux per RtMidi sind Standard und risikofrei.
2. Auf Windows dokumentieren alle etablierten Tools loopMIDI, statt Treiber zu bündeln.
3. Ports immer über **Namen** identifizieren, nie über Indexnummern (Reihenfolge ändert sich mit jedem Gerät).

**Erkannte Fehler (vermeiden):**
1. Ports erst „on demand" erzeugen → Hosts, die nur beim Start scannen, sehen sie nie. Ports müssen beim App-/Modulstart existieren.
2. Sich auf WinMM-Ein-Client-Verhalten verlassen (ein Port exklusiv belegt) — unter Windows MIDI Services gilt Multi-Client, unter altem WinMM nicht; defensive Fehlerbehandlung beim Öffnen.
3. Harte Abhängigkeit von einem Treiber mit unklarer Lizenz (teVirtualMIDI).

---

## Phase 3 — Bewertung und Entscheidung

### Varianten

**V1 — `@julusian/midi` im Modul: echte virtuelle Ports auf macOS/Linux, loopMIDI-Anbindung auf Windows (Ausbaustufe 1)**
Das Modul erzeugt bei `init()` virtuelle Ports „SuperRack Router In/Out" (macOS/Linux) bzw. öffnet auf Windows per Name einen vom Nutzer angelegten loopMIDI-Port; HELP.md und Config-UI führen durch die Windows-Einrichtung.

**V2 — V1 + Windows-MIDI-Services-Backend (Ausbaustufe 2)**
Zusätzlich ein Backend für Win11 24H2+, das über ein kleines N-API-Addon (C++/WinRT) oder einen mitgelieferten Helper-Prozess (C#) einen Virtual-Device-Endpoint erzeugt. loopMIDI bleibt Fallback für Windows 10 und Win11 ohne ausgerollten Service.

**V3 — teVirtualMIDI**
Verworfen.

### Bewertungsmatrix

| Kriterium | V1 (rtmidi + loopMIDI-Doku) | V2 (+ Windows MIDI Services) | V3 (teVirtualMIDI) |
|---|---|---|---|
| Erscheint als eigenes Gerät | mac/Linux: **ja**; Windows: nein (loopMIDI-Port trägt aber den Wunschnamen) | **ja auf allen aktuellen Plattformen** (Win11 24H2+) | ja |
| Lizenzrisiko | keines (MIT) | keines (SDK MIT) | **hoch** (schriftliche Genehmigung nötig) |
| Wartungsaufwand | niedrig (eine gepflegte Dependency mit Prebuilds) | mittel–hoch (eigenes natives Addon/Helper, CI-Signierung, Rollout-Feature-Detection) | mittel + rechtlich |
| Latenz | RtMidi lokal: vernachlässigbar; loopMIDI: vernachlässigbar | Service-basiert, für Steuer-CCs unkritisch | gering |
| Kompatibilität MIDI-1.0-Hosts | voll (loopMIDI/CoreMIDI/ALSA sind MIDI 1.0) | voll — Service übersetzt virtuelle Endpoints für WinMM-Apps ([Beleg](https://microsoft.github.io/MIDI/kb/api-back-compat/)) | voll |
| Aufwand Installer/CI | nahezu null (Prebuilds vorhanden) | hoch (zweite Toolchain, Codesigning, Win-only-Testmatrix) | mittel |
| Windows-10-Nutzer | abgedeckt (loopMIDI) | abgedeckt (Fallback V1) | abgedeckt |

### Empfehlung

**V1 jetzt, V2 als klar abgegrenzte spätere Ausbaustufe.**

Begründung: V1 liefert das Ziel auf macOS/Linux vollständig und auf Windows den im gesamten Ökosystem etablierten Weg — mit einer einzigen, im Companion-Umfeld bereits bewährten MIT-Dependency (`@julusian/midi`, dieselbe wie im offiziellen generic-midi-Modul) und ohne CI-Umbau. V2 ist der einzige Weg zu einem „echten" Gerät unter Windows, hängt aber an (a) der Verbreitung von Win11 24H2+ bei den Zielnutzern (→ OF-1) und (b) einem eigenen nativen Addon, für das es noch keine fertige Node-Anbindung gibt. Diese Investition sollte erst erfolgen, wenn OF-1 zeigt, dass Windows dominiert, und der Service-Rollout bei den Nutzern angekommen ist. V3 scheidet wegen der Lizenzlage aus.

---

## Phase 4 — Umsetzungsplan

### Architektur: `MidiService` mit Backend-Abstraktion

Neue Datei `lib/midi-service.js`, nach dem Muster von `ui/http.js`:

```
lib/midi-service.js
  startMidiService(instance)   // in init() nach startHttpServer
  stopMidiService(instance)    // in destroy() vor/nach stopHttpServer
  Backend-Auswahl:
    'rtmidi-virtual'  → macOS/Linux: openVirtualPort('SuperRack Router In/Out')
    'rtmidi-open'     → Windows: openPort(byName) auf loopMIDI-Port
    'winmidisvc'      → (Ausbaustufe 2, Win11 24H2+)
    'none'            → heutiges Verhalten (nur Variablen) als Rückfallebene
```

- Kein neues DI-Konstrukt: `instance._midi = { backend, input, output, started, restarting }` analog `instance._http`.
- `_sendMidiStep()` (`main.js:238`) bekommt einen zusätzlichen Pfad: wenn `instance._midi.started`, Nachricht direkt senden; Variablen werden **weiterhin** gesetzt (Abwärtskompatibilität mit bestehenden Generic-MIDI-Setups — kein Breaking Change).
- Eingehende Nachrichten: Callback des In-Ports parst Note/CC/Program und ruft die bestehende Routing-Logik auf; die Channel→Rack-Auflösung wird aus dem `trigger_channel`-Callback (`actions.js:47–101`) in eine testbare Funktion (z. B. `lib/midi-map.js: resolveRackForChannel(rackMap, channel)`) extrahiert.
- Neue Config-Felder in `getConfigFields()`: MIDI aktiv (ja/nein), Backend/Portname, Eingangs-Kanal + Nachrichtentyp fürs Trigger-Mapping. `configUpdated()` startet den Service bei Änderungen neu (Guard wie `_http.restarting`).
- Dependency: `@julusian/midi` (^3.6.1). Prebuild-Abdeckung für alle Companion-Zielplattformen (inkl. ARM/Raspberry Pi) ist in Welle 1 explizit zu verifizieren.

### Port-Lebenszyklus

- **Erzeugen beim Modul-`init()`** — nicht lazy. Grund: Hosts lesen die Portliste häufig nur beim eigenen Start ein (Phase 2, Fehler 1). Dokumentierte Konsequenz für Nutzer: *Companion (mit diesem Modul) vor der DAW starten*; nach Modul-Neustart in Companion muss die DAW-Portverbindung ggf. neu geöffnet werden — in HELP.md aufnehmen.
- **Benennung:** fest `SuperRack Router In` / `SuperRack Router Out` (+ optionales Suffix bei mehreren Instanzen, z. B. Instanzlabel). Immer Name-Matching, nie Port-Index.
- **Neustart/`configUpdated()`:** Ports nur schließen/neu erzeugen, wenn sich MIDI-relevante Config geändert hat (gleiche „skip unnecessary churn"-Philosophie wie beim Mapping-Update in `ui/http.js`).
- **Aufräumen in `destroy()`:** `closePort()` + `release/destroy` der nativen Handles, damit Companion-Modul-Restarts keine Zombie-Ports hinterlassen (CoreMIDI/ALSA räumen prozessgebunden auf, aber sauberes Schließen verhindert hängende Client-Verbindungen).
- **Fehlerpfad Windows:** Port nicht gefunden → Status `InstanceStatus.BadConfig` mit Handlungsanweisung („loopMIDI-Port ‚SuperRack Router' anlegen"), kein Crash; Retry bei `configUpdated()`.

### MIDI-Mapping-Konzept

- **Ausgehend:** unverändert das bestehende, validierte Format (`cc`/`noteon`/`program`, `lib/midi-map.js`) — die Sequenzen aus `getMidiSequenceForRack/Snapshot/Plugin` (`main.js:282–314`) werden 1:1 gesendet statt nur in Variablen gespiegelt. Konfigurierbar bleibt alles über die bestehende Patch-UI/`superrack-midi-map.json`-Struktur.
- **Eingehend (konfigurierbar, feste Defaults):**
  - Default: CC auf konfigurierbarem Kanal, Controller-Nummer = „Trigger Channel"-Semantik (Wert = Kanalnummer) → `resolveRackForChannel` → `routeRack`.
  - Optional erweiterbar: Note On 1–64 → Rack 1–64; Program Change 1–6 → Hot Snapshot; Program Change 101–112 (o. ä.) → Hot Plugin. Die genaue Belegung ist Design-Detail von Welle 2 und wird mit den Nutzern abgestimmt (→ OF-4).
- Loop-Schutz: eigene ausgehende Nachrichten dürfen nicht als Eingang re-interpretiert werden (getrennte Ports minimieren das Risiko; zusätzlich kurzes Echo-Fenster verwerfen, falls In/Out auf dasselbe loopMIDI-Kabel zeigen).

### Teststrategie

- **Unit (ohne echte Ports, CI-fähig):** `@julusian/midi` im Jest-Scope mocken (gleiches Muster wie der bestehende Companion-Entrypoint-Mock, siehe Commit „Fix unit tests by mocking Companion entrypoint in test scope" und `createMockInstance()` in den Tests). Testfälle: Backend-Auswahl pro Plattform, Nachrichten-Bytes für cc/noteon/program (Kanal-Offsets!), `resolveRackForChannel`, Lifecycle start→configUpdated→destroy ohne Leaks, Fehlerpfad „Port fehlt".
- **Manuell/Abnahme:** je Plattform eine DAW (Reaper ist überall verfügbar) + MIDI-Monitor (macOS: *MIDI Monitor*, Windows: *MIDI-OX* oder die MIDI-Services-Console, Linux: `aseqdump`): (1) Ports sichtbar nach Companion-Start, (2) Route-Rack-Button sendet erwartete CC-Folge, (3) eingespielte CC-Nachricht löst Rack-Routing aus, (4) Modul-Restart → Verhalten der DAW-Verbindung dokumentieren.
- **CI:** unverändert Jest; zusätzlich ein Install-Smoke-Job, der `yarn install` + `require('@julusian/midi')` auf win/mac/linux-Runnern prüft (Prebuild-Abdeckung).

### Wellen mit Definition of Done

| Welle | Inhalt | Definition of Done |
|---|---|---|
| **W0 — Klärung** | OF-1–OF-5 beantworten; Prebuild-Matrix von `@julusian/midi` gegen Companion-Zielplattformen prüfen. *Stand: OF-1 beantwortet (Windows + macOS), Prebuild-Matrix geprüft (win32/darwin x64+arm64 vorhanden) — Go für W1 erteilt.* | Antworten dokumentiert; Go/No-Go für W1 |
| **W1 — MIDI-Out** | `lib/midi-service.js` (Backends `rtmidi-virtual`/`rtmidi-open`/`none`), Senden in `_sendMidiStep`, Config-Felder, HELP.md-Abschnitt inkl. loopMIDI-Anleitung | Virtuelle Ports auf macOS/Linux in DAW sichtbar; Windows-Weg über loopMIDI dokumentiert und getestet; alle Alt-Tests grün; neue Unit-Tests für Service-Lifecycle und Byte-Encoding; Variablen-Weg unverändert funktionsfähig |
| **W2 — MIDI-In** | In-Port-Callback, `resolveRackForChannel`-Extraktion, konfigurierbares Eingangs-Mapping, Loop-Schutz | Eingehende CC löst Rack-Routing in einer DAW-Demo aus; Mapping-Logik zu 100 % unit-getestet ohne echte Ports |
| **W3 — Windows nativ (geplant; OF-1 beantwortet: Windows ist Zielplattform)** | `winmidisvc`-Backend: N-API-Addon oder Helper-Prozess gegen Windows MIDI Services App SDK; Feature-Detection + loopMIDI-Fallback. Empfohlener Zuschnitt: kleiner C#-Helper-Prozess (offizielle SDK-Projektion, kein eigener WinRT-Projektionsaufwand), der die Virtual-Device-Endpoints hält und via stdio/IPC mit dem Modul spricht; Voraussetzung ist ein Windows-Build-/Signier-Schritt in CI. Vor Start: Rollout-Reife erneut prüfen (R-2) und OF-2 (Bitfocus-Policy) klären. | Auf Win11 24H2+ erscheint „SuperRack Router" ohne loopMIDI in einer WinMM-DAW; sauberer Fallback auf W1-Verhalten (loopMIDI) auf Windows 10 und Win11 ohne MIDI Services |
| **W4 — Polish** | Feedback-Spiegelung als MIDI-Out (optional), Multi-Instanz-Portnamen, Doku/README-Update, CHANGELOG, Versionssprung | Release-Checkliste (`companion-release-checklist.md`) vollständig erfüllt |

### Risiken und offene Fragen

| # | Risiko / offene Frage | Vorschlag zur Klärung |
|---|---|---|
| OF-1 | ~~**Ziel-OS der Nutzer unbekannt**~~ **Beantwortet (2026-07-02): Zielplattformen sind Windows und macOS.** macOS ist durch W1 (virtuelle CoreMIDI-Ports) vollständig bedient; für Windows ist W3 damit priorisiert (siehe Wellen-Tabelle). Linux bleibt über das rtmidi-Backend funktionsfähig, ist aber keine Zielplattform mehr — OF-3 (Linux-ARM-Prebuilds) ist damit nachrangig. | erledigt |
| OF-2 | **Companion-Modul-Policy für native Dependencies**: `.github/copilot-instructions.md` warnt vor nativen Bindings; offizielle Aufnahme ins Companion-Repo könnte Diskussion erfordern | Präzedenzfall generic-midi (`@julusian/midi`) in der Modul-Einreichung referenzieren; früh Kontakt mit Bitfocus-Maintainer (Julusian ist zugleich Lib-Autor) |
| OF-3 | **Prebuild-Abdeckung** von `@julusian/midi` für alle Companion-Plattformen (insb. Linux-ARM/Raspberry Pi) | In W0 Prebuild-Liste des npm-Pakets prüfen + Smoke-Install auf Ziel-Architekturen |
| OF-4 | **Eingangs-Mapping-Belegung** (welche Note/CC/PC-Nummern die Nutzer erwarten) | Vorschlag aus Phase 4 den Nutzern vorlegen, in W2 finalisieren |
| OF-5 | **Mehrere Modul-Instanzen** gleichzeitig (Portnamens-Kollision) | Instanzlabel als Suffix; in W1 entscheiden |
| R-1 | Hosts sehen neue Ports erst nach eigenem Neustart | Nicht technisch lösbar; Startreihenfolge dokumentieren (HELP.md), Ports bei `init()` statt lazy erzeugen |
| R-2 | Windows-MIDI-Services-Rollout noch jung, bekannte App-Kompatibilitätsprobleme | W3 nur mit Feature-Detection + Fallback; Rollout-Status vor W3-Start erneut prüfen ([known-issues-Blog](https://devblogs.microsoft.com/windows-music-dev/windows-midi-services-rollout-known-issues-and-workarounds/)) |
| R-3 | MIDI-Loop bei In/Out auf demselben virtuellen Kabel | Getrennte Ports als Default, Echo-Unterdrückung, Warnung in Doku |
| R-4 | Breaking Change für bestehende Generic-MIDI-Nutzer | Variablen-Pfad bleibt unverändert bestehen; natives MIDI ist opt-in per Config |

---

## Quellenverzeichnis (geprüft am 2026-07-02)

- Windows MIDI Services: <https://microsoft.github.io/MIDI/> · <https://microsoft.github.io/MIDI/sdk-overview/> · <https://microsoft.github.io/MIDI/overview/> · <https://microsoft.github.io/MIDI/get-latest/> · <https://microsoft.github.io/MIDI/kb/api-back-compat/> · <https://github.com/microsoft/MIDI/releases>
- Rollout Feb. 2026: <https://blogs.windows.com/windowsexperience/2026/02/17/making-music-with-midi-just-got-a-real-boost-in-windows-11/> · <https://devblogs.microsoft.com/windows-music-dev/windows-midi-services-rollout-known-issues-and-workarounds/> · <https://support.serato.com/hc/en-us/articles/15499410006543>
- teVirtualMIDI/loopMIDI: <https://www.tobias-erichsen.de/software/virtualmidi/virtualmidi-sdk.html> · <https://www.tobias-erichsen.de/software/virtualmidi.html> · <https://www.tobias-erichsen.de/software/loopmidi.html>
- RtMidi/node-midi-Virtual-Port-Limitation: <https://github.com/justinlatimer/node-midi/issues/104> · <https://github.com/thestk/rtmidi/issues/332> · <https://github.com/justinlatimer/node-midi>
- `@julusian/midi`: <https://www.npmjs.com/package/@julusian/midi> · <https://github.com/Julusian/node-midi>
- Companion generic-midi: <https://github.com/bitfocus/companion-module-generic-midi> · <https://raw.githubusercontent.com/bitfocus/companion-module-generic-midi/main/package.json> · <https://github.com/bitfocus/companion-bundled-modules/blob/main/generic-midi/companion/HELP.md> · <https://github.com/bitfocus/companion/issues/365>
- Open Stage Control: <https://openstagecontrol.ammd.net/docs/midi/midi-configuration/> · <https://vi-control.net/community/threads/open-stage-control-tutorial-an-alternative-to-lemur-and-touchosc.72643/>
- rtpMIDI/Network MIDI: <https://github.com/jdachtera/node-rtpmidi> · <https://en.wikipedia.org/wiki/RTP-MIDI> · <https://mclarenlabs.com/blog/2019/09/14/the-state-of-network-midi-2019/>
- Virtuelle Kabel allgemein: <https://manuals.morningstar.io/mc-midi-controller/creating-virtual-midi-ports-in-windows-os> · <https://help.ableton.com/hc/en-us/articles/209774225-Setting-up-a-virtual-MIDI-bus>
