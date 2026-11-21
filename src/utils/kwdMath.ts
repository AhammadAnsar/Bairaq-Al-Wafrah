import {
  ComputedLedgerRow,
  ComputedStatementSummary,
  SubContractCompany,
  WorkerBreakdownItem,
} from '../types/billing';

const MONTH_NAMES_FULL = [
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December',
];

const MONTH_NAMES_SHORT = [
  'Jan',
  'Feb',
  'Mar',
  'Apr',
  'May',
  'Jun',
  'Jul',
  'Aug',
  'Sep',
  'Oct',
  'Nov',
  'Dec',
];

/**
 * Returns today's date in YYYY-MM-DD format for HTML5 calendar date inputs.
 */
export function getTodayIsoDate(): string {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/**
 * Converts an ISO date string (YYYY-MM-DD) to standard Invoice Date display (e.g. "09-Nov-2026")
 * and Statement Date display (e.g. "09 November 2026").
 */
export function formatIsoDateForInvoice(isoDate: string): {
  shortDate: string;
  longDate: string;
  year: number;
  monthIndex0: number;
  day: number;
} {
  const parts = isoDate.split('-').map((p) => Number.parseInt(p, 10));
  if (parts.length !== 3 || parts.some((n) => Number.isNaN(n))) {
    const fallback = new Date();
    const d = String(fallback.getDate()).padStart(2, '0');
    const m0 = fallback.getMonth();
    const y = fallback.getFullYear();
    return {
      shortDate: `${d}-${MONTH_NAMES_SHORT[m0]}-${y}`,
      longDate: `${d} ${MONTH_NAMES_FULL[m0]} ${y}`,
      year: y,
      monthIndex0: m0,
      day: fallback.getDate(),
    };
  }

  const [year, month1, day] = parts;
  const m0 = Math.max(0, Math.min(11, month1 - 1));
  const dd = String(day).padStart(2, '0');
  return {
    shortDate: `${dd}-${MONTH_NAMES_SHORT[m0]}-${year}`,
    longDate: `${dd} ${MONTH_NAMES_FULL[m0]} ${year}`,
    year,
    monthIndex0: m0,
    day,
  };
}

/**
 * Given an ISO date (YYYY-MM-DD), calculates the PREVIOUS calendar month
 * for the "Billing Month (For Invoice Text)" field and the Statement Month Code "[No of Month]-[MMM]".
 * Example: Selecting 2026-11-09 -> Billing Month: "October 2026", Statement Month Code: "10-Oct"
 * Example: Selecting 2026-12-05 -> Billing Month: "November 2026", Statement Month Code: "11-Nov"
 */
export function computeBillingMonthAndCodeFromIsoDate(isoDate: string): {
  billingMonthFull: string;
  statementMonthCode: string;
  description: string;
} {
  const { year, monthIndex0 } = formatIsoDateForInvoice(isoDate);
  let prevMonth0 = monthIndex0 - 1;
  let prevYear = year;
  if (prevMonth0 < 0) {
    prevMonth0 = 11;
    prevYear = year - 1;
  }

  const monthNo1 = prevMonth0 + 1; // 1..12
  const monthFull = MONTH_NAMES_FULL[prevMonth0];
  const monthShort = MONTH_NAMES_SHORT[prevMonth0];

  const billingMonthFull = `${monthFull} ${prevYear}`;
  const statementMonthCode = `${monthNo1}-${monthShort}`;
  const description = `Charges for Manpower Supplied for the month of ${monthFull} - ${prevYear}`;

  return {
    billingMonthFull,
    statementMonthCode,
    description,
  };
}

/**
 * Parses any user-typed Billing Month string (e.g. "November 2026" or "Oct 2026")
 * and returns the matching Statement Month Code "[No of Month]-[Month First 3 letter]" (e.g. "11-Nov" or "10-Oct").
 */
export function deriveStatementMonthCodeFromBillingMonth(
  billingMonthText: string,
  fallbackCode = '11-Nov'
): string {
  const lower = billingMonthText.toLowerCase();
  for (let i = 0; i < 12; i++) {
    const fullLower = MONTH_NAMES_FULL[i].toLowerCase();
    const shortLower = MONTH_NAMES_SHORT[i].toLowerCase();
    if (lower.includes(fullLower) || lower.includes(shortLower)) {
      return `${i + 1}-${MONTH_NAMES_SHORT[i]}`;
    }
  }
  return fallbackCode;
}

/**
 * Generates Invoice Number using the formula: [Company Shortcode][YYMMXXX]
 * Example: Company "GMK", Date "2026-11-09", Sequence 13 -> "GMK2611013"
 */
export function generateInvoiceNumberCode(
  companyShortcode: string,
  isoDate: string,
  seqNumber: number
): string {
  const { year, monthIndex0 } = formatIsoDateForInvoice(isoDate);
  const yy = String(year).slice(-2);
  const mm = String(monthIndex0 + 1).padStart(2, '0');
  const xxx = String(Math.max(1, seqNumber)).padStart(3, '0');
  const cleanCode = (companyShortcode || 'INV').trim().toUpperCase();
  return `${cleanCode}${yy}${mm}${xxx}`;
}

/**
 * Converts a KWD string or number (e.g. "18986.000" or 18986) into integer Fils (x1000).
 */
export function parseKwdToFils(input: string | number | null | undefined): number {
  if (input === null || input === undefined || input === '') return 0;
  const cleaned = String(input).replace(/[^0-9.-]/g, '');
  const parsed = Number.parseFloat(cleaned);
  if (Number.isNaN(parsed)) return 0;
  return Math.round(parsed * 1000);
}

/**
 * Formats integer Fils into strict 3-decimal KWD string (e.g. "18986.000").
 */
export function formatFilsToKwd(fils: number | null | undefined, includeCommas = false): string {
  if (fils === null || fils === undefined) return '';
  const isNegative = fils < 0;
  const absFils = Math.abs(Math.round(fils));
  const dinars = Math.floor(absFils / 1000);
  const remFils = absFils % 1000;
  const dinarStr = includeCommas ? dinars.toLocaleString('en-US') : String(dinars);
  const filsStr = String(remFils).padStart(3, '0');
  return `${isNegative ? '-' : ''}${dinarStr}.${filsStr}`;
}

/**
 * Calculates total Fils from an array of worker breakdown items.
 */
export function calculateBreakdownTotalFils(items: WorkerBreakdownItem[] = []): number {
  return items.reduce((sum, item) => {
    const lineFils = Math.round(item.headcount * item.daysOrUnits * item.rateFils);
    return sum + lineFils;
  }, 0);
}

/**
 * Computes the complete Statement of Accounts with automatic cumulative balance
 * and multi-row partial payment reconciliation.
 */
export function computeStatementLedger(company: SubContractCompany): ComputedStatementSummary {
  let calculatedTotalInvoicedFils = 0;
  let totalReceivedFils = 0;
  let runningPoolUnpaidFils = 0;

  const rows: ComputedLedgerRow[] = company.ledger.map((entry, idx) => {
    const invFils = entry.invoiceAmountFils || 0;
    const recFils = entry.receivedAmountFils ?? 0;
    const hasReceivedValue =
      entry.receivedAmountFils !== null &&
      entry.receivedAmountFils !== undefined &&
      entry.receivedAmountFils > 0;

    calculatedTotalInvoicedFils += invFils;
    totalReceivedFils += recFils;

    const rowNetDeltaFils = invFils - recFils;
    runningPoolUnpaidFils += rowNetDeltaFils;

    let status: 'paid' | 'partial' | 'unpaid' = 'unpaid';
    if (hasReceivedValue) {
      if (recFils >= invFils || runningPoolUnpaidFils <= 0) {
        status = 'paid';
      } else {
        status = 'partial';
      }
    } else {
      const nextEntry = company.ledger[idx + 1];
      if (
        nextEntry &&
        nextEntry.receivedAmountFils &&
        nextEntry.receivedAmountFils > nextEntry.invoiceAmountFils
      ) {
        status = 'partial';
      } else {
        status = 'unpaid';
      }
    }

    let displayBalanceFils: number | null = null;
    if (entry.manualBalanceFils !== undefined && entry.manualBalanceFils !== null) {
      displayBalanceFils = entry.manualBalanceFils > 0 ? entry.manualBalanceFils : null;
    } else if (hasReceivedValue && recFils !== invFils && runningPoolUnpaidFils > 0) {
      displayBalanceFils = runningPoolUnpaidFils;
    }

    return {
      entry,
      rowNetDeltaFils,
      cumulativeUnpaidFils: Math.max(0, runningPoolUnpaidFils),
      displayBalanceFils,
      status,
    };
  });

  const unpaidAndResidualFils = rows.reduce((acc, r, index) => {
    if (r.displayBalanceFils !== null && r.displayBalanceFils > 0) {
      return acc + r.displayBalanceFils;
    }
    const hasRec =
      r.entry.receivedAmountFils !== null &&
      r.entry.receivedAmountFils !== undefined &&
      r.entry.receivedAmountFils > 0;
    const nextRow = rows[index + 1];
    const absorbedByNext =
      nextRow &&
      nextRow.entry.receivedAmountFils !== null &&
      nextRow.entry.receivedAmountFils > nextRow.entry.invoiceAmountFils;
    if (!hasRec && !absorbedByNext) {
      return acc + r.entry.invoiceAmountFils;
    }
    return acc;
  }, 0);

  const displayTotalInvoicedFils =
    company.customTotalInvoicedFils !== undefined && company.customTotalInvoicedFils !== null
      ? company.customTotalInvoicedFils
      : calculatedTotalInvoicedFils;

  return {
    rows,
    calculatedTotalInvoicedFils,
    displayTotalInvoicedFils,
    totalReceivedFils,
    netOutstandingBalanceFils: unpaidAndResidualFils,
  };
}
