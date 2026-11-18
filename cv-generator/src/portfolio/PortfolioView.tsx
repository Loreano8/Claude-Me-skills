import type { CSSProperties } from 'react';
import { ArrowUpRight, Download, Mail, MapPin, Phone, PlayCircle } from 'lucide-react';
import { PORTFOLIO_LABELS, type PortfolioData, type PortfolioTheme } from '../../shared/portfolio.ts';
import './portfolio.css';

/** Lien YouTube, Vimeo ou Loom → adresse du lecteur intégré ; null si le lien n'est pas reconnu. */
export function videoEmbed(url: string): string | null {
  const u = url.trim();
  let m = /(?:youtube\.com\/(?:watch\?(?:.*&)?v=|shorts\/|embed\/)|youtu\.be\/)([\w-]{6,20})/i.exec(u);
  if (m) return `https://www.youtube-nocookie.com/embed/${m[1]}`;
  m = /vimeo\.com\/(?:video\/)?(\d{5,12})/i.exec(u);
  if (m) return `https://player.vimeo.com/video/${m[1]}`;
  m = /loom\.com\/(?:share|embed)\/([a-f0-9]{16,40})/i.exec(u);
  if (m) return `https://www.loom.com/embed/${m[1]}`;
  return null;
}

/**
 * Taille d'une tuile projet (Bento, 4 colonnes) pour remplir la grille sans trou :
 * 5 projets = une grande tuile et 4 petites ; nombre impair = le premier sur toute la largeur ; sinon deux par ligne.
 */
function projectSpan(i: number, n: number): string {
  if (n === 5) return i === 0 ? 'pf-tile--hero' : '';
  if (n % 2 === 1 && i === 0) return 'pf-tile--full';
  return 'pf-tile--half';
}

/**
 * La page portfolio, telle que la voit un recruteur. Le même composant sert à l'aperçu dans l'appli
 * et à la page publique (cvcasa.com/p/#lien). Les 4 designs partagent le contenu ; seule la mise en page change.
 */
