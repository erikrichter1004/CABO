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
| 5 | Echtzeit-Multiplayer | 🟡 In Arbeit | Ereignisbasiertes Host-Snapshot, private Kartendaten, WebRTC-Wiederbeitritt mit privatem Sitzungsschlüssel, veraltete Verbindung gesperrt; **echte Verbindungsproben fehlen** |
| 6 | Gastgeberverwaltung | 🟡 In Arbeit | Pausieren/Entfernen, Aufräumen offener Züge, 30-s-Verbindungsunterbrechung, **bestätigte freiwillige Übergabe** mit gleichem Raumcode implementiert; **ungeplanter Hostabsturz noch nicht automatisch überbrückbar** |
| 7 | Runden- und Zeitsteuerung | ✅ Bereichslogik abgeschlossen | 60-s-Erinnerung, Gastgeberfreigabe ab 90 s, Ready- und Peek-Gates, Überfällige Spezialfähigkeit beenden, Zugtimer und Offline-Pause |
| 8 | Vollständige Regeltests | 🟡 In Arbeit | **75 automatische Regressionstests**, GitHub Actions bei jedem Push; zusätzliche Stresstests/weitere Grenzfälle fehlen |
| 9 | Integration & Stabilität | ⬜ Offen | Mehrclient-/Mehrgeräte-Durchläufe, WebRTC-Abbrüche, Hostübergabe praktisch testen, PWA-Installierbarkeit und Service-Worker-Integration, aufgelistete Fehler beseitigen |

## Letzter abgeschlossener Implementierungsblock

- Fähigkeiten 7–12 über ein einheitliches Zustandsmodell inklusive spezieller Timerpause, optionaler/pflichtiger Aktionen und erweiterter Mehrfachkartenaktionen vereinheitlicht.
- Anfangsblick bleibt offen, bis die Karte ausdrücklich geschlossen wird; andere Spieler bekommen keine Zielkarten-Indizes.
- CABO-Schlusszüge je Gegenspieler sowie Punktegrenzen und Stichrunden nochmals abgesichert.
- Wiederbeitrittsidentitäten durch private Sitzungsschlüssel geschützt, alte WebRTC-Verbindungen können keine Aktionen mehr auslösen.
- Gastgeber kann die Partie bei **freiwilligem Verlassen** an den am längsten anwesenden verbundenen aktiven Spieler übergeben. Nur dem **neuen Gastgeber** wird während der Übergabe der vollständige geheime Zustand übermittelt.
- Pausieren/Entfernen löst ausstehende Kartenaktionen regelkonform auf und erhält die Zugreihenfolge soweit möglich.
- Erinnerungen nach 60 Sekunden und Gastgeber-Eingriffsoptionen nach 90 Sekunden eingebaut.

## Nächster konkreter Schritt

**Bereich 5 und 6 vervollständigen:** zuverlässiger Wiederbeitritt, Client-Synchronisation unter echten PeerJS-Verbindungsabbrüchen, Migration beim unerwarteten Hostverlust. Anschließend Schritt 8 und 9 mit durchgehenden Integrationstests.

**Technische Einschränkung:** Eine garantiert geheime und zugleich absturzsichere automatische Wiederherstellung des vollständigen Kartenzustands ist in reinem Peer-to-Peer-Hosting ohne vertrauenswürdigen externen Speicher nicht trivial. Beim freiwilligen Wechsel erhält der übernehmende Gastgeber den vollständigen Zustand. Ein unerwarteter Hostverlust ist daher noch **nicht** als abgeschlossen zu werten.

✅ bezieht sich ausdrücklich auf die geprüfte lokale Regellogik; **Gesamtprojekt nicht fertig**.
