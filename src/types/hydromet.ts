export type HydrometParameterKey =
  | 'windSpeedMS'
  | 'windDirection'
  | 'airPressureMb'
  | 'solarRadiationCalCm2'
  | 'evaporationMm'
  | 'relativeHumidityPercent'
  | 'maxTemperatureC'
  | 'minTemperatureC'
  | 'avgTemperatureC';

export type HydrometValue = {
  raw: string;
  value: number | null;
  qualifier: 'measured' | 'missing';
};

export type HydrometDailyRecord = {
  id: string;
  date: string;
  year: number;
  month: number;
  day: number;
  weekday: number;
  period: string;
  windDirection: string | null;
  values: {
    windSpeedMS: HydrometValue;
    airPressureMb: HydrometValue;
    solarRadiationCalCm2: HydrometValue;
    evaporationMm: HydrometValue;
    relativeHumidityPercent: HydrometValue;
    maxTemperatureC: HydrometValue;
    minTemperatureC: HydrometValue;
    avgTemperatureC: HydrometValue;
  };
  sourceResource: string;
};

export type HydrometMonthlySummary = {
  period: string;
  year: number;
  month: number;
  dayCount: number;
  avgWindSpeedMS: number | null;
  dominantWindDirection: string | null;
  avgAirPressureMb: number | null;
  totalSolarRadiationCalCm2: number | null;
  totalEvaporationMm: number | null;
  avgRelativeHumidityPercent: number | null;
  avgMaxTemperatureC: number | null;
  avgMinTemperatureC: number | null;
  avgTemperatureC: number | null;
};

export type HydrometParameterSeriesPoint = {
  date: string;
  period: string;
  parameter: HydrometParameterKey;
  value: number | null;
};
