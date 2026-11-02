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

## Releasing the live demo page

`docs/assets/js/demo-en-vivo.js` holds the id of the ElevenLabs web agent in `AGENT_ID`. While it is the
placeholder `agent_PENDING_V6_WEB`, both workflows refuse to run, by design. Release in this order:

1. The backend is deployed and the web agent exists (`apply_v6.py --channel=web` in `demo-agent/closer-v6/` of
   innmobi-internal). Copy its id.
2. Its smoke test passes.
3. Commit the real id as `AGENT_ID` on `feat/web-demo-v6`.
4. Merge into `main` and push. `Validate site` and `Deploy site to GitHub Pages` run.
5. Wait out the 600 s cache (`Cache-Control: max-age=600`).
6. Run `python3 -I check_routing.py` in `demo-agent/closer-v6/`. A `SKIPPED` line (network failure) is not a pass.
7. Only after DNS has moved to the production host (ADR 0039 of realestate-crm), also run `gce.sh website-put` on
   the built `docs/`. Until then innmobi.ai is served by GitHub Pages and `website-put` changes nothing visitors see.

To roll the page back, revert the whole site commit. Do not change only `AGENT_ID`: the older agent's tools are
browser client tools and the new page registers none.
