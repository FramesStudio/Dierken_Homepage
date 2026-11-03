/** Basis-Pfad der Website: leer auf der eigenen Domain, z. B. /Dierken_Homepage in der GitHub-Pages-Vorschau. */
const BASE = import.meta.env.BASE_URL.replace(/\/$/, '');

/** Stellt einem Pfad relativ zur Domain den Basis-Pfad voran: withBase('/kontakt/'). */
export const withBase = (path: string) => (path.startsWith('/') && !path.startsWith('//') ? BASE + path : path);
