import { computed } from 'vue';
import type { Ref } from 'vue';
import type { BondSeries, DataPoint } from '../types/bond';
import { COUNTRIES } from '../constants/countries';
import { useFiltersStore } from '../stores/filtersStore';

export function useChartOptions(activeSeries: Ref<BondSeries[]>, isDark: Ref<boolean>) {
  const filtersStore = useFiltersStore();

  return computed(() => {
    const dark = isDark.value;
    const textColor = dark ? '#F5F5F5' : '#0A0A0A';
    const textMutedColor = '#6B6B6B';
    const gridBorderColor = dark ? '#1F1F1F' : '#E5E5E5';
    const tooltipBgColor = dark ? '#F5F5F5' : '#0A0A0A';
    const tooltipTextColor = dark ? '#0A0A0A' : '#F5F5F5';

    // Get unique sorted dates across all visible series to build a solid category axis
    const allDatesSet = new Set<string>();
    activeSeries.value.forEach((s: BondSeries) => {
      s.points.forEach((p: DataPoint) => allDatesSet.add(p.date));
    });
    const sortedDates = Array.from(allDatesSet).sort();

    // Map countries, rates, and currencies to colors for easy lookup
    const countryColorMap = new Map<string, string>();
    COUNTRIES.forEach(c => countryColorMap.set(c.code, c.color));
    
    // Custom colors for EA aggregates
    countryColorMap.set('EA', dark ? '#F5F5F5' : '#0A0A0A');
    countryColorMap.set('EA_AAA', '#718096');

    // Custom colors for ECB key policy rates
    countryColorMap.set('MRR_FR', dark ? '#F5F5F5' : '#0A0A0A'); // Main Refinancing Rate
    countryColorMap.set('DFR', '#3182CE');  // Deposit Facility Rate (Blue)
    countryColorMap.set('MLFR', '#DD6B20'); // Marginal Lending Facility (Orange)

    // Custom colors for currencies
    countryColorMap.set('USD', '#3182CE');  // USD (Blue)
    countryColorMap.set('GBP', '#805AD5');  // GBP (Purple)
    countryColorMap.set('CHF', '#38A169');  // CHF (Green)
    countryColorMap.set('JPY', '#D69E2E');  // JPY (Yellow/Amber)

    // Get country/rate/currency name helper
    const getCountryName = (code: string) => {
      if (code === 'EA') return 'Euro Area';
      if (code === 'EA_AAA') return 'Euro Area (AAA)';
      if (code === 'DFR') return 'Deposit Facility Rate';
      if (code === 'MRR_FR') return 'Main Refinancing Rate';
      if (code === 'MLFR') return 'Marginal Lending Rate';
      if (code === 'USD') return 'USD per EUR';
      if (code === 'GBP') return 'GBP per EUR';
      if (code === 'CHF') return 'CHF per EUR';
      if (code === 'JPY') return 'JPY per EUR';
      return COUNTRIES.find(c => c.code === code)?.name || code;
    };

    // Determine unit formatting based on active category
    const isPercentage = !['exchange_rate', 'consumer_conf'].includes(filtersStore.rateCategory);
    const unitSuffix = filtersStore.rateCategory === 'consumer_conf' 
      ? ' pts' 
      : (isPercentage ? '%' : '');

    // Format series for ECharts
    const chartSeries = activeSeries.value.map((s: BondSeries) => {
      const dataMap = new Map<string, number>();
      s.points.forEach((p: DataPoint) => dataMap.set(p.date, p.value));

      let lastVal: number | null = null;
      const isStepCategory = [
        'policy_rate', 'mortgage', 'corporate', 'deposit', 
        'inflation', 'unemployment', 'gdp', 'debt_gdp',
        'deficit', 'consumer_conf', 'retail_sales', 'saving_rate'
      ].includes(filtersStore.rateCategory);

      // Map values matching the global timeline to align all lines properly
      // Forward-fill (carry forward last known observation) for step categories so tooltip works on all intermediate dates
      const seriesData = sortedDates.map(date => {
        const val = dataMap.get(date);
        if (val !== undefined && val !== null) {
          lastVal = val;
          return val;
        }
        if (isStepCategory && lastVal !== null) {
          return lastVal;
        }
        return null;
      });

      const color = countryColorMap.get(s.countryCode) || '#718096';

      return {
        name: getCountryName(s.countryCode),
        type: 'line',
        step: isStepCategory ? 'end' : undefined,
        data: seriesData,
        showSymbol: false,
        symbol: 'circle',
        symbolSize: 4,
        sampling: 'lttb', // Optimize rendering for dense daily datasets
        lineStyle: {
          width: 1.5,
          color,
        },
        itemStyle: {
          color,
        },
        connectNulls: true, // Handle missing country dates gracefully
      };
    });

    return {
      backgroundColor: 'transparent',
      textStyle: {
        fontFamily: 'JetBrains Mono, monospace',
        color: textColor,
      },
      grid: {
        top: 40,
        left: 50,
        right: 20,
        bottom: 95, // Space for dataZoom and legend
        containLabel: false,
        borderColor: gridBorderColor,
        borderWidth: 1,
        show: true,
      },
      tooltip: {
        trigger: 'axis',
        backgroundColor: tooltipBgColor,
        borderColor: 'transparent',
        borderWidth: 0,
        borderRadius: 0, // Sharp ASCII style
        padding: 10,
        textStyle: {
          color: tooltipTextColor,
          fontFamily: 'JetBrains Mono, monospace',
          fontSize: 12,
        },
        axisPointer: {
          type: 'line',
          lineStyle: {
            color: textMutedColor,
            width: 1,
            type: 'dashed',
          },
        },
        formatter: (params: any[]) => {
          if (!params || params.length === 0) return '';
          
          // Format date index header
          const date = sortedDates[params[0].dataIndex];
          let html = `<div style="font-weight: 500; margin-bottom: 6px; border-bottom: 1px solid ${tooltipTextColor}30; padding-bottom: 4px;">DATE: ${date}</div>`;
          
          // List values
          params.forEach(p => {
            if (p.value !== null && p.value !== undefined) {
              const marker = `<span style="display:inline-block;margin-right:8px;width:8px;height:8px;background-color:${p.color};"></span>`;
              // Currency pairs get 4 decimals, rates get 3 decimals
              const formattedVal = Number(p.value).toFixed(isPercentage ? 3 : 4);
              html += `<div style="display: flex; justify-content: space-between; gap: 20px; align-items: center; line-height: 1.6;">
                <span>${marker}${p.seriesName}</span>
                <span style="font-weight: 700;">${formattedVal}${unitSuffix}</span>
              </div>`;
            }
          });
          return html;
        },
      },
      legend: {
        show: true,
        type: 'scroll', // Handles large list of selected countries
        bottom: 5,
        icon: 'rect',
        itemWidth: 10,
        itemHeight: 10,
        textStyle: {
          color: textColor,
          fontFamily: 'JetBrains Mono, monospace',
          fontSize: 11,
        },
        pageIconColor: textColor,
        pageIconInactiveColor: textMutedColor,
        pageTextStyle: {
          color: textColor,
        },
      },
      xAxis: {
        type: 'category',
        data: sortedDates,
        boundaryGap: false,
        axisLine: {
          lineStyle: {
            color: gridBorderColor,
          },
        },
        axisTick: {
          show: true,
          lineStyle: {
            color: gridBorderColor,
          },
        },
        axisLabel: {
          color: textMutedColor,
          fontFamily: 'JetBrains Mono, monospace',
          fontSize: 10,
          formatter: (value: string) => {
            if (!value) return '';
            const parts = value.split('-');
            if (parts.length >= 2) {
              const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
              const mIdx = parseInt(parts[1]) - 1;
              const yearShort = parts[0].substring(2);
              return `${months[mIdx]} '${yearShort}`;
            }
            return value;
          },
        },
        splitLine: {
          show: false,
        },
      },
      yAxis: {
        type: 'value',
        axisLine: {
          show: false,
        },
        axisTick: {
          show: false,
        },
        axisLabel: {
          color: textMutedColor,
          fontFamily: 'JetBrains Mono, monospace',
          fontSize: 10,
          formatter: (value: number) => `${value.toFixed(isPercentage ? 2 : 2)}${unitSuffix}`,
        },
        splitLine: {
          show: true,
          lineStyle: {
            color: gridBorderColor,
            type: 'solid',
            width: 0.5,
          },
        },
      },
      dataZoom: [
        {
          type: 'inside', // Scroll and pinch zoom
          xAxisIndex: 0,
        },
        {
          type: 'slider', // Horizontal slider underneath grid
          show: true,
          xAxisIndex: 0,
          bottom: 35,
          height: 16,
          borderColor: gridBorderColor,
          fillerColor: dark ? 'rgba(245, 245, 245, 0.05)' : 'rgba(10, 10, 10, 0.05)',
          handleStyle: {
            color: textColor,
            borderColor: gridBorderColor,
          },
          textStyle: {
            color: 'transparent', // Hide dates inside the slider to preserve clean look
          },
        },
      ],
      series: chartSeries,
    };
  });
}
