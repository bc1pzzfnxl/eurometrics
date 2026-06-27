<script setup lang="ts">
import { onMounted, onUnmounted, ref, computed, watch, nextTick } from 'vue';
import createGlobe from 'cobe';
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

// Cobe Globe Configuration & State
const globeCanvas = ref<HTMLCanvasElement | null>(null);
let globe: any = null;

const eurozoneCapitals = [
  { code: 'DE', lat: 52.5200, lng: 13.4050 },
  { code: 'FR', lat: 48.8566, lng: 2.3522 },
  { code: 'IT', lat: 41.9028, lng: 12.4964 },
  { code: 'ES', lat: 40.4168, lng: -3.7038 },
  { code: 'NL', lat: 52.3676, lng: 4.9041 },
  { code: 'BE', lat: 50.8503, lng: 4.3517 },
  { code: 'AT', lat: 48.2082, lng: 16.3738 },
  { code: 'PT', lat: 38.7223, lng: -9.1393 },
  { code: 'GR', lat: 37.9838, lng: 23.7275 },
  { code: 'IE', lat: 53.3498, lng: -6.2603 },
  { code: 'FI', lat: 60.1699, lng: 24.9384 },
  { code: 'SK', lat: 48.1486, lng: 17.1077 },
  { code: 'HR', lat: 45.8150, lng: 15.9819 },
  { code: 'LT', lat: 54.6872, lng: 25.2797 },
  { code: 'SI', lat: 46.0569, lng: 14.5058 },
  { code: 'LV', lat: 56.9496, lng: 24.1052 },
  { code: 'EE', lat: 59.4370, lng: 24.7536 },
  { code: 'CY', lat: 35.1856, lng: 33.3823 },
  { code: 'LU', lat: 49.6116, lng: 6.1319 },
  { code: 'MT', lat: 35.8989, lng: 14.5146 }
];

const currentPhi = ref(-0.65); // Focused longitude to bring Europe even further right of center
const currentTheta = ref(0.85); // Focused tilt looking down on Europe (48° N)

// Cobe Projected coordinates helper matching Cobe's GLSL rotation matrix
const getMarker2D = (lat: number, lng: number) => {
  const GLOBE_R = 0.8;
  const latRad = lat * Math.PI / 180;
  const lngRad = lng * Math.PI / 180 - Math.PI;
  const cosLat = Math.cos(latRad);
  const x3d = -cosLat * Math.cos(lngRad) * GLOBE_R;
  const y3d = Math.sin(latRad) * GLOBE_R;
  const z3d = cosLat * Math.sin(lngRad) * GLOBE_R;

  const cosT = Math.cos(currentTheta.value);
  const cosP = Math.cos(currentPhi.value);
  const sinT = Math.sin(currentTheta.value);
  const sinP = Math.sin(currentPhi.value);

  const projX = cosP * x3d + sinP * z3d;
  const projY = sinP * sinT * x3d + cosT * y3d - cosP * sinT * z3d;
  const projZ = -sinP * cosT * x3d + sinT * y3d + cosP * cosT * z3d;

  const xPct = (projX + 1) / 2 * 100;
  const yPct = (-projY + 1) / 2 * 100;

  // Visible if on the front hemisphere of the globe
  const visible = projZ > 0;

  return { x: xPct, y: yPct, visible };
};

// 6 largest Eurozone countries (€) for displaying 10Y Yield tooltips
// We include custom horizontal (tx) translate offsets and vertical heights (hVal) to stagger and prevent overlaps
const featuredBonds = computed(() => {
  const list = [
    { code: 'DE', name: 'Germany', city: 'Berlin', lat: 52.5200, lng: 13.4050, fallback: '2.40%', tx: '-50%', hVal: '6px' },
    { code: 'FR', name: 'France', city: 'Paris', lat: 48.8566, lng: 2.3522, fallback: '3.05%', tx: '-85%', hVal: '6px' },
    { code: 'IT', name: 'Italy', city: 'Rome', lat: 41.9028, lng: 12.4964, fallback: '3.85%', tx: '-50%', hVal: '6px' },
    { code: 'ES', name: 'Spain', city: 'Madrid', lat: 40.4168, lng: -3.7038, fallback: '3.20%', tx: '-50%', hVal: '6px' },
    { code: 'NL', name: 'Netherlands', city: 'Amsterdam', lat: 52.3676, lng: 4.9041, fallback: '2.65%', tx: '-50%', hVal: '52px' },
    { code: 'BE', name: 'Belgium', city: 'Brussels', lat: 50.8503, lng: 4.3517, fallback: '2.95%', tx: '-15%', hVal: '28px' }
  ];

  return list.map(c => {
    const points = dataStore.countriesData?.[c.code];
    const yieldVal = points && points.length > 0 
      ? `${points[points.length - 1].value.toFixed(2)}%` 
      : c.fallback;
      
    const proj = getMarker2D(c.lat, c.lng);
    
    return {
      ...c,
      yield: yieldVal,
      x: proj.x,
      y: proj.y,
      visible: proj.visible
    };
  });
});

