import { beforeEach, describe, expect, it, vi } from 'vitest';
import { setActivePinia, createPinia } from 'pinia';
import { ref, nextTick } from 'vue';

// Mock sessionStorage for Pinia cache checks
const sessionStorageMock = (() => {
  let store: Record<string, string> = {};
  return {
    getItem: (key: string) => store[key] || null,
    setItem: (key: string, value: string) => { store[key] = value; },
    removeItem: (key: string) => { delete store[key]; },
    clear: () => { store = {}; }
  };
})();
Object.defineProperty(global, 'sessionStorage', { value: sessionStorageMock, writable: true });

// Mock ofetch to redirect browser relative proxy paths to official ECB servers during testing
vi.mock('ofetch', async (importOriginal) => {
  const original = await importOriginal<typeof import('ofetch')>();
  const customOfetch = (url: string, options?: any) => {
    let finalUrl = url;
    if (url.startsWith('/_api-ecb')) {
      finalUrl = url.replace('/_api-ecb', 'https://data-api.ecb.europa.eu/service');
    }
    return original.ofetch(finalUrl, options);
  };
  return {
    ...original,
    ofetch: customOfetch
  };
});

// Import stores and utilities
import { useFiltersStore } from './stores/filtersStore';
import { useBondDataStore } from './stores/bondDataStore';
import { useBondData } from './composables/useBondData';
import { useChartOptions } from './composables/useChartOptions';
import * as ecbApi from './services/ecbApi';

describe('EuroMetrics Store & Selection Sanitization Tests', () => {
  beforeEach(() => {
    setActivePinia(createPinia());
    sessionStorage.clear();
  });

  it('should initialize with default states', () => {
    const filtersStore = useFiltersStore();
    expect(filtersStore.activeTab).toBe('rates');
    expect(filtersStore.rateCategory).toBe('sovereign');
    expect(filtersStore.selectedCountries).toContain('DE');
  });

  it('should switch categories and select defaults when activeTab changes', async () => {
    const filtersStore = useFiltersStore();

    // Switch to Macro
    filtersStore.activeTab = 'macro';
    await nextTick();
    expect(filtersStore.rateCategory).toBe('inflation');

    // Switch to Monetary
    filtersStore.activeTab = 'monetary';
    await nextTick();
    expect(filtersStore.rateCategory).toBe('policy_rate');
  });

  it('should sanitize selectedCountries during category transitions', async () => {
    const filtersStore = useFiltersStore();

    // 1. Start in sovereign. Selections are standard Eurozone countries.
    expect(filtersStore.selectedCountries).toContain('DE');

    // 2. Switch category to policy rates. Countries list should sanitize to ['DFR', 'MRR_FR', 'MLFR']
    filtersStore.rateCategory = 'policy_rate';
    await nextTick();
    expect(filtersStore.selectedCountries).toContain('DFR');
    expect(filtersStore.selectedCountries).toContain('MRR_FR');
    expect(filtersStore.selectedCountries).toContain('MLFR');

    // 3. Switch category to exchange rates. Selection should sanitize to ['USD']
    filtersStore.rateCategory = 'exchange_rate';
    await nextTick();
    expect(filtersStore.selectedCountries).toContain('USD');
    expect(filtersStore.selectedCountries).not.toContain('DFR');

    // 4. Switch category back to a standard country category. Selections should revert to standard Eurozone list
    filtersStore.rateCategory = 'inflation';
    await nextTick();
    expect(filtersStore.selectedCountries).toContain('DE');
    expect(filtersStore.selectedCountries).not.toContain('USD');
  });
});

