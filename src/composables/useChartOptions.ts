import { computed } from 'vue';
import type { Ref } from 'vue';
import type { BondSeries, DataPoint } from '../types/bond';
import { COUNTRIES } from '../constants/countries';
import { useFiltersStore } from '../stores/filtersStore';

interface MacroEvent {
  date: string;
  endDate?: string;
  name: string;
}

const findClosestDate = (targetDate: string, dates: string[]): string | undefined => {
  if (dates.length === 0) return undefined;
  if (targetDate.length === 7) {
    const match = dates.find(d => d.startsWith(targetDate));
    if (match) return match;
  }
  if (dates.includes(targetDate)) return targetDate;
  const targetTime = new Date(targetDate).getTime();
  let closest = dates[0];
  let minDiff = Math.abs(new Date(closest).getTime() - targetTime);
  for (let i = 1; i < dates.length; i++) {
    const diff = Math.abs(new Date(dates[i]).getTime() - targetTime);
    if (diff < minDiff) {
      minDiff = diff;
      closest = dates[i];
    }
  }
  return closest;
};

const getCategoryEvents = (category: string): MacroEvent[] => {
  switch (category) {
    case 'sovereign':
      return [
        { date: '2008-09-15', name: 'Lehman' },
        { date: '2010-05-02', endDate: '2012-07-26', name: 'Debt Crisis' },
        { date: '2012-07-26', name: 'Whatever It Takes' },
        { date: '2015-03-09', name: 'QE Launch' },
        { date: '2020-03-18', name: 'PEPP Launch' }
      ];
    case 'policy_rate':
      return [
        { date: '2008-09-15', name: 'Lehman' },
        { date: '2014-06-11', name: 'Negative DFR' },
        { date: '2020-03-18', name: 'PEPP Launch' },
        { date: '2022-07-21', name: 'First Hike' }
      ];
    case 'inflation':
      return [
        { date: '2008-09-15', name: 'Lehman' },
        { date: '2020-03-01', endDate: '2021-06-01', name: 'Pandemic' },
        { date: '2022-02-24', name: 'Ukraine War' }
      ];
    case 'unemployment':
    case 'gdp':
      return [
        { date: '2008-09-15', endDate: '2009-06-30', name: 'Great Recession' },
        { date: '2020-03-01', endDate: '2020-09-30', name: 'Lockdowns' },
        { date: '2022-02-24', name: 'Ukraine War' }
      ];
    case 'debt_gdp':
    case 'deficit':
      return [
        { date: '2008-09-15', endDate: '2010-12-31', name: 'GFC Response' },
        { date: '2020-03-01', endDate: '2021-12-31', name: 'COVID Response' }
      ];
    case 'consumer_conf':
    case 'retail_sales':
    case 'saving_rate':
      return [
        { date: '2020-03-01', endDate: '2020-06-30', name: 'Lockdowns' },
        { date: '2022-09-01', name: 'Energy Crisis Peak' }
      ];
    default:
      return [];
  }
};

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

    // Calculate annotations (markLine and markArea) based on active category
    const categoryEvents = getCategoryEvents(filtersStore.rateCategory);
    const markLineData: any[] = [];
    const markAreaData: any[] = [];

    categoryEvents.forEach(evt => {
      const startCl = findClosestDate(evt.date, sortedDates);
      if (!startCl) return;

      if (evt.endDate) {
        const endCl = findClosestDate(evt.endDate, sortedDates);
        if (endCl) {
          markAreaData.push([
            { xAxis: startCl, name: evt.name },
            { xAxis: endCl }
          ]);
        }
      } else {
        markLineData.push({
          xAxis: startCl,
          name: evt.name,
          label: {
            formatter: evt.name
          }
        });
      }
    });

    const markLine = markLineData.length > 0 ? {
      symbol: ['none', 'none'],
      lineStyle: {
        color: dark ? 'rgba(245, 245, 245, 0.3)' : 'rgba(0, 51, 153, 0.35)',
        type: 'dashed',
        width: 1
      },
      label: {
        show: true,
        position: 'end',
        color: dark ? 'rgba(245, 245, 245, 0.6)' : 'rgba(0, 51, 153, 0.65)',
        fontFamily: 'JetBrains Mono, monospace',
        fontSize: 8,
        distance: 2
      },
      data: markLineData
    } : undefined;

    const markArea = markAreaData.length > 0 ? {
      itemStyle: {
        color: dark ? 'rgba(245, 245, 245, 0.03)' : 'rgba(0, 51, 153, 0.04)'
      },
      label: {
        show: true,
        position: 'top',
        color: dark ? 'rgba(245, 245, 245, 0.4)' : 'rgba(0, 51, 153, 0.45)',
        fontFamily: 'JetBrains Mono, monospace',
        fontSize: 8
      },
      data: markAreaData
    } : undefined;

    // Format series for ECharts
    const chartSeries = activeSeries.value.map((s: BondSeries, idx: number) => {
      const dataMap = new Map<string, number>();
      s.points.forEach((p: DataPoint) => dataMap.set(p.date, p.value));

      let lastVal: number | null = null;
      const isStepCategory = filtersStore.rateCategory === 'policy_rate';
      const shouldForwardFill = [
        'policy_rate', 'mortgage', 'corporate', 'deposit', 
        'inflation', 'unemployment', 'gdp', 'debt_gdp',
        'deficit', 'consumer_conf', 'retail_sales', 'saving_rate'
      ].includes(filtersStore.rateCategory);

      // Map values matching the global timeline to align all lines properly
      // Forward-fill (carry forward last known observation) for non-daily categories so tooltip works on all intermediate dates
      const seriesData = sortedDates.map(date => {
        const val = dataMap.get(date);
        if (val !== undefined && val !== null) {
          lastVal = val;
          return val;
        }
        if (shouldForwardFill && lastVal !== null) {
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
        markLine: idx === 0 ? markLine : undefined,
        markArea: idx === 0 ? markArea : undefined,
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
        bottom: 115, // Space for dataZoom, legend, and scroll indicator
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
        bottom: 25,
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
          bottom: 55,
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
