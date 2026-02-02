
export type Language = 'en' | 'hi' | 'te' | 'ta' | 'kn' | 'ml' | 'mr' | 'bn' | 'gu' | 'pa' | 'or' | 'ur';

export type ApplianceCategory = 'lighting' | 'cooling' | 'heating' | 'electronics' | 'motor';
export type EnergyMode = 'standard' | 'bee_annual' | 'iseer' | 'eer';
export type ACType = 'inverter' | 'non_inverter' | null;
export type Season = 'summer' | 'winter' | 'monsoon';
export type SubsidyType = 'none' | 'government' | 'company';
export type InsightFrequency = 'daily' | 'weekly' | 'monthly';

export type AppStep = 'intro' | 'language' | 'state' | 'setup' | 'appliances' | 'calendar' | 'bill' | 'optimization' | 'history' | 'profile' | 'notifications';

export interface SubsidyConfig {
  type: SubsidyType;
  limitUnits: number;
}

export interface Appliance {
  id: string;
  name: string;
  category: ApplianceCategory;
  type: string;
  watts: number;
  hoursPerDay: number;
  daysPerMonth: number;
  quantity: number;
  inputMode: EnergyMode;
  acType?: ACType;      
  annualUnits?: number; 
  capacityTon?: number; 
  iseer?: number;       
  eer?: number;         
  starRating?: number;
  icon: string;
}

/* Added missing types required by other modules */
export interface AppliancePreset {
  appliance_id: string;
  appliance_name: string;
  category: ApplianceCategory;
  supports_standard_mode: boolean;
  supports_bee_annual_mode: boolean;
  supports_iseer_mode: boolean;
  default_energy_mode: EnergyMode;
  typical_daily_usage_hours: number;
  quantity_default: number;
  is_inverter?: boolean;
  capacity_ton_options?: number[];
  default_capacity_ton?: number;
  iseer_range?: { min: number; max: number };
  default_iseer?: number;
  iseer_note?: string;
  wattage_options?: number[];
  default_wattage?: number;
  typical_annual_energy_kwh?: number;
  bee_label_note?: string;
  icon: string;
  notes: string;
}

export interface HistoricalEntry {
  id: string;
  timestamp: number;
  totalUnits: number;
  totalCost: number;
  stateName: string;
}

export interface UserData {
  profile: CloudProfile | null;
  appliances: Appliance[];
  dailyLogs: UserDailyUsage[];
}

export interface UpgradeOpportunity {
  currentApplianceId: string;
  alternativeName: string;
  alternativeWatts: number;
  annualSavingsRs: number;
  annualSavingsUnits: number;
  estimatedCost: number;
  paybackYears: number;
  isSponsored: boolean;
  affiliateUrl: string;
}

export interface SolarStats {
  suggestedKw: number;
  roofSqFt: number;
  estCost: number;
  paybackYears: number;
  savings25Years: number;
  readinessScore: number;
}

export interface NotificationSettings {
  masterEnabled: boolean;
  categories: {
    cost: boolean;
    appliances: boolean;
    insights: boolean;
    policy: boolean;
  };
  frequency: 'realtime' | 'daily' | 'weekly';
  style: 'short' | 'detailed';
  quietHours: {
    enabled: boolean;
    start?: string;
    end?: string;
  };
}

export interface DailyApplianceEntry {
  applianceId: string;
  applianceType: string;
  ratingType: EnergyMode;
  ratingValue: number;
  powerKW: number;
  usageHours: number;
  unitsConsumed: number;
  cost: number;
}

export interface UserDailyUsage {
  userId: string;
  date: string; // YYYY-MM-DD
  totalUnits: number;
  totalCost: number;
  isEstimated: boolean;
  appliances: DailyApplianceEntry[];
  // App-specific metadata
  id: string;
  createdAt: number;
  updatedAt: number;
}

export interface MonthlyUsageSummary {
  month: string; // YYYY-MM
  totalUnits: number;
  totalCost: number;
  subsidyLimit: number;
  subsidyUsed: number;
  slabCrossed: boolean;
  projectedBill: number;
  // Metadata for UI
  projectedUnits: number;
  confidenceScore: number | null;
  isStabilized: boolean;
}

export interface TariffSlab {
  min: number;
  max: number | null;
  rate: number;
}

export interface StateTariff {
  id: string;
  name: string;
  fixedCharge: number;
  slabs: TariffSlab[];
}

export interface ApplianceBreakdown {
  appliance: Appliance;
  units: number;
  cost: number;
  percentage: number;
}

export interface CalculationResult {
  id: string;
  totalUnits: number;
  solarGeneratedUnits: number;
  netUnits: number;
  subsidizedUnits: number;
  billableUnits: number;
  totalCost: number;
  energyCost: number;
  fixedCharge: number;
  applianceBreakdown: ApplianceBreakdown[];
  highestConsumer: ApplianceBreakdown | null;
  topConsumers: ApplianceBreakdown[];
  efficiencyScore: 'A' | 'B' | 'C' | 'D' | 'E';
  subsidyConfig: SubsidyConfig;
  season: Season;
  remainingSubsidyUnits: number;
  seasonalImpact: number;
  seasonalProjections: Record<Season, number>;
}

export interface SolarConfig {
  isInstalled: boolean;
  ratingKw: number;
}

export interface CloudProfile {
  uid: string;
  name: string;
  email: string;
  joinedAt: number;
  syncStatus: 'synced' | 'syncing' | 'offline';
  benchmarkPercentile?: number;
}

export interface AppNotification {
  id: string;
  type: string;
  priority: 'critical' | 'important' | 'info';
  icon: string;
  title: string;
  message: string;
  actionStep?: AppStep;
  timestamp: number;
  impact?: string;
}
