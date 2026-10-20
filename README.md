# ⚔️ Runenwacht

Ein endloser Fantasy-Tower-Defense im Browser – für Laptop (Maus/Tastatur) und Tablet (Touch).
Reines HTML/CSS/JavaScript, keine Abhängigkeiten, kein Build-Schritt.

## Spielen

- **Lokal:** `index.html` über einen beliebigen statischen Webserver öffnen, z. B. `npx http-server -p 8123`.
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

- 3 Karten mit steigender Schwierigkeit, Rekorde pro Karte (localStorage)
- 6 Türme mit je 4 Stufen: Bogenschützen, Zwergenkanone, Frostkristall, Sturmturm, Arkaner Turm, Drachenfeuer
- 7 Monsterarten (u. a. Flieger, gepanzerte Golems, heilende Schamanen, sich teilende Schleime)
- Alle 5 Wellen ein Schwarm, alle 10 Wellen ein Boss (Trollkönig, Uralter Drache, Lichkönig)
- Wellen skalieren endlos; frühes Rufen gibt Bonusgold
