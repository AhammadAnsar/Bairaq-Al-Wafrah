import React, { useState } from 'react';
import {
  Users,
  ShoppingBag,
  FileSpreadsheet,
  ReceiptText,
  Wallet,
  Clock,
  BarChart3,
  Layers,
  Plus,
  Trash2,
  Pencil,
  ArrowRight,
  Download,
  Printer,
  CheckCircle2,
  FileText,
  AlertTriangle,
  X,
  Check,
} from 'lucide-react';
import {
  ComputedStatementSummary,
  CustomerRecipient,
  ExpenseRecord,
  LedgerEntry,
  QuoteRecord,
  RecurringContractProfile,
  SalesReceiptRecord,
  ServiceCatalogItem,
  SubContractCompany,
  TimeLogRecord,
} from '../types/billing';
import {
  computeBillingMonthAndCodeFromIsoDate,
  computeStatementLedger,
  formatFilsToKwd,
  formatIsoDateForInvoice,
  generateInvoiceNumberCode,
  getTodayIsoDate,
  parseKwdToFils,
} from '../utils/kwdMath';
import { PdfExportTarget } from '../utils/pdfGenerator';
import { A4DocumentPreview } from './A4DocumentPreview';

// ============================================================================
// REUSABLE ACTION CONFIRMATION MODAL
// ============================================================================
export interface ActionConfirmState {
  title: string;
  description: string;
  confirmLabel: string;
  variant?: 'danger' | 'primary';
  onConfirm: () => void;
}

export const ActionConfirmModal: React.FC<{
  state: ActionConfirmState | null;
  onClose: () => void;
}> = ({ state, onClose }) => {
  if (!state) return null;
  const isDanger = state.variant !== 'primary';

  return (
    <div className="no-print fixed inset-0 z-50 bg-slate-950/60 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 max-w-md w-full p-6 space-y-4 shadow-xl">
        <div className="flex items-start gap-3">
          <div
            className={`p-2 rounded-lg shrink-0 ${
              isDanger
                ? 'bg-rose-50 dark:bg-rose-950/60 text-rose-600 dark:text-rose-400'
                : 'bg-sky-50 dark:bg-sky-950/60 text-sky-600 dark:text-sky-400'
            }`}
          >
            <AlertTriangle className="w-5 h-5" />
          </div>
          <div className="space-y-1">
            <h3 className="text-base font-bold text-slate-900 dark:text-white">
              {state.title}
            </h3>
            <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed">
              {state.description}
            </p>
          </div>
        </div>
        <div className="flex items-center justify-end gap-2.5 pt-2">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-xs font-semibold text-slate-700 dark:text-slate-300 bg-slate-100 dark:bg-slate-800 rounded-lg hover:bg-slate-200 transition-colors"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={() => {
              state.onConfirm();
              onClose();
            }}
            className={`px-4 py-2 text-xs font-semibold text-white rounded-lg transition-colors ${
              isDanger
                ? 'bg-rose-600 hover:bg-rose-700'
                : 'bg-[#0088FF] hover:bg-blue-600'
            }`}
          >
            {state.confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
};

// ============================================================================
// 1. CUSTOMERS VIEW (Relational TO: Recipient Organizations)
// ============================================================================
interface CustomersViewProps {
  customers: CustomerRecipient[];
  companies: SubContractCompany[];
  quotes: QuoteRecord[];
  salesReceipts: SalesReceiptRecord[];
  onUpdateCustomers: (customers: CustomerRecipient[]) => void;
  onCascadeCustomerUpdate: (oldName: string, updatedCustomer: CustomerRecipient) => void;
  onStartInvoiceForCustomer: (customer: CustomerRecipient) => void;
  onShowToast: (msg: string) => void;
}

