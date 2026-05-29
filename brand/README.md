# MyTracker — brand assets

Single concentric mark ("05 Concentric") in every variant you'll need.

## Files

### `svg/` — vector mark (no background, drop into UI)
- `logo-color.svg`      — primary, two-tone green
- `logo-mono-dark.svg`  — single ink (#111827) for quiet light surfaces
- `logo-mono-light.svg` — single white for dark surfaces

### `svg/` — vector mark with background (self-contained tile)
- `logo-on-accent.svg`  — white mark on green tile (use as app icon)
- `logo-on-white.svg`   — color mark on white tile
- `logo-on-paper.svg`   — color mark on soft-mint tile

### `icons/` — rasterized app icons (white mark on green tile)
- `favicon.svg`              — modern browsers (SVG favicon)
- `favicon-16.png` / `-32.png` — legacy browser tabs
- `apple-touch-icon.png`     — 180×180, iOS home-screen
- `icon-192.png` / `-512.png` — PWA / Android
- `icon-512-maskable.png`    — Android adaptive icon (10% safe-zone padding)
- `site.webmanifest`         — PWA manifest snippet

## Drop-in for index.html

Add inside `<head>`:

```html
<link rel="icon" href="brand/icons/favicon.svg" type="image/svg+xml" />
<link rel="icon" href="brand/icons/favicon-32.png" type="image/png" sizes="32x32" />
<link rel="icon" href="brand/icons/favicon-16.png" type="image/png" sizes="16x16" />
<link rel="apple-touch-icon" href="brand/icons/apple-touch-icon.png" />
<link rel="manifest" href="manifest.json" />
<meta name="theme-color" content="#1d7a3a" />
```

Replace the text wordmark in the top bar with the SVG:

```html
<span class="top-bar-title">
  <img src="brand/svg/logo-mono-light.svg" alt="MyTracker" class="app-icon app-icon-light" />
  <img src="brand/svg/logo-mono-dark.svg" alt="MyTracker" class="app-icon app-icon-dark" />
  MyTracker
</span>
```

## Colors used

| Token         | Hex       |
|---------------|-----------|
| accent        | `#1d7a3a` |
| accent-2      | `#3fa05c` |
| accent-soft   | `#e2f5e8` |
| track (light) | `#cfe7d6` |
| ink           | `#111827` |

All marks share the same geometry — `viewBox="0 0 64 64"`, stroke-width 4,
`stroke-linecap="round"`, rotated –90° so progress reads from top.


## Dark variant

Same geometry, white + green-2 rings on a dark navy (`#0f172a`) tile. Use for dark-mode home-screens and as the iOS dark app-icon asset.

### Files
- `svg/logo-on-dark.svg`
- `icons/favicon-dark.svg`
- `icons/favicon-16-dark.png` / `-32-dark.png`
- `icons/apple-touch-icon-dark.png` (180×180)
- `icons/icon-192-dark.png` / `-512-dark.png`
- `icons/icon-512-maskable-dark.png`

### iOS dark-mode app icon (iOS 18+)
Apple's asset catalog accepts a dark variant alongside the light one. For a plain PWA on iOS Safari, you can also media-query the touch icon:

```html
<link rel="apple-touch-icon" href="brand/icons/apple-touch-icon.png" media="(prefers-color-scheme: light)" />
<link rel="apple-touch-icon" href="brand/icons/apple-touch-icon-dark.png" media="(prefers-color-scheme: dark)" />
```

### Favicon (auto-switching)
```html
<link rel="icon" href="brand/icons/favicon.svg"      type="image/svg+xml" media="(prefers-color-scheme: light)" />
<link rel="icon" href="brand/icons/favicon-dark.svg" type="image/svg+xml" media="(prefers-color-scheme: dark)" />
```
