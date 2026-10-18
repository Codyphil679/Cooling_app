# Cooling Calc

An installable phone app (a Progressive Web App) for cooling section work. It works offline once installed.

- **Product**: the cooling needed to take the product from its entry temperature to a target temperature (kW, BTU/h, tons of refrigeration), the product throughput, and the cooling water flow needed.
- **Single roll**:
  - Heat removed by a roll, from its water flow and its in/out water temperatures.
  - A prediction of how much the product cools on that roll.
  - Calibration of the heat transfer coefficient (U) from a measured product temperature.
- **Zone**: a chain of rolls showing:
  - the product temperature after each roll
  - the heat removed and each roll's share of the total
  - the roll effectiveness
  - whether the zone meets its target, and how many rolls it would take

You can switch between metric and imperial at any time. Inputs are saved on the phone.

## Put it on your phone

The app is a set of static files in `public/`. Host them anywhere that serves HTTPS, then install from Chrome.

### 1. Host it (free, one-time setup)

This repo is private. GitHub Pages needs a paid plan for private repos, so use one of these free hosts. Both redeploy automatically every time `main` changes.

**Netlify**
1. Sign in at https://app.netlify.com with your GitHub account.
2. Choose **Add new site → Import an existing project → GitHub**, then pick `Cooling_app`.
3. Leave the build command empty. `netlify.toml` already sets the publish directory to `public`. Click **Deploy**.
4. You get an address like `https://something.netlify.app`. You can rename it under **Site configuration → Change site name**.

**Cloudflare Pages** (alternative)
1. In the Cloudflare dashboard, go to **Workers & Pages → Create → Pages → Connect to Git**, then pick `Cooling_app`.
2. Set the framework preset to **None**, leave the build command empty and set the output directory to `public`.

### 2. Install it on Android

1. Open the site address in **Chrome** on your phone.
2. Tap **⋮ → Add to Home screen** (or **Install app**). The app's **Help** tab also has an **Install app** button when Chrome offers it.
3. Launch it from the new icon. It runs full-screen and keeps working without signal.

Updates: when a new version is deployed, the app picks it up in the background. Close and reopen the app to load it.

## How the calculations work

All of the maths is in `public/calc.js` and uses SI units. `public/units.js` handles the metric/imperial display.

- Cooling load = density × thickness × width × speed × specific heat × (T<sub>in</sub> − T<sub>out</sub>)
- Water side heat = flow × ρ<sub>water</sub> × c<sub>p,water</sub> × (T<sub>water out</sub> − T<sub>water in</sub>)
- Product on a roll (lumped model): contact time = π·D·(wrap/360)/speed, and
  T<sub>out</sub> = T<sub>roll</sub> + (T<sub>in</sub> − T<sub>roll</sub>)·exp(−U·t / (ρ·c<sub>p</sub>·thickness))

The roll model assumes the product temperature is even through its thickness. For thick or plastic products, calibrate U against a measured exit temperature on the **Single roll** tab, then apply it to the zone rolls. Cooling in the air gaps between rolls is not included.

## Development

```sh
npm test       # calculation and unit-conversion tests (Node 18+)
npm start      # serve public/ at http://localhost:3000
python3 scripts/make_icons.py   # regenerate the PNG icons (needs Pillow)
```

There's no build step: edit the files in `public/` and deploy. When you add a new file to the app, also add it to the `ASSETS` list in `public/sw.js` so it works offline.
