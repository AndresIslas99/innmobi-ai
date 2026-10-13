# innmobi.ai website

Source of [innmobi.ai](https://innmobi.ai): static pages built from `src/` and deployed to GitHub
Pages.

| Path | Contents |
|---|---|
| `src/` | Page sources, layout and partials |
| `data/pages.json` | Site metadata, page list and posts |
| `images/` | Images copied into the site at build time. `screenshots/` holds captures of the previous system and is NOT published |
| `brochure/` | The downloadable brochure (HTML source and PDF) |
| `docs/` | Build output served by GitHub Pages |
| `scripts/` | Build and render scripts |

```sh
npm ci
npx playwright install chromium   # only for the render scripts
npm run build:site                # writes docs/
npm run dev                       # serves docs/ locally
```

Every push to `main` that touches the site runs `.github/workflows/validate.yml`, and
`.github/workflows/deploy-pages.yml` builds and deploys it.
