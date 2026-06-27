import { defineStore } from 'pinia';
import { ref } from 'vue';
import type { DataPoint } from '../types/bond';
import { 
  fetchEuroAreaYields, 
  fetchCountryYields, 
  fetchBankRates, 
  fetchDebtToGdp,
  fetchHicpInflation,
  fetchUnemployment,
  fetchGdpGrowth,
  fetchPolicyRates,
  fetchExchangeRates,
  fetchDeficit,
  fetchConsumerConfidence,
  fetchRetailSales,
  fetchSavingRate
} from '../services/ecbApi';

const CACHE_KEY = 'eu_bonds_data_cache_v7';
const CACHE_DURATION_MS = 60 * 60 * 1000; // 1 hour cache

interface CacheData {
  euroAreaAll: Record<string, DataPoint[]> | null;
  euroAreaAaa: Record<string, DataPoint[]> | null;
  countries: Record<string, DataPoint[]> | null;
  mortgages: Record<string, DataPoint[]> | null;
  corporates: Record<string, DataPoint[]> | null;
  deposits: Record<string, DataPoint[]> | null;
  debtGdp: Record<string, DataPoint[]> | null;
  inflation: Record<string, DataPoint[]> | null;
  unemployment: Record<string, DataPoint[]> | null;
  gdpGrowth: Record<string, DataPoint[]> | null;
  policyRates: Record<string, DataPoint[]> | null;
  exchangeRates: Record<string, DataPoint[]> | null;
  deficit: Record<string, DataPoint[]> | null;
  consumerConf: Record<string, DataPoint[]> | null;
  retailSales: Record<string, DataPoint[]> | null;
  savingRate: Record<string, DataPoint[]> | null;
  timestamp: number;
}

