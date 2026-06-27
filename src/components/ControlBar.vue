<script setup lang="ts">
import { ref, watch, onMounted } from 'vue';
import { useFiltersStore } from '../stores/filtersStore';
import { useBondDataStore } from '../stores/bondDataStore';
import CountrySelector from './CountrySelector.vue';
import MaturitySelector from './MaturitySelector.vue';
import PeriodSelector from './PeriodSelector.vue';
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from './ui/select';

const filtersStore = useFiltersStore();
const dataStore = useBondDataStore();
const isCollapsed = ref(true);

const toggleFilters = () => {
  isCollapsed.value = !isCollapsed.value;
};

// Synchronize selectedCountries to only keep countries that actually have data in the active category
const syncValidCountries = () => {
  const category = filtersStore.rateCategory;
  
  if (category === 'policy_rate') {
    const hasPolicyCodes = filtersStore.selectedCountries.some(code => ['DFR', 'MRR_FR', 'MLFR'].includes(code));
    if (!hasPolicyCodes) {
      filtersStore.selectedCountries = ['DFR', 'MRR_FR', 'MLFR'];
    }
    return;
  }
  
  if (category === 'exchange_rate') {
    const hasExrCodes = filtersStore.selectedCountries.some(code => ['USD', 'GBP', 'CHF', 'JPY'].includes(code));
    if (!hasExrCodes) {
      filtersStore.selectedCountries = ['USD'];
    }
    return;
  }

  let dataset: Record<string, any> | null = null;
  
  if (category === 'sovereign') {
    dataset = dataStore.countriesData;
  } else if (category === 'mortgage') {
    dataset = dataStore.mortgagesData;
  } else if (category === 'corporate') {
    dataset = dataStore.corporatesData;
  } else if (category === 'deposit') {
    dataset = dataStore.depositsData;
  } else if (category === 'debt_gdp') {
    dataset = dataStore.debtGdpData;
  } else if (category === 'inflation') {
    dataset = dataStore.inflationData;
  } else if (category === 'unemployment') {
    dataset = dataStore.unemploymentData;
  } else if (category === 'gdp') {
    dataset = dataStore.gdpGrowthData;
  }

  if (!dataset) return;

  const validCountries = filtersStore.selectedCountries.filter(code => {
    if (code === 'EA') {
      if (category === 'sovereign') {
        return !!(dataStore.euroAreaAll?.['SR_10Y'] && dataStore.euroAreaAll['SR_10Y'].length > 0);
      } else {
        return !!(dataset?.[code] && dataset[code].length > 0);
      }
    }
    if (code === 'EA_AAA') {
      return category === 'sovereign' && !!(dataStore.euroAreaAaa?.['SR_10Y'] && dataStore.euroAreaAaa['SR_10Y'].length > 0);
    }
    return !!(dataset?.[code] && dataset[code].length > 0);
  });

  if (validCountries.length > 0) {
    filtersStore.selectedCountries = validCountries;
  } else {
    // Fallback: Select the first country/aggregate that actually has data in the active dataset
    const hasEa = category === 'sovereign'
      ? !!(dataStore.euroAreaAll?.['SR_10Y'] && dataStore.euroAreaAll['SR_10Y'].length > 0)
      : !!(dataset?.['EA'] && dataset['EA'].length > 0);
      
    if (hasEa) {
      filtersStore.selectedCountries = ['EA'];
    } else {
      const firstValidCountry = Object.keys(dataset).find(k => dataset?.[k] && dataset[k].length > 0);
      filtersStore.selectedCountries = firstValidCountry ? [firstValidCountry] : ['DE'];
    }
  }
};

// Sync valid selection on category change or load completion
watch(() => filtersStore.rateCategory, () => {
  syncValidCountries();
});

watch(() => dataStore.isLoading, (loading) => {
  if (!loading) {
    syncValidCountries();
  }
});

onMounted(() => {
  if (!dataStore.isLoading) {
    syncValidCountries();
  }
});
</script>

