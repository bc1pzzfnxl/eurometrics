<script setup lang="ts">
import { ref, computed } from 'vue';
import { useBondDataStore } from '../stores/bondDataStore';
import { COUNTRIES } from '../constants/countries';
import type { DataPoint } from '../types/bond';

const props = defineProps<{
  navigateTo: (path: string) => void;
}>();

const dataStore = useBondDataStore();
const selectedCountry = ref('FR');

const getLatest = (pts?: DataPoint[]) => pts?.at(-1)?.value ?? null;

const countryName = computed(() => {
  return COUNTRIES.find(c => c.code === selectedCountry.value)?.name ?? selectedCountry.value;
});

const categories = computed(() => {
  const code = selectedCountry.value;

  return [
    {
      name: 'RATES & YIELDS',
      rows: [
        { label: 'Sovereign Bond 10Y', country: getLatest(dataStore.countriesData?.[code]), ea: getLatest(dataStore.euroAreaAll?.['SR_10Y']), decimals: 2, unit: '%', higherIsBetter: false },
        { label: 'Bank Mortgage Rate', country: getLatest(dataStore.mortgagesData?.[code]), ea: getLatest(dataStore.mortgagesData?.['EA']), decimals: 2, unit: '%', higherIsBetter: false },
        { label: 'Bank Corporate Loans', country: getLatest(dataStore.corporatesData?.[code]), ea: getLatest(dataStore.corporatesData?.['EA']), decimals: 2, unit: '%', higherIsBetter: false },
        { label: 'Bank Deposit Rate', country: getLatest(dataStore.depositsData?.[code]), ea: getLatest(dataStore.depositsData?.['EA']), decimals: 2, unit: '%', higherIsBetter: true },
      ],
    },
    {
      name: 'MACRO & CONVERGENCE',
      rows: [
        { label: 'HICP Inflation', country: getLatest(dataStore.inflationData?.[code]), ea: getLatest(dataStore.inflationData?.['EA']), decimals: 1, unit: '%', higherIsBetter: false },
        { label: 'Unemployment Rate', country: getLatest(dataStore.unemploymentData?.[code]), ea: getLatest(dataStore.unemploymentData?.['EA']), decimals: 1, unit: '%', higherIsBetter: false },
        { label: 'GDP Growth', country: getLatest(dataStore.gdpGrowthData?.[code]), ea: getLatest(dataStore.gdpGrowthData?.['EA']), decimals: 1, unit: '%', higherIsBetter: true },
      ],
    },
    {
      name: 'FINANCIAL STABILITY',
      rows: [
        { label: 'Gov. Deficit / GDP', country: getLatest(dataStore.deficitData?.[code]), ea: getLatest(dataStore.deficitData?.['EA']), decimals: 1, unit: '%', higherIsBetter: true },
        { label: 'Gov. Debt / GDP', country: getLatest(dataStore.debtGdpData?.[code]), ea: getLatest(dataStore.debtGdpData?.['EA']), decimals: 1, unit: '%', higherIsBetter: false },
      ],
    },
    {
      name: 'ACTIVITY & CONSUMPTION',
      rows: [
        { label: 'Retail Sales Growth', country: getLatest(dataStore.retailSalesData?.[code]), ea: getLatest(dataStore.retailSalesData?.['EA']), decimals: 1, unit: '%', higherIsBetter: true },
        { label: 'Consumer Confidence', country: getLatest(dataStore.consumerConfData?.[code]), ea: getLatest(dataStore.consumerConfData?.['EA']), decimals: 1, unit: 'pts', higherIsBetter: true },
        { label: 'Household Saving Rate', country: getLatest(dataStore.savingRateData?.[code]), ea: getLatest(dataStore.savingRateData?.['EA']), decimals: 1, unit: '%', higherIsBetter: true },
      ],
    },
  ];
});

const fmt = (val: number | null, dec: number) => val === null ? '—' : val.toFixed(dec);

const delta = (a: number | null, b: number | null, dec: number) => a === null || b === null ? '—' : `${a - b > 0 ? '+' : ''}${(a - b).toFixed(dec)}`;

const rowStyle = (cVal: number | null, eaVal: number | null, hib: boolean) => {
  if (cVal === null || eaVal === null) return {};
  const diff = cVal - eaVal;
  if (Math.abs(diff) < 0.005) return {};
  const isGood = hib ? diff > 0 : diff < 0;
  return { backgroundColor: `rgba(${isGood ? '52, 101, 56' : '159, 47, 45'}, ${Math.min(Math.abs(diff) / 4, 1) * 0.14})` };
};
</script>

