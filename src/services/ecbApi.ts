import { ofetch } from 'ofetch';
import type { DataPoint, IssuerType, Maturity } from '../types/bond';

// ECB API base URLs
const ECB_BASE_URL = '/_api-ecb/data';
const EUROSTAT_BASE_URL = 'https://ec.europa.eu/eurostat/api/dissemination/statistics/1.0/data';

// Inverse maturity mapping
const INVERSE_MATURITY_MAP: Record<string, Maturity> = {
  SR_3M: '3M',
  SR_6M: '6M',
  SR_1Y: '1Y',
  SR_2Y: '2Y',
  SR_5Y: '5Y',
  SR_10Y: '10Y',
  SR_30Y: '30Y',
};

// 20 Eurozone country codes
const EUROZONE_COUNTRIES = [
  'AT', 'BE', 'CY', 'DE', 'EE', 'ES', 'FI', 'FR', 'GR', 'HR',
  'IE', 'IT', 'LT', 'LU', 'LV', 'MT', 'NL', 'PT', 'SI', 'SK'
];

interface EcbSdmxResponse {
  dataSets: Array<{
    series: {
      [key: string]: {
        observations: {
          [obsIndex: string]: Array<number | null | string>;
        }
      }
    }
  }>;
  structure: {
    dimensions: {
      series: Array<{
        id: string;
        values: Array<{ id: string; name: string }>;
      }>;
      observation: Array<{
        id: string;
        values: Array<{ id: string; name: string }>;
      }>;
    }
  }
}

interface EurostatResponse {
  value: { [key: string]: number };
  dimension: {
    geo: {
      category: {
        index: { [key: string]: number };
        label: { [key: string]: string };
      }
    };
    time: {
      category: {
        index: { [key: string]: number };
        label: { [key: string]: string };
      }
    }
  }
}

/**
 * Fetches Euro Area (aggregate) yield curve data from ECB YC dataset.
 * Returns a map of maturity code (like "SR_10Y") to an array of DataPoints.
 */
export async function fetchEuroAreaYields(issuerType: IssuerType): Promise<Record<string, DataPoint[]>> {
  const issuerCode = issuerType === 'aaa' ? 'G_N_A' : 'G_N_C';
  const url = `${ECB_BASE_URL}/YC/B.U2.EUR.4F.${issuerCode}.SV_C_YM.SR_3M+SR_6M+SR_1Y+SR_2Y+SR_5Y+SR_10Y+SR_30Y?format=jsondata`;

  try {
    const response = await ofetch<EcbSdmxResponse>(url, {
      headers: {
        Accept: 'application/json',
      },
      retry: 2,
      retryDelay: 1000,
    });

    return parseEcbYieldCurve(response);
  } catch (error) {
    console.error('Failed to fetch Euro Area yields from ECB:', error);
    throw error;
  }
}

/**
 * Fetches 10Y convergence bond yields for all Eurozone countries.
 * First attempts to use ECB IRS, falls back to Eurostat if that fails.
 */
export async function fetchCountryYields(): Promise<Record<string, DataPoint[]>> {
  const countriesQuery = EUROZONE_COUNTRIES.join('+');
  const ecbUrl = `${ECB_BASE_URL}/IRS/M.${countriesQuery}.L.L40.CI.0000.EUR.N.Z?format=jsondata`;

  try {
    console.log('Attempting to fetch country yields from ECB IRS...');
    const response = await ofetch<EcbSdmxResponse>(ecbUrl, {
      headers: {
        Accept: 'application/json',
      },
      retry: 1,
      retryDelay: 1000,
    });
    return parseEcbCountryYields(response);
  } catch (ecbError) {
    console.warn('ECB IRS fetch failed, falling back to Eurostat...', ecbError);
    try {
      const eurostatUrl = `${EUROSTAT_BASE_URL}/irt_lt_mcby_m?format=JSON&lang=EN`;
      const response = await ofetch<EurostatResponse>(eurostatUrl, {
        retry: 2,
        retryDelay: 1000,
      });
      return parseEurostatDataset(response);
    } catch (eurostatError) {
      console.error('Eurostat fallback also failed:', eurostatError);
      throw eurostatError;
    }
  }
}

/**
 * Parses ECB YC (Yield Curve) SDMX-JSON response.
 */