<template>
  <div class="w-full border-b border-border bg-background">
    <!-- Mobile header control for filters -->
    <div class="md:hidden flex justify-between items-center p-3 border-b border-border">
      <span class="font-mono text-xs text-text-muted">FILTERS</span>
      <button 
        @click="toggleFilters"
        class="font-mono text-xs px-2 py-1 border border-border bg-surface cursor-pointer select-none"
      >
        {{ isCollapsed ? '[SHOW]' : '[HIDE]' }}
      </button>
    </div>

    <!-- Horizontal control bar -->
    <div 
      class="flex flex-col md:flex-row md:items-center justify-between p-4 md:p-3 gap-4 md:gap-6 font-mono text-xs"
      :class="[isCollapsed ? 'hidden md:flex' : 'flex']"
    >
      <div class="flex flex-col sm:flex-row sm:items-center gap-4">
        <!-- Rate Category Selector -->
        <div class="flex flex-col gap-1.5 sm:block font-mono text-xs">
          <label class="sm:hidden text-[10px] text-text-muted font-bold block mb-0.5">CATEGORY</label>
          <Select v-model="filtersStore.rateCategory">
            <SelectTrigger class="w-[220px] border-border font-mono text-xs text-foreground cursor-pointer rounded-none">
              <SelectValue placeholder="Category" />
            </SelectTrigger>
            <SelectContent class="border-border bg-background rounded-none">
              <SelectGroup>
                <!-- Rates Tab Categories -->
                <template v-if="filtersStore.activeTab === 'rates'">
                  <SelectItem value="sovereign" class="hover:bg-surface cursor-pointer select-none rounded-none font-mono text-xs">
                    Sovereign Bonds
                  </SelectItem>
                  <SelectItem value="mortgage" class="hover:bg-surface cursor-pointer select-none rounded-none font-mono text-xs">
                    Bank Mortgages
                  </SelectItem>
                  <SelectItem value="corporate" class="hover:bg-surface cursor-pointer select-none rounded-none font-mono text-xs">
                    Bank Corp Loans
                  </SelectItem>
                  <SelectItem value="deposit" class="hover:bg-surface cursor-pointer select-none rounded-none font-mono text-xs">
                    Bank Deposits
                  </SelectItem>
                </template>

                <!-- Macro Tab Categories -->
                <template v-else-if="filtersStore.activeTab === 'macro'">
                  <SelectItem value="inflation" class="hover:bg-surface cursor-pointer select-none rounded-none font-mono text-xs">
                    HICP Inflation
                  </SelectItem>
                  <SelectItem value="unemployment" class="hover:bg-surface cursor-pointer select-none rounded-none font-mono text-xs">
                    Unemployment Rate
                  </SelectItem>
                  <SelectItem value="gdp" class="hover:bg-surface cursor-pointer select-none rounded-none font-mono text-xs">
                    GDP Growth %
                  </SelectItem>
                  <SelectItem value="debt_gdp" class="hover:bg-surface cursor-pointer select-none rounded-none font-mono text-xs">
                    Debt to GDP %
                  </SelectItem>
                </template>

                <!-- Monetary Tab Categories -->
                <template v-else-if="filtersStore.activeTab === 'monetary'">
                  <SelectItem value="policy_rate" class="hover:bg-surface cursor-pointer select-none rounded-none font-mono text-xs">
                    ECB Policy Rates
                  </SelectItem>
                  <SelectItem value="exchange_rate" class="hover:bg-surface cursor-pointer select-none rounded-none font-mono text-xs">
                    EUR Exchange Rates
                  </SelectItem>
                </template>
              </SelectGroup>
            </SelectContent>
          </Select>
        </div>

        <!-- Country Selector -->
        <div class="flex flex-col gap-1.5 sm:block">
          <label class="sm:hidden text-[10px] text-text-muted font-bold block mb-0.5">COUNTRIES</label>
          <CountrySelector />
        </div>

        <!-- Maturity Selector (Sovereign Only) -->
        <div v-if="filtersStore.rateCategory === 'sovereign'" class="flex flex-col gap-1.5 sm:block">
          <label class="sm:hidden text-[10px] text-text-muted font-bold block mb-0.5">MATURITY</label>
          <MaturitySelector />
        </div>

        <!-- Issuer Rating Selector (Sovereign Only) -->
        <div v-if="filtersStore.rateCategory === 'sovereign'" class="flex flex-col gap-1.5 sm:block font-mono text-xs">
          <label class="sm:hidden text-[10px] text-text-muted font-bold block mb-0.5">ISSUER RATING</label>
          <Select v-model="filtersStore.issuerType">
            <SelectTrigger class="w-[150px] border-border font-mono text-xs text-foreground cursor-pointer rounded-none">
              <SelectValue placeholder="Rating" />
            </SelectTrigger>
            <SelectContent class="border-border bg-background rounded-none">
              <SelectGroup>
                <SelectItem value="all" class="hover:bg-surface cursor-pointer select-none rounded-none font-mono text-xs">
                  All Sovereign
                </SelectItem>
                <SelectItem value="aaa" class="hover:bg-surface cursor-pointer select-none rounded-none font-mono text-xs">
                  AAA Rated Only
                </SelectItem>
              </SelectGroup>
            </SelectContent>
          </Select>
        </div>
      </div>

      <!-- Time Period Selector -->
      <div class="flex flex-col gap-1.5 sm:block border-t border-border pt-3 md:pt-0 md:border-t-0">
        <label class="sm:hidden text-[10px] text-text-muted font-bold block mb-1">TIME RANGE</label>
        <PeriodSelector />
      </div>
    </div>
  </div>
</template>
