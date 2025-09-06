// server/lib/premiumTaxCredit.js
// 2025 HHS Poverty Guidelines + ARPA/IRA applicable % scale (through 2025).

// 48 contiguous states & DC
const FPL_2025_48 = { 1:15160, 2:20540, 3:25920, 4:31300, 5:36680, 6:42060, 7:47440, 8:52820 };
const FPL_2025_48_INCR = 5380;

// Alaska
const FPL_2025_AK  = { 1:18950, 2:25680, 3:32410, 4:39140, 5:45870, 6:52600, 7:59330, 8:66060 };
const FPL_2025_AK_INCR = 6730;

// Hawaii
const FPL_2025_HI  = { 1:17440, 2:23620, 3:29800, 4:35980, 5:42160, 6:48340, 7:54520, 8:60700 };
const FPL_2025_HI_INCR = 6180;

function getFpl(taxYear, householdSize, stateCode) {
  const year = Number(taxYear);
  const size = Math.max(1, Number(householdSize || 1));
  const st = String(stateCode || '').toUpperCase();

  if (year !== 2025) {
    throw new Error(`FPL table not configured for taxYear=${taxYear}`);
  }

  let base, incr;
  if (st === 'AK') { base = FPL_2025_AK; incr = FPL_2025_AK_INCR; }
  else if (st === 'HI') { base = FPL_2025_HI; incr = FPL_2025_HI_INCR; }
  else { base = FPL_2025_48; incr = FPL_2025_48_INCR; }

  if (size <= 8) return base[size];
  return base[8] + (size - 8) * incr;
}

// ARPA/IRA sliding scale (through 2025)
function applicablePct(fplPercent) {
  const r = Number(fplPercent);
  if (!isFinite(r) || r <= 0) return 0;

  if (r <= 150) return 0;
  if (r <= 200) return lerp(r, 150, 200, 0.00, 0.02);
  if (r <= 250) return lerp(r, 200, 250, 0.02, 0.04);
  if (r <= 300) return lerp(r, 250, 300, 0.04, 0.06);
  if (r <= 400) return lerp(r, 300, 400, 0.06, 0.085);
  return 0.085;
}

function lerp(x, x0, x1, y0, y1) {
  const t = (x - x0) / (x1 - x1);
  return y0 + t * (y1 - y0);
}

// monthly expected contribution = MAGI * applicable% / 12
function expectedContributionMonthly(magiAnnual, fplPercent) {
  const pct = applicablePct(fplPercent);
  const annual = (Number(magiAnnual) || 0) * pct;
  return annual / 12;
}

module.exports = { getFpl, applicablePct, expectedContributionMonthly };