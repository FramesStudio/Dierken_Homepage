import type { ImageMetadata } from 'astro';

/* ---------- Eigene Fotos (Dierken) ---------- */
import ausstellung1 from '../assets/img/ausstellung/ausstellung-1.jpg';
import ausstellung2 from '../assets/img/ausstellung/ausstellung-2.jpg';
import ausstellung3 from '../assets/img/ausstellung/ausstellung-3.jpg';
import ausstellung4 from '../assets/img/ausstellung/ausstellung-4.jpg';
import ausstellung5 from '../assets/img/ausstellung/ausstellung-5.jpg';
import ausstellung6 from '../assets/img/ausstellung/ausstellung-6.jpg';
import gebaeude from '../assets/img/ausstellung/gebaeude.jpg';
import kantePolieren from '../assets/img/handwerk/kante-polieren.jpg';
import kelleEimer from '../assets/img/handwerk/kelle-eimer.jpg';
import zuschnittDetail from '../assets/img/handwerk/zuschnitt-detail.jpg';
import zuschnittPortrait from '../assets/img/handwerk/zuschnitt-portrait.jpg';
import fliesenlegerFenster from '../assets/img/handwerk/fliesenleger-fenster.jpg';

/* ---------- Herstellerbilder (Inspiration, keine Dierken-Projekte) ---------- */
const insp = import.meta.glob<{ default: ImageMetadata }>('../assets/img/inspiration/*.jpg', {
  eager: true,
});
const i = (name: string) => insp[`../assets/img/inspiration/${name}.jpg`].default;

export const own = {
  ausstellung: [
    { src: ausstellung4, alt: 'Ausstellung in Lohne: langer Gang mit Fliesen in Holzoptik am Boden und Wandmustern in Schwenkrahmen' },
    { src: ausstellung1, alt: 'Ausstellung: Schwenkrahmen mit Wandfliesen und Schubladen mit Bodenmustern' },
    { src: ausstellung2, alt: 'Ausstellung: großformatige Bodenplatten in Präsentern, dahinter Musterwände' },
    { src: ausstellung3, alt: 'Ausstellung: Musterständer mit Fliesen in Holz- und Steinoptik' },
    { src: ausstellung5, alt: 'Ausstellung: verlegte Musterflächen und großformatige Platten zum Vergleichen' },
    { src: ausstellung6, alt: 'Ausstellung: Schwenkrahmen und Musterflächen in Grau- und Brauntönen' },
  ],
  gebaeude: { src: gebaeude, alt: 'Firmengebäude der Dierken Bau und Fliesen GmbH am Industriering 13 in Lohne' },
  handwerk: {
    kantePolieren: { src: kantePolieren, alt: 'Fliesenleger poliert die Schnittkante einer Fliese mit dem Winkelschleifer' },
    kelleEimer: { src: kelleEimer, alt: 'Fliesenleger mit Kelle und Kleber-Eimer in einem Neubau mit großformatigen Bodenfliesen' },
    zuschnittDetail: { src: zuschnittDetail, alt: 'Trennscheibe schneidet eine Fliese mit Rautenstruktur' },
    zuschnittPortrait: { src: zuschnittPortrait, alt: 'Fliesenleger mit Gehörschutz beim Zuschnitt im Freien' },
    fliesenlegerFenster: { src: fliesenlegerFenster, alt: 'Junger Fliesenleger im Rohbau vor bodentiefem Fenster' },
  },
};

export type Category = 'Bad' | 'Küche' | 'Wohnen' | 'Gewerbe';
export interface InspirationImage {
  src: ImageMetadata;
  alt: string;
  category: Category;
}