export function PortfolioView({ data, theme, pro, home = 'https://cvcasa.com/?src=portfolio' }: { data: PortfolioData; theme: PortfolioTheme; pro: boolean; home?: string }) {
  const L = PORTFOLIO_LABELS[data.lang];
  const initials = data.name
    .split(/\s+/)
    .map((w) => w[0])
    .filter(Boolean)
    .slice(0, 2)
    .join('')
    .toUpperCase();
  // Couleur choisie par la personne (ou tirée d'un portfolio qui l'inspire) : elle remplace celle du design.
  const rootStyle = (data.accent ? { '--accent': data.accent } : undefined) as CSSProperties | undefined;
  const href = (u: string) => (/^https?:\/\//i.test(u) ? u : `https://${u}`);

  const identity = (
    <div className="pf-id">
      <div className="pf-avatar" aria-hidden={!data.photo}>
        {data.photo ? <img src={data.photo} alt={data.name} /> : <span>{initials || '·'}</span>}
      </div>
      <div className="pf-id-text">
        <h1 className="pf-name">{data.name}</h1>
        {data.title && <p className="pf-title">{data.title}</p>}
        {data.location && (
          <p className="pf-loc">
            <MapPin aria-hidden="true" /> {data.location}
          </p>
        )}
      </div>
    </div>
  );

  const actions = (
    <div className="pf-actions">
      {/^https?:\/\//i.test(data.cvUrl) && (
        <a className="pf-btn pf-btn--main" href={data.cvUrl} target="_blank" rel="noopener noreferrer">
          <Download aria-hidden="true" /> {L.downloadCv}
        </a>
      )}
      {data.email && (
        <a className="pf-btn pf-btn--alt" href={`mailto:${data.email}`}>
          <Mail aria-hidden="true" /> {L.contact}
        </a>
      )}
    </div>
  );

  const badges = data.badges.length > 0 && (
    <ul className="pf-badges">
      {data.badges.map((b, i) => (
        <li key={i} className={i === 0 ? 'pf-badge pf-badge--hi' : 'pf-badge'}>
          {b}
        </li>
      ))}
    </ul>
  );

  const contact = (data.email || data.phone || data.links.length > 0) && (
    <section className="pf-sec pf-contact">
      <h2>{L.contact}</h2>
      <ul>
        {data.email && (
          <li>
            <Mail aria-hidden="true" /> <a href={`mailto:${data.email}`}>{data.email}</a>
          </li>
        )}
        {data.phone && (
          <li>
            <Phone aria-hidden="true" /> <a href={`tel:${data.phone.replace(/\s/g, '')}`}>{data.phone}</a>
          </li>
        )}
        {data.links.map((l, i) => (
          <li key={i}>
            <ArrowUpRight aria-hidden="true" /> <a href={href(l.url)} target="_blank" rel="noopener noreferrer">{l.label}</a>
          </li>
        ))}
      </ul>
    </section>
  );

  const stats = data.stats.length > 0 && (
    <div className="pf-stats">
      {data.stats.map((s, i) => (
        <div key={i} className="pf-stat">
          <b>{s.value}</b>
          <span>{s.label}</span>
        </div>
      ))}
    </div>
  );

  const about = data.pitch && (
    <section className="pf-sec pf-about">
      <h2>{L.about}</h2>
      <p>{data.pitch}</p>
    </section>
  );

  const wins = data.wins.length > 0 && (
    <section className="pf-sec">
      <h2>{L.wins}</h2>
      <div className="pf-wins">
        {data.wins.map((w, i) => (
          <article key={i} className="pf-win">
            <div className="pf-win-value">{w.value}</div>
            <h3>{w.title}</h3>
            {w.text && <p>{w.text}</p>}
          </article>
        ))}
      </div>
    </section>
  );

  const projects = data.projects.length > 0 && (
    <section className="pf-sec">
      <h2>{L.projects}</h2>
      <div className="pf-projects">
        {data.projects.map((p, i) => (
          <article key={i} className="pf-project">
            {p.image && <img src={p.image} alt={p.title} loading="lazy" />}
            <div className="pf-project-body">
              <h3>{p.title}</h3>
              {p.text && <p>{p.text}</p>}
              {p.link && (
                <a href={href(p.link)} target="_blank" rel="noopener noreferrer">
                  {p.link.replace(/^https?:\/\//, '').replace(/\/$/, '').slice(0, 40)} <ArrowUpRight aria-hidden="true" />
                </a>
              )}
            </div>
          </article>
        ))}
      </div>
    </section>
  );

  const experience = data.experiences.length > 0 && (
    <section className="pf-sec">
      <h2>{L.experience}</h2>
      <ol className="pf-timeline">
        {data.experiences.map((e, i) => (
          <li key={i}>
            <div className="pf-tl-head">
              <h3>{e.position}</h3>
              {e.dates && <span className="pf-dates">{e.dates}</span>}
            </div>
            <p className="pf-meta">{[e.company, e.location].filter(Boolean).join(' · ')}</p>
            {e.points.length > 0 && (
              <ul>
                {e.points.map((pt, j) => (
                  <li key={j}>{pt}</li>
                ))}
              </ul>
            )}
          </li>
        ))}
      </ol>
    </section>
  );

  const credentials = data.credentials.length > 0 && (
    <section className="pf-sec">
      <h2>{L.credentials}</h2>
      <ul className="pf-creds">
        {data.credentials.map((c, i) => (
          <li key={i}>
            <span className="pf-cred-mark" aria-hidden="true">✓</span>
            <div>
              <h3>{c.name}</h3>
              <p>{[c.issuer, c.date].filter(Boolean).join(' · ')}</p>
            </div>
          </li>
        ))}
      </ul>
    </section>
  );

  const education = data.education.length > 0 && (
    <section className="pf-sec">
      <h2>{L.education}</h2>
      <ul className="pf-edu">
        {data.education.map((e, i) => (
          <li key={i}>
            <h3>{e.degree}</h3>
            <p>{[e.school, e.dates].filter(Boolean).join(' · ')}</p>
          </li>
        ))}
      </ul>
    </section>
  );

  const skills = data.skills.length > 0 && (
    <section className="pf-sec">
      <h2>{L.skills}</h2>
      {data.skills.map((g, i) => (
        <div key={i} className="pf-skill-group">
          <h3>{g.group}</h3>
          <ul className="pf-chips">
            {g.items.map((s, j) => (
              <li key={j}>{s}</li>
            ))}
          </ul>
        </div>
      ))}
    </section>
  );

  const languages = data.languages.length > 0 && (
    <section className="pf-sec">
      <h2>{L.languages}</h2>
      <ul className="pf-langs">
        {data.languages.map((x, i) => (
          <li key={i}>{x}</li>
        ))}
      </ul>
    </section>
  );

  const ticker = [...data.badges, ...data.skills.flatMap((g) => g.items)].slice(0, 16);
  const embed = data.video ? videoEmbed(data.video) : null;
  const video = data.video && (
    <section className="pf-sec pf-video">
      <h2>{L.video}</h2>
      {embed ? (
        <div className="pf-video-frame">
          <iframe src={embed} title={L.video} loading="lazy" allow="autoplay; fullscreen; picture-in-picture" allowFullScreen />
        </div>
      ) : (
        /^https?:\/\//i.test(data.video) && (
          <a className="pf-btn pf-btn--alt" href={data.video} target="_blank" rel="noopener noreferrer">
            <PlayCircle aria-hidden="true" /> {L.watch}
          </a>
        )
      )}
    </section>
  );

  const footer = (
    <footer className="pf-foot">
      {pro ? (
        <span>{data.name}</span>
      ) : (
        <span>
          {L.madeWith} <a href={home}>CVCasa</a> · <a href={home}>{L.makeYours}</a>
        </span>
      )}
    </footer>
  );

  // « Colonne » : profil fixe à gauche, contenu à droite. Les autres : en-tête, puis le contenu.
  if (theme === 'colonne') {
    return (
      <div className={`pf pf--${theme}`} lang={data.lang} style={rootStyle}>
        <div className="pf-shell">
          <aside className="pf-side">
            {identity}
            {badges}
            {actions}
            {contact}
            {skills}
            {languages}
          </aside>
          <main className="pf-main">
            {stats}
            {about}
            {video}
            {wins}
            {projects}
            {experience}
            {credentials}
            {education}
            {footer}
          </main>
        </div>
      </div>
    );
  }

  // « Bento » : des tuiles de tailles différentes, comme une boîte à compartiments.
  if (theme === 'bento') {
    const sectionTiles = [
      { key: 'wins', node: wins },
      { key: 'experience', node: experience },
      { key: 'skills', node: skills },
      { key: 'credentials', node: credentials },
      { key: 'education', node: education },
      { key: 'languages', node: languages },
      { key: 'contact', node: contact },
    ].filter((x) => x.node);
    return (
      <div className={`pf pf--${theme}`} lang={data.lang} style={rootStyle}>
        <div className="pf-wrap pf-bento">
          <section className="pf-tile pf-tile--id">
            {identity}
            {data.pitch && <p className="pf-pitch">{data.pitch}</p>}
            {actions}
          </section>
          {data.stats.map((s, i) => (
            <div key={i} className={`pf-tile pf-tile--stat pf-tile--s${i}`}>
              <b>{s.value}</b>
              <span>{s.label}</span>
            </div>
          ))}
          {data.badges.length > 0 && <div className="pf-tile pf-tile--badges">{badges}</div>}
          {video && <div className="pf-tile pf-tile--full">{video}</div>}
          {data.projects.map((p, i) => (
            <article key={i} className={`pf-tile pf-tile--project ${projectSpan(i, data.projects.length)}`}>
              {p.image && <img src={p.image} alt={p.title} loading="lazy" />}
              <div className="pf-project-body">
                <h3>{p.title}</h3>
                {p.text && <p>{p.text}</p>}
                {p.link && (
                  <a href={href(p.link)} target="_blank" rel="noopener noreferrer">
                    {p.link.replace(/^https?:\/\//, '').replace(/\/$/, '').slice(0, 40)} <ArrowUpRight aria-hidden="true" />
                  </a>
                )}
              </div>
            </article>
          ))}
          {sectionTiles.map((tile, i) => (
            // Nombre impair de tuiles : la dernière prend toute la largeur, pour ne pas laisser de trou.
            <div key={tile.key} className={`pf-tile${tile.key === 'contact' ? ' pf-tile--contact' : ''}${sectionTiles.length % 2 === 1 && i === sectionTiles.length - 1 ? ' pf-tile--full' : ''}`}>
              {tile.node}
            </div>
          ))}
        </div>
        {footer}
      </div>
    );
  }

  return (
    <div className={`pf pf--${theme}`} lang={data.lang} style={rootStyle}>
      <header className="pf-hero">
        <div className="pf-wrap pf-hero-grid">
          <div>
            {identity}
            {data.pitch && theme !== 'epure' && <p className="pf-pitch">{data.pitch}</p>}
          </div>
          <div className="pf-hero-side">
            {badges}
            {actions}
          </div>
        </div>
      </header>
      {theme === 'defile' && ticker.length > 0 && (
        // Bande où défilent compétences et atouts (doublée pour une boucle sans à-coup).
        <div className="pf-ticker" aria-hidden="true">
          <div className="pf-ticker-track">
            {[...ticker, ...ticker].map((x, i) => (
              <span key={i}>{x}</span>
            ))}
          </div>
        </div>
      )}
      <div className="pf-wrap pf-body">
        {stats}
        <div className="pf-grid">
          <div className="pf-col">
            {theme === 'epure' && about}
            {video}
            {theme === 'creatif' && projects}
            {wins}
            {theme !== 'creatif' && projects}
            {experience}
            {credentials}
          </div>
          <div className="pf-col">
            {skills}
            {education}
            {languages}
            {contact}
          </div>
        </div>
      </div>
      {footer}
    </div>
  );
}
