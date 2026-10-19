# AIWA email template

One master HTML email template for every AIWA email, plus the emails built from it. Plain HTML and CSS, with light and dark mode, hover states and an intro animation where the client supports them. It's table-based with inline styles, so it renders in Gmail, Apple Mail, Outlook and Yahoo.

| File | What it is |
|---|---|
| `master.html` | **The template.** Every block an AIWA email can use, each marked `<!-- BLOCK: name -->`. |
| `emails/*.html` | Finished emails built from the master, ready to send (`.txt` is the plain-text part). |
| `assets/` | Images (2x for retina). Must be hosted at a public URL; see [Images](#images). |
| `preview/` | Preview of every email, light and dark, desktop and mobile. |
| `src/`, `build.js` | The source the master and emails are generated from. Optional; see [Editing](#editing). |

### The emails

| Email | File (`emails/`) | Goes to | Header |
|---|---|---|---|
| Confirm your email | `confirm-email.html` | User | Dawn hero |
| Welcome, set your password | `welcome-set-password.html` | User | Dawn hero |
| Welcome, account is ready | `account-ready.html` | User | Title |
| Welcome, account is live | `account-live.html` | User | Day hero (live site) |
| Invited to a workspace | `workspace-invite.html` | User | Title |
| Invited to a project | `project-invite.html` | User | Title |
| Site back online | `site-back-online.html` | User | Day hero |
| Founding agency partner, you're in | `founding-agency-partner.html` | User | Title |
| Support nudge, deploy failing | `support-nudge.html` | AIWA team | Dusk hero (deploy failed) |
| New signup | `new-signup.html` | AIWA team | Title |
| New signup, white label | `new-signup-white-label.html` | AIWA team | Title |
| Enterprise lead | `enterprise-lead.html` | AIWA team | Title |
| New founding partner | `new-founding-partner.html` | AIWA team | Title |

**`emails/manifest.json`** lists every email's subject line, preview text, audience, the exact variables it needs, and sample values. Your sending code can read it directly.

## Sending with Resend

Each email is a complete HTML document with `{{variable}}` placeholders. Fill them in and pass the result to Resend's `html` field:

```js
import { readFileSync } from 'node:fs';
import { Resend } from 'resend';

const resend = new Resend(process.env.RESEND_API_KEY);
const escape = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const fill = (tpl, data) => tpl.replace(/\{\{(\w+)\}\}/g, (m, key) => (key in data ? escape(data[key]) : m));

const data = { first_name: 'Ada', credits: 515, action_url: 'https://app.aiwa.codes/set-password?token=...' };
await resend.emails.send({
  from: 'Leon at AIWA <leon@aiwa.codes>',
  to: 'ada@example.com',
  subject: 'Welcome to AIWA, set your password',
  html: fill(readFileSync('emails/welcome-set-password.html', 'utf8'), data),
  text: fill(readFileSync('emails/welcome-set-password.txt', 'utf8'), data),
});
```

Always escape user-supplied values, as `fill` does above. Use the `html` field rather than Resend's hosted Templates: those use a different variable syntax (`{{{VAR}}}`), reserve names such as `FIRST_NAME` and `EMAIL`, and in 2026 had a reported problem with variables inside link `href`s when created through the API.

### Variables

The full list per email is in `emails/manifest.json`. The common ones:

| Variable | Meaning |
|---|---|
| `first_name` | The recipient's first name |
| `action_url` | The email's main link (verify, set password, accept invite…). It is used for both the button and the fallback link. |
| `credits` | Credits on the account |
| `user_name`, `user_email`, `user_number` | The user an internal email is about |
| `inviter_name`, `workspace_name`, `project_name`, `access_level`, `access_summary`, `invitee_email`, `expires_on` | Invites. `access_summary` finishes the sentence "so you can …", for example "open and view it, but not make changes". |
| `error_log` | Plain text. Line breaks are kept. |
| `lead_*`, `team_size` | Enterprise lead details |
| `partner_*`, `amount_paid`, `renewal_date`, `places_left`, `places_total`, `checkout_id`, `welcome_url` | Founding partner emails |
| `control_panel_url`, `leads_url`, `tickets_url`, `project_url` | Links into AIWA |

The subject lines contain variables too, so fill the subject the same way as the HTML.

## The blocks

Each block in `master.html` sits between `<!-- BLOCK: name -->` and `<!-- /BLOCK: name -->`. To make a new email, copy `master.html`, delete the blocks it doesn't need, and edit the text. Keep blocks in the master's order.

| Block | Use it for |
|---|---|
| `header-hero` | Tab + sunset hero image. The sun encodes the state: dawn = getting started, day = live or success, dusk = needs attention. Heroes in `assets/`: `hero-dawn` (with the AIWA prompt), `hero-live` (a live site), `hero-dusk` (a failed deploy), and plain scenes `hero-dawn-plain`, `hero-day` and `hero-dusk-plain`. |
| `header-title` | Tab + title panel, for emails without a hero. It sits commented out under the hero in `master.html`; use one header or the other. |
| `paragraph` | Body text, 14/20. Bold: `<strong style="font-weight:600;">`. Links: `class="t-link lnk"`. |
| `heading` * | A headline inside the message. |
| `meta` * | A muted detail line, items separated by `&middot;` (email · company · team size). |
| `quote` * | Someone else's words: a lead's message, a user's request. |
| `code` | Logs and errors. |
| `button` | The one main action. |
| `fallback-link` | "If the button does not work…" plus the URL. Goes right after a button. |
| `note` * | Small muted text: expiry times, "ignore this email if…". |
| `signoff` | "Questions? Just reply…" and the signature. Always last. |
| `footer-mark` | Optional AIWA mark above the footer line. |

\* New blocks, styled from the design tokens but not in the Figma file yet.

Spacing between blocks: 16px between text blocks, 32px around buttons, code and the sign-off, and 8px between the fallback label and its link.

## Hover and motion

- **Hover:** the button's gradient top lightens, links brighten, the footer location darkens, and social icons get a soft circle behind them. Works in Gmail on the web, Apple Mail, Yahoo and Samsung Mail.
- **Intro:**
  - The logo blurs in, the tab and hero rise, and the sunset brightens as the hero settles.
  - Then the card rises, the text blurs in line by line, and the button springs in with one shimmer.
  - The footer arrives last. The whole intro takes about 1.6 seconds.
  - It plays in Apple Mail (macOS and iOS), Samsung Mail, Thunderbird and Outlook for Mac. Other clients, and anyone with reduced motion turned on, see the finished email straight away. Nothing is hidden outside an animation.

## Client support

- **Dark mode.** Apple Mail, iOS Mail, Outlook for Mac and Outlook.com use the designed dark palette. Gmail's apps apply their own automatic dark mode. The images are transparent or photos, so nothing breaks when Gmail inverts colours.
- **Outlook for Windows.** The button is drawn with VML, so it is still a clickable orange pill. Rounded corners, the glow, hover and motion are progressive enhancements, and Outlook shows the plain version.
- **Images off.** All text is live text, every image has alt text, and the button is HTML.
- **Size.** About 26 KB per email, well under Gmail's 102 KB clipping limit.

## Images

The emails load images from `assetBaseUrl` in `config.json`, currently `https://bas-coder.github.io/email-template/assets` (this repo's GitHub Pages). Before going live, host `assets/` on an AIWA domain, update that one line and rebuild. Or find and replace the URL in the HTML files.

## Preview

```bash
npm install
npm run dev
```

Open http://localhost:5510/preview/. Pick an email and mode from **Template**, switch between **Desktop** and **Mobile · 375**, press **Replay** to see the intro again, and use **Open email** to open it on its own. The address keeps your choice, for example `#support-nudge.dark`.

## Editing

The master and the emails are generated, so they always stay in sync:

- `src/layout.html` is the shell (head, styles, logo, card, footer).
- `src/modules/*.html` are the blocks.
- `src/emails/*.json` is each email's content, made of blocks plus sample data. `_master.json` is the master.
- `config.json` holds shared values: image URL, links and the sign-off name.

`npm run build` regenerates `master.html`, `emails/` and `preview/`; `npm run dev` does it on every save.

## Design tokens

| Token | Light | Dark |
|---|---|---|
| Page | `#FAF8F5` | `#161513` |
| Frame (tab, hero frame, card, quote) | `#F2EEE5` | `#0E0D0C` |
| Message panel / border | `#FCFCFC` / `#EFEEEE` | `#201F1C` / `#2C2B28` |
| Body text | `#25211D` | `#EFEAE1` |
| Title / heading | `#060504` | `#FCFCFC` |
| Muted | `#6B6357` | `#8A8175` |
| Link / hover | `#BF4E0B` / `#E35F10` | `#CB8002` / `#F0A21F` |
| Button / hover | `#FD821C`→`#EE520B` / `#FF9638`→`#EE520B` | `#FFB10E`→`#FF9028` / `#FFC23F`→`#FF9028` |

Type: Inter 14/20 body, 14/20 Medium buttons, 18/26 SemiBold headings, 28/36 Medium titles; JetBrains Mono 12px for code.

## Open items

- Host `assets/` on an AIWA domain (see [Images](#images)).
- Send real test emails to Gmail (web and app), Outlook and Apple Mail before launch.
- Copy check: `project-invite` was written from the workspace invite, since there was no current version to copy. The others follow the existing AIWA emails.
