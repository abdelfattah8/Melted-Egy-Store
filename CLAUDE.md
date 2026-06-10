# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
npm run dev       # Start dev server (Vite, port 5173, HMR enabled)
npm run build     # Production build → dist/
npm run preview   # Preview production build locally
npm run lint      # ESLint (flat config, eslint.config.js)
```

No test runner is configured.

## Architecture

**Sweet Bites** is a React 19 + Vite SPA for an Egyptian dessert e-commerce store. All backend logic runs through Firebase (Firestore, Auth, Cloud Storage) — there is no separate server.

### State & Data Flow

- **AuthContext** (`src/context/AuthContext.jsx`) — wraps Firebase Auth; exposes `currentUser` (Firebase user object) and `userData` (Firestore `users/{uid}` document). The `isAdmin` flag in `userData` gates admin access.
- **CartContext** (`src/context/CartContext.jsx`) — cart state lives in memory and is synced to `localStorage`. Calculates delivery fee (85 EGP) and 30% deposit when order total > 1000 EGP.
- **WishlistContext** (`src/context/WishlistContext.jsx`) — same localStorage-backed pattern as cart.

### Routing (`src/App.jsx`)

React Router v7. Three protection tiers:

| Tier | Guard | Routes |
|------|-------|--------|
| Public | none | `/`, `/shop`, `/new-items`, `/wishlist`, `/checkout`, `/order-success`, `/visa-payment`, `/login`, `/register` |
| Protected | auth required | `/profile`, `/my-orders` |
| Admin | auth + `isAdmin` | `/admin`, `/admin/products`, `/admin/orders`, `/admin/offers`, `/admin/settings` |

`ProtectedRoute` (`src/components/ProtectedRoute.jsx`) checks both conditions and redirects accordingly.

### Firebase Collections

| Collection | Who reads | Who writes |
|-----------|-----------|------------|
| `products` | anyone | admin only |
| `orders` | owner or admin | anyone creates; admin updates |
| `users` | self or admin | self (but `isAdmin` is immutable by users) |
| `settings` | anyone | admin only |

Security rules are in `firestore.rules` — paste into the Firebase console to deploy.

### Key Patterns

- **Product categories:** `cookies`, `brownies`, `cheesecake`, `tiramisu`. The `Shop` page filters via `?cat=<category>` query param. `isNew: true` on a product surfaces it on `/new-items`.
- **Order status flow:** `pending_payment` → `pending_approval` or `confirmed` → `preparing` → `delivered` / `cancelled`. Admin drives transitions from `/admin/orders`.
- **Payment paths:** Cash on delivery (may require deposit transfer verification) or Visa via an external gateway (`/visa-payment`).
- **Admin layout:** `/admin/*` routes render inside `AdminLayout.jsx` which provides the sidebar. Each admin sub-page fetches its own Firestore data independently.
- **Image uploads:** Product images are stored in Firebase Storage; download URLs are saved on the Firestore product document.
- **Settings doc:** A single document in the `settings` collection holds site-wide config (transfer number, delivery note). Read on checkout and admin settings page.

### Styling

Global design tokens (CSS custom properties) and a lightweight utility layer live in `src/index.css`. The palette is pink/brown/cream. Mobile breakpoint is 768 px.

### Firebase Config

Firebase credentials come from `.env` via Vite's `import.meta.env.VITE_*` pattern. `src/firebase/config.jsx` initialises the app and exports `auth`, `db`, and `storage`.

### Seed Script

`seed.jsx` (project root) populates Firestore with 12 initial products and a default `settings` document. Run once with `node seed.jsx` against a real Firebase project (requires `.env`).
