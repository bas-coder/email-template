# AIWA Emails

AIWA's transactional emails, built from one master layout. Each email is table-based HTML with inline styles, so it renders in Gmail, Apple Mail, Outlook and Yahoo. Every email has a light mode and a dark mode.

| Email | File | Goes to |
|---|---|---|
| Welcome, set your password (hero) | `dist/welcome-set-password.html` | User |
| Welcome, account is ready (title, no hero) | `dist/account-ready.html` | User |
| Welcome, account is live | `dist/account-live.html` | User |
| Support nudge, deploy failing | `dist/support-nudge.html` | AIWA team |

Each email also has a plain-text version (`dist/*.txt`) to send as the text part.

## Preview

```bash
npm install
npm run dev
```

Then open http://localhost:5510/preview/ to see every email side by side in light and dark, at desktop (600) or mobile (375) width. Saving any file in `src/` rebuilds the emails and reloads the page.

`npm run build` builds once, with no server.

## How it is put together

```
src/layout.html        the master: head, dark-mode CSS, logo, message card, footer
src/modules/*.html     the blocks: tab, hero, title panel, paragraph, button, fallback link, code block, sign-off, social icon
src/emails/*.json      the content of each email: subject, preview text, tab, hero or title, blocks, sample data
config.json            values shared by every email: asset URL, home and social links, sign-off name
assets/                images, each at 2x for retina screens
build.js               puts the pieces together into dist/ (to send) and preview/ (to look at)
```

There are two kinds of placeholders:

- `[[name]]` is filled at build time and never reaches `dist/`.
- `{{name}}` is left in `dist/` for your sending code to fill. The syntax matches Handlebars and Mustache, and most email providers (Resend, Postmark, SendGrid, Mailgun) accept it. `preview/` fills these with each email's `sample` values.

### Variables your sending code must fill

| Email | Variables |
|---|---|
| welcome-set-password, account-ready | `first_name`, `credits`, `action_url` |
| account-live | `first_name`, `credits`, `action_url` |
| support-nudge | `user_name`, `user_email`, `error_log` (plain text, line breaks kept), `tickets_url` |
| all | `asset_base_url`: where `assets/` is hosted, for example `https://cdn.aiwa.codes/email`. You can also set `assetBaseUrl` in `config.json` and rebuild, which bakes the URL in. |

Images must be hosted at a public HTTPS URL. Email clients won't load relative paths.

### Adding an email

1. Copy one of the files in `src/emails/` and edit the text. Set `"header"` to `"hero"` with a `hero` image, or to `"title"` with a `title`.
2. Build the body from blocks: `p` (paragraph, HTML allowed), `button` (`label`, `url`, `arrow`), `fallback` (the "paste this link" line), `code` (logs), `signoff`.
3. Spacing between blocks is automatic (16px between text, 32px around buttons and code), taken from the Figma frames.

## Design system

| Token | Light | Dark |
|---|---|---|
| Page | `#FAF8F5` | `#161513` |
| Frame (tab, hero frame, card) | `#F2EEE5` | `#0E0D0C` |
| Message panel / border | `#FCFCFC` / `#EFEEEE` | `#201F1C` / `#2C2B28` |
| Body text | `#25211D` | `#EFEAE1` |
| Title | `#060504` | `#FCFCFC` |
| Tab label | `#2A251E` | `#ADA598` |
| Muted (footer) | `#6B6357` | `#8A8175` |
| Link | `#BF4E0B` | `#CB8002` |
| Button | `#FD821C` → `#EE520B`, text `#FBF4F2` | `#FFB10E` → `#FF9028`, text `#1B150A` |

Type is Inter: 14/20 body, 14/20 Medium on buttons, 28/36 Medium for titles, 12/20 and 10/16 in the footer. Code blocks use JetBrains Mono 12px. Where a client can't load web fonts, it falls back to the system UI font.

## Client support

- **Dark mode.** Apple Mail, iOS Mail, Outlook for Mac and Outlook.com switch to the designed dark palette. Gmail's apps apply their own automatic dark mode. Every image is transparent or a photo, so nothing breaks when Gmail inverts colours.
- **Outlook for Windows.** The button is drawn with VML, so it stays a solid orange pill you can click. Rounded corners and the button glow are progressive enhancements, and Outlook for Windows shows square corners instead.
- **Images off.** All text is live text, every image has alt text, and the button is HTML, so the email still reads and the main action still works.
- **Size.** Each email is about 20 KB, far below Gmail's 102 KB clipping limit.

## Open items

- Social links in `config.json` are still `#`.
- Confirm `homeUrl` (it is set to `https://aiwa.codes`, which the logo links to).
- Host `assets/` and set `asset_base_url`.
- Send real test emails to Gmail (web and app), Outlook and Apple Mail before launch.
