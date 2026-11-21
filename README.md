# CABO Online – technische Funktionsentwicklung abgeschlossen

Installierbare statische Web-App auf GitHub Pages. Kommunikation der Spieler über PeerJS/WebRTC; für die Vermittlung wird ein **externer öffentlicher PeerJS-Signalisierungsdienst** verwendet. Es gibt keinen selbst verwalteten Backend-Server. Die Synchronisierung erfolgt **ereignisbasiert**, nicht durch periodisches Abfragen.

## Bereits implementierte Logik
- Raumcode, Lobby für 2–8 Spieler, Host-autoritative Spielaktionen und private Kartenwerte
- Startkarten, konfigurierbare Anfangsblicke, verdeckter Stapel und offene Ablage
- Ziehen, direktes Ablegen, einzelner Tausch, Mehrfachablage und Mehrfachtausch
- Kartenfähigkeiten 7/8 (eigene ansehen), 9/10 (fremde ansehen), 11/12 (blind tauschen)
- CABO nach dem eigenen Zug, Schlusszüge anderer Spieler, Punkteberechnung inklusive Gleichstand
- 100-auf-50-Rettung, Kamikaze, Punktelimit oder feste Rundenzahl, Stichrunden
- Runde-Ready-Bestätigung, Gastgeber-Pause und Entfernen, automatische Wiederverbindungsversuche
- Zugzeitlimit, Zeitstopp bei Spezialfähigkeit, Grace-Period bei aktivem Verbindungsabbruch
- Individuelle Kartenhäufigkeiten mit Prüfung der Eingaben; sonst 52er-Standardstapel, für größere Runden skaliert

## Ausfallsicherung und verbleibende Einschränkungen
- **Automatischer Hostwechsel:** In simulierten Mehrspielerpartien und einem echten Chromium-WebRTC-Browsertest erfolgreich: Beim plötzlichen Schließen des Gastgeber-Browsers übernimmt der Nachfolger unter demselben Raumcode.
- **Privatsphäre-Hinweis:** Der Reservegastgeber erhält vorab eine vollständige Kopie des aktuellen, auch geheimen Kartenzustands. Die Spieloberfläche zeigt ihm weiterhin nur erlaubte Karten, technisch könnte er jedoch versteckte Werte auslesen. In den Spieleinstellungen kann die automatische Übernahme deshalb abgeschaltet werden. Ohne verfügbare Reserveperson muss der bisherige Gastgeber seinen gespeicherten Spielstand wiederherstellen.
- **Automatisierte Browserabnahme abgeschlossen:** echte Chromium-/WebKit-Datenkanäle (auch browserübergreifend), geheime Karten, Zugwechsel, Wiederbeitritt nach Neuladen und Ausfallübernahme getestet. PWA-Manifest, PNG-Icons, Service Worker und Offline-App-Oberfläche geprüft.
- **Offen als eigenständige manuelle Freigabe:** tatsächliche Installation auf physischen iPhone-/Android-Geräten, Mobilfunk/WLAN-Wechsel und iOS-Hintergrundverhalten. Diese Ergebnisse können ohne entsprechende Testgeräte nicht behauptet werden.
- **Nächster Entwicklungsschritt:** visuelles Design und Animationen.

**Stand:** Die vier vereinbarten technischen Entwicklungspakete sind implementiert und die automatisierten Prüfungen bestanden. GitHub Actions führt 96 Regel-/Stresstests, komplette Mehrclient-Spielsimulationen, Browser-/PWA-Checks und echte lokale PeerJS-WebRTC-Tests aus. Dies ist eine **automatisierte technische Freigabe**, keine bestätigte Geräteabnahme auf realen Smartphones. Die Nutzbarkeit unter sämtlichen Mobilfunk-/WLAN-Bedingungen ist damit nicht garantiert.

Detaillierter Fortschritt: [DEVELOPMENT.md](DEVELOPMENT.md).

## Veröffentlichung
GitHub Settings → Pages → Deploy from a branch → main → /(root).
