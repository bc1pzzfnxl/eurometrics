# EuroMetrics

A minimalist, high-performance dashboard to track and compare macroeconomic indicators, retail bank interest rates, sovereign bond yields, central bank policy corridors, and exchange rates across the Eurozone.

## What's Inside

The application is structured into three main sections:

- **Rates & Yields**: Compare daily sovereign yield curves (3M to 30Y) and monthly 10-year government bond yields across all 20 Eurozone countries.
- **Macro & Convergence**: Track key economic health metrics including HICP inflation, unemployment rates, and GDP growth.
- **Monetary & Forex**: Monitor ECB policy interest rates (DFR, MRR_FR, MLFR) and Euro exchange rates against major global currencies (USD, GBP, CHF, JPY).

Data is fetched directly from official European Central Bank (ECB) and Eurostat APIs.

## How to Run It

This project uses **Bun** for package management and building.

### 1. Install Dependencies
```bash
bun install
```

### 2. Start Development Server
```bash
bun run dev
```
Access the application locally at `http://localhost:5173/`. To expose it to your local network, run `bun run dev --host`.

### 3. Build for Production
```bash
bun run build
```
Static assets are generated in the `dist/` directory.

### 4. Preview Production Build
```bash
bun run preview
```
Access the preview locally at `http://localhost:4173/`. To expose it to your local network, run `bun run preview --host`.

### 5. Run Tests
```bash
bun run vitest run src/eurometrics.test.ts
```
