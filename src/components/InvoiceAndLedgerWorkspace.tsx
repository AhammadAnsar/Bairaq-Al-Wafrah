import React, { useState, useEffect } from 'react';
import {
  Plus,
  Printer,
  Download,
  Trash2,
  FileText,
  Edit3,
  Pencil,
  CreditCard,
  CloudUpload,
  Check,
  X,
  Calendar,
} from 'lucide-react';
import {
  ComputedStatementSummary,
  CustomerRecipient,
  LedgerEntry,
  ServiceCatalogItem,
  SubContractCompany,
} from '../types/billing';
import {
  computeBillingMonthAndCodeFromIsoDate,
  deriveStatementMonthCodeFromBillingMonth,
  formatFilsToKwd,
  formatIsoDateForInvoice,
  generateInvoiceNumberCode,
  getTodayIsoDate,
  parseKwdToFils,
} from '../utils/kwdMath';
import { PdfExportTarget } from '../utils/pdfGenerator';
import { A4DocumentPreview } from './A4DocumentPreview';
import { ActionConfirmModal, ActionConfirmState } from './ZohoModulesViews';

export type ZohoWorkspaceTab = 'invoices' | 'create_invoice' | 'payments' | 'statements';

interface InvoiceAndLedgerWorkspaceProps {
  activeTab: ZohoWorkspaceTab;
  onChangeTab: (tab: ZohoWorkspaceTab) => void;
  companies: SubContractCompany[];
  activeCompany: SubContractCompany;
  customers: CustomerRecipient[];
  serviceItems: ServiceCatalogItem[];
  statementSummary: ComputedStatementSummary;
  onSelectCompany: (companyId: string) => void;
  onUpdateCompany: (updated: SubContractCompany) => void;
  onDownloadPdf: (target: PdfExportTarget, customEntry?: LedgerEntry) => Promise<void>;
  onUploadPdfToDrive: () => Promise<void>;
  exportingTarget: PdfExportTarget | null;
  isUploadingDrivePdf: boolean;
  onShowToast: (text: string, type?: 'success' | 'error') => void;
}

