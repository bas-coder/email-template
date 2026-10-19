#!/usr/bin/env node
/*
 * AIWA email build.
 *
 *   node build.js            build dist/ and preview/
 *   node build.js --watch    rebuild when src/, assets/ or config.json change
 *   node build.js --serve    watch + live server on http://localhost:5510 (opens the preview gallery)
 *
 * Two kinds of placeholders:
 *   [[name]]  filled here, at build time (layout slots, tab text, button labels...)
 *   {{name}}  left in dist/ for the sending code to fill (first_name, action_url...).
 *             preview/ fills them with each email's "sample" values.
 */
const fs = require('fs');
const path = require('path');

const ROOT = __dirname;
const SRC = path.join(ROOT, 'src');
const read = (p) => fs.readFileSync(path.join(ROOT, p), 'utf8');
const mod = (name) => read(`src/modules/${name}.html`).replace(/\n$/, '');

// Vertical rhythm between content blocks, taken from the Figma frames.
// [space before, space after]; the larger of (previous.after, current.before) wins.
const SPACE = { p: [16, 16], button: [32, 32], fallback: [32, 32], code: [32, 32], signoff: [32, 0] };
// The button row carries its glow inside its own padding (20 above, 26 below), so that much comes off the gap.
const INSET = { button: [20, 26] };

function fill(tpl, vars, where) {
  return tpl.replace(/\[\[(\w+)\]\]/g, (m, key) => {
    if (key in vars) return vars[key];
    throw new Error(`Missing [[${key}]] in ${where}`);
  });
}

const escapeHtml = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

function renderBlocks(blocks, base, name) {
  let out = [];
  let prev = null;
  for (const b of blocks) {
    if (!SPACE[b.type]) throw new Error(`Unknown block type "${b.type}" in ${name}`);
    let gap = prev ? Math.max(SPACE[prev.type][1], SPACE[b.type][0]) : 0;
    if (prev && INSET[prev.type]) gap -= INSET[prev.type][1];
    if (INSET[b.type]) gap -= INSET[b.type][0];
    gap = Math.max(gap, 0);
    const v = { ...base, gap };
    if (b.type === 'p') out.push(fill(mod('paragraph'), { ...v, html: b.html }, name));
    if (b.type === 'button') out.push(fill(mod('button'), {
      ...v,
      label: b.label,
      url: b.url,
      arrow: b.arrow ? `<img class="light-img" src="${base.asset_base_url}/arrow.png" width="17" height="17" alt="" style="display:inline-block; width:17px; height:17px; margin-left:6px; vertical-align:-4px; border:0;"><!--[if !mso]><!--><span class="dark-img-inline" style="display:none; max-height:0; overflow:hidden; mso-hide:all;"><img src="${base.asset_base_url}/arrow-dark.png" width="17" height="17" alt="" style="display:inline-block; width:17px; height:17px; margin-left:6px; vertical-align:-4px; border:0;"></span><!--<![endif]-->` : '',
      mso_arrow: b.arrow ? '&nbsp;&nbsp;&rarr;' : '',
      mso_width: Math.round(b.label.length * 8.4 + 32 + (b.arrow ? 22 : 0)),
    }, name));
    if (b.type === 'fallback') out.push(fill(mod('fallback'), { ...v, url: b.url }, name));
    if (b.type === 'code') out.push(fill(mod('code'), { ...v, code: b.code }, name));
    if (b.type === 'signoff') out.push(fill(mod('signoff'), { ...v, signer: base.signer }, name));
    prev = b;
  }
  return out.join('\n');
}

