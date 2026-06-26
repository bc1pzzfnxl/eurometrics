import { defineStore } from 'pinia';
import { ref, watch } from 'vue';
import type { ActiveTab, BondType, IssuerType, Maturity, RateCategory, TimeRange } from '../types/bond';

export const useFiltersStore = defineStore('filters', () => {
  // Navigation / Routing state
  const activeTab = ref<ActiveTab>('rates');

  // Filters state
  const rateCategory = ref<RateCategory>('sovereign');
  const selectedCountries = ref<string[]>(['DE', 'FR', 'IT', 'ES', 'NL', 'BE']);
  const selectedMaturity = ref<Maturity>('10Y');
  const bondType = ref<BondType>('sovereign');
  const issuerType = ref<IssuerType>('all');
  const selectedPeriod = ref<TimeRange>('MAX');

  // Watch activeTab to set reasonable category defaults
  watch(activeTab, (newTab) => {
    if (newTab === 'rates') {
      rateCategory.value = 'sovereign';
    } else if (newTab === 'macro') {
      rateCategory.value = 'inflation';
    } else if (newTab === 'monetary') {
      rateCategory.value = 'policy_rate';
    }
  });

  // Watch rateCategory to sanitize selectedCountries and prevent mismatching codes (e.g. USD in country yields)
  watch(rateCategory, (newCategory) => {
    if (newCategory === 'policy_rate') {
      const valid = selectedCountries.value.filter(code => ['DFR', 'MRR_FR', 'MLFR'].includes(code));
      selectedCountries.value = valid.length > 0 ? valid : ['DFR', 'MRR_FR', 'MLFR'];
    } else if (newCategory === 'exchange_rate') {
      const valid = selectedCountries.value.filter(code => ['USD', 'GBP', 'CHF', 'JPY'].includes(code));
      selectedCountries.value = valid.length > 0 ? valid : ['USD'];
    } else {
      const eurozoneAndAggregates = [
        'AT', 'BE', 'CY', 'DE', 'EE', 'ES', 'FI', 'FR', 'GR', 'HR',
        'IE', 'IT', 'LT', 'LU', 'LV', 'MT', 'NL', 'PT', 'SI', 'SK',
        'EA', 'EA_AAA'
      ];
      const valid = selectedCountries.value.filter(code => eurozoneAndAggregates.includes(code));
      if (valid.length === 0) {
        selectedCountries.value = ['DE', 'FR', 'IT', 'ES', 'NL', 'BE'];
      } else {
        selectedCountries.value = valid;
      }
    }
  });
  
  // Custom date picker state
  const customStartDate = ref<string | null>(null);
  const customEndDate = ref<string | null>(null);

  // Sync bondType and selectedMaturity
  watch(bondType, (newType) => {
    if (newType === 'short_term') {
      // Short-term: 3M, 6M, 1Y
      if (!['3M', '6M', '1Y'].includes(selectedMaturity.value)) {
        selectedMaturity.value = '1Y';
      }
    } else if (newType === 'long_term') {
      // Long-term: 2Y, 5Y, 10Y, 30Y
      if (!['2Y', '5Y', '10Y', '30Y'].includes(selectedMaturity.value)) {
        selectedMaturity.value = '10Y';
      }
    }
  });

  // Watch selectedMaturity to sync bondType
  watch(selectedMaturity, (newMaturity) => {
    if (['3M', '6M', '1Y'].includes(newMaturity)) {
      if (bondType.value === 'long_term') {
        bondType.value = 'short_term';
      }
    } else {
      if (bondType.value === 'short_term') {
        bondType.value = 'long_term';
      }
    }
  });

  const resetFilters = () => {
    activeTab.value = 'rates';
    rateCategory.value = 'sovereign';
    selectedCountries.value = ['DE', 'FR', 'IT', 'ES', 'NL', 'BE'];
    selectedMaturity.value = '10Y';
    bondType.value = 'sovereign';
    issuerType.value = 'all';
    selectedPeriod.value = 'MAX';
    customStartDate.value = null;
    customEndDate.value = null;
  };

  return {
    activeTab,
    rateCategory,
    selectedCountries,
    selectedMaturity,
    bondType,
    issuerType,
    selectedPeriod,
    customStartDate,
    customEndDate,
    resetFilters,
  };
});
