# CABO Online – verbindlicher Funktionsplan

**Arbeitsreihenfolge:** Funktionsentwicklung und automatisierte technische Abnahmetests abgeschlossen. Die nächste Arbeitsphase ist Design und Animation. Eine zusätzliche physische Geräteprüfung ist gesondert vermerkt und wird nicht als bereits absolviert ausgegeben.

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
| 8 | Vollständige Regeltests | ✅ Automatisierte Tests abgeschlossen | **96 automatische Regel- und Belastungstests**, 2–8-Spieler-Stresstests und isolierte Mehrclient-Simulationen in GitHub Actions erfolgreich; echte Browser-/Gerätetests folgen unter Bereich 9 |
| 9 | Integration & Stabilität | ✅ Automatisierte Abnahme abgeschlossen | 96 Regeltests, vollständige Spielsimulationen mit 2–8 Teilnehmenden, echte WebRTC-Datenkanäle Chromium↔Chromium und Chromium↔WebKit, Neuladen und Wiederbeitritt mit geheimer Karte, automatischer Ersatzgastgeber nach echtem Browserabsturz und installierbare PWA-Ressourcen inkl. PNG-Icons geprüft. Physische iOS-/Android-Geräte und Mobilfunkwechsel sind **nicht** getestet. |

## Paket 4 – automatisierte Browser-/WebRTC-/PWA-Abnahme abgeschlossen

GitHub Actions testet CABO in realen Chromium- und WebKit-Browser-Engines, auch in simulierten mobilen Bildschirmgrößen. Erfolgreich nachgewiesen:

- PWA-Manifest, 192×192-/512×512-PNG-Icons, iOS-Home-Screen-Metadaten und Service-Worker-Cache; Chromium lädt die App-Oberfläche offline neu, WebKit prüft den Offline-Cache (Linux-WebKit kann den Offline-Reload intern nicht ausführen).
- Echte `RTCPeerConnection`- und `RTCDataChannel`-Verbindungen für **Chromium ↔ Chromium** und **Chromium ↔ WebKit** über einen lokalen PeerJS-Signalisierungsserver.
- Privater Anfangsblick und gezogene Karten, synchronisierte Zugzustände.
- **Neuladen eines Spielclients während einer offenen Kartenziehung:** authentifizierter Wiederbeitritt mit derselben Identität und Wiederherstellung der privaten Karte – in beiden Browsertests bestanden.
- **Unerwartetes Schließen des Gastgeber-Browsers:** automatische Übernahme der ursprünglichen Raumkennung durch den aktiven Ersatzgastgeber in einer echten Chromium-WebRTC-Verbindung – bestanden.

Referenz: GitHub-Actions-Workflow `CABO real-browser checks`, Lauf **44897609578** (erfolgreich, 21. November 2026).

**Nicht nachgewiesen:** Installation und Hintergrundverhalten auf einem **physischen iPhone/Android-Gerät**, reale Mobilfunk-/WLAN-Übergänge oder die Zuverlässigkeit des externen öffentlichen PeerJS-Dienstes. Diese reale Geräteprüfung ist getrennt von der abgeschlossenen automatisierten Funktionsentwicklung.

## Automatisierte Vollpartien – Paket 3 abgeschlossen

Die GitHub-Actions-Mehrclient-Simulation spielt Spiele vom Austeilen bis zum eindeutigen Sieger durch. Erfolgreich geprüft:

- Drei Spieler über **drei vollständige Runden**, einschließlich geheimer Anfangsblicke, Ziehen/Tauschen, CABO, letzten Gegenspielerzügen, Punktezählung und Bereit-Bestätigungen.
- Eine **komplette Stichrunde** nach zuvor erzwungenem Gleichstand: vier Karten und zwei Anfangsblicke der Beteiligten, je drei Züge, Gesamtergebnis nur aus der Stichrunde; Hauptpunkte bleiben unverändert.
- Weitere **vollständig beendete Partien mit 2, 4 und 8 simulierten, getrennten Clients** mit bestätigter Siegeranzeige und identischen Punkteständen auf allen Geräten.
- Bereits vorhandene Tests decken Stapelnachmischen, 2–8-Spieler-Kartenerhaltung, Spezialfähigkeiten, Hostausfall und Verbindungswiederherstellung ab.

Die erfolgreichen Tests verwenden **simulierte PeerJS-Datenkanäle**, keine echte Mobilfunk- oder Geräteverbindung. Punkt 4 bleibt deshalb notwendig.

## Letzter abgeschlossener Implementierungsblock

**Arbeitsplan (4 von 4 technischen Paketen abgeschlossen):** Paket 1 – automatische Gastgeber-Ausfallsicherung ✅. Paket 2 – zusätzliche Regel- und Belastungstests ✅. Paket 3 – vollständige simulierte Spielrunden ✅. Paket 4 – automatisierte Browser-/WebRTC-/PWA-Abnahme ✅. **Physische Geräteabnahme bleibt als separate manuelle Freigabe offen und ist nicht als bestanden ausgewiesen.**

