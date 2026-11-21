# CABO Online – verbindlicher Funktionsplan

**Arbeitsreihenfolge:** Funktionen und Regeln zuerst, anschließend mehrstufige technische Tests, erst danach Design und Animationen. Keine Nutzer-Zwischentests vor dem Integrationsschritt.

## Fortschrittsdefinition

- ✅ **Bereichslogik abgeschlossen:** implementierte Regeln und automatisierte Bereichstests erfolgreich. Noch kein Beleg für funktionierende Multiplayer-Partien auf echten Geräten.
- 🟡 **In Arbeit:** relevanter Code besteht, aber wichtige Szenarien oder Integration fehlen.
- ⬜ **Offen:** Abnahmekriterien noch nicht ausreichend umgesetzt.

## Status – 21. November 2026

| Nr. | Bereich | Status | Bemerkung |
|---|---|---|---|
| 1 | Grundspiel & Kartenaktionen | ✅ Bereichslogik abgeschlossen | 52er-/skalierter Stapel, Zug und Ablage, Einzel- und Mehrfachaktionen, Fehlversuchstypen, Nachmischen |
| 2 | Spezialfähigkeiten 7–12 | ✅ Bereichslogik abgeschlossen | Eigene/fremde geheime Ansicht, blinder Tausch, Classic/Extended, Pflicht/Wahl, Timerpause, Zielprüfung |
| 3 | CABO & Schlusszüge | ✅ Bereichslogik abgeschlossen | Nur nach Zug, ohne Rücknahme, eigener Schlusszugzähler je Gegner (0–3), Ansager setzt aus, pausierte Spieler in Wertung |
| 4 | Punkte & Spielende | ✅ Bereichslogik abgeschlossen | CABO-Erfolg/Gleichstand, 100→50, Kamikaze, Punktelimit/feste Runden, Stichrunde mit vier Karten/zwei Blicken/drei Zügen |
| 5 | Echtzeit-Multiplayer | ✅ Bereichslogik abgeschlossen | Ereignisbasiertes Host-Snapshot, private Kartendaten, Authentifizierung und Replay-Schutz, Zustand je Revision; drei simulierte Clients mit echten Ereignisnachrichten geprüft, praktische Gerätetests in Schritt 9 |
| 6 | Gastgeberverwaltung | 🟡 In Arbeit | Pausieren/Entfernen, 30-s-Offline-Regel, bestätigte freiwillige Übergabe und manuelle Wiederherstellung des Gastgebers sind simuliert; **automatischer Wechsel bei unerwartetem Hostabsturz ohne Rückkehr fehlt** |
| 7 | Runden- und Zeitsteuerung | ✅ Bereichslogik abgeschlossen | 60-s-Erinnerung, Gastgeberfreigabe ab 90 s, Ready- und Peek-Gates, Überfällige Spezialfähigkeit beenden, Zugtimer und Offline-Pause |
| 8 | Vollständige Regeltests | 🟡 In Arbeit | **84 automatische Regel-/Stresstests** plus Mehrclient-Simulationen in GitHub Actions; weitere Grenzfälle und Tests unter echten Browsern fehlen |
| 9 | Integration & Stabilität | 🟡 In Arbeit | Simulierte Drei-Spieler-Partie mit privaten Karten, Wiederbeitritt, Raumübergabe und Snapshot-Schutz sowie Host-Wiederherstellung aus Session-Snapshot getestet; echte Browser-/Mehrgerätetests und PWA-Prüfung stehen aus |

## Letzter abgeschlossener Implementierungsblock

- Fähigkeiten 7–12 über ein einheitliches Zustandsmodell inklusive spezieller Timerpause, optionaler/pflichtiger Aktionen und erweiterter Mehrfachkartenaktionen vereinheitlicht.
- Anfangsblick bleibt offen, bis die Karte ausdrücklich geschlossen wird; andere Spieler bekommen keine Zielkarten-Indizes.
- CABO-Schlusszüge je Gegenspieler sowie Punktegrenzen und Stichrunden nochmals abgesichert.
- Wiederbeitrittsidentitäten durch private Sitzungsschlüssel geschützt, alte WebRTC-Verbindungen können keine Aktionen mehr auslösen.
- Gastgeber kann die Partie bei **freiwilligem Verlassen** an den am längsten anwesenden verbundenen aktiven Spieler übergeben. Nur dem **neuen Gastgeber** wird während der Übergabe der vollständige geheime Zustand übermittelt.
- Pausieren/Entfernen löst ausstehende Kartenaktionen regelkonform auf und erhält die Zugreihenfolge soweit möglich.
- Erinnerungen nach 60 Sekunden und Gastgeber-Eingriffsoptionen nach 90 Sekunden eingebaut.

## Nächster konkreter Schritt

**Bereiche 6, 8 und 9:** Lösungen für überraschenden Hostverlust ohne vertrauenswürdigen Server prüfen, zusätzliche Stresstests und echte Browser-Multiplayer-Tests durchführen.

### Zusätzliche Prüfnachweise

- 84 automatische Regel- und Stresstests, einschließlich 2–8 Spielenden und konsistentem Kartenbestand.
- Drei vollständig getrennte simulierte Browser-Clients tauschen echte simulierte Datenkanal-Nachrichten aus: Zugwechsel, private Karten, Anfangsblick, Wiederverbindung, freiwilliger Hostwechsel.
- Überraschender Hostausfall **mit anschließender Wiederherstellung durch den ursprünglichen Gastgeber** getestet: dieselbe Raumkennung, kurzzeitig blockierte Peer-ID, gefrorene Zugzeit und erneuter Beitritt der Mitspieler.
- Lokale Wiederherstellung über dauerhaft gespeicherte Raumkennung, Spieleridentität und private Sitzungsschlüssel. Der Gastgeber speichert zusätzlich den vollständigen letzten Spielzustand im Browser; sofern dauerhafter Speicher blockiert wird, bleibt der Sitzungs-Speicher als Fallback.
- GitHub Actions prüft Code-Syntax, PWA-Manifest, Regeltests und Mehrclient-Simulation bei jedem Push.

**Technische Einschränkung:** Eine garantiert geheime und zugleich absturzsichere automatische Wiederherstellung des vollständigen Kartenzustands ist in reinem Peer-to-Peer-Hosting ohne vertrauenswürdigen externen Speicher nicht trivial. Beim freiwilligen Wechsel erhält der übernehmende Gastgeber den vollständigen Zustand. Ein unerwarteter Hostverlust ist daher noch **nicht** als abgeschlossen zu werten.

✅ bezieht sich ausdrücklich auf die geprüfte lokale Regellogik; **Gesamtprojekt nicht fertig**.
