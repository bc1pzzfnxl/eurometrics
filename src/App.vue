<script setup lang="ts">
import { onMounted, onUnmounted, ref, computed } from 'vue';
import { useBondDataStore } from './stores/bondDataStore';
import { useFiltersStore } from './stores/filtersStore';
import ControlBar from './components/ControlBar.vue';
import BondChart from './components/BondChart.vue';
import ThemeToggle from './components/ThemeToggle.vue';

const dataStore = useBondDataStore();
const filtersStore = useFiltersStore();

const currentPath = ref(window.location.pathname);
const scrollY = ref(0);
const windowHeight = ref(0);

const navigateTo = (path: string) => {
  window.history.pushState({}, '', path);
  currentPath.value = path;
  if (path === '/app') {
    dataStore.fetchAllData();
  }
};

const handlePopState = () => {
  currentPath.value = window.location.pathname;
};

const handleKeyDown = (e: KeyboardEvent) => {
  if (currentPath.value !== '/app' && e.key === 'Enter') {
    navigateTo('/app');
  }
};

const handleScroll = () => {
  scrollY.value = window.scrollY;
};

const handleResize = () => {
  windowHeight.value = window.innerHeight;
};

onMounted(() => {
  // Only load API data if the user goes directly to the app
  if (currentPath.value === '/app') {
    dataStore.fetchAllData();
  }

  window.addEventListener('popstate', handlePopState);
  window.addEventListener('keydown', handleKeyDown);
  window.addEventListener('scroll', handleScroll, { passive: true });
  window.addEventListener('resize', handleResize);
  windowHeight.value = window.innerHeight;
  scrollY.value = window.scrollY;
});

onUnmounted(() => {
  window.removeEventListener('popstate', handlePopState);
  window.removeEventListener('keydown', handleKeyDown);
  window.removeEventListener('scroll', handleScroll);
  window.removeEventListener('resize', handleResize);
});

const screen1Style = computed(() => {
  if (windowHeight.value === 0) return {};
  const progress = Math.min(scrollY.value / (windowHeight.value * 0.85), 1);
  const blurVal = progress * 8;
  const opacityVal = 1 - (progress * 0.45);
  const scaleVal = 1 - (progress * 0.04);

  return {
    filter: `blur(${blurVal}px)`,
    opacity: opacityVal,
    transform: `scale(${scaleVal})`,
  };
});

const formattedLastUpdated = computed(() => {
  if (!dataStore.lastUpdated) return '';
  const date = new Date(dataStore.lastUpdated);
  const pad = (num: number) => String(num).padStart(2, '0');
  const yyyy = date.getFullYear();
  const mm = pad(date.getMonth() + 1);
  const dd = pad(date.getDate());
  const hh = pad(date.getHours());
  const min = pad(date.getMinutes());
  return `${yyyy}-${mm}-${dd} ${hh}:${min}`;
});
</script>

