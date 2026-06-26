<script setup lang="ts">
import { computed, ref } from 'vue';
import { useFiltersStore } from '../stores/filtersStore';
import type { TimeRange } from '../types/bond';
import { Popover, PopoverContent, PopoverTrigger } from './ui/popover';

const filtersStore = useFiltersStore();
const isOpen = ref(false);

const presets: { value: TimeRange; label: string }[] = [
  { value: '6M', label: '6M' },
  { value: '1Y', label: '1Y' },
  { value: '5Y', label: '5Y' },
  { value: '10Y', label: '10Y' },
  { value: 'MAX', label: 'MAX' },
];

const setPreset = (preset: TimeRange) => {
  filtersStore.selectedPeriod = preset;
  // Clear custom dates when selecting preset
  filtersStore.customStartDate = null;
  filtersStore.customEndDate = null;
};

const applyCustomRange = () => {
  if (filtersStore.customStartDate && filtersStore.customEndDate) {
    // Set selectedPeriod to empty or special to show custom is active
    filtersStore.selectedPeriod = 'MAX'; // Fallback to MAX query, but we filter by dates
    isOpen.value = false;
  }
};

const clearCustomRange = () => {
  filtersStore.customStartDate = null;
  filtersStore.customEndDate = null;
  filtersStore.selectedPeriod = 'MAX';
  isOpen.value = false;
};

const isCustomActive = computed(() => {
  return filtersStore.customStartDate !== null && filtersStore.customEndDate !== null;
});

const customRangeLabel = computed(() => {
  if (isCustomActive.value) {
    return `${filtersStore.customStartDate} ~ ${filtersStore.customEndDate}`;
  }
  return 'CUSTOM';
});
</script>

<template>
  <div class="flex items-center gap-4 font-mono text-xs select-none">
    <!-- Preset buttons -->
    <div class="flex items-center gap-3">
      <button
        v-for="preset in presets"
        :key="preset.value"
        @click="setPreset(preset.value)"
        class="pb-0.5 cursor-pointer font-mono text-xs uppercase tracking-wider transition-all"
        :class="[
          filtersStore.selectedPeriod === preset.value && !isCustomActive
            ? 'text-foreground font-bold border-b-2 border-text-primary'
            : 'text-text-muted hover:text-foreground border-b-2 border-transparent'
        ]"
      >
        {{ preset.label }}
      </button>
    </div>

    <!-- Custom Date Range Popover -->
    <Popover v-model:open="isOpen">
      <PopoverTrigger as-child>
        <button
          class="pb-0.5 cursor-pointer font-mono text-xs uppercase tracking-wider transition-all"
          :class="[
            isCustomActive
              ? 'text-foreground font-bold border-b-2 border-text-primary'
              : 'text-text-muted hover:text-foreground border-b-2 border-transparent'
          ]"
        >
          [{{ customRangeLabel }}]
        </button>
      </PopoverTrigger>
      
      <PopoverContent class="w-[260px] p-4 border-border bg-background rounded-none font-mono text-xs" align="end">
        <div class="flex flex-col gap-3">
          <div class="font-bold border-b border-border pb-1 mb-1">SET DATE RANGE</div>
          
          <div class="flex flex-col gap-1">
            <label for="start-date-input" class="text-[10px] text-text-muted">START DATE</label>
            <input
              id="start-date-input"
              type="date"
              v-model="filtersStore.customStartDate"
              class="w-full p-1.5 border border-border bg-surface text-foreground font-mono text-xs rounded-none focus:outline-none focus:border-text-primary"
            />
          </div>

          <div class="flex flex-col gap-1">
            <label for="end-date-input" class="text-[10px] text-text-muted">END DATE</label>
            <input
              id="end-date-input"
              type="date"
              v-model="filtersStore.customEndDate"
              class="w-full p-1.5 border border-border bg-surface text-foreground font-mono text-xs rounded-none focus:outline-none focus:border-text-primary"
            />
          </div>

          <div class="flex gap-2 mt-2">
            <button
              @click="applyCustomRange"
              :disabled="!filtersStore.customStartDate || !filtersStore.customEndDate"
              class="flex-1 py-1.5 bg-text-primary text-background font-bold text-center cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed select-none transition-opacity"
            >
              APPLY
            </button>
            <button
              @click="clearCustomRange"
              class="flex-1 py-1.5 border border-border hover:bg-surface text-foreground font-bold text-center cursor-pointer select-none transition-colors"
            >
              RESET
            </button>
          </div>
        </div>
      </PopoverContent>
    </Popover>
  </div>
</template>
