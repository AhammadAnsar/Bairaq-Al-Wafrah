export type PadMode = 'dynamic' | 'full_pad' | 'hybrid';

export type HeaderLayoutStyle = 'gmk_centered_emblem' | 'sb_split_badge';

export interface BankDetailItem {
  id: string;
  label: string;
  value: string;
}

export interface WorkerBreakdownItem {
  id: string;
  category: string;
  headcount: number;
  daysOrUnits: number;
  rateFils: number; // 1 KWD = 1000 Fils
}

export interface OperatorUserProfile {
  fullName: string;
  roleTitle: string;
  email: string;
  accessPassword: string;
  phone: string;
}

export interface LedgerEntry {
  id: string;
  seqNumber: number; // e.g., 1, 2, ... 12
  invoiceNo: string; // e.g., GMK2611012 or GMK04326
  invoiceDate: string; // Display format e.g., 08-Nov-2026
  invoiceDateIso?: string; // YYYY-MM-DD for calendar picker
  statementDateDisplay?: string; // e.g., 08 November 2026
  monthTag: string; // [No of Month]-[Month First 3 letter] e.g., 10-Oct, 11-Nov
  billingMonthFull: string; // e.g., October 2026
  description: string; // e.g., Charges for Manpower Supplied for the month of October - 2026
  invoiceAmountFils: number; // Stored in integer Fils (18986.000 -> 18986000)
  receivedAmountFils: number | null; // null if not yet received
  receivedDate: string; // Display format e.g., 22-Jan-2026
  receivedDateIso?: string; // YYYY-MM-DD for calendar picker
  manualBalanceFils?: number | null;
  customerId?: string; // Relational link to CustomerRecipient.id
  customerName?: string; // Customer (TO:) for this invoice, e.g., M/S. Talabat General Trading Company
  itemId?: string; // Relational link to ServiceCatalogItem.id
  workerBreakdown?: WorkerBreakdownItem[];
  notes?: string;
}

export interface CustomerRecipient {
  id: string;
  name: string; // e.g., M/S. Talabat General Trading Company
  projectTitle: string; // e.g., Delivery & Logistics Manpower Supply
  contactPerson: string;
  phoneOrEmail: string;
  address: string;
  linkedCompanyId?: string; // Optional preferred Sub-Contract Client Pad ID
}

export interface CompanyBranding {
  padMode: PadMode;
  headerStyle: HeaderLayoutStyle;
  primaryColor: string;
  tableHeaderBg: string;
  logoUrl: string;
  watermarkUrl: string;
  showWatermark: boolean;
  watermarkOpacity: number;
  stampUrl: string;
  showStamp: boolean;
  signatureUrl: string;
  showSignature: boolean;
  fullPadUrl: string;
}

export interface SubContractCompany {
  id: string;
  code: string; // Shortcode e.g., GMK, SBGTC
  nameEn: string;
  subtitleEn: string;
  nameAr: string;
  subtitleAr: string;
  emblemCaption?: string;
  clientName: string; // Default Customer (TO:): M/S. Talabat General Trading Company
  defaultCustomerId?: string; // Relational link to CustomerRecipient.id
  invoiceTitle: string;
  statementTitle: string;
  salutationLine1: string;
  salutationTemplate: string;
  bankStyle: 'colon' | 'dash';
  bankDetails: BankDetailItem[];
  closingPhrase: string;
  signatoryName: string;
  signatoryTitle: string;
  footerStyle: 'bilingual_centered' | 'split_contact_bar';
  footerAr: string;
  footerEn: string;
  footerPhones?: string[];
  footerAddressLines?: string[];
  showPageNumber: boolean;
  totalPrefixStyle: 'no_space' | 'with_space';
  customTotalInvoicedFils?: number | null;
  branding: CompanyBranding;
  ledger: LedgerEntry[];
  activeLedgerEntryId: string;
}

export interface ServiceCatalogItem {
  id: string;
  name: string;
  unit: string; // e.g. Monthly Lump-Sum, Per Worker, Per Day
  defaultRateFils: number;
  descriptionTemplate: string;
  linkedCompanyId?: string; // Optional relational link to SubContractCompany.id
}

export interface QuoteRecord {
  id: string;
  quoteNo: string;
  companyId: string;
  customerId?: string;
  clientName: string;
  itemId?: string;
  dateIso: string;
  dateDisplay: string;
  billingMonthFull: string;
  description: string;
  amountFils: number;
  status: 'draft' | 'sent' | 'converted';
}

export interface SalesReceiptRecord {
  id: string;
  receiptNo: string;
  companyId: string;
  customerId?: string;
  clientName: string;
  itemId?: string;
  invoiceId?: string;
  dateIso: string;
  dateDisplay: string;
  paymentMode: string; // e.g., Bank Transfer (KFH), Cheque, Cash
  description: string;
  amountFils: number;
}

export interface ExpenseRecord {
  id: string;
  companyId: string;
  customerId?: string;
  customerName?: string;
  dateIso: string;
  dateDisplay: string;
  category: string;
  vendorOrPayee: string;
  referenceNo: string;
  amountFils: number;
  notes: string;
}

export interface TimeLogRecord {
  id: string;
  companyId: string;
  customerId?: string;
  customerName?: string;
  itemId?: string;
  dateIso: string;
  workerGroup: string;
  headcount: number;
  daysWorked: number;
  ratePerWorkerDayFils: number;
  totalFils: number;
  billed: boolean;
}

export interface RecurringContractProfile {
  id: string;
  companyId: string;
  customerId?: string;
  itemId?: string;
  profileName: string;
  clientName: string;
  cadence: 'Monthly';
  defaultAmountFils: number;
  active: boolean;
  lastGeneratedMonth: string;
}

export interface WorkspaceDatabase {
  version: number;
  organizationName: string;
  ownerEmail?: string;
  operatorProfile?: OperatorUserProfile;
  lastUpdatedIso: string;
  companies: SubContractCompany[];
  activeCompanyId: string;
  customers?: CustomerRecipient[];
  items?: ServiceCatalogItem[];
  quotes?: QuoteRecord[];
  salesReceipts?: SalesReceiptRecord[];
  expenses?: ExpenseRecord[];
  timeLogs?: TimeLogRecord[];
  recurringProfiles?: RecurringContractProfile[];
}

export interface ComputedLedgerRow {
  entry: LedgerEntry;
  rowNetDeltaFils: number;
  cumulativeUnpaidFils: number;
  displayBalanceFils: number | null;
  status: 'paid' | 'partial' | 'unpaid';
}

export interface ComputedStatementSummary {
  rows: ComputedLedgerRow[];
  calculatedTotalInvoicedFils: number;
  displayTotalInvoicedFils: number;
  totalReceivedFils: number;
  netOutstandingBalanceFils: number;
}
