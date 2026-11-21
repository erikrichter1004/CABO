# CABO Online – Entwicklungsstand

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

## Noch nicht zuverlässig abgeschlossen
- **Automatischer Hostwechsel bei unerwartetem Hostabsturz:** noch nicht umgesetzt. Freiwillige Übergabe mit Bestätigung und vollständiger Spielzustandsübertragung an den Nachfolger ist implementiert, aber noch nicht auf mehreren Geräten getestet.
- Bei Absturz ohne vorherige Übergabe muss der bisherige Gastgeber seinen gespeicherten Spielstand wiederherstellen. Ein **automatischer Ersatzhost** benötigt ein gesondertes Verfügbarkeits-/Vertrauenskonzept.
- Abschließende Prüfung sämtlicher Regel-/Unterbrechungsfälle und der Verbindungsqualität in echten Browsern und auf mehreren Geräten
- PWA-Installationsprüfung auf iOS/Android; das visuelle Design und die Animationen folgen erst nach Abschluss der Funktionen

**Nicht als fertiges Spiel behandeln.** GitHub Actions führt Syntaxprüfung und derzeit 84 automatisierte Regel-/Stresstests und eine PeerJS-Mehrclient-Simulation bei jedem Push aus. Auch ein erfolgreicher Prüflauf ist noch kein realer Multiplayer-Integrationstest.

Detaillierter Fortschritt: [DEVELOPMENT.md](DEVELOPMENT.md).

## Veröffentlichung
GitHub Settings → Pages → Deploy from a branch → main → /(root).
