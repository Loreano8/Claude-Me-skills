// Lecture d'une offre d'emploi à partir de son lien (LinkedIn, site d'emploi, page d'entreprise…).
// Le serveur télécharge la page publique et en extrait le texte utile ; l'IA le lit ensuite comme
// une offre collée à la main. Aucune connexion à un compte : seules les pages publiques sont lisibles.

export class JobPageError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message);
  }
}

export interface JobPage {
  url: string;
  title: string;
  text: string;
}

const MAX_BYTES = 3 * 1024 * 1024;
const MAX_TEXT = 20_000;
const MAX_REDIRECTS = 5;
const TIMEOUT_MS = 12_000;
const HEADERS = {
  'User-Agent': 'Mozilla/5.0 (Linux; Android 14) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0 Mobile Safari/537.36',
  Accept: 'text/html,application/xhtml+xml',
  'Accept-Language': 'fr-FR,fr;q=0.9,en;q=0.8',
};

const UNREADABLE =
  'Impossible de lire cette page automatiquement (elle demande sans doute une connexion). ' +
  'Copiez le texte de l’annonce et collez-le ici, ou envoyez une capture d’écran.';

/** Premier lien http(s) trouvé dans un texte partagé (« Regardez cette offre : https://… »). */
export function firstUrl(text: string): string | null {
  const m = text.match(/https?:\/\/[^\s<>"']+/i);
  return m ? m[0].replace(/[).,;!?»]+$/, '') : null;
}

/** Refuse les adresses internes : le serveur ne doit aller chercher que des pages publiques. */
export function checkPublicUrl(raw: string): URL {
  let url: URL;
  try {
    url = new URL(raw.trim());
  } catch {
    throw new JobPageError('Ce lien n’est pas valide.', 400);
  }
  if (url.protocol !== 'https:' && url.protocol !== 'http:') throw new JobPageError('Ce lien n’est pas valide.', 400);
  if (url.username || url.password || (url.port && url.port !== '80' && url.port !== '443')) {
    throw new JobPageError('Ce lien n’est pas pris en charge.', 400);
  }
  const host = url.hostname.toLowerCase().replace(/^\[|\]$/g, '');
  const privateHost =
    host === 'localhost' ||
    !host.includes('.') ||
    /\.(local|localhost|internal|lan|home|corp)$/.test(host) ||
    /^(0|10|127)\./.test(host) ||
    /^169\.254\./.test(host) ||
    /^192\.168\./.test(host) ||
    /^172\.(1[6-9]|2\d|3[01])\./.test(host) ||
    /^100\.(6[4-9]|[7-9]\d|1[01]\d|12[0-7])\./.test(host) ||
    host.includes(':'); // adresses IPv6 littérales
  if (privateHost) throw new JobPageError('Ce lien n’est pas pris en charge.', 400);
  return url;
}

const ENTITIES: Record<string, string> = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ', rsquo: '’', lsquo: '‘', laquo: '«', raquo: '»', hellip: '…', ndash: '–', mdash: '—', eacute: 'é', egrave: 'è', agrave: 'à', ccedil: 'ç', ecirc: 'ê', ocirc: 'ô', icirc: 'î', ucirc: 'û' };

function decode(s: string): string {
  return s.replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, (all, code: string) => {
    if (code[0] === '#') {
      const n = code[1] === 'x' || code[1] === 'X' ? parseInt(code.slice(2), 16) : parseInt(code.slice(1), 10);
      return Number.isFinite(n) && n > 0 && n < 0x110000 ? String.fromCodePoint(n) : '';
    }
    return ENTITIES[code.toLowerCase()] ?? all;
  });
}