let animationFrameId: number | null = null;

// Globe instantiation
const initGlobe = () => {
  if (globe) {
    globe.destroy();
    globe = null;
  }
  if (animationFrameId) {
    cancelAnimationFrame(animationFrameId);
    animationFrameId = null;
  }
  
  if (!globeCanvas.value) return;

  globe = createGlobe(globeCanvas.value, {
    devicePixelRatio: Math.min(window.devicePixelRatio || 1, 2),
    width: 600 * 2, // 1200 as requested
    height: 600 * 2, // 1200 as requested
    phi: currentPhi.value,
    theta: currentTheta.value,
    dark: 0, // Light mode so ocean is white and land is dark!
    diffuse: 1.2, // diffuse 1.2 as requested
    scale: 1.15, // Enlarged scale to make the globe bigger and separate markers
    mapSamples: 16000, // mapSamples 16000 as requested
    mapBrightness: 10, // Higher brightness to ensure dots are clearly visible against white base
    baseColor: [1.0, 1.0, 1.0], // White ocean as requested
    markerColor: [0.2, 0.4, 1.0], // Royal Blue markers matching the user's request
    glowColor: [1.0, 1.0, 1.0], // White glow matching the user's request
    offset: [0, 0],
    markers: eurozoneCapitals.map(c => {
      const isFeatured = ['DE', 'FR', 'IT', 'ES', 'NL', 'BE'].includes(c.code);
      return {
        location: [c.lat, c.lng] as [number, number],
        size: isFeatured ? 0.055 : 0.03
      };
    })
  });

  // Keep a static requestAnimationFrame loop running.
  // This resolves the bug in Cobe's compiled ESM build where texture image onload updates
  // are not painted to the canvas unless a re-render is triggered on a frame cycle.
  const animate = () => {
    if (globe) {
      globe.update({
        phi: currentPhi.value,
        theta: currentTheta.value
      });
    }
    animationFrameId = requestAnimationFrame(animate);
  };

  animate();
};

const destroyGlobe = () => {
  if (globe) {
    globe.destroy();
    globe = null;
  }
  if (animationFrameId) {
    cancelAnimationFrame(animationFrameId);
    animationFrameId = null;
  }
};

// Lifecycle
watch(currentPath, async (newPath) => {
  if (newPath !== '/app') {
    await nextTick();
    initGlobe();
  } else {
    destroyGlobe();
  }
}, { immediate: true });

