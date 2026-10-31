/** "$1,588" / "$1,588.50". Done by hand so it behaves the same on every JS engine. */
export function formatUsd(amount: number): string {
  const fixed = amount.toFixed(2);
  const [whole = "0", cents = "00"] = fixed.split(".");
  const withCommas = whole.replace(/\B(?=(\d{3})+(?!\d))/g, ",");
  return `$${withCommas}${cents === "00" ? "" : `.${cents}`}`;
}

export function capitalize(s: string): string {
  return s ? s.charAt(0).toUpperCase() + s.slice(1) : s;
}
