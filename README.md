# ⚔️ Runenwacht

Ein endloser Fantasy-Tower-Defense im Browser – für Laptop (Maus/Tastatur) und Tablet (Touch).
Reines HTML/CSS/JavaScript, keine Abhängigkeiten, kein Build-Schritt.

## Spielen

- **Lokal:** über einen statischen Webserver öffnen, z. B. `npx http-server -p 8123` (direkt per Doppelklick auf `index.html` geht es nicht, weil das Spiel JavaScript-Module nutzt).
- **Tablet:** Am einfachsten über GitHub Pages hosten (Repo → Settings → Pages → Branch `main`, Ordner `/`).
  Danach im Tablet-Browser „Zum Startbildschirm hinzufügen“ – dann läuft es im Vollbild wie eine App.

## Steuerung

| Aktion | Tablet | Laptop |
|---|---|---|
| Turm bauen | Turm wählen → Feld antippen → nochmal tippen | Turm wählen (`1`–`6`) → Klick (Shift = mehrere) |
| Turm verbessern / verkaufen | Turm antippen → Buttons | Klick → `U` / `S` |
| Zielmodus | Turm antippen → 🎯 | `T` |
| Meteor | ☄️ → Karte antippen | `M` → Klick |
| Welle / Tempo / Pause | Buttons oben | `N` / `F` / Leertaste |

## Inhalt

- 4 Karten mit eigenem Look: Grüner Hain, Schlangenpass, Frostgipfel, Feuerschlund – mit Bäumen, Felsen, Teichen und Lavaseen (dort kann nicht gebaut werden)
- 6 Türme mit je 4 sichtbaren Ausbaustufen: Bogenschützen, Zwergenkanone, Frostkristall, Sturmturm, Arkaner Turm, Drachenfeuer
- 19 Monsterarten mit Fähigkeiten (fliegen, heilen, teilen, wiederauferstehen, springen, teleportieren, Raserei, Beschwörung, Schutz-Aura) und Resistenzen
- 5 Bosse im Wechsel alle 10 Wellen: Trollkönig, Uralter Drache, Lichkönig, Hydra, Dämonenfürst
- Tag-Nacht-Wechsel mit dynamischem Licht, Wetter (Glühwürmchen, Laub, Schnee, Glut), Partikeleffekte
- Bestiarium, Wellenvorschau und Infokarte bei jedem neuen Gegner
- Grafikeinstellung „Hoch“ / „Schnell“ für schwächere Tablets
- Wellen skalieren endlos; frühes Rufen gibt Bonusgold; Rekorde pro Karte

## Code

| Datei | Inhalt |
|---|---|
| `js/data.js` | Karten, Türme, Gegner (Werte & Texte) |
| `js/art.js` | Sämtliche Grafik – alles prozedural auf Canvas gezeichnet, keine Bilddateien |
| `js/main.js` | Spiellogik, Licht, Eingabe, Oberfläche |