function parseEcbYieldCurve(response: EcbSdmxResponse): Record<string, DataPoint[]> {
  const parsedData: Record<string, DataPoint[]> = {};
  
  if (!response.dataSets?.[0]?.series || !response.structure?.dimensions) {
    return parsedData;
  }

  const seriesList = response.structure.dimensions.series;
  const dtIndex = seriesList.findIndex(d => d.id === 'DATA_TYPE_FM');
  const timeValues = response.structure.dimensions.observation?.find(d => d.id === 'TIME_PERIOD')?.values || [];

  if (dtIndex === -1 || timeValues.length === 0) {
    return parsedData;
  }

  for (const [seriesKey, seriesData] of Object.entries(response.dataSets[0].series)) {
    const parts = seriesKey.split(':');
    const maturityVal = seriesList[dtIndex].values[parseInt(parts[dtIndex])];
    
    if (!maturityVal) continue;
    const maturityCode = maturityVal.id; // e.g. "SR_10Y"

    // Only process maturities we care about
    if (!Object.keys(INVERSE_MATURITY_MAP).includes(maturityCode)) {
      continue;
    }

    const points: DataPoint[] = [];
    for (const [timeIdxStr, obsValueArr] of Object.entries(seriesData.observations)) {
      const timeIdx = parseInt(timeIdxStr);
      const dateStr = timeValues[timeIdx]?.id; // Format is YYYY-MM-DD
      const rawVal = obsValueArr[0];

      if (dateStr && rawVal !== null && rawVal !== undefined) {
        const val = typeof rawVal === 'string' ? parseFloat(rawVal) : (rawVal as number);
        if (!isNaN(val)) {
          points.push({ date: dateStr, value: val });
        }
      }
    }

    // Sort by date ascending
    points.sort((a, b) => a.date.localeCompare(b.date));
    parsedData[maturityCode] = points;
  }

  return parsedData;
}

/**
 * Parses ECB IRS (Interest Rate Statistics) SDMX-JSON response.
 */
function parseEcbCountryYields(response: EcbSdmxResponse): Record<string, DataPoint[]> {
  const parsedData: Record<string, DataPoint[]> = {};

  if (!response.dataSets?.[0]?.series || !response.structure?.dimensions) {
    return parsedData;
  }

  const seriesList = response.structure.dimensions.series;
  const refAreaIndex = seriesList.findIndex(d => d.id === 'REF_AREA');
  const timeValues = response.structure.dimensions.observation?.find(d => d.id === 'TIME_PERIOD')?.values || [];

  if (refAreaIndex === -1 || timeValues.length === 0) {
    return parsedData;
  }

  for (const [seriesKey, seriesData] of Object.entries(response.dataSets[0].series)) {
    const parts = seriesKey.split(':');
    const countryVal = seriesList[refAreaIndex].values[parseInt(parts[refAreaIndex])];
    
    if (!countryVal) continue;
    const rawCountryCode = countryVal.id; // e.g. "DE" or "U2" or "I9"
    const countryCode = (rawCountryCode === 'U2' || rawCountryCode === 'I9') ? 'EA' : rawCountryCode;

    const points: DataPoint[] = [];
    for (const [timeIdxStr, obsValueArr] of Object.entries(seriesData.observations)) {
      const timeIdx = parseInt(timeIdxStr);
      const dateStr = timeValues[timeIdx]?.id; // Format is YYYY-MM
      const rawVal = obsValueArr[0];

      if (dateStr && rawVal !== null && rawVal !== undefined) {
        const val = typeof rawVal === 'string' ? parseFloat(rawVal) : (rawVal as number);
        if (!isNaN(val)) {
          // Standardise monthly YYYY-MM and quarterly YYYY-Q to YYYY-MM-01 for chart alignment
          let standardDateStr = dateStr;
          if (dateStr.includes('-Q')) {
            const dateParts = dateStr.split('-Q');
            const year = dateParts[0];
            const quarter = dateParts[1];
            if (quarter === '1') standardDateStr = `${year}-03-01`;
            else if (quarter === '2') standardDateStr = `${year}-06-01`;
            else if (quarter === '3') standardDateStr = `${year}-09-01`;
            else if (quarter === '4') standardDateStr = `${year}-12-01`;
          } else if (dateStr.includes('-') && dateStr.split('-').length === 2) {
            standardDateStr = `${dateStr}-01`;
          }
            
          points.push({ date: standardDateStr, value: val });
        }
      }
    }

    // Sort by date ascending
    points.sort((a, b) => a.date.localeCompare(b.date));
    parsedData[countryCode] = points;
  }

  return parsedData;
}

