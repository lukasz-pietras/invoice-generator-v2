# Invoice Generator v2

Invoice Generator v2 is a browser-based tool for drafting Polish invoices with a live preview, VAT handling, and optional exchange rate conversions from the National Bank of Poland (NBP). The repository contains both a ready-to-use static HTML build and the React + TypeScript source components that power the experience.

## Features
- Live form and PDF-style preview kept in sync while you edit.
- Multi-currency invoices with NBP exchange rate lookup and automatic fallback to previous working days.
- VAT-aware line items with per-rate breakdowns and totals.
- Seller and buyer address books persisted in localStorage with quick switching, import, and export helpers.
- Optional PLN conversion tables whenever a foreign currency is selected.
- Logo upload support plus predefined legal note snippets for quick inserts.
- Print dialog integration for generating a PDF and download helpers for company data.

## Project Layout
- `index.html` – standalone build that can be opened directly in a browser.
- `components/` – React + TypeScript components (shadcn/ui + Radix primitives) for use inside a bundler.
- `styles/` – global CSS tokens and base styles that match the standalone build.
- `types/` – shared TypeScript definitions for invoice data structures.
- `Attributions.md` – third-party credits.
- `*.zip` archives – copies of the same folders packaged for convenience; they are not required for local development.

## Quick Start (static build)
1. Clone or download the repository.
2. Open `index.html` in any modern browser, or serve the folder with a lightweight HTTP server:

   ```bash
   npx serve .
   ```

   The application works offline except for exchange rate lookups, which require network access to `https://api.nbp.pl`.

All data you enter is stored in the browser under the `invoiceCompanies` key, so returning to the page restores your saved sellers and buyers.

## Using the React + TypeScript version

The `components/`, `styles/`, and `types/` folders contain the source code exported from the static build. Import specifiers are pinned to CDN versions (for example `@radix-ui/react-select@2.1.6`). If you drop these files into a typical bundler (Vite, Next.js, etc.), either:

- Remove the version suffixes so they resolve against locally installed packages, or
- Configure your bundler to resolve ESM CDN specifiers.

A minimal setup with Vite might look like this:

```bash
npm create vite@latest invoice-generator-v2 -- --template react-ts
cd invoice-generator-v2

# copy App.tsx, components/, styles/, and types/ into src/

npm install class-variance-authority clsx tailwind-merge sonner lucide-react \
  @radix-ui/react-slot @radix-ui/react-label @radix-ui/react-scroll-area \
  @radix-ui/react-select @radix-ui/react-separator @radix-ui/react-tabs
```

Then import the styles in `src/main.tsx` (or `index.css`) and mount `App`:

```ts
import "./styles/globals.css";
import App from "./App.tsx";
```

That gives you the same experience as the static build, with hot reloading and the ability to extend the components.

## Working with the app
- Fill in invoice metadata (number, issue date, sale date, payment method, deadlines).
- Manage seller and buyer records via tabs. Use “Save” to keep a record, “Load” to switch, and the import/export buttons to exchange JSON address books.
- Add invoice items with quantity, unit price, and VAT rates. Totals update inline and the preview groups amounts per VAT band.
- Switch the currency to trigger NBP exchange rate lookups; the tool retries up to ten previous business days if the selected date has no published rate.
- Use quick note buttons to insert the bundled legal disclaimers.
- Upload a logo (stored as a data URL) if you need branding on the preview.
- Click “Download” to open the browser print dialog and export a PDF.

## Data persistence and JSON format
- Browser storage keys: `invoiceCompanies` (address book), plus legacy `savedSellers` / `savedBuyers` keys that are cleaned up on load.
- Exported JSON files contain `seller` and `buyer` dictionaries keyed by company name:

```json
{
  "seller": {
    "ACME Sp. z o.o.": {
      "name": "ACME Sp. z o.o.",
      "nip": "1234567890",
      "address": "Street 1",
      "postalCode": "00-000",
      "city": "Warszawa",
      "country": "PL",
      "account": "00 0000 0000 ..."
    }
  },
  "buyer": {}
}
```

You can import the same structure back into the app to populate the address book.

## External services
Exchange rates come from the public NBP API: `https://api.nbp.pl/api/exchangerates/rates/A/{currency}/{date}/?format=json`. Requests are only made when a non-PLN currency is selected.

## Attribution
See `Attributions.md` for upstream licenses. The UI layer reuses shadcn/ui components (MIT) and iconography from Unsplash imagery where noted.