function renderEmail(email, name, config) {
  const base = {
    asset_base_url: config.assetBaseUrl,
    home_url: config.homeUrl,
    address_url: config.addressUrl,
    signer: config.signer,
  };
  const tab_html = fill(mod('tab'), { tab: email.tab }, name);
  let header;
  if (email.header === 'title') {
    header = fill(mod('header-title'), { tab_html, title: email.title }, name);
  } else {
    const hero_dark_html = email.heroDark
      ? `<!--[if !mso]><!--><div class="dark-img" style="display:none; max-height:0; overflow:hidden; mso-hide:all;"><img class="hero-img" src="${base.asset_base_url}/${email.heroDark}" width="548" height="224" alt="${email.heroAlt}" style="display:block; width:100%; max-width:548px; height:auto; border:0; border-radius:10px;"></div><!--<![endif]-->`
      : '';
    header = fill(mod('header-hero'), {
      ...base, tab_html, hero: email.hero, hero_class: email.heroDark ? 'light-img hero-img' : 'hero-img', hero_alt: email.heroAlt, hero_href: email.heroHref || base.home_url, hero_dark_html,
    }, name);
  }
  const socials = config.socials.map((s) => fill(mod('social'), { ...base, ...s }, name)).join('\n');
  return fill(read('src/layout.html'), {
    ...base,
    subject: email.subject,
    preheader: email.preheader,
    header,
    // Logo to tab: 31px above a hero, 55px above a title panel (as designed).
    header_gap: email.header === 'title' ? 55 : 31,
    content: renderBlocks(email.blocks, base, name),
    footer_mark: email.footerMark ? fill(mod('footer-mark'), base, name) : '',
    footer_gap: email.footerMark ? 13 : 50,
    socials,
  }, name);
}

function plainText(email, config) {
  const strip = (h) => h.replace(/<a [^>]*href="([^"]*)"[^>]*>(.*?)<\/a>/g, '$2').replace(/<[^>]+>/g, '').replace(/&rarr;/g, '->').replace(/&#127881;/g, '').replace(/&amp;/g, '&');
  const lines = [email.header === 'title' ? strip(email.title).trim() : email.tab, ''];
  for (const b of email.blocks) {
    if (b.type === 'p') lines.push(strip(b.html), '');
    if (b.type === 'code') lines.push(b.code, '');
    if (b.type === 'button') lines.push(`${b.label}: ${b.url}`, '');
    if (b.type === 'signoff') lines.push('Questions? Just reply, it reaches me directly.', '', config.signer);
  }
  lines.push('', '--', 'AIWA turns a plain-English prompt into a working full-stack app.', 'Lagos, Nigeria');
  return lines.join('\n') + '\n';
}

function fillSample(html, sample) {
  return html.replace(/\{\{(\w+)\}\}/g, (m, key) => (key in sample ? escapeHtml(sample[key]) : m));
}

function galleryPage(items) {
  const cards = items.map((it) => `
    <section class="email">
      <header>
        <h2>${escapeHtml(it.subject)}</h2>
        <p>${escapeHtml(it.audience)} &middot; <code>dist/${it.name}.html</code> &middot; ${(it.bytes / 1024).toFixed(1)} KB</p>
      </header>
      <div class="pair">
        <figure><figcaption>Light</figcaption><iframe src="${it.name}.light.html" title="${escapeHtml(it.subject)} (light)" loading="lazy"></iframe></figure>
        <figure><figcaption>Dark</figcaption><iframe src="${it.name}.dark.html" title="${escapeHtml(it.subject)} (dark)" loading="lazy"></iframe></figure>
      </div>
    </section>`).join('\n');
  return `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>AIWA Emails</title>
<style>
  :root { --bg:#EDEAE4; --ink:#25211D; --muted:#6B6357; --line:#DDD8CF; }
  * { box-sizing:border-box; }
  body { margin:0; background:var(--bg); color:var(--ink); font:14px/1.5 Inter, -apple-system, 'Segoe UI', Roboto, sans-serif; }
  .top { position:sticky; top:0; z-index:2; display:flex; gap:16px; align-items:center; justify-content:space-between; padding:14px 24px; background:rgba(237,234,228,.92); backdrop-filter:blur(8px); border-bottom:1px solid var(--line); }
  .top h1 { margin:0; font-size:16px; }
  .top label { color:var(--muted); font-size:13px; display:flex; gap:8px; align-items:center; }
  main { padding:24px; display:grid; gap:40px; }
  .email header h2 { margin:0; font-size:15px; }
  .email header p { margin:2px 0 12px; color:var(--muted); font-size:12px; }
  .pair { display:flex; gap:24px; flex-wrap:wrap; }
  figure { margin:0; }
  figcaption { font-size:12px; color:var(--muted); margin-bottom:6px; }
  iframe { width:var(--w, 600px); max-width:calc(100vw - 48px); height:1100px; border:1px solid var(--line); border-radius:12px; background:#fff; display:block; }
</style></head>
<body>
  <div class="top"><h1>AIWA Emails &middot; ${items.length} templates</h1>
    <label>Width <select id="w"><option value="600px">Desktop 600</option><option value="375px">Mobile 375</option></select></label>
  </div>
  <main>${cards}
  </main>
<script>
  const fit = (f) => { try { f.style.height = '10px'; f.style.height = (f.contentDocument.documentElement.scrollHeight + 2) + 'px'; } catch (e) {} };
  document.querySelectorAll('iframe').forEach((f) => f.addEventListener('load', () => fit(f)));
  document.getElementById('w').addEventListener('change', (e) => {
    document.documentElement.style.setProperty('--w', e.target.value);
    setTimeout(() => document.querySelectorAll('iframe').forEach(fit), 50);
  });
</script>
</body></html>
`;
}

