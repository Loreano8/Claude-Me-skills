import { useState, type CSSProperties, type ReactElement } from 'react';
import { ArrowUpRight, Download, Mail, MapPin, Phone, PlayCircle } from 'lucide-react';
import { PORTFOLIO_LABELS, WATERMARK_THEMES, type PortfolioData, type PortfolioTheme } from '../../shared/portfolio.ts';
import { FIELD_ICONS, motifUrl } from './motifs.ts';
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
  // Design « Onglets » : l'onglet ouvert.
  const [tab, setTab] = useState(0);
  // Design « Livre » : la page ouverte, et le début d'un glissement du doigt.
  const [leaf, setLeaf] = useState(0);
  const [touchX, setTouchX] = useState<number | null>(null);
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

  // Motifs et pictogramme du métier (santé, code, finance…), en filigrane derrière le haut de la page.
  const field = data.field || '';
  // Le motif s'efface vers le bas : un filigrane, pas un papier peint.
  const mask = motifUrl(field) ? `${motifUrl(field)}, linear-gradient(#000 35%, transparent)` : null;
  const FieldIcon = field ? FIELD_ICONS[field] : null;
  const watermark = WATERMARK_THEMES.includes(theme);
  // Designs sans filigrane : une petite étiquette du métier au-dessus du nom.
  const fieldTag = !watermark && field && FieldIcon ? (
    <p className="pf-field-tag">
      <FieldIcon aria-hidden="true" /> {L.fields[field]}
    </p>
  ) : null;
  const motif = mask && watermark ? (
    <>
      <div className="pf-motif" aria-hidden="true" style={{ WebkitMaskImage: mask, maskImage: mask }} />
      {FieldIcon && field !== 'general' && (
        <div className="pf-field-art" aria-hidden="true">
          <FieldIcon />
        </div>
      )}
    </>
  ) : null;
  const titleLine = data.title && (
    <p className="pf-title">
      {FieldIcon && (
        <span className="pf-field-icon" aria-hidden="true">
          <FieldIcon />
        </span>
      )}
      {data.title}
    </p>
  );

  const identity = (
    <div className="pf-id">
      <div className="pf-avatar" aria-hidden={!data.photo}>
        {data.photo ? <img src={data.photo} alt={data.name} /> : <span>{initials || '·'}</span>}
      </div>
      <div className="pf-id-text">
        {fieldTag}
        <h1 className="pf-name">{data.name}</h1>
        {titleLine}
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


  const cls = `pf pf--${theme}${data.accent ? ' pf--custom' : ''}`;


  // « Dossier » : comme un dossier imprimé (couverture, sommaire, une page par partie), noir et or.
  if (theme === 'dossier') {
    // Une page par grand thème : les petites parties se partagent une page (pas de page presque vide).
    const part = (title: string, node: unknown) => (node ? (
      <div key={title}>
        <h3 className="pf-sub">{title}</h3>
        {node as never}
      </div>
    ) : null);
    const group = (...items: (ReactElement | null)[]) => {
      const kept = items.filter(Boolean);
      return kept.length ? kept : null;
    };
    const pages = [
      { title: L.about, node: group(data.pitch ? <p key="p" className="pf-lead">{data.pitch}</p> : null, part(L.wins, wins ? wins.props.children[1] : null), part(L.video, video ? video.props.children[1] : null)) },
      { title: L.projects, node: projects ? projects.props.children[1] : null },
      { title: L.experience, node: experience ? experience.props.children[1] : null },
      { title: L.credentials, node: group(part(L.credentials, credentials ? credentials.props.children[1] : null), part(L.education, education ? education.props.children[1] : null)) },
      { title: L.skills, node: group(part(L.skills, skills ? skills.props.children.slice(1) : null), part(L.languages, languages ? languages.props.children[1] : null), part(L.contact, contact ? contact.props.children[1] : null)) },
    ].filter((x) => x.node);
    return (
      <div className={cls} lang={data.lang} style={rootStyle}>
        <div className="pf-book">
          <section className="pf-page pf-cover">
            {motif}
            <svg className="pf-swoosh pf-swoosh--top" viewBox="0 0 400 150" preserveAspectRatio="none" aria-hidden="true">
              <path d="M0 0h400v96C300 46 170 126 0 72z" />
              <path className="pf-swoosh-gold" d="M0 84C170 138 300 58 400 108v16C300 72 170 152 0 100z" />
            </svg>
            <svg className="pf-swoosh pf-swoosh--bottom" viewBox="0 0 400 130" preserveAspectRatio="none" aria-hidden="true">
              <path d="M0 46c140-50 260 30 400-24v108H0z" />
              <path className="pf-swoosh-gold" d="M0 30c140-50 260 30 400-24v14C260 74 140-6 0 44z" />
            </svg>
            <div className="pf-cover-body">
              <p className="pf-cover-kicker">{L.portfolio}</p>
              <div className="pf-avatar" aria-hidden={!data.photo}>
                {data.photo ? <img src={data.photo} alt={data.name} /> : <span>{initials || '·'}</span>}
              </div>
              <h1 className="pf-name">{data.name}</h1>
              {titleLine}
              {data.location && (
                <p className="pf-loc">
                  <MapPin aria-hidden="true" /> {data.location}
                </p>
              )}
              {badges}
              {actions}
            </div>
          </section>
          <section className="pf-page pf-toc">
            <h2>{L.toc}</h2>
            <ol>
              {pages.map((pg, i) => (
                <li key={pg.title}>
                  <span>{pg.title}</span>
                  <span className="pf-toc-dots" aria-hidden="true" />
                  <span>{i + 3}</span>
                </li>
              ))}
            </ol>
            {stats}
            <span className="pf-page-num">{L.page} 2</span>
          </section>
          {pages.map((pg, i) => (
            <section key={pg.title} className="pf-page">
              <h2>
                <span>{String(i + 1).padStart(2, '0')}</span> {pg.title}
              </h2>
              <div className="pf-page-body">{pg.node}</div>
              <span className="pf-page-num">{L.page} {i + 3}</span>
            </section>
          ))}
        </div>
        {footer}
      </div>
    );
  }

  // « Studio » : un site moderne de créatif ou d'indépendant (gros titre, outils, parcours en liste, appel à l'action, barre flottante).
  if (theme === 'studio') {
    return (
      <div className={cls} lang={data.lang} style={rootStyle}>
        <nav className="pf-studio-top">
          <div className="pf-wrap pf-studio-top-in">
            <span className="pf-studio-me">
              <span className="pf-avatar" aria-hidden={!data.photo}>
                {data.photo ? <img src={data.photo} alt="" /> : <span>{initials || '·'}</span>}
              </span>
              <b>{data.name}</b>
            </span>
            {data.email && (
              <a className="pf-btn pf-btn--main" href={`mailto:${data.email}`}>
                <Mail aria-hidden="true" /> {L.contact}
              </a>
            )}
          </div>
        </nav>
        <header className="pf-studio-hero">
          <div className="pf-wrap">
            {fieldTag}
            <h1 className="pf-studio-title">{data.title || data.name}</h1>
            {data.location && (
              <p className="pf-loc">
                <MapPin aria-hidden="true" /> {data.location}
              </p>
            )}
            {data.pitch && <p className="pf-pitch">{data.pitch}</p>}
            {badges}
          </div>
        </header>
        <div className="pf-wrap pf-body">
          {stats}
          {projects}
          {video}
          {skills}
          {experience}
          {wins}
          {credentials && (
            <section className="pf-sec">
              <h2>{L.credentials}</h2>
              <div className="pf-faq">
                {data.credentials.map((c, i) => (
                  <details key={i} className="pf-faq-item">
                    <summary>
                      <span>{String(i + 1).padStart(2, '0')}</span> {c.name}
                    </summary>
                    <p>{[c.issuer, c.date].filter(Boolean).join(' · ')}</p>
                  </details>
                ))}
              </div>
            </section>
          )}
          {education}
          {languages}
          <section className="pf-studio-cta">
            <h2>{L.ctaTitle}</h2>
            <p>{L.ctaText}</p>
            {actions}
          </section>
        </div>
        <footer className="pf-studio-foot">
          <div className="pf-wrap">
            {contact}
            <p className="pf-studio-giant" aria-hidden="true">{data.name}</p>
          </div>
        </footer>
        {footer}
        <div className="pf-studio-dock">
          {data.email && (
            <a href={`mailto:${data.email}`}>
              <Mail aria-hidden="true" /> {L.contact}
            </a>
          )}
          {/^https?:\/\//i.test(data.cvUrl) && (
            <a href={data.cvUrl} target="_blank" rel="noopener noreferrer">
              <Download aria-hidden="true" /> CV
            </a>
          )}
        </div>
      </div>
    );
  }


  // « Livre » : on tourne les pages comme dans un livre (boutons, flèches du clavier ou glissement du doigt).
  if (theme === 'livre') {
    const leaves = [
      <div key="cover" className="pf-leaf-cover">
        <div className="pf-avatar" aria-hidden={!data.photo}>
          {data.photo ? <img src={data.photo} alt={data.name} /> : <span>{initials || '·'}</span>}
        </div>
        <h1 className="pf-name">{data.name}</h1>
        {titleLine}
        {data.location && (
          <p className="pf-loc">
            <MapPin aria-hidden="true" /> {data.location}
          </p>
        )}
        {badges}
        {actions}
        <p className="pf-leaf-hint">{L.turn} →</p>
      </div>,
      ...[[about, stats], [video, wins], [projects], [experience], [credentials, education], [skills, languages, contact]]
        .map((g) => g.filter(Boolean))
        .filter((g) => g.length > 0)
        .map((g, i) => (
          <div key={i} className="pf-leaf-body">
            {g}
          </div>
        )),
    ];
    const last = leaves.length - 1;
    const at = Math.min(leaf, last);
    const go = (d: number) => {
      setLeaf(Math.max(0, Math.min(last, at + d)));
      // Sur téléphone, on revient en haut de la page qu'on vient d'ouvrir.
      const book = document.querySelector('.pf-livre');
      if (book && book.getBoundingClientRect().top < 0) book.scrollIntoView({ behavior: 'smooth', block: 'start' });
    };
    return (
      <div className={cls} lang={data.lang} style={rootStyle}>
        <div
          className="pf-livre"
          tabIndex={0}
          aria-roledescription="livre"
          onKeyDown={(e) => {
            if (e.key === 'ArrowRight') go(1);
            if (e.key === 'ArrowLeft') go(-1);
          }}
          onTouchStart={(e) => setTouchX(e.touches[0].clientX)}
          onTouchEnd={(e) => {
            if (touchX === null) return;
            const dx = e.changedTouches[0].clientX - touchX;
            if (Math.abs(dx) > 50) go(dx < 0 ? 1 : -1);
            setTouchX(null);
          }}
        >
          <div className="pf-livre-book">
            {leaves.map((content, i) =>
              // Seules la page ouverte et ses deux voisines existent : la hauteur du livre est celle de la page lue.
              Math.abs(i - at) > 1 ? null : (
              <section key={i} className={`pf-leaf${i < at ? ' pf-leaf--turned' : ''}${i === at ? ' pf-leaf--open' : ' pf-leaf--side'}`} style={{ zIndex: leaves.length - i }} aria-hidden={i !== at}>
                {i === 0 && motif}
                <div className="pf-leaf-inner">{content}</div>
                <span className="pf-leaf-num">
                  {i + 1} / {leaves.length}
                </span>
              </section>
              ),
            )}
          </div>
          <nav className="pf-livre-nav">
            <button type="button" onClick={() => go(-1)} disabled={at === 0} aria-label={L.prev}>
              ←
            </button>
            <span>
              {at + 1} / {leaves.length}
            </span>
            <button type="button" onClick={() => go(1)} disabled={at === last} aria-label={L.next}>
              →
            </button>
          </nav>
        </div>
        {footer}
      </div>
    );
  }

  // « Pastel » : une carte de visite au centre, gros boutons, chaque partie se déplie (comme une page « lien en bio »).
  if (theme === 'pastel') {
    const folds = [
      { key: 'about', title: L.about, node: data.pitch ? <p className="pf-lead">{data.pitch}</p> : null },
      { key: 'video', title: L.video, node: video ? video.props.children[1] : null },
      { key: 'wins', title: L.wins, node: wins ? wins.props.children[1] : null },
      { key: 'projects', title: L.projects, node: projects ? projects.props.children[1] : null },
      { key: 'experience', title: L.experience, node: experience ? experience.props.children[1] : null },
      { key: 'credentials', title: L.credentials, node: credentials ? credentials.props.children[1] : null },
      { key: 'education', title: L.education, node: education ? education.props.children[1] : null },
      { key: 'skills', title: L.skills, node: skills ? skills.props.children.slice(1) : null },
      { key: 'languages', title: L.languages, node: languages ? languages.props.children[1] : null },
    ].filter((f) => f.node);
    return (
      <div className={cls} lang={data.lang} style={rootStyle}>
        {motif}
        <div className="pf-card-wrap">
          <header className="pf-card-head">
            <div className="pf-avatar" aria-hidden={!data.photo}>
              {data.photo ? <img src={data.photo} alt={data.name} /> : <span>{initials || '·'}</span>}
            </div>
            <h1 className="pf-name">{data.name}</h1>
            {titleLine}
            {data.location && (
              <p className="pf-loc">
                <MapPin aria-hidden="true" /> {data.location}
              </p>
            )}
            {badges}
          </header>
          <div className="pf-card-links">
            {/^https?:\/\//i.test(data.cvUrl) && (
              <a className="pf-pill pf-pill--main" href={data.cvUrl} target="_blank" rel="noopener noreferrer">
                <Download aria-hidden="true" /> {L.downloadCv}
              </a>
            )}
            {data.email && (
              <a className="pf-pill" href={`mailto:${data.email}`}>
                <Mail aria-hidden="true" /> {L.contact}
              </a>
            )}
            {data.phone && (
              <a className="pf-pill" href={`tel:${data.phone.replace(/\s/g, '')}`}>
                <Phone aria-hidden="true" /> {data.phone}
              </a>
            )}
            {data.links.map((l, i) => (
              <a key={i} className="pf-pill" href={href(l.url)} target="_blank" rel="noopener noreferrer">
                <ArrowUpRight aria-hidden="true" /> {l.label}
              </a>
            ))}
          </div>
          {stats}
          <div className="pf-folds">
            {folds.map((f, i) => (
              <details key={f.key} className="pf-fold" open={i < 2}>
                <summary>{f.title}</summary>
                <div className="pf-fold-body">{f.node}</div>
              </details>
            ))}
          </div>
          {footer}
        </div>
      </div>
    );
  }

  // « Onde » : une frise au centre ; le parcours et la formation se lisent comme une histoire, de la plus récente à la plus ancienne.
  if (theme === 'onde') {
    const steps = [
      ...data.experiences.map((e) => ({ kind: 'exp' as const, dates: e.dates, title: e.position, meta: [e.company, e.location].filter(Boolean).join(' · '), points: e.points })),
      ...data.education.map((e) => ({ kind: 'edu' as const, dates: e.dates, title: e.degree, meta: e.school, points: [] as string[] })),
    ];
    return (
      <div className={cls} lang={data.lang} style={rootStyle}>
        {motif}
        <header className="pf-hero">
          <div className="pf-wrap pf-hero-grid">
            <div>
              {identity}
              {data.pitch && <p className="pf-pitch">{data.pitch}</p>}
            </div>
            <div className="pf-hero-side">
              {badges}
              {actions}
            </div>
          </div>
        </header>
        <div className="pf-wrap pf-body">
          {stats}
          {video}
          {wins}
          {steps.length > 0 && (
            <section className="pf-frise-sec">
              <h2>{L.experience}</h2>
              <ol className="pf-frise">
                {steps.map((st, i) => (
                  <li key={i} className={`pf-frise-item pf-frise-item--${st.kind}`}>
                    <span className="pf-frise-dot" aria-hidden="true" />
                    <div className="pf-frise-card">
                      {st.dates && <span className="pf-frise-date">{st.dates}</span>}
                      <h3>{st.title}</h3>
                      {st.meta && <p className="pf-meta">{st.meta}</p>}
                      {st.points.length > 0 && (
                        <ul>
                          {st.points.map((pt, j) => (
                            <li key={j}>{pt}</li>
                          ))}
                        </ul>
                      )}
                    </div>
                  </li>
                ))}
              </ol>
            </section>
          )}
          {projects}
          <div className="pf-strip">
            {skills}
            {credentials}
            {languages}
            {contact}
          </div>
        </div>
        {footer}
      </div>
    );
  }

  // « Soleil » : une diapositive par partie, plein écran, qui s'enchaînent au défilement.
  if (theme === 'soleil') {
    const slides = [about, video, wins, projects, experience, credentials, education, skills, languages, contact].filter(Boolean);
    return (
      <div className={cls} lang={data.lang} style={rootStyle}>
        {motif}
        <section className="pf-slide pf-slide--cover">
          <div className="pf-wrap">
            {identity}
            {badges}
            {actions}
            {stats}
          </div>
        </section>
        {slides.map((sl, i) => (
          <section key={i} className="pf-slide">
            <div className="pf-wrap">
              <span className="pf-slide-num">
                {String(i + 1).padStart(2, '0')} / {String(slides.length).padStart(2, '0')}
              </span>
              {sl}
            </div>
          </section>
        ))}
        {footer}
      </div>
    );
  }

  // « Aurore » : comme une appli, des onglets en haut ; on passe d'une partie à l'autre sans faire défiler.
  if (theme === 'aurore') {
    const tabs = [
      { title: L.about, node: [about, stats, video, wins] },
      { title: L.projects, node: [projects] },
      { title: L.experience, node: [experience, education, credentials] },
      { title: L.skills, node: [skills, languages] },
      { title: L.contact, node: [contact] },
    ].filter((x) => x.node.some(Boolean));
    const current = Math.min(tab, tabs.length - 1);
    return (
      <div className={cls} lang={data.lang} style={rootStyle}>
        {motif}
        <header className="pf-hero">
          <div className="pf-wrap pf-hero-grid">
            <div>{identity}</div>
            <div className="pf-hero-side">
              {badges}
              {actions}
            </div>
          </div>
        </header>
        <div className="pf-wrap">
          <nav className="pf-tabs" role="tablist" aria-label={data.name}>
            {tabs.map((x, i) => (
              <button key={x.title} type="button" role="tab" aria-selected={i === current} className={i === current ? 'pf-tab pf-tab--on' : 'pf-tab'} onClick={() => setTab(i)}>
                {x.title}
              </button>
            ))}
          </nav>
          <div key={current} className="pf-tab-panel" role="tabpanel">
            {tabs[current]?.node}
          </div>
        </div>
        {footer}
      </div>
    );
  }

  // « Colonne » : profil fixe à gauche, contenu à droite. Les autres : en-tête, puis le contenu.
  if (theme === 'colonne') {
    return (
      <div className={`pf pf--${theme}${data.accent ? ' pf--custom' : ''}`} lang={data.lang} style={rootStyle}>
        <div className="pf-shell">
          <aside className="pf-side">
            {motif}
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
      <div className={`pf pf--${theme}${data.accent ? ' pf--custom' : ''}`} lang={data.lang} style={rootStyle}>
        {motif}
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
    <div className={`pf pf--${theme}${data.accent ? ' pf--custom' : ''}`} lang={data.lang} style={rootStyle}>
      <header className="pf-hero">
        {motif}
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
