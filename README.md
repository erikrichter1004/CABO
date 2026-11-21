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
- Individuelle Kartenhäufigkeiten (Fallback auf skalierte Verteilung)

## Noch nicht zuverlässig abgeschlossen
- **Automatischer Hostwechsel bei unerwartetem Hostabsturz:** noch nicht umgesetzt. Freiwillige Übergabe mit Bestätigung und vollständiger Spielzustandsübertragung an den Nachfolger ist implementiert, aber noch nicht auf mehreren Geräten getestet.
- Wiederherstellung des vollständigen geheimen Kartenzustands ohne zuvor bestätigte Gastgeberübergabe
- Korrekte Geheimhaltung/Bestätigung aller Spezialfälle, Animationen und alle Timer-Unterbrechungen
- Alle Sonderfälle der 61 vereinbarten Regeln, insbesondere Ready-/Peek-Hostentscheidungen, Sonderwertungen und Einstellungsvalidierung
- Vollständige Tests mit mehreren Geräten und Tests für jede Spielregel

**Nicht als fertiges Spiel behandeln.** GitHub Actions führt Syntaxprüfung und derzeit 75 automatisierte Regeltests bei jedem Push aus. Auch ein erfolgreicher Prüflauf ist noch kein realer Multiplayer-Integrationstest.

Detaillierter Fortschritt: [DEVELOPMENT.md](DEVELOPMENT.md).

## Veröffentlichung
GitHub Settings → Pages → Deploy from a branch → main → /(root).
