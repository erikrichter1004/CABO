# CABO Online – verbindlicher Funktionsplan

Ziel: **Alle vereinbarten Funktionen und Regeln vollständig implementieren und mit automatisierten Tests absichern**, bevor die grafische Gestaltung und Animationen beginnen. Der Nutzer muss keine Zwischenstände testen.

## Statusdefinitionen

- ✅ **Regellogik abgeschlossen:** Implementierung und automatisierte Bereichstests erfolgreich. Geräteübergreifende Integration wird zusätzlich in Schritt 9 überprüft.
- 🟡 **Teilweise umgesetzt:** Bestehender Code, aber Regeln/Sonderfälle noch nicht vollständig geprüft.
- ⬜ **Offen:** Funktion oder Testabdeckung fehlt.

## Reihenfolge (Stand 21.11.2026)

| Nr. | Bereich | Stand | Abnahmekriterien |
|---|---|---|---|
| 1 | Grundspiel und Kartenaktionen | ✅ Regellogik abgeschlossen | Offizieller 52er-Stapel (0/13 je 2, 1–12 je 4), Verdopplung für größere Partien, validierte Sonderverteilung, private Anfangsblickauswahl, Ziehen, Ablage, Einzeltäusche, identische Mehrfachkarten, Strafkarten, offener Ablagestapel, Nachmischen und Deckende |
| 2 | Spezialfähigkeiten | 🟡 Teilweise umgesetzt | 7/8 eigene Karte, 9/10 fremde Karte, 11/12 blinder Tausch, klassisch/erweitert, verpflichtend/optional, Geheimhaltung und Zeitstopp, gezielte Regeltests |
| 3 | CABO und Schlusszüge | 🟡 Teilweise umgesetzt | Ansage nur nach Zug, kein Rückruf, Ansager gesperrt, 0–3 letzte Züge pro Gegner, Überprüfung bei Pausen/Entfernung, Tests |
| 4 | Punkte und Spielende | 🟡 Teilweise umgesetzt | Erfolgreiche/gescheiterte CABO-Ansage samt Gleichstand, 100→50 einmalig, Kamikaze, Limits und Rundenzahl, wiederholte Stichrunden, Tests |
| 5 | Echtzeit-Multiplayer | 🟡 Teilweise umgesetzt | Host-autoritative, ereignisbasierte Synchronisation, keine widersprüchlichen Zuganzeigen, private Karten, Schutz vor doppelten/veralteten Aktionen, Wiederbeitritt |
| 6 | Gastgeberverwaltung | 🟡 Teilweise umgesetzt | Pausieren, Entfernen, 30-s-Offline-Regel, Wiederaufnahme, zuverlässiger Hostwechsel mit vollständigem Spielfortbestand |
| 7 | Runden- und Zeitsteuerung | 🟡 Teilweise umgesetzt | Ready je aktiver Person, 60-s-Erinnerung, Hostentscheidung ab 90 s, Timerpause, automatische Zeitüberschreitung, Sonderfälle |
| 8 | Gesamtregeltests | ⬜ Offen | Tests sämtlicher vereinbarter Regeln, Fehler-/Grenzfälle, Spielerzahlen 2–8, technische CI |
| 9 | Multiplayer-Integration | ⬜ Offen | Durchgehende Proberunden, mehrere simulierte Clients/Geräte, Abbrüche und Wiederverbindungen; keine bekannten Blocker |

## Abgeschlossene Arbeiten in Bereich 1

- Standard-Kartensatz mit **52 Karten** korrigiert: 0 und 13 je zweimal, 1–12 je viermal. Ab sechs Spielern zwei Standardsätze; bei außergewöhnlich vielen Startkarten notfalls entsprechend skalieren.
- Individuelle Kartenhäufigkeiten werden nachvollziehbar validiert; ungültige oder zu kleine Konfigurationen werden abgelehnt statt stillschweigend durch Standardwerte ersetzt.
- Nachmischen stellt den verdeckten Zustand wieder her und hält die oberste Ablagekarte offen.
- Wiederholte Mehrfachablage im selben Zug verhindert, fehlgeschlagene Ablage beendet den Zug, unbegrenzte Mehrfachablage funktioniert auch oberhalb acht Karten.
- Automatische Tests für Kartensatz, Kartenzug, Ablageregeln, Einzel-/Mehrfachtausch, Strafkarten, Stapelende, Konfigurationsgrenzen.

## Nächster konkreter Schritt

**Bereich 2 – Spezialfähigkeiten** vollständig durchgehen, private Sichtbarkeit und Pflichtaktionen korrigieren, Tests für alle 7/8/9/10/11/12-Sonderfälle ergänzen; erst danach Bereich 3.

**Hinweis:** ✅ bedeutet hier nicht, dass bereits eine komplette Multiplayer-Partie auf echten Geräten abgenommen wurde. Diese Prüfung ist explizit Schritt 9. Gesamte Funktionsentwicklung ist noch nicht fertig.
