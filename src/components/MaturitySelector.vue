<script setup lang="ts">
import { ref, watch } from 'vue';
import { useFiltersStore } from '../stores/filtersStore';
import type { Maturity } from '../types/bond';
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from './ui/select';

const filtersStore = useFiltersStore();

// Track previously selected countries so we can restore them when returning to 10Y
const savedCountries = ref<string[]>(['DE', 'FR', 'IT', 'ES', 'NL', 'BE']);

watch(() => filtersStore.selectedMaturity, (newMaturity, oldMaturity) => {
  if (newMaturity !== '10Y') {
    // If we're leaving 10Y, save the country selection (if it contains actual countries, not just EA)
    const hasActualCountries = filtersStore.selectedCountries.some(c => c !== 'EA' && c !== 'EA_AAA');
    if (hasActualCountries) {
      savedCountries.value = [...filtersStore.selectedCountries];
    }
    // Switch to Euro Area aggregate
    filtersStore.selectedCountries = [filtersStore.issuerType === 'aaa' ? 'EA_AAA' : 'EA'];
  } else if (oldMaturity && oldMaturity !== '10Y') {
    // Returning to 10Y, restore the saved country selection
    filtersStore.selectedCountries = [...savedCountries.value];
  }
});

// If the issuerType changes, update the selectedCountries if we are not in 10Y
watch(() => filtersStore.issuerType, (newIssuerType) => {
  if (filtersStore.selectedMaturity !== '10Y') {
    filtersStore.selectedCountries = [newIssuerType === 'aaa' ? 'EA_AAA' : 'EA'];
  }
});

const maturities: { value: Maturity; label: string }[] = [
  { value: '3M', label: '3M (T-bill)' },
  { value: '6M', label: '6M (T-bill)' },
  { value: '1Y', label: '1Y (T-bill)' },
  { value: '2Y', label: '2Y Bond' },
  { value: '5Y', label: '5Y Bond' },
  { value: '10Y', label: '10Y Bond' },
  { value: '30Y', label: '30Y Bond' },
];
</script>

<template>
  <div class="font-mono text-xs">
    <Select v-model="filtersStore.selectedMaturity">
      <SelectTrigger class="w-[150px] border-border font-mono text-xs text-foreground cursor-pointer rounded-none">
        <SelectValue placeholder="Maturity" />
      </SelectTrigger>
      <SelectContent position="popper" class="border-border bg-background rounded-none">
        <SelectGroup>
          <SelectItem
            v-for="mat in maturities"
            :key="mat.value"
            :value="mat.value"
            class="hover:bg-surface cursor-pointer select-none rounded-none font-mono text-xs"
          >
            {{ mat.label }}
          </SelectItem>
        </SelectGroup>
      </SelectContent>
    </Select>
  </div>
</template>
