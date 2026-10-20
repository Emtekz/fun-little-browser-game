# 💎 Kristallwacht

Ein endloses Fantasy-Verteidigungsspiel im Stil von *Plants vs. Zombies* – für Tablet und Laptop,
im **Hoch- und Querformat**. Reines HTML/CSS/JavaScript, keine Abhängigkeiten, keine Bilddateien:
alle Grafiken werden live auf Canvas gezeichnet.

## Spielen

- **Online:** über GitHub Pages (Repo → Settings → Pages → Branch `main`, Ordner `/`).
  Auf dem Tablet danach „Zum Startbildschirm hinzufügen“ – dann läuft es im Vollbild wie eine App.
- **Lokal:** über einen statischen Webserver, z. B. `npx http-server -p 8123`
  (ein Doppelklick auf `index.html` reicht nicht, weil das Spiel JavaScript-Module nutzt).

## So funktioniert's

- Monster kommen in 5 Reihen aus dem Wald und laufen auf die Burgmauer zu.
- Verteidiger kosten **Mana**. Manablüten erzeugen Mana-Kristalle, tagsüber fallen auch welche vom Himmel – antippen zum Einsammeln.
- Karte antippen und dann ein Feld – oder die Karte direkt aufs Feld ziehen.
- Verteidiger antippen → verbessern (bis Stufe 3) oder entfernen.
- Erreicht ein Monster die Mauer, rollt der **Wächterfels** der Reihe los (kehrt nach 3 Wellen zurück). Ist er weg, kostet es ein Herz – nach 3 Herzen ist Schluss.
- Wellen werden endlos stärker, alle 10 Wellen kommt nachts ein Boss.

**Verteidiger (10):** Manablüte, Elfenschützin, Steinwächter, Runenfalle, Frostmagier, Feuerrune, Zwergenarmbrust, Dornenranke, Sturmkristall, Drachenwelpe – neue werden im Lauf der Wellen freigeschaltet.

**Monster (12 + 4 Bosse):** Goblin, Helmgoblin, Schattenwolf, Skelettkrieger, Schildork, Riesenfledermaus, Schattenklinge, Goblin-Schamane, Steingolem, Nekromant, Imp, Bergtroll · Bosse: Trollkönig, Uralter Drache, Lichkönig, Dämonenfürst.

**Laptop-Tasten:** `1`–`0` Karten, `Leertaste` Pause, `F` Tempo, `N` nächste Welle, `Esc` abbrechen. Mit der Maus sammelt schon das Darüberfahren Mana ein.

## Code

| Datei | Inhalt |
|---|---|
| `src/data.js` | Verteidiger, Monster, Bosse (Werte & Texte) |
| `src/art.js` | Spielfeld, Burgmauer, Verteidiger, Mana-Kristalle |
| `src/monsters.js` | Monster-Grafiken und Zeichen-Helfer |
| `src/main.js` | Spiellogik, Layout für Hoch/Quer, Licht, Eingabe, Menüs |

## Altes Spiel

Das vorherige Spiel **Runenwacht** (klassischer Tower Defense mit Weg) liegt weiterhin unter [`runenwacht/`](runenwacht/) und ist aus dem Hauptmenü verlinkt.