describe('EuroMetrics Live API Fetching & Mapping Tests', () => {
  beforeEach(() => {
    setActivePinia(createPinia());
    sessionStorage.clear();
  });

  it('should successfully parse and cache HICP inflation from ECB SDMX', async () => {
    const inflation = await ecbApi.fetchHicpInflation();
    expect(inflation).toBeDefined();
    // Validate that we got series for Eurozone countries and mapped U2 to EA
    expect(Object.keys(inflation).length).toBeGreaterThan(0);
    expect(inflation['DE']).toBeDefined();
    expect(inflation['EA']).toBeDefined();
    expect(inflation['DE'][0].date).toBeDefined();
    expect(inflation['DE'][0].value).toBeTypeOf('number');
  }, 10000);

  it('should successfully parse and cache Unemployment rates from Eurostat JSON-stat', async () => {
    const unemployment = await ecbApi.fetchUnemployment();
    expect(unemployment).toBeDefined();
    expect(Object.keys(unemployment).length).toBeGreaterThan(0);
    // Greek code EL should be mapped back to GR, and EA20 should be mapped back to EA
    expect(unemployment['GR']).toBeDefined();
    expect(unemployment['EA']).toBeDefined();
    expect(unemployment['DE'][0].value).toBeTypeOf('number');
  }, 10000);

  it('should successfully parse and cache GDP growth rates from Eurostat JSON-stat', async () => {
    const gdp = await ecbApi.fetchGdpGrowth();
    expect(gdp).toBeDefined();
    expect(Object.keys(gdp).length).toBeGreaterThan(0);
    // Greece and Euro Area checks
    expect(gdp['GR']).toBeDefined();
    expect(gdp['EA']).toBeDefined();
    expect(gdp['FR'][0].value).toBeTypeOf('number');
  }, 10000);

  it('should successfully parse and cache ECB base policy rates corridor from ECB FM', async () => {
    const policy = await ecbApi.fetchPolicyRates();
    expect(policy).toBeDefined();
    // Validate we got the specific policy rate keys DFR, MRR_FR, and MLFR
    expect(policy['DFR']).toBeDefined();
    expect(policy['MRR_FR']).toBeDefined();
    expect(policy['MLFR']).toBeDefined();
    expect(policy['DFR'][0].value).toBeTypeOf('number');
  }, 10000);

  it('should successfully parse and cache Exchange rates from ECB EXR', async () => {
    const exchange = await ecbApi.fetchExchangeRates();
    expect(exchange).toBeDefined();
    // Validate keys for USD, GBP, CHF, JPY
    expect(exchange['USD']).toBeDefined();
    expect(exchange['GBP']).toBeDefined();
    expect(exchange['CHF']).toBeDefined();
    expect(exchange['JPY']).toBeDefined();
    expect(exchange['USD'][0].value).toBeTypeOf('number');
  }, 10000);
});

describe('EuroMetrics Chart Config & Composables Option Tests', () => {
  beforeEach(() => {
    setActivePinia(createPinia());
    sessionStorage.clear();
  });

  it('should calculate activeSeries and format chartOptions with custom units', async () => {
    const filtersStore = useFiltersStore();
    const dataStore = useBondDataStore();
    
    // Simulate loading data into store
    dataStore.inflationData = {
      DE: [{ date: '2026-05-01', value: 2.2 }],
      FR: [{ date: '2026-05-01', value: 1.8 }],
      EA: [{ date: '2026-05-01', value: 2.0 }]
    };
    dataStore.exchangeRatesData = {
      USD: [{ date: '2026-05-01', value: 1.0825 }],
      GBP: [{ date: '2026-05-01', value: 0.8540 }]
    };

    // 1. Setup Macro tab HICP Category
    filtersStore.activeTab = 'macro';
    filtersStore.rateCategory = 'inflation';
    filtersStore.selectedCountries = ['DE', 'FR', 'EA'];

    const { activeSeries } = useBondData();
    expect(activeSeries.value.length).toBe(3);
    expect(activeSeries.value[0].countryCode).toBe('DE');
    expect(activeSeries.value[0].points[0].value).toBe(2.2);

    const isDark = ref(false);
    let options = useChartOptions(activeSeries, isDark).value;
    // Y-axis label formatter should include % for inflation
    expect(options.yAxis.axisLabel.formatter(2)).toContain('%');

    // 2. Setup Monetary tab Forex Category
    filtersStore.activeTab = 'monetary';
    filtersStore.rateCategory = 'exchange_rate';
    filtersStore.selectedCountries = ['USD', 'GBP'];

    const activeSeriesForex = useBondData().activeSeries;
    expect(activeSeriesForex.value.length).toBe(2);
    expect(activeSeriesForex.value[0].countryCode).toBe('USD');
    expect(activeSeriesForex.value[0].points[0].value).toBe(1.0825);

    options = useChartOptions(activeSeriesForex, isDark).value;
    // Y-axis label formatter should NOT include % for exchange rates
    expect(options.yAxis.axisLabel.formatter(1.08)).not.toContain('%');
    expect(options.yAxis.axisLabel.formatter(1.08)).toBe('1.08');
  });
});