/**
 * Parses Eurostat JSON-stat response generically.
 */
function parseEurostatDataset(response: EurostatResponse): Record<string, DataPoint[]> {
  const parsedData: Record<string, DataPoint[]> = {};

  if (!response.value || !response.dimension?.geo?.category || !response.dimension?.time?.category) {
    return parsedData;
  }

  const geoIdxMap = response.dimension.geo.category.index;
  const timeIdxMap = response.dimension.time.category.index;
  const timeSize = Object.keys(timeIdxMap).length;

  const countriesToParse = [...EUROZONE_COUNTRIES, 'EA'];

  for (const targetCode of countriesToParse) {
    let eurostatCode = targetCode;
    if (targetCode === 'GR') {
      eurostatCode = 'EL';
    } else if (targetCode === 'EA') {
      if (geoIdxMap['EA21'] !== undefined) eurostatCode = 'EA21';
      else if (geoIdxMap['EA20'] !== undefined) eurostatCode = 'EA20';
      else eurostatCode = 'EA';
    }

    const geoIdx = geoIdxMap[eurostatCode];
    if (geoIdx === undefined) continue;

    const points: DataPoint[] = [];

    for (const [timeStr, timeIdx] of Object.entries(timeIdxMap)) {
      const valueIdx = geoIdx * timeSize + timeIdx;
      const rawVal = response.value[valueIdx.toString()];

      if (rawVal !== undefined && rawVal !== null) {
        let standardDateStr = timeStr;
        if (timeStr.includes('-Q')) {
          const dateParts = timeStr.split('-Q');
          const year = dateParts[0];
          const quarter = dateParts[1];
          if (quarter === '1') standardDateStr = `${year}-03-01`;
          else if (quarter === '2') standardDateStr = `${year}-06-01`;
          else if (quarter === '3') standardDateStr = `${year}-09-01`;
          else if (quarter === '4') standardDateStr = `${year}-12-01`;
        } else if (timeStr.includes('-') && timeStr.split('-').length === 2) {
          standardDateStr = `${timeStr}-01`;
        } else if (timeStr.length === 7 && timeStr.startsWith('20') && timeStr.includes('M')) {
          const parts = timeStr.split('M');
          standardDateStr = `${parts[0]}-${parts[1]}-01`;
        }

        points.push({ date: standardDateStr, value: rawVal });
      }
    }

    points.sort((a, b) => a.date.localeCompare(b.date));
    parsedData[targetCode] = points;
  }

  return parsedData;
}

/**
 * Fetches bank retail rates (mortgages, corporate loans, deposits) for Eurozone countries and Euro Area aggregate.
 */
export async function fetchBankRates(category: 'mortgage' | 'corporate' | 'deposit'): Promise<Record<string, DataPoint[]>> {
  const queryCountries = [...EUROZONE_COUNTRIES, 'U2'].join('+');
  let instrument = '';
  let sector = '';
  
  if (category === 'mortgage') {
    instrument = 'A2C';
    sector = '2250';
  } else if (category === 'corporate') {
    instrument = 'A2A';
    sector = '2240';
  } else if (category === 'deposit') {
    instrument = 'L22';
    sector = '2250';
  }

  const url = `${ECB_BASE_URL}/MIR/M.${queryCountries}.B.${instrument}.A.R.A.${sector}.EUR.N?format=jsondata`;

  try {
    console.log(`Fetching bank ${category} rates from ECB MIR...`);
    const response = await ofetch<EcbSdmxResponse>(url, {
      headers: {
        Accept: 'application/json',
      },
      retry: 2,
      retryDelay: 1000,
    });
    return parseEcbCountryYields(response);
  } catch (error) {
    console.error(`Failed to fetch bank ${category} rates:`, error);
    throw error;
  }
}

/**
 * Fetches general government gross debt as a percentage of GDP (Maastricht debt) for Eurozone countries and Euro Area aggregate.
 */
