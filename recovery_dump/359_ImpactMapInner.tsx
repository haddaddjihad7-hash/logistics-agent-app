  const defaultGlobalCenter: [number, number] = [22, 15];
  const activeCoords = currentAlert ? (currentAlert.coordinates || resolveCoordinates(currentAlert.location)) : null;
  const currentCenter = activeCoords || defaultGlobalCenter;