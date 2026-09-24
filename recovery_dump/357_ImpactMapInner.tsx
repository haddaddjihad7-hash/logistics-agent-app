export interface MapAlertItem {
  location: string;
  disruption_type: string;
  severity_level: string;
  estimated_delay_hours: number | null;
  cost_impact_usd?: number;
  coordinates?: [number, number];
}

interface ImpactMapInnerProps {
  currentAlert: MapAlertItem | null;
  history?: MapAlertItem[];
}