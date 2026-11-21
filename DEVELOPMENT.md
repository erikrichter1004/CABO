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
| 6 | Gastgeberverwaltung | ✅ Bereichslogik abgeschlossen | Pausieren/Entfernen, freiwillige Übergabe, automatische Nachfolgerwahl mit 20-s-Erreichbarkeitskontrolle, Übernahme bei Absturz auch ohne Rückkehr, Sitzungswiederherstellung; 2-/3-Spieler-, Wechsel- und Peer-ID-Belegungstests bestanden; echte Geräteprüfung folgt in Schritt 9 |
| 7 | Runden- und Zeitsteuerung | ✅ Bereichslogik abgeschlossen | 60-s-Erinnerung, Gastgeberfreigabe ab 90 s, Ready- und Peek-Gates, Überfällige Spezialfähigkeit beenden, Zugtimer und Offline-Pause |
| 8 | Vollständige Regeltests | 🟡 In Arbeit | **84 automatische Regel-/Stresstests** plus Mehrclient-Simulationen in GitHub Actions; weitere Grenzfälle und Tests unter echten Browsern fehlen |
| 9 | Integration & Stabilität | 🟡 In Arbeit | Simulierte Drei-Spieler-Partie mit privaten Karten, Wiederbeitritt, Raumübergabe und Snapshot-Schutz sowie Host-Wiederherstellung aus Session-Snapshot getestet; echte Browser-/Mehrgerätetests und PWA-Prüfung stehen aus |

## Letzter abgeschlossener Implementierungsblock

**Automatischer Gastgeberwechsel (Schritt 1 von 4): abgeschlossen als implementierte und automatisiert geprüfte Funktion.** Die weiteren 3 Pakete sind Belastungstests, durchgehende Proberunden und Geräte-/Browser-Prüfung.

- Fähigkeiten 7–12 über ein einheitliches Zustandsmodell inklusive spezieller Timerpause, optionaler/pflichtiger Aktionen und erweiterter Mehrfachkartenaktionen vereinheitlicht.
- Anfangsblick bleibt offen, bis die Karte ausdrücklich geschlossen wird; andere Spieler bekommen keine Zielkarten-Indizes.
- CABO-Schlusszüge je Gegenspieler sowie Punktegrenzen und Stichrunden nochmals abgesichert.
- Wiederbeitrittsidentitäten durch private Sitzungsschlüssel geschützt, alte WebRTC-Verbindungen können keine Aktionen mehr auslösen.
- Gastgeber kann die Partie bei **freiwilligem Verlassen** an den am längsten anwesenden verbundenen aktiven Spieler übergeben. Nur dem **neuen Gastgeber** wird während der Übergabe der vollständige geheime Zustand übermittelt.
- Pausieren/Entfernen löst ausstehende Kartenaktionen regelkonform auf und erhält die Zugreihenfolge soweit möglich.
- Erinnerungen nach 60 Sekunden und Gastgeber-Eingriffsoptionen nach 90 Sekunden eingebaut.

## Nächster konkreter Schritt

**Bereiche 8 und 9:** Weitere Regel- und Stresstests, echte Browser-/Geräte-Multiplayer-Tests und Prüfung der PWA-Installation. Die Logik des automatischen Gastgeberwechsels ist bereits in Simulationsläufen geprüft.

### Zusätzliche Prüfnachweise

- 84 automatische Regel- und Stresstests, einschließlich 2–8 Spielenden und konsistentem Kartenbestand.
- Drei vollständig getrennte simulierte Browser-Clients tauschen echte simulierte Datenkanal-Nachrichten aus: Zugwechsel, private Karten, Anfangsblick, Wiederverbindung, freiwilliger Hostwechsel.
- Überraschender Hostausfall **mit anschließender Wiederherstellung durch den ursprünglichen Gastgeber** getestet: dieselbe Raumkennung, kurzzeitig blockierte Peer-ID, gefrorene Zugzeit und erneuter Beitritt der Mitspieler.
- Lokale Wiederherstellung über dauerhaft gespeicherte Raumkennung, Spieleridentität und private Sitzungsschlüssel. Der Gastgeber speichert zusätzlich den vollständigen letzten Spielzustand im Browser; sofern dauerhafter Speicher blockiert wird, bleibt der Sitzungs-Speicher als Fallback.
- GitHub Actions prüft Code-Syntax, PWA-Manifest, Regeltests und Mehrclient-Simulation bei jedem Push.

**Technische Einschränkung / Vertrauensmodell:** Der automatisch gewählte Ersatzgastgeber erhält während des Spiels über den bestehenden WebRTC-Kanal eine vollständige Kopie des aktuellen Kartenzustands **im Arbeitsspeicher**. Alle anderen Gäste erhalten weiterhin nur ihre eingeschränkten Ansichten. Obwohl die Oberfläche beim Ersatzgastgeber keine fremden verdeckten Werte zeigt, kann jemand mit technischem Zugriff auf diesen Browser die in der Reservekopie enthaltenen Werte auslesen. Eine Garantie absoluter Geheimhaltung bei gleichzeitig vollautomatischem Ausfallwechsel **ohne vertrauenswürdigen Server** ist daher nicht möglich. Die neue Einstellung `autoFailover` kann deaktiviert werden, wenn dieser Zugriff unerwünscht ist. Bei einem Ausfall ohne verfügbaren Ersatzgastgeber bleibt die Wiederherstellung durch den ursprünglichen Gastgeber notwendig.

**Verifikation:** Die automatische Übernahme wurde in einer isolierten PeerJS-Mehrclient-Simulation mit zwei und drei Spielern geprüft: plötzlicher Absturz des Gastgebers, Erhalt der Punktestände, offener Kartenaktionen und Zugreihenfolge, erneuter Verbindungsaufbau der verbleibenden Gäste, Wechsel der Reserveperson sowie vorübergehend belegte Raumkennung. Das ersetzt keine Tests über reale WebRTC-/Mobilfunk-Verbindungen.

✅ bezieht sich ausdrücklich auf die geprüfte lokale Regellogik; **Gesamtprojekt nicht fertig**.
