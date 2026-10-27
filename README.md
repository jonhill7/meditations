# Meditations

A small morning devotional app for your phone: daily scripture, a two-year
reading plan, verse study, prayer list, reflection reminders, and a calendar
of your mornings.

**Everything personal stays on your phone.** Notes, prayers, reminders and
progress are kept in the browser's local storage on the device. There are no
accounts, servers, analytics or trackers. Use **Settings → Export backup** now
and then and keep the file somewhere safe, because clearing Chrome's site data
or switching phones erases it.

## What's in it

- **Today**: your plan reading for the day, a short verse for hurried
  mornings, your reflection reminders, and a few prayers you haven't prayed
  for in a while.
- **Bible**: the full Berean Standard Bible on the device. Tap any verse for
  your own note, cross references (OpenBible.info), and commentary.
- **Prayers**: categories, "prayed" taps, and an answered list with the date
  and how it was answered.
- **Reflect**: short reminders in your own words ("Stay calm") to read each
  morning.
- **Progress**: a calendar of your mornings (no streaks), plan progress, and a
  few totals.
- **Settings**: light/dark, text size, ESV, commentary choice, plan position,
  backup export/import.

### The reading plan: Two Tracks

748 days, two chapters a day. Track 1 walks the Old Testament, with the heavy
books broken up: Leviticus alternates day by day with Joshua and Ruth, Numbers
with Judges, Deuteronomy with Job, Kings with Ecclesiastes and Song of Songs,
Chronicles with Ezra, Nehemiah and Esther, and the major prophets with Daniel
and the minor prophets. Track 2 reads the New Testament twice, first with the
Psalms woven in and then with Proverbs. Missed days never pile up: the plan
waits until you mark a day read.

A day on the calendar is complete when you have read (the plan, or the quick
verse on a short morning) and checked off your reflection.

## Bible text

- **BSB** (Berean Standard Bible, public domain) ships with the app and works
  offline.
- **ESV**: add a free personal key from
  [api.esv.org](https://api.esv.org/account/create-application/) in Settings.
  Only the passage reference is sent to Crossway. The app keeps at most 12
  recent ESV chapters on the phone (per Crossway's limits) and falls back to
  the BSB when it can't reach the ESV.
- NKJV and CSB have no public API a personal app can use, so they aren't
  offered.

Commentary (Matthew Henry by default; also Jamieson-Fausset-Brown, Adam Clarke,
John Gill, Keil & Delitzsch, Tyndale) comes from the free
[Free Use Bible API](https://bible.helloao.org). Each chapter downloads the
first time you open it and is then kept on the phone. Settings has a button to
save the next 14 days of your plan for offline use.

## Putting it on your Android phone

It's a static site. It has to be served over HTTPS so it can install and work
offline. Pick one:

1. **GitHub Pages**: repo Settings → Pages → Deploy from a branch → `main`,
   `/ (root)`. On a free GitHub account Pages needs the repo to be public. The
   code contains nothing personal, since your data never leaves the phone.
2. **Cloudflare Pages or Netlify** (free, works with a private repo): connect
   the repo, no build command, output directory `/`.

Then open the site in Chrome on your phone, tap ⋮ → **Add to Home screen**
(or **Install app**). After the first load it works offline.

When you change app files, bump `VERSION` in `sw.js` so phones pick up the
new version.

## Developing

No build step. Serve the folder and open it:

```sh
python3 -m http.server 8000
npm test          # reading plan checks (Node 18+)
```

`tools/build_data.py` regenerates `data/` from
[scrollmapper/bible_databases](https://github.com/scrollmapper/bible_databases)
(`formats/json/BSB.json` and `sources/extras/cross_references.txt`).

## Credits

- Berean Standard Bible: public domain (CC0).
- Cross references: [OpenBible.info](https://www.openbible.info/labs/cross-references/), CC-BY.
- ESV: © 2001 Crossway. Used through the ESV API under its terms.
- Commentaries: public domain, via [bible.helloao.org](https://bible.helloao.org).
