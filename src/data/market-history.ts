/**
 * Annual US market history, 1928–2025 (98 calendar years).
 *
 * Columns: [year, S&P 500 total return %, 3-month T-Bill %, 10-year T-Bond total return %, CPI inflation %]
 *
 * Sources:
 *  - Stocks / bills / bonds: Aswath Damodaran, NYU Stern, "Historical Returns on
 *    Stocks, Bonds and Bills: 1928–Current".
 *    https://pages.stern.nyu.edu/adamodar/New_Home_Page/datafile/histretSP.html
 *  - CPI (Dec–Dec): US BLS, via us500.com annual returns table.
 *
 * Stock returns include dividends. Bond returns include coupon + price change on
 * the constant-maturity 10-year Treasury.
 */
export type MarketYear = [year: number, stocks: number, bills: number, bonds: number, cpi: number];

export const MARKET_HISTORY: MarketYear[] = [
  [1928, 43.81, 3.08, 0.84, -1.16],
  [1929, -8.3, 3.16, 4.2, 0.58],
  [1930, -25.12, 4.55, 4.54, -6.4],
  [1931, -43.84, 2.31, -2.56, -9.32],
  [1932, -8.64, 1.07, 8.79, -10.27],
  [1933, 49.98, 0.96, 1.86, 0.76],
  [1934, -1.19, 0.28, 7.96, 1.52],
  [1935, 46.74, 0.17, 4.47, 2.99],
  [1936, 31.94, 0.17, 5.02, 1.45],
  [1937, -35.34, 0.28, 1.38, 2.86],
  [1938, 29.28, 0.07, 4.21, -2.78],
  [1939, -1.1, 0.05, 4.41, 0.0],
  [1940, -10.67, 0.04, 5.4, 0.71],
  [1941, -12.77, 0.13, -2.02, 9.93],
  [1942, 19.17, 0.34, 2.29, 9.03],
  [1943, 25.06, 0.38, 2.49, 2.96],
  [1944, 19.03, 0.38, 2.58, 2.3],
  [1945, 35.82, 0.38, 3.8, 2.25],
  [1946, -8.43, 0.38, 3.13, 18.13],
  [1947, 5.2, 0.6, 0.92, 8.84],
  [1948, 5.7, 1.05, 1.95, 2.99],
  [1949, 18.3, 1.12, 4.66, -2.07],
  [1950, 30.81, 1.2, 0.43, 5.93],
  [1951, 23.68, 1.52, -0.3, 6.0],
  [1952, 18.15, 1.72, 2.27, 0.75],
  [1953, -1.21, 1.89, 4.14, 0.75],
  [1954, 52.56, 0.94, 3.29, -0.74],
  [1955, 32.6, 1.72, -1.34, 0.37],
  [1956, 7.44, 2.62, -2.26, 2.99],
  [1957, -10.46, 3.22, 6.8, 2.9],
  [1958, 43.72, 1.77, -2.1, 1.76],
  [1959, 12.06, 3.39, -2.65, 1.73],
  [1960, 0.34, 2.87, 11.64, 1.36],
  [1961, 26.64, 2.35, 2.06, 0.67],
  [1962, -8.81, 2.77, 5.69, 1.33],
  [1963, 22.61, 3.16, 1.68, 1.64],
  [1964, 16.42, 3.55, 3.73, 0.97],
  [1965, 12.4, 3.95, 0.72, 1.92],
  [1966, -9.97, 4.86, 2.91, 3.46],
  [1967, 23.8, 4.29, -1.58, 3.04],
  [1968, 10.81, 5.34, 3.27, 4.72],
  [1969, -8.24, 6.67, -5.01, 6.2],
  [1970, 3.56, 6.39, 16.75, 5.57],
  [1971, 14.22, 4.33, 9.79, 3.27],
  [1972, 18.76, 4.06, 2.82, 3.41],
  [1973, -14.31, 7.04, 3.66, 8.71],
  [1974, -25.9, 7.85, 1.99, 12.34],
  [1975, 37.0, 5.79, 3.61, 6.94],
  [1976, 23.83, 4.98, 15.98, 4.86],
  [1977, -6.98, 5.26, 1.29, 6.7],
  [1978, 6.51, 7.18, -0.78, 9.02],
  [1979, 18.52, 10.05, 0.67, 13.29],
  [1980, 31.74, 11.39, -2.99, 12.52],
  [1981, -4.7, 14.04, 8.2, 8.92],
  [1982, 20.42, 11.09, 32.81, 3.83],
  [1983, 22.34, 8.95, 3.2, 3.79],
  [1984, 6.15, 9.92, 13.73, 3.95],
  [1985, 31.24, 7.72, 25.71, 3.8],
  [1986, 18.49, 6.15, 24.28, 1.1],
  [1987, 5.81, 5.96, -4.96, 4.43],
  [1988, 16.54, 6.89, 8.22, 4.42],
  [1989, 31.48, 8.39, 17.69, 4.65],
  [1990, -3.06, 7.75, 6.24, 6.11],
  [1991, 30.23, 5.54, 15.0, 3.06],
  [1992, 7.49, 3.51, 9.36, 2.9],
  [1993, 9.97, 3.07, 14.21, 2.75],
  [1994, 1.33, 4.37, -8.04, 2.67],
  [1995, 37.2, 5.66, 23.48, 2.54],
  [1996, 22.68, 5.15, 1.43, 3.32],
  [1997, 33.1, 5.2, 9.94, 1.7],
  [1998, 28.34, 4.91, 14.92, 1.61],
  [1999, 20.89, 4.78, -8.25, 2.68],
  [2000, -9.03, 6.0, 16.66, 3.39],
  [2001, -11.85, 3.48, 5.57, 1.55],
  [2002, -21.97, 1.64, 15.12, 2.38],
  [2003, 28.36, 1.03, 0.38, 1.88],
  [2004, 10.74, 1.4, 4.49, 3.26],
  [2005, 4.83, 3.22, 2.87, 3.42],
  [2006, 15.61, 4.85, 1.96, 2.54],
  [2007, 5.48, 4.48, 10.21, 4.06],
  [2008, -36.55, 1.4, 20.1, 0.11],
  [2009, 25.94, 0.15, -11.12, 2.72],
  [2010, 14.82, 0.14, 8.46, 1.5],
  [2011, 2.1, 0.05, 16.04, 2.96],
  [2012, 15.89, 0.09, 2.97, 1.74],
  [2013, 32.15, 0.06, -9.1, 1.5],
  [2014, 13.52, 0.03, 10.75, 0.76],
  [2015, 1.38, 0.05, 1.28, 0.73],
  [2016, 11.77, 0.32, 0.69, 2.07],
  [2017, 21.61, 0.95, 2.8, 2.11],
  [2018, -4.23, 1.97, -0.02, 1.91],
  [2019, 31.21, 2.11, 9.64, 2.29],
  [2020, 18.02, 0.36, 11.33, 1.36],
  [2021, 28.47, 0.04, -4.42, 7.04],
  [2022, -18.04, 2.09, -17.83, 6.45],
  [2023, 26.06, 5.28, 3.88, 3.35],
  [2024, 24.88, 5.18, -1.64, 2.89],
  [2025, 17.78, 4.21, 7.8, 2.68],
];

