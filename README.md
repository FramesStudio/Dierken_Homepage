# Dierken Bau und Fliesen – Website-Relaunch

Astro 7 (statisch), TypeScript, Three.js für die 3D-Szenen. Schrift Montserrat (Headlines ExtraBold/Black mit kursiven Akzenten wie in den Reels), Skripte und Bilder werden vollständig selbst gehostet (keine CDNs, keine Cookies, kein Tracking).

```bash
npm install
npm run dev       # http://localhost:4321
npm run build     # statischer Build nach dist/
npm run preview   # Build lokal ansehen
```

`?motion=0` an eine URL hängen zeigt die reduzierte Variante (wie bei `prefers-reduced-motion`).

## Vorschau auf GitHub Pages

`npm run deploy:preview` baut die Seite und veröffentlicht sie über den Branch `gh-pages` unter **https://framesstudio.github.io/Dierken_Homepage/** (`scripts/deploy-preview.sh`, braucht eine Anmeldung mit `gh auth login`). Ein Push auf `main` allein aktualisiert die Vorschau nicht.
Die Vorschau läuft im Unterordner `/Dierken_Homepage` (`BASE_PATH`) und ist per `noindex` für Suchmaschinen gesperrt (`PUBLIC_PREVIEW=1`). Interne Links deshalb immer mit `withBase('/pfad/')` aus `src/lib/url.ts` schreiben.
Ohne diese Variablen baut `npm run build` wie gehabt für www.fliesen-dierken.de.

## Leitidee: Taktil & Material

**„Ihren Ideen Raum geben.“** – abgeleitet aus dem bisherigen Claim *„geben Sie Ihren Ideen Räume – Fliese für Fliese“*.
Die Fliese ist das Gestaltungsprinzip der ganzen Seite:

- **Hero:** Wand aus glasierten 3D-Fliesen in Markenblau; Licht folgt dem Zeiger. Beim Scrollen drehen sich die Fliesen auf warmen Travertin – der Hero wechselt von Nacht zu Tag, Schrift und Navigation gehen ins Markenblau (`src/three/hero-wall.ts`).
- **Raumreise:** Ein Luxusbad entsteht in 3D – Rohbau im Abendlicht mit Lichtstrahl, Kreuzlinienlaser beim Aufmaß, XXL-Muster, raumhohe Travertin-Platten (2 mm Fuge), Vorwand mit LED-Nische, Rillenpaneele, Mineralguss-Wanne, Messing, hinterleuchteter Spiegel, Wandfluter, Makro auf die Fuge. Mit Ambient Occlusion und Bloom (`src/three/room.ts`).
- **Material erleben:** gepinnte Bühne im Spotlicht – Wandprobe 3,60 × 3,00 m auf Sockel, je Material Kamerafahrt von der Totalen bis an die Fuge, Lichtschwenk beim Wechsel, Maßlinien zeichnen sich an die Referenzfliese (`src/three/library.ts`).
- **Leistungen:** Schwenkrahmen-Display wie in der Ausstellung – beim Scrollen blättern die Rahmen wie Buchseiten, jede Doppelseite eine Leistung, zuletzt Fliese für Fliese verlegt (`src/three/display.ts`).
- **Startseite ohne Fotos:** Handwerk als kinetische Typografie mit Jahreszähler, Besuch mit dem D-Zeichen als CSS-3D-Relief. Bilder auf Unterseiten erscheinen per Navy-Vorhang (`data-tiles`).

Alle Materialien (Travertin, Calacatta, Rillenrelief, Glasur, Holz, Mikrozement, Mineralguss) sind **prozedural im Shader** erzeugt (`src/three/materials.ts`) – keine Bilddateien, gestochen scharf auch in Nahaufnahme. Sie sind auf der Seite als „im Code erzeugt“ gekennzeichnet.

## Struktur

