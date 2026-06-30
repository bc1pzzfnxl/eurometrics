<script setup lang="ts">
import { ref, computed, watch, onMounted } from 'vue';
import { useBondDataStore } from '../stores/bondDataStore';
import { useFiltersStore } from '../stores/filtersStore';
import { COUNTRIES } from '../constants/countries';
import VChart from 'vue-echarts';

// Register ECharts components
import { use } from 'echarts/core';
import { CanvasRenderer } from 'echarts/renderers';
import { LineChart, PieChart } from 'echarts/charts';
import {
  GridComponent,
  TooltipComponent,
  LegendComponent,
  DataZoomComponent,
  TitleComponent
} from 'echarts/components';

use([
  CanvasRenderer,
  LineChart,
  PieChart,
  GridComponent,
  TooltipComponent,
  LegendComponent,
  DataZoomComponent,
  TitleComponent
]);

const dataStore = useBondDataStore();
const filtersStore = useFiltersStore();

const activeCountry = computed(() => filtersStore.selectedCountries[0] || 'FR');
const countryName = computed(() => {
  if (activeCountry.value === 'EA') return 'Euro Area';
  return COUNTRIES.find(c => c.code === activeCountry.value)?.name || activeCountry.value;
});

const isDark = ref(false);
const selectedYear = ref<string>('');

const checkTheme = () => {
  isDark.value = document.documentElement.classList.contains('dark');
};

onMounted(() => {
  checkTheme();
  const themeObserver = new MutationObserver(checkTheme);
  themeObserver.observe(document.documentElement, {
    attributes: true,
    attributeFilter: ['class'],
  });
  
  if (!dataStore.gdpSectorsData && !dataStore.isLoading) {
    dataStore.fetchAllData();
  }
  
  // Set initial selected year once data is loaded
  const years = availableYears.value;
  if (years.length > 0) {
    selectedYear.value = years[new Date().getFullYear() - 2] || years[years.length - 1];
  }
});

const SECTORS_CONFIG = [
  { code: 'A', name: 'Agriculture & Fishing', color: '#2F855A' },
  { code: 'B-E', name: 'Industry & Energy', color: '#C53030' },
  { code: 'F', name: 'Construction', color: '#DD6B20' },
  { code: 'G-I', name: 'Trade, Transport & Food', color: '#B7791F' },
  { code: 'J', name: 'Information & Telecom', color: '#2B6CB0' },
  { code: 'K', name: 'Finance & Insurance', color: '#6B46C1' },
  { code: 'L', name: 'Real Estate', color: '#4A5568' },
  { code: 'M_N', name: 'Professional & Support', color: '#2C7A7B' },
  { code: 'O-Q', name: 'Public Admin & Health', color: '#718096' },
  { code: 'R-U', name: 'Recreation & Services', color: '#B83280' }
];

const countrySectorsData = computed(() => {
  if (!dataStore.gdpSectorsData) return null;
  return dataStore.gdpSectorsData[activeCountry.value] || null;
});

// Extract list of years (e.g. "2024")
const availableYears = computed<string[]>(() => {
  const data = countrySectorsData.value;
  if (!data) return [];
  const points = data['TOTAL'] || Object.values(data)[0] || [];
  return points.map(p => p.date.split('-')[0]).sort();
});

// Watch availableYears to select the latest year when country changes
watch(availableYears, (newYears) => {
  if (newYears.length > 0 && (!selectedYear.value || !newYears.includes(selectedYear.value))) {
    selectedYear.value = newYears[newYears.length - 1];
  }
});

// Total GDP for selected country and year
const totalGdpValue = computed(() => {
  const data = countrySectorsData.value;
  if (!data || !selectedYear.value) return 0;
  const totalPoints = data['TOTAL'] || [];
  const pt = totalPoints.find(p => p.date.startsWith(selectedYear.value));
  return pt ? pt.value : 0;
});

