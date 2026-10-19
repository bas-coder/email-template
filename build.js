#!/usr/bin/env node
/*
 * AIWA email build.
 *
 *   node build.js            build master.html, emails/ and preview/
 *   node build.js --watch    rebuild when src/, assets/ or config.json change
 *   node build.js --serve    watch + live server on http://localhost:5510 (opens the preview)
 *
 * Two kinds of placeholders:
 *   [[name]]  filled here, at build time (layout slots, tab text, button labels...)
 *   {{name}}  left in master.html and emails/ for the sending code to fill (first_name, action_url...).
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
const SPACE = {
  p: [16, 16], heading: [24, 12], meta: [8, 16], note: [16, 16], quote: [16, 16],
  button: [32, 32], fallback: [32, 32], code: [32, 32], signoff: [32, 0],
};
// The button row carries its glow inside its own padding (20 above, 26 below), so that much comes off the gap.
const INSET = { button: [20, 26] };
// Intro motion: blocks and footer rows animate in order using delay classes .d1 to .d20 (see src/layout.html).
const delayClass = (i) => `d${Math.min(i, 20)}`;

function fill(tpl, vars, where) {
  return tpl.replace(/\[\[(\w+)\]\]/g, (m, key) => {
    if (key in vars) return vars[key];
    throw new Error(`Missing [[${key}]] in ${where}`);
  });
}

const escapeHtml = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
// BLOCK markers document the master; the individual emails don't need them.
const stripBlockMarkers = (html) => html.replace(/^[ \t]*<!-- \/?BLOCK[\s\S]*?-->\r?\n/gm, '');

function renderBlocks(blocks, base, name) {
  const out = [];
  let prev = null;
  blocks.forEach((b, i) => {
    if (!SPACE[b.type]) throw new Error(`Unknown block type "${b.type}" in ${name}`);
    let gap = prev ? Math.max(SPACE[prev.type][1], SPACE[b.type][0]) : 0;
    if (prev && INSET[prev.type]) gap -= INSET[prev.type][1];
    if (INSET[b.type]) gap -= INSET[b.type][0];
    gap = Math.max(gap, 0);
    const v = { ...base, gap, delay: delayClass(i + 1) };
    if (['p', 'heading', 'meta', 'note', 'quote'].includes(b.type)) {
      out.push(fill(mod(b.type === 'p' ? 'paragraph' : b.type), { ...v, html: b.html }, name));
    }
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
  });
  return out.join('\n');
}

function renderHeader(email, base, name) {
  const tab_html = fill(mod('tab'), { tab: email.tab }, name);
  if (email.header === 'title') return fill(mod('header-title'), { tab_html, title: email.title }, name);
  const hero_dark_html = email.heroDark
    ? `<!--[if !mso]><!--><div class="dark-img" style="display:none; max-height:0; overflow:hidden; mso-hide:all;"><img class="hero-img a-sunrise" src="${base.asset_base_url}/${email.heroDark}" width="548" height="224" alt="${email.heroAlt}" style="display:block; width:100%; max-width:548px; height:auto; border:0; border-radius:10px;"></div><!--<![endif]-->`
    : '';
  return fill(mod('header-hero'), {
    ...base, tab_html, hero: email.hero, hero_class: email.heroDark ? 'light-img hero-img' : 'hero-img', hero_alt: email.heroAlt, hero_href: email.heroHref || base.home_url, hero_dark_html,
  }, name);
}

function renderEmail(email, name, config) {
  const base = {
    asset_base_url: config.assetBaseUrl,
    home_url: config.homeUrl,
    address_url: config.addressUrl,
    signer: config.signer,
  };
  let header = renderHeader(email, base, name);
  // The master also carries the other header, commented out, so it can be swapped in.
  if (email.alternateHeader) {
    const alt = renderHeader({ ...email, ...email.alternateHeader }, base, name)
      .replace(/<!--(?!\[if)[\s\S]*?-->\r?\n?/g, '');
    header += `\n              <!-- BLOCK: header-title (alternative) | Swap it in for header-hero above: delete the hero block and remove the comment around this one.\n${alt}\n              /BLOCK: header-title (alternative) -->`;
  }
  let k = email.blocks.length;
  const next = () => delayClass(++k);
  const footer_mark = email.footerMark ? fill(mod('footer-mark'), { ...base, delay: next() }, name) : '';
  const socials = config.socials.map((s) => fill(mod('social'), { ...base, ...s }, name)).join('\n');
  return fill(read('src/layout.html'), {
    ...base,
    subject: email.subject,
    preheader: email.preheader,
    header,
    // Logo to tab: 31px above a hero, 55px above a title panel (as designed).
    header_gap: email.header === 'title' ? 55 : 31,
    content: renderBlocks(email.blocks, base, name),
    footer_mark,
    footer_gap: email.footerMark ? 13 : 50,
    d_tagline: next(),
    d_socials: next(),
    d_location: next(),
    socials,
  }, name);
}

function plainText(email, config) {
  const strip = (h) => h.replace(/<a [^>]*href="([^"]*)"[^>]*>(.*?)<\/a>/g, '$2').replace(/<[^>]+>/g, '').replace(/&rarr;/g, '->').replace(/&middot;/g, '·').replace(/&#127881;/g, '').replace(/&amp;/g, '&');
  const lines = [email.header === 'title' ? strip(email.title).trim() : email.tab, ''];
  for (const b of email.blocks) {
    if (['p', 'heading', 'meta', 'note'].includes(b.type)) lines.push(strip(b.html), '');
    if (b.type === 'quote') lines.push(`"${strip(b.html)}"`, '');
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

// Preview viewer: one email at a time, picked by template and mode, at desktop or mobile width.
function galleryPage(items) {
  const options = items.flatMap((it) => ['light', 'dark'].map((mode) =>
    `<option value="${it.name}.${mode}">${escapeHtml(it.label)} ${mode}</option>`)).join('\n        ');
  return `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>AIWA Email templates</title>
<style>
  * { box-sizing: border-box; }
  body { margin: 0; background: #FAF8F5; color: #26231E; font-family: Arial, Helvetica, sans-serif; transition: background-color .2s ease; }
  .bar { position: sticky; top: 0; z-index: 1; display: flex; flex-wrap: wrap; align-items: center; gap: 12px 16px; min-height: 78px; padding: 18px 19px; background: #FFFFFF; border-bottom: 1px solid #DDDDDD; }
  .bar h1 { margin: 0 1px 0 0; font-size: 18px; font-weight: 700; white-space: nowrap; }
  .field { display: flex; align-items: center; gap: 4px; font-size: 15px; }
  .bar select, .bar button { height: 37px; font: 15px Arial, Helvetica, sans-serif; color: #000000; border: 1px solid #767676; border-radius: 2px; }
  .bar select { min-width: 159px; padding: 0 6px 0 9px; background: #FFFFFF; }
  .bar button { padding: 0 10px; background: #EFEFEF; cursor: pointer; }
  .bar button:hover { background: #E5E5E5; }
  .bar a { margin-left: 8px; font-size: 15px; }
  .bar .note { margin: 0 0 0 8px; font-size: 12px; color: #555555; }
  /* The email sits straight on its own page colour: no card, no shadow. */
  main { display: flex; justify-content: center; }
  iframe { display: block; width: 600px; max-width: 100%; height: 1046px; border: 0; background: transparent; }
