<script setup lang="ts">
import { onMounted, onUnmounted, ref, computed, watch, nextTick, defineAsyncComponent } from 'vue';
import createGlobe from 'cobe';
import { useBondDataStore } from './stores/bondDataStore';
import { useFiltersStore } from './stores/filtersStore';
import ThemeToggle from './components/ThemeToggle.vue';

const ControlBar = defineAsyncComponent(() => import('./components/ControlBar.vue'));
const BondChart = defineAsyncComponent(() => import('./components/BondChart.vue'));
const QuickCompare = defineAsyncComponent(() => import('./components/QuickCompare.vue'));
const AiChatDock = defineAsyncComponent(() => import('./components/AiChatDock.vue'));

const dataStore = useBondDataStore();
const filtersStore = useFiltersStore();

const currentPath = ref(window.location.pathname);
const scrollY = ref(0);
const windowHeight = ref(0);

const navigateTo = (path: string) => {
  window.history.pushState({}, '', path);
  currentPath.value = path;
  if (path === '/app' || path === '/compare') {
    dataStore.fetchAllData();
  }
};

const handlePopState = () => {
  currentPath.value = window.location.pathname;
  if (currentPath.value === '/app' || currentPath.value === '/compare') {
    dataStore.fetchAllData();
  }
};

const handleKeyDown = (e: KeyboardEvent) => {
  if (currentPath.value !== '/app' && currentPath.value !== '/compare' && e.key === 'Enter') {
    navigateTo('/app');
  }
};

const handleScroll = () => {
  scrollY.value = window.scrollY;
};

const scrollToInfo = () => {
  window.scrollTo({
    top: windowHeight.value * 0.95,
    behavior: 'smooth'
  });
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

const currentPhi = ref(-1.13); // Rotated 65 degrees clockwise from Europe center
const currentTheta = ref(0.84); // Mathematically centered latitude for Europe cluster

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

// 16 Eurozone countries for displaying 10Y Yield tooltips
// We include custom horizontal shifts (shiftX) and vertical heights (hVal) to stagger and prevent overlaps
const featuredBonds = computed(() => {
  const list = [
    { code: 'DE', name: 'Germany', city: 'Berlin', lat: 52.5200, lng: 13.4050, fallback: '2.40%', shiftX: '-20px', hVal: '32px', desktopOnly: false, placement: 'top' },
    { code: 'FR', name: 'France', city: 'Paris', lat: 48.8566, lng: 2.3522, fallback: '3.05%', shiftX: '-20px', hVal: '6px', desktopOnly: false, placement: 'top' },
    { code: 'IT', name: 'Italy', city: 'Rome', lat: 41.9028, lng: 12.4964, fallback: '3.85%', shiftX: '15px', hVal: '6px', desktopOnly: false, placement: 'bottom' },
    { code: 'ES', name: 'Spain', city: 'Madrid', lat: 40.4168, lng: -3.7038, fallback: '3.20%', shiftX: '-30px', hVal: '6px', desktopOnly: false, placement: 'top' },
    { code: 'PT', name: 'Portugal', city: 'Lisbon', lat: 38.7223, lng: -9.1393, fallback: '3.15%', shiftX: '-20px', hVal: '6px', desktopOnly: true, placement: 'bottom' },
    { code: 'IE', name: 'Ireland', city: 'Dublin', lat: 53.3498, lng: -6.2603, fallback: '2.80%', shiftX: '-80px', hVal: '6px', desktopOnly: true, placement: 'top' },
    { code: 'AT', name: 'Austria', city: 'Vienna', lat: 48.2082, lng: 16.3738, fallback: '2.75%', shiftX: '50px', hVal: '6px', desktopOnly: true, placement: 'bottom' },
    { code: 'FI', name: 'Finland', city: 'Helsinki', lat: 60.1699, lng: 24.9384, fallback: '2.70%', shiftX: '-45px', hVal: '24px', desktopOnly: true, placement: 'top' },
    { code: 'GR', name: 'Greece', city: 'Athens', lat: 37.9838, lng: 23.7275, fallback: '3.60%', shiftX: '70px', hVal: '6px', desktopOnly: true, placement: 'bottom' },
    { code: 'LT', name: 'Lithuania', city: 'Vilnius', lat: 54.6872, lng: 25.2797, fallback: '3.15%', shiftX: '45px', hVal: '6px', desktopOnly: true, placement: 'top' },
    { code: 'EE', name: 'Estonia', city: 'Tallinn', lat: 59.4370, lng: 24.7535, fallback: '3.10%', shiftX: '28px', hVal: '50px', desktopOnly: true, placement: 'top' }
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
let renderTimer: any = null;

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
  if (renderTimer) {
    clearTimeout(renderTimer);
    renderTimer = null;
  }
  
  if (!globeCanvas.value) return;

  globe = createGlobe(globeCanvas.value, {
    devicePixelRatio: Math.min(window.devicePixelRatio || 1, 2),
    width: 450 * 2, // 900 (reduced 25%)
    height: 450 * 2, // 900 (reduced 25%)
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
    markers: eurozoneCapitals
      .filter(c => ['DE', 'FR', 'IT', 'ES', 'PT', 'IE', 'AT', 'FI', 'GR', 'LT', 'EE'].includes(c.code))
      .map(c => {
        return {
          location: [c.lat, c.lng] as [number, number],
          size: 0.0275
        };
      })
  });

  // Keep a static requestAnimationFrame loop running for a limited time to ensure loading paints, then stop.
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

  renderTimer = setTimeout(() => {
    if (animationFrameId) {
      cancelAnimationFrame(animationFrameId);
      animationFrameId = null;
    }
  }, 2000);
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
  if (renderTimer) {
    clearTimeout(renderTimer);
    renderTimer = null;
  }
};

const updateMetadata = (path: string) => {
  let title = 'EuroMetrics - Eurozone Macro & Interest Rate Dashboard';
  let desc = 'Interactive, real-time dashboard tracking Eurozone macroeconomic indicators, retail interest rates, and sovereign bond yields directly from official sources like ECB and Eurostat.';

  if (path === '/app') {
    title = 'EuroMetrics Dashboard - Real-time Eurozone Macro Indicators';
    desc = 'Explore interactive charts, sovereign bond yields, bank mortgage rates, inflation rates, and more macroeconomic indicators for all Eurozone countries.';
  } else if (path === '/compare') {
    title = 'Quick Compare - Compare Eurozone Macroeconomic Indicators';
    desc = 'Quickly compare retail interest rates, inflation, GDP growth, and debt-to-GDP indicators of individual Eurozone countries against the Eurozone average.';
  }

  document.title = title;
  const descEl = document.querySelector('meta[name="description"]');
  if (descEl) {
    descEl.setAttribute('content', desc);
  }
};

watch(currentPath, async (newPath) => {
  updateMetadata(newPath);
  if (newPath !== '/app' && newPath !== '/compare') {
    await nextTick();
    initGlobe();
  } else {
    destroyGlobe();
  }
});

onMounted(() => {
  updateMetadata(currentPath.value);

  if (currentPath.value !== '/app' && currentPath.value !== '/compare') {
    dataStore.fetchLandingData();
    nextTick(() => {
      initGlobe();
    });
  } else {
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
  <div v-if="currentPath !== '/app' && currentPath !== '/compare'" class="relative bg-white text-[#003399] min-h-[100dvh] w-full flex flex-col justify-between overflow-hidden select-none font-sans">
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
      <div class="animate-fade-in">
      <div class="relative w-[263px] h-[263px] sm:w-[338px] sm:h-[338px] md:w-[450px] md:h-[450px] flex items-center justify-center shrink-0 animate-float">
        <!-- Background Radial Glow (Soft EU Blue aura behind the light globe) -->
        <div class="absolute inset-0 rounded-full pointer-events-none" style="background: radial-gradient(circle, rgba(0, 51, 153, 0.04) 0%, transparent 70%);"></div>
        <!-- Canvas for Cobe WebGL Globe -->
        <canvas 
          ref="globeCanvas" 
          class="w-full h-full opacity-95" 
          style="width: 100%; height: 100%;"
        ></canvas>
        <!-- Ground shadow to reinforce floating effect -->
        <div class="absolute bottom-[-8%] left-1/2 -translate-x-1/2 w-[60%] h-[6%] rounded-full pointer-events-none" style="background: radial-gradient(ellipse, rgba(0,51,153,0.10) 0%, transparent 70%);"></div>

        <!-- Projected HTML Tooltips with staggered vertical connectors -->
        <div 
          v-for="bond in featuredBonds" 
          :key="bond.code"
          class="absolute pointer-events-none select-none transition-opacity duration-150 flex flex-col items-center"
          :class="[bond.desktopOnly ? 'hidden md:flex' : 'flex', bond.placement === 'bottom' ? 'justify-start' : 'justify-end']"
          :style="{
            left: bond.x + '%',
            top: bond.y + '%',
            opacity: bond.visible ? 1 : 0,
            transform: bond.placement === 'bottom' ? 'translate(-50%, 0%)' : 'translate(-50%, -100%)'
          }"
        >
          <!-- Bottom-oriented tooltip content -->
          <template v-if="bond.placement === 'bottom'">
            <!-- Staggered vertical connector line & arrow pin pointing up at the capital -->
            <div class="flex flex-col items-center justify-start" :style="{ height: bond.hVal }">
              <div class="w-0 h-0 border-l-[3px] border-l-transparent border-r-[3px] border-r-transparent border-b-[3px] border-b-[#003399]"></div>
              <div v-if="bond.hVal !== '6px'" class="w-[1.5px] bg-[#003399]/70 flex-grow"></div>
            </div>

            <!-- Tooltip box (shifted horizontally if needed) -->
            <div 
              class="bg-[#003399] text-white px-2 py-0.5 font-mono text-[8px] sm:text-[9px] font-bold tracking-wider whitespace-nowrap shadow-none rounded-none flex items-center gap-1.5 z-10"
              :style="{
                transform: bond.shiftX ? `translateX(${bond.shiftX})` : 'none'
              }"
            >
              <span>{{ bond.code }}</span>
              <span class="opacity-50">|</span>
              <span>{{ bond.yield }}</span>
            </div>
          </template>

          <!-- Top-oriented tooltip content (default) -->
          <template v-else>
            <!-- Tooltip box (shifted horizontally if needed) -->
            <div 
              class="bg-[#003399] text-white px-2 py-0.5 font-mono text-[8px] sm:text-[9px] font-bold tracking-wider whitespace-nowrap shadow-none rounded-none flex items-center gap-1.5 z-10"
              :style="{
                transform: bond.shiftX ? `translateX(${bond.shiftX})` : 'none'
              }"
            >
              <span>{{ bond.code }}</span>
              <span class="opacity-50">|</span>
              <span>{{ bond.yield }}</span>
            </div>

            <!-- Staggered vertical connector line & arrow pin pointing down at the capital -->
            <div class="flex flex-col items-center justify-end" :style="{ height: bond.hVal }">
              <div v-if="bond.hVal !== '6px'" class="w-[1.5px] bg-[#003399]/70 flex-grow"></div>
              <div class="w-0 h-0 border-l-[3px] border-l-transparent border-r-[3px] border-r-transparent border-t-[3px] border-t-[#003399]"></div>
            </div>
          </template>
        </div>
      </div>
      </div>

      <!-- Right: Main Branding & Call to Action -->
      <div class="flex flex-col items-center md:items-start text-center md:text-left max-w-md gap-6">
        <h1 class="font-serif italic text-7xl sm:text-8xl md:text-9xl tracking-tight leading-none text-[#003399] animate-fade-in">
          EuroMetrics
        </h1>
        <p class="font-mono text-xs sm:text-sm tracking-wider uppercase text-[#003399]/80 leading-relaxed animate-fade-in animation-delay-150">
          Track every ECB rate decision, bond yield, and macro shift — before the market reacts.
        </p>
        <p class="font-mono text-[10px] sm:text-xs tracking-wider uppercase text-[#003399]/50 -mt-4 animate-fade-in animation-delay-150">
          Live data · Zero delay · Direct from ECB &amp; Eurostat
        </p>
        
        <!-- AI Promotion Banner -->
        <div class="py-2.5 px-3.5 border-l-2 border-[#003399] font-mono text-[10px] sm:text-xs text-[#003399] leading-relaxed max-w-md text-left animate-fade-in animation-delay-150">
          <strong>INTELLIGENT AI ANALYST</strong> — Query our real-time AI agent within the dashboard to interpret complex yields, Maastricht Treaty compliance margins, or inflation trends on the fly.
        </div>
        
        <!-- CTA -->
        <div class="mt-2 flex flex-col items-center md:items-start gap-3 w-full animate-fade-in animation-delay-300">
          <button
            @click="navigateTo('/app')"
            class="group px-8 py-3 bg-[#003399] text-white font-mono text-xs tracking-widest uppercase font-bold hover:bg-[#002280] hover:shadow-[0_0_20px_rgba(0,51,153,0.3)] active:scale-98 transition-all cursor-pointer border-0 shadow-none rounded-none w-full sm:w-auto"
          >
            EXPLORE LIVE DATA <span class="inline-block transition-transform group-hover:translate-x-1">→</span>
          </button>
          <button
            @click="navigateTo('/compare')"
            class="group px-8 py-3 bg-transparent text-[#003399] font-mono text-xs tracking-widest uppercase font-bold border border-[#003399]/30 hover:border-[#003399]/60 hover:bg-[#003399]/5 active:scale-98 transition-all cursor-pointer shadow-none rounded-none w-full sm:w-auto"
          >
            QUICK COMPARE <span class="inline-block transition-transform group-hover:translate-x-1">→</span>
          </button>
          <span class="font-mono text-[10px] text-[#003399]/40 uppercase tracking-widest self-center md:self-start pl-1">
            Free · No signup · Updated daily
          </span>
        </div>
      </div>
    </main>

    <!-- Marquee Ticker -->
    <div class="w-full border-y border-[#003399]/10 bg-[#003399]/2 py-3 overflow-hidden select-none z-10" style="mask-image: linear-gradient(to right, transparent, black 5%, black 95%, transparent); -webkit-mask-image: linear-gradient(to right, transparent, black 5%, black 95%, transparent);">
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

  <!-- Screen B: Quick Compare -->
  <QuickCompare v-else-if="currentPath === '/compare'" :navigateTo="navigateTo" />

  <!-- Screen C: Main Dashboard App -->
  <div v-else class="relative bg-background text-foreground min-h-screen">
    <!-- Screen 1: Sticky Main Dashboard (Header + Controls + Chart) -->
    <div
      class="sticky top-0 h-[100dvh] w-full flex flex-col justify-between mx-auto border-x border-border z-0 overflow-hidden will-change-[transform,filter,opacity]"
      :style="screen1Style"
    >
      <!-- Header -->
      <header class="flex flex-col sm:flex-row items-center justify-between p-4 sm:p-3 border-b border-border select-none bg-background gap-3">
        <div class="flex flex-col min-[400px]:flex-row min-[400px]:items-baseline gap-1 min-[400px]:gap-3 self-start sm:self-auto">
          <h1 
            @click="navigateTo('/')"
            class="font-sans font-semibold tracking-wider text-sm uppercase cursor-pointer hover:opacity-75 transition-opacity"
            title="Return to landing page"
          >
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
        <nav class="flex flex-wrap items-center gap-1 border border-border p-0.5 bg-surface/50 font-mono text-[10px] md:text-xs">
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
          <button 
            @click="filtersStore.activeTab = 'stability'"
            class="px-2 md:px-3 py-1 cursor-pointer select-none transition-colors border-0"
            :class="[filtersStore.activeTab === 'stability' ? 'bg-foreground text-background font-bold' : 'text-text-muted hover:text-text-primary hover:bg-surface']"
          >
            FINANCIAL STABILITY
          </button>
          <button 
            @click="filtersStore.activeTab = 'activity'"
            class="px-2 md:px-3 py-1 cursor-pointer select-none transition-colors border-0"
            :class="[filtersStore.activeTab === 'activity' ? 'bg-foreground text-background font-bold' : 'text-text-muted hover:text-text-primary hover:bg-surface']"
          >
            ACTIVITY & CONSUMPTION
          </button>
        </nav>

        <ThemeToggle class="self-end sm:self-auto" />
      </header>

      <!-- Filters and Control Bar -->
      <ControlBar class="shrink-0" />

      <!-- Chart Area -->
      <main class="flex-grow flex flex-col w-full min-h-0 relative">
        <BondChart />
        
        <!-- Scroll Indicator -->
        <div 
          @click="scrollToInfo"
          class="absolute bottom-3 left-1/2 -translate-x-1/2 flex flex-col items-center gap-1 cursor-pointer select-none font-mono text-[9px] tracking-widest text-text-muted hover:text-text-primary transition-all duration-300 z-10"
          :style="{
            opacity: Math.max(0, 1 - (scrollY / 150)),
            pointerEvents: scrollY > 100 ? 'none' : 'auto'
          }"
        >
          <span class="animate-pulse">SCROLL FOR DETAILS</span>
          <span class="text-xs animate-bounce mt-0.5">↓</span>
        </div>
      </main>
    </div>

    <!-- Screen 2: Slide-over info page (Explanatory Text) -->
    <div class="relative z-10 w-full bg-background border-t border-border shadow-[0_-15px_30px_rgba(0,0,0,0.08)] dark:shadow-[0_-15px_30px_rgba(0,0,0,0.25)]">
      <div class="mx-auto border-x border-border p-6 md:p-12 lg:p-16 flex flex-col gap-8 font-mono select-none">
        
        <!-- Info Cards -->
        <div class="flex flex-col gap-6 leading-relaxed">
          <!-- Card 1: Data Sources -->
          <div class="flex flex-col md:flex-row items-start gap-4 md:gap-6 p-5 border border-border bg-surface/50">
            <div class="flex items-center gap-2 text-text-primary font-bold shrink-0 bg-surface px-3 py-1.5 border border-border text-[10px] md:text-xs tracking-wider">
              <span>ⓘ</span>
              <span>DATA SOURCES</span>
            </div>
            <p class="text-sm md:text-base text-text-muted">
              Country-specific yields are sourced from the <strong>Maastricht Convergence Criterion series</strong> (monthly, 10Y maturity only). These represent harmonized central government benchmark bond yields used to assess Eurozone eligibility. The complete daily yield curves (3M to 30Y maturities) are estimated by the ECB exclusively for the Euro Area aggregate.
            </p>
          </div>
          
          <!-- Card 2: Maastricht Bounds -->
          <div class="flex flex-col md:flex-row items-start gap-4 md:gap-6 p-5 border border-border bg-surface/50">
            <div class="flex items-center gap-2 text-text-primary font-bold shrink-0 bg-surface px-3 py-1.5 border border-border text-[10px] md:text-xs tracking-wider">
              <span>ⓘ</span>
              <span>MAASTRICHT BOUNDS</span>
            </div>
            <p class="text-sm md:text-base text-text-muted">
              Under the Maastricht Treaty's long-term interest rate convergence criterion (Article 140 TFEU), a Member State's nominal 10-year government bond yield must not exceed by more than <strong>2 percentage points</strong> the average yield of the three best-performing EU Member States in terms of price stability (lowest inflation) over a one-year reference period.
            </p>
          </div>

          <!-- Card 3: Theme 1 -->
          <div class="flex flex-col md:flex-row items-start gap-4 md:gap-6 p-5 border border-border bg-surface/50">
            <div class="flex items-center gap-2 text-text-primary font-bold shrink-0 bg-surface px-3 py-1.5 border border-border text-[10px] md:text-xs tracking-wider">
              <span>01</span>
              <span>RATES & YIELDS</span>
            </div>
            <div class="text-sm md:text-base text-text-muted flex flex-col gap-3 w-full">
              <p>Provides a direct comparison of government and commercial banking interest rates across the Eurozone:</p>
              <ul class="list-disc pl-5 space-y-2 text-xs md:text-sm">
                <li><strong>Sovereign Bonds (10Y)</strong>: Benchmark government bond yields from the Maastricht Convergence series (monthly). Represents long-term borrowing costs for states.</li>
                <li><strong>Bank Mortgages</strong>: Annualized agreed rate applied by commercial banks to new home loans for households (monthly, ECB MIR).</li>
                <li><strong>Bank Corporate Loans</strong>: Annualized agreed rate applied by commercial banks to new loans for non-financial corporations (monthly, ECB MIR).</li>
                <li><strong>Bank Deposits</strong>: Annualized agreed rate applied by commercial banks to new household deposits with agreed maturity (monthly, ECB MIR).</li>
              </ul>
            </div>
          </div>

          <!-- Card 4: Theme 2 -->
          <div class="flex flex-col md:flex-row items-start gap-4 md:gap-6 p-5 border border-border bg-surface/50">
            <div class="flex items-center gap-2 text-text-primary font-bold shrink-0 bg-surface px-3 py-1.5 border border-border text-[10px] md:text-xs tracking-wider">
              <span>02</span>
              <span>MACRO & CONVERGENCE</span>
            </div>
            <div class="text-sm md:text-base text-text-muted flex flex-col gap-3 w-full">
              <p>Tracks real economic activity, labor markets, and price stability indicators:</p>
              <ul class="list-disc pl-5 space-y-2 text-xs md:text-sm">
                <li><strong>HICP Inflation</strong>: Harmonised Index of Consumer Prices YoY percentage change (monthly, ECB ICP). Measures price stability in accordance with ECB mandates.</li>
                <li><strong>Unemployment Rate</strong>: Monthly unemployment rate (%) seasonally adjusted (monthly, Eurostat). Reflects the share of the active labor force unable to find work.</li>
                <li><strong>GDP Growth %</strong>: Real GDP growth rate, percentage change compared to the same quarter of the previous year (quarterly, Eurostat).</li>
              </ul>
            </div>
          </div>

          <!-- Card 5: Theme 3 -->
          <div class="flex flex-col md:flex-row items-start gap-4 md:gap-6 p-5 border border-border bg-surface/50">
            <div class="flex items-center gap-2 text-text-primary font-bold shrink-0 bg-surface px-3 py-1.5 border border-border text-[10px] md:text-xs tracking-wider">
              <span>03</span>
              <span>MONETARY & FOREX</span>
            </div>
            <div class="text-sm md:text-base text-text-muted flex flex-col gap-3 w-full">
              <p>Central bank policy stances and international currency values:</p>
              <ul class="list-disc pl-5 space-y-2 text-xs md:text-sm">
                <li><strong>ECB Policy Rates</strong>: Sourced daily from ECB Financial Market Statistics. Includes the Deposit Facility Rate (DFR, floor), Main Refinancing Operations rate (MRR, middle), and Marginal Lending Facility rate (MLFR, ceiling).</li>
                <li><strong>EUR Exchange Rates</strong>: Sourced monthly from ECB Foreign Exchange Rates (EXR). Tracks the value of the Euro against major global currencies (USD, GBP, CHF, JPY).</li>
              </ul>
            </div>
          </div>

          <!-- Card 6: Theme 4 -->
          <div class="flex flex-col md:flex-row items-start gap-4 md:gap-6 p-5 border border-border bg-surface/50">
            <div class="flex items-center gap-2 text-text-primary font-bold shrink-0 bg-surface px-3 py-1.5 border border-border text-[10px] md:text-xs tracking-wider">
              <span>04</span>
              <span>FINANCIAL STABILITY</span>
            </div>
            <div class="text-sm md:text-base text-text-muted flex flex-col gap-3 w-full">
              <p>Monitors sovereign fiscal health and convergence criteria limits under the Stability and Growth Pact:</p>
              <ul class="list-disc pl-5 space-y-2 text-xs md:text-sm">
                <li><strong>Government Deficit %</strong>: General government net lending (+) / net borrowing (-) as a percentage of GDP (quarterly, Eurostat, seasonally adjusted `SCA`). The official Maastricht Treaty deficit limit is <strong>3%</strong>.</li>
                <li><strong>Government Debt %</strong>: General government gross debt-to-GDP ratio (quarterly, ECB GFS). The official Maastricht Treaty debt limit is <strong>60%</strong>.</li>
              </ul>
            </div>
          </div>

          <!-- Card 7: Theme 5 -->
          <div class="flex flex-col md:flex-row items-start gap-4 md:gap-6 p-5 border border-border bg-surface/50">
            <div class="flex items-center gap-2 text-text-primary font-bold shrink-0 bg-surface px-3 py-1.5 border border-border text-[10px] md:text-xs tracking-wider">
              <span>05</span>
              <span>ACTIVITY & CONSUMPTION</span>
            </div>
            <div class="text-sm md:text-base text-text-muted flex flex-col gap-3 w-full">
              <p>Highlights monthly retail activity, household confidence surveys, and savings habits:</p>
              <ul class="list-disc pl-5 space-y-2 text-xs md:text-sm">
                <li><strong>Retail Sales Growth</strong>: Real volume of retail trade index, percentage change on the same period of the previous year (monthly, Eurostat, calendar adjusted `CA`). Reflects direct consumer spending momentum.</li>
                <li><strong>Consumer Confidence</strong>: Harmonised monthly survey balance tracking consumers' household and general economic expectations (monthly, Eurostat, seasonally adjusted `SA`).</li>
                <li><strong>Household Saving Rate</strong>: Gross savings of households as a percentage of gross disposable income (quarterly, Eurostat, seasonally adjusted `SCA`).</li>
              </ul>
            </div>
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
  <AiChatDock :currentPath="currentPath" />
</template>
