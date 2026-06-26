# EuroMetrics

An elegant, minimalistic Single Page Application (SPA) for personal tracking and comparison of macroeconomic indicators, retail bank interest rates, and sovereign bond yields across the Eurozone.

## Design Philosophy

The visual identity of this application draws inspiration from three core ideas:
- **Apple HIG**: Restrained use of color, generous whitespace, and pure focus on readability.
- **ASCII/Terminal Aesthetic**: Monospaced typography for numeric values, data grids, and borders, making numbers feel precise and clear.
- **Professional Readability**: Information hierarchy created purely through type weights and sizing, avoiding unnecessary visual clutter.

## Tech Stack

- **Frontend framework**: Vue 3 (Composition API + `<script setup>`)
- **Language**: TypeScript (strict module resolution)
- **UI Components**: shadcn-vue (customized for 0px sharp corners and borders)
- **Charts**: Apache ECharts (imported selectively for performance)
- **Styling**: Tailwind CSS v4
- **State Management**: Pinia
- **HTTP client**: ofetch
- **Package Manager**: Bun (v1.3.10+)

## Data Sources & Caching

### Primary Source: ECB (European Central Bank)
- **Yield Curves (YC) Dataset**: Daily estimated yield curves for the Euro area composite (`U2`) across maturities from 3M to 30Y.
- **Interest Rate Statistics (IRS) Dataset**: Monthly convergence criterion government bond yields (10Y) for the 20 Eurozone countries.
- All requests are batched to fetch multiple countries in a single request using the SDMX `+` separator.

### Fallback Source: Eurostat
- If the ECB API service fails or becomes unreachable, the app automatically falls back to Eurostat's JSON-stat Statistics API (`irt_lt_mcby_m` dataset) to load the monthly 10-year sovereign yields.

### Cache Strategy
- API responses are cached in `sessionStorage` for **1 hour** on the client side to avoid redundant network overhead on page refreshes.

## Prerequisites

EuroMetrics uses **Bun** as its package manager and runtime.
- **Bun**: v1.3.10 or higher is required.
  - To install Bun on Linux/macOS:
    ```bash
    curl -fsSL https://bun.sh/install | bash
    ```
  - To install Bun on Windows (via PowerShell):
    ```powershell
    powershell -c "irm bun.sh/install.ps1 | iex"
    ```

## Development & Build Commands

All development tasks are managed using **Bun**.

### 1. Install Dependencies
Downloads project dependencies and generates/updates Bun's binary lockfile (`bun.lockb`):
```bash
bun install
```

### 2. Start Development Server (Vite HMR)
Launches the Vite development server with Hot Module Replacement (HMR).
```bash
bun run dev
```
*   **Default Port**: `5173`
*   **Local URL**: `http://localhost:5173/`
*   **Expose to Local Network**: To expose the dev server to your local network (e.g., to test on mobile devices), run:
    ```bash
    bun run dev --host
    ```
    This binds Vite to `0.0.0.0` and makes it accessible via your local IP address (e.g., `http://192.168.1.50:5173/`).

### 3. Compile and Build for Production
Compiles TypeScript modules (`vue-tsc`) and bundles optimized static assets (HTML, JS, CSS) into the `dist/` directory:
```bash
bun run build
```

### 4. Run Integration Tests
Executes the store logic, category sanitization watcher, and live API fetcher tests via Vitest:
```bash
bun run vitest run src/eurometrics.test.ts
```

### 5. Preview Production Build Locally
Simulates the production environment by spinning up a local static server serving files directly from the built `dist/` directory:
```bash
bun run preview
```
*   **Default Port**: `4173`
*   **Local URL**: `http://localhost:4173/`

### 6. Expose Preview Server to the Local Network
Allows other devices (such as smartphones, tablets, or other computers) on the same Wi-Fi or Ethernet network to access your local production build:
```bash
bun run preview --host
```
*   **How it binds**: Vite binds to `0.0.0.0`, listening on all network interfaces.
*   **Connecting URL**: `http://<YOUR_LOCAL_IP>:4173/` (e.g. `http://192.168.1.50:4173/`).
*   **Force specific port and host**:
    ```bash
    bun run preview --port 4173 --host
    ```

#### 💡 How to find your local IP address:
- **Linux / macOS**: Open a terminal and run `hostname -I` or `ip route show | grep src` or `ip a`. Look for an address starting with `192.168.` or `10.`.
- **Windows**: Open Command Prompt (`cmd`) and run `ipconfig`. Look for the "IPv4 Address" under your active wireless or ethernet adapter.

