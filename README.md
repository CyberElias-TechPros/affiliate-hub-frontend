# 🚀 Affiliate Hub — Frontend

Nigeria-focused affiliate marketing platform. Earn up to 50% commission promoting products, with fast payouts to bank, PayPal, and USDT. Built with **Vite + React + TypeScript + Tailwind CSS + shadcn/ui**.

## Tech stack

- **Vite** build tool
- **React 18** + **TypeScript**
- **Tailwind CSS** + **shadcn/ui** components
- **TanStack Query** for server state
- **React Router** for routing
- **Axios** for API calls

## Getting started

```bash
# 1. Install dependencies
npm install

# 2. Start the backend (runs on http://localhost:3001)
cd backend && npm install && npm start

# 3. In a separate terminal, start the frontend dev server
npm run dev   # http://localhost:8080
```

The dev server proxies `/api/*` to the backend, so the browser never talks to `localhost` directly.

> **Demo account:** `chinedu@example.com` / `password123` (seeded with products, wallet transactions, and stats).

## Environment variables

Copy `.env.example` to `.env` and configure as needed. Key variables:

| Variable | Purpose |
| --- | --- |
| `VITE_API_BASE_URL` | Backend API base URL. Unset in dev (proxy used). Set to your deployed backend in production. |
| `VITE_DEV_API_TARGET` | Backend the Vite dev proxy targets (default `http://localhost:3001`). |

## Scripts

- `npm run dev` — start the Vite dev server
- `npm run build` — production build (output in `dist/`)
- `npm run preview` — preview the production build
- `npm run lint` — run ESLint
- `npm run build:dev` — development-mode build

## Deployment

### Frontend → Vercel

1. Push this repo to GitHub and import it in Vercel.
2. Framework preset: **Vite** (build command `npm run build`, output dir `dist`).
3. Set the `VITE_API_BASE_URL` env var to your deployed backend URL
   (e.g. `https://your-backend.workers.dev/api/v1`).
4. Deploy. `vercel.json` already configures SPA rewrites so deep links like
   `/product/1` resolve correctly.

### Backend → Cloudflare

This repo ships a reference backend in `backend/` (Express + Node's built-in
SQLite). It runs anywhere Node 22+ is available with **zero native dependencies**
(`bcryptjs` + `node:sqlite`).

For production on Cloudflare, deploy it as a **Cloudflare Worker** backed by
**D1**:

- Map each Express route to a Worker request handler, replacing the SQLite
  calls with D1 (`ctx.env.DB.prepare(...).bind(...).all()` / `.run()` / `.first()`).
- The schema in `backend/index.js` ports 1:1 to D1 `CREATE TABLE` statements.
- Set `JWT_SECRET` and `CORS_ORIGINS=https://your-app.vercel.app` as Worker
  environment secrets/variables.

## Project structure

```
src/
  components/    Reusable UI + layout components
  contexts/      Auth, Theme, and Ad-manager providers
  lib/           API client + types + utils
  pages/         Route-level pages (Landing, Auth, Dashboard, Marketplace, ...)
backend/         Reference Node backend (Express + node:sqlite)
```

## Features

- **Auth** — sign up / log in with the backend (JWT), route protection, persistent session.
- **Marketplace** — search, real category chips, sort, and save products.
- **Product detail** — image gallery, commission, "why promote", real affiliate link generation + asset download.
- **Wallet** — live multi-currency balance (NGN/USD) and transaction history.
- **Withdraw** — validated withdrawal flow wired to the API.
- **Dashboard & Stats** — live performance metrics and charts.
- **Profile** — working dark mode, logout, and account details.
