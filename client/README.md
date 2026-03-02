# Client

Preact + TypeScript frontend for the Brenlets VFL Hub standings page. Built with Vite using [@preact/preset-vite](https://github.com/preactjs/preset-vite).

Single-component app (`src/App.tsx`) with a retro GeoCities aesthetic. Uses `useState` and `useEffect` from `preact/hooks` — no router, no state management library.

## Development

```bash
# From the repo root — starts API server + serves client build
npm run dev:server
```

## Build

```bash
npm run build   # tsc + vite build → dist/
```
