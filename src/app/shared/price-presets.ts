export interface PricePreset {
  label: string;
  value: number;
}

export const PRICE_PRESETS: PricePreset[] = [
  { label: 'Hatchback ~₹7L', value: 700000 },
  { label: 'Compact SUV ~₹12L', value: 1200000 },
  { label: 'Sedan ~₹15L', value: 1500000 },
  { label: 'EV ~₹18L', value: 1800000 },
  { label: 'Midsize SUV ~₹20L', value: 2000000 },
  { label: 'Premium/Luxury ~₹40L', value: 4000000 },
];