**Zusatzprüfung in Paket 2:** Zehn neue Grenzfalltests für Mehrfachtausch aus offenem und verdecktem Stapel, Strafvarianten, leere Hände, ungültige Aktionen sowie genügend Karten für Stichrunden. Fehler beim misslungenen Mehrfachtausch aus der offenen Ablage behoben: Pflicht zum Kartentausch bleibt gewahrt. Benutzerdefinierte Kartenhäufigkeiten müssen nun auch potenzielle Stichrunden mit vier Karten je Spieler ermöglichen.

- Fähigkeiten 7–12 über ein einheitliches Zustandsmodell inklusive spezieller Timerpause, optionaler/pflichtiger Aktionen und erweiterter Mehrfachkartenaktionen vereinheitlicht.
- Anfangsblick bleibt offen, bis die Karte ausdrücklich geschlossen wird; andere Spieler bekommen keine Zielkarten-Indizes.
- CABO-Schlusszüge je Gegenspieler sowie Punktegrenzen und Stichrunden nochmals abgesichert.
- Wiederbeitrittsidentitäten durch private Sitzungsschlüssel geschützt, alte WebRTC-Verbindungen können keine Aktionen mehr auslösen.
- Gastgeber kann die Partie bei **freiwilligem Verlassen** an den am längsten anwesenden verbundenen aktiven Spieler übergeben. Nur dem **neuen Gastgeber** wird während der Übergabe der vollständige geheime Zustand übermittelt.
- Pausieren/Entfernen löst ausstehende Kartenaktionen regelkonform auf und erhält die Zugreihenfolge soweit möglich.
- Erinnerungen nach 60 Sekunden und Gastgeber-Eingriffsoptionen nach 90 Sekunden eingebaut.

## Nächster konkreter Schritt

**Nächste Projektphase: Design und Animationen.** Die vier technischen Entwicklungspakete sind implementiert und automatisiert erfolgreich geprüft. Für die zusätzliche manuelle Smartphone-Freigabe können später zwei reale Telefone den Mobilfunk-/WLAN-Wechsel, Installation und Hintergrund-Rückkehr bestätigen. Dieser Nachweis wurde nicht erbracht und darf nicht als bestandener Test dargestellt werden.

### Zusätzliche Prüfnachweise

- 96 automatische Regel- und Stresstests, einschließlich 2–8 Spielenden und konsistentem Kartenbestand.
- Drei vollständig getrennte simulierte Browser-Clients tauschen echte simulierte Datenkanal-Nachrichten aus: Zugwechsel, private Karten, Anfangsblick, Wiederverbindung, freiwilliger Hostwechsel.
- Überraschender Hostausfall **mit anschließender Wiederherstellung durch den ursprünglichen Gastgeber** getestet: dieselbe Raumkennung, kurzzeitig blockierte Peer-ID, gefrorene Zugzeit und erneuter Beitritt der Mitspieler.
- Lokale Wiederherstellung über dauerhaft gespeicherte Raumkennung, Spieleridentität und private Sitzungsschlüssel. Der Gastgeber speichert zusätzlich den vollständigen letzten Spielzustand im Browser; sofern dauerhafter Speicher blockiert wird, bleibt der Sitzungs-Speicher als Fallback.
- GitHub Actions prüft Code-Syntax, PWA-Manifest, Regeltests und Mehrclient-Simulation bei jedem Push.

**Technische Einschränkung / Vertrauensmodell:** Der automatisch gewählte Ersatzgastgeber erhält während des Spiels über den bestehenden WebRTC-Kanal eine vollständige Kopie des aktuellen Kartenzustands **im Arbeitsspeicher**. Alle anderen Gäste erhalten weiterhin nur ihre eingeschränkten Ansichten. Obwohl die Oberfläche beim Ersatzgastgeber keine fremden verdeckten Werte zeigt, kann jemand mit technischem Zugriff auf diesen Browser die in der Reservekopie enthaltenen Werte auslesen. Eine Garantie absoluter Geheimhaltung bei gleichzeitig vollautomatischem Ausfallwechsel **ohne vertrauenswürdigen Server** ist daher nicht möglich. Die neue Einstellung `autoFailover` kann deaktiviert werden, wenn dieser Zugriff unerwünscht ist. Bei einem Ausfall ohne verfügbaren Ersatzgastgeber bleibt die Wiederherstellung durch den ursprünglichen Gastgeber notwendig.

**Verifikation:** Die automatische Übernahme wurde in einer isolierten PeerJS-Mehrclient-Simulation mit zwei und drei Spielern geprüft: plötzlicher Absturz des Gastgebers, Erhalt der Punktestände, offener Kartenaktionen und Zugreihenfolge, erneuter Verbindungsaufbau der verbleibenden Gäste, Wechsel der Reserveperson sowie vorübergehend belegte Raumkennung. Das ersetzt keine Tests über reale WebRTC-/Mobilfunk-Verbindungen.

✅ bezieht sich ausdrücklich auf die geprüfte lokale Regellogik; **Gesamtprojekt nicht fertig**.