export async function fetchDebtToGdp(): Promise<Record<string, DataPoint[]>> {
  const queryCountries = [...EUROZONE_COUNTRIES, 'I9'].join('+');
  const url = `${ECB_BASE_URL}/GFS/Q.N.${queryCountries}.W0.S13.S1.C.L.LE.GD.T._Z.XDC_R_B1GQ_CY._T.F.V.N._T?format=jsondata`;

  try {
    console.log('Fetching government debt-to-GDP ratios from ECB GFS...');
    const response = await ofetch<EcbSdmxResponse>(url, {
      headers: {
        Accept: 'application/json',
      },
      retry: 2,
      retryDelay: 1000,
    });
    return parseEcbCountryYields(response);
  } catch (error) {
    console.error('Failed to fetch government debt-to-GDP ratios:', error);
    throw error;
  }
}

/**
 * Fetches HICP inflation rate (YoY % change) for Eurozone countries and Euro Area aggregate.
 */
export async function fetchHicpInflation(): Promise<Record<string, DataPoint[]>> {
  const queryCountries = [...EUROZONE_COUNTRIES, 'U2'].join('+');
  const url = `${ECB_BASE_URL}/ICP/M.${queryCountries}.N.000000.4.ANR?format=jsondata`;
  try {
    console.log('Fetching HICP inflation rates from ECB ICP...');
    const response = await ofetch<EcbSdmxResponse>(url, {
      headers: { Accept: 'application/json' },
      retry: 2,
      retryDelay: 1000,
    });
    return parseEcbCountryYields(response);
  } catch (error) {
    console.error('Failed to fetch HICP inflation rates:', error);
    throw error;
  }
}

/**
 * Fetches monthly unemployment rates (%) from Eurostat.
 */
export async function fetchUnemployment(): Promise<Record<string, DataPoint[]>> {
  const eurostatCountries = EUROZONE_COUNTRIES.map(c => c === 'GR' ? 'EL' : c);
  const queryCountries = [...eurostatCountries, 'EA20', 'EA21'];
  const geoQuery = queryCountries.map(c => `geo=${c}`).join('&');
  const url = `${EUROSTAT_BASE_URL}/une_rt_m?format=JSON&lang=EN&${geoQuery}&age=TOTAL&sex=T&unit=PC_ACT`;
  try {
    console.log('Fetching unemployment rates from Eurostat une_rt_m...');
    const response = await ofetch<EurostatResponse>(url, {
      retry: 2,
      retryDelay: 1000,
    });
    return parseEurostatDataset(response);
  } catch (error) {
    console.error('Failed to fetch unemployment rates from Eurostat:', error);
    throw error;
  }
}

/**
 * Fetches quarterly GDP growth (YoY % change) from Eurostat.
 */
export async function fetchGdpGrowth(): Promise<Record<string, DataPoint[]>> {
  const eurostatCountries = EUROZONE_COUNTRIES.map(c => c === 'GR' ? 'EL' : c);
  const queryCountries = [...eurostatCountries, 'EA20', 'EA21'];
  const geoQuery = queryCountries.map(c => `geo=${c}`).join('&');
  const url = `${EUROSTAT_BASE_URL}/namq_10_gdp?format=JSON&lang=EN&${geoQuery}&s_adj=SCA&unit=CLV_PCH_SM&na_item=B1GQ`;
  try {
    console.log('Fetching GDP growth rates from Eurostat namq_10_gdp...');
    const response = await ofetch<EurostatResponse>(url, {
      retry: 2,
      retryDelay: 1000,
    });
    return parseEurostatDataset(response);
  } catch (error) {
    console.error('Failed to fetch GDP growth from Eurostat:', error);
    throw error;
  }
}

/**
 * Fetches ECB key policy interest rates (MRR_FR, DFR, MLFR) from ECB FM.
 */
export async function fetchPolicyRates(): Promise<Record<string, DataPoint[]>> {
  const url = `${ECB_BASE_URL}/FM/D.U2.EUR.4F.KR.MRR_FR+DFR+MLFR.LEV?format=jsondata`;
  try {
    console.log('Fetching ECB policy interest rates from ECB FM...');
    const response = await ofetch<EcbSdmxResponse>(url, {
      headers: { Accept: 'application/json' },
      retry: 2,
      retryDelay: 1000,
    });
    return parseEcbPolicyRates(response);
  } catch (error) {
    console.error('Failed to fetch ECB policy rates:', error);
    throw error;
  }
}

