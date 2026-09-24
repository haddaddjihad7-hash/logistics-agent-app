  // Prepare map and chart data
  const mapAlertItem: MapAlertItem | null = result
    ? {
        location: result.diagnosis?.location || result.logistics?.location || "Seattle Port Logistics Facility",
        disruption_type: result.diagnosis?.issue_identified || "Hydraulic Cavitation Disruption",
        severity_level: result.diagnosis?.severity || "CRITICAL",
        estimated_delay_hours: result.diagnosis?.estimated_delay_hours ?? 24,
        cost_impact_usd: result.diagnosis?.cost_impact_usd ?? 64000,
        coordinates: (result.diagnosis?.coordinates as [number, number] | undefined) || (result.logistics?.coordinates as [number, number] | undefined),
      }
    : null;