// Build Line Chart options (Evolution over time of all 10 sectors)
const lineChartOptions = computed(() => {
  const dark = isDark.value;
  const textColor = dark ? '#F5F5F5' : '#0A0A0A';
  const textMutedColor = '#6B6B6B';
  const gridBorderColor = dark ? '#1F1F1F' : '#E5E5E5';

  const years = availableYears.value;
  const series = SECTORS_CONFIG.map(sect => {
    const data = countrySectorsData.value;
    const sectorPoints = data ? data[sect.code] || [] : [];
    
    const seriesData = years.map(yr => {
      const pt = sectorPoints.find(p => p.date.startsWith(yr));
      return pt ? pt.value : null;
    });

    return {
      name: sect.name,
      type: 'line',
      data: seriesData,
      showSymbol: false,
      symbol: 'circle',
      symbolSize: 4,
      lineStyle: { width: 1.5, color: sect.color },
      itemStyle: { color: sect.color },
      connectNulls: true
    };
  });

  const markLineData = selectedYear.value ? [{
    xAxis: selectedYear.value,
    lineStyle: { color: dark ? 'rgba(245, 245, 245, 0.4)' : 'rgba(0, 51, 153, 0.4)', type: 'dashed' },
    label: { show: false }
  }] : [];

  return {
    backgroundColor: 'transparent',
    textStyle: { fontFamily: 'JetBrains Mono, monospace', color: textColor },
    grid: { top: 40, left: 60, right: 20, bottom: 85, show: true, borderColor: gridBorderColor },
    tooltip: {
      trigger: 'axis',
      backgroundColor: dark ? '#F5F5F5' : '#0A0A0A',
      textStyle: { color: dark ? '#0A0A0A' : '#F5F5F5', fontFamily: 'JetBrains Mono, monospace', fontSize: 11 },
      formatter: (params: any[]) => {
        if (!params || params.length === 0) return '';
        const yr = years[params[0].dataIndex];
        let html = `<div style="font-weight: 700; border-bottom: 1px solid rgba(255,255,255,0.2); padding-bottom: 4px; margin-bottom: 6px;">YEAR: ${yr}</div>`;
        params.forEach(p => {
          html += `<div style="display:flex; justify-content:space-between; gap:15px;">
            <span><span style="display:inline-block;width:6px;height:6px;background:${p.color};margin-right:6px;"></span>${p.seriesName}</span>
            <strong>${Number(p.value).toLocaleString()} M€</strong>
          </div>`;
        });
        return html;
      }
    },
    xAxis: {
      type: 'category',
      data: years,
      axisLine: { lineStyle: { color: gridBorderColor } },
      axisLabel: { color: textMutedColor, fontSize: 10 }
    },
    yAxis: {
      type: 'value',
      axisLabel: { color: textMutedColor, formatter: (val: number) => `${(val / 1000).toFixed(0)}k M€` },
      splitLine: { lineStyle: { color: gridBorderColor, width: 0.5 } }
    },
    series: series.map((s, idx) => idx === 0 ? { ...s, markLine: { symbol: ['none', 'none'], data: markLineData } } : s)
  };
});

// Build Pie Chart options
const pieChartOptions = computed(() => {
  const dark = isDark.value;
  const textColor = dark ? '#F5F5F5' : '#0A0A0A';
  
  const data = countrySectorsData.value;
  const pieData = SECTORS_CONFIG.map(sect => {
    const sectorPoints = data ? data[sect.code] || [] : [];
    const pt = sectorPoints.find(p => p.date.startsWith(selectedYear.value));
    return {
      value: pt ? pt.value : 0,
      name: sect.name,
      itemStyle: { color: sect.color }
    };
  }).filter(d => d.value > 0);

  return {
    backgroundColor: 'transparent',
    textStyle: { fontFamily: 'JetBrains Mono, monospace', color: textColor },
    tooltip: {
      trigger: 'item',
      backgroundColor: dark ? '#F5F5F5' : '#0A0A0A',
      textStyle: { color: dark ? '#0A0A0A' : '#F5F5F5', fontFamily: 'JetBrains Mono, monospace', fontSize: 12 },
      formatter: '{b}: <br/><strong>{c} M€</strong> ({d}%)'
    },
    series: [
      {
        name: 'GDP Sector',
        type: 'pie',
        radius: ['35%', '65%'],
        center: ['50%', '50%'],
        avoidLabelOverlap: true,
        itemStyle: {
          borderRadius: 0,
          borderColor: dark ? '#0A0A0A' : '#F5F5F5',
          borderWidth: 1.5
        },
        label: {
          show: true,
          position: 'outside',
          color: textColor,
          fontFamily: 'JetBrains Mono, monospace',
          fontSize: 9,
          formatter: '{b}\n{d}%'
        },
        labelLine: {
          lineStyle: { color: dark ? '#1F1F1F' : '#E5E5E5' }
        },
        data: pieData
      }
    ]
  };
});

