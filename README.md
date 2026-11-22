# Alfred Bell | Louisiana House District 61

A private campaign briefing prepared by Provisional Consulting LLC. The dashboard includes district registration, an interactive precinct atlas, election history, voting and finance calendars, and a proposed consulting scope. Its baseline is dated November 22, 2026. Official source links and data periods appear in the dashboard.

## Put the source on GitHub

1. Unzip this package on your computer. In GitHub, create a new **private** repository for Bell. Use `main` as the default branch.
2. Select **Add file** and **Upload files**. Upload the extracted contents with `README.md`, `_headers`, `dashboard`, `setup` and `tools` at the repository root. Commit the files to `main`.
3. Leave GitHub Pages off. GitHub holds the editable campaign source. Cloudflare serves the dashboard and checks who can open it. Keep repository access limited to people who maintain the code.

## Start Cloudflare Pages with the setup screen

1. In **Workers & Pages**, create a **Pages** project and connect your GitHub account. Grant the Cloudflare GitHub app access to this repository only.
2. Select the Bell repository and enter the following build settings.

| Setting | Value |
| --- | --- |
| Production branch | `main` |
| Framework preset | None |
| Root directory | Leave blank |
| Build command | `python3 tools/build.py` |
| Build output directory | `dist` |
| Environment variables for first deployment | Leave empty |

3. Deploy. Open the assigned Pages address and confirm that you see **Workspace setup**. The build has copied only the setup screen and its response headers. No candidate files are included in this first deployment.

[Cloudflare Git integration](https://developers.cloudflare.com/pages/configuration/git-integration/) · [Build configuration](https://developers.cloudflare.com/pages/configuration/build-configuration/)

## Give Bell and your team access

1. In **Cloudflare Zero Trust**, choose a login method. For email codes, open **Integrations**, then **Identity providers**, choose **Add new identity provider**, and enable **One time PIN**. Choose that login method on each campaign application. Bell can use his approved email address without needing a GitHub account.
2. In the Pages project settings, choose **Enable access policy**. Open **Manage** for the new preview application. In **Access controls**, open **Applications** and configure that application. Under **Public hostname**, remove the wildcard so the hostname is exactly `YOURPROJECT.pages.dev`. Save. Rename the application if prompted.
3. Return to Pages project settings and enable the access policy again. Confirm that Access now lists coverage for both `YOURPROJECT.pages.dev` and `*.YOURPROJECT.pages.dev`. The wildcard covers deployment addresses and branch previews. Leave the path empty for the entire host.
4. On both applications, set an **Allow** policy with **Include**, **Emails**, and only the exact addresses you approve, starting with yours and Bell’s. Remove broader default Allow or Bypass policies from these applications. Apply your chosen login method to both.
5. If you want a client address such as `bell.tiafields.com`, add that subdomain under **Pages**, **Custom domains** while the setup page is live. Complete DNS and certificate validation. Then create a **Self hosted and private** Access application for that exact custom hostname, with the same email rule and no path restriction. The existing website at the root domain can stay on its current host.

[Cloudflare instructions for protecting Pages addresses and custom domains](https://developers.cloudflare.com/pages/platform/known-issues/#enable-access-on-your-pagesdev-domain) · [Email PIN setup](https://developers.cloudflare.com/cloudflare-one/integrations/identity-providers/one-time-pin/) · [Access policies](https://developers.cloudflare.com/cloudflare-one/access-controls/policies/)

## Verify privacy and release the dashboard

1. Use a signed out private browser window. Check the ordinary Pages address, the unique deployment address from **Deployments**, and your custom hostname if used. Try both the homepage and direct paths such as `/data.js` and `/cartography/geodata.json` at every hostname. Cloudflare should require sign in or deny access before serving the site. If an anonymous visitor sees the setup screen or a site asset, finish configuring Access before continuing.
2. Sign in with your approved email address and confirm the setup screen opens. In a separate session, confirm that an unlisted address cannot open it.
3. In the Pages project settings, add the production variable `CAMPAIGN_RELEASE` with the value `enabled`. Leave the preview environment unset. Trigger a **new production deployment** of `main`. The build copies the actual dashboard only when the branch is `main` and the release value is `enabled`.
4. Repeat the signed out checks against production, its new unique deployment address, your custom hostname and direct file paths. Then sign in, open **District atlas** and inspect a precinct. Give Bell the protected address after these checks pass.
5. To put the setup screen back on the main address, remove the production variable and redeploy. Keep Access active on the wildcard because older deployment addresses can still exist. To end a person's access, remove their email from every applicable policy and revoke their active Access sessions.

[Cloudflare preview deployments](https://developers.cloudflare.com/pages/configuration/preview-deployments/) · [Static response headers](https://developers.cloudflare.com/pages/configuration/headers/)

## Using and maintaining the briefing

The downloadable HTML opens directly in a browser. All graphics, precinct shapes and map layers are embedded. Official source links require internet access. Anyone who receives the standalone file or the source ZIP can read the material. Share the protected web address with the campaign and keep the downloads on a trusted device.

Calculator amounts, scope choices and finance checklist selections can persist in the current browser profile. They do not sync between Bell and the consultant. Use the campaign’s finance records for its official balances and filings. Clearing this site’s browser data clears locally saved entries. The calendar downloads as an ICS snapshot. Verify new deadlines against the linked state schedules before adding them to the calendar.

| Editable file | What it controls |
| --- | --- |
| `dashboard/index.html` | Header, consulting logo placement, navigation frame and footer |
| `dashboard/provisional_logo.png` | Original Provisional Consulting LLC logo |
| `dashboard/app.js` | Dashboard views, calendar export and calculators |
| `dashboard/data.js` | Dated campaign figures, election records, events and sources |
| `dashboard/cartography/` and `dashboard/map.js` | Local basemap, geographic data, map layers and precinct controls |
| `dashboard/styles.css` and `dashboard/map.css` | Dashboard and map appearance |
| `_headers` | Response headers for Cloudflare Pages |

To preview edits locally, run `python3 -m http.server 8000 --bind 127.0.0.1 --directory dashboard` from the repository root, then open `http://127.0.0.1:8000`. This local server is for editing on your own computer.

To regenerate the portable file, run `python3 tools/export_html.py` from the repository root. It writes `Bell_District_61.html` beside this guide. Cloudflare publishes only the contents of its build output. The downloadable HTML is a separate copy, so make a new export after changing the source.

The package uses Leaflet and Inter. Their bundled license notices are in `dashboard/cartography/leaflet-license.txt` and `dashboard/Inter_License.txt`. Geographic and election sources are credited in the dashboard.