export const useBondDataStore = defineStore('bondData', () => {
  const euroAreaAll = ref<Record<string, DataPoint[]> | null>(null);
  const euroAreaAaa = ref<Record<string, DataPoint[]> | null>(null);
  const countriesData = ref<Record<string, DataPoint[]> | null>(null);
  const mortgagesData = ref<Record<string, DataPoint[]> | null>(null);
  const corporatesData = ref<Record<string, DataPoint[]> | null>(null);
  const depositsData = ref<Record<string, DataPoint[]> | null>(null);
  const debtGdpData = ref<Record<string, DataPoint[]> | null>(null);
  const inflationData = ref<Record<string, DataPoint[]> | null>(null);
  const unemploymentData = ref<Record<string, DataPoint[]> | null>(null);
  const gdpGrowthData = ref<Record<string, DataPoint[]> | null>(null);
  const policyRatesData = ref<Record<string, DataPoint[]> | null>(null);
  const exchangeRatesData = ref<Record<string, DataPoint[]> | null>(null);
  
  const deficitData = ref<Record<string, DataPoint[]> | null>(null);
  const consumerConfData = ref<Record<string, DataPoint[]> | null>(null);
  const retailSalesData = ref<Record<string, DataPoint[]> | null>(null);
  const savingRateData = ref<Record<string, DataPoint[]> | null>(null);
  
  const isLoading = ref<boolean>(false);
  const error = ref<string | null>(null);
  const lastUpdated = ref<number | null>(null);

  // Load from sessionStorage cache on init
  const loadCache = (): boolean => {
    try {
      const cached = sessionStorage.getItem(CACHE_KEY);
      if (cached) {
        const parsed = JSON.parse(cached) as CacheData;
        const now = Date.now();
        if (now - parsed.timestamp < CACHE_DURATION_MS) {
          euroAreaAll.value = parsed.euroAreaAll;
          euroAreaAaa.value = parsed.euroAreaAaa;
          countriesData.value = parsed.countries;
          mortgagesData.value = parsed.mortgages || null;
          corporatesData.value = parsed.corporates || null;
          depositsData.value = parsed.deposits || null;
          debtGdpData.value = parsed.debtGdp || null;
          inflationData.value = parsed.inflation || null;
          unemploymentData.value = parsed.unemployment || null;
          gdpGrowthData.value = parsed.gdpGrowth || null;
          policyRatesData.value = parsed.policyRates || null;
          exchangeRatesData.value = parsed.exchangeRates || null;
          deficitData.value = parsed.deficit || null;
          consumerConfData.value = parsed.consumerConf || null;
          retailSalesData.value = parsed.retailSales || null;
          savingRateData.value = parsed.savingRate || null;
          lastUpdated.value = parsed.timestamp;
          return true;
        }
      }
    } catch (e) {
      console.warn('Failed to load bond data from cache:', e);
    }
    return false;
  };

  // Save to sessionStorage cache
  const saveCache = () => {
    try {
      const cacheData: CacheData = {
        euroAreaAll: euroAreaAll.value,
        euroAreaAaa: euroAreaAaa.value,
        countries: countriesData.value,
        mortgages: mortgagesData.value,
        corporates: corporatesData.value,
        deposits: depositsData.value,
        debtGdp: debtGdpData.value,
        inflation: inflationData.value,
        unemployment: unemploymentData.value,
        gdpGrowth: gdpGrowthData.value,
        policyRates: policyRatesData.value,
        exchangeRates: exchangeRatesData.value,
        deficit: deficitData.value,
        consumerConf: consumerConfData.value,
        retailSales: retailSalesData.value,
        savingRate: savingRateData.value,
        timestamp: Date.now()
      };
      sessionStorage.setItem(CACHE_KEY, JSON.stringify(cacheData));
    } catch (e) {
      console.warn('Failed to save bond data to cache:', e);
    }
  };

  const fetchAllData = async (forceRefresh = false) => {
    if (!forceRefresh && loadCache()) {
      console.log('Loaded bond and bank/GDP data from client cache.');
      return;
    }

    isLoading.value = true;
    error.value = null;

    try {
      // Run the calls in parallel to speed up page load
      console.log('Fetching all bond, bank interest, and GDP debt data from ECB/Eurostat...');
      const [
        allYields, 
        aaaYields, 
        countryYields, 
        mortgages, 
        corporates, 
        deposits, 
        debtGdp,
        inflation,
        unemployment,
        gdpGrowth,
        policyRates,
        exchangeRates,
        deficit,
        consumerConf,
        retailSales,
        savingRate
      ] = await Promise.all([
        fetchEuroAreaYields('all'),
        fetchEuroAreaYields('aaa'),
        fetchCountryYields(),
        fetchBankRates('mortgage'),
        fetchBankRates('corporate'),
        fetchBankRates('deposit'),
        fetchDebtToGdp(),
        fetchHicpInflation(),
        fetchUnemployment(),
        fetchGdpGrowth(),
        fetchPolicyRates(),
        fetchExchangeRates(),
        fetchDeficit(),
        fetchConsumerConfidence(),
        fetchRetailSales(),
        fetchSavingRate()
      ]);

      euroAreaAll.value = allYields;
      euroAreaAaa.value = aaaYields;
      countriesData.value = countryYields;
      mortgagesData.value = mortgages;
      corporatesData.value = corporates;
      depositsData.value = deposits;
      debtGdpData.value = debtGdp;
      inflationData.value = inflation;
      unemploymentData.value = unemployment;
      gdpGrowthData.value = gdpGrowth;
      policyRatesData.value = policyRates;
      exchangeRatesData.value = exchangeRates;
      deficitData.value = deficit;
      consumerConfData.value = consumerConf;
      retailSalesData.value = retailSales;
      savingRateData.value = savingRate;
      lastUpdated.value = Date.now();

      saveCache();
      console.log('Successfully fetched and cached bond, bank, and GDP data.');
    } catch (e: any) {
      console.error('Error fetching bond data:', e);
      error.value = 'Unable to load data. Please retry.';
    } finally {
      isLoading.value = false;
    }
  };

  return {
    euroAreaAll,
    euroAreaAaa,
    countriesData,
    mortgagesData,
    corporatesData,
    depositsData,
    debtGdpData,
    inflationData,
    unemploymentData,
    gdpGrowthData,
    policyRatesData,
    exchangeRatesData,
    deficitData,
    consumerConfData,
    retailSalesData,
    savingRateData,
    isLoading,
    error,
    lastUpdated,
    fetchAllData,
  };
});
