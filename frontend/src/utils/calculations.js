/**
 * Portfolio Tracker Financial Calculations Utility
 */

// Newton-Raphson solver for XIRR
// cashFlows: array of { date: Date, amount: number }
// cashFlows should contain negative numbers for cash outflows (buys, deposits)
// and positive numbers for cash inflows (sells, dividends, current portfolio value at end date)
export function calculateXIRR(cashFlows, guess = 0.1) {
  if (cashFlows.length < 2) return 0;

  // Sort cash flows by date
  const sortedFlows = [...cashFlows].sort((a, b) => a.date - b.date);
  
  const minDate = sortedFlows[0].date;
  const maxDate = sortedFlows[sortedFlows.length - 1].date;
  const totalYears = (maxDate - minDate) / (365 * 24 * 60 * 60 * 1000);
  
  // If the cash flows span less than 30 days, annualizing return is unstable.
  // Fall back to simple rate of return immediately to avoid insane XIRR calculations.
  if (totalYears < 0.083) {
    return Math.max(-0.9999, Math.min(10.0, calculateSimpleCAGR(cashFlows)));
  }

  // Calculate years from start date for each flow
  const flowsWithYears = sortedFlows.map(flow => ({
    amount: flow.amount,
    years: (flow.date - minDate) / (365 * 24 * 60 * 60 * 1000)
  }));

  // Equation: f(r) = sum( C_i / (1 + r)^t_i ) = 0
  const f = (r) => {
    return flowsWithYears.reduce((sum, flow) => {
      if (1 + r <= 0) return sum;
      return sum + flow.amount / Math.pow(1 + r, flow.years);
    }, 0);
  };

  // Derivative: f'(r) = sum( -t_i * C_i / (1 + r)^(t_i + 1) )
  const df = (r) => {
    return flowsWithYears.reduce((sum, flow) => {
      if (1 + r <= 0) return sum;
      return sum - (flow.years * flow.amount) / Math.pow(1 + r, flow.years + 1);
    }, 0);
  };

  let r = guess;
  const maxIterations = 100;
  const precision = 1e-6;

  for (let i = 0; i < maxIterations; i++) {
    const fr = f(r);
    const dfr = df(r);
    
    if (Math.abs(dfr) < 1e-12) {
      break; // Avoid division by zero
    }
    
    const nextR = r - fr / dfr;
    
    // Break early if solver is diverging to extreme rates
    if (isNaN(nextR) || !isFinite(nextR) || Math.abs(nextR) > 100.0) {
      break; 
    }
    
    if (Math.abs(nextR - r) < precision) {
      return Math.max(-0.9999, Math.min(10.0, nextR)); // Success
    }
    
    r = nextR;
  }

  // Fallback to simple rate of return if Newton-Raphson fails to converge
  const fallback = calculateSimpleCAGR(cashFlows);
  return Math.max(-0.9999, Math.min(10.0, fallback));
}

function calculateSimpleCAGR(cashFlows) {
  const sortedFlows = [...cashFlows].sort((a, b) => a.date - b.date);
  const totalInvested = sortedFlows
    .filter(f => f.amount < 0)
    .reduce((sum, f) => sum - f.amount, 0);
  
  const totalReceived = sortedFlows
    .filter(f => f.amount > 0)
    .reduce((sum, f) => sum + f.amount, 0);
    
  if (totalInvested <= 0) return 0;
  
  const totalReturn = (totalReceived - totalInvested) / totalInvested;
  const years = (sortedFlows[sortedFlows.length - 1].date - sortedFlows[0].date) / (365 * 24 * 60 * 60 * 1000);
  
  if (years <= 0) return totalReturn;
  
  // Don't compound if years is less than 30 days to prevent astronomical CAGR values
  if (years < 0.083) {
    return totalReturn;
  }
  
  if (1 + totalReturn <= 0) {
    return -0.9999;
  }
  
  try {
    const rawCagr = Math.pow(1 + totalReturn, 1 / years) - 1;
    if (isNaN(rawCagr) || !isFinite(rawCagr)) {
      return totalReturn;
    }
    return Math.max(-0.9999, Math.min(10.0, rawCagr)); // Clamp to [-99.99%, 1000%]
  } catch (e) {
    return totalReturn;
  }
}

// Calculate standard deviation of returns
export function calculateStandardDeviation(values) {
  if (values.length < 2) return 0;
  const mean = values.reduce((sum, v) => sum + v, 0) / values.length;
  const variance = values.reduce((sum, v) => sum + Math.pow(v - mean, 2), 0) / (values.length - 1);
  return Math.sqrt(variance);
}

// Sharpe Ratio
// returns: array of periodic returns (e.g., monthly returns)
// riskFreeRate: annual risk-free rate (e.g., 0.04 for 4%)
export function calculateSharpeRatio(periodicReturns, riskFreeRate = 0.04, periodPerYear = 12) {
  if (periodicReturns.length < 2) return 0;
  
  const meanReturn = periodicReturns.reduce((sum, r) => sum + r, 0) / periodicReturns.length;
  const stdDev = calculateStandardDeviation(periodicReturns);
  
  if (stdDev === 0) return 0;
  
  // Annualize mean return and standard deviation
  const annualizedReturn = Math.pow(1 + meanReturn, periodPerYear) - 1;
  const annualizedStdDev = stdDev * Math.sqrt(periodPerYear);
  
  return (annualizedReturn - riskFreeRate) / annualizedStdDev;
}

// Sortino Ratio
// Like Sharpe, but only penalises downside volatility (returns below MAR).
// periodicReturns: array of periodic returns
// mar: Minimum Acceptable Return per period (default 0 — don't lose money)
// riskFreeRate: annual risk-free rate for excess return calculation
export function calculateSortinoRatio(periodicReturns, mar = 0, riskFreeRate = 0.04, periodPerYear = 12) {
  if (periodicReturns.length < 2) return 0;

  // Downside deviation: RMS of returns below MAR only
  const downsideReturns = periodicReturns.filter(r => r < mar);
  if (downsideReturns.length === 0) return Infinity; // No downside periods — perfect score

  const downsideMeanSq = downsideReturns.reduce((sum, r) => sum + Math.pow(r - mar, 2), 0) / periodicReturns.length;
  const periodicDownsideDev = Math.sqrt(downsideMeanSq);
  const annualizedDownsideDev = periodicDownsideDev * Math.sqrt(periodPerYear);

  if (annualizedDownsideDev === 0) return 0;

  const meanReturn = periodicReturns.reduce((sum, r) => sum + r, 0) / periodicReturns.length;
  const annualizedReturn = Math.pow(1 + meanReturn, periodPerYear) - 1;

  return (annualizedReturn - riskFreeRate) / annualizedDownsideDev;
}

// Alpha (Portfolio Return vs Benchmark Return)
// portfolioReturn: annualized portfolio return (e.g. XIRR)
// benchmarkReturn: annualized benchmark return
// beta: portfolio beta (systematic risk, default to 1.0 for simplicity or calculated)
// riskFreeRate: risk-free rate
export function calculateAlpha(portfolioReturn, benchmarkReturn, beta = 1.0, riskFreeRate = 0.04) {
  // CAPM Alpha = Portfolio Return - [RiskFree + Beta * (Benchmark Return - RiskFree)]
  const expectedReturn = riskFreeRate + beta * (benchmarkReturn - riskFreeRate);
  return portfolioReturn - expectedReturn;
}