</style></head>
<body>
  <header class="bar">
    <h1>AIWA &middot; Email templates</h1>
    <label class="field" for="tpl">Template
      <select id="tpl">
        ${options}
      </select>
    </label>
    <button type="button" data-width="600" aria-pressed="true">Desktop</button>
    <button type="button" data-width="375" aria-pressed="false">Mobile &middot; 375</button>
    <button type="button" id="replay">Replay</button>
    <a id="open" href="#" target="_blank" rel="noopener">Open email</a>
    <p class="note">Reply / Forward controls excluded. Sample links require configuration.</p>
  </header>
  <main><iframe id="frame" title="Email preview" scrolling="no"></iframe></main>
<script>
  const frame = document.getElementById('frame');
  const select = document.getElementById('tpl');
  const open = document.getElementById('open');
  const buttons = document.querySelectorAll('[data-width]');
  // Size the frame to the email and paint the page in the email's own background colour.
  // Scrollbars stay off so the email always lays out at its full width.
  const fit = () => {
    try {
      const doc = frame.contentDocument;
      doc.documentElement.style.overflow = 'hidden';
      document.body.style.backgroundColor = getComputedStyle(doc.body).backgroundColor;
      frame.style.height = '10px';
      frame.style.height = doc.documentElement.scrollHeight + 'px';
    } catch (e) {}
  };
  const show = (value) => {
    if (![...select.options].some((o) => o.value === value)) value = select.options[0].value;
    select.value = value;
    frame.src = value + '.html';
    open.href = value + '.html';
    history.replaceState(null, '', '#' + value);
  };
  const setWidth = (w) => {
    frame.style.width = w + 'px';
    buttons.forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.width === String(w))));
    try { localStorage.setItem('aiwa-preview-width', w); } catch (e) {}
    setTimeout(fit, 30);
  };
  frame.addEventListener('load', fit);
  select.addEventListener('change', () => show(select.value));
  buttons.forEach((b) => b.addEventListener('click', () => setWidth(b.dataset.width)));
  document.getElementById('replay').addEventListener('click', () => { try { frame.contentWindow.location.reload(); } catch (e) {} });
  let saved = null; try { saved = localStorage.getItem('aiwa-preview-width'); } catch (e) {}
  setWidth(saved === '375' ? 375 : 600);
  show(location.hash.slice(1));