<template>
  <!-- Screen A: Landing Page -->
  <div v-if="currentPath !== '/app'" class="relative bg-white text-[#003399] min-h-[100dvh] w-full flex flex-col justify-between overflow-hidden select-none font-sans">
    <!-- ASCII Background (Left-aligned, scaling responsively) -->
    <div class="absolute inset-y-0 left-0 flex items-center justify-start pointer-events-none select-none z-0 pl-6 sm:pl-12 md:pl-20">
      <pre class="font-mono text-[2.8vw] md:text-[1.8vw] lg:text-[1.3vw] leading-none text-[#003399]/8 select-none pointer-events-none tracking-tighter">
           €€€€€€€€€€€
       €€€€€        €€€€
     €€€€
    €€€€
  €€€€€€€€€€€€€€€
  €€€€€€€€€€€€€€
  €€€€
  €€€€€€€€€€€€€€
  €€€€€€€€€€€€€
  €€€€
    €€€€
     €€€€€        €€€€
         €€€€€€€€€€€
      </pre>
    </div>

    <!-- Empty Spacer to balance layout without header -->
    <div class="h-10"></div>

    <!-- Main Content -->
    <main class="w-full max-w-4xl mx-auto px-6 flex-grow flex flex-col justify-center items-center text-center z-10 gap-6 my-auto">
      <h1 class="font-serif italic text-7xl sm:text-8xl md:text-9xl tracking-tight leading-none text-[#003399] select-none">
        EuroMetrics
      </h1>
      <p class="font-mono text-[10px] sm:text-xs tracking-wider uppercase text-[#003399]/80 max-w-md leading-relaxed select-none">
        A real-time dashboard for Eurozone sovereign yields, macroeconomics, and central bank policy.
      </p>
      
      <!-- CTA -->
      <div class="mt-8 flex flex-col items-center gap-3">
        <button
          @click="navigateTo('/app')"
          class="px-8 py-3 bg-[#003399] text-white font-mono text-[10px] tracking-widest uppercase font-bold hover:bg-[#002280] active:scale-98 transition-all cursor-pointer border-0 shadow-none rounded-none"
        >
          ENTER DASHBOARD
        </button>
        <span class="font-mono text-[8px] text-[#003399]/40 select-none uppercase tracking-widest">
          Press Enter or Click to Launch
        </span>
      </div>
    </main>

    <!-- Footer -->
    <footer class="w-full max-w-5xl mx-auto px-6 py-8 flex flex-col sm:flex-row justify-between items-center gap-6 text-[9px] font-mono text-[#003399]/60 z-10 border-t border-[#003399]/10">
      <div class="flex flex-col sm:flex-row items-center gap-2 sm:gap-4">
        <span>© {{ new Date().getFullYear() }} EUROMETRICS</span>
        <span class="hidden sm:inline">·</span>
        <span>OFFICIAL DATA SOURCES</span>
      </div>
      <div class="flex items-center gap-6">
        <a href="https://ec.europa.eu/eurostat" target="_blank" rel="noopener noreferrer" class="transition-opacity hover:opacity-100 opacity-70">
          <img src="https://upload.wikimedia.org/wikipedia/commons/e/e0/Eurostat_logo.svg" alt="Eurostat" class="h-5 object-contain" />
        </a>
        <a href="https://www.ecb.europa.eu" target="_blank" rel="noopener noreferrer" class="transition-opacity hover:opacity-100 opacity-70">
          <img src="https://upload.wikimedia.org/wikipedia/commons/b/b7/Logo_European_Central_Bank.svg" alt="ECB" class="h-6 object-contain" />
        </a>
      </div>
    </footer>
  </div>

  <!-- Screen B: Main Dashboard App -->
  <div v-else class="relative bg-background text-foreground min-h-screen">
    <!-- Screen 1: Sticky Main Dashboard (Header + Controls + Chart) -->
    <div
      class="sticky top-0 h-[100dvh] w-full flex flex-col justify-between max-w-6xl mx-auto border-x border-border z-0 overflow-hidden will-change-[transform,filter,opacity]"
      :style="screen1Style"
    >
      <!-- Header -->
      <header class="flex flex-col sm:flex-row items-center justify-between p-4 sm:p-3 border-b border-border select-none bg-background gap-3">
        <div class="flex flex-col min-[400px]:flex-row min-[400px]:items-baseline gap-1 min-[400px]:gap-3 self-start sm:self-auto">
          <h1 class="font-sans font-semibold tracking-wider text-sm uppercase">
            EuroMetrics
          </h1>
          <span 
            v-if="formattedLastUpdated"
            class="font-mono text-[9px] text-text-muted tracking-tight select-none uppercase inline-flex items-center gap-1.5"
            title="Last successful synchronization with ECB & Eurostat APIs"
          >
            <span class="w-1 h-1 rounded-full bg-emerald-500 dark:bg-emerald-400 inline-block"></span>
            Sync: {{ formattedLastUpdated }}
          </span>
        </div>
        
        <!-- Navigation Tabs -->
        <nav class="flex items-center gap-1 border border-border p-0.5 bg-surface/50 font-mono text-[10px] md:text-xs">
          <button 
            @click="filtersStore.activeTab = 'rates'"
            class="px-2 md:px-3 py-1 cursor-pointer select-none transition-colors border-0"
            :class="[filtersStore.activeTab === 'rates' ? 'bg-foreground text-background font-bold' : 'text-text-muted hover:text-text-primary hover:bg-surface']"
          >
            RATES & YIELDS
          </button>
          <button 
            @click="filtersStore.activeTab = 'macro'"
            class="px-2 md:px-3 py-1 cursor-pointer select-none transition-colors border-0"
            :class="[filtersStore.activeTab === 'macro' ? 'bg-foreground text-background font-bold' : 'text-text-muted hover:text-text-primary hover:bg-surface']"
          >
            MACRO & CONVERGENCE
          </button>
          <button 
            @click="filtersStore.activeTab = 'monetary'"
            class="px-2 md:px-3 py-1 cursor-pointer select-none transition-colors border-0"
            :class="[filtersStore.activeTab === 'monetary' ? 'bg-foreground text-background font-bold' : 'text-text-muted hover:text-text-primary hover:bg-surface']"
          >
            MONETARY & FOREX
          </button>
        </nav>

        <ThemeToggle class="self-end sm:self-auto" />
      </header>

      <!-- Filters and Control Bar -->
      <ControlBar class="shrink-0" />

      <!-- Chart Area -->
      <main class="flex-grow flex flex-col w-full min-h-0 relative">
        <BondChart />
      </main>
    </div>

    <!-- Screen 2: Slide-over info page (Explanatory Text) -->
    <div class="relative z-10 w-full bg-background border-t border-border shadow-[0_-15px_30px_rgba(0,0,0,0.08)] dark:shadow-[0_-15px_30px_rgba(0,0,0,0.25)]">
      <div class="max-w-6xl mx-auto border-x border-border p-6 md:p-12 lg:p-16 flex flex-col gap-8 font-mono select-none">
        
        <!-- Info Cards -->
        <div class="flex flex-col gap-6 leading-relaxed">
          <!-- Card 1 -->
          <div class="flex flex-col md:flex-row items-start gap-4 md:gap-6 p-5 border border-border bg-surface/50">
            <div class="flex items-center gap-2 text-text-primary font-bold shrink-0 bg-surface px-3 py-1.5 border border-border text-xs md:text-sm">
              <span>ⓘ</span>
              <span>DATA SOURCES</span>
            </div>
            <p class="text-sm md:text-base text-text-muted">
              Country-specific yields are sourced from the <strong>Maastricht Convergence Criterion series</strong> (monthly, 10Y maturity only). These represent harmonized central government benchmark bond yields used to assess Eurozone eligibility. The complete daily yield curves (3M to 30Y maturities) are estimated by the ECB exclusively for the Euro Area aggregate.
            </p>
          </div>
          
          <!-- Card 2 -->
          <div class="flex flex-col md:flex-row items-start gap-4 md:gap-6 p-5 border border-border bg-surface/50">
            <div class="flex items-center gap-2 text-text-primary font-bold shrink-0 bg-surface px-3 py-1.5 border border-border text-xs md:text-sm">
              <span>ⓘ</span>
              <span>MAASTRICHT BOUNDS</span>
            </div>
            <p class="text-sm md:text-base text-text-muted">
              Under the Maastricht Treaty's long-term interest rate convergence criterion (Article 140 TFEU), a Member State's nominal 10-year government bond yield must not exceed by more than <strong>2 percentage points</strong> the average yield of the three best-performing EU Member States in terms of price stability (lowest inflation) over a one-year reference period.
            </p>
          </div>
          
          <!-- Card 3 -->
          <div class="flex flex-col md:flex-row items-start gap-4 md:gap-6 p-5 border border-border bg-surface/50">
            <div class="flex items-center gap-2 text-text-primary font-bold shrink-0 bg-surface px-3 py-1.5 border border-border text-xs md:text-sm">
              <span>ⓘ</span>
              <span>BANK RATES (MIR)</span>
            </div>
            <p class="text-sm md:text-base text-text-muted">
              Bank mortgage, corporate loan, and deposit rates are sourced from the ECB's <strong>MFI Interest Rate Statistics (MIR)</strong>. These represent annualized agreed rates applied by monetary financial institutions (commercial banks) to new euro-denominated retail business, providing a direct comparison of borrowing costs and savings returns across Eurozone economies.
            </p>
          </div>

          <!-- Card 4 -->
          <div class="flex flex-col md:flex-row items-start gap-4 md:gap-6 p-5 border border-border bg-surface/50">
            <div class="flex items-center gap-2 text-text-primary font-bold shrink-0 bg-surface px-3 py-1.5 border border-border text-xs md:text-sm">
              <span>ⓘ</span>
              <span>MACROECONOMICS</span>
            </div>
            <p class="text-sm md:text-base text-text-muted">
              General government debt-to-GDP is fetched from the ECB's <strong>Government Finance Statistics (GFS)</strong> (quarterly basis, Maastricht criteria limit is <strong>60%</strong>). HICP YoY Inflation is from the ECB's <strong>Harmonised Index of Consumer Prices (ICP)</strong>. GDP growth rate (YoY % change) and monthly Unemployment rate (%) are sourced from <strong>Eurostat</strong> datasets.
            </p>
          </div>

          <!-- Card 5 -->
          <div class="flex flex-col md:flex-row items-start gap-4 md:gap-6 p-5 border border-border bg-surface/50">
            <div class="flex items-center gap-2 text-text-primary font-bold shrink-0 bg-surface px-3 py-1.5 border border-border text-xs md:text-sm">
              <span>ⓘ</span>
              <span>MONETARY & FOREX</span>
            </div>
            <p class="text-sm md:text-base text-text-muted">
              The ECB's key interest policy rate corridor is sourced daily from the ECB's <strong>Financial Market Statistics (FM)</strong>, representing the marginal lending, main refinancing, and deposit facility rates. EUR monthly exchange rates are sourced from the ECB's <strong>Foreign Exchange Rates (EXR)</strong> database.
            </p>
          </div>
        </div>

        <!-- Source / Updates Footer -->
        <div class="flex flex-col sm:flex-row justify-between items-center gap-4 border-t border-border pt-6 mt-4 text-xs text-text-muted">
          <span>SOURCE: ECB SDW (SDW / MIR / GFS / ICP / FM / EXR) & EUROSTAT</span>
          <span>UPDATED DAILY (D-1) · VALUES IN % (EXCEPT EXCHANGE RATES)</span>
        </div>
      </div>
    </div>
  </div>
</template>
