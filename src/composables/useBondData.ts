import { computed } from 'vue';
import { useBondDataStore } from '../stores/bondDataStore';
import { useFiltersStore } from '../stores/filtersStore';
import type { BondSeries, DataPoint } from '../types/bond';

export function useBondData() {
  const dataStore = useBondDataStore();
  const filtersStore = useFiltersStore();

  // Helper to slice data based on date range
  const filterByDateRange = (points: DataPoint[]): DataPoint[] => {
    if (!points || points.length === 0) return [];

    let startDateStr = '';
    let endDateStr = '';

    if (filtersStore.selectedPeriod === 'MAX') {
      return points;
    }

    // Get the latest date in the dataset to calculate presets relative to it
    const latestDateStr = points[points.length - 1].date;
    const latestDate = new Date(latestDateStr);

    if (filtersStore.customStartDate && filtersStore.customEndDate) {
      startDateStr = filtersStore.customStartDate;
      endDateStr = filtersStore.customEndDate;
    } else {
      const thresholdDate = new Date(latestDate);
      switch (filtersStore.selectedPeriod) {
        case '6M':
          thresholdDate.setMonth(thresholdDate.getMonth() - 6);
          break;
        case '1Y':
          thresholdDate.setFullYear(thresholdDate.getFullYear() - 1);
          break;
        case '5Y':
          thresholdDate.setFullYear(thresholdDate.getFullYear() - 5);
          break;
        case '10Y':
          thresholdDate.setFullYear(thresholdDate.getFullYear() - 10);
          break;
      }
      startDateStr = thresholdDate.toISOString().split('T')[0];
      endDateStr = latestDateStr;
    }

    return points.filter(p => p.date >= startDateStr && p.date <= endDateStr);
  };

  // Exposed computed property for active series on the chart
  const activeSeries = computed<BondSeries[]>(() => {
    const series: BondSeries[] = [];

    // Handle Bank Interest Rates & Government Debt
    if (filtersStore.rateCategory !== 'sovereign') {
      let sourceData: Record<string, DataPoint[]> | null = null;
      if (filtersStore.rateCategory === 'mortgage') {
        sourceData = dataStore.mortgagesData;
      } else if (filtersStore.rateCategory === 'corporate') {
        sourceData = dataStore.corporatesData;
      } else if (filtersStore.rateCategory === 'deposit') {
        sourceData = dataStore.depositsData;
      } else if (filtersStore.rateCategory === 'debt_gdp') {
        sourceData = dataStore.debtGdpData;
      } else if (filtersStore.rateCategory === 'inflation') {
        sourceData = dataStore.inflationData;
      } else if (filtersStore.rateCategory === 'unemployment') {
        sourceData = dataStore.unemploymentData;
      } else if (filtersStore.rateCategory === 'gdp') {
        sourceData = dataStore.gdpGrowthData;
      } else if (filtersStore.rateCategory === 'policy_rate') {
        sourceData = dataStore.policyRatesData;
      } else if (filtersStore.rateCategory === 'exchange_rate') {
        sourceData = dataStore.exchangeRatesData;
      } else if (filtersStore.rateCategory === 'deficit') {
        sourceData = dataStore.deficitData;
      } else if (filtersStore.rateCategory === 'consumer_conf') {
        sourceData = dataStore.consumerConfData;
      } else if (filtersStore.rateCategory === 'retail_sales') {
        sourceData = dataStore.retailSalesData;
      } else if (filtersStore.rateCategory === 'saving_rate') {
        sourceData = dataStore.savingRateData;
      }

      if (!sourceData) return [];

      // Add selected countries
      for (const countryCode of filtersStore.selectedCountries) {
        // EA_AAA is not applicable for bank rates
        if (countryCode === 'EA_AAA') continue;

        const points = sourceData[countryCode];
        if (points && points.length > 0) {
          series.push({
            countryCode,
            maturity: '10Y', // Dummy maturity matching type requirements
            issuerType: 'all',
            points: filterByDateRange(points),
          });
        }
      }
      return series;
    }

    // If Selected Maturity is 10Y, we can plot individual countries and Euro Area aggregate
    if (filtersStore.selectedMaturity === '10Y') {
      if (!dataStore.countriesData) return [];

      // Add selected countries
      for (const countryCode of filtersStore.selectedCountries) {
        // Special aggregates that might be selected
        if (countryCode === 'EA' || countryCode === 'EA_AAA') {
          const eaSource = countryCode === 'EA_AAA' ? dataStore.euroAreaAaa : dataStore.euroAreaAll;
          const eaPoints = eaSource?.['SR_10Y'];
          if (eaPoints) {
            series.push({
              countryCode,
              maturity: '10Y',
              issuerType: countryCode === 'EA_AAA' ? 'aaa' : 'all',
              points: filterByDateRange(eaPoints),
            });
          }
          continue;
        }

        // Standard countries
        const countryPoints = dataStore.countriesData[countryCode];
        if (countryPoints && countryPoints.length > 0) {
          series.push({
            countryCode,
            maturity: '10Y',
            issuerType: 'all',
            points: filterByDateRange(countryPoints),
          });
        }
      }
    } else {
      // If Maturity is NOT 10Y, only the Euro Area aggregates have data
      // We render the selected Euro Area curve (All or AAA) based on filtersStore.issuerType
      const eaSource = filtersStore.issuerType === 'aaa' ? dataStore.euroAreaAaa : dataStore.euroAreaAll;
      
      // Map local maturity to YC dataset code (e.g. "2Y" -> "SR_2Y")
      const matCode = `SR_${filtersStore.selectedMaturity}`;
      const eaPoints = eaSource?.[matCode];

      if (eaPoints) {
        series.push({
          countryCode: filtersStore.issuerType === 'aaa' ? 'EA_AAA' : 'EA',
          maturity: filtersStore.selectedMaturity,
          issuerType: filtersStore.issuerType,
          points: filterByDateRange(eaPoints),
        });
      }
    }

    return series;
  });

  // Check if countries selection is disabled
  const isCountrySelectorDisabled = computed(() => {
    if (filtersStore.rateCategory !== 'sovereign') return false;
    return filtersStore.selectedMaturity !== '10Y';
  });

  return {
    activeSeries,
    isCountrySelectorDisabled,
  };
}
