import { useState, useEffect, useRef } from 'react';
import {
  Home,
  Users,
  ShoppingBag,
  FileSpreadsheet,
  FileText,
  ReceiptText,
  ArrowDownCircle,
  Wallet,
  Clock,
  BarChart3,
  Layers,
  Settings,
  Sun,
  Moon,
  RotateCcw,
  Check,
  AlertCircle,
  CloudUpload,
  Plus,
  Menu,
  X,
  ChevronDown,
  Building2,
  Cloud,
  UserCheck,
  LogOut,
  RefreshCw,
} from 'lucide-react';
import { INITIAL_WORKSPACE_DB } from './data/initialDatabase';
import {
  LedgerEntry,
  SubContractCompany,
  CustomerRecipient,
  WorkspaceDatabase,
  ServiceCatalogItem,
  QuoteRecord,
  SalesReceiptRecord,
  ExpenseRecord,
  TimeLogRecord,
  RecurringContractProfile,
  OperatorUserProfile,
} from './types/billing';
import {
  computeStatementLedger,
  computeBillingMonthAndCodeFromIsoDate,
  deriveStatementMonthCodeFromBillingMonth,
  formatIsoDateForInvoice,
  generateInvoiceNumberCode,
} from './utils/kwdMath';
import {
  generateCompanyInvoiceAndStatementPdf,
  PdfExportTarget,
} from './utils/pdfGenerator';
import {
  initAuth,
  googleSignIn,
  logoutGoogle,
  getAccessToken,
  listWorkspaceDriveFiles,
  pullDatabaseFromDrive,
  pushDatabaseToDrive,
  uploadPdfToDrive,
  deleteDriveFile,
  DriveFileMetadata,
  DRIVE_FOLDER_NAME,
  GoogleUserProfile,
} from './services/googleDriveService';
import {
  InvoiceAndLedgerWorkspace,
  ZohoWorkspaceTab,
} from './components/InvoiceAndLedgerWorkspace';
import { ExecutiveDashboard } from './components/ExecutiveDashboard';
import { CompanyPadStudioView } from './components/CompanyPadStudioModal';
import { DriveSyncView } from './components/DriveSyncModal';
import {
  AuthLoginGate,
  OperatorProfileSettingsView,
} from './components/AuthLoginGate';
import {
  CustomersView,
  ItemsView,
  QuotesView,
  SalesReceiptsView,
  ExpensesView,
  TimeTrackingView,
  ReportsView,
  AdvancedBillingView,
} from './components/ZohoModulesViews';
import {
  PWAInstallButton,
  OfflineIndicator,
} from './components/PWAInstallManager';

const LOCAL_STORAGE_KEY = 'bairaq_al_wafrah_workspace_v2';
const SESSION_AUTH_KEY = 'bairaq_al_wafrah_operator_authed_v1';

export type ZohoMenuModule =
  | 'home'
  | 'customers'
  | 'items'
  | 'quotes'
  | 'invoices'
  | 'create_invoice'
  | 'sales_receipts'
  | 'payments'
  | 'expenses'
  | 'time_tracking'
  | 'reports'
  | 'advanced_billing'
  | 'settings';

const MODULE_TITLES: Record<ZohoMenuModule, string> = {
  home: 'Home',
  customers: 'Customers',
  items: 'Items',
  quotes: 'Quotes',
  invoices: 'Invoices',
  create_invoice: 'New Invoice',
  sales_receipts: 'Sales Receipts',
  payments: 'Payments Received',
  expenses: 'Expenses',
  time_tracking: 'Time Tracking',
  reports: 'Reports & Statements',
  advanced_billing: 'Advanced Billing',
  settings: 'Settings',
};

function normalizeDatabase(parsed: WorkspaceDatabase): WorkspaceDatabase {
  return {
    ...INITIAL_WORKSPACE_DB,
    ...parsed,
    organizationName: 'Bairaq Al-Wafrah',
    operatorProfile:
      parsed.operatorProfile || INITIAL_WORKSPACE_DB.operatorProfile,
    customers: parsed.customers || INITIAL_WORKSPACE_DB.customers,
    items: parsed.items || INITIAL_WORKSPACE_DB.items,
    quotes: parsed.quotes || INITIAL_WORKSPACE_DB.quotes,
    salesReceipts: parsed.salesReceipts || INITIAL_WORKSPACE_DB.salesReceipts,
    expenses: parsed.expenses || INITIAL_WORKSPACE_DB.expenses,
    timeLogs: parsed.timeLogs || INITIAL_WORKSPACE_DB.timeLogs,
    recurringProfiles:
      parsed.recurringProfiles || INITIAL_WORKSPACE_DB.recurringProfiles,
  };
}