const onLineChartClick = (params: any) => {
  if (params && params.name) {
    selectedYear.value = params.name;
  }
};
</script>

<template>
  <div class="flex-grow flex flex-col w-full min-h-0 select-none bg-background">
    <!-- Loading State -->
    <div v-if="dataStore.isLoading || !countrySectorsData" class="flex-grow flex flex-col items-center justify-center gap-4 py-20">
      <div class="w-8 h-8 border-2 border-[#003399] border-t-transparent animate-spin"></div>
      <span class="font-mono text-xs text-text-muted uppercase tracking-widest animate-pulse">Loading Sector breakdown...</span>
    </div>

    <!-- Data Layout -->
    <div v-else class="flex-grow flex flex-col lg:flex-row min-h-0 w-full border-t border-border">
      <!-- Left: Pie Chart Breakdowns -->
      <div class="w-full lg:w-[45%] flex flex-col border-b lg:border-b-0 lg:border-r border-border p-6 min-h-[350px]">
        <div class="flex items-center justify-between mb-4 border-b border-border pb-3">
          <div class="font-mono text-xs uppercase font-bold tracking-widest text-[#003399] dark:text-blue-400">
            Sectoral Share ({{ selectedYear }})
          </div>
          <div class="font-mono text-xs font-bold text-foreground">
            Total GVA: {{ totalGdpValue.toLocaleString() }} M€
          </div>
        </div>
        
        <!-- Interactive Year Slider -->
        <div class="flex items-center gap-3 mb-6 bg-surface p-2 border border-border">
          <span class="font-mono text-[10px] text-text-muted uppercase tracking-wider">Year: {{ selectedYear }}</span>
          <input 
            type="range" 
            v-model="selectedYear"
            :min="availableYears[0]" 
            :max="availableYears[availableYears.length - 1]" 
            step="1"
            class="flex-grow accent-[#003399]"
          />
        </div>

        <div class="flex-grow relative min-h-0">
          <v-chart :option="pieChartOptions" class="w-full h-full" autoresize />
        </div>
      </div>

      <!-- Right: Historical Line chart -->
      <div class="flex-grow flex flex-col p-6 min-h-[350px]">
        <div class="flex items-center justify-between mb-6 border-b border-border pb-3">
          <div class="font-mono text-xs uppercase font-bold tracking-widest text-[#003399] dark:text-blue-400">
            Historical Sector Evolution ({{ countryName }})
          </div>
          <span class="font-mono text-[9px] text-text-muted uppercase tracking-wider hidden sm:inline">
            [Click points to inspect year share]
          </span>
        </div>
        <div class="flex-grow relative min-h-0">
          <v-chart 
            :option="lineChartOptions" 
            class="w-full h-full" 
            autoresize 
            @click="onLineChartClick"
          />
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
/* Minimalist horizontal slider styling */
input[type="range"] {
  -webkit-appearance: none;
  appearance: none;
  height: 4px;
  background: var(--border);
  outline: none;
}
input[type="range"]::-webkit-slider-thumb {
  -webkit-appearance: none;
  appearance: none;
  width: 12px;
  height: 12px;
  background: #003399;
  cursor: pointer;
  border-radius: 0;
}
input[type="range"]::-moz-range-thumb {
  width: 12px;
  height: 12px;
  background: #003399;
  cursor: pointer;
  border-radius: 0;
  border: none;
}
</style>