/**
 * Parses ECB Key Policy interest rates.
 */
function parseEcbPolicyRates(response: EcbSdmxResponse): Record<string, DataPoint[]> {
  const parsedData: Record<string, DataPoint[]> = {};
  if (!response.dataSets?.[0]?.series || !response.structure?.dimensions) {
    return parsedData;
  }

  const seriesList = response.structure.dimensions.series;
  const rateIdx = seriesList.findIndex(d => d.id === 'PROVIDER_FM_ID');
  const timeValues = response.structure.dimensions.observation?.find(d => d.id === 'TIME_PERIOD')?.values || [];

  if (rateIdx === -1 || timeValues.length === 0) {
    return parsedData;
  }

  for (const [seriesKey, seriesData] of Object.entries(response.dataSets[0].series)) {
    const parts = seriesKey.split(':');
    const rateVal = seriesList[rateIdx].values[parseInt(parts[rateIdx])];
    if (!rateVal) continue;
    const rateCode = rateVal.id; // e.g. "DFR", "MRR_FR", "MLFR"

    const points: DataPoint[] = [];
    for (const [timeIdxStr, obsValueArr] of Object.entries(seriesData.observations)) {
      const timeIdx = parseInt(timeIdxStr);
      const dateStr = timeValues[timeIdx]?.id; // Format is YYYY-MM-DD
      const rawVal = obsValueArr[0];

      if (dateStr && rawVal !== null && rawVal !== undefined) {
        const val = typeof rawVal === 'string' ? parseFloat(rawVal) : (rawVal as number);
        if (!isNaN(val)) {
          points.push({ date: dateStr, value: val });
        }
      }
    }

    points.sort((a, b) => a.date.localeCompare(b.date));
    parsedData[rateCode] = points;
  }

  return parsedData;
}

/**
 * Fetches Euro monthly exchange rates (against USD, GBP, CHF, JPY) from ECB EXR.
 */
export async function fetchExchangeRates(): Promise<Record<string, DataPoint[]>> {
  const url = `${ECB_BASE_URL}/EXR/M.USD+GBP+CHF+JPY.EUR.SP00.A?format=jsondata`;
  try {
    console.log('Fetching Euro exchange rates from ECB EXR...');
    const response = await ofetch<EcbSdmxResponse>(url, {
      headers: { Accept: 'application/json' },
      retry: 2,
      retryDelay: 1000,
    });
    return parseEcbExchangeRates(response);
  } catch (error) {
    console.error('Failed to fetch exchange rates:', error);
    throw error;
  }
}

/**
 * Parses ECB EXR exchange rates.
 */
function parseEcbExchangeRates(response: EcbSdmxResponse): Record<string, DataPoint[]> {
  const parsedData: Record<string, DataPoint[]> = {};
  if (!response.dataSets?.[0]?.series || !response.structure?.dimensions) {
    return parsedData;
  }

  const seriesList = response.structure.dimensions.series;
  const currencyIdx = seriesList.findIndex(d => d.id === 'CURRENCY');
  const timeValues = response.structure.dimensions.observation?.find(d => d.id === 'TIME_PERIOD')?.values || [];

  if (currencyIdx === -1 || timeValues.length === 0) {
    return parsedData;
  }

  for (const [seriesKey, seriesData] of Object.entries(response.dataSets[0].series)) {
    const parts = seriesKey.split(':');
    const currencyVal = seriesList[currencyIdx].values[parseInt(parts[currencyIdx])];
    if (!currencyVal) continue;
    const currencyCode = currencyVal.id; // e.g. "USD", "GBP", "CHF", "JPY"

    const points: DataPoint[] = [];
    for (const [timeIdxStr, obsValueArr] of Object.entries(seriesData.observations)) {
      const timeIdx = parseInt(timeIdxStr);
      const dateStr = timeValues[timeIdx]?.id; // Format is YYYY-MM
      const rawVal = obsValueArr[0];

      if (dateStr && rawVal !== null && rawVal !== undefined) {
        const val = typeof rawVal === 'string' ? parseFloat(rawVal) : (rawVal as number);
        if (!isNaN(val)) {
          const standardDateStr = dateStr.includes('-') && dateStr.split('-').length === 2
            ? `${dateStr}-01`
            : dateStr;
          points.push({ date: standardDateStr, value: val });
        }
      }
    }

    points.sort((a, b) => a.date.localeCompare(b.date));
    parsedData[currencyCode] = points;
  }

  return parsedData;
}

