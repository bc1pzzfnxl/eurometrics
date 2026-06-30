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
  fetchSavingRate,
  fetchGdpSectors
} from '../services/ecbApi';

const CACHE_KEY = 'eu_bonds_data_cache_v8';
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
  gdpSectors: Record<string, Record<string, DataPoint[]>> | null;
  timestamp: number;
  isFullDataLoaded: boolean;
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
  const gdpSectorsData = ref<Record<string, Record<string, DataPoint[]>> | null>(null);
  
  const isLoading = ref<boolean>(false);
  const error = ref<string | null>(null);
  const lastUpdated = ref<number | null>(null);
  const isFullDataLoaded = ref<boolean>(false);

  // Load from sessionStorage cache on init
  const loadCache = (requireFull = false): boolean => {
    try {
      const cached = sessionStorage.getItem(CACHE_KEY);
      if (cached) {
        const parsed = JSON.parse(cached) as CacheData;
        const now = Date.now();
        if (now - parsed.timestamp < CACHE_DURATION_MS) {
          if (requireFull && !parsed.isFullDataLoaded) {
            return false;
          }
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
          gdpSectorsData.value = parsed.gdpSectors || null;
          lastUpdated.value = parsed.timestamp;
          isFullDataLoaded.value = !!parsed.isFullDataLoaded;
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
        gdpSectors: gdpSectorsData.value,
        timestamp: Date.now(),
        isFullDataLoaded: isFullDataLoaded.value
      };
      sessionStorage.setItem(CACHE_KEY, JSON.stringify(cacheData));
    } catch (e) {
      console.warn('Failed to save bond data to cache:', e);
    }
  };

  const safeFetch = async <T>(fn: () => Promise<T>, label: string): Promise<T | null> => {
    try {
      return await fn();
    } catch (err) {
      console.warn(`Non-blocking fetch failure for ${label}:`, err);
      return null;
    }
  };

  const fetchLandingData = async (forceRefresh = false) => {
    if (!forceRefresh && loadCache(false)) {
      console.log('Loaded landing data from client cache.');
      return;
    }

    isLoading.value = true;
    error.value = null;

    try {
      console.log('Fetching landing page bond & inflation data...');
      const [
        allYields, 
        countryYields, 
        inflation,
        policyRates,
        exchangeRates,
      ] = await Promise.all([
        safeFetch(() => fetchEuroAreaYields('all'), 'allYields'),
        safeFetch(() => fetchCountryYields(), 'countryYields'),
        safeFetch(() => fetchHicpInflation(), 'inflation'),
        safeFetch(() => fetchPolicyRates(), 'policyRates'),
        safeFetch(() => fetchExchangeRates(), 'exchangeRates'),
      ]);

      if (!allYields && !countryYields) {
        throw new Error('Core yield datasets failed to load.');
      }

      euroAreaAll.value = allYields;
      countriesData.value = countryYields;
      inflationData.value = inflation;
      policyRatesData.value = policyRates;
      exchangeRatesData.value = exchangeRates;
      lastUpdated.value = Date.now();

      saveCache();
      console.log('Successfully fetched and cached landing data.');
    } catch (e: any) {
      console.error('Error fetching landing data:', e);
      error.value = 'Unable to load core market data. Please retry.';
    } finally {
      isLoading.value = false;
    }
  };

  const fetchAllData = async (forceRefresh = false) => {
    if (!forceRefresh && loadCache(true)) {
      console.log('Loaded all bond and bank/GDP data from client cache.');
      return;
    }

    isLoading.value = true;
    error.value = null;

    try {
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
        savingRate,
        gdpSectors
      ] = await Promise.all([
        safeFetch(() => fetchEuroAreaYields('all'), 'allYields'),
        safeFetch(() => fetchEuroAreaYields('aaa'), 'aaaYields'),
        safeFetch(() => fetchCountryYields(), 'countryYields'),
        safeFetch(() => fetchBankRates('mortgage'), 'mortgages'),
        safeFetch(() => fetchBankRates('corporate'), 'corporates'),
        safeFetch(() => fetchBankRates('deposit'), 'deposits'),
        safeFetch(() => fetchDebtToGdp(), 'debtGdp'),
        safeFetch(() => fetchHicpInflation(), 'inflation'),
        safeFetch(() => fetchUnemployment(), 'unemployment'),
        safeFetch(() => fetchGdpGrowth(), 'gdpGrowth'),
        safeFetch(() => fetchPolicyRates(), 'policyRates'),
        safeFetch(() => fetchExchangeRates(), 'exchangeRates'),
        safeFetch(() => fetchDeficit(), 'deficit'),
        safeFetch(() => fetchConsumerConfidence(), 'consumerConf'),
        safeFetch(() => fetchRetailSales(), 'retailSales'),
        safeFetch(() => fetchSavingRate(), 'savingRate'),
        safeFetch(() => fetchGdpSectors(), 'gdpSectors')
      ]);

      if (!allYields && !countryYields) {
        throw new Error('Core yield datasets failed to load.');
      }

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
      gdpSectorsData.value = gdpSectors;
      lastUpdated.value = Date.now();
      isFullDataLoaded.value = true;
      
      saveCache();
      console.log('Successfully fetched and cached bond, bank, and GDP data.');
    } catch (e: any) {
      console.error('Error fetching bond data:', e);
      error.value = 'Unable to load core market data. Please retry.';
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
    gdpSectorsData,
    isLoading,
    error,
    lastUpdated,
    isFullDataLoaded,
    fetchLandingData,
    fetchAllData,
  };
});
