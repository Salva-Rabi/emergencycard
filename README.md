# EmergencyCard

**If you can't speak, let your card speak for you.**

A QR-powered emergency identification app. A bystander scans the code on a physical card with any phone camera and instantly sees the blood group, allergies, medical alerts, and emergency contact the owner chose to share — no app install required.

🔗 **Live demo:** _add your deployed link here (Vercel/Netlify/GitHub Pages)_
🎥 **Demo video:** _add your 3–5 min video link here_

## The problem

In an emergency, a person may be unconscious, unable to speak, or alone — and their phone is usually locked. EmergencyCard gives bystanders another way in: a small physical card with a QR code that opens a simple emergency profile in the browser.

## Who it's for

People who live alone, elderly people, people with allergies or medical conditions, travelers, students, cyclists, runners, hikers, and parents who want an emergency card for their kids.

## How it works

1. **Create a profile** — name, photo, blood group, allergies, medical alert, emergency instructions, and an emergency contact.
2. **Choose what's visible** — every field except name can be hidden from the public profile. Nothing is shared by default.
3. **Generate a QR code** — a unique code is created for the profile, ready to print onto a wallet card, ID holder, or bag tag.
4. **A bystander scans it** — the QR opens the emergency profile in their browser and shows only the information the owner made public, with a one-tap "Call emergency contact" button.
5. **Manage it anytime** — from the dashboard, the owner can edit their details or deactivate the card if it's lost. A deactivated card shows "This EmergencyCard is currently inactive" instead of any personal information.

## Tech stack

- **Frontend:** vanilla HTML, CSS, and JavaScript (no build step, no framework) — a single-page app with hash-based routing
- **QR generation:** [qrcodejs](https://github.com/davidshimjs/qrcodejs) (client-side, no external API calls)
- **Storage:** browser `localStorage` for the owner's own profile and dashboard
- **Fonts:** Space Grotesk (headlines) + IBM Plex Sans (body), via Google Fonts

No backend, build tool, or account is required to run this project.

## Running it

This is a static site — there's nothing to install or build.

**Option A — just open it**
Double-click `index.html`, or open it directly in a browser.

**Option B — serve it locally** (recommended, so `localStorage` and links behave exactly like a deployed site)
```bash
cd emergencycard
python3 -m http.server 8000
# then visit http://localhost:8000
```
or, with Node:
```bash
npx serve .
```

**Option C — deploy it**
Drag the folder into [Vercel](https://vercel.com) or [Netlify](https://netlify.com), or serve it from GitHub Pages — it's a static site with no environment variables needed.

## Trying the full flow (including the "two-device" scan)

1. Open the app and click **Create your EmergencyCard**.
2. Fill in the three steps (basics → privacy → review) and generate your card.
3. On the **Your EmergencyCard is ready** screen, either:
   - Scan the QR code with a second phone's camera, or
   - Click **Copy emergency profile link** and open it in another browser/incognito window.
4. You'll land on the public **Emergency Profile** screen — exactly what a bystander would see.
5. Go back to the **Dashboard** and click **Deactivate card**, then reload the emergency profile link to see the inactive state.

## An important technical decision — and its trade-off

The original concept called for a shared backend (e.g. Supabase) so that a profile created on Phone A could be looked up by Phone B from a database. For a hackathon-scoped build, this project takes a different route: **the public profile data is encoded directly inside the QR code's URL** (as base64 JSON), rather than looked up from a server.

This means:
- ✅ Scanning the QR on a genuinely different device works out of the box — no backend, no deployment, no database to set up.
- ✅ Nothing is exposed except what the URL itself carries — there's no public database of everyone's profiles to secure.
- ⚠️ **Deactivation is best-effort, not global.** "Deactivate card" is stored in the browser that clicked it. It will correctly show "inactive" if checked from the *same device/browser*, but a card scanned from a different device won't know it was deactivated elsewhere, because there's no shared source of truth. A production version needs a real backend for this to work everywhere.
- ⚠️ **Editing a profile doesn't update an already-printed QR.** Because the data lives in the QR itself, changing your details means re-downloading and re-printing the code. A backend version would let the same QR keep pointing at an always-current profile.

Both limitations are the direct, honest cost of skipping a backend — and both are exactly what upgrading to a `React + Supabase` stack (as in the original spec) would solve: the QR would encode a stable profile ID/link, and both edits and deactivation would be looked up live from the database on every scan.

## Privacy

The public emergency profile only ever contains what the owner explicitly turned on: name, photo, blood group, allergies, medical alert, emergency contact, and instructions. There's no field in this app for home address, ID numbers, passwords, or financial information — by design, not just by toggle.

## What's not built (by design, for scope)

Left out of this hackathon build on purpose, and listed here as future work rather than attempted half-done:
- Live GPS tracking or automatic accident detection
- Automatic ambulance calling
- AI medical diagnosis or hospital integration
- NFC card support
- Multi-language emergency profiles
- Access history / scan logs
- Accounts, authentication, or a real backend (see trade-off above)

## Screenshots

**Landing page**
![Landing page — hero](screenshots/landing-hero.png)
![Landing page — how it works](screenshots/landing-how-it-works.png)
![Landing page — who it's for](screenshots/landing-who-its-for.png)

**Create your EmergencyCard**
![Create profile form](screenshots/create-profile.png)

**Card & QR generated**
![Card and QR code](screenshots/card-and-qr.png)

**Dashboard**
![Dashboard](screenshots/dashboard.png)

**Emergency profile (what a bystander sees after scanning)**
![Emergency profile](screenshots/emergency-profile.png)

## Technologies, frameworks & libraries used

- HTML5, CSS3, JavaScript (ES6+) — no framework
- [qrcodejs](https://github.com/davidshimjs/qrcodejs) for client-side QR generation
- Browser `localStorage` Web API
- Google Fonts (Space Grotesk, IBM Plex Sans)

## Challenges & what we learned

The trickiest decision was how the QR code would actually work without a backend. The original idea was to store each profile in a database and have the QR just carry an ID — but with no server, a second phone scanning the code would have no way to look that ID up. The fix was to encode the entire public profile (as base64 JSON) directly into the QR code's URL, so the data travels with the code itself instead of living on a server. That made a genuine two-device demo possible with zero setup, but it came with a real trade-off: editing a profile doesn't update an already-printed QR, and "deactivating" a card only works reliably on the same browser that deactivated it. Understanding *why* that trade-off exists — and being able to explain it rather than hide it — was the most useful thing to come out of this build, and it's exactly what a real backend (e.g. Supabase) would solve.

Getting the privacy toggles to correctly filter what goes into the QR payload also took some care — it was easy to accidentally leak a hidden field into the encoded data early on, which defeats the whole point of a privacy-first emergency card.

## Project structure

```
emergencycard/
├── index.html         # App shell, fonts, QR library
├── style.css          # Design tokens and all styling
├── app.js             # Routing, state, screens, QR + card rendering
├── screenshots/        # App screenshots referenced in this README
└── README.md
```

## Author

**Salva Rabi**

## AI assistance disclosure

Significant AI assistance (Claude) was used to help implement this project from a detailed written spec, including the HTML/CSS/JS structure, the QR/localStorage-based data flow, and this README.
