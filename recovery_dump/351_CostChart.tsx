const formatCurrency = (val: number) => {
  if (!val || isNaN(val) || val === 0) return "$0";
  if (val >= 1_000_000) {
    return `$${(val / 1_000_000).toFixed(1)}M`;
  }
  if (val >= 1_000) {
    return `$${(val / 1_000).toFixed(0)}k`;
  }
  return `$${val.toLocaleString()}`;
};