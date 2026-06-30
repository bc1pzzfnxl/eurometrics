<script setup lang="ts">
import { ref, onMounted, onUnmounted, computed } from 'vue';
import { useBondDataStore } from '../stores/bondDataStore';
import { useFiltersStore } from '../stores/filtersStore';
import { useBondData } from '../composables/useBondData';
import { useChartOptions } from '../composables/useChartOptions';

// Register ECharts core components to keep bundle size small
import { use } from 'echarts/core';
import { CanvasRenderer } from 'echarts/renderers';
import { LineChart } from 'echarts/charts';
import {
  GridComponent,
  TooltipComponent,
  LegendComponent,
  DataZoomComponent,
  MarkLineComponent,
  MarkAreaComponent,
} from 'echarts/components';
import VChart from 'vue-echarts';

use([
  CanvasRenderer,
  LineChart,
  GridComponent,
  TooltipComponent,
  LegendComponent,
  DataZoomComponent,
  MarkLineComponent,
  MarkAreaComponent,
]);

const dataStore = useBondDataStore();
const filtersStore = useFiltersStore();
const { activeSeries } = useBondData();

// Reactive check for theme classes using MutationObserver
const isDark = ref(false);
let themeObserver: MutationObserver | null = null;

const checkTheme = () => {
  isDark.value = document.documentElement.classList.contains('dark');
};

onMounted(() => {
  checkTheme();
  themeObserver = new MutationObserver(checkTheme);
  themeObserver.observe(document.documentElement, {
    attributes: true,
    attributeFilter: ['class'],
  });
});

onUnmounted(() => {
  if (themeObserver) {
    themeObserver.disconnect();
  }
});

// Build reactive ECharts options
const chartOptions = useChartOptions(activeSeries, isDark);

const chartRef = ref<any>(null);

const exportChart = () => {
  const chartInstance = chartRef.value?.chart || chartRef.value;
  if (!chartInstance || typeof chartInstance.getDataURL !== 'function') return;

  const dataUrl = chartInstance.getDataURL({
    type: 'png',
    pixelRatio: 3,
    backgroundColor: isDark.value ? '#0A0A0A' : '#F5F5F5',
  });

  const link = document.createElement('a');
  link.download = `eurometrics_${filtersStore.activeTab}_${filtersStore.rateCategory}_${Date.now()}.png`;
  link.href = dataUrl;
  link.click();
};

// States check
const hasData = computed(() => {
  return activeSeries.value.length > 0 && activeSeries.value.some(s => s.points.length > 0);
});

const retryFetch = () => {
  dataStore.fetchAllData(true);
};
</script>

<template>
  <div class="flex-grow flex flex-col justify-center items-center w-full min-h-[250px] bg-background relative select-none">
    
    <!-- API Loading state -->
    <div 
      v-if="dataStore.isLoading" 
      class="font-mono text-xs uppercase tracking-widest text-text-muted animate-pulse"
      id="chart-loading"
    >
      Fetching data...
    </div>

    <!-- API Error state -->
    <div 
      v-else-if="dataStore.error" 
      class="flex flex-col items-center gap-2 font-mono text-xs text-text-primary"
      id="chart-error"
    >
      <span>{{ dataStore.error }}</span>
      <button 
        @click="retryFetch"
        class="border border-border bg-surface px-3 py-1 cursor-pointer hover:bg-background select-none font-bold transition-colors"
      >
        Retry →
      </button>
    </div>

    <!-- No Data state -->
    <div 
      v-else-if="!hasData" 
      class="font-mono text-xs uppercase tracking-widest text-text-muted"
      id="chart-empty"
    >
      No data available for this selection
    </div>

    <!-- Active Chart display -->
    <div 
      v-else 
      class="w-full flex-grow pt-4 px-4 pb-8 flex flex-col justify-center items-center min-h-0 relative"
      id="chart-container"
    >
      <!-- Export button -->
      <button 
        @click="exportChart"
        class="absolute top-2 right-4 border border-border bg-surface/80 hover:bg-surface px-2.5 py-1 font-mono text-[9px] tracking-wider font-bold transition-all duration-200 cursor-pointer select-none z-10 hover:text-text-primary text-text-muted rounded-none"
        title="Export current chart as PNG image"
      >
        <span>EXPORT PNG ↓</span>
      </button>

      <v-chart 
        ref="chartRef"
        class="w-full h-full flex-grow min-h-0" 
        :option="chartOptions" 
        autoresize 
      />
    </div>
  </div>
</template>