export const CustomersView: React.FC<CustomersViewProps> = ({
  customers,
  companies,
  quotes,
  salesReceipts,
  onUpdateCustomers,
  onCascadeCustomerUpdate,
  onStartInvoiceForCustomer,
  onShowToast,
}) => {
  const [editingId, setEditingId] = useState<string | null>(null);
  const [name, setName] = useState('');
  const [projectTitle, setProjectTitle] = useState('');
  const [contactPerson, setContactPerson] = useState('');
  const [phoneOrEmail, setPhoneOrEmail] = useState('');
  const [address, setAddress] = useState('');
  const [linkedCompanyId, setLinkedCompanyId] = useState<string>('');
  const [confirmModal, setConfirmModal] = useState<ActionConfirmState | null>(null);

  const resetForm = () => {
    setEditingId(null);
    setName('');
    setProjectTitle('');
    setContactPerson('');
    setPhoneOrEmail('');
    setAddress('');
    setLinkedCompanyId('');
  };

  const handleEditCustomer = (cust: CustomerRecipient) => {
    setEditingId(cust.id);
    setName(cust.name);
    setProjectTitle(cust.projectTitle);
    setContactPerson(cust.contactPerson);
    setPhoneOrEmail(cust.phoneOrEmail);
    setAddress(cust.address);
    setLinkedCompanyId(cust.linkedCompanyId || '');
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;

    if (editingId) {
      const existing = customers.find((c) => c.id === editingId);
      const updatedRecord: CustomerRecipient = {
        id: editingId,
        name: name.trim(),
        projectTitle: projectTitle.trim() || 'Manpower Supply Project',
        contactPerson: contactPerson.trim() || 'Accounts Payable',
        phoneOrEmail: phoneOrEmail.trim(),
        address: address.trim() || 'State of Kuwait',
        linkedCompanyId: linkedCompanyId || undefined,
      };
      onCascadeCustomerUpdate(existing?.name || '', updatedRecord);
      onShowToast(`Customer "${updatedRecord.name}" updated across linked records.`);
      resetForm();
      return;
    }

    const newCustomer: CustomerRecipient = {
      id: `cust-${Date.now()}`,
      name: name.trim(),
      projectTitle: projectTitle.trim() || 'Manpower Supply Project',
      contactPerson: contactPerson.trim() || 'Accounts Payable',
      phoneOrEmail: phoneOrEmail.trim(),
      address: address.trim() || 'State of Kuwait',
      linkedCompanyId: linkedCompanyId || undefined,
    };
    onUpdateCustomers([...customers, newCustomer]);
    onShowToast(`Customer "${newCustomer.name}" added.`);
    resetForm();
  };

  const handleDelete = (cust: CustomerRecipient) => {
    setConfirmModal({
      title: 'Delete Customer?',
      description: `Are you sure you want to delete "${cust.name}" from your Customers directory?`,
      confirmLabel: 'Confirm Delete',
      variant: 'danger',
      onConfirm: () => {
        onUpdateCustomers(customers.filter((c) => c.id !== cust.id));
        if (editingId === cust.id) resetForm();
        onShowToast(`Deleted customer "${cust.name}".`);
      },
    });
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
      <ActionConfirmModal state={confirmModal} onClose={() => setConfirmModal(null)} />

      {/* Left: Add / Edit Customer Form */}
      <form
        onSubmit={handleSubmit}
        className="lg:col-span-4 bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 p-5 space-y-4"
      >
        <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
          <div className="flex items-center gap-2">
            <Users className="w-4 h-4 text-[#0088FF]" />
            <h2 className="text-sm font-bold text-slate-900 dark:text-white">
              {editingId ? 'Edit Customer (TO:)' : 'New Customer (TO:)'}
            </h2>
          </div>
          {editingId && (
            <button
              type="button"
              onClick={resetForm}
              className="inline-flex items-center gap-1 text-xs font-semibold text-slate-500 hover:text-slate-800 dark:hover:text-slate-200"
            >
              <X className="w-3.5 h-3.5" />
              Cancel
            </button>
          )}
        </div>

        <div>
          <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
            Customer Organization Name (TO:)*
          </label>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g. M/S. Talabat General Trading Company"
            required
            className="w-full px-3 py-2 text-xs font-semibold bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg"
          />
        </div>

        <div>
          <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
            Project / Contract Name
          </label>
          <input
            type="text"
            value={projectTitle}
            onChange={(e) => setProjectTitle(e.target.value)}
            placeholder="e.g. Delivery & Logistics Manpower Supply"
            className="w-full px-3 py-2 text-xs bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg"
          />
        </div>

        <div>
          <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
            Default Sub-Contract Client Pad (Relational)
          </label>
          <select
            value={linkedCompanyId}
            onChange={(e) => setLinkedCompanyId(e.target.value)}
            className="w-full px-3 py-2 text-xs font-semibold bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg"
          >
            <option value="">All Sub-Contract Client Pads (GMK / SBGTC)</option>
            {companies.map((c) => (
              <option key={c.id} value={c.id}>
                {c.code} · {c.nameEn}
              </option>
            ))}
          </select>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
              Contact Person / Dept
            </label>
            <input
              type="text"
              value={contactPerson}
              onChange={(e) => setContactPerson(e.target.value)}
              placeholder="Accounts Payable"
              className="w-full px-3 py-2 text-xs bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg"
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
              Phone / Email
            </label>
            <input
              type="text"
              value={phoneOrEmail}
              onChange={(e) => setPhoneOrEmail(e.target.value)}
              placeholder="accounts@company.com"
              className="w-full px-3 py-2 text-xs bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg"
            />
          </div>
        </div>

        <div>
          <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
            Address
          </label>
          <input
            type="text"
            value={address}
            onChange={(e) => setAddress(e.target.value)}
            placeholder="Kuwait City, State of Kuwait"
            className="w-full px-3 py-2 text-xs bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg"
          />
        </div>

        <div className="flex items-center gap-2">
          <button
            type="submit"
            className="flex-1 inline-flex items-center justify-center gap-1.5 px-4 py-2.5 text-xs font-bold text-white bg-[#0088FF] rounded-lg hover:bg-blue-600 transition-colors"
          >
            {editingId ? <Check className="w-4 h-4" /> : <Plus className="w-4 h-4" />}
            {editingId ? 'Update Customer' : 'Add Customer'}
          </button>
          {editingId && (
            <button
              type="button"
              onClick={resetForm}
              className="px-3.5 py-2.5 text-xs font-semibold text-slate-600 dark:text-slate-300 bg-slate-100 dark:bg-slate-800 rounded-lg"
            >
              Cancel
            </button>
          )}
        </div>
      </form>

      {/* Right: Customers Directory Table with Relational Ledger Totals */}
      <div className="lg:col-span-8 bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 overflow-hidden">
        <div className="px-5 py-4 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between">
          <div>
            <h2 className="text-sm font-bold text-slate-900 dark:text-white">
              Customers Directory ({customers.length})
            </h2>
            <p className="text-xs text-slate-500">
              Relationally linked to Invoices, Quotes, Sales Receipts, and Statements
            </p>
          </div>
        </div>

        <div className="divide-y divide-slate-100 dark:divide-slate-800">
          {customers.length === 0 ? (
            <div className="p-8 text-center text-xs text-slate-500">
              No customers added yet. Use the form on the left to add a project customer.
            </div>
          ) : (
            customers.map((cust) => {
              // Compute relational totals across all company ledgers, quotes, and receipts
              let invoiceCount = 0;
              let totalBilledFils = 0;
              let totalReceivedFils = 0;

              companies.forEach((comp) => {
                comp.ledger.forEach((entry) => {
                  const entryCustName = entry.customerName || comp.clientName;
                  if (
                    entry.customerId === cust.id ||
                    entryCustName.toLowerCase() === cust.name.toLowerCase()
                  ) {
                    invoiceCount += 1;
                    totalBilledFils += entry.invoiceAmountFils || 0;
                    totalReceivedFils += entry.receivedAmountFils || 0;
                  }
                });
              });

              const balanceDueFils = Math.max(0, totalBilledFils - totalReceivedFils);
              const linkedQuotesCount = quotes.filter(
                (q) =>
                  q.customerId === cust.id ||
                  q.clientName.toLowerCase() === cust.name.toLowerCase()
              ).length;
              const linkedReceiptsCount = salesReceipts.filter(
                (r) =>
                  r.customerId === cust.id ||
                  r.clientName.toLowerCase() === cust.name.toLowerCase()
              ).length;
              const preferredComp = companies.find((c) => c.id === cust.linkedCompanyId);

              return (
                <div
                  key={cust.id}
                  className={`p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4 transition-colors ${
                    editingId === cust.id
                      ? 'bg-sky-50/70 dark:bg-sky-950/30'
                      : 'hover:bg-slate-50 dark:hover:bg-slate-800/40'
                  }`}
                >
                  <div className="space-y-1.5">
                    <div className="text-sm font-bold text-slate-900 dark:text-white">
                      {cust.name}
                    </div>
                    <div className="text-xs text-slate-600 dark:text-slate-400">
                      <span>{cust.projectTitle}</span>
                      {preferredComp && (
                        <>
                          <span className="mx-2">·</span>
                          <span className="font-semibold text-slate-700 dark:text-slate-300">
                            Pad: {preferredComp.code}
                          </span>
                        </>
                      )}
                      {cust.contactPerson && (
                        <>
                          <span className="mx-2">·</span>
                          <span>{cust.contactPerson}</span>
                        </>
                      )}
                    </div>
                    <div className="flex flex-wrap items-center gap-3 pt-1 text-xs font-mono-tabular text-slate-600 dark:text-slate-400">
                      <span>{invoiceCount} Invoices</span>
                      <span>·</span>
                      <span>{linkedQuotesCount} Quotes</span>
                      <span>·</span>
                      <span>{linkedReceiptsCount} Receipts</span>
                      <span>·</span>
                      <span className="font-semibold text-slate-900 dark:text-white">
                        Billed: KWD {formatFilsToKwd(totalBilledFils, true)}
                      </span>
                      <span>·</span>
                      <span className="font-semibold text-amber-700 dark:text-amber-400">
                        Due: KWD {formatFilsToKwd(balanceDueFils, true)}
                      </span>
                    </div>
                  </div>

                  <div className="flex flex-wrap items-center gap-2 shrink-0">
                    <button
                      onClick={() => onStartInvoiceForCustomer(cust)}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-white bg-[#0088FF] rounded-lg hover:bg-blue-600 transition-colors"
                    >
                      <FileText className="w-3.5 h-3.5" />
                      New Invoice
                    </button>
                    <button
                      onClick={() => handleEditCustomer(cust)}
                      className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-semibold text-slate-700 dark:text-slate-200 bg-slate-100 dark:bg-slate-800 rounded-lg hover:bg-slate-200 transition-colors"
                      title="Edit Customer"
                    >
                      <Pencil className="w-3.5 h-3.5" />
                      Edit
                    </button>
                    <button
                      onClick={() => handleDelete(cust)}
                      className="p-1.5 text-slate-400 hover:text-rose-600 rounded-lg"
                      title="Delete Customer"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
};

// ============================================================================
// 2. ITEMS VIEW (Relational Service Catalog)
// ============================================================================
interface ItemsViewProps {
  items: ServiceCatalogItem[];
  companies: SubContractCompany[];
  quotes: QuoteRecord[];
  salesReceipts: SalesReceiptRecord[];
  onUpdateItems: (items: ServiceCatalogItem[]) => void;
  onShowToast: (msg: string) => void;
}

export const ItemsView: React.FC<ItemsViewProps> = ({
  items,
  companies,
  quotes,
  salesReceipts,
  onUpdateItems,
  onShowToast,
}) => {
  const [editingId, setEditingId] = useState<string | null>(null);
  const [name, setName] = useState('');
  const [unit, setUnit] = useState('Monthly Cycle');
  const [rateKwd, setRateKwd] = useState('');
  const [descTemplate, setDescTemplate] = useState(
    'Charges for Manpower Supplied for the month of {MONTH}'
  );
  const [linkedCompanyId, setLinkedCompanyId] = useState<string>('');
  const [confirmModal, setConfirmModal] = useState<ActionConfirmState | null>(null);

  const resetForm = () => {
    setEditingId(null);
    setName('');
    setUnit('Monthly Cycle');
    setRateKwd('');
    setDescTemplate('Charges for Manpower Supplied for the month of {MONTH}');
    setLinkedCompanyId('');
  };

  const handleEditItem = (item: ServiceCatalogItem) => {
    setEditingId(item.id);
    setName(item.name);
    setUnit(item.unit);
    setRateKwd(formatFilsToKwd(item.defaultRateFils));
    setDescTemplate(item.descriptionTemplate);
    setLinkedCompanyId(item.linkedCompanyId || '');
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;

    if (editingId) {
      const updated = items.map((it) =>
        it.id === editingId
          ? {
              ...it,
              name: name.trim(),
              unit: unit.trim() || 'Monthly Cycle',
              defaultRateFils: parseKwdToFils(rateKwd),
              descriptionTemplate:
                descTemplate.trim() ||
                'Charges for Manpower Supplied for the month of {MONTH}',
              linkedCompanyId: linkedCompanyId || undefined,
            }
          : it
      );
      onUpdateItems(updated);
      onShowToast(`Service item "${name.trim()}" updated.`);
      resetForm();
      return;
    }

    const newItem: ServiceCatalogItem = {
      id: `item-${Date.now()}`,
      name: name.trim(),
      unit: unit.trim() || 'Monthly Cycle',
      defaultRateFils: parseKwdToFils(rateKwd),
      descriptionTemplate:
        descTemplate.trim() || 'Charges for Manpower Supplied for the month of {MONTH}',
      linkedCompanyId: linkedCompanyId || undefined,
    };
    onUpdateItems([...items, newItem]);
    onShowToast(`Service item "${newItem.name}" added.`);
    resetForm();
  };

  const handleDelete = (item: ServiceCatalogItem) => {
    setConfirmModal({
      title: 'Delete Service Item?',
      description: `Are you sure you want to delete "${item.name}" from your Items catalog?`,
      confirmLabel: 'Confirm Delete',
      variant: 'danger',
      onConfirm: () => {
        onUpdateItems(items.filter((i) => i.id !== item.id));
        if (editingId === item.id) resetForm();
        onShowToast(`Deleted item "${item.name}".`);
      },
    });
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
      <ActionConfirmModal state={confirmModal} onClose={() => setConfirmModal(null)} />

      {/* Left: Add / Edit Service Item */}
      <form
        onSubmit={handleSubmit}
        className="lg:col-span-5 bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 p-5 space-y-4"
      >
        <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
          <div className="flex items-center gap-2">
            <ShoppingBag className="w-4 h-4 text-[#0088FF]" />
            <h2 className="text-sm font-bold text-slate-900 dark:text-white">
              {editingId ? 'Edit Service Item' : 'New Service Item'}
            </h2>
          </div>
          {editingId && (
            <button
              type="button"
              onClick={resetForm}
              className="inline-flex items-center gap-1 text-xs font-semibold text-slate-500 hover:text-slate-800 dark:hover:text-slate-200"
            >
              <X className="w-3.5 h-3.5" />
              Cancel
            </button>
          )}
        </div>

        <div>
          <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
            Service / Item Name*
          </label>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g. Monthly Manpower Supply (Lump-Sum)"
            required
            className="w-full px-3 py-2 text-xs font-semibold bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg"
          />
        </div>

        <div>
          <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
            Linked Sub-Contract Client Pad (Relational)
          </label>
          <select
            value={linkedCompanyId}
            onChange={(e) => setLinkedCompanyId(e.target.value)}
            className="w-full px-3 py-2 text-xs font-semibold bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg"
          >
            <option value="">All Sub-Contract Client Pads</option>
            {companies.map((c) => (
              <option key={c.id} value={c.id}>
                {c.code} · {c.nameEn}
              </option>
            ))}
          </select>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
              Unit
            </label>
            <input
              type="text"
              value={unit}
              onChange={(e) => setUnit(e.target.value)}
              className="w-full px-3 py-2 text-xs bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg"
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
              Default Rate (KWD)
            </label>
            <input
              type="number"
              step="0.001"
              value={rateKwd}
              onChange={(e) => setRateKwd(e.target.value)}
              placeholder="18986.000"
              className="w-full px-3 py-2 text-xs font-mono-tabular font-bold bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg"
            />
          </div>
        </div>

        <div>
          <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
            Invoice Description Template (Use &#123;MONTH&#125; for auto-month)
          </label>
          <textarea
            rows={2}
            value={descTemplate}
            onChange={(e) => setDescTemplate(e.target.value)}
            className="w-full p-2.5 text-xs bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg"
          />
        </div>

        <div className="flex items-center gap-2">
          <button
            type="submit"
            className="flex-1 inline-flex items-center justify-center gap-1.5 px-4 py-2.5 text-xs font-bold text-white bg-[#0088FF] rounded-lg hover:bg-blue-600 transition-colors"
          >
            {editingId ? <Check className="w-4 h-4" /> : <Plus className="w-4 h-4" />}
            {editingId ? 'Update Item' : 'Save Item'}
          </button>
          {editingId && (
            <button
              type="button"
              onClick={resetForm}
              className="px-3.5 py-2.5 text-xs font-semibold text-slate-600 dark:text-slate-300 bg-slate-100 dark:bg-slate-800 rounded-lg"
            >
              Cancel
            </button>
          )}
        </div>
      </form>

      {/* Right: Items List */}
      <div className="lg:col-span-7 bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 overflow-hidden">
        <div className="px-5 py-4 border-b border-slate-200 dark:border-slate-800">
          <h2 className="text-sm font-bold text-slate-900 dark:text-white">
            Service Items Catalog ({items.length})
          </h2>
          <p className="text-xs text-slate-500">
            Selectable inside Quotes, Invoices, Sales Receipts, and Recurring Contracts
          </p>
        </div>

        <div className="divide-y divide-slate-100 dark:divide-slate-800">
          {items.length === 0 ? (
            <div className="p-8 text-center text-xs text-slate-500">
              No service items in catalog. Add an item on the left.
            </div>
          ) : (
            items.map((item) => {
              const linkedComp = companies.find((c) => c.id === item.linkedCompanyId);
              let usageCount = 0;
              companies.forEach((c) => {
                c.ledger.forEach((l) => {
                  if (l.itemId === item.id) usageCount += 1;
                });
              });
              usageCount += quotes.filter((q) => q.itemId === item.id).length;
              usageCount += salesReceipts.filter((r) => r.itemId === item.id).length;

              return (
                <div
                  key={item.id}
                  className={`p-4 flex items-center justify-between gap-4 transition-colors ${
                    editingId === item.id
                      ? 'bg-sky-50/70 dark:bg-sky-950/30'
                      : 'hover:bg-slate-50 dark:hover:bg-slate-800/40'
                  }`}
                >
                  <div className="space-y-1">
                    <div className="text-xs font-bold text-slate-900 dark:text-white">
                      {item.name}
                    </div>
                    <div className="text-[11px] text-slate-500">{item.descriptionTemplate}</div>
                    <div className="text-[11px] text-slate-400">
                      <span>Unit: {item.unit}</span>
                      {linkedComp && (
                        <>
                          <span className="mx-1.5">·</span>
                          <span className="font-semibold text-slate-600 dark:text-slate-300">
                            Pad: {linkedComp.code}
                          </span>
                        </>
                      )}
                      <span className="mx-1.5">·</span>
                      <span>Used in {usageCount} records</span>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    <div className="text-right mr-1">
                      <span className="text-xs font-bold font-mono-tabular text-slate-900 dark:text-white">
                        KWD {formatFilsToKwd(item.defaultRateFils, true)}
                      </span>
                    </div>
                    <button
                      onClick={() => handleEditItem(item)}
                      className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-semibold text-slate-700 dark:text-slate-200 bg-slate-100 dark:bg-slate-800 rounded-lg hover:bg-slate-200 transition-colors"
                      title="Edit Item"
                    >
                      <Pencil className="w-3.5 h-3.5" />
                      Edit
                    </button>
                    <button
                      onClick={() => handleDelete(item)}
                      className="p-1.5 text-slate-400 hover:text-rose-600 rounded-lg"
                      title="Delete Item"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
};

// ============================================================================
// 3. QUOTES VIEW (Relational: Company Pad + Customer + Service Item -> Invoice)
// ============================================================================
interface QuotesViewProps {
  companies: SubContractCompany[];
  activeCompany: SubContractCompany;
  customers: CustomerRecipient[];
  items: ServiceCatalogItem[];
  quotes: QuoteRecord[];
  onUpdateQuotes: (quotes: QuoteRecord[]) => void;
  onConvertQuoteToInvoice: (quote: QuoteRecord) => void;
  onShowToast?: (msg: string) => void;
}

export const QuotesView: React.FC<QuotesViewProps> = ({
  companies,
  activeCompany,
  customers,
  items,
  quotes,
  onUpdateQuotes,
  onConvertQuoteToInvoice,
  onShowToast,
}) => {
  const [editingId, setEditingId] = useState<string | null>(null);
  const [companyId, setCompanyId] = useState(activeCompany.id);
  const [customerId, setCustomerId] = useState<string>(
    activeCompany.defaultCustomerId || customers[0]?.id || ''
  );
  const [clientName, setClientName] = useState(activeCompany.clientName);
  const [itemId, setItemId] = useState<string>('');
  const [dateIso, setDateIso] = useState(() => getTodayIsoDate());
  const [billingMonthFull, setBillingMonthFull] = useState(
    () => computeBillingMonthAndCodeFromIsoDate(getTodayIsoDate()).billingMonthFull
  );
  const [description, setDescription] = useState(
    () =>
      `Estimated ${computeBillingMonthAndCodeFromIsoDate(getTodayIsoDate()).description}`
  );
  const [amountKwd, setAmountKwd] = useState('');
  const [confirmModal, setConfirmModal] = useState<ActionConfirmState | null>(null);

  const resetForm = () => {
    const today = getTodayIsoDate();
    const derived = computeBillingMonthAndCodeFromIsoDate(today);
    setEditingId(null);
    setCompanyId(activeCompany.id);
    setCustomerId(activeCompany.defaultCustomerId || customers[0]?.id || '');
    setClientName(activeCompany.clientName);
    setItemId('');
    setDateIso(today);
    setBillingMonthFull(derived.billingMonthFull);
    setDescription(`Estimated ${derived.description}`);
    setAmountKwd('');
  };

  const handleEditQuote = (q: QuoteRecord) => {
    setEditingId(q.id);
    setCompanyId(q.companyId);
    setCustomerId(q.customerId || '');
    setClientName(q.clientName);
    setItemId(q.itemId || '');
    setDateIso(q.dateIso);
    setBillingMonthFull(q.billingMonthFull);
    setDescription(q.description);
    setAmountKwd(formatFilsToKwd(q.amountFils));
  };

  const handleDateChange = (iso: string) => {
    setDateIso(iso);
    const derived = computeBillingMonthAndCodeFromIsoDate(iso);
    setBillingMonthFull(derived.billingMonthFull);
    setDescription(`Estimated ${derived.description}`);
  };

  const handleSelectItem = (selectedItemId: string) => {
    setItemId(selectedItemId);
    const found = items.find((i) => i.id === selectedItemId);
    if (!found) return;
    const desc = found.descriptionTemplate.replace(
      '{MONTH}',
      billingMonthFull.replace(' ', ' - ')
    );
    setDescription(`Estimated ${desc}`);
    if (found.defaultRateFils > 0) {
      setAmountKwd(formatFilsToKwd(found.defaultRateFils));
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const comp = companies.find((c) => c.id === companyId) || activeCompany;

    if (editingId) {
      const updated = quotes.map((q) =>
        q.id === editingId
          ? {
              ...q,
              companyId: comp.id,
              customerId: customerId || undefined,
              clientName: clientName.trim() || comp.clientName,
              itemId: itemId || undefined,
              dateIso,
              dateDisplay: formatIsoDateForInvoice(dateIso).shortDate,
              billingMonthFull,
              description,
              amountFils: parseKwdToFils(amountKwd),
            }
          : q
      );
      onUpdateQuotes(updated);
      onShowToast?.('Quote updated.');
      resetForm();
      return;
    }

    const seq = quotes.length + 1;
    const quoteNo = `QT-${generateInvoiceNumberCode(comp.code, dateIso, seq)}`;
    const newQuote: QuoteRecord = {
      id: `qt-${Date.now()}`,
      quoteNo,
      companyId: comp.id,
      customerId: customerId || undefined,
      clientName: clientName.trim() || comp.clientName,
      itemId: itemId || undefined,
      dateIso,
      dateDisplay: formatIsoDateForInvoice(dateIso).shortDate,
      billingMonthFull,
      description,
      amountFils: parseKwdToFils(amountKwd),
      status: 'sent',
    };
    onUpdateQuotes([newQuote, ...quotes]);
    onShowToast?.(`Quote ${quoteNo} saved.`);
    resetForm();
  };

  const handleDelete = (q: QuoteRecord) => {
    setConfirmModal({
      title: 'Delete Quote?',
      description: `Are you sure you want to delete Quote ${q.quoteNo} (${q.billingMonthFull})?`,
      confirmLabel: 'Confirm Delete',
      variant: 'danger',
      onConfirm: () => {
        onUpdateQuotes(quotes.filter((item) => item.id !== q.id));
        if (editingId === q.id) resetForm();
        onShowToast?.(`Deleted Quote ${q.quoteNo}.`);
      },
    });
  };

  const handleConfirmConvert = (q: QuoteRecord) => {
    setConfirmModal({
      title: 'Convert Quote to Invoice?',
      description: `This will create an official Invoice & Statement entry for ${q.quoteNo} (${q.clientName} · KWD ${formatFilsToKwd(q.amountFils, true)}).`,
      confirmLabel: 'Convert to Invoice',
      variant: 'primary',
      onConfirm: () => {
        onConvertQuoteToInvoice(q);
      },
    });
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
      <ActionConfirmModal state={confirmModal} onClose={() => setConfirmModal(null)} />

      <form
        onSubmit={handleSubmit}
        className="lg:col-span-5 bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 p-5 space-y-4"
      >
        <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
          <div className="flex items-center gap-2">
            <FileSpreadsheet className="w-4 h-4 text-[#0088FF]" />
            <h2 className="text-sm font-bold text-slate-900 dark:text-white">
              {editingId ? 'Edit Quote / Proposal' : 'New Quote / Proposal'}
            </h2>
          </div>
          {editingId && (
            <button
              type="button"
              onClick={resetForm}
              className="inline-flex items-center gap-1 text-xs font-semibold text-slate-500 hover:text-slate-800 dark:hover:text-slate-200"
            >
              <X className="w-3.5 h-3.5" />
              Cancel
            </button>
          )}
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
              Sub-Contract Client Pad
            </label>
            <select
              value={companyId}
              onChange={(e) => {
                const c = companies.find((x) => x.id === e.target.value);
                setCompanyId(e.target.value);
                if (c) {
                  setClientName(c.clientName);
                  if (c.defaultCustomerId) setCustomerId(c.defaultCustomerId);
                }
              }}
              className="w-full px-3 py-2 text-xs font-semibold bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg"
            >
              {companies.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.code} · {c.nameEn}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
              Quote Date (Calendar)*
            </label>
            <input
              type="date"
              value={dateIso}
              onChange={(e) => handleDateChange(e.target.value)}
              className="w-full px-3 py-2 text-xs font-mono-tabular bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg"
            />
          </div>
        </div>

        {/* Relational Customer Selector */}
        <div>
          <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
            Customer (TO: / Recipient Organization)*
          </label>
          {customers.length > 0 && (
            <select
              value={customerId}
              onChange={(e) => {
                setCustomerId(e.target.value);
                const found = customers.find((c) => c.id === e.target.value);
                if (found) setClientName(found.name);
              }}
              className="w-full px-3 py-2 text-xs font-semibold bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg mb-2"
            >
              <option value="">-- Choose from Customers Directory --</option>
              {customers.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name} ({c.projectTitle})
                </option>
              ))}
            </select>
          )}
          <input
            type="text"
            value={clientName}
            onChange={(e) => setClientName(e.target.value)}
            required
            className="w-full px-3 py-2 text-xs font-semibold bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg"
          />
        </div>

        {/* Relational Service Item Selector */}
        {items.length > 0 && (
          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
              Service Catalog Item (Auto-Fills Description &amp; Rate)
            </label>
            <select
              value={itemId}
              onChange={(e) => handleSelectItem(e.target.value)}
              className="w-full px-3 py-2 text-xs font-semibold bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg"
            >
              <option value="">-- Select Service Item --</option>
              {items.map((it) => (
                <option key={it.id} value={it.id}>
                  {it.name} (KWD {formatFilsToKwd(it.defaultRateFils)})
                </option>
              ))}
            </select>
          </div>
        )}

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
              Billing Month
            </label>
            <input
              type="text"
              value={billingMonthFull}
              onChange={(e) => setBillingMonthFull(e.target.value)}
              className="w-full px-3 py-2 text-xs font-semibold bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg"
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
              Quote Amount (KWD)*
            </label>
            <input
              type="number"
              step="0.001"
              value={amountKwd}
              onChange={(e) => setAmountKwd(e.target.value)}
              placeholder="0.000"
              required
              className="w-full px-3 py-2 text-xs font-bold font-mono-tabular bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg"
            />
          </div>
        </div>

        <div>
          <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
            Description
          </label>
          <textarea
            rows={2}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            className="w-full p-2.5 text-xs bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg"
          />
        </div>

        <div className="flex items-center gap-2">
          <button
            type="submit"
            className="flex-1 inline-flex items-center justify-center gap-1.5 px-4 py-2.5 text-xs font-bold text-white bg-[#0088FF] rounded-lg hover:bg-blue-600 transition-colors"
          >
            {editingId ? <Check className="w-4 h-4" /> : <Plus className="w-4 h-4" />}
            {editingId ? 'Update Quote' : 'Save Quote'}
          </button>
          {editingId && (
            <button
              type="button"
              onClick={resetForm}
              className="px-3.5 py-2.5 text-xs font-semibold text-slate-600 dark:text-slate-300 bg-slate-100 dark:bg-slate-800 rounded-lg"
            >
              Cancel
            </button>
          )}
        </div>
      </form>

      <div className="lg:col-span-7 bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 overflow-hidden">
        <div className="px-5 py-4 border-b border-slate-200 dark:border-slate-800">
          <h2 className="text-sm font-bold text-slate-900 dark:text-white">
            Quotes &amp; Proposals ({quotes.length})
          </h2>
          <p className="text-xs text-slate-500">
            Convert approved quotes directly into official Invoices with one click
          </p>
        </div>

        <div className="divide-y divide-slate-100 dark:divide-slate-800">
          {quotes.length === 0 ? (
            <div className="p-8 text-center text-xs text-slate-500">
              No quotes recorded yet. Create a quote on the left.
            </div>
          ) : (
            quotes.map((q) => {
              const comp = companies.find((c) => c.id === q.companyId);
              const linkedItem = items.find((i) => i.id === q.itemId);
              return (
                <div
                  key={q.id}
                  className={`p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4 transition-colors ${
                    editingId === q.id
                      ? 'bg-sky-50/70 dark:bg-sky-950/30'
                      : 'hover:bg-slate-50 dark:hover:bg-slate-800/40'
                  }`}
                >
                  <div className="space-y-1">
                    <div className="flex items-center gap-2 text-xs font-bold text-slate-900 dark:text-white">
                      <span className="font-mono-tabular text-[#0088FF]">{q.quoteNo}</span>
                      <span>·</span>
                      <span>{comp?.nameEn || 'Company'}</span>
                    </div>
                    <div className="text-xs font-medium text-slate-700 dark:text-slate-300">
                      TO: {q.clientName}
                      {linkedItem ? ` · Item: ${linkedItem.name}` : ''}
                    </div>
                    <div className="text-[11px] text-slate-500">
                      {q.dateDisplay} · {q.billingMonthFull} · {q.description}
                    </div>
                  </div>

                  <div className="flex flex-wrap items-center gap-2 shrink-0">
                    <div className="text-right mr-1">
                      <div className="text-xs font-bold font-mono-tabular text-slate-900 dark:text-white">
                        KWD {formatFilsToKwd(q.amountFils, true)}
                      </div>
                      <div className="text-[10.5px] font-bold uppercase text-slate-500">
                        {q.status}
                      </div>
                    </div>

                    {q.status !== 'converted' ? (
                      <button
                        onClick={() => handleConfirmConvert(q)}
                        className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-semibold text-white bg-emerald-600 rounded-lg hover:bg-emerald-700 transition-colors"
                      >
                        Convert to Invoice
                        <ArrowRight className="w-3.5 h-3.5" />
                      </button>
                    ) : (
                      <span className="inline-flex items-center gap-1 text-xs font-semibold text-emerald-600">
                        <CheckCircle2 className="w-3.5 h-3.5" /> Converted
                      </span>
                    )}

                    <button
                      onClick={() => handleEditQuote(q)}
                      className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-semibold text-slate-700 dark:text-slate-200 bg-slate-100 dark:bg-slate-800 rounded-lg hover:bg-slate-200 transition-colors"
                      title="Edit Quote"
                    >
                      <Pencil className="w-3.5 h-3.5" />
                      Edit
                    </button>

                    <button
                      onClick={() => handleDelete(q)}
                      className="p-1.5 text-slate-400 hover:text-rose-600 rounded-lg"
                      title="Delete Quote"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
};

// ============================================================================
// 4. SALES RECEIPTS VIEW (Relational: Company + Customer + Invoice/Item)
// ============================================================================
interface SalesReceiptsViewProps {
  companies: SubContractCompany[];
  activeCompany: SubContractCompany;
  customers: CustomerRecipient[];
  items: ServiceCatalogItem[];
  receipts: SalesReceiptRecord[];
  onUpdateReceipts: (receipts: SalesReceiptRecord[]) => void;
  onShowToast: (msg: string) => void;
}

export const SalesReceiptsView: React.FC<SalesReceiptsViewProps> = ({
  companies,
  activeCompany,
  customers,
  items,
  receipts,
  onUpdateReceipts,
  onShowToast,
}) => {
  const [editingId, setEditingId] = useState<string | null>(null);
  const [companyId, setCompanyId] = useState(activeCompany.id);
  const [customerId, setCustomerId] = useState(
    activeCompany.defaultCustomerId || customers[0]?.id || ''
  );
  const [clientName, setClientName] = useState(activeCompany.clientName);
  const [itemId, setItemId] = useState('');
  const [invoiceId, setInvoiceId] = useState('');
  const [dateIso, setDateIso] = useState(() => getTodayIsoDate());
  const [paymentMode, setPaymentMode] = useState('Bank Transfer (KFH)');
  const [description, setDescription] = useState(
    'Settlement receipt for Manpower Supply'
  );
  const [amountKwd, setAmountKwd] = useState('');
  const [confirmModal, setConfirmModal] = useState<ActionConfirmState | null>(null);

  const selectedCompanyObj =
    companies.find((c) => c.id === companyId) || activeCompany;

  const resetForm = () => {
    setEditingId(null);
    setCompanyId(activeCompany.id);
    setCustomerId(activeCompany.defaultCustomerId || customers[0]?.id || '');
    setClientName(activeCompany.clientName);
    setItemId('');
    setInvoiceId('');
    setDateIso(getTodayIsoDate());
    setPaymentMode('Bank Transfer (KFH)');
    setDescription('Settlement receipt for Manpower Supply');
    setAmountKwd('');
  };

  const handleEditReceipt = (sr: SalesReceiptRecord) => {
    setEditingId(sr.id);
    setCompanyId(sr.companyId);
    setCustomerId(sr.customerId || '');
    setClientName(sr.clientName);
    setItemId(sr.itemId || '');
    setInvoiceId(sr.invoiceId || '');
    setDateIso(sr.dateIso);
    setPaymentMode(sr.paymentMode);
    setDescription(sr.description);
    setAmountKwd(formatFilsToKwd(sr.amountFils));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const comp = companies.find((c) => c.id === companyId) || activeCompany;

    if (editingId) {
      const updated = receipts.map((r) =>
        r.id === editingId
          ? {
              ...r,
              companyId: comp.id,
              customerId: customerId || undefined,
              clientName: clientName.trim() || comp.clientName,
              itemId: itemId || undefined,
              invoiceId: invoiceId || undefined,
              dateIso,
              dateDisplay: formatIsoDateForInvoice(dateIso).shortDate,
              paymentMode,
              description,
              amountFils: parseKwdToFils(amountKwd),
            }
          : r
      );
      onUpdateReceipts(updated);
      onShowToast('Sales receipt updated.');
      resetForm();
      return;
    }

    const seq = receipts.length + 1;
    const receiptNo = `SR-${generateInvoiceNumberCode(comp.code, dateIso, seq)}`;
    const newReceipt: SalesReceiptRecord = {
      id: `sr-${Date.now()}`,
      receiptNo,
      companyId: comp.id,
      customerId: customerId || undefined,
      clientName: clientName.trim() || comp.clientName,
      itemId: itemId || undefined,
      invoiceId: invoiceId || undefined,
      dateIso,
      dateDisplay: formatIsoDateForInvoice(dateIso).shortDate,
      paymentMode,
      description,
      amountFils: parseKwdToFils(amountKwd),
    };
    onUpdateReceipts([newReceipt, ...receipts]);
    onShowToast(`Sales Receipt ${receiptNo} saved.`);
    resetForm();
  };

  const handleDelete = (sr: SalesReceiptRecord) => {
    setConfirmModal({
      title: 'Delete Sales Receipt?',
      description: `Are you sure you want to delete Sales Receipt ${sr.receiptNo} (KWD ${formatFilsToKwd(sr.amountFils, true)})?`,
      confirmLabel: 'Confirm Delete',
      variant: 'danger',
      onConfirm: () => {
        onUpdateReceipts(receipts.filter((r) => r.id !== sr.id));
        if (editingId === sr.id) resetForm();
        onShowToast(`Deleted Sales Receipt ${sr.receiptNo}.`);
      },
    });
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
      <ActionConfirmModal state={confirmModal} onClose={() => setConfirmModal(null)} />

      <form
        onSubmit={handleSubmit}
        className="lg:col-span-5 bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 p-5 space-y-4"
      >
        <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
          <div className="flex items-center gap-2">
            <ReceiptText className="w-4 h-4 text-[#0088FF]" />
            <h2 className="text-sm font-bold text-slate-900 dark:text-white">
              {editingId ? 'Edit Sales Receipt' : 'New Sales Receipt'}
            </h2>
          </div>
          {editingId && (
            <button
              type="button"
              onClick={resetForm}
              className="inline-flex items-center gap-1 text-xs font-semibold text-slate-500 hover:text-slate-800 dark:hover:text-slate-200"
            >
              <X className="w-3.5 h-3.5" />
              Cancel
            </button>
          )}
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
              Sub-Contract Client Pad
            </label>
            <select
              value={companyId}
              onChange={(e) => {
                const c = companies.find((x) => x.id === e.target.value);
                setCompanyId(e.target.value);
                if (c) {
                  setClientName(c.clientName);
                  if (c.defaultCustomerId) setCustomerId(c.defaultCustomerId);
                }
              }}
              className="w-full px-3 py-2 text-xs font-semibold bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg"
            >
              {companies.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.code} · {c.nameEn}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
              Receipt Date*
            </label>
            <input
              type="date"
              value={dateIso}
              onChange={(e) => setDateIso(e.target.value)}
              className="w-full px-3 py-2 text-xs font-mono-tabular bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg"
            />
          </div>
        </div>

        {/* Relational Customer Picker */}
        <div>
          <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
            Customer (Received From)*
          </label>
          {customers.length > 0 && (
            <select
              value={customerId}
              onChange={(e) => {
                setCustomerId(e.target.value);
                const found = customers.find((c) => c.id === e.target.value);
                if (found) setClientName(found.name);
              }}
              className="w-full px-3 py-2 text-xs font-semibold bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg mb-2"
            >
              <option value="">-- Choose from Customers Directory --</option>
              {customers.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          )}
          <input
            type="text"
            value={clientName}
            onChange={(e) => setClientName(e.target.value)}
            required
            className="w-full px-3 py-2 text-xs font-semibold bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg"
          />
        </div>

        {/* Relational Link to Invoice or Catalog Item */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {selectedCompanyObj.ledger.length > 0 && (
            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Link to Invoice (Optional)
              </label>
              <select
                value={invoiceId}
                onChange={(e) => {
                  setInvoiceId(e.target.value);
                  const inv = selectedCompanyObj.ledger.find(
                    (l) => l.id === e.target.value
                  );
                  if (inv) {
                    setDescription(
                      `Settlement receipt for Invoice ${inv.invoiceNo} (${inv.billingMonthFull})`
                    );
                    setAmountKwd(formatFilsToKwd(inv.invoiceAmountFils));
                  }
                }}
                className="w-full px-3 py-2 text-xs font-mono-tabular bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg"
              >
                <option value="">-- Select Invoice --</option>
                {[...selectedCompanyObj.ledger].reverse().map((inv) => (
                  <option key={inv.id} value={inv.id}>
                    {inv.invoiceNo} ({inv.monthTag} · {formatFilsToKwd(inv.invoiceAmountFils)})
                  </option>
                ))}
              </select>
            </div>
          )}

          {items.length > 0 && (
            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Link to Service Item
              </label>
              <select
                value={itemId}
                onChange={(e) => {
                  setItemId(e.target.value);
                  const it = items.find((x) => x.id === e.target.value);
                  if (it) {
                    setDescription(`Settlement receipt for ${it.name}`);
                    if (it.defaultRateFils > 0) {
                      setAmountKwd(formatFilsToKwd(it.defaultRateFils));
                    }
                  }
                }}
                className="w-full px-3 py-2 text-xs bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg"
              >
                <option value="">-- Select Service Item --</option>
                {items.map((it) => (
                  <option key={it.id} value={it.id}>
                    {it.name}
                  </option>
                ))}
              </select>
            </div>
          )}
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
              Payment Mode
            </label>
            <select
              value={paymentMode}
              onChange={(e) => setPaymentMode(e.target.value)}
              className="w-full px-3 py-2 text-xs bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg"
            >
              <option value="Bank Transfer (KFH)">Bank Transfer (KFH)</option>
              <option value="Bank Transfer (ABK)">Bank Transfer (ABK)</option>
              <option value="Corporate Cheque">Corporate Cheque</option>
              <option value="Cash">Cash</option>
            </select>
          </div>
          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
              Amount (KWD)*
            </label>
            <input
              type="number"
              step="0.001"
              value={amountKwd}
              onChange={(e) => setAmountKwd(e.target.value)}
              placeholder="0.000"
              required
              className="w-full px-3 py-2 text-xs font-bold font-mono-tabular bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg"
            />
          </div>
        </div>

        <div>
          <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
            Description
          </label>
          <input
            type="text"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            className="w-full px-3 py-2 text-xs bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg"
          />
        </div>

        <div className="flex items-center gap-2">
          <button
            type="submit"
            className="flex-1 inline-flex items-center justify-center gap-1.5 px-4 py-2.5 text-xs font-bold text-white bg-[#0088FF] rounded-lg hover:bg-blue-600 transition-colors"
          >
            {editingId ? <Check className="w-4 h-4" /> : <Plus className="w-4 h-4" />}
            {editingId ? 'Update Receipt' : 'Save Sales Receipt'}
          </button>
          {editingId && (
            <button
              type="button"
              onClick={resetForm}
              className="px-3.5 py-2.5 text-xs font-semibold text-slate-600 dark:text-slate-300 bg-slate-100 dark:bg-slate-800 rounded-lg"
            >
              Cancel
            </button>
          )}
        </div>
      </form>

      <div className="lg:col-span-7 bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 overflow-hidden">
        <div className="px-5 py-4 border-b border-slate-200 dark:border-slate-800">
          <h2 className="text-sm font-bold text-slate-900 dark:text-white">
            Sales Receipts ({receipts.length})
          </h2>
          <p className="text-xs text-slate-500">
            Official payment vouchers linked to Customers, Invoices, and Service Items
          </p>
        </div>

        <div className="divide-y divide-slate-100 dark:divide-slate-800">
          {receipts.length === 0 ? (
            <div className="p-8 text-center text-xs text-slate-500">
              No sales receipts recorded yet.
            </div>
          ) : (
            receipts.map((sr) => {
              const comp = companies.find((c) => c.id === sr.companyId);
              return (
                <div
                  key={sr.id}
                  className={`p-4 flex items-center justify-between gap-4 transition-colors ${
                    editingId === sr.id
                      ? 'bg-sky-50/70 dark:bg-sky-950/30'
                      : 'hover:bg-slate-50 dark:hover:bg-slate-800/40'
                  }`}
                >
                  <div className="space-y-1">
                    <div className="flex items-center gap-2 text-xs font-bold text-slate-900 dark:text-white">
                      <span className="font-mono-tabular text-emerald-600">
                        {sr.receiptNo}
                      </span>
                      <span>·</span>
                      <span>{comp?.nameEn}</span>
                    </div>
                    <div className="text-xs text-slate-600 dark:text-slate-300">
                      Customer: {sr.clientName} · {sr.description}
                    </div>
                    <div className="text-[11px] text-slate-500">
                      {sr.dateDisplay} · {sr.paymentMode}
                    </div>
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    <span className="text-xs font-bold font-mono-tabular text-emerald-700 dark:text-emerald-400 mr-1">
                      KWD {formatFilsToKwd(sr.amountFils, true)}
                    </span>
                    <button
                      onClick={() => handleEditReceipt(sr)}
                      className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-semibold text-slate-700 dark:text-slate-200 bg-slate-100 dark:bg-slate-800 rounded-lg hover:bg-slate-200 transition-colors"
                      title="Edit Sales Receipt"
                    >
                      <Pencil className="w-3.5 h-3.5" />
                      Edit
                    </button>
                    <button
                      onClick={() => handleDelete(sr)}
                      className="p-1.5 text-slate-400 hover:text-rose-600 rounded-lg"
                      title="Delete Sales Receipt"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
};

// ============================================================================
// 5. EXPENSES VIEW (Relational: Company Pad + Customer)
// ============================================================================
interface ExpensesViewProps {
  companies: SubContractCompany[];
  activeCompany: SubContractCompany;
  customers: CustomerRecipient[];
  expenses: ExpenseRecord[];
  onUpdateExpenses: (expenses: ExpenseRecord[]) => void;
  onShowToast: (msg: string) => void;
}

export const ExpensesView: React.FC<ExpensesViewProps> = ({
  companies,
  activeCompany,
  customers,
  expenses,
  onUpdateExpenses,
  onShowToast,
}) => {
  const [editingId, setEditingId] = useState<string | null>(null);
  const [companyId, setCompanyId] = useState(activeCompany.id);
  const [customerId, setCustomerId] = useState(
    activeCompany.defaultCustomerId || customers[0]?.id || ''
  );
  const [dateIso, setDateIso] = useState(() => getTodayIsoDate());
  const [category, setCategory] = useState('Staff Salaries & Allowances');
  const [vendorOrPayee, setVendorOrPayee] = useState('');
  const [referenceNo, setReferenceNo] = useState('');
  const [amountKwd, setAmountKwd] = useState('');
  const [notes, setNotes] = useState('');
  const [confirmModal, setConfirmModal] = useState<ActionConfirmState | null>(null);

  const totalExpensesFils = expenses.reduce((acc, e) => acc + e.amountFils, 0);

  const resetForm = () => {
    setEditingId(null);
    setCompanyId(activeCompany.id);
    setCustomerId(activeCompany.defaultCustomerId || customers[0]?.id || '');
    setDateIso(getTodayIsoDate());
    setCategory('Staff Salaries & Allowances');
    setVendorOrPayee('');
    setReferenceNo('');
    setAmountKwd('');
    setNotes('');
  };

  const handleEditExpense = (exp: ExpenseRecord) => {
    setEditingId(exp.id);
    setCompanyId(exp.companyId);
    setCustomerId(exp.customerId || '');
    setDateIso(exp.dateIso);
    setCategory(exp.category);
    setVendorOrPayee(exp.vendorOrPayee);
    setReferenceNo(exp.referenceNo);
    setAmountKwd(formatFilsToKwd(exp.amountFils));
    setNotes(exp.notes);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!vendorOrPayee.trim()) return;
    const linkedCust = customers.find((c) => c.id === customerId);

    if (editingId) {
      const updated = expenses.map((ex) =>
        ex.id === editingId
          ? {
              ...ex,
              companyId,
              customerId: customerId || undefined,
              customerName: linkedCust?.name,
              dateIso,
              dateDisplay: formatIsoDateForInvoice(dateIso).shortDate,
              category,
              vendorOrPayee: vendorOrPayee.trim(),
              referenceNo: referenceNo.trim(),
              amountFils: parseKwdToFils(amountKwd),
              notes: notes.trim(),
            }
          : ex
      );
      onUpdateExpenses(updated);
      onShowToast('Expense record updated.');
      resetForm();
      return;
    }

    const newExp: ExpenseRecord = {
      id: `exp-${Date.now()}`,
      companyId,
      customerId: customerId || undefined,
      customerName: linkedCust?.name,
      dateIso,
      dateDisplay: formatIsoDateForInvoice(dateIso).shortDate,
      category,
      vendorOrPayee: vendorOrPayee.trim(),
      referenceNo: referenceNo.trim() || `EXP-${Date.now().toString().slice(-4)}`,
      amountFils: parseKwdToFils(amountKwd),
      notes: notes.trim(),
    };
    onUpdateExpenses([newExp, ...expenses]);
    onShowToast('Expense recorded.');
    resetForm();
  };

  const handleDelete = (exp: ExpenseRecord) => {
    setConfirmModal({
      title: 'Delete Expense Record?',
      description: `Are you sure you want to delete the expense "${exp.vendorOrPayee}" (KWD ${formatFilsToKwd(exp.amountFils, true)})?`,
      confirmLabel: 'Confirm Delete',
      variant: 'danger',
      onConfirm: () => {
        onUpdateExpenses(expenses.filter((x) => x.id !== exp.id));
        if (editingId === exp.id) resetForm();
        onShowToast('Expense deleted.');
      },
    });
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
      <ActionConfirmModal state={confirmModal} onClose={() => setConfirmModal(null)} />

      <form
        onSubmit={handleSubmit}
        className="lg:col-span-5 bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 p-5 space-y-4"
      >
        <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
          <div className="flex items-center gap-2">
            <Wallet className="w-4 h-4 text-[#0088FF]" />
            <h2 className="text-sm font-bold text-slate-900 dark:text-white">
              {editingId ? 'Edit Operating Expense' : 'Record Operating Expense'}
            </h2>
          </div>
          {editingId && (
            <button
              type="button"
              onClick={resetForm}
              className="inline-flex items-center gap-1 text-xs font-semibold text-slate-500 hover:text-slate-800 dark:hover:text-slate-200"
            >
              <X className="w-3.5 h-3.5" />
              Cancel
            </button>
          )}
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
              Sub-Contract Client Pad
            </label>
            <select
              value={companyId}
              onChange={(e) => setCompanyId(e.target.value)}
              className="w-full px-3 py-2 text-xs font-semibold bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg"
            >
              {companies.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.code} · {c.nameEn}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
              Date*
            </label>
            <input
              type="date"
              value={dateIso}
              onChange={(e) => setDateIso(e.target.value)}
              className="w-full px-3 py-2 text-xs font-mono-tabular bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg"
            />
          </div>
        </div>

        {customers.length > 0 && (
          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
              Linked Project Customer (Relational)
            </label>
            <select
              value={customerId}
              onChange={(e) => setCustomerId(e.target.value)}
              className="w-full px-3 py-2 text-xs font-semibold bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg"
            >
              <option value="">-- General Sub-Contract Expense --</option>
              {customers.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name} ({c.projectTitle})
                </option>
              ))}
            </select>
          </div>
        )}

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
              Category
            </label>
            <select
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              className="w-full px-3 py-2 text-xs bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg"
            >
              <option value="Staff Salaries & Allowances">
                Staff Salaries &amp; Allowances
              </option>
              <option value="Fleet & Accommodation">Fleet &amp; Accommodation</option>
              <option value="Visa & Residency Renewals">
                Visa &amp; Residency Renewals
              </option>
              <option value="Clinic & Medical Supplies">
                Clinic &amp; Medical Supplies
              </option>
              <option value="Office & Admin">Office &amp; Admin</option>
            </select>
          </div>
          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
              Amount (KWD)*
            </label>
            <input
              type="number"
              step="0.001"
              value={amountKwd}
              onChange={(e) => setAmountKwd(e.target.value)}
              placeholder="0.000"
              required
              className="w-full px-3 py-2 text-xs font-bold font-mono-tabular bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg"
            />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
              Vendor / Payee*
            </label>
            <input
              type="text"
              value={vendorOrPayee}
              onChange={(e) => setVendorOrPayee(e.target.value)}
              placeholder="e.g. Workforce Payroll"
              required
              className="w-full px-3 py-2 text-xs bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg"
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
              Reference#
            </label>
            <input
              type="text"
              value={referenceNo}
              onChange={(e) => setReferenceNo(e.target.value)}
              placeholder="PAY-2611"
              className="w-full px-3 py-2 text-xs font-mono-tabular bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg"
            />
          </div>
        </div>

        <div>
          <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
            Notes
          </label>
          <input
            type="text"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Payment details..."
            className="w-full px-3 py-2 text-xs bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg"
          />
        </div>

        <div className="flex items-center gap-2">
          <button
            type="submit"
            className="flex-1 inline-flex items-center justify-center gap-1.5 px-4 py-2.5 text-xs font-bold text-white bg-[#0088FF] rounded-lg hover:bg-blue-600 transition-colors"
          >
            {editingId ? <Check className="w-4 h-4" /> : <Plus className="w-4 h-4" />}
            {editingId ? 'Update Expense' : 'Save Expense'}
          </button>
          {editingId && (
            <button
              type="button"
              onClick={resetForm}
              className="px-3.5 py-2.5 text-xs font-semibold text-slate-600 dark:text-slate-300 bg-slate-100 dark:bg-slate-800 rounded-lg"
            >
              Cancel
            </button>
          )}
        </div>
      </form>

      <div className="lg:col-span-7 bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 overflow-hidden">
        <div className="px-5 py-4 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between">
          <div>
            <h2 className="text-sm font-bold text-slate-900 dark:text-white">
              Operating Expenses ({expenses.length})
            </h2>
            <p className="text-xs text-slate-500">
              Payroll, transport, housing, and residency disbursements
            </p>
          </div>
          <div className="text-right">
            <span className="text-[11px] text-slate-500 block">Total Expenses</span>
            <span className="text-sm font-bold font-mono-tabular text-rose-600">
              KWD {formatFilsToKwd(totalExpensesFils, true)}
            </span>
          </div>
        </div>

        <div className="divide-y divide-slate-100 dark:divide-slate-800">
          {expenses.length === 0 ? (
            <div className="p-8 text-center text-xs text-slate-500">
              No expenses recorded yet.
            </div>
          ) : (
            expenses.map((exp) => {
              const comp = companies.find((c) => c.id === exp.companyId);
              return (
                <div
                  key={exp.id}
                  className={`p-4 flex items-center justify-between gap-4 transition-colors ${
                    editingId === exp.id
                      ? 'bg-sky-50/70 dark:bg-sky-950/30'
                      : 'hover:bg-slate-50 dark:hover:bg-slate-800/40'
                  }`}
                >
                  <div className="space-y-1">
                    <div className="text-xs font-bold text-slate-900 dark:text-white">
                      {exp.vendorOrPayee} ({exp.category})
                    </div>
                    <div className="text-[11px] text-slate-500">
                      {exp.dateDisplay} · {comp?.nameEn} · Ref: {exp.referenceNo}
                      {exp.customerName ? ` · Project: ${exp.customerName}` : ''}
                    </div>
                    {exp.notes && (
                      <div className="text-[11px] text-slate-400">{exp.notes}</div>
                    )}
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    <span className="text-xs font-bold font-mono-tabular text-rose-600 mr-1">
                      KWD {formatFilsToKwd(exp.amountFils, true)}
                    </span>
                    <button
                      onClick={() => handleEditExpense(exp)}
                      className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-semibold text-slate-700 dark:text-slate-200 bg-slate-100 dark:bg-slate-800 rounded-lg hover:bg-slate-200 transition-colors"
                      title="Edit Expense"
                    >
                      <Pencil className="w-3.5 h-3.5" />
                      Edit
                    </button>
                    <button
                      onClick={() => handleDelete(exp)}
                      className="p-1.5 text-slate-400 hover:text-rose-600 rounded-lg"
                      title="Delete Expense"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
};

// ============================================================================
// 6. TIME TRACKING VIEW (Relational: Company + Customer + Item -> Invoice)
// ============================================================================
interface TimeTrackingViewProps {
  companies: SubContractCompany[];
  activeCompany: SubContractCompany;
  customers: CustomerRecipient[];
  items: ServiceCatalogItem[];
  timeLogs: TimeLogRecord[];
  onUpdateTimeLogs: (logs: TimeLogRecord[]) => void;
  onConvertTimeLogToInvoice: (log: TimeLogRecord) => void;
  onShowToast?: (msg: string) => void;
}

export const TimeTrackingView: React.FC<TimeTrackingViewProps> = ({
  companies,
  activeCompany,
  customers,
  items,
  timeLogs,
  onUpdateTimeLogs,
  onConvertTimeLogToInvoice,
  onShowToast,
}) => {
  const [editingId, setEditingId] = useState<string | null>(null);
  const [companyId, setCompanyId] = useState(activeCompany.id);
  const [customerId, setCustomerId] = useState(
    activeCompany.defaultCustomerId || customers[0]?.id || ''
  );
  const [itemId, setItemId] = useState('');
  const [dateIso, setDateIso] = useState(() => getTodayIsoDate());
  const [workerGroup, setWorkerGroup] = useState('Active Fleet & Support Personnel');
  const [headcount, setHeadcount] = useState('35');
  const [daysWorked, setDaysWorked] = useState('30');
  const [ratePerDayKwd, setRatePerDayKwd] = useState('18.000');
  const [confirmModal, setConfirmModal] = useState<ActionConfirmState | null>(null);

  const computedTotalFils =
    (Number(headcount) || 0) *
    (Number(daysWorked) || 0) *
    parseKwdToFils(ratePerDayKwd);

  const resetForm = () => {
    setEditingId(null);
    setCompanyId(activeCompany.id);
    setCustomerId(activeCompany.defaultCustomerId || customers[0]?.id || '');
    setItemId('');
    setDateIso(getTodayIsoDate());
    setWorkerGroup('Active Fleet & Support Personnel');
    setHeadcount('35');
    setDaysWorked('30');
    setRatePerDayKwd('18.000');
  };

  const handleEditLog = (log: TimeLogRecord) => {
    setEditingId(log.id);
    setCompanyId(log.companyId);
    setCustomerId(log.customerId || '');
    setItemId(log.itemId || '');
    setDateIso(log.dateIso);
    setWorkerGroup(log.workerGroup);
    setHeadcount(String(log.headcount));
    setDaysWorked(String(log.daysWorked));
    setRatePerDayKwd(formatFilsToKwd(log.ratePerWorkerDayFils));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const linkedCust = customers.find((c) => c.id === customerId);

    if (editingId) {
      const updated = timeLogs.map((t) =>
        t.id === editingId
          ? {
              ...t,
              companyId,
              customerId: customerId || undefined,
              customerName: linkedCust?.name,
              itemId: itemId || undefined,
              dateIso,
              workerGroup: workerGroup.trim() || 'Supplied Manpower',
              headcount: Number(headcount) || 1,
              daysWorked: Number(daysWorked) || 30,
              ratePerWorkerDayFils: parseKwdToFils(ratePerDayKwd),
              totalFils: computedTotalFils,
            }
          : t
      );
      onUpdateTimeLogs(updated);
      onShowToast?.('Manpower timesheet updated.');
      resetForm();
      return;
    }

    const newLog: TimeLogRecord = {
      id: `tl-${Date.now()}`,
      companyId,
      customerId: customerId || undefined,
      customerName: linkedCust?.name,
      itemId: itemId || undefined,
      dateIso,
      workerGroup: workerGroup.trim() || 'Supplied Manpower',
      headcount: Number(headcount) || 1,
      daysWorked: Number(daysWorked) || 30,
      ratePerWorkerDayFils: parseKwdToFils(ratePerDayKwd),
      totalFils: computedTotalFils,
      billed: false,
    };
    onUpdateTimeLogs([newLog, ...timeLogs]);
    onShowToast?.('Manpower timesheet saved.');
    resetForm();
  };

  const handleDelete = (log: TimeLogRecord) => {
    setConfirmModal({
      title: 'Delete Timesheet Batch?',
      description: `Are you sure you want to delete the timesheet for "${log.workerGroup}" (KWD ${formatFilsToKwd(log.totalFils, true)})?`,
      confirmLabel: 'Confirm Delete',
      variant: 'danger',
      onConfirm: () => {
        onUpdateTimeLogs(timeLogs.filter((t) => t.id !== log.id));
        if (editingId === log.id) resetForm();
        onShowToast?.('Timesheet deleted.');
      },
    });
  };

  const handleConfirmBillAsInvoice = (log: TimeLogRecord) => {
    setConfirmModal({
      title: 'Bill Timesheet Batch as Invoice?',
      description: `This will generate an official Invoice for "${log.workerGroup}" totaling KWD ${formatFilsToKwd(log.totalFils, true)}.`,
      confirmLabel: 'Bill as Invoice',
      variant: 'primary',
      onConfirm: () => {
        onConvertTimeLogToInvoice(log);
      },
    });
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
      <ActionConfirmModal state={confirmModal} onClose={() => setConfirmModal(null)} />

      <form
        onSubmit={handleSubmit}
        className="lg:col-span-5 bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 p-5 space-y-4"
      >
        <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
          <div className="flex items-center gap-2">
            <Clock className="w-4 h-4 text-[#0088FF]" />
            <h2 className="text-sm font-bold text-slate-900 dark:text-white">
              {editingId ? 'Edit Manpower Timesheet' : 'Log Manpower Timesheet Batch'}
            </h2>
          </div>
          {editingId && (
            <button
              type="button"
              onClick={resetForm}
              className="inline-flex items-center gap-1 text-xs font-semibold text-slate-500 hover:text-slate-800 dark:hover:text-slate-200"
            >
              <X className="w-3.5 h-3.5" />
              Cancel
            </button>
          )}
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
              Sub-Contract Client Pad
            </label>
            <select
              value={companyId}
              onChange={(e) => setCompanyId(e.target.value)}
              className="w-full px-3 py-2 text-xs font-semibold bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg"
            >
              {companies.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.code} · {c.nameEn}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
              Batch Date
            </label>
            <input
              type="date"
              value={dateIso}
              onChange={(e) => setDateIso(e.target.value)}
              className="w-full px-3 py-2 text-xs font-mono-tabular bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg"
            />
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {customers.length > 0 && (
            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Project Customer (TO:)
              </label>
              <select
                value={customerId}
                onChange={(e) => setCustomerId(e.target.value)}
                className="w-full px-3 py-2 text-xs font-semibold bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg"
              >
                <option value="">-- Select Customer --</option>
                {customers.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </div>
          )}

          {items.length > 0 && (
            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Linked Service Item
              </label>
              <select
                value={itemId}
                onChange={(e) => {
                  setItemId(e.target.value);
                  const it = items.find((x) => x.id === e.target.value);
                  if (it) setWorkerGroup(it.name);
                }}
                className="w-full px-3 py-2 text-xs bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg"
              >
                <option value="">-- Select Service Item --</option>
                {items.map((it) => (
                  <option key={it.id} value={it.id}>
                    {it.name}
                  </option>
                ))}
              </select>
            </div>
          )}
        </div>

        <div>
          <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
            Worker Group / Designation*
          </label>
          <input
            type="text"
            value={workerGroup}
            onChange={(e) => setWorkerGroup(e.target.value)}
            required
            className="w-full px-3 py-2 text-xs font-semibold bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg"
          />
        </div>

        <div className="grid grid-cols-3 gap-3">
          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
              Workers
            </label>
            <input
              type="number"
              value={headcount}
              onChange={(e) => setHeadcount(e.target.value)}
              className="w-full px-3 py-2 text-xs font-mono-tabular bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg"
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
              Days
            </label>
            <input
              type="number"
              value={daysWorked}
              onChange={(e) => setDaysWorked(e.target.value)}
              className="w-full px-3 py-2 text-xs font-mono-tabular bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg"
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
              Daily Rate (KWD)
            </label>
            <input
              type="number"
              step="0.001"
              value={ratePerDayKwd}
              onChange={(e) => setRatePerDayKwd(e.target.value)}
              className="w-full px-3 py-2 text-xs font-mono-tabular bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg"
            />
          </div>
        </div>

        <div className="p-3 bg-slate-50 dark:bg-slate-800/60 rounded-lg flex items-center justify-between text-xs font-bold">
          <span>Calculated Batch Total</span>
          <span className="font-mono-tabular text-slate-900 dark:text-white">
            KWD {formatFilsToKwd(computedTotalFils, true)}
          </span>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="submit"
            className="flex-1 inline-flex items-center justify-center gap-1.5 px-4 py-2.5 text-xs font-bold text-white bg-[#0088FF] rounded-lg hover:bg-blue-600 transition-colors"
          >
            {editingId ? <Check className="w-4 h-4" /> : <Plus className="w-4 h-4" />}
            {editingId ? 'Update Timesheet' : 'Save Timesheet Batch'}
          </button>
          {editingId && (
            <button
              type="button"
              onClick={resetForm}
              className="px-3.5 py-2.5 text-xs font-semibold text-slate-600 dark:text-slate-300 bg-slate-100 dark:bg-slate-800 rounded-lg"
            >
              Cancel
            </button>
          )}
        </div>
      </form>

      <div className="lg:col-span-7 bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 overflow-hidden">
        <div className="px-5 py-4 border-b border-slate-200 dark:border-slate-800">
          <h2 className="text-sm font-bold text-slate-900 dark:text-white">
            Manpower Attendance &amp; Time Logs ({timeLogs.length})
          </h2>
          <p className="text-xs text-slate-500">
            Convert verified manpower timesheets directly into monthly Invoices
          </p>
        </div>

        <div className="divide-y divide-slate-100 dark:divide-slate-800">
          {timeLogs.length === 0 ? (
            <div className="p-8 text-center text-xs text-slate-500">
              No timesheets logged yet.
            </div>
          ) : (
            timeLogs.map((log) => {
              const comp = companies.find((c) => c.id === log.companyId);
              return (
                <div
                  key={log.id}
                  className={`p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4 transition-colors ${
                    editingId === log.id
                      ? 'bg-sky-50/70 dark:bg-sky-950/30'
                      : 'hover:bg-slate-50 dark:hover:bg-slate-800/40'
                  }`}
                >
                  <div className="space-y-1">
                    <div className="text-xs font-bold text-slate-900 dark:text-white">
                      {log.workerGroup} · {comp?.nameEn}
                    </div>
                    <div className="text-[11px] text-slate-500 font-mono-tabular">
                      {log.headcount} Workers × {log.daysWorked} Days @ KWD{' '}
                      {formatFilsToKwd(log.ratePerWorkerDayFils)}/day
                      {log.customerName ? ` · TO: ${log.customerName}` : ''}
                    </div>
                  </div>

                  <div className="flex flex-wrap items-center gap-2 shrink-0">
                    <span className="text-xs font-bold font-mono-tabular text-slate-900 dark:text-white mr-1">
                      KWD {formatFilsToKwd(log.totalFils, true)}
                    </span>
                    {!log.billed ? (
                      <button
                        onClick={() => handleConfirmBillAsInvoice(log)}
                        className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-semibold text-white bg-[#0088FF] rounded-lg hover:bg-blue-600"
                      >
                        Bill as Invoice
                        <ArrowRight className="w-3.5 h-3.5" />
                      </button>
                    ) : (
                      <span className="inline-flex items-center gap-1 text-xs font-semibold text-emerald-600">
                        <CheckCircle2 className="w-3.5 h-3.5" /> Billed
                      </span>
                    )}
                    <button
                      onClick={() => handleEditLog(log)}
                      className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-semibold text-slate-700 dark:text-slate-200 bg-slate-100 dark:bg-slate-800 rounded-lg hover:bg-slate-200 transition-colors"
                      title="Edit Timesheet"
                    >
                      <Pencil className="w-3.5 h-3.5" />
                      Edit
                    </button>
                    <button
                      onClick={() => handleDelete(log)}
                      className="p-1.5 text-slate-400 hover:text-rose-600 rounded-lg"
                      title="Delete Timesheet"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
};

// ============================================================================
// 7. REPORTS VIEW (Financial Summary & Live Statement of Accounts)
// ============================================================================
interface ReportsViewProps {
  companies: SubContractCompany[];
  activeCompany: SubContractCompany;
  statementSummary: ComputedStatementSummary;
  expenses: ExpenseRecord[];
  onSelectCompany: (companyId: string) => void;
  onDownloadPdf: (target: PdfExportTarget) => Promise<void>;
  exportingTarget: PdfExportTarget | null;
}

export const ReportsView: React.FC<ReportsViewProps> = ({
  companies,
  activeCompany,
  statementSummary,
  expenses,
  onSelectCompany,
  onDownloadPdf,
  exportingTarget,
}) => {
  const activeEntry: LedgerEntry | undefined =
    activeCompany.ledger.find((r) => r.id === activeCompany.activeLedgerEntryId) ||
    activeCompany.ledger[activeCompany.ledger.length - 1];

  const companySummaries = companies.map((c) => ({
    company: c,
    summary: computeStatementLedger(c),
    companyExpensesFils: expenses
      .filter((e) => e.companyId === c.id)
      .reduce((acc, e) => acc + e.amountFils, 0),
  }));

  return (
    <div className="space-y-6">
      <div className="no-print bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 overflow-hidden">
        <div className="px-5 py-4 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <BarChart3 className="w-4 h-4 text-[#0088FF]" />
            <h2 className="text-sm font-bold text-slate-900 dark:text-white">
              Receivables, Expenses &amp; Statement Report
            </h2>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-xs border-collapse">
            <thead>
              <tr className="bg-slate-50 dark:bg-slate-800/60 border-b border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-400 font-bold text-left">
                <th className="py-3 px-4">Sub-Contract Client Pad</th>
                <th className="py-3 px-4">Customer (TO:)</th>
                <th className="py-3 px-4 text-right">Total Invoiced</th>
                <th className="py-3 px-4 text-right">Received</th>
                <th className="py-3 px-4 text-right">Balance Due</th>
                <th className="py-3 px-4 text-right">Operating Expenses</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {companySummaries.map(({ company, summary, companyExpensesFils }) => (
                <tr
                  key={company.id}
                  onClick={() => onSelectCompany(company.id)}
                  className={`cursor-pointer transition-colors ${
                    company.id === activeCompany.id
                      ? 'bg-sky-50/70 dark:bg-sky-950/30'
                      : 'hover:bg-slate-50 dark:hover:bg-slate-800/40'
                  }`}
                >
                  <td className="py-3 px-4 font-bold text-slate-900 dark:text-white">
                    {company.code} · {company.nameEn}
                  </td>
                  <td className="py-3 px-4 text-slate-600 dark:text-slate-300">
                    {company.clientName}
                  </td>
                  <td className="py-3 px-4 text-right font-mono-tabular font-semibold">
                    KWD {formatFilsToKwd(summary.displayTotalInvoicedFils, true)}
                  </td>
                  <td className="py-3 px-4 text-right font-mono-tabular text-emerald-700 dark:text-emerald-400">
                    KWD {formatFilsToKwd(summary.totalReceivedFils, true)}
                  </td>
                  <td className="py-3 px-4 text-right font-mono-tabular font-bold text-amber-700 dark:text-amber-400">
                    KWD {formatFilsToKwd(summary.netOutstandingBalanceFils, true)}
                  </td>
                  <td className="py-3 px-4 text-right font-mono-tabular text-rose-600">
                    KWD {formatFilsToKwd(companyExpensesFils, true)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Statement of Accounts Preview & Export */}
      <div className="no-print bg-white dark:bg-slate-900 px-5 py-3.5 rounded-xl border border-slate-200 dark:border-slate-800 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h3 className="text-xs font-bold text-slate-900 dark:text-white">
            Official Statement of Accounts — {activeCompany.nameEn} ({activeCompany.ledger.length} entries)
          </h3>
          <p className="text-[11px] text-slate-500">
            Net Balance Due: KWD{' '}
            {formatFilsToKwd(statementSummary.netOutstandingBalanceFils, true)}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={() => onDownloadPdf('statement')}
            disabled={exportingTarget !== null}
            className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-bold text-white bg-[#0088FF] rounded-lg hover:bg-blue-600 disabled:opacity-50"
          >
            <Download className="w-3.5 h-3.5" />
            Download Statement PDF
          </button>
          <button
            onClick={() => window.print()}
            className="p-2 text-slate-600 dark:text-slate-300 bg-slate-100 dark:bg-slate-800 rounded-lg hover:bg-slate-200"
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
  );
};

// ============================================================================
// 8. ADVANCED BILLING VIEW (Relational Recurring Sub-Contract Profiles)
// ============================================================================
interface AdvancedBillingViewProps {
  companies: SubContractCompany[];
  activeCompany: SubContractCompany;
  customers: CustomerRecipient[];
  items: ServiceCatalogItem[];
  profiles: RecurringContractProfile[];
  onUpdateProfiles: (profiles: RecurringContractProfile[]) => void;
  onGenerateRecurringInvoice: (
    profile: RecurringContractProfile,
    dateIso: string
  ) => void;
  onShowToast?: (msg: string) => void;
}

export const AdvancedBillingView: React.FC<AdvancedBillingViewProps> = ({
  companies,
  activeCompany,
  customers,
  items,
  profiles,
  onUpdateProfiles,
  onGenerateRecurringInvoice,
  onShowToast,
}) => {
  const [editingId, setEditingId] = useState<string | null>(null);
  const [companyId, setCompanyId] = useState(activeCompany.id);
  const [customerId, setCustomerId] = useState(
    activeCompany.defaultCustomerId || customers[0]?.id || ''
  );
  const [itemId, setItemId] = useState('');
  const [profileName, setProfileName] = useState('');
  const [clientName, setClientName] = useState(activeCompany.clientName);
  const [amountKwd, setAmountKwd] = useState('');
  const [genDateIso, setGenDateIso] = useState(() => getTodayIsoDate());
  const [confirmModal, setConfirmModal] = useState<ActionConfirmState | null>(null);

  const resetForm = () => {
    setEditingId(null);
    setCompanyId(activeCompany.id);
    setCustomerId(activeCompany.defaultCustomerId || customers[0]?.id || '');
    setItemId('');
    setProfileName('');
    setClientName(activeCompany.clientName);
    setAmountKwd('');
  };

  const handleEditProfile = (prof: RecurringContractProfile) => {
    setEditingId(prof.id);
    setCompanyId(prof.companyId);
    setCustomerId(prof.customerId || '');
    setItemId(prof.itemId || '');
    setProfileName(prof.profileName);
    setClientName(prof.clientName);
    setAmountKwd(formatFilsToKwd(prof.defaultAmountFils));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!profileName.trim()) return;
    const comp = companies.find((c) => c.id === companyId) || activeCompany;

    if (editingId) {
      const updated = profiles.map((p) =>
        p.id === editingId
          ? {
              ...p,
              companyId: comp.id,
              customerId: customerId || undefined,
              itemId: itemId || undefined,
              profileName: profileName.trim(),
              clientName: clientName.trim() || comp.clientName,
              defaultAmountFils: parseKwdToFils(amountKwd),
            }
          : p
      );
      onUpdateProfiles(updated);
      onShowToast?.('Recurring contract profile updated.');
      resetForm();
      return;
    }

    const newProf: RecurringContractProfile = {
      id: `rec-${Date.now()}`,
      companyId: comp.id,
      customerId: customerId || undefined,
      itemId: itemId || undefined,
      profileName: profileName.trim(),
      clientName: clientName.trim() || comp.clientName,
      cadence: 'Monthly',
      defaultAmountFils: parseKwdToFils(amountKwd),
      active: true,
      lastGeneratedMonth: 'Not generated yet',
    };
    onUpdateProfiles([...profiles, newProf]);
    onShowToast?.('Recurring contract profile saved.');
    resetForm();
  };

  const handleDelete = (prof: RecurringContractProfile) => {
    setConfirmModal({
      title: 'Delete Recurring Profile?',
      description: `Are you sure you want to delete "${prof.profileName}"?`,
      confirmLabel: 'Confirm Delete',
      variant: 'danger',
      onConfirm: () => {
        onUpdateProfiles(profiles.filter((p) => p.id !== prof.id));
        if (editingId === prof.id) resetForm();
        onShowToast?.('Recurring contract profile deleted.');
      },
    });
  };

  const handleConfirmGenerate = (prof: RecurringContractProfile) => {
    setConfirmModal({
      title: 'Generate Monthly Invoice from Contract?',
      description: `This will create an official Invoice for "${prof.profileName}" (${prof.clientName}) dated ${formatIsoDateForInvoice(genDateIso).shortDate} for KWD ${formatFilsToKwd(prof.defaultAmountFils, true)}.`,
      confirmLabel: 'Generate Invoice',
      variant: 'primary',
      onConfirm: () => {
        onGenerateRecurringInvoice(prof, genDateIso);
      },
    });
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
      <ActionConfirmModal state={confirmModal} onClose={() => setConfirmModal(null)} />

      <form
        onSubmit={handleSubmit}
        className="lg:col-span-5 bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 p-5 space-y-4"
      >
        <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
          <div className="flex items-center gap-2">
            <Layers className="w-4 h-4 text-[#0088FF]" />
            <h2 className="text-sm font-bold text-slate-900 dark:text-white">
              {editingId
                ? 'Edit Recurring Contract Profile'
                : 'New Recurring Contract Profile'}
            </h2>
          </div>
          {editingId && (
            <button
              type="button"
              onClick={resetForm}
              className="inline-flex items-center gap-1 text-xs font-semibold text-slate-500 hover:text-slate-800 dark:hover:text-slate-200"
            >
              <X className="w-3.5 h-3.5" />
              Cancel
            </button>
          )}
        </div>

        <div>
          <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
            Sub-Contract Client Pad
          </label>
          <select
            value={companyId}
            onChange={(e) => {
              const c = companies.find((x) => x.id === e.target.value);
              setCompanyId(e.target.value);
              if (c) {
                setClientName(c.clientName);
                if (c.defaultCustomerId) setCustomerId(c.defaultCustomerId);
              }
            }}
            className="w-full px-3 py-2 text-xs font-semibold bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg"
          >
            {companies.map((c) => (
              <option key={c.id} value={c.id}>
                {c.code} · {c.nameEn}
              </option>
            ))}
          </select>
        </div>

        {/* Relational Customer Picker */}
        <div>
          <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
            Customer (TO:)*
          </label>
          {customers.length > 0 && (
            <select
              value={customerId}
              onChange={(e) => {
                setCustomerId(e.target.value);
                const found = customers.find((c) => c.id === e.target.value);
                if (found) setClientName(found.name);
              }}
              className="w-full px-3 py-2 text-xs font-semibold bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg mb-2"
            >
              <option value="">-- Choose from Customers Directory --</option>
              {customers.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name} ({c.projectTitle})
                </option>
              ))}
            </select>
          )}
          <input
            type="text"
            value={clientName}
            onChange={(e) => setClientName(e.target.value)}
            required
            className="w-full px-3 py-2 text-xs font-semibold bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg"
          />
        </div>

        {items.length > 0 && (
          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
              Linked Service Catalog Item
            </label>
            <select
              value={itemId}
              onChange={(e) => {
                setItemId(e.target.value);
                const it = items.find((x) => x.id === e.target.value);
                if (it) {
                  if (!profileName) setProfileName(`${it.name} Contract`);
                  if (it.defaultRateFils > 0) {
                    setAmountKwd(formatFilsToKwd(it.defaultRateFils));
                  }
                }
              }}
              className="w-full px-3 py-2 text-xs font-semibold bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg"
            >
              <option value="">-- Select Service Item --</option>
              {items.map((it) => (
                <option key={it.id} value={it.id}>
                  {it.name} (KWD {formatFilsToKwd(it.defaultRateFils)})
                </option>
              ))}
            </select>
          </div>
        )}

        <div>
          <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
            Contract Profile Name*
          </label>
          <input
            type="text"
            value={profileName}
            onChange={(e) => setProfileName(e.target.value)}
            placeholder="e.g. Talabat Monthly Manpower Sub-Contract"
            required
            className="w-full px-3 py-2 text-xs font-semibold bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg"
          />
        </div>

        <div>
          <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
            Default Monthly Amount (KWD)*
          </label>
          <input
            type="number"
            step="0.001"
            value={amountKwd}
            onChange={(e) => setAmountKwd(e.target.value)}
            placeholder="18986.000"
            required
            className="w-full px-3 py-2 text-xs font-bold font-mono-tabular bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg"
          />
        </div>

        <div className="flex items-center gap-2">
          <button
            type="submit"
            className="flex-1 inline-flex items-center justify-center gap-1.5 px-4 py-2.5 text-xs font-bold text-white bg-[#0088FF] rounded-lg hover:bg-blue-600 transition-colors"
          >
            {editingId ? <Check className="w-4 h-4" /> : <Plus className="w-4 h-4" />}
            {editingId ? 'Update Profile' : 'Save Recurring Profile'}
          </button>
          {editingId && (
            <button
              type="button"
              onClick={resetForm}
              className="px-3.5 py-2.5 text-xs font-semibold text-slate-600 dark:text-slate-300 bg-slate-100 dark:bg-slate-800 rounded-lg"
            >
              Cancel
            </button>
          )}
        </div>
      </form>

      <div className="lg:col-span-7 bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 overflow-hidden">
        <div className="px-5 py-4 border-b border-slate-200 dark:border-slate-800 flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-sm font-bold text-slate-900 dark:text-white">
              Recurring Sub-Contract Profiles ({profiles.length})
            </h2>
            <p className="text-xs text-slate-500">
              Select target invoice date and generate monthly invoices with one click
            </p>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-xs font-semibold text-slate-600 dark:text-slate-400">
              Invoice Date:
            </span>
            <input
              type="date"
              value={genDateIso}
              onChange={(e) => setGenDateIso(e.target.value)}
              className="px-2.5 py-1.5 text-xs font-mono-tabular bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg"
            />
          </div>
        </div>

        <div className="divide-y divide-slate-100 dark:divide-slate-800">
          {profiles.length === 0 ? (
            <div className="p-8 text-center text-xs text-slate-500">
              No recurring profiles configured yet.
            </div>
          ) : (
            profiles.map((prof) => {
              const comp = companies.find((c) => c.id === prof.companyId);
              const linkedItem = items.find((i) => i.id === prof.itemId);
              return (
                <div
                  key={prof.id}
                  className={`p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4 transition-colors ${
                    editingId === prof.id
                      ? 'bg-sky-50/70 dark:bg-sky-950/30'
                      : 'hover:bg-slate-50 dark:hover:bg-slate-800/40'
                  }`}
                >
                  <div className="space-y-1">
                    <div className="text-xs font-bold text-slate-900 dark:text-white">
                      {prof.profileName}
                    </div>
                    <div className="text-xs text-slate-600 dark:text-slate-400">
                      Pad: {comp?.nameEn} · TO: {prof.clientName}
                      {linkedItem ? ` · Item: ${linkedItem.name}` : ''}
                    </div>
                    <div className="text-[11px] text-slate-500">
                      Last Billed Month: {prof.lastGeneratedMonth}
                    </div>
                  </div>

                  <div className="flex flex-wrap items-center gap-2 shrink-0">
                    <span className="text-xs font-bold font-mono-tabular text-slate-900 dark:text-white mr-1">
                      KWD {formatFilsToKwd(prof.defaultAmountFils, true)}
                    </span>
                    <button
                      onClick={() => handleConfirmGenerate(prof)}
                      className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-semibold text-white bg-[#0088FF] rounded-lg hover:bg-blue-600"
                    >
                      Generate Invoice
                      <ArrowRight className="w-3.5 h-3.5" />
                    </button>
                    <button
                      onClick={() => handleEditProfile(prof)}
                      className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-semibold text-slate-700 dark:text-slate-200 bg-slate-100 dark:bg-slate-800 rounded-lg hover:bg-slate-200 transition-colors"
                      title="Edit Profile"
                    >
                      <Pencil className="w-3.5 h-3.5" />
                      Edit
                    </button>
                    <button
                      onClick={() => handleDelete(prof)}
                      className="p-1.5 text-slate-400 hover:text-rose-600 rounded-lg"
                      title="Delete Profile"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
};