| Pfad | Inhalt |
|---|---|
| `src/data/site.ts` | **Alle Unternehmensdaten** (Adresse, Telefon, Öffnungszeiten, Leistungen). Nur hier pflegen. |
| `src/data/images.ts` | Bildzuordnung, Alt-Texte, Kennzeichnung Herstellerbild vs. eigenes Foto, Material-Viewer |
| `src/styles/tokens.css` | Design-Tokens: Farben, Typo-Skala, Abstände, Easing |
| `src/three/engine.ts` | Renderer, Umgebungslicht, Rendern nur wenn sichtbar, Zeiger |
| `src/three/materials.ts` | Prozedurale Fliesenmaterialien (GLSL in MeshPhysicalMaterial) |
| `src/three/hero-wall.ts`, `room.ts`, `library.ts`, `display.ts` | Die vier Szenen |
| `src/three/layouts.ts` | Verlegemuster (Raster, Fischgrät, fugenlos) |
| `src/three/support.ts` | WebGL-Check und Schrittbereiche (ohne Three.js, sofort ladbar) |
| `src/scripts/motion.ts` | Reveals, Parallax, Header, Menü |
| `public/.htaccess` | 301-Weiterleitungen der alten `*.html`-Adressen (Apache) |

### Szenen anpassen
- `RANGES` in `src/three/support.ts`: Scrollbereich je Schritt (0–1).
- `CAM` in `src/three/room.ts`: Kamerapfad (p, Position, Ziel) – als Spline interpoliert.
- `PALETTE`, `ROWS_*` in `hero-wall.ts`: Glasurfarben und Fliesengröße der Hero-Wand.
- Höhe der Szenen: `.hero-track` (210svh) und `.rr-track` (820svh, mobil 720svh).
- Three.js wird erst nach dem ersten Paint bzw. bei Annäherung an die Szene nachgeladen (~140 KB gzip).
- Ohne WebGL: CSS-Fliesenwand im Hero, Raumfoto in der Raumreise, Materialtexte ohne Tafel.
- Reduzierte Bewegung: Standbilder der Szenen, keine gepinnten Abschnitte.

### Bewegungsvertrag
`<html>` erhält per Inline-Skript `js` und `motion` bzw. `reduced`. Ohne `motion` ist alles statisch sichtbar; die Raumreise zeigt dann ein Standbild des fertigen 3D-Raums und alle acht Schritte als Liste.

## Kontaktformular

Aktuell **ohne Versanddienst**: Das Formular bereitet eine E-Mail an info@fliesen-dierken.de vor und öffnet das E-Mail-Programm. Es zeigt ausdrücklich *keinen* Versanderfolg an.
Für echten Versand einen DSGVO-konformen Endpunkt (eigenes Backend oder EU-Formulardienst, JSON-POST) in `PUBLIC_FORM_ENDPOINT` eintragen (`.env`). Erfolg wird dann nur bei HTTP 2xx angezeigt. Datenschutzerklärung Abschnitt 4 entsprechend anpassen.

## Offene Punkte vor dem Livegang

1. **Logo**: `public/brand/dierken-logo.svg` ist aus den Markenmotiven nachgebaut (Fläche, D-Zeichen, Trenner geometrisch; Schriftzug nachgezeichnet, deckungsgleich mit dem Original geprüft). Liegt eine Original-Vektordatei vor, bitte damit ersetzen.
2. **Bildrechte prüfen**: Raum- und Materialbilder sind Herstellerbilder (laut bisherigem Impressum © Ceramiche CCV Castelvetro / XL Style). Sie sind überall als „Herstellerbild“ gekennzeichnet. Die Nutzungsrechte für die neue Website sollten bestätigt werden.
3. **Höher aufgelöste Originale**: Ausstellungsfotos (1200 px) und das Raumbild hinter der Hero-Wand (1446 px) sind knapp, Originaldateien bitte nachliefern.
4. **Eigene Referenzprojekte**: Es gibt keine belegten Dierken-Projektfotos, die Galerie zeigt deshalb nur Inspiration. Echte Projekte (mit Freigabe der Kunden) wären der stärkste Inhalt.
5. **Rechtstexte prüfen lassen**: Impressum (angepasst auf § 5 DDG / § 18 MStV, ohne den Link auf die eingestellte EU-OS-Plattform) und die neu verfasste Datenschutzerklärung. Den Hosting-Anbieter in der Datenschutzerklärung benennen.
6. **Karriere**: Der Stellenstand („keine Ausbildungsstelle“) stammt von der alten Website und muss gepflegt werden.
7. **Hosting**: Weiterleitungen aus `public/.htaccess` übernehmen, falls nicht Apache.