export const InvoiceAndLedgerWorkspace: React.FC<InvoiceAndLedgerWorkspaceProps> = ({
  activeTab,
  onChangeTab,
  companies,
  activeCompany,
  customers,
  serviceItems,
  statementSummary,
  onSelectCompany,
  onUpdateCompany,
  onDownloadPdf,
  onUploadPdfToDrive,
  exportingTarget,
  isUploadingDrivePdf,
  onShowToast,
}) => {
  const [invoiceFilter, setInvoiceFilter] = useState<'all' | 'unpaid' | 'paid'>('all');
  const [previewDocMode, setPreviewDocMode] = useState<'invoice' | 'both' | 'statement'>(
    'invoice'
  );
  const [confirmModal, setConfirmModal] = useState<ActionConfirmState | null>(null);

  // Draft state for "+ New Invoice" / "Edit Invoice"
  const [isEditingExisting, setIsEditingExisting] = useState<boolean>(false);
  const [draftInvoice, setDraftInvoice] = useState<LedgerEntry>(() =>
    buildNextDraftInvoice(activeCompany)
  );
  const [draftAmountInput, setDraftAmountInput] = useState<string>('');

  // State for "Record Payment" / "Edit Payment" form with Calendar Date Picker
  const [selectedPaymentInvoiceId, setSelectedPaymentInvoiceId] = useState<string>('');
  const [paymentAmountInput, setPaymentAmountInput] = useState<string>('');
  const [paymentDateIso, setPaymentDateIso] = useState<string>(() => getTodayIsoDate());
  const [isEditingPayment, setIsEditingPayment] = useState<boolean>(false);

  function buildNextDraftInvoice(company: SubContractCompany): LedgerEntry {
    const todayIso = getTodayIsoDate();
    const lastRow = company.ledger[company.ledger.length - 1];
    const nextSeq = lastRow ? lastRow.seqNumber + 1 : 1;

    const { shortDate, longDate } = formatIsoDateForInvoice(todayIso);
    const { billingMonthFull, statementMonthCode, description } =
      computeBillingMonthAndCodeFromIsoDate(todayIso);
    const invoiceNo = generateInvoiceNumberCode(company.code, todayIso, nextSeq);

    const matchedCust =
      customers.find((c) => c.id === company.defaultCustomerId) ||
      customers.find((c) => c.name === company.clientName) ||
      customers[0];

    return {
      id: `inv-${Date.now()}`,
      seqNumber: nextSeq,
      invoiceNo,
      invoiceDate: shortDate,
      invoiceDateIso: todayIso,
      statementDateDisplay: longDate,
      monthTag: statementMonthCode,
      billingMonthFull,
      description,
      invoiceAmountFils: 0,
      receivedAmountFils: null,
      receivedDate: '',
      receivedDateIso: '',
      manualBalanceFils: null,
      customerId: matchedCust?.id,
      customerName: matchedCust?.name || company.clientName,
    };
  }

  useEffect(() => {
    if (activeTab === 'create_invoice' && !isEditingExisting) {
      const iso = draftInvoice.invoiceDateIso || getTodayIsoDate();
      const lastRow = activeCompany.ledger[activeCompany.ledger.length - 1];
      const nextSeq = lastRow ? lastRow.seqNumber + 1 : 1;
      const { shortDate, longDate } = formatIsoDateForInvoice(iso);
      const { billingMonthFull, statementMonthCode, description } =
        computeBillingMonthAndCodeFromIsoDate(iso);
      const invoiceNo = generateInvoiceNumberCode(activeCompany.code, iso, nextSeq);

      const matchedCust =
        customers.find((c) => c.id === activeCompany.defaultCustomerId) ||
        customers.find((c) => c.name === activeCompany.clientName) ||
        customers[0];

      setDraftInvoice((prev) => ({
        ...prev,
        seqNumber: nextSeq,
        invoiceNo,
        invoiceDateIso: iso,
        invoiceDate: shortDate,
        statementDateDisplay: longDate,
        monthTag: prev.monthTag || statementMonthCode,
        billingMonthFull: prev.billingMonthFull || billingMonthFull,
        description: prev.description || description,
        customerId: prev.customerId || matchedCust?.id,
        customerName: prev.customerName || matchedCust?.name || activeCompany.clientName,
      }));
    }
  }, [activeTab, activeCompany.id, isEditingExisting]);

  useEffect(() => {
    const unpaidRow =
      [...activeCompany.ledger]
        .reverse()
        .find((r) => !r.receivedAmountFils || r.receivedAmountFils < r.invoiceAmountFils) ||
      activeCompany.ledger[activeCompany.ledger.length - 1];

    if (unpaidRow) {
      setSelectedPaymentInvoiceId(unpaidRow.id);
      const dueFils = Math.max(
        0,
        unpaidRow.invoiceAmountFils - (unpaidRow.receivedAmountFils || 0)
      );
      setPaymentAmountInput(
        dueFils > 0
          ? formatFilsToKwd(dueFils)
          : formatFilsToKwd(unpaidRow.invoiceAmountFils)
      );
      setPaymentDateIso(unpaidRow.receivedDateIso || getTodayIsoDate());
    } else {
      setSelectedPaymentInvoiceId('');
      setPaymentAmountInput('');
    }
  }, [activeCompany.id, activeCompany.ledger.length, activeTab]);

  const activeEntry: LedgerEntry | undefined =
    activeCompany.ledger.find((r) => r.id === activeCompany.activeLedgerEntryId) ||
    activeCompany.ledger[activeCompany.ledger.length - 1];

  /**
   * When the user selects a date on the Calendar in Create Invoice:
   * 1. Formats Invoice Date (e.g. 09-Nov-2026)
   * 2. Sets Billing Month (For Invoice Text) to the PREVIOUS month (e.g. October 2026)
   * 3. Sets Statement Month Code to [No of Month]-[First 3 Letters] (e.g. 10-Oct)
   * 4. Sets Invoice No to [Company Shortcode][YYMMXXX] (e.g. GMK2611013)
   */
  const handleCalendarDateChange = (newIsoDate: string) => {
    if (!newIsoDate) return;
    const { shortDate, longDate } = formatIsoDateForInvoice(newIsoDate);
    const { billingMonthFull, statementMonthCode, description } =
      computeBillingMonthAndCodeFromIsoDate(newIsoDate);
    const autoInvoiceNo = generateInvoiceNumberCode(
      activeCompany.code,
      newIsoDate,
      draftInvoice.seqNumber
    );

    setDraftInvoice((prev) => ({
      ...prev,
      invoiceDateIso: newIsoDate,
      invoiceDate: shortDate,
      statementDateDisplay: longDate,
      invoiceNo: isEditingExisting ? prev.invoiceNo : autoInvoiceNo,
      billingMonthFull,
      monthTag: statementMonthCode,
      description,
    }));
  };

  /**
   * When the user manually edits the Billing Month (For Invoice Text) field:
   * Automatically updates the Statement Month Code ([No of Month]-[Month First 3 letter]) and description.
   */
  const handleBillingMonthTextChange = (newMonthText: string) => {
    const derivedCode = deriveStatementMonthCodeFromBillingMonth(
      newMonthText,
      draftInvoice.monthTag
    );
    setDraftInvoice((prev) => ({
      ...prev,
      billingMonthFull: newMonthText,
      monthTag: derivedCode,
      description: `Charges for Manpower Supplied for the month of ${newMonthText.replace(
        ' ',
        ' - '
      )}`,
    }));
  };

  const handleSelectCatalogItem = (itemId: string) => {
    const found = serviceItems.find((i) => i.id === itemId);
    if (!found) {
      setDraftInvoice((prev) => ({ ...prev, itemId: undefined }));
      return;
    }
    const desc = found.descriptionTemplate.replace(
      '{MONTH}',
      draftInvoice.billingMonthFull.replace(' ', ' - ')
    );
    setDraftInvoice((prev) => ({
      ...prev,
      itemId: found.id,
      description: desc,
    }));
    if (found.defaultRateFils > 0) {
      setDraftAmountInput(formatFilsToKwd(found.defaultRateFils));
    }
  };

  const handleSelectSavedInvoice = (entryId: string) => {
    onUpdateCompany({
      ...activeCompany,
      activeLedgerEntryId: entryId,
    });
  };

  const handleOpenEditInvoiceForm = (entry: LedgerEntry) => {
    setIsEditingExisting(true);
    setDraftInvoice({
      ...entry,
      invoiceDateIso: entry.invoiceDateIso || getTodayIsoDate(),
    });
    setDraftAmountInput(formatFilsToKwd(entry.invoiceAmountFils));
    onChangeTab('create_invoice');
  };

  const handleSaveInvoiceForm = async (downloadMode?: PdfExportTarget) => {
    const amountFils = parseKwdToFils(draftAmountInput);
    const iso = draftInvoice.invoiceDateIso || getTodayIsoDate();
    const { shortDate, longDate } = formatIsoDateForInvoice(iso);

    const matchedCust = customers.find(
      (c) =>
        c.id === draftInvoice.customerId ||
        c.name.toLowerCase() === (draftInvoice.customerName || '').trim().toLowerCase()
    );

    const finalEntry: LedgerEntry = {
      ...draftInvoice,
      customerId: matchedCust?.id || draftInvoice.customerId,
      customerName: matchedCust?.name || draftInvoice.customerName || activeCompany.clientName,
      invoiceNo:
        draftInvoice.invoiceNo.trim() ||
        generateInvoiceNumberCode(activeCompany.code, iso, draftInvoice.seqNumber),
      invoiceDateIso: iso,
      invoiceDate: draftInvoice.invoiceDate.trim() || shortDate,
      statementDateDisplay: draftInvoice.statementDateDisplay?.trim() || longDate,
      invoiceAmountFils: amountFils,
    };

    const exists = activeCompany.ledger.some((r) => r.id === finalEntry.id);
    const updatedLedger = exists
      ? activeCompany.ledger.map((r) => (r.id === finalEntry.id ? finalEntry : r))
      : [...activeCompany.ledger, finalEntry];

    const updatedCompany: SubContractCompany = {
      ...activeCompany,
      activeLedgerEntryId: finalEntry.id,
      ledger: updatedLedger,
    };

    onUpdateCompany(updatedCompany);
    setIsEditingExisting(false);
    setPreviewDocMode('invoice');
    onShowToast(
      exists
        ? `Invoice ${finalEntry.invoiceNo} updated.`
        : `Invoice ${finalEntry.invoiceNo} saved! Ready for preview & PDF download.`
    );
    onChangeTab('invoices');

    if (downloadMode) {
      await onDownloadPdf(downloadMode, finalEntry);
    }
  };

  const handleDeleteInvoice = (entry: LedgerEntry) => {
    setConfirmModal({
      title: 'Delete Invoice Record?',
      description: `Are you sure you want to delete Invoice ${entry.invoiceNo} (${entry.monthTag} · KWD ${formatFilsToKwd(entry.invoiceAmountFils)}) from ${activeCompany.nameEn}? ${activeCompany.ledger.length === 1 ? 'This is the last invoice in this company ledger and deleting it will leave the ledger empty (0 invoices).' : 'This will also recalculate the Statement of Accounts.'}`,
      confirmLabel: 'Confirm Delete',
      variant: 'danger',
      onConfirm: () => {
        const filtered = activeCompany.ledger
          .filter((r) => r.id !== entry.id)
          .map((r, index) => ({ ...r, seqNumber: index + 1 }));
        const nextActiveId =
          filtered.length === 0
            ? ''
            : activeCompany.activeLedgerEntryId === entry.id
              ? filtered[filtered.length - 1].id
              : activeCompany.activeLedgerEntryId;

        onUpdateCompany({
          ...activeCompany,
          activeLedgerEntryId: nextActiveId,
          ledger: filtered,
        });
        onShowToast(`Deleted Invoice ${entry.invoiceNo}.`);
      },
    });
  };

  const handleDeleteAllInvoices = () => {
    if (activeCompany.ledger.length === 0) return;
    setConfirmModal({
      title: `Delete All Invoices (${activeCompany.ledger.length})?`,
      description: `Are you sure you want to delete all ${activeCompany.ledger.length} invoices for ${activeCompany.nameEn}? The ledger will be completely cleared (0 invoices).`,
      confirmLabel: 'Delete All Invoices',
      variant: 'danger',
      onConfirm: () => {
        onUpdateCompany({
          ...activeCompany,
          activeLedgerEntryId: '',
          ledger: [],
        });
        onShowToast(`Cleared all invoices for ${activeCompany.nameEn}.`);
      },
    });
  };

  const handleJumpToRecordPaymentForInvoice = (entry: LedgerEntry) => {
    setSelectedPaymentInvoiceId(entry.id);
    const hasPayment =
      entry.receivedAmountFils !== null && entry.receivedAmountFils > 0;
    setIsEditingPayment(hasPayment);
    if (hasPayment) {
      setPaymentAmountInput(formatFilsToKwd(entry.receivedAmountFils));
      setPaymentDateIso(entry.receivedDateIso || getTodayIsoDate());
    } else {
      const dueFils = Math.max(
        0,
        entry.invoiceAmountFils - (entry.receivedAmountFils || 0)
      );
      setPaymentAmountInput(
        dueFils > 0 ? formatFilsToKwd(dueFils) : formatFilsToKwd(entry.invoiceAmountFils)
      );
      setPaymentDateIso(entry.receivedDateIso || getTodayIsoDate());
    }
    onChangeTab('payments');
  };

  const handleSelectPaymentInvoiceDropdown = (entryId: string, editMode = false) => {
    setSelectedPaymentInvoiceId(entryId);
    setIsEditingPayment(editMode);
    const target = activeCompany.ledger.find((r) => r.id === entryId);
    if (target) {
      if (editMode && target.receivedAmountFils) {
        setPaymentAmountInput(formatFilsToKwd(target.receivedAmountFils));
        setPaymentDateIso(target.receivedDateIso || getTodayIsoDate());
      } else {
        const dueFils = Math.max(
          0,
          target.invoiceAmountFils - (target.receivedAmountFils || 0)
        );
        setPaymentAmountInput(
          dueFils > 0 ? formatFilsToKwd(dueFils) : formatFilsToKwd(target.invoiceAmountFils)
        );
        setPaymentDateIso(target.receivedDateIso || getTodayIsoDate());
      }
    }
  };

  const handleSavePayment = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedPaymentInvoiceId) return;
    const receivedFils = parseKwdToFils(paymentAmountInput);
    const { shortDate } = formatIsoDateForInvoice(paymentDateIso);

    const updatedLedger = activeCompany.ledger.map((row) =>
      row.id === selectedPaymentInvoiceId
        ? {
            ...row,
            receivedAmountFils: receivedFils > 0 ? receivedFils : null,
            receivedDate: receivedFils > 0 ? shortDate : '',
            receivedDateIso: receivedFils > 0 ? paymentDateIso : '',
          }
        : row
    );

    onUpdateCompany({
      ...activeCompany,
      activeLedgerEntryId: selectedPaymentInvoiceId,
      ledger: updatedLedger,
    });

    const targetInv = activeCompany.ledger.find((r) => r.id === selectedPaymentInvoiceId);
    setIsEditingPayment(false);
    onShowToast(
      `${isEditingPayment ? 'Updated' : 'Recorded'} payment of KWD ${formatFilsToKwd(receivedFils)} on ${shortDate} for Invoice #${
        targetInv?.invoiceNo || ''
      }. Statement updated.`
    );
  };

  const handleClearPayment = (entry: LedgerEntry) => {
    setConfirmModal({
      title: 'Delete Recorded Payment?',
      description: `Are you sure you want to delete the payment of KWD ${formatFilsToKwd(entry.receivedAmountFils)} recorded on ${entry.receivedDate || '—'} for Invoice ${entry.invoiceNo}?`,
      confirmLabel: 'Confirm Delete',
      variant: 'danger',
      onConfirm: () => {
        const updatedLedger = activeCompany.ledger.map((row) =>
          row.id === entry.id
            ? {
                ...row,
                receivedAmountFils: null,
                receivedDate: '',
                receivedDateIso: '',
              }
            : row
        );
        onUpdateCompany({
          ...activeCompany,
          ledger: updatedLedger,
        });
        if (selectedPaymentInvoiceId === entry.id) {
          setIsEditingPayment(false);
        }
        onShowToast(`Payment deleted for Invoice ${entry.invoiceNo}.`);
      },
    });
  };

  const filteredInvoices = [...activeCompany.ledger].reverse().filter((entry) => {
    const isPaid =
      entry.receivedAmountFils !== null &&
      entry.receivedAmountFils >= entry.invoiceAmountFils;
    if (invoiceFilter === 'paid') return isPaid;
    if (invoiceFilter === 'unpaid') return !isPaid;
    return true;
  });

  // =========================================================================
  // VIEW 1: ZOHO "+ NEW INVOICE" / "EDIT INVOICE" CREATION SCREEN
  // =========================================================================
  if (activeTab === 'create_invoice') {
    const livePreviewDraft: LedgerEntry = {
      ...draftInvoice,
      invoiceAmountFils: parseKwdToFils(draftAmountInput),
    };

    return (
      <div className="grid grid-cols-1 xl:grid-cols-12 gap-6 items-start">
        {/* Left: Zoho Invoice Form with Calendar Picker & Auto-Formulas */}
        <div className="no-print xl:col-span-6 bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 overflow-hidden shadow-2xs">
          <div className="px-6 py-4 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between bg-slate-50/60 dark:bg-slate-800/40">
            <div className="flex items-center gap-2">
              <FileText className="w-4 h-4 text-sky-600" />
              <h2 className="text-base font-bold text-slate-900 dark:text-white">
                {isEditingExisting
                  ? `Edit Invoice (${draftInvoice.invoiceNo})`
                  : 'New Invoice'}
              </h2>
            </div>
            <button
              onClick={() => {
                setIsEditingExisting(false);
                onChangeTab('invoices');
              }}
              className="p-1.5 text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 rounded-lg"
              title="Close form"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          <div className="p-6 space-y-5">
            {/* 1. Sub-Contract Client Pad (From / On Behalf Of) & 2. Customer (TO: / Billed To) */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                  Sub-Contract Client Pad (On Behalf Of)*
                </label>
                <select
                  value={activeCompany.id}
                  onChange={(e) => {
                    const nextCompId = e.target.value;
                    const targetComp = companies.find((c) => c.id === nextCompId);
                    onSelectCompany(nextCompId);
                    if (targetComp && !isEditingExisting) {
                      const iso = draftInvoice.invoiceDateIso || getTodayIsoDate();
                      const lastRow = targetComp.ledger[targetComp.ledger.length - 1];
                      const nextSeq = lastRow ? lastRow.seqNumber + 1 : 1;
                      setDraftInvoice((prev) => ({
                        ...prev,
                        seqNumber: nextSeq,
                        invoiceNo: generateInvoiceNumberCode(targetComp.code, iso, nextSeq),
                      }));
                    }
                  }}
                  className="w-full px-3.5 py-2 text-sm font-bold bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-sky-600"
                >
                  {companies.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.code} · {c.nameEn}
                    </option>
                  ))}
                </select>
                <span className="text-[11px] text-slate-500 mt-1 block">
                  Uses {activeCompany.nameEn}&apos;s Pad, Seal, Sign &amp; Bank info
                </span>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                  Select Customer (TO: / Project Billed To)*
                </label>
                {customers.length > 0 && (
                  <select
                    value={
                      draftInvoice.customerId ||
                      customers.find(
                        (cust) =>
                          cust.name ===
                          (draftInvoice.customerName || activeCompany.clientName)
                      )?.id ||
                      ''
                    }
                    onChange={(e) => {
                      const chosenCust = customers.find((c) => c.id === e.target.value);
                      if (!chosenCust) return;
                      setDraftInvoice((prev) => ({
                        ...prev,
                        customerId: chosenCust.id,
                        customerName: chosenCust.name,
                      }));
                      onUpdateCompany({
                        ...activeCompany,
                        defaultCustomerId: chosenCust.id,
                        clientName: chosenCust.name,
                      });
                    }}
                    className="w-full px-3.5 py-2 text-xs font-semibold bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg mb-2 focus:outline-none focus:ring-2 focus:ring-sky-600"
                  >
                    <option value="">-- Choose from Customers Directory --</option>
                    {customers.map((cust) => (
                      <option key={cust.id} value={cust.id}>
                        {cust.name} ({cust.projectTitle})
                      </option>
                    ))}
                  </select>
                )}
                <input
                  type="text"
                  value={draftInvoice.customerName ?? activeCompany.clientName}
                  onChange={(e) => {
                    const val = e.target.value;
                    setDraftInvoice((prev) => ({ ...prev, customerName: val }));
                    onUpdateCompany({
                      ...activeCompany,
                      clientName: val,
                    });
                  }}
                  placeholder="e.g. M/S. Talabat General Trading Company"
                  className="w-full px-3.5 py-2 text-sm font-medium bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-sky-600"
                />
              </div>
            </div>

            {/* Calendar Invoice Date & Auto-Generated Invoice# [Company Shortcode][YYMMXXX] */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-rose-600 dark:text-rose-400 mb-1.5">
                  Invoice Date (Calendar)*
                </label>
                <div className="relative">
                  <input
                    type="date"
                    value={draftInvoice.invoiceDateIso || getTodayIsoDate()}
                    onChange={(e) => handleCalendarDateChange(e.target.value)}
                    className="w-full px-3.5 py-2 text-sm font-mono-tabular bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-sky-600"
                  />
                </div>
                <span className="text-[11px] text-slate-500 mt-1 block font-mono-tabular">
                  Printed on Invoice: {draftInvoice.invoiceDate}
                </span>
              </div>

              <div>
                <label className="block text-xs font-semibold text-rose-600 dark:text-rose-400 mb-1.5">
                  Invoice# ([Shortcode][YYMMXXX])*
                </label>
                <input
                  type="text"
                  value={draftInvoice.invoiceNo}
                  onChange={(e) =>
                    setDraftInvoice({ ...draftInvoice, invoiceNo: e.target.value })
                  }
                  placeholder="e.g. GMK2611013"
                  className="w-full px-3.5 py-2 text-sm font-bold font-mono-tabular bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-sky-600"
                />
                <span className="text-[11px] text-slate-500 mt-1 block">
                  Auto-formatted from {activeCompany.code} + YYMM + Serial
                </span>
              </div>
            </div>

            {/* Billing Month (Auto Previous Month) & Statement Month Code [No of Month][Month First 3 letter] */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div className="sm:col-span-2">
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                  Billing Month (For Invoice Text)
                </label>
                <input
                  type="text"
                  value={draftInvoice.billingMonthFull}
                  onChange={(e) => handleBillingMonthTextChange(e.target.value)}
                  placeholder="October 2026"
                  className="w-full px-3.5 py-2 text-sm font-semibold bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-sky-600"
                />
                <span className="text-[11px] text-slate-500 mt-1 block">
                  Automatically set to previous month of selected date (editable)
                </span>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                  Statement Month Code
                </label>
                <input
                  type="text"
                  value={draftInvoice.monthTag}
                  onChange={(e) =>
                    setDraftInvoice({ ...draftInvoice, monthTag: e.target.value })
                  }
                  placeholder="10-Oct"
                  className="w-full px-3.5 py-2 text-sm font-bold font-mono-tabular bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-sky-600"
                />
                <span className="text-[11px] text-slate-500 mt-1 block">
                  Format: [Month#]-[MMM]
                </span>
              </div>
            </div>

            {/* Quick Item Picker from Zoho Items Catalog */}
            {serviceItems.length > 0 && (
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                  Select Service Item from Catalog (Relational Link)
                </label>
                <select
                  value={draftInvoice.itemId || ''}
                  onChange={(e) => handleSelectCatalogItem(e.target.value)}
                  className="w-full px-3.5 py-2 text-xs font-semibold bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg"
                >
                  <option value="">-- Choose from Items Catalog or type below --</option>
                  {serviceItems.map((it) => (
                    <option key={it.id} value={it.id}>
                      {it.name} ({formatFilsToKwd(it.defaultRateFils)} KWD)
                    </option>
                  ))}
                </select>
              </div>
            )}

            {/* Zoho Line Item Table */}
            <div className="border border-slate-200 dark:border-slate-700 rounded-xl overflow-hidden">
              <div className="grid grid-cols-12 bg-slate-100 dark:bg-slate-800 text-xs font-bold text-slate-700 dark:text-slate-300 border-b border-slate-200 dark:border-slate-700">
                <div className="col-span-7 py-2.5 px-3.5 border-r border-slate-200 dark:border-slate-700">
                  Item Details / Description
                </div>
                <div className="col-span-5 py-2.5 px-3.5 text-right">
                  Amount in KWD*
                </div>
              </div>

              <div className="grid grid-cols-12 items-start bg-white dark:bg-slate-900">
                <div className="col-span-7 p-3 border-r border-slate-200 dark:border-slate-700">
                  <textarea
                    rows={3}
                    value={draftInvoice.description}
                    onChange={(e) =>
                      setDraftInvoice({ ...draftInvoice, description: e.target.value })
                    }
                    className="w-full p-2 text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg focus:outline-none focus:ring-1 focus:ring-sky-600"
                  />
                </div>
                <div className="col-span-5 p-3">
                  <input
                    type="number"
                    step="0.001"
                    placeholder="0.000"
                    value={draftAmountInput}
                    onChange={(e) => setDraftAmountInput(e.target.value)}
                    autoFocus
                    className="w-full px-3 py-2.5 text-right text-base font-bold font-mono-tabular bg-sky-50/50 dark:bg-sky-950/40 border border-sky-300 dark:border-sky-700 rounded-lg text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-sky-600"
                  />
                </div>
              </div>

              <div className="bg-slate-50 dark:bg-slate-800/60 px-4 py-3 border-t border-slate-200 dark:border-slate-700 flex items-center justify-between text-sm font-bold">
                <span className="text-slate-600 dark:text-slate-400">Total Invoice Amount</span>
                <span className="font-mono-tabular text-base text-slate-900 dark:text-white">
                  KWD {formatFilsToKwd(parseKwdToFils(draftAmountInput), true)}
                </span>
              </div>
            </div>
          </div>

          {/* Zoho Sticky Bottom Save Bar: One Primary Action + Cancel */}
          <div className="px-6 py-4 bg-slate-50 dark:bg-slate-800/80 border-t border-slate-200 dark:border-slate-800 flex items-center justify-between gap-3">
            <button
              type="button"
              onClick={() => handleSaveInvoiceForm()}
              className="inline-flex items-center gap-1.5 px-5 py-2.5 text-xs font-bold text-white bg-[#0088FF] rounded-lg hover:bg-blue-600 transition-colors shadow-2xs whitespace-nowrap shrink-0"
            >
              <Check className="w-4 h-4" />
              Save Invoice
            </button>

            <button
              type="button"
              onClick={() => {
                setIsEditingExisting(false);
                onChangeTab('invoices');
              }}
              className="px-4 py-2 text-xs font-semibold text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white"
            >
              Cancel
            </button>
          </div>
        </div>

        {/* Right: Live Shrink-to-Fit A4 Draft Preview */}
        <div className="xl:col-span-6 space-y-3">
          <div className="no-print bg-white dark:bg-slate-900 px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-800 flex items-center justify-between text-xs">
            <span className="font-semibold text-slate-700 dark:text-slate-300">
              Live A4 Invoice Preview (Shrink-to-Fit)
            </span>
            <span className="font-mono-tabular text-slate-500">
              {livePreviewDraft.invoiceNo} · {livePreviewDraft.monthTag} · KWD{' '}
              {formatFilsToKwd(livePreviewDraft.invoiceAmountFils)}
            </span>
          </div>

          <div className="bg-slate-200/70 dark:bg-slate-900/80 rounded-xl border border-slate-300 dark:border-slate-800 p-3 sm:p-5">
            <A4DocumentPreview
              company={activeCompany}
              activeEntry={livePreviewDraft}
              statementSummary={statementSummary}
              viewMode="invoice"
            />
          </div>
        </div>
      </div>
    );
  }

  // =========================================================================
  // VIEW 2: ZOHO PAYMENTS RECEIVED MODULE (With Calendar Date Picker)
  // =========================================================================
  if (activeTab === 'payments') {
    const selectedTargetInvoice =
      activeCompany.ledger.find((r) => r.id === selectedPaymentInvoiceId) || activeEntry;

    const paidEntries = [...activeCompany.ledger]
      .reverse()
      .filter((r) => r.receivedAmountFils !== null && r.receivedAmountFils > 0);

    return (
      <div className="grid grid-cols-1 xl:grid-cols-12 gap-6 items-start">
        <ActionConfirmModal
          state={confirmModal}
          onClose={() => setConfirmModal(null)}
        />
        <div className="no-print xl:col-span-5 space-y-5">
          <form
            onSubmit={handleSavePayment}
            className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 overflow-hidden shadow-2xs"
          >
            <div className="px-5 py-4 border-b border-slate-200 dark:border-slate-800 bg-slate-50/60 dark:bg-slate-800/40 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <CreditCard className="w-4 h-4 text-sky-600" />
                <h2 className="text-sm font-bold text-slate-900 dark:text-white">
                  {isEditingPayment
                    ? `Edit Payment (${selectedTargetInvoice?.invoiceNo || ''})`
                    : 'Record Payment Received'}
                </h2>
              </div>
              {isEditingPayment ? (
                <button
                  type="button"
                  onClick={() => setIsEditingPayment(false)}
                  className="text-xs font-semibold text-slate-500 hover:text-slate-900 dark:hover:text-white"
                >
                  Cancel
                </button>
              ) : (
                <span className="text-xs text-slate-500">{activeCompany.nameEn}</span>
              )}
            </div>

            <div className="p-5 space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                  Select Invoice*
                </label>
                <select
                  value={selectedPaymentInvoiceId}
                  onChange={(e) => handleSelectPaymentInvoiceDropdown(e.target.value, false)}
                  className="w-full px-3 py-2.5 text-xs font-semibold font-mono-tabular bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-sky-600"
                >
                  {[...activeCompany.ledger].reverse().map((inv) => {
                    const isPaid =
                      inv.receivedAmountFils !== null &&
                      inv.receivedAmountFils >= inv.invoiceAmountFils;
                    return (
                      <option key={inv.id} value={inv.id}>
                        #{inv.seqNumber} · {inv.invoiceNo} ({inv.monthTag}) — Bill:{' '}
                        {formatFilsToKwd(inv.invoiceAmountFils)} KWD [
                        {isPaid
                          ? 'PAID'
                          : inv.receivedAmountFils
                            ? 'PARTIAL'
                            : 'UNPAID'}
                        ]
                      </option>
                    );
                  })}
                </select>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <label className="text-xs font-bold text-sky-700 dark:text-sky-400">
                      Amount Received (KWD)*
                    </label>
                    {selectedTargetInvoice && (
                      <button
                        type="button"
                        onClick={() =>
                          setPaymentAmountInput(
                            formatFilsToKwd(selectedTargetInvoice.invoiceAmountFils)
                          )
                        }
                        className="text-[11px] font-semibold text-sky-600 hover:underline"
                      >
                        Full ({formatFilsToKwd(selectedTargetInvoice.invoiceAmountFils)})
                      </button>
                    )}
                  </div>
                  <input
                    type="number"
                    step="0.001"
                    placeholder="0.000"
                    value={paymentAmountInput}
                    onChange={(e) => setPaymentAmountInput(e.target.value)}
                    required
                    className="w-full px-3.5 py-2 text-sm font-bold font-mono-tabular bg-sky-50/50 dark:bg-sky-950/30 border border-sky-300 dark:border-sky-700 rounded-lg text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-sky-600"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                    Payment Date (Calendar)*
                  </label>
                  <input
                    type="date"
                    value={paymentDateIso}
                    onChange={(e) => setPaymentDateIso(e.target.value)}
                    required
                    className="w-full px-3.5 py-2 text-sm font-mono-tabular bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-sky-600"
                  />
                  <span className="text-[11px] text-slate-500 mt-1 block font-mono-tabular">
                    Statement Date: {formatIsoDateForInvoice(paymentDateIso).shortDate}
                  </span>
                </div>
              </div>
            </div>

            <div className="px-5 py-3.5 bg-slate-50 dark:bg-slate-800/80 border-t border-slate-200 dark:border-slate-800 flex items-center justify-between gap-2">
              <span className="text-xs text-slate-500">
                Automatically updates Statement of Accounts
              </span>
              <div className="flex items-center gap-2">
                <button
                  type="submit"
                  className="inline-flex items-center gap-1.5 px-5 py-2 text-xs font-bold text-white bg-sky-600 rounded-lg hover:bg-sky-700 transition-colors shadow-2xs whitespace-nowrap shrink-0"
                >
                  <Check className="w-4 h-4" />
                  {isEditingPayment ? 'Update Payment' : 'Save Payment'}
                </button>
                {isEditingPayment && (
                  <button
                    type="button"
                    onClick={() => setIsEditingPayment(false)}
                    className="px-3 py-2 text-xs font-semibold text-slate-600 dark:text-slate-300 bg-slate-200/70 dark:bg-slate-700 rounded-lg"
                  >
                    Cancel
                  </button>
                )}
              </div>
            </div>
          </form>

          {/* Recorded Payments List */}
          <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 overflow-hidden">
            <div className="px-5 py-3.5 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between">
              <h3 className="text-xs font-bold text-slate-700 dark:text-slate-300">
                Payments Received History ({paidEntries.length})
              </h3>
              <span className="text-xs font-mono-tabular font-semibold text-emerald-700 dark:text-emerald-400">
                Total: KWD {formatFilsToKwd(statementSummary.totalReceivedFils, true)}
              </span>
            </div>

            <div className="divide-y divide-slate-100 dark:divide-slate-800 max-h-[380px] overflow-y-auto">
              {paidEntries.map((entry) => (
                <div
                  key={entry.id}
                  onClick={() => handleSelectPaymentInvoiceDropdown(entry.id, true)}
                  className={`px-5 py-3 flex items-center justify-between gap-3 hover:bg-slate-50 dark:hover:bg-slate-800/40 cursor-pointer ${
                    isEditingPayment && selectedPaymentInvoiceId === entry.id
                      ? 'bg-sky-50/70 dark:bg-sky-950/30'
                      : ''
                  }`}
                >
                  <div>
                    <div className="text-xs font-bold font-mono-tabular text-slate-900 dark:text-white">
                      #{entry.seqNumber} · {entry.invoiceNo} ({entry.monthTag})
                    </div>
                    <div className="text-[11px] text-slate-500 mt-0.5">
                      Received on:{' '}
                      <span className="font-mono-tabular">{entry.receivedDate || '—'}</span>
                    </div>
                  </div>

                  <div
                    className="flex items-center gap-2 shrink-0"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <span className="text-xs font-bold font-mono-tabular text-emerald-700 dark:text-emerald-400 mr-1">
                      KWD {formatFilsToKwd(entry.receivedAmountFils)}
                    </span>
                    <button
                      onClick={() => handleSelectPaymentInvoiceDropdown(entry.id, true)}
                      className="inline-flex items-center gap-1 px-2 py-1 text-xs font-semibold text-slate-700 dark:text-slate-200 bg-slate-100 dark:bg-slate-800 rounded-md hover:bg-slate-200"
                      title="Edit payment"
                    >
                      <Pencil className="w-3 h-3" />
                      Edit
                    </button>
                    <button
                      onClick={() => handleClearPayment(entry)}
                      className="p-1.5 text-slate-400 hover:text-rose-600 rounded-md"
                      title="Delete payment"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Right: Auto-Updated Shrink-to-Fit Statement of Accounts Preview */}
        <div className="xl:col-span-7 space-y-3">
          <div className="no-print bg-white dark:bg-slate-900 px-4 py-3 rounded-xl border border-slate-200 dark:border-slate-800 flex flex-wrap items-center justify-between gap-3">
            <div>
              <div className="text-xs font-bold text-slate-900 dark:text-white">
                Auto-Generated Statement of Accounts
              </div>
              <div className="text-[11px] text-slate-500 font-mono-tabular">
                Balance Due: KWD{' '}
                {formatFilsToKwd(statementSummary.netOutstandingBalanceFils, true)}
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <button
                onClick={() => onDownloadPdf('statement')}
                disabled={exportingTarget !== null}
                className="inline-flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-semibold text-white bg-sky-600 rounded-lg hover:bg-sky-700 transition-colors whitespace-nowrap shrink-0 disabled:opacity-50"
              >
                <Download className="w-3.5 h-3.5" />
                {exportingTarget === 'statement'
                  ? 'Downloading...'
                  : 'Download Statement PDF'}
              </button>

              <button
                onClick={() => onDownloadPdf('both')}
                disabled={exportingTarget !== null}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-slate-700 dark:text-slate-200 bg-slate-100 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg hover:bg-slate-200 transition-colors whitespace-nowrap shrink-0 disabled:opacity-50"
              >
                <Download className="w-3.5 h-3.5" />
                Download Invoice with Statement
              </button>

              <button
                onClick={() => window.print()}
                className="p-1.5 text-slate-600 dark:text-slate-300 bg-slate-100 dark:bg-slate-800 rounded-lg hover:bg-slate-200"
                title="Print Statement"
              >
                <Printer className="w-4 h-4" />
              </button>
            </div>
          </div>

          <div className="bg-slate-200/70 dark:bg-slate-900/80 rounded-xl border border-slate-300 dark:border-slate-800 p-3 sm:p-5">
            <A4DocumentPreview
              company={activeCompany}
              activeEntry={activeEntry}
              statementSummary={statementSummary}
              viewMode="statement"
            />
          </div>
        </div>
      </div>
    );
  }

  // =========================================================================
  // VIEW 3: ZOHO STATEMENT OF ACCOUNTS DEDICATED VIEW
  // =========================================================================
  if (activeTab === 'statements') {
    return (
      <div className="space-y-5">
        <div className="no-print bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 p-5 flex flex-wrap items-center justify-between gap-4">
          <div className="space-y-1">
            <div className="text-xs text-slate-500">
              <span>Statement of Accounts</span>
              <span className="mx-2">·</span>
              <span>{activeCompany.clientName}</span>
            </div>
            <div className="flex flex-wrap items-center gap-6 pt-1">
              <div>
                <span className="text-xs text-slate-500 block">Total Invoiced</span>
                <span className="text-base font-bold font-mono-tabular text-slate-900 dark:text-white">
                  KWD {formatFilsToKwd(statementSummary.displayTotalInvoicedFils, true)}
                </span>
              </div>
              <div>
                <span className="text-xs text-slate-500 block">Amount Received</span>
                <span className="text-base font-bold font-mono-tabular text-emerald-700 dark:text-emerald-400">
                  KWD {formatFilsToKwd(statementSummary.totalReceivedFils, true)}
                </span>
              </div>
              <div>
                <span className="text-xs text-slate-500 block">Balance Due</span>
                <span className="text-base font-bold font-mono-tabular text-amber-700 dark:text-amber-400">
                  KWD {formatFilsToKwd(statementSummary.netOutstandingBalanceFils, true)}
                </span>
              </div>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2.5">
            <button
              onClick={() => onChangeTab('payments')}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold text-sky-800 dark:text-sky-200 bg-sky-50 dark:bg-sky-950/60 border border-sky-200 dark:border-sky-800 rounded-lg hover:bg-sky-100 whitespace-nowrap shrink-0"
            >
              <CreditCard className="w-3.5 h-3.5" />
              Record Payment
            </button>

            <button
              onClick={() => onDownloadPdf('statement')}
              disabled={exportingTarget !== null}
              className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-bold text-white bg-sky-600 rounded-lg hover:bg-sky-700 whitespace-nowrap shrink-0 disabled:opacity-50"
            >
              <Download className="w-3.5 h-3.5" />
              {exportingTarget === 'statement'
                ? 'Downloading...'
                : 'Download Statement PDF'}
            </button>

            <button
              onClick={() => onDownloadPdf('both')}
              disabled={exportingTarget !== null}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold text-slate-700 dark:text-slate-200 bg-slate-100 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg hover:bg-slate-200 whitespace-nowrap shrink-0 disabled:opacity-50"
            >
              <Download className="w-3.5 h-3.5" />
              Download Invoice with Statement
            </button>

            <button
              onClick={() => window.print()}
              className="p-2 text-slate-600 dark:text-slate-300 bg-slate-100 dark:bg-slate-800 rounded-lg hover:bg-slate-200"
              title="Print Statement"
            >
              <Printer className="w-4 h-4" />
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 xl:grid-cols-12 gap-6 items-start">
          <div className="no-print xl:col-span-5 bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 p-4 overflow-x-auto">
            <h3 className="text-xs font-bold text-slate-800 dark:text-slate-200 mb-3">
              Statement Transactions ({statementSummary.rows.length})
            </h3>
            <table className="w-full text-xs border-collapse">
              <thead>
                <tr className="border-b border-slate-200 dark:border-slate-800 text-slate-500 font-semibold text-left">
                  <th className="py-2 px-1.5">#</th>
                  <th className="py-2 px-1.5">Date</th>
                  <th className="py-2 px-1.5">Month</th>
                  <th className="py-2 px-1.5 text-right">Invoiced</th>
                  <th className="py-2 px-1.5 text-right">Received</th>
                  <th className="py-2 px-1.5 text-right">Balance</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {statementSummary.rows.map((r) => (
                  <tr
                    key={r.entry.id}
                    onClick={() => handleJumpToRecordPaymentForInvoice(r.entry)}
                    className="hover:bg-slate-50 dark:hover:bg-slate-800/40 cursor-pointer"
                    title="Click to record or edit payment"
                  >
                    <td className="py-2 px-1.5 font-mono-tabular font-bold">
                      {r.entry.seqNumber}
                    </td>
                    <td className="py-2 px-1.5 font-mono-tabular whitespace-nowrap">
                      {r.entry.invoiceDate}
                    </td>
                    <td className="py-2 px-1.5 whitespace-nowrap font-mono-tabular">
                      {r.entry.monthTag}
                    </td>
                    <td className="py-2 px-1.5 text-right font-mono-tabular font-semibold">
                      {formatFilsToKwd(r.entry.invoiceAmountFils)}
                    </td>
                    <td className="py-2 px-1.5 text-right font-mono-tabular text-emerald-700 dark:text-emerald-400">
                      {r.entry.receivedAmountFils
                        ? formatFilsToKwd(r.entry.receivedAmountFils)
                        : '—'}
                    </td>
                    <td className="py-2 px-1.5 text-right font-mono-tabular font-semibold text-amber-700 dark:text-amber-400">
                      {r.displayBalanceFils ? formatFilsToKwd(r.displayBalanceFils) : '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="xl:col-span-7 bg-slate-200/70 dark:bg-slate-900/80 rounded-xl border border-slate-300 dark:border-slate-800 p-3 sm:p-5">
            <A4DocumentPreview
              company={activeCompany}
              activeEntry={activeEntry}
              statementSummary={statementSummary}
              viewMode="statement"
            />
          </div>
        </div>
      </div>
    );
  }

  // =========================================================================
  // VIEW 4 (DEFAULT): ZOHO INVOICES MASTER-DETAIL & POST-SAVE PREVIEW
  // =========================================================================
  return (
    <div className="space-y-4">
      <ActionConfirmModal
        state={confirmModal}
        onClose={() => setConfirmModal(null)}
      />
      <div className="grid grid-cols-1 xl:grid-cols-12 gap-6 items-start">
        {/* Left Column: Zoho Master Invoice List */}
        <div className="no-print xl:col-span-5 bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 overflow-hidden shadow-2xs">
          <div className="px-5 py-2.5 bg-slate-50 dark:bg-slate-800/50 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between gap-2">
            <div className="flex items-center gap-1">
              {(['all', 'unpaid', 'paid'] as const).map((f) => (
                <button
                  key={f}
                  onClick={() => setInvoiceFilter(f)}
                  className={`px-2.5 py-1 text-xs font-semibold rounded-md capitalize transition-colors ${
                    invoiceFilter === f
                      ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-2xs'
                      : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'
                  }`}
                >
                  {f}
                </button>
              ))}
            </div>
            <div className="flex items-center gap-2.5">
              <span className="text-[11px] text-slate-500 font-mono-tabular">
                Due: KWD {formatFilsToKwd(statementSummary.netOutstandingBalanceFils, true)}
              </span>
              {activeCompany.ledger.length > 0 && (
                <button
                  onClick={handleDeleteAllInvoices}
                  className="text-[11px] font-semibold text-rose-600 hover:underline"
                  title="Clear all invoices for this company"
                >
                  Clear All
                </button>
              )}
            </div>
          </div>

          <div className="divide-y divide-slate-100 dark:divide-slate-800 max-h-[680px] overflow-y-auto">
            {filteredInvoices.length === 0 ? (
              <div className="p-8 text-center space-y-3">
                <p className="text-xs font-semibold text-slate-600 dark:text-slate-400">
                  {activeCompany.ledger.length === 0
                    ? `No invoices recorded for ${activeCompany.nameEn} yet.`
                    : `No ${invoiceFilter} invoices found.`}
                </p>
                {activeCompany.ledger.length === 0 && (
                  <button
                    onClick={() => onChangeTab('create_invoice')}
                    className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-bold text-white bg-[#0088FF] rounded-lg hover:bg-blue-600 transition-colors"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    Create First Invoice
                  </button>
                )}
              </div>
            ) : (
              filteredInvoices.map((entry) => {
                const isSelected = activeEntry?.id === entry.id;
                const isPaid =
                  entry.receivedAmountFils !== null &&
                  entry.receivedAmountFils >= entry.invoiceAmountFils;
                const isPartial =
                  !isPaid && entry.receivedAmountFils !== null && entry.receivedAmountFils > 0;

                return (
                  <div
                    key={entry.id}
                    onClick={() => handleSelectSavedInvoice(entry.id)}
                    className={`px-5 py-3.5 flex items-center justify-between gap-3 cursor-pointer transition-colors ${
                      isSelected
                        ? 'bg-sky-50/80 dark:bg-sky-950/40'
                        : 'hover:bg-slate-50 dark:hover:bg-slate-800/40'
                    }`}
                  >
                    <div className="min-w-0 space-y-1">
                      <div className="text-xs font-bold text-slate-900 dark:text-white truncate">
                        {entry.customerName || activeCompany.clientName}
                      </div>
                      <div className="flex items-center gap-1.5 text-xs text-slate-500 font-mono-tabular">
                        <span className="font-semibold text-sky-600 dark:text-sky-400">
                          {entry.invoiceNo}
                        </span>
                        <span>·</span>
                        <span>{entry.invoiceDate}</span>
                        <span>·</span>
                        <span>{entry.monthTag}</span>
                      </div>
                    </div>

                    <div className="flex items-center gap-3 shrink-0">
                      <div className="text-right space-y-1">
                        <div className="text-xs font-bold font-mono-tabular text-slate-900 dark:text-white">
                          KWD {formatFilsToKwd(entry.invoiceAmountFils, true)}
                        </div>
                        <div
                          className={`text-[10.5px] font-bold uppercase tracking-wide ${
                            isPaid
                              ? 'text-emerald-600 dark:text-emerald-400'
                              : isPartial
                                ? 'text-amber-600 dark:text-amber-400'
                                : 'text-rose-600 dark:text-rose-400'
                          }`}
                        >
                          {isPaid ? 'Paid' : isPartial ? 'Partially Paid' : 'Unpaid'}
                        </div>
                      </div>

                      <div
                        className="flex items-center gap-1"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <button
                          onClick={() => handleOpenEditInvoiceForm(entry)}
                          className="p-1.5 text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 rounded-md"
                          title="Edit Invoice"
                        >
                          <Pencil className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => handleDeleteInvoice(entry)}
                          className="p-1.5 text-slate-400 hover:text-rose-600 rounded-md"
                          title="Delete Invoice"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* Right Column: Zoho Detail Action Toolbar + Shrink-to-Fit A4 Preview */}
        <div className="xl:col-span-7 space-y-3">
          {!activeEntry ? (
            <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 p-10 text-center space-y-4">
              <div className="w-12 h-12 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-500 flex items-center justify-center mx-auto">
                <FileText className="w-6 h-6" />
              </div>
              <div className="space-y-1 max-w-md mx-auto">
                <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                  No Invoices in {activeCompany.nameEn} ({activeCompany.code})
                </h3>
                <p className="text-xs text-slate-500">
                  All invoices for this sub-contract client pad have been cleared. Create a new invoice to start billing from Sequence #1.
                </p>
              </div>
              <button
                onClick={() => onChangeTab('create_invoice')}
                className="inline-flex items-center gap-1.5 px-5 py-2.5 text-xs font-bold text-white bg-[#0088FF] rounded-lg hover:bg-blue-600 transition-colors"
              >
                <Plus className="w-4 h-4" />
                Create First Invoice
              </button>
            </div>
          ) : (
            <>
              <div className="no-print bg-white dark:bg-slate-900 px-4 py-3 rounded-xl border border-slate-200 dark:border-slate-800 flex flex-wrap items-center justify-between gap-3 shadow-2xs">
                {/* Preview Mode Switcher: Only Invoice vs Invoice with Statement */}
                <div className="flex items-center gap-1 p-1 bg-slate-100 dark:bg-slate-800 rounded-lg">
                  <button
                    onClick={() => setPreviewDocMode('invoice')}
                    className={`px-2.5 py-1 text-xs font-semibold rounded-md transition-colors whitespace-nowrap shrink-0 ${
                      previewDocMode === 'invoice'
                        ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-2xs'
                        : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'
                    }`}
                  >
                    Only Invoice
                  </button>
                  <button
                    onClick={() => setPreviewDocMode('both')}
                    className={`px-2.5 py-1 text-xs font-semibold rounded-md transition-colors whitespace-nowrap shrink-0 ${
                      previewDocMode === 'both'
                        ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-2xs'
                        : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'
                    }`}
                  >
                    Invoice with Statement
                  </button>
                  <button
                    onClick={() => setPreviewDocMode('statement')}
                    className={`px-2.5 py-1 text-xs font-semibold rounded-md transition-colors whitespace-nowrap shrink-0 ${
                      previewDocMode === 'statement'
                        ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-2xs'
                        : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'
                    }`}
                  >
                    Only Statement
                  </button>
                </div>

                {/* Download & Edit Actions */}
                <div className="flex flex-wrap items-center gap-2">
                  <button
                    onClick={() => onDownloadPdf('invoice')}
                    disabled={exportingTarget !== null}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold text-white bg-sky-600 rounded-lg hover:bg-sky-700 transition-colors whitespace-nowrap shrink-0 disabled:opacity-50"
                  >
                    <Download className="w-3.5 h-3.5" />
                    {exportingTarget === 'invoice' ? 'PDF...' : 'Download Only Invoice'}
                  </button>

                  <button
                    onClick={() => onDownloadPdf('both')}
                    disabled={exportingTarget !== null}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold text-white bg-slate-800 dark:bg-slate-700 rounded-lg hover:bg-slate-900 transition-colors whitespace-nowrap shrink-0 disabled:opacity-50"
                  >
                    <Download className="w-3.5 h-3.5" />
                    {exportingTarget === 'both' ? 'PDF...' : 'Download Invoice with Statement'}
                  </button>

                  <button
                    onClick={() => handleOpenEditInvoiceForm(activeEntry)}
                    className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-semibold text-slate-700 dark:text-slate-200 bg-slate-100 dark:bg-slate-800 rounded-lg hover:bg-slate-200 transition-colors whitespace-nowrap shrink-0"
                  >
                    <Edit3 className="w-3.5 h-3.5" />
                    Edit
                  </button>

                  <button
                    onClick={() => handleJumpToRecordPaymentForInvoice(activeEntry)}
                    className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-semibold text-emerald-800 dark:text-emerald-200 bg-emerald-50 dark:bg-emerald-950/60 border border-emerald-200 dark:border-emerald-800 rounded-lg hover:bg-emerald-100 transition-colors whitespace-nowrap shrink-0"
                  >
                    <Calendar className="w-3.5 h-3.5" />
                    Pay
                  </button>

                  <button
                    onClick={onUploadPdfToDrive}
                    disabled={isUploadingDrivePdf}
                    title="Save PDF & Sync to Google Drive"
                    className="p-1.5 text-sky-600 dark:text-sky-400 bg-sky-50 dark:bg-sky-950/50 rounded-lg hover:bg-sky-100"
                  >
                    <CloudUpload className="w-4 h-4" />
                  </button>

                  <button
                    onClick={() => window.print()}
                    className="p-1.5 text-slate-600 dark:text-slate-300 bg-slate-100 dark:bg-slate-800 rounded-lg hover:bg-slate-200"
                    title="Print"
                  >
                    <Printer className="w-4 h-4" />
                  </button>

                  <button
                    onClick={() => handleDeleteInvoice(activeEntry)}
                    className="p-1.5 text-slate-400 hover:text-rose-600 rounded-lg"
                    title="Delete Invoice"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>

              {/* Shrink-to-Fit A4 Sheet Stage */}
              <div className="bg-slate-200/70 dark:bg-slate-900/80 rounded-xl border border-slate-300 dark:border-slate-800 p-3 sm:p-5">
                <A4DocumentPreview
                  company={activeCompany}
                  activeEntry={activeEntry}
                  statementSummary={statementSummary}
                  viewMode={previewDocMode}
                />
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
};
