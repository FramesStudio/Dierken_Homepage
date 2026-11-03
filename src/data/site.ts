/**
 * Zentrale Unternehmensdaten.
 * Quelle: www.fliesen-dierken.de (Startseite, Leistungen, Über uns, Kontakt, Impressum, Karriere),
 * abgerufen am 28.10.2026. Nur verifizierte Angaben – bei Änderungen hier pflegen.
 */
export const company = {
  name: 'Dierken Bau und Fliesen GmbH',
  short: 'Dierken',
  founded: 1985,
  managingDirector: 'Andre Dierken',
  street: 'Industriering 13',
  zip: '49393',
  city: 'Lohne',
  region: 'Niedersachsen',
  country: 'DE',
  phone: '04442 92021',
  phoneHref: 'tel:+49444292021',
  phoneIntl: '+49 4442 92021',
  fax: '04442 72679',
  email: 'info@fliesen-dierken.de',
  url: 'https://www.fliesen-dierken.de',
  facebook: 'https://www.facebook.com/Dierken-Bau-und-Fliesen-GmbH-1599381797019315/',
  register: { court: 'Amtsgericht Oldenburg', number: 'HRB 110580' },
  vatId: 'DE269035974',
  chamber: {
    name: 'Handwerkskammer Oldenburg (HWK)',
    street: 'Theaterwall 32',
    city: '26122 Oldenburg',
    url: 'https://www.hwk-oldenburg.de',
  },
} as const;

/** Öffnungszeiten der Ausstellung */
export const hours = {
  weekdays: [
    { from: '09:00', to: '12:00' },
    { from: '14:00', to: '17:30' },
  ],
  weekdayLabel: 'Montag bis Freitag',
  weekdayShort: 'Mo – Fr',
  saturday: 'Samstag nur nach vorheriger Terminvereinbarung',
  saturdayShort: 'Sa nach Vereinbarung',
} as const;

export const routeUrl =
  'https://www.google.com/maps/dir/?api=1&destination=Dierken+Bau+und+Fliesen+GmbH,+Industriering+13,+49393+Lohne';
export const osmUrl =
  'https://www.openstreetmap.org/search?query=Industriering%2013%2C%2049393%20Lohne';

import { withBase } from '../lib/url';

export const nav = [
  { href: withBase('/leistungen/'), label: 'Leistungen' },
  { href: withBase('/ausstellung/'), label: 'Ausstellung' },
  { href: withBase('/inspiration/'), label: 'Inspiration' },
  { href: withBase('/karriere/'), label: 'Karriere' },
  { href: withBase('/kontakt/'), label: 'Kontakt' },
] as const;

/** Leistungsliste – wörtlich von /leistungen.html übernommen, thematisch gruppiert */
export const serviceGroups = [
  {
    title: 'Bad',
    items: ['Badsanierung', 'Barrierefreie Bäder'],
  },
  {
    title: 'Innenräume',
    items: [
      'Verlegung von Wandfliesen und Bodenfliesen',
      'Neuverlegung von Fliesen, Platten und Natursteinen',
      'Verlegung von Marmor und Granit',
      'Zementestrich',
    ],
  },
  {
    title: 'Außenbereich',
    items: [
      'Fliesenbeläge für Treppen, Balkone und Terrassen',
      'Balkonsanierung',
      'Treppensanierung',
    ],
  },
  {
    title: 'Sanierung & Pflege',
    items: [
      'Sanierung von Fliesen und Platten',
      'Silikonverfugungen und Reparaturen',
      'Pflege und Erhaltung von vorhandenen Belägen',
    ],
  },
  {
    title: 'Planung & Handel',
    items: ['Aufmaß vor Ort und Bestimmung der Verlegewerkstoffe', 'Fliesen- und Natursteinhandel'],
  },
] as const;

/**
 * Kontaktformular: Ohne eingerichteten Versanddienst öffnet das Formular das
 * E-Mail-Programm (mailto). Sobald ein DSGVO-konformer Endpunkt existiert,
 * PUBLIC_FORM_ENDPOINT setzen (POST, JSON) – dann wird echt versendet.
 */
export const formEndpoint: string = import.meta.env.PUBLIC_FORM_ENDPOINT ?? '';
