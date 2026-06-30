export type Maturity = '3M' | '6M' | '1Y' | '2Y' | '5Y' | '10Y' | '30Y';

export type ActiveTab = 'rates' | 'macro' | 'monetary' | 'stability' | 'activity' | 'structure';

export type RateCategory = 
  | 'sovereign' 
  | 'mortgage' 
  | 'corporate' 
  | 'deposit' 
  | 'debt_gdp'
  | 'inflation'
  | 'unemployment'
  | 'gdp'
  | 'policy_rate'
  | 'exchange_rate'
  | 'deficit'
  | 'consumer_conf'
  | 'retail_sales'
  | 'saving_rate'
  | 'structure';

export type BondType = 'sovereign' | 'short_term' | 'long_term';

export type IssuerType = 'all' | 'aaa';

export type TimeRange = '6M' | '1Y' | '5Y' | '10Y' | 'MAX';

export interface Country {
  code: string;
  name: string;
  color: string;
  defaultSelected: boolean;
}

export interface DataPoint {
  date: string; // YYYY-MM-DD or YYYY-MM
  value: number;
}

export interface BondSeries {
  countryCode: string;
  maturity: Maturity;
  issuerType: IssuerType;
  points: DataPoint[];
}