<template>
  <div class="min-h-[100dvh] bg-white text-[#003399] font-mono select-none flex flex-col">
    <!-- Top Navigation -->
    <nav class="w-full max-w-4xl mx-auto px-6 pt-6 flex items-center justify-between text-[10px] tracking-widest uppercase">
      <button
        @click="navigateTo('/')"
        class="flex items-center gap-1.5 hover:opacity-70 transition-opacity cursor-pointer border-0 bg-transparent text-[#003399] font-mono text-[10px] tracking-widest uppercase font-bold p-0"
      >
        ← BACK
      </button>
      <button
        @click="navigateTo('/app')"
        class="flex items-center gap-1.5 hover:opacity-70 transition-opacity cursor-pointer border-0 bg-transparent text-[#003399] font-mono text-[10px] tracking-widest uppercase font-bold p-0"
      >
        FULL DASHBOARD →
      </button>
    </nav>

    <!-- Content -->
    <div class="w-full max-w-4xl mx-auto px-6 py-12 flex flex-col gap-8 flex-grow">

      <!-- Title -->
      <div class="flex flex-col gap-2">
        <h1 class="font-serif italic text-4xl sm:text-5xl tracking-tight text-[#003399]">
          Quick Compare
        </h1>
        <p class="text-xs tracking-wider uppercase text-[#003399]/75">
          Latest macro indicators — your country vs Eurozone average
        </p>
      </div>

      <!-- Country Selector -->
      <div class="flex items-center gap-3">
        <label for="country-select" class="text-[10px] tracking-widest uppercase font-bold text-[#003399]/70">
          COUNTRY
        </label>
        <select
          id="country-select"
          v-model="selectedCountry"
          class="bg-white border border-[#003399]/20 text-[#003399] font-mono text-sm px-3 py-2 cursor-pointer focus:outline-none focus:border-[#003399]/50"
        >
          <option v-for="country in COUNTRIES" :key="country.code" :value="country.code">
            {{ country.code }} — {{ country.name }}
          </option>
        </select>
      </div>

      <!-- Loading state -->
      <div v-if="dataStore.isLoading" class="text-xs tracking-widest uppercase text-[#003399]/70 animate-pulse py-16 text-center">
        Fetching data from ECB &amp; Eurostat...
      </div>

      <!-- Comparison Table -->
      <div v-else class="w-full overflow-x-auto -mx-2 px-2">
        <table class="w-full border-collapse font-mono text-sm">
          <thead>
            <tr class="border-b-2 border-[#003399]/25">
              <th class="text-left py-3 pr-4 text-[10px] tracking-widest uppercase font-bold text-[#003399]/70">Indicator</th>
              <th class="text-right py-3 px-4 text-[10px] tracking-widest uppercase font-bold text-[#003399]/85">{{ countryName }}</th>
              <th class="text-right py-3 px-4 text-[10px] tracking-widest uppercase font-bold text-[#003399]/60">EA Avg</th>
              <th class="text-right py-3 pl-4 text-[10px] tracking-widest uppercase font-bold text-[#003399]/60">Delta</th>
            </tr>
          </thead>
          <tbody>
            <template v-for="(cat, catIdx) in categories" :key="cat.name">
              <!-- Category header -->
              <tr>
                <td
                  colspan="4"
                  class="pb-2 text-[10px] tracking-widest uppercase font-bold text-[#003399]/55 border-b border-[#003399]/12"
                  :class="catIdx === 0 ? 'pt-4' : 'pt-7'"
                >
                  {{ cat.name }}
                </td>
              </tr>
              <!-- Data rows with heat-map tint -->
              <tr
                v-for="row in cat.rows"
                :key="row.label"
                class="border-b border-[#003399]/8 transition-colors"
                :style="rowStyle(row.country, row.ea, row.higherIsBetter)"
              >
                <td class="py-2.5 pr-4 text-xs text-[#003399]/80">{{ row.label }}</td>
                <td class="py-2.5 px-4 text-right font-bold tabular-nums">
                  <template v-if="row.country !== null">{{ fmt(row.country, row.decimals) }}<span class="text-[10px] text-[#003399]/50 ml-0.5">{{ row.unit === 'pts' ? '' : row.unit }}</span></template>
                  <template v-else><span class="text-[#003399]/40">—</span></template>
                </td>
                <td class="py-2.5 px-4 text-right text-[#003399]/55 tabular-nums">
                  <template v-if="row.ea !== null">{{ fmt(row.ea, row.decimals) }}<span class="text-[10px] text-[#003399]/40 ml-0.5">{{ row.unit === 'pts' ? '' : row.unit }}</span></template>
                  <template v-else><span class="text-[#003399]/35">—</span></template>
                </td>
                <td class="py-2.5 pl-4 text-right tabular-nums text-[11px] text-[#003399]/70 font-semibold">
                  {{ delta(row.country, row.ea, row.decimals) }}
                </td>
              </tr>
            </template>
          </tbody>
        </table>
      </div>
    </div>

    <!-- Footer -->
    <footer class="w-full max-w-4xl mx-auto px-6 py-6 flex flex-col sm:flex-row justify-between items-center gap-4 text-[9px] tracking-wider uppercase text-[#003399]/45 border-t border-[#003399]/15 mt-auto">
      <span>SOURCE: ECB SDW &amp; EUROSTAT — LATEST AVAILABLE VALUES</span>
      <span>ALL VALUES IN % EXCEPT CONSUMER CONFIDENCE (BALANCE PTS)</span>
    </footer>
  </div>
</template>
