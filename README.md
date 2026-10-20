# 💎 Kristallwacht

Ein endloses Fantasy-Verteidigungsspiel mit Reihen-Kämpfen – für Tablet und Laptop,
im **Hoch- und Querformat**. Reines HTML/CSS/JavaScript, keine Abhängigkeiten, keine Bilddateien:
alle Grafiken werden live auf Canvas gezeichnet.

## Spielen

- **Online:** über GitHub Pages (Repo → Settings → Pages → Branch `main`, Ordner `/`).
  Auf dem Tablet danach „Zum Startbildschirm hinzufügen“ – dann läuft es im Vollbild wie eine App.
- **Lokal:** über einen statischen Webserver, z. B. `npx http-server -p 8123`
  (ein Doppelklick auf `index.html` reicht nicht, weil das Spiel JavaScript-Module nutzt).

## So funktioniert's

- Monster kommen in 5 Reihen aus dem Wald und laufen auf die Burgmauer zu. Die Wellen starten von selbst und gehen nahtlos ineinander über.
- Verteidiger kosten **Mana**:
  - **Kristallschürfer** (Gnome) schlagen Kristalle aus dem Boden. Sie stapeln sich neben ihnen – antippen zum Einsammeln. Ist der Stapel voll, machen sie Pause.
  - **Irrlichter** schweben über die Wiese – wer sie fängt, bekommt Mana.
- Karte antippen und dann ein Feld – oder die Karte direkt aufs Feld ziehen. Verteidiger antippen → verbessern (bis Stufe 3) oder entfernen.
- Erreicht ein Monster die Mauer, entlädt sich die **Bannrune** der Reihe und schleudert alle Monster zurück (lädt sich in 3 Wellen wieder auf). Ist sie leer, kostet es ein Herz – nach 3 Herzen ist Schluss.
- Tageszeit wechselt im 10-Wellen-Rhythmus: Tag, Abendrot, Nacht (mit Boss), Morgengrauen.

**Verteidiger (10):** Kristallschürfer, Elfenschützin, Steinwächter (wirft Schaden zurück), Wurzelfessel (hält fest), Frostmagier (zerspringende Eiskristalle), Feuerrune (Bodenfalle), Zwergenarmbrust (durchschlagende Bolzen), Schattenportal (schleudert zurück), Sturmkristall, Drachenwelpe – neue werden im Lauf der Wellen freigeschaltet.

**Monster (12 + 4 Bosse):** Goblin, Helmgoblin, Schattenwolf, Skelettkrieger, Schildork, Riesenfledermaus, Schattenklinge, Goblin-Schamane, Steingolem, Nekromant, Imp, Bergtroll · Bosse: Trollkönig, Uralter Drache, Lichkönig, Dämonenfürst.

**Laptop-Tasten:** `1`–`0` Karten, `Leertaste` Pause, `F` Tempo, `Esc` abbrechen. Mit der Maus sammelt schon das Darüberfahren Irrlichter ein.

## Code

| Datei | Inhalt |
|---|---|
| `src/data.js` | Verteidiger, Monster, Bosse (Werte & Texte) |
| `src/art.js` | Spielfeld, Burgmauer, Verteidiger, Irrlichter, lebendige Umgebung |
| `src/monsters.js` | Monster-Grafiken und Zeichen-Helfer |
| `src/main.js` | Spiellogik, Layout für Hoch/Quer, Licht, Eingabe, Menüs |