/** HTML → texte lisible : les blocs deviennent des lignes, le reste est retiré. */
export function htmlToText(html: string): string {
  return decode(
    html
      .replace(/<(script|style|noscript|svg|template|iframe|head|nav|footer)\b[\s\S]*?<\/\1>/gi, ' ')
      .replace(/<!--[\s\S]*?-->/g, ' ')
      .replace(/<li\b[^>]*>/gi, '\n• ')
      .replace(/<(br|\/p|\/div|\/h[1-6]|\/li|\/ul|\/ol|\/tr|\/section|\/article)\b[^>]*>/gi, '\n')
      .replace(/<[^>]+>/g, ' '),
  )
    .replace(/[ \t ]+/g, ' ')
    .replace(/ *\n */g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

function meta(html: string, name: string): string {
  const re = new RegExp(`<meta[^>]+(?:property|name)=["']${name}["'][^>]*>`, 'i');
  const tag = html.match(re)?.[0];
  const content = tag?.match(/content=["']([^"']*)["']/i)?.[1];
  return content ? decode(content).trim() : '';
}

/** Offre décrite en données structurées (JobPosting) : présente sur la plupart des sites d'emploi. */
function jobPosting(html: string): string {
  for (const m of html.matchAll(/<script[^>]+application\/ld\+json[^>]*>([\s\S]*?)<\/script>/gi)) {
    try {
      const data = JSON.parse(m[1].trim());
      const items: unknown[] = Array.isArray(data) ? data : Array.isArray(data?.['@graph']) ? data['@graph'] : [data];
      for (const item of items as Record<string, any>[]) {
        if (item?.['@type'] !== 'JobPosting') continue;
        const org = item.hiringOrganization?.name;
        const place = [item.jobLocation]
          .flat()
          .map((l: any) => [l?.address?.addressLocality, l?.address?.addressCountry?.name ?? l?.address?.addressCountry].filter(Boolean).join(', '))
          .filter(Boolean)
          .join(' ; ');
        return [
          item.title && `Poste : ${item.title}`,
          org && `Entreprise : ${org}`,
          place && `Lieu : ${place}`,
          item.employmentType && `Contrat : ${[item.employmentType].flat().join(', ')}`,
          // La description est parfois encodée deux fois (&lt;p&gt;) : on décode avant de retirer les balises.
          item.description && htmlToText(decode(String(item.description))),
        ]
          .filter(Boolean)
          .join('\n');
      }
    } catch {
      // JSON mal formé : on passe au suivant.
    }
  }
  return '';
}

/** Extrait le texte utile d'une page d'offre. Exportée pour les tests. */
export function extractJob(html: string, url: string): JobPage {
  const title = meta(html, 'og:title') || decode(html.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1] ?? '').trim();
  const description = meta(html, 'og:description') || meta(html, 'description');
  const structured = jobPosting(html);
  const main = html.match(/<(main|article)\b[\s\S]*<\/\1>/i)?.[0];
  const body = htmlToText(main ?? html.match(/<body\b[\s\S]*<\/body>/i)?.[0] ?? html);
  // Les données structurées sont les plus fiables ; sinon le corps de la page ; sinon le résumé de partage
  // (c'est souvent tout ce qu'une publication LinkedIn montre sans connexion).
  let text = structured.length > 200 ? structured : body.length > 300 ? body : [title, description, body].filter(Boolean).join('\n\n');
  if (text.length > MAX_TEXT) text = `${text.slice(0, MAX_TEXT)}…`;
  return { url, title, text };
}

/** Télécharge la page (redirections vérifiées une à une) et renvoie le texte de l'offre. */
export async function fetchJobPage(raw: string, fetchImpl: typeof fetch = fetch): Promise<JobPage> {
  let url = checkPublicUrl(raw);
  let res: Response | null = null;
  const signal = AbortSignal.timeout(TIMEOUT_MS);
  try {
    for (let hop = 0; hop <= MAX_REDIRECTS; hop++) {
      res = await fetchImpl(url, {
        redirect: 'manual',
        signal,
        headers: HEADERS,
      });
      // LinkedIn répond parfois 999 (ou 429) à la première demande : un seul nouvel essai.
      if ((res.status === 999 || res.status === 429) && hop === 0) {
        await new Promise((r) => setTimeout(r, 800));
        res = await fetchImpl(url, { redirect: 'manual', signal, headers: HEADERS });
      }
      const next = res.status >= 300 && res.status < 400 ? res.headers.get('location') : null;
      if (!next) break;
      url = checkPublicUrl(new URL(next, url).toString());
      res = null;
    }
  } catch (e) {
    if (e instanceof JobPageError) throw e;
    throw new JobPageError('La page met trop de temps à répondre ou est inaccessible. Copiez le texte de l’annonce.', 502);
  }
  if (!res) throw new JobPageError(UNREADABLE, 422);
  if (/authwall|login|signin|checkpoint/i.test(url.pathname) || !res.ok) throw new JobPageError(UNREADABLE, 422);
  const type = res.headers.get('content-type') ?? '';
  if (!/html|text\/plain/i.test(type)) {
    throw new JobPageError('Ce lien ne mène pas à une page web. Si c’est un PDF, téléchargez-le puis importez-le.', 422);
  }

  // Lecture plafonnée : une page énorme ne doit pas saturer le serveur.
  const reader = res.body?.getReader();
  const chunks: Uint8Array[] = [];
  let size = 0;
  if (reader) {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.length;
      chunks.push(value);
      if (size > MAX_BYTES) {
        await reader.cancel();
        break;
      }
    }
  }
  const bytes = new Uint8Array(size);
  let at = 0;
  for (const c of chunks) {
    bytes.set(c.subarray(0, Math.max(0, Math.min(c.length, size - at))), at);
    at += c.length;
  }
  const html = new TextDecoder('utf-8').decode(bytes);
  const page = extractJob(html, url.toString());
  // Page de connexion ou d'inscription servie à la place de la publication.
  const loginWall = /s.inscrire|inscrivez-vous|sign ?up|log ?in|se connecter|identifiez-vous|connexion/i.test(page.title) && page.text.length < 3000;
  if (page.text.length < 120 || loginWall) throw new JobPageError(UNREADABLE, 422);
  return page;
}