export const FIRST_YEAR = MARKET_HISTORY[0][0];
export const LAST_YEAR = MARKET_HISTORY[MARKET_HISTORY.length - 1][0];

/** Deflate a nominal return to real using the same year's CPI. */
const real = (nominal: number, cpi: number) => (1 + nominal / 100) / (1 + cpi / 100) - 1;

export interface RealYear {
  year: number;
  stocks: number;
  bonds: number;
  bills: number;
  cpi: number;
}

/** Inflation-adjusted annual returns as decimals. This is what every simulation consumes. */
export const REAL_HISTORY: RealYear[] = MARKET_HISTORY.map(([year, s, t, b, i]) => ({
  year,
  stocks: real(s, i),
  bills: real(t, i),
  bonds: real(b, i),
  cpi: i / 100,
}));

/** Compound annual growth rate of a series of decimal returns. */
export function cagr(returns: number[]): number {
  if (!returns.length) return 0;
  const growth = returns.reduce((acc, r) => acc * (1 + r), 1);
  return Math.pow(growth, 1 / returns.length) - 1;
}

export function stdev(returns: number[]): number {
  if (returns.length < 2) return 0;
  const mean = returns.reduce((a, b) => a + b, 0) / returns.length;
  const variance = returns.reduce((a, r) => a + (r - mean) ** 2, 0) / (returns.length - 1);
  return Math.sqrt(variance);
}

/** Long-run real statistics, computed from the data rather than hardcoded. */
export const REAL_STATS = {
  stocks: {
    cagr: cagr(REAL_HISTORY.map((y) => y.stocks)),
    stdev: stdev(REAL_HISTORY.map((y) => y.stocks)),
  },
  bonds: {
    cagr: cagr(REAL_HISTORY.map((y) => y.bonds)),
    stdev: stdev(REAL_HISTORY.map((y) => y.bonds)),
  },
  bills: {
    cagr: cagr(REAL_HISTORY.map((y) => y.bills)),
    stdev: stdev(REAL_HISTORY.map((y) => y.bills)),
  },
  inflation: cagr(REAL_HISTORY.map((y) => y.cpi)),
};

/**
 * Shiller CAPE for the S&P 500, July 2026. Drives the valuation-aware
 * withdrawal rate (CAPE-based rule) and the starting-return haircut.
 * Source: GuruFocus / multpl.com, July 2026.
 */
export const CURRENT_CAPE = 41.34;
export const CAPE_LONG_RUN_MEDIAN = 16.0;
