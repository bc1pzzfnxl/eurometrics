<script setup lang="ts">
import { ref, computed } from 'vue';
import { useFiltersStore } from '../stores/filtersStore';
import { useBondDataStore } from '../stores/bondDataStore';
import { COUNTRIES } from '../constants/countries';
import { useBondData } from '../composables/useBondData';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from './ui/popover';
import { Button } from './ui/button';
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from './ui/command';

const filtersStore = useFiltersStore();
const dataStore = useBondDataStore();
const { isCountrySelectorDisabled } = useBondData();

const isOpen = ref(false);

const activeDataset = computed(() => {
  if (filtersStore.rateCategory === 'sovereign') {
    return dataStore.countriesData;
  } else if (filtersStore.rateCategory === 'mortgage') {
    return dataStore.mortgagesData;
  } else if (filtersStore.rateCategory === 'corporate') {
    return dataStore.corporatesData;
  } else if (filtersStore.rateCategory === 'deposit') {
    return dataStore.depositsData;
  } else if (filtersStore.rateCategory === 'debt_gdp') {
    return dataStore.debtGdpData;
  } else if (filtersStore.rateCategory === 'inflation') {
    return dataStore.inflationData;
  } else if (filtersStore.rateCategory === 'unemployment') {
    return dataStore.unemploymentData;
  } else if (filtersStore.rateCategory === 'gdp') {
    return dataStore.gdpGrowthData;
  } else if (filtersStore.rateCategory === 'policy_rate') {
    return dataStore.policyRatesData;
  } else if (filtersStore.rateCategory === 'exchange_rate') {
    return dataStore.exchangeRatesData;
  }
  return null;
});

// Combine country list with EA aggregates or return specific list for rates/currencies
const allOptions = computed(() => {
  if (filtersStore.rateCategory === 'policy_rate') {
    return [
      { code: 'DFR', name: 'Deposit Facility Rate' },
      { code: 'MRR_FR', name: 'Main Refinancing Rate' },
      { code: 'MLFR', name: 'Marginal Lending Rate' }
    ];
  }
  if (filtersStore.rateCategory === 'exchange_rate') {
    return [
      { code: 'USD', name: 'US Dollar (USD/EUR)' },
      { code: 'GBP', name: 'British Pound (GBP/EUR)' },
      { code: 'CHF', name: 'Swiss Franc (CHF/EUR)' },
      { code: 'JPY', name: 'Japanese Yen (JPY/EUR)' }
    ];
  }

  const dataset = activeDataset.value;
  
  // Filter the countries list to only include those that actually have data points in the loaded dataset
  const filteredCountries = COUNTRIES.filter(c => {
    if (!dataset) return true; // Fallback if data is not loaded yet
    const points = dataset[c.code];
    return points && points.length > 0;
  });

  if (filtersStore.rateCategory === 'sovereign') {
    const hasEa = !!(dataStore.euroAreaAll?.['SR_10Y'] && dataStore.euroAreaAll['SR_10Y'].length > 0);
    const hasEaAaa = !!(dataStore.euroAreaAaa?.['SR_10Y'] && dataStore.euroAreaAaa['SR_10Y'].length > 0);

    const list = [];
    if (hasEa) list.push({ code: 'EA', name: 'Euro Area (Aggregate)' });
    if (hasEaAaa) list.push({ code: 'EA_AAA', name: 'Euro Area (AAA Only)' });
    return [...list, ...filteredCountries];
  } else {
    const hasEa = !!(dataset?.['EA'] && dataset['EA'].length > 0);
    const list = [];
    if (hasEa) list.push({ code: 'EA', name: 'Euro Area (Aggregate)' });
    return [...list, ...filteredCountries];
  }
});

const toggleSelection = (code: string) => {
  const index = filtersStore.selectedCountries.indexOf(code);
  if (index > -1) {
    // Keep at least one selected
    if (filtersStore.selectedCountries.length > 1) {
      filtersStore.selectedCountries.splice(index, 1);
    }
  } else {
    filtersStore.selectedCountries.push(code);
  }
};

const triggerText = computed(() => {
  if (isCountrySelectorDisabled.value) {
    return 'Euro Area Only';
  }
  const count = filtersStore.selectedCountries.length;
  if (count === 0) {
    if (filtersStore.rateCategory === 'policy_rate') return 'Select Rates';
    if (filtersStore.rateCategory === 'exchange_rate') return 'Select Currencies';
    return 'Select Countries';
  }
  if (count === 1) {
    const code = filtersStore.selectedCountries[0];
    if (code === 'EA') return 'Euro Area';
    if (code === 'EA_AAA') return 'Euro Area (AAA)';
    return code;
  }
  if (filtersStore.rateCategory === 'policy_rate') return `Rates (${count})`;
  if (filtersStore.rateCategory === 'exchange_rate') return `Currencies (${count})`;
  return `Countries (${count})`;
});

const isSelected = (code: string) => {
  return filtersStore.selectedCountries.includes(code);
};
</script>

<template>
  <div class="relative font-mono text-xs">
    <Popover v-model:open="isOpen">
      <PopoverTrigger as-child>
        <Button
          id="country-selector-trigger"
          variant="outline"
          :disabled="isCountrySelectorDisabled"
          class="w-[200px] justify-between border-border font-mono text-xs text-foreground cursor-pointer rounded-none"
        >
          <span class="truncate">{{ triggerText }}</span>
          <span class="ml-2 text-text-muted">▼</span>
        </Button>
      </PopoverTrigger>
      
      <PopoverContent class="w-[220px] p-0 border-border bg-background rounded-none" align="start">
        <Command class="font-mono text-xs">
          <CommandInput :placeholder="filtersStore.rateCategory === 'policy_rate' ? 'Search rates...' : filtersStore.rateCategory === 'exchange_rate' ? 'Search currencies...' : 'Search countries...'" class="font-mono text-xs" />
          <CommandList class="max-h-[300px] overflow-y-auto">
            <CommandEmpty class="p-2 font-mono text-xs text-text-muted">No countries found.</CommandEmpty>
            <CommandGroup>
              <CommandItem
                v-for="opt in allOptions"
                :key="opt.code"
                :value="opt.name"
                @select="toggleSelection(opt.code)"
                class="flex items-center gap-2 p-2 hover:bg-surface cursor-pointer select-none rounded-none font-mono text-xs"
              >
                <!-- Custom theme-aligned checkbox with zero Radix state conflicts -->
                <div 
                  class="flex size-4 items-center justify-center border bg-background transition-colors shrink-0 select-none rounded-none"
                  :class="[isSelected(opt.code) ? 'bg-foreground text-background border-foreground' : 'border-border']"
                >
                  <span v-if="isSelected(opt.code)" class="text-[9px] font-bold leading-none">✓</span>
                </div>
                <span class="font-bold w-[60px] text-left shrink-0">{{ opt.code }}</span>
                <span class="truncate text-text-muted text-[11px]">{{ opt.name }}</span>
              </CommandItem>
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  </div>
</template>
