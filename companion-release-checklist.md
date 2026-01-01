# Bitfocus Companion Modul – Release-Checkliste

⚠️ Diese Checkliste darf **erst nach vollständiger Analyse des gesamten Projektordners**
(absolut aller Dateien und Unterordner) ausgefüllt werden.

---

## Schritt 0 – Vollständige Ordneranalyse (Pflicht)
- [ ] Gesamten Projektordner analysiert
- [ ] Alle Unterordner berücksichtigt
- [ ] Alle Dateien gelesen (Code, Config, Build, Meta)
- [ ] Entry-Points identifiziert
- [ ] Abhängigkeiten vollständig erfasst

---

## Struktur & Architektur
- [ ] Companion v4 Modulstruktur eingehalten
- [ ] Klare Trennung von Logik / Actions / Feedbacks / Variables
- [ ] Kein Dead Code
- [ ] Keine Altlasten oder temporären Dateien
- [ ] Konsistente Dateibenennung

---

## API & Lifecycle
- [ ] `init()` korrekt implementiert
- [ ] `destroy()` vollständig aufräumend
- [ ] Enable / Disable funktioniert ohne Neustart
- [ ] Reconnect-Logik stabil
- [ ] Keine Zombie-States
- [ ] Keine doppelten Event-Listener
- [ ] Keine Memory-Leaks erkennbar

---

## Code-Qualität
- [ ] Saubere Fehlerbehandlung
- [ ] Async-Handling korrekt
- [ ] Keine Hacks oder Quick-Fixes
- [ ] Verständlicher, wartbarer Code
- [ ] Companion-Best-Practices eingehalten

---

## Abhängigkeiten & Lizenzen
- [ ] Jede Abhängigkeit ist notwendig
- [ ] Keine proprietären oder nativen Zwangsabhängigkeiten
- [ ] Lizenz MIT-kompatibel
- [ ] Keine unnötigen Runtime-Dependencies

---

## Manifest & Metadaten
- [ ] Modulname korrekt
- [ ] Hersteller / Vendor sinnvoll
- [ ] Produkt / Gerät eindeutig
- [ ] Versionierung konsistent
- [ ] Mindest-Companion-Version korrekt

---

## Actions / Feedbacks / Variables
- [ ] Eindeutige Benennung
- [ ] UX-tauglich für Endanwender
- [ ] Validierung aller Eingaben
- [ ] Sinnvolle Defaults gesetzt

---

## Dokumentation
- [ ] README vorhanden
- [ ] Actions dokumentiert
- [ ] Feedbacks dokumentiert
- [ ] Variables dokumentiert
- [ ] Getestete Hardware / Software angegeben

---

## Ergebnis
- [ ] Keine kritischen Blocker
- [ ] PR-reif für Core-Review

➡️ **Releasefähig nur bei vollständig erfüllter Checkliste**