/** Kategorien wie auf der bisherigen Galerie-Seite */
export const inspiration: InspirationImage[] = [
  { src: i('fusion-bagno-cemento'), category: 'Bad', alt: 'Bad mit großformatigen Bodenfliesen in Betonoptik und freistehender Wanne' },
  { src: i('nature-aequa-nix'), category: 'Bad', alt: 'Helles Bad mit Bodenfliesen in heller Holzoptik und Fensterfront' },
  { src: i('ceramica-interni-ubahn-francoforte'), category: 'Bad', alt: 'Bad mit Wandfliesen in Sandtönen und freistehender Wanne' },
  { src: i('interni-coperture-timeless-grey'), category: 'Bad', alt: 'Bad mit grauen Wandfliesen und Waschtisch aus Stein' },
  { src: i('fusion-tortora'), category: 'Bad', alt: 'Bad in warmem Taupe mit großformatigen Wand- und Bodenfliesen' },
  { src: i('nature-aequa-nix-particolare'), category: 'Bad', alt: 'Detail: Wanne mit Wandverkleidung in heller Holzoptik' },
  { src: i('ccv-vogue-cucina-bianco'), category: 'Küche', alt: 'Küche mit Bodenfliesen in heller Holzoptik' },
  { src: i('fusion-cucina-antracite'), category: 'Küche', alt: 'Küche mit anthrazitfarbenem Boden und Mosaik an der Kücheninsel' },
  { src: i('ceramica-interni-abbazie-beaulieu-beige'), category: 'Küche', alt: 'Wohnküche mit beigefarbenen Bodenfliesen in Steinoptik' },
  { src: i('interni-ceramica-abbazie-malmedy-noir'), category: 'Küche', alt: 'Loftküche mit dunklen Bodenfliesen und Backsteinwand' },
  { src: i('naturae-aequa-tur'), category: 'Küche', alt: 'Offene Küche mit Bodenfliesen in natürlicher Holzoptik' },
  { src: i('woodland-cherry'), category: 'Küche', alt: 'Küche mit Bodenfliesen in rötlicher Holzoptik' },
  { src: i('ceramica-effetto-legno-misingi-grows--ajous-120'), category: 'Wohnen', alt: 'Wohnraum mit Bodenfliesen in heller Holzoptik und großer Glasfront' },
  { src: i('ceramica-esposizioni-ubahn-amburgo'), category: 'Wohnen', alt: 'Wohn- und Essbereich mit hellen Bodenfliesen' },
  { src: i('naturae-aequa-tur01'), category: 'Wohnen', alt: 'Schlafzimmer mit Bodenfliesen in warmer Holzoptik' },
  { src: i('naturae-aequa-tur-particolare'), category: 'Wohnen', alt: 'Detail: Bodenfliesen in Holzoptik im Streiflicht' },
  { src: i('pavimenti-da-interni-ubahn-francoforte'), category: 'Wohnen', alt: 'Loft-Schlafzimmer mit hellen Bodenfliesen in Steinoptik' },
  { src: i('fusion-cotto'), category: 'Wohnen', alt: 'Loft mit Bodenfliesen in Cotto-Tönen' },
  { src: i('woodland-walnuts-particolare'), category: 'Wohnen', alt: 'Detail: dunkle Bodenfliesen in Nussbaum-Holzoptik' },
  { src: i('woodland-elm'), category: 'Wohnen', alt: 'Wohnraum mit Boden- und Wandfliesen in Holzoptik' },
  { src: i('woodland-oak'), category: 'Wohnen', alt: 'Wohnraum mit Bodenfliesen in Eichen-Holzoptik' },
  { src: i('fusion-negozio-piombo'), category: 'Gewerbe', alt: 'Ladengeschäft mit großformatigen grauen Wand- und Bodenfliesen' },
  { src: i('woodland-maple'), category: 'Gewerbe', alt: 'Verkaufsraum mit Bodenfliesen in heller Ahorn-Holzoptik' },
  { src: i('vogue-tabacco'), category: 'Gewerbe', alt: 'Gastronomie mit Theke und Fliesen in Tabak-Holzoptik' },
];

export const inspirationCredit =
  'Herstellerbilder zur Inspiration – keine Projekte der Dierken Bau und Fliesen GmbH. Bildrechte: Ceramiche CCV Castelvetro S.p.A. / XL Style s.r.l.';

/** Kuratierte Materialien für „Material erleben“ (Herstellerbilder, illustrativ) */
export const materials = [
  {
    id: 'beton',
    name: 'Betonoptik',
    tone: 'Kühl, ruhig, großformatig',
    text: 'Große Formate, wenige Fugen: Die Fläche wirkt ruhig und lässt Raum für Licht und Möbel.',
    room: i('fusion-bagno-cemento'),
    roomAlt: 'Bad mit großformatigen Bodenfliesen in Betonoptik',
    detail: i('fusion-bagno-cemento'),
    detailPos: '62% 92%',
    detailZoom: 3.2,
  },
  {
    id: 'holz-hell',
    name: 'Holzoptik hell',
    tone: 'Leicht, freundlich, skandinavisch',
    text: 'Helle Dielenformate öffnen den Raum und bringen Wohnlichkeit auch ins Bad.',
    room: i('nature-aequa-nix'),
    roomAlt: 'Bad mit Bodenfliesen in heller Holzoptik',
    detail: i('nature-aequa-nix-particolare'),
    detailPos: '50% 85%',
    detailZoom: 1.6,
  },
  {
    id: 'holz-natur',
    name: 'Holzoptik natur',
    tone: 'Warm, lebendig, wohnlich',
    text: 'Lebendige Maserung und warme Töne – mit der Belastbarkeit eines Fliesenbodens.',
    room: i('naturae-aequa-tur'),
    roomAlt: 'Offene Küche mit Bodenfliesen in natürlicher Holzoptik',
    detail: i('naturae-aequa-tur-particolare'),
    detailPos: '50% 70%',
    detailZoom: 1.4,
  },
  {
    id: 'holz-dunkel',
    name: 'Holzoptik dunkel',
    tone: 'Tief, edel, geerdet',
    text: 'Dunkle Töne geben großen Räumen Halt und lassen helle Möbel leuchten.',
    room: i('woodland-walnuts-particolare'),
    roomAlt: 'Schlafbereich mit dunklen Bodenfliesen in Nussbaum-Holzoptik',
    detail: i('woodland-walnuts-particolare'),
    detailPos: '30% 80%',
    detailZoom: 2.2,
  },
] as const;