</script>
</body></html>
`;
}

function build() {
  const t0 = Date.now();
  const config = JSON.parse(read('config.json'));
  const out = path.join(ROOT, 'emails');
  const preview = path.join(ROOT, 'preview');
  fs.mkdirSync(out, { recursive: true });
  fs.mkdirSync(preview, { recursive: true });
  const names = fs.readdirSync(path.join(SRC, 'emails')).filter((f) => f.endsWith('.json')).map((f) => f.replace(/\.json$/, '')).sort();
  const items = [];
  for (const name of names) {
    const email = JSON.parse(read(`src/emails/${name}.json`));
    const isMaster = name === '_master';
    const html = renderEmail(email, name, config);
    if (isMaster) {
      fs.writeFileSync(path.join(ROOT, 'master.html'), html);
    } else {
      fs.writeFileSync(path.join(out, `${name}.html`), stripBlockMarkers(html));
      fs.writeFileSync(path.join(out, `${name}.txt`), plainText(email, config));
    }
    const sample = { ...email.sample };
    let prev = fillSample(renderEmail(email, name, { ...config, assetBaseUrl: '../assets' }), sample);
    if (!isMaster) prev = stripBlockMarkers(prev);
    const file = isMaster ? 'master' : name;
    fs.writeFileSync(path.join(preview, `${file}.html`), prev);
    // Forced copies for the viewer, so each option shows its mode whatever the viewer's OS setting is.
    fs.writeFileSync(path.join(preview, `${file}.light.html`), prev.replace('@media (prefers-color-scheme: dark)', '@media not all'));
    fs.writeFileSync(path.join(preview, `${file}.dark.html`), prev.replace('@media (prefers-color-scheme: dark)', '@media all'));
    const bytes = Buffer.byteLength(html);
    const label = (email.preview && email.preview.label) || name;
    items.push({ name: file, label, order: email.preview?.order ?? 99, bytes });
    if (bytes > 100 * 1024) console.warn(`! ${name}.html is ${(bytes / 1024).toFixed(1)} KB; Gmail clips messages over 102 KB`);
  }
  fs.writeFileSync(path.join(preview, 'index.html'), galleryPage([...items].sort((a, b) => a.order - b.order)));
  const todo = config.socials.filter((s) => !s.url || s.url === '#').map((s) => s.label);
  if (todo.length) console.warn(`! Social links still "#": ${todo.join(', ')} (config.json)`);
  console.log(`Built master.html + ${items.length - 1} emails in ${Date.now() - t0} ms: ${items.map((i) => `${i.name} (${(i.bytes / 1024).toFixed(1)} KB)`).join(', ')}`);
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
  console.log(`Preview: http://localhost:${port}/preview/`);
}