export default function App() {
  const [database, setDatabase] = useState<WorkspaceDatabase>(() => {
    try {
      const saved = localStorage.getItem(LOCAL_STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved) as WorkspaceDatabase;
        if (parsed && Array.isArray(parsed.companies) && parsed.companies.length > 0) {
          return normalizeDatabase(parsed);
        }
      }
    } catch (e) {
      console.error('Failed to read local workspace cache:', e);
    }
    return INITIAL_WORKSPACE_DB;
  });

  // Authentication Session Gate
  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(() => {
    try {
      return sessionStorage.getItem(SESSION_AUTH_KEY) === 'true';
    } catch {
      return false;
    }
  });

  const [activeModule, setActiveModule] = useState<ZohoMenuModule>('invoices');
  const [settingsSubTab, setSettingsSubTab] = useState<
    'company_pads' | 'drive_sync' | 'operator_profile'
  >('company_pads');
  const [mobileDrawerOpen, setMobileDrawerOpen] = useState<boolean>(false);
  const [isDark, setIsDark] = useState<boolean>(false);

  // Google Auth & Drive State
  const [user, setUser] = useState<GoogleUserProfile | null>(null);
  const [isDriveConnected, setIsDriveConnected] = useState<boolean>(false);
  const [isSyncing, setIsSyncing] = useState<boolean>(false);
  const [lastSyncedTime, setLastSyncedTime] = useState<string | null>(null);
  const [driveFiles, setDriveFiles] = useState<DriveFileMetadata[]>([]);
  const [syncError, setSyncError] = useState<string | null>(null);

  // Track whether the current database update came from a remote Drive pull to prevent echo push
  const isPullingRemoteRef = useRef<boolean>(false);
  const initialMountSyncSkipRef = useRef<boolean>(true);

  // PDF Export & Upload State
  const [exportingTarget, setExportingTarget] = useState<PdfExportTarget | null>(null);
  const [isUploadingDrivePdf, setIsUploadingDrivePdf] = useState<boolean>(false);
  const [confirmUploadPdfModal, setConfirmUploadPdfModal] = useState<boolean>(false);
  const [confirmResetModal, setConfirmResetModal] = useState<boolean>(false);
  const [toastMessage, setToastMessage] = useState<{
    text: string;
    type: 'success' | 'error';
  } | null>(null);

  const triggerToast = (text: string, type: 'success' | 'error' = 'success') => {
    setToastMessage({ text, type });
    setTimeout(() => setToastMessage(null), 3500);
  };

  useEffect(() => {
    const root = document.documentElement;
    if (isDark) {
      root.classList.add('dark');
    } else {
      root.classList.remove('dark');
    }
  }, [isDark]);

  useEffect(() => {
    try {
      localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(database));
    } catch (e) {
      console.error('Local cache write error:', e);
    }
  }, [database]);

  useEffect(() => {
    const unsubscribe = initAuth(
      (authedUser) => {
        setUser(authedUser);
      },
      () => {
        setUser(null);
        setIsDriveConnected(false);
      }
    );
    return () => unsubscribe();
  }, []);

  // Debounced Automatic Push to Google Drive whenever database changes while connected
  useEffect(() => {
    if (initialMountSyncSkipRef.current) {
      initialMountSyncSkipRef.current = false;
      return;
    }
    if (!isDriveConnected || isPullingRemoteRef.current) {
      isPullingRemoteRef.current = false;
      return;
    }

    const timer = setTimeout(async () => {
      try {
        const token = await getAccessToken();
        if (!token) {
          setIsDriveConnected(false);
          return;
        }
        setIsSyncing(true);
        setSyncError(null);
        const result = await pushDatabaseToDrive(token, database);
        setLastSyncedTime(result.modifiedTime);
      } catch (err: any) {
        if (err?.message === 'AUTH_EXPIRED') {
          setIsDriveConnected(false);
        } else {
          setSyncError(err?.message || 'Auto-sync to Google Drive failed.');
        }
      } finally {
        setIsSyncing(false);
      }
    }, 1200);

    return () => clearTimeout(timer);
  }, [database.lastUpdatedIso, isDriveConnected]);

  const activeCompany: SubContractCompany =
    database.companies.find((c) => c.id === database.activeCompanyId) ||
    database.companies[0];

  const statementSummary = computeStatementLedger(activeCompany);

  const activeEntry: LedgerEntry | undefined =
    activeCompany.ledger.find((r) => r.id === activeCompany.activeLedgerEntryId) ||
    activeCompany.ledger[activeCompany.ledger.length - 1];

  const operatorProfile: OperatorUserProfile =
    database.operatorProfile || INITIAL_WORKSPACE_DB.operatorProfile!;

  const handleSelectCompany = (companyId: string) => {
    setDatabase((prev) => ({
      ...prev,
      activeCompanyId: companyId,
      lastUpdatedIso: new Date().toISOString(),
    }));
  };

  const handleUpdateCompany = (updatedCompany: SubContractCompany) => {
    setDatabase((prev) => ({
      ...prev,
      lastUpdatedIso: new Date().toISOString(),
      companies: prev.companies.map((c) =>
        c.id === updatedCompany.id ? updatedCompany : c
      ),
    }));
  };

  const handleCreateCompany = (newCompany: SubContractCompany) => {
    setDatabase((prev) => ({
      ...prev,
      activeCompanyId: newCompany.id,
      lastUpdatedIso: new Date().toISOString(),
      companies: [...prev.companies, newCompany],
    }));
  };

  const handleDeleteCompany = (companyId: string) => {
    setDatabase((prev) => {
      const remaining = prev.companies.filter((c) => c.id !== companyId);
      if (remaining.length === 0) return prev;
      return {
        ...prev,
        activeCompanyId: remaining[0].id,
        lastUpdatedIso: new Date().toISOString(),
        companies: remaining,
      };
    });
  };

  const handleUpdateOperatorProfile = (updatedProfile: OperatorUserProfile) => {
    setDatabase((prev) => ({
      ...prev,
      ownerEmail: updatedProfile.email,
      operatorProfile: updatedProfile,
      lastUpdatedIso: new Date().toISOString(),
    }));
  };

  const handleUpdateItems = (items: ServiceCatalogItem[]) => {
    setDatabase((prev) => ({
      ...prev,
      items,
      lastUpdatedIso: new Date().toISOString(),
    }));
  };

  const handleUpdateCustomers = (customers: CustomerRecipient[]) => {
    setDatabase((prev) => ({
      ...prev,
      customers,
      lastUpdatedIso: new Date().toISOString(),
    }));
  };

  // Relational cascade when a Customer Recipient is updated in Customers module
  const handleCascadeCustomerUpdate = (
    oldName: string,
    updatedCustomer: CustomerRecipient
  ) => {
    const customerId = updatedCustomer.id;
    const newCustomerName = updatedCustomer.name;
    setDatabase((prev) => ({
      ...prev,
      lastUpdatedIso: new Date().toISOString(),
      customers: (prev.customers || []).map((c) =>
        c.id === customerId ? updatedCustomer : c
      ),
      companies: prev.companies.map((c) => ({
        ...c,
        clientName:
          c.defaultCustomerId === customerId || c.clientName === oldName
            ? newCustomerName
            : c.clientName,
        ledger: c.ledger.map((entry) =>
          entry.customerId === customerId || entry.customerName === oldName
            ? { ...entry, customerId, customerName: newCustomerName }
            : entry
        ),
      })),
      quotes: (prev.quotes || []).map((q) =>
        q.customerId === customerId || q.clientName === oldName
          ? { ...q, customerId, clientName: newCustomerName }
          : q
      ),
      salesReceipts: (prev.salesReceipts || []).map((sr) =>
        sr.customerId === customerId || sr.clientName === oldName
          ? { ...sr, customerId, clientName: newCustomerName }
          : sr
      ),
      expenses: (prev.expenses || []).map((ex) =>
        ex.customerId === customerId || ex.customerName === oldName
          ? { ...ex, customerId, customerName: newCustomerName }
          : ex
      ),
      timeLogs: (prev.timeLogs || []).map((tl) =>
        tl.customerId === customerId || tl.customerName === oldName
          ? { ...tl, customerId, customerName: newCustomerName }
          : tl
      ),
      recurringProfiles: (prev.recurringProfiles || []).map((rp) =>
        rp.customerId === customerId || rp.clientName === oldName
          ? { ...rp, customerId, clientName: newCustomerName }
          : rp
      ),
    }));
  };

  const handleUpdateQuotes = (quotes: QuoteRecord[]) => {
    setDatabase((prev) => ({
      ...prev,
      quotes,
      lastUpdatedIso: new Date().toISOString(),
    }));
  };

  const handleUpdateReceipts = (salesReceipts: SalesReceiptRecord[]) => {
    setDatabase((prev) => ({
      ...prev,
      salesReceipts,
      lastUpdatedIso: new Date().toISOString(),
    }));
  };

  const handleUpdateExpenses = (expenses: ExpenseRecord[]) => {
    setDatabase((prev) => ({
      ...prev,
      expenses,
      lastUpdatedIso: new Date().toISOString(),
    }));
  };

  const handleUpdateTimeLogs = (timeLogs: TimeLogRecord[]) => {
    setDatabase((prev) => ({
      ...prev,
      timeLogs,
      lastUpdatedIso: new Date().toISOString(),
    }));
  };

  const handleUpdateRecurringProfiles = (
    recurringProfiles: RecurringContractProfile[]
  ) => {
    setDatabase((prev) => ({
      ...prev,
      recurringProfiles,
      lastUpdatedIso: new Date().toISOString(),
    }));
  };

  // Convert a Quote directly into a real Invoice & Statement Entry with Relational Links
  const handleConvertQuoteToInvoice = (quote: QuoteRecord) => {
    const targetComp =
      database.companies.find((c) => c.id === quote.companyId) || activeCompany;
    const nextSeq = targetComp.ledger.length + 1;
    const invoiceNo = generateInvoiceNumberCode(
      targetComp.code,
      quote.dateIso,
      nextSeq
    );
    const monthTag = deriveStatementMonthCodeFromBillingMonth(
      quote.billingMonthFull,
      quote.dateIso
    );

    const formattedQuoteDate = formatIsoDateForInvoice(quote.dateIso);
    const newEntry: LedgerEntry = {
      id: `inv-from-qt-${Date.now()}`,
      seqNumber: nextSeq,
      invoiceNo,
      invoiceDateIso: quote.dateIso,
      invoiceDate: formattedQuoteDate.shortDate,
      statementDateDisplay: formattedQuoteDate.longDate,
      monthTag,
      billingMonthFull: quote.billingMonthFull,
      description: quote.description.replace(/^Estimated\s+/i, ''),
      customerId: quote.customerId || targetComp.defaultCustomerId,
      customerName: quote.clientName || targetComp.clientName,
      itemId: quote.itemId,
      invoiceAmountFils: quote.amountFils,
      receivedAmountFils: null,
      receivedDate: '',
      manualBalanceFils: null,
    };

    const updatedCompany: SubContractCompany = {
      ...targetComp,
      clientName: quote.clientName || targetComp.clientName,
      defaultCustomerId: quote.customerId || targetComp.defaultCustomerId,
      activeLedgerEntryId: newEntry.id,
      ledger: [...targetComp.ledger, newEntry],
    };

    setDatabase((prev) => ({
      ...prev,
      activeCompanyId: updatedCompany.id,
      lastUpdatedIso: new Date().toISOString(),
      companies: prev.companies.map((c) =>
        c.id === updatedCompany.id ? updatedCompany : c
      ),
      quotes: (prev.quotes || []).map((q) =>
        q.id === quote.id ? { ...q, status: 'converted' } : q
      ),
    }));

    setActiveModule('invoices');
    triggerToast(`Converted Quote ${quote.quoteNo} to Invoice ${invoiceNo}`);
  };

  // Convert a Manpower Timesheet Batch directly into a real Invoice & Statement Entry with Relational Links
  const handleConvertTimeLogToInvoice = (log: TimeLogRecord) => {
    const targetComp =
      database.companies.find((c) => c.id === log.companyId) || activeCompany;
    const nextSeq = targetComp.ledger.length + 1;
    const derived = computeBillingMonthAndCodeFromIsoDate(log.dateIso);
    const invoiceNo = generateInvoiceNumberCode(
      targetComp.code,
      log.dateIso,
      nextSeq
    );

    const formattedLogDate = formatIsoDateForInvoice(log.dateIso);
    const newEntry: LedgerEntry = {
      id: `inv-from-tl-${Date.now()}`,
      seqNumber: nextSeq,
      invoiceNo,
      invoiceDateIso: log.dateIso,
      invoiceDate: formattedLogDate.shortDate,
      statementDateDisplay: formattedLogDate.longDate,
      monthTag: derived.statementMonthCode,
      billingMonthFull: derived.billingMonthFull,
      description: `Charges for Manpower Supplied (${log.workerGroup}) for the month of ${derived.billingMonthFull.replace(' ', ' - ')}`,
      customerId: log.customerId || targetComp.defaultCustomerId,
      customerName: log.customerName || targetComp.clientName,
      itemId: log.itemId,
      invoiceAmountFils: log.totalFils,
      receivedAmountFils: null,
      receivedDate: '',
      manualBalanceFils: null,
    };

    const updatedCompany: SubContractCompany = {
      ...targetComp,
      clientName: log.customerName || targetComp.clientName,
      defaultCustomerId: log.customerId || targetComp.defaultCustomerId,
      activeLedgerEntryId: newEntry.id,
      ledger: [...targetComp.ledger, newEntry],
    };

    setDatabase((prev) => ({
      ...prev,
      activeCompanyId: updatedCompany.id,
      lastUpdatedIso: new Date().toISOString(),
      companies: prev.companies.map((c) =>
        c.id === updatedCompany.id ? updatedCompany : c
      ),
      timeLogs: (prev.timeLogs || []).map((t) =>
        t.id === log.id
          ? { ...t, billed: true, invoiceId: newEntry.id }
          : t
      ),
    }));

    setActiveModule('invoices');
    triggerToast(`Billed Timesheet as Invoice ${invoiceNo}`);
  };

  // Generate Monthly Invoice from Recurring Profile with Relational Links
  const handleGenerateRecurringInvoice = (
    profile: RecurringContractProfile,
    dateIso: string
  ) => {
    const targetComp =
      database.companies.find((c) => c.id === profile.companyId) || activeCompany;
    const nextSeq = targetComp.ledger.length + 1;
    const derived = computeBillingMonthAndCodeFromIsoDate(dateIso);
    const invoiceNo = generateInvoiceNumberCode(
      targetComp.code,
      dateIso,
      nextSeq
    );

    const formattedRecDate = formatIsoDateForInvoice(dateIso);
    const newEntry: LedgerEntry = {
      id: `inv-from-rec-${Date.now()}`,
      seqNumber: nextSeq,
      invoiceNo,
      invoiceDateIso: dateIso,
      invoiceDate: formattedRecDate.shortDate,
      statementDateDisplay: formattedRecDate.longDate,
      monthTag: derived.statementMonthCode,
      billingMonthFull: derived.billingMonthFull,
      description: `Charges for Manpower Supplied for the month of ${derived.billingMonthFull.replace(' ', ' - ')}`,
      customerId: profile.customerId || targetComp.defaultCustomerId,
      customerName: profile.clientName || targetComp.clientName,
      itemId: profile.itemId,
      invoiceAmountFils: profile.defaultAmountFils,
      receivedAmountFils: null,
      receivedDate: '',
      manualBalanceFils: null,
    };

    const updatedCompany: SubContractCompany = {
      ...targetComp,
      clientName: profile.clientName || targetComp.clientName,
      defaultCustomerId: profile.customerId || targetComp.defaultCustomerId,
      activeLedgerEntryId: newEntry.id,
      ledger: [...targetComp.ledger, newEntry],
    };

    setDatabase((prev) => ({
      ...prev,
      activeCompanyId: updatedCompany.id,
      lastUpdatedIso: new Date().toISOString(),
      companies: prev.companies.map((c) =>
        c.id === updatedCompany.id ? updatedCompany : c
      ),
      recurringProfiles: (prev.recurringProfiles || []).map((p) =>
        p.id === profile.id
          ? { ...p, lastGeneratedMonth: derived.billingMonthFull }
          : p
      ),
    }));

    setActiveModule('invoices');
    triggerToast(`Generated Monthly Invoice ${invoiceNo}`);
  };

  // Multi-Device Google Drive Connection + Auto Pull/Init
  const handleGoogleSignIn = async () => {
    setSyncError(null);
    setIsSyncing(true);
    try {
      const res = await googleSignIn();
      if (res) {
        setUser(res.user);
        setIsDriveConnected(true);

        // Automatically pull cloud database from Google Drive if it exists, or initialize it
        const pulled = await pullDatabaseFromDrive(res.accessToken);
        if (pulled && pulled.db && Array.isArray(pulled.db.companies)) {
          isPullingRemoteRef.current = true;
          setDatabase(normalizeDatabase(pulled.db));
          setLastSyncedTime(pulled.modifiedTime);
          const files = await listWorkspaceDriveFiles(res.accessToken);
          setDriveFiles(files);
          triggerToast('Google Drive connected & workspace database synchronized.');
        } else {
          const pushed = await pushDatabaseToDrive(res.accessToken, database);
          setLastSyncedTime(pushed.modifiedTime);
          const files = await listWorkspaceDriveFiles(res.accessToken);
          setDriveFiles(files);
          triggerToast('Google Drive connected & initial cloud backup created.');
        }
      }
    } catch (err: any) {
      setSyncError(err?.message || 'Google Drive connection failed.');
      triggerToast('Could not connect to Google Drive.', 'error');
    } finally {
      setIsSyncing(false);
    }
  };

  const handleOperatorCredentialsLogin = () => {
    setIsAuthenticated(true);
    try {
      sessionStorage.setItem(SESSION_AUTH_KEY, 'true');
    } catch {
      // Ignore storage errors
    }
    triggerToast(`Welcome back, ${operatorProfile.fullName}`);
  };

  const handleSignOutWorkspace = async () => {
    await logoutGoogle();
    setUser(null);
    setIsDriveConnected(false);
    setDriveFiles([]);
    setIsAuthenticated(false);
    try {
      sessionStorage.removeItem(SESSION_AUTH_KEY);
    } catch {
      // Ignore storage errors
    }
  };

  const handleGoogleSignOut = async () => {
    await logoutGoogle();
    setUser(null);
    setIsDriveConnected(false);
    setDriveFiles([]);
    triggerToast('Disconnected from Google Drive.');
  };

  const handleRefreshDriveFiles = async () => {
    setSyncError(null);
    setIsSyncing(true);
    try {
      const token = await getAccessToken();
      if (!token) {
        setIsDriveConnected(false);
        return;
      }
      const files = await listWorkspaceDriveFiles(token);
      setDriveFiles(files);
    } catch (err: any) {
      if (err?.message === 'AUTH_EXPIRED') {
        setIsDriveConnected(false);
      }
      setSyncError(err?.message || 'Failed to list Google Drive files.');
    } finally {
      setIsSyncing(false);
    }
  };

  const handlePushDatabaseToDrive = async () => {
    setSyncError(null);
    setIsSyncing(true);
    try {
      let token = await getAccessToken();
      if (!token) {
        const loginRes = await googleSignIn();
        if (!loginRes) return;
        token = loginRes.accessToken;
        setUser(loginRes.user);
        setIsDriveConnected(true);
      }
      const result = await pushDatabaseToDrive(token, database);
      setLastSyncedTime(result.modifiedTime);
      const files = await listWorkspaceDriveFiles(token);
      setDriveFiles(files);
      triggerToast('Saved to Google Drive.');
    } catch (err: any) {
      setSyncError(err?.message || 'Failed to push database to Google Drive.');
      triggerToast('Drive sync failed.', 'error');
    } finally {
      setIsSyncing(false);
    }
  };

  const handlePullDatabaseFromDrive = async () => {
    setSyncError(null);
    setIsSyncing(true);
    try {
      let token = await getAccessToken();
      if (!token) {
        const loginRes = await googleSignIn();
        if (!loginRes) return;
        token = loginRes.accessToken;
        setUser(loginRes.user);
        setIsDriveConnected(true);
      }
      const pulled = await pullDatabaseFromDrive(token);
      if (!pulled) {
        triggerToast('No cloud database found in Drive yet.', 'error');
        return;
      }
      isPullingRemoteRef.current = true;
      setDatabase(normalizeDatabase(pulled.db));
      setLastSyncedTime(pulled.modifiedTime);
      const files = await listWorkspaceDriveFiles(token);
      setDriveFiles(files);
      triggerToast('Loaded data from Google Drive.');
    } catch (err: any) {
      setSyncError(err?.message || 'Failed to pull database from Google Drive.');
      triggerToast('Failed to pull from Google Drive.', 'error');
    } finally {
      setIsSyncing(false);
    }
  };

  const handleDeleteDriveFile = async (fileId: string) => {
    setSyncError(null);
    setIsSyncing(true);
    try {
      const token = await getAccessToken();
      if (!token) {
        setIsDriveConnected(false);
        return;
      }
      await deleteDriveFile(token, fileId);
      const files = await listWorkspaceDriveFiles(token);
      setDriveFiles(files);
      triggerToast('Deleted file from Google Drive.');
    } catch (err: any) {
      setSyncError(err?.message || 'Failed to delete file from Google Drive.');
    } finally {
      setIsSyncing(false);
    }
  };

  const handleDownloadPdf = async (
    target: PdfExportTarget,
    customEntry?: LedgerEntry
  ) => {
    setExportingTarget(target);
    try {
      const entryToRender = customEntry || activeEntry;
      const { blob, fileName } = await generateCompanyInvoiceAndStatementPdf(
        activeCompany,
        entryToRender,
        statementSummary,
        target
      );
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = fileName;
      a.click();
      URL.revokeObjectURL(url);
      triggerToast(`Downloaded ${fileName}`);
    } catch (err) {
      console.error('PDF generation failed:', err);
      triggerToast('Failed to generate PDF.', 'error');
    } finally {
      setExportingTarget(null);
    }
  };

  const executeConfirmedPdfUploadToDrive = async () => {
    setConfirmUploadPdfModal(false);
    setIsUploadingDrivePdf(true);
    try {
      let token = await getAccessToken();
      if (!token) {
        const loginRes = await googleSignIn();
        if (!loginRes) return;
        token = loginRes.accessToken;
        setUser(loginRes.user);
        setIsDriveConnected(true);
      }
      const { blob, fileName } = await generateCompanyInvoiceAndStatementPdf(
        activeCompany,
        activeEntry,
        statementSummary,
        'both'
      );
      await uploadPdfToDrive(token, fileName, blob);
      const pushed = await pushDatabaseToDrive(token, database);
      const files = await listWorkspaceDriveFiles(token);
      setDriveFiles(files);
      setLastSyncedTime(pushed.modifiedTime);
      triggerToast(`Saved "${fileName}" to Google Drive.`);
    } catch (err: any) {
      console.error('Upload PDF to Drive error:', err);
      triggerToast(err?.message || 'Failed to upload PDF to Google Drive.', 'error');
    } finally {
      setIsUploadingDrivePdf(false);
    }
  };

  const sanitizedMonth = (activeEntry?.billingMonthFull || 'Statement').replace(
    /\s+/g,
    '_'
  );
  const plannedPdfFileName = `${activeCompany.code}_Invoice_and_Statement_${sanitizedMonth}.pdf`;

  // Exact 12-Item Zoho Invoice Menu List
  const zohoMenuItems: {
    id: ZohoMenuModule;
    label: string;
    icon: React.ComponentType<{ className?: string }>;
    hasChevron?: boolean;
  }[] = [
    { id: 'home', label: 'Home', icon: Home },
    { id: 'customers', label: 'Customers', icon: Users },
    { id: 'items', label: 'Items', icon: ShoppingBag },
    { id: 'quotes', label: 'Quotes', icon: FileSpreadsheet },
    { id: 'invoices', label: 'Invoices', icon: FileText },
    { id: 'sales_receipts', label: 'Sales Receipts', icon: ReceiptText },
    { id: 'payments', label: 'Payments Received', icon: ArrowDownCircle },
    { id: 'expenses', label: 'Expenses', icon: Wallet },
    { id: 'time_tracking', label: 'Time Tracking', icon: Clock, hasChevron: true },
    { id: 'reports', label: 'Reports', icon: BarChart3 },
    { id: 'advanced_billing', label: 'Advanced Billing', icon: Layers },
    { id: 'settings', label: 'Settings', icon: Settings },
  ];

  const isMenuItemActive = (itemId: ZohoMenuModule) => {
    if (itemId === 'invoices' && activeModule === 'create_invoice') return true;
    return activeModule === itemId;
  };

  // Render Zero-Leak Password Login Gate when unauthenticated
  if (!isAuthenticated) {
    return (
      <AuthLoginGate
        organizationName={database.organizationName}
        operatorProfile={operatorProfile}
        onCredentialsLogin={() => handleOperatorCredentialsLogin()}
      />
    );
  }

  const renderZohoDrawerContent = (closeDrawerOnSelect: boolean) => (
    <div className="flex flex-col h-full justify-between bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 select-none">
      <div>
        {/* Zoho Operator Organization Header (Bairaq Al-Wafrah) */}
        <div className="px-5 pt-5 pb-4 border-b border-slate-200 dark:border-slate-800 space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <img
                src="/icon.svg"
                alt="Bairaq Al-Wafrah"
                className="w-10 h-10 rounded-xl object-contain shrink-0"
              />
              {user?.photoURL && (
                <img
                  src={user.photoURL}
                  alt={user.displayName || operatorProfile.fullName}
                  className="w-7 h-7 rounded-full object-cover border border-slate-200 dark:border-slate-700 shrink-0"
                />
              )}
            </div>
            {closeDrawerOnSelect && (
              <button
                onClick={() => setMobileDrawerOpen(false)}
                className="p-2 rounded-lg text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800"
              >
                <X className="w-5 h-5" />
              </button>
            )}
          </div>

          <div className="space-y-0.5">
            <div className="text-sm font-bold text-slate-900 dark:text-white truncate">
              Bairaq Al-Wafrah
            </div>
            <div className="text-[11px] font-medium text-slate-600 dark:text-slate-300 truncate">
              {user?.displayName || operatorProfile.fullName} · {operatorProfile.roleTitle}
            </div>
            <div className="text-[11px] text-slate-500 dark:text-slate-400 truncate">
              {user?.email || operatorProfile.email || database.ownerEmail}
            </div>
          </div>
        </div>

        {/* 12 Zoho Invoice Menu Items */}
        <nav className="py-2" aria-label="Primary Navigation">
          {zohoMenuItems.map((item) => {
            const IconComponent = item.icon;
            const active = isMenuItemActive(item.id);
            return (
              <button
                key={item.id}
                onClick={() => {
                  setActiveModule(item.id);
                  if (closeDrawerOnSelect) setMobileDrawerOpen(false);
                }}
                className={`w-full flex items-center justify-between px-5 py-2.5 text-[13.5px] font-medium transition-colors whitespace-nowrap shrink-0 ${
                  active
                    ? 'bg-[#0088FF] text-white font-semibold'
                    : 'text-slate-800 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800'
                }`}
              >
                <div className="flex items-center gap-4">
                  <IconComponent
                    className={`w-[18px] h-[18px] shrink-0 ${
                      active ? 'text-white' : 'text-slate-700 dark:text-slate-300'
                    }`}
                  />
                  <span>{item.label}</span>
                </div>
                {item.hasChevron && (
                  <ChevronDown
                    className={`w-4 h-4 ${
                      active ? 'text-white' : 'text-slate-400'
                    }`}
                  />
                )}
              </button>
            );
          })}
        </nav>
      </div>

      {/* Bottom Utility Footer */}
      <div className="p-4 border-t border-slate-200 dark:border-slate-800 space-y-2.5 text-xs text-slate-500">
        <div className="flex items-center justify-between">
          <button
            onClick={() => setConfirmResetModal(true)}
            className="inline-flex items-center gap-1 hover:text-slate-900 dark:hover:text-white transition-colors"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span>Reset Defaults</span>
          </button>

          <button
            onClick={() => setIsDark(!isDark)}
            className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200 hover:bg-slate-200 transition-colors"
          >
            {isDark ? <Sun className="w-3.5 h-3.5" /> : <Moon className="w-3.5 h-3.5" />}
            <span>{isDark ? 'Light' : 'Dark'}</span>
          </button>
        </div>

        <button
          onClick={handleSignOutWorkspace}
          className="w-full inline-flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-300 hover:bg-rose-50 hover:text-rose-700 hover:border-rose-200 dark:hover:bg-rose-950/30 dark:hover:text-rose-300 transition-colors font-semibold"
        >
          <LogOut className="w-3.5 h-3.5" />
          <span>Sign Out Workspace</span>
        </button>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen flex bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100">
      {/* Mobile Slide-Out Zoho Navigation Drawer */}
      {mobileDrawerOpen && (
        <div className="no-print fixed inset-0 z-50 lg:hidden flex">
          <div
            className="fixed inset-0 bg-slate-950/60 backdrop-blur-xs"
            onClick={() => setMobileDrawerOpen(false)}
          />
          <div className="relative z-10 w-72 max-w-[85vw] h-full shadow-2xl overflow-y-auto">
            {renderZohoDrawerContent(true)}
          </div>
        </div>
      )}

      {/* Single Primary Navigation: Desktop Zoho Left Sidebar */}
      <aside className="no-print hidden lg:flex flex-col w-64 shrink-0 bg-white dark:bg-slate-900 border-r border-slate-200 dark:border-slate-800">
        {renderZohoDrawerContent(false)}
      </aside>

      {/* Right Content Column: Contextual Page Header + Main Workspace */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Clean Contextual Page Header */}
        <header className="no-print flex items-center justify-between gap-4 px-4 sm:px-6 py-3.5 bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800">
          <div className="flex items-center gap-3 min-w-0">
            <button
              onClick={() => setMobileDrawerOpen(true)}
              className="lg:hidden p-1.5 rounded-lg text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800"
              aria-label="Open Navigation Menu"
            >
              <Menu className="w-5 h-5" />
            </button>
            <img
              src="/icon.svg"
              alt="Bairaq Al-Wafrah"
              className="w-7 h-7 rounded-lg object-contain shrink-0"
            />
            <h1 className="text-base sm:text-lg font-bold tracking-tight text-slate-900 dark:text-white truncate">
              {MODULE_TITLES[activeModule]}
            </h1>
          </div>

          {/* Sub-Contract Client Pad Switcher + PWA Install + Google Drive Live Status + Primary Action */}
          <div className="flex items-center gap-2.5 shrink-0">
            <PWAInstallButton />

            {/* Live Google Drive Auto-Sync Status Button */}
            <button
              onClick={() => {
                if (isDriveConnected) {
                  setActiveModule('settings');
                  setSettingsSubTab('drive_sync');
                } else {
                  handleGoogleSignIn();
                }
              }}
              title={
                isDriveConnected
                  ? lastSyncedTime
                    ? `Auto-synced to Google Drive (${new Date(lastSyncedTime).toLocaleTimeString()})`
                    : 'Google Drive Auto-Sync Active'
                  : 'Click to connect Google Drive for automatic synchronization'
              }
              className={`hidden sm:inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold border transition-colors ${
                isDriveConnected
                  ? 'bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800/70 hover:bg-emerald-100'
                  : 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-700 hover:bg-slate-200'
              }`}
            >
              {isSyncing ? (
                <>
                  <RefreshCw className="w-3.5 h-3.5 animate-spin text-[#0088FF]" />
                  <span>Syncing Drive...</span>
                </>
              ) : isDriveConnected ? (
                <>
                  <Cloud className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
                  <span>Drive Auto-Sync</span>
                </>
              ) : (
                <>
                  <Cloud className="w-3.5 h-3.5 text-slate-500" />
                  <span>Connect Drive</span>
                </>
              )}
            </button>

            <div className="flex items-center gap-2">
              <span className="hidden md:inline-block text-xs font-medium text-slate-500">
                Sub-Contract Client Pad:
              </span>
              <select
                value={activeCompany.id}
                onChange={(e) => handleSelectCompany(e.target.value)}
                aria-label="Sub-Contract Client Pad"
                className="px-3 py-1.5 text-xs font-bold bg-slate-100 dark:bg-slate-800 text-slate-900 dark:text-white border border-slate-200 dark:border-slate-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#0088FF]"
              >
                {database.companies.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.code} · {c.nameEn}
                  </option>
                ))}
              </select>
            </div>

            {activeModule !== 'create_invoice' && (
              <button
                onClick={() => setActiveModule('create_invoice')}
                className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-bold text-white bg-[#0088FF] rounded-lg hover:bg-blue-600 transition-colors whitespace-nowrap shrink-0"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>New Invoice</span>
              </button>
            )}
          </div>
        </header>

        {/* Main Workspace Viewport */}
        <main className="flex-1 min-w-0 px-4 sm:px-6 py-5 pb-12 max-w-[1440px] mx-auto w-full">
          {/* 1. HOME MODULE */}
          {activeModule === 'home' && (
            <ExecutiveDashboard
              companies={database.companies}
              onOpenCompanyInvoice={(companyId) => {
                handleSelectCompany(companyId);
                setActiveModule('invoices');
              }}
              onOpenCompanyStatement={(companyId) => {
                handleSelectCompany(companyId);
                setActiveModule('reports');
              }}
            />
          )}

          {/* 2. CUSTOMERS MODULE (Recipient Organizations — TO: on Invoices) */}
          {activeModule === 'customers' && (
            <CustomersView
              customers={database.customers || []}
              companies={database.companies}
              quotes={database.quotes || []}
              salesReceipts={database.salesReceipts || []}
              onUpdateCustomers={handleUpdateCustomers}
              onCascadeCustomerUpdate={handleCascadeCustomerUpdate}
              onStartInvoiceForCustomer={(customer) => {
                const targetCompany =
                  database.companies.find((c) => c.id === customer.linkedCompanyId) ||
                  activeCompany;
                handleUpdateCompany({
                  ...targetCompany,
                  clientName: customer.name,
                  defaultCustomerId: customer.id,
                });
                if (targetCompany.id !== activeCompany.id) {
                  handleSelectCompany(targetCompany.id);
                }
                setActiveModule('create_invoice');
              }}
              onShowToast={triggerToast}
            />
          )}

          {/* 3. ITEMS MODULE */}
          {activeModule === 'items' && (
            <ItemsView
              items={database.items || []}
              companies={database.companies}
              quotes={database.quotes || []}
              salesReceipts={database.salesReceipts || []}
              onUpdateItems={handleUpdateItems}
              onShowToast={triggerToast}
            />
          )}

          {/* 4. QUOTES MODULE */}
          {activeModule === 'quotes' && (
            <QuotesView
              companies={database.companies}
              activeCompany={activeCompany}
              customers={database.customers || []}
              items={database.items || []}
              quotes={database.quotes || []}
              onUpdateQuotes={handleUpdateQuotes}
              onConvertQuoteToInvoice={handleConvertQuoteToInvoice}
              onShowToast={triggerToast}
            />
          )}

          {/* 5 & 7. INVOICES, CREATE INVOICE & PAYMENTS RECEIVED */}
          {(activeModule === 'invoices' ||
            activeModule === 'create_invoice' ||
            activeModule === 'payments') && (
            <InvoiceAndLedgerWorkspace
              activeTab={activeModule as ZohoWorkspaceTab}
              onChangeTab={(t) => {
                if (t === 'statements') {
                  setActiveModule('reports');
                } else {
                  setActiveModule(t as ZohoMenuModule);
                }
              }}
              companies={database.companies}
              activeCompany={activeCompany}
              customers={database.customers || []}
              statementSummary={statementSummary}
              serviceItems={database.items || []}
              onSelectCompany={handleSelectCompany}
              onUpdateCompany={handleUpdateCompany}
              onDownloadPdf={handleDownloadPdf}
              onUploadPdfToDrive={async () => setConfirmUploadPdfModal(true)}
              exportingTarget={exportingTarget}
              isUploadingDrivePdf={isUploadingDrivePdf}
              onShowToast={triggerToast}
            />
          )}

          {/* 6. SALES RECEIPTS MODULE */}
          {activeModule === 'sales_receipts' && (
            <SalesReceiptsView
              companies={database.companies}
              activeCompany={activeCompany}
              customers={database.customers || []}
              items={database.items || []}
              receipts={database.salesReceipts || []}
              onUpdateReceipts={handleUpdateReceipts}
              onShowToast={triggerToast}
            />
          )}

          {/* 8. EXPENSES MODULE */}
          {activeModule === 'expenses' && (
            <ExpensesView
              companies={database.companies}
              activeCompany={activeCompany}
              customers={database.customers || []}
              expenses={database.expenses || []}
              onUpdateExpenses={handleUpdateExpenses}
              onShowToast={triggerToast}
            />
          )}

          {/* 9. TIME TRACKING MODULE */}
          {activeModule === 'time_tracking' && (
            <TimeTrackingView
              companies={database.companies}
              activeCompany={activeCompany}
              customers={database.customers || []}
              items={database.items || []}
              timeLogs={database.timeLogs || []}
              onUpdateTimeLogs={handleUpdateTimeLogs}
              onConvertTimeLogToInvoice={handleConvertTimeLogToInvoice}
              onShowToast={triggerToast}
            />
          )}

          {/* 10. REPORTS MODULE (Statement of Accounts & Financial Summary) */}
          {activeModule === 'reports' && (
            <ReportsView
              companies={database.companies}
              activeCompany={activeCompany}
              statementSummary={statementSummary}
              expenses={database.expenses || []}
              onSelectCompany={handleSelectCompany}
              onDownloadPdf={handleDownloadPdf}
              exportingTarget={exportingTarget}
            />
          )}

          {/* 11. ADVANCED BILLING MODULE */}
          {activeModule === 'advanced_billing' && (
            <AdvancedBillingView
              companies={database.companies}
              activeCompany={activeCompany}
              customers={database.customers || []}
              items={database.items || []}
              profiles={database.recurringProfiles || []}
              onUpdateProfiles={handleUpdateRecurringProfiles}
              onGenerateRecurringInvoice={handleGenerateRecurringInvoice}
              onShowToast={triggerToast}
            />
          )}

          {/* 12. SETTINGS MODULE (Company Pad, Google Drive Auto-Sync & Operator User Profile) */}
          {activeModule === 'settings' && (
            <div className="space-y-5">
              <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 p-3 flex flex-wrap items-center gap-2">
                <button
                  onClick={() => setSettingsSubTab('company_pads')}
                  className={`inline-flex items-center gap-1.5 px-4 py-2 rounded-lg text-xs font-bold transition-colors ${
                    settingsSubTab === 'company_pads'
                      ? 'bg-[#0088FF] text-white'
                      : 'text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800'
                  }`}
                >
                  <Building2 className="w-3.5 h-3.5" />
                  <span>Company Profile, Pad, Seal &amp; Signature</span>
                </button>
                <button
                  onClick={() => setSettingsSubTab('drive_sync')}
                  className={`inline-flex items-center gap-1.5 px-4 py-2 rounded-lg text-xs font-bold transition-colors ${
                    settingsSubTab === 'drive_sync'
                      ? 'bg-[#0088FF] text-white'
                      : 'text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800'
                  }`}
                >
                  <Cloud className="w-3.5 h-3.5" />
                  <span>Google Drive Cloud Sync &amp; JSON Backup</span>
                </button>
                <button
                  onClick={() => setSettingsSubTab('operator_profile')}
                  className={`inline-flex items-center gap-1.5 px-4 py-2 rounded-lg text-xs font-bold transition-colors ${
                    settingsSubTab === 'operator_profile'
                      ? 'bg-[#0088FF] text-white'
                      : 'text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800'
                  }`}
                >
                  <UserCheck className="w-3.5 h-3.5" />
                  <span>Operator User Profile &amp; Login Credentials</span>
                </button>
              </div>

              {settingsSubTab === 'company_pads' && (
                <CompanyPadStudioView
                  companies={database.companies}
                  activeCompany={activeCompany}
                  onSelectCompany={handleSelectCompany}
                  onUpdateCompany={handleUpdateCompany}
                  onCreateCompany={handleCreateCompany}
                  onDeleteCompany={handleDeleteCompany}
                />
              )}

              {settingsSubTab === 'drive_sync' && (
                <DriveSyncView
                  user={user}
                  isConnected={isDriveConnected}
                  isSyncing={isSyncing}
                  lastSyncedTime={lastSyncedTime}
                  driveFiles={driveFiles}
                  syncError={syncError}
                  database={database}
                  onSignIn={handleGoogleSignIn}
                  onSignOut={handleGoogleSignOut}
                  onPushToDrive={handlePushDatabaseToDrive}
                  onPullFromDrive={handlePullDatabaseFromDrive}
                  onRefreshFiles={handleRefreshDriveFiles}
                  onDeleteDriveFile={handleDeleteDriveFile}
                  onImportLocalJson={(importedDb) => {
                    setDatabase(normalizeDatabase(importedDb));
                    triggerToast('Imported backup file.');
                  }}
                />
              )}

              {settingsSubTab === 'operator_profile' && (
                <OperatorProfileSettingsView
                  profile={operatorProfile}
                  onUpdateProfile={handleUpdateOperatorProfile}
                  onShowToast={triggerToast}
                />
              )}
            </div>
          )}
        </main>
      </div>

      {/* Confirmation Dialog for Uploading PDF & Syncing DB to Google Drive */}
      {confirmUploadPdfModal && (
        <div className="no-print fixed inset-0 z-50 bg-slate-950/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 max-w-md w-full p-6 space-y-4 shadow-xl">
            <div className="flex items-start gap-3">
              <div className="p-2 rounded-lg bg-teal-50 dark:bg-teal-950/60 text-teal-700 dark:text-teal-400 shrink-0">
                <CloudUpload className="w-5 h-5" />
              </div>
              <div className="space-y-1">
                <h3 className="text-base font-bold text-slate-900 dark:text-white">
                  Save PDF &amp; Sync Data to Google Drive?
                </h3>
                <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed">
                  This will upload <strong className="font-mono-tabular">{plannedPdfFileName}</strong> and update <strong className="font-mono-tabular">bairaq_workspace_db.json</strong> inside your <strong className="font-mono-tabular">/{DRIVE_FOLDER_NAME}</strong> Google Drive folder.
                </p>
              </div>
            </div>
            <div className="flex items-center justify-end gap-2.5 pt-2">
              <button
                onClick={() => setConfirmUploadPdfModal(false)}
                className="px-4 py-2 text-xs font-semibold text-slate-700 dark:text-slate-300 bg-slate-100 dark:bg-slate-800 rounded-lg hover:bg-slate-200"
              >
                Cancel
              </button>
              <button
                onClick={executeConfirmedPdfUploadToDrive}
                className="px-4 py-2 text-xs font-semibold text-white bg-teal-700 rounded-lg hover:bg-teal-800"
              >
                Confirm Save
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Confirmation Dialog for Resetting Data */}
      {confirmResetModal && (
        <div className="no-print fixed inset-0 z-50 bg-slate-950/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 max-w-md w-full p-6 space-y-4 shadow-xl">
            <h3 className="text-base font-bold text-slate-900 dark:text-white">
              Restore Default Data?
            </h3>
            <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed">
              This will restore the default records for Green Medical Kabini and Salah Behbehani General Trading.
            </p>
            <div className="flex items-center justify-end gap-2.5 pt-2">
              <button
                onClick={() => setConfirmResetModal(false)}
                className="px-4 py-2 text-xs font-semibold text-slate-700 dark:text-slate-300 bg-slate-100 dark:bg-slate-800 rounded-lg"
              >
                Cancel
              </button>
              <button
                onClick={() => {
                  setDatabase(INITIAL_WORKSPACE_DB);
                  setConfirmResetModal(false);
                  triggerToast('Workspace reset to default records.');
                }}
                className="px-4 py-2 text-xs font-semibold text-white bg-rose-600 rounded-lg hover:bg-rose-700"
              >
                Restore
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Offline Mode Connectivity Indicator */}
      <OfflineIndicator />

      {/* Toast Notification */}
      {toastMessage && (
        <div className="no-print fixed bottom-6 right-6 z-50 flex items-center gap-2 px-4 py-3 rounded-xl shadow-lg border text-xs font-semibold bg-slate-900 text-white border-slate-700">
          {toastMessage.type === 'success' ? (
            <Check className="w-4 h-4 text-emerald-400 shrink-0" />
          ) : (
            <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />
          )}
          <span>{toastMessage.text}</span>
        </div>
      )}
    </div>
  );
}