onMounted(() => {
  // Always load API data in the background to prime the cache and populate the marquee
  dataStore.fetchAllData();

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
  destroyGlobe();
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

const marqueeItems = computed(() => {
  const getLatest = (arr: any[] | undefined) => {
    if (!arr || arr.length === 0) return null;
    return arr[arr.length - 1];
  };

  const dfr = getLatest(dataStore.policyRatesData?.['DFR'])?.value;
  const mrr = getLatest(dataStore.policyRatesData?.['MRR_FR'])?.value;
  const inflation = getLatest(dataStore.inflationData?.['EA'])?.value;
  const ea10y = getLatest(dataStore.euroAreaAll?.['SR_10Y'])?.value;
  const de10y = getLatest(dataStore.countriesData?.['DE'])?.value;
  const fr10y = getLatest(dataStore.countriesData?.['FR'])?.value;
  const it10y = getLatest(dataStore.countriesData?.['IT'])?.value;
  const eurUsd = getLatest(dataStore.exchangeRatesData?.['USD'])?.value;
  const eurGbp = getLatest(dataStore.exchangeRatesData?.['GBP'])?.value;

  // ponytail: fallback values are provided so marquee is instantly populated before background fetch finishes
  return [
    { label: 'ECB DEPOSIT RATE', value: dfr !== undefined ? `${dfr.toFixed(2)}%` : '3.25%' },
    { label: 'ECB REFI RATE', value: mrr !== undefined ? `${mrr.toFixed(2)}%` : '3.50%' },
    { label: 'EURO INFLATION', value: inflation !== undefined ? `${inflation.toFixed(1)}%` : '2.0%' },
    { label: 'EA 10Y YIELD', value: ea10y !== undefined ? `${ea10y.toFixed(2)}%` : '3.12%' },
    { label: 'DE 10Y YIELD', value: de10y !== undefined ? `${de10y.toFixed(2)}%` : '2.40%' },
    { label: 'FR 10Y YIELD', value: fr10y !== undefined ? `${fr10y.toFixed(2)}%` : '3.05%' },
    { label: 'IT 10Y YIELD', value: it10y !== undefined ? `${it10y.toFixed(2)}%` : '3.85%' },
    { label: 'EUR / USD', value: eurUsd !== undefined ? eurUsd.toFixed(4) : '1.0850' },
    { label: 'EUR / GBP', value: eurGbp !== undefined ? eurGbp.toFixed(4) : '0.8540' },
  ];
});
</script>

<template>
  <!-- Screen A: Landing Page -->
  <div v-if="currentPath !== '/app'" class="relative bg-white text-[#003399] min-h-[100dvh] w-full flex flex-col justify-between overflow-hidden select-none font-sans">
    <!-- Dynamic SVG Yield Curve Background -->
    <div class="absolute inset-0 w-full h-full pointer-events-none z-0 opacity-30 select-none">
      <svg class="w-full h-full" viewBox="0 0 1440 600" preserveAspectRatio="none" xmlns="http://www.w3.org/2000/svg">
        <!-- Grid lines -->
        <g stroke="#003399" stroke-opacity="0.05" stroke-dasharray="4 6" stroke-width="1">
          <!-- Horizontal -->
          <line x1="0" y1="150" x2="1440" y2="150" />
          <line x1="0" y1="275" x2="1440" y2="275" />
          <line x1="0" y1="400" x2="1440" y2="400" />
          <line x1="0" y1="525" x2="1440" y2="525" />
          <!-- Vertical -->
          <line x1="120" y1="0" x2="120" y2="600" />
          <line x1="420" y1="0" x2="420" y2="600" />
          <line x1="720" y1="0" x2="720" y2="600" />
          <line x1="1020" y1="0" x2="1020" y2="600" />
          <line x1="1320" y1="0" x2="1320" y2="600" />
        </g>

        <!-- Grid Labels -->
        <g fill="#003399" fill-opacity="0.18" class="font-mono text-[9px]">
          <!-- Y-axis -->
          <text x="15" y="145">4.00%</text>
          <text x="15" y="270">3.00%</text>
          <text x="15" y="395">2.00%</text>
          <text x="15" y="520">1.00%</text>
          <!-- X-axis -->
          <text x="125" y="25">3M</text>
          <text x="425" y="25">2Y</text>
          <text x="725" y="25">5Y</text>
          <text x="1025" y="25">10Y</text>
          <text x="1325" y="25">30Y</text>
        </g>

        <!-- Dynamic Curves -->
        <!-- Curve 3 (1 Year Ago - Faintest, dashed) -->
        <path class="animate-curve-3" fill="none" stroke="#003399" stroke-opacity="0.08" stroke-width="1" stroke-dasharray="3 4"
              d="M 0,520 C 400,480 700,320 1000,260 C 1300,220 1440,210 1440,210" />
              
        <!-- Curve 2 (1 Month Ago - Medium, dashed) -->
        <path class="animate-curve-2" fill="none" stroke="#003399" stroke-opacity="0.15" stroke-width="1.5" stroke-dasharray="5 5"
              d="M 0,480 C 350,450 650,280 950,220 C 1250,190 1440,180 1440,180" />

        <!-- Curve 1 (Active/Current - Thickest, solid) -->
        <path class="animate-curve-1" fill="none" stroke="#003399" stroke-opacity="0.25" stroke-width="2.5"
              d="M 0,450 C 300,430 600,250 900,200 C 1200,170 1440,160 1440,160" />
      </svg>
    </div>

    <!-- Main Content (Interactive Globe Column + App Pitch Column) -->
    <main class="w-full max-w-5xl mx-auto px-6 flex-grow flex flex-col md:flex-row items-center justify-center gap-8 md:gap-16 z-10 my-auto py-8">
      
      <!-- Left: Interactive WebGL Globe -->
      <div class="relative w-[350px] h-[350px] sm:w-[450px] sm:h-[450px] md:w-[600px] md:h-[600px] flex items-center justify-center shrink-0">
        <!-- Background Radial Glow (Soft EU Blue aura behind the light globe) -->
        <div class="absolute inset-0 rounded-full pointer-events-none" style="background: radial-gradient(circle, rgba(0, 51, 153, 0.04) 0%, transparent 70%);"></div>
        <!-- Canvas for Cobe WebGL Globe -->
        <canvas 
          ref="globeCanvas" 
          class="w-full h-full opacity-95" 
          style="width: 100%; height: 100%;"
        ></canvas>

        <!-- Projected HTML Tooltips with staggered vertical connectors -->
        <div 
          v-for="bond in featuredBonds" 
          :key="bond.code"
          class="absolute pointer-events-none select-none transition-opacity duration-150 flex flex-col items-center justify-end"
          :style="{
            left: bond.x + '%',
            top: bond.y + '%',
            opacity: bond.visible ? 1 : 0,
            transform: `translate(${bond.tx}, -100%)`
          }"
        >
          <!-- Tooltip box -->
          <div class="bg-[#003399] text-white px-2 py-0.5 font-mono text-[8px] sm:text-[9px] font-bold tracking-wider whitespace-nowrap shadow-none rounded-none flex items-center gap-1.5 z-10">
            <span>{{ bond.name.toUpperCase() }}</span>
            <span class="opacity-50">|</span>
            <span>{{ bond.yield }}</span>
          </div>

          <!-- Staggered vertical connector line & arrow pin pointing at the capital -->
          <div class="flex flex-col items-center" :style="{ height: bond.hVal }">
            <div v-if="bond.hVal !== '6px'" class="w-[1px] bg-[#003399]/40 flex-grow"></div>
            <div class="w-0 h-0 border-l-[3px] border-l-transparent border-r-[3px] border-r-transparent border-t-[3px] border-t-[#003399]"></div>
          </div>
        </div>
      </div>

      <!-- Right: Main Branding & Call to Action -->
      <div class="flex flex-col items-center md:items-start text-center md:text-left max-w-md gap-6">
        <h1 class="font-serif italic text-6xl sm:text-7xl md:text-8xl tracking-tight leading-none text-[#003399]">
          EuroMetrics
        </h1>
        <p class="font-mono text-[10px] sm:text-xs tracking-wider uppercase text-[#003399]/80 leading-relaxed">
          A real-time dashboard for Eurozone sovereign yields, macroeconomics, and central bank policy.
        </p>
        
        <!-- CTA -->
        <div class="mt-2 flex flex-col items-center md:items-start gap-3 w-full">
          <button
            @click="navigateTo('/app')"
            class="px-8 py-3 bg-[#003399] text-white font-mono text-[10px] tracking-widest uppercase font-bold hover:bg-[#002280] active:scale-98 transition-all cursor-pointer border-0 shadow-none rounded-none w-full sm:w-auto"
          >
            ENTER DASHBOARD
          </button>
          <span class="font-mono text-[8px] text-[#003399]/40 uppercase tracking-widest self-center md:self-start pl-1">
            Press Enter or Click to Launch
          </span>
        </div>
      </div>
    </main>

    <!-- Marquee Ticker -->
    <div class="w-full border-y border-[#003399]/10 bg-[#003399]/2 py-3 overflow-hidden select-none z-10">
      <div class="flex whitespace-nowrap w-max animate-marquee">
        <!-- First instance -->
        <div class="flex items-center gap-12 px-6 font-mono text-[10px] md:text-xs text-[#003399]/80">
          <div v-for="(item, idx) in marqueeItems" :key="'m1-' + idx" class="flex items-center gap-2">
            <span class="font-bold tracking-wider uppercase text-[#003399]/50">{{ item.label }}:</span>
            <span class="font-semibold text-[#003399]">{{ item.value }}</span>
          </div>
        </div>
        <!-- Duplicated instance for seamless loop -->
        <div class="flex items-center gap-12 px-6 font-mono text-[10px] md:text-xs text-[#003399]/80" aria-hidden="true">
          <div v-for="(item, idx) in marqueeItems" :key="'m2-' + idx" class="flex items-center gap-2">
            <span class="font-bold tracking-wider uppercase text-[#003399]/50">{{ item.label }}:</span>
            <span class="font-semibold text-[#003399]">{{ item.value }}</span>
          </div>
        </div>
      </div>
    </div>

    <!-- Footer -->
    <footer class="w-full max-w-5xl mx-auto px-6 py-8 flex flex-col sm:flex-row justify-between items-center gap-6 text-[9px] font-mono text-[#003399]/60 z-10 border-t border-[#003399]/10">
      <div class="flex flex-col sm:flex-row items-center gap-2 sm:gap-4">
        <span>© {{ new Date().getFullYear() }} EUROMETRICS</span>
        <span class="hidden sm:inline">·</span>
        <span>OFFICIAL DATA SOURCES</span>
      </div>
      <div class="flex items-center gap-6">
        <a href="https://ec.europa.eu/eurostat" target="_blank" rel="noopener noreferrer" class="transition-opacity hover:opacity-100 opacity-75">
          <img src="/eurostat_logo.png" alt="Eurostat" class="h-5 object-contain" />
        </a>
        <a href="https://www.ecb.europa.eu" target="_blank" rel="noopener noreferrer" class="transition-opacity hover:opacity-100 opacity-75">
          <img src="/ecb_logo.svg" alt="ECB" class="h-6 object-contain" />
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