function build() {
  const t0 = Date.now();
  const config = JSON.parse(read('config.json'));
  const dist = path.join(ROOT, 'dist');
  const preview = path.join(ROOT, 'preview');
  fs.mkdirSync(dist, { recursive: true });
  fs.mkdirSync(preview, { recursive: true });
  const names = fs.readdirSync(path.join(SRC, 'emails')).filter((f) => f.endsWith('.json')).map((f) => f.replace(/\.json$/, '')).sort();
  const items = [];
  for (const name of names) {
    const email = JSON.parse(read(`src/emails/${name}.json`));
    const html = renderEmail(email, name, config);
    fs.writeFileSync(path.join(dist, `${name}.html`), html);
    fs.writeFileSync(path.join(dist, `${name}.txt`), plainText(email, config));
    const sample = { ...email.sample, asset_base_url: '../assets' };
    const prev = fillSample(renderEmail(email, name, { ...config, assetBaseUrl: '../assets' }), sample);
    fs.writeFileSync(path.join(preview, `${name}.html`), prev);
    // Forced copies for the gallery, so each column shows its mode whatever the viewer's OS setting is.
    fs.writeFileSync(path.join(preview, `${name}.light.html`), prev.replace('@media (prefers-color-scheme: dark)', '@media not all'));
    fs.writeFileSync(path.join(preview, `${name}.dark.html`), prev.replace('@media (prefers-color-scheme: dark)', '@media all'));
    const bytes = Buffer.byteLength(html);
    items.push({ name, subject: fillSample(email.subject, email.sample), audience: email.audience || '', bytes });
    if (bytes > 100 * 1024) console.warn(`! ${name}.html is ${(bytes / 1024).toFixed(1)} KB; Gmail clips messages over 102 KB`);
  }
  fs.writeFileSync(path.join(preview, 'index.html'), galleryPage(items));
  const todo = config.socials.filter((s) => !s.url || s.url === '#').map((s) => s.label);
  if (todo.length) console.warn(`! Social links still "#": ${todo.join(', ')} (config.json)`);
  console.log(`Built ${items.length} emails in ${Date.now() - t0} ms: ${items.map((i) => `${i.name} (${(i.bytes / 1024).toFixed(1)} KB)`).join(', ')}`);
}

function watch() {
  let timer = null;
  const queue = () => { clearTimeout(timer); timer = setTimeout(() => { try { build(); } catch (e) { console.error(e.message); } }, 120); };
  for (const p of ['src', 'assets']) fs.watch(path.join(ROOT, p), { recursive: true }, queue);
  fs.watch(path.join(ROOT, 'config.json'), queue);
  console.log('Watching src/, assets/ and config.json');
}

const args = process.argv.slice(2);
build();
if (args.includes('--watch') || args.includes('--serve')) watch();
if (args.includes('--serve')) {
  const liveServer = require('live-server');
  const port = Number(process.env.PORT) || 5510;
  liveServer.start({ root: ROOT, port, host: 'localhost', open: false, wait: 150, logLevel: 0, watch: [path.join(ROOT, 'preview')] });
  console.log(`Preview gallery: http://localhost:${port}/preview/`);
}