/**
 * Fetches quarterly government deficit/surplus (% of GDP) from Eurostat.
 */
export async function fetchDeficit(): Promise<Record<string, DataPoint[]>> {
  const eurostatCountries = EUROZONE_COUNTRIES.map(c => c === 'GR' ? 'EL' : c);
  const queryCountries = [...eurostatCountries, 'EA20', 'EA21', 'EA'];
  const geoQuery = queryCountries.map(c => `geo=${c}`).join('&');
  const url = `${EUROSTAT_BASE_URL}/gov_10q_ggnfa?format=JSON&lang=EN&${geoQuery}&na_item=B9&sector=S13&unit=PC_GDP&s_adj=SCA`;
  try {
    console.log('Fetching government deficit/surplus from Eurostat...');
    const response = await ofetch<EurostatResponse>(url, {
      retry: 2,
      retryDelay: 1000,
    });
    return parseEurostatDataset(response);
  } catch (error) {
    console.error('Failed to fetch government deficit:', error);
    throw error;
  }
}

/**
 * Fetches monthly consumer confidence indicator (balance) from Eurostat.
 */
export async function fetchConsumerConfidence(): Promise<Record<string, DataPoint[]>> {
  const eurostatCountries = EUROZONE_COUNTRIES.map(c => c === 'GR' ? 'EL' : c);
  const queryCountries = [...eurostatCountries, 'EA20', 'EA21', 'EA'];
  const geoQuery = queryCountries.map(c => `geo=${c}`).join('&');
  const url = `${EUROSTAT_BASE_URL}/ei_bsco_m?format=JSON&lang=EN&${geoQuery}&indic=BS-CSMCI&s_adj=SA&unit=BAL`;
  try {
    console.log('Fetching consumer confidence from Eurostat...');
    const response = await ofetch<EurostatResponse>(url, {
      retry: 2,
      retryDelay: 1000,
    });
    return parseEurostatDataset(response);
  } catch (error) {
    console.error('Failed to fetch consumer confidence:', error);
    throw error;
  }
}

/**
 * Fetches monthly retail sales volume index (% change YoY) from Eurostat.
 */
export async function fetchRetailSales(): Promise<Record<string, DataPoint[]>> {
  const eurostatCountries = EUROZONE_COUNTRIES.map(c => c === 'GR' ? 'EL' : c);
  const queryCountries = [...eurostatCountries, 'EA20', 'EA21', 'EA'];
  const geoQuery = queryCountries.map(c => `geo=${c}`).join('&');
  const url = `${EUROSTAT_BASE_URL}/sts_trtu_m?format=JSON&lang=EN&${geoQuery}&unit=PCH_SM&s_adj=CA&indic_bt=VOL_SLS&nace_r2=G47`;
  try {
    console.log('Fetching retail sales growth from Eurostat...');
    const response = await ofetch<EurostatResponse>(url, {
      retry: 2,
      retryDelay: 1000,
    });
    return parseEurostatDataset(response);
  } catch (error) {
    console.error('Failed to fetch retail sales:', error);
    throw error;
  }
}

/**
 * Fetches quarterly household saving rate (%) from Eurostat.
 */
export async function fetchSavingRate(): Promise<Record<string, DataPoint[]>> {
  const eurostatCountries = EUROZONE_COUNTRIES.map(c => c === 'GR' ? 'EL' : c);
  const queryCountries = [...eurostatCountries, 'EA20', 'EA21', 'EA'];
  const geoQuery = queryCountries.map(c => `geo=${c}`).join('&');
  const url = `${EUROSTAT_BASE_URL}/nasq_10_ki?format=JSON&lang=EN&${geoQuery}&na_item=SRG_S14_S15&sector=S14_S15&unit=PC&s_adj=SCA`;
  try {
    console.log('Fetching household saving rates from Eurostat...');
    const response = await ofetch<EurostatResponse>(url, {
      retry: 2,
      retryDelay: 1000,
    });
    return parseEurostatDataset(response);
  } catch (error) {
    console.error('Failed to fetch household saving rate:', error);
    throw error;
  }
}
