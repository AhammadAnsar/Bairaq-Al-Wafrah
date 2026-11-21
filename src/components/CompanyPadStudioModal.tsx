import React, { useState } from 'react';
import {
  Building2,
  Upload,
  Plus,
  Trash2,
  Check,
  FileImage,
  Landmark,
} from 'lucide-react';
import { BankDetailItem, SubContractCompany } from '../types/billing';
import { processUploadedAssetImage } from '../utils/defaultAssets';
import { ActionConfirmModal, ActionConfirmState } from './ZohoModulesViews';

interface CompanyPadStudioViewProps {
  companies: SubContractCompany[];
  activeCompany: SubContractCompany;
  onSelectCompany: (companyId: string) => void;
  onUpdateCompany: (updated: SubContractCompany) => void;
  onCreateCompany: (newCompany: SubContractCompany) => void;
  onDeleteCompany: (companyId: string) => void;
}

export const CompanyPadStudioView: React.FC<CompanyPadStudioViewProps> = ({
  companies,
  activeCompany,
  onSelectCompany,
  onUpdateCompany,
  onCreateCompany,
  onDeleteCompany,
}) => {
  const [uploadingSlot, setUploadingSlot] = useState<string | null>(null);
  const [confirmModal, setConfirmModal] = useState<ActionConfirmState | null>(null);
  const [saveFeedback, setSaveFeedback] = useState<string | null>(null);

  const showToast = (msg: string) => {
    setSaveFeedback(msg);
    setTimeout(() => setSaveFeedback(null), 2500);
  };

  const handleFieldChange = <K extends keyof SubContractCompany>(
    key: K,
    value: SubContractCompany[K]
  ) => {
    onUpdateCompany({
      ...activeCompany,
      [key]: value,
    });
  };

  const handleBrandingChange = <K extends keyof SubContractCompany['branding']>(
    key: K,
    value: SubContractCompany['branding'][K]
  ) => {
    onUpdateCompany({
      ...activeCompany,
      branding: {
        ...activeCompany.branding,
        [key]: value,
      },
    });
  };

  const handleImageUpload = async (
    e: React.ChangeEvent<HTMLInputElement>,
    slot: 'logoUrl' | 'stampUrl' | 'signatureUrl' | 'fullPadUrl'
  ) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadingSlot(slot);
    try {
      const shouldCleanWhite = slot === 'stampUrl' || slot === 'signatureUrl';
      const dataUrl = await processUploadedAssetImage(file, {
        removeWhiteBg: shouldCleanWhite,
        maxDimension: slot === 'fullPadUrl' ? 1600 : 800,
      });

      if (slot === 'fullPadUrl') {
        onUpdateCompany({
          ...activeCompany,
          branding: {
            ...activeCompany.branding,
            fullPadUrl: dataUrl,
            padMode: 'hybrid',
          },
        });
      } else {
        handleBrandingChange(slot, dataUrl);
      }
      showToast('Uploaded and saved to company profile.');
    } catch (err) {
      console.error('Asset upload error:', err);
    } finally {
      setUploadingSlot(null);
      e.target.value = '';
    }
  };

  const handleAddBankRow = () => {
    const newRow: BankDetailItem = {
      id: `bank-${Date.now()}`,
      label: 'IBAN Number',
      value: '',
    };
    handleFieldChange('bankDetails', [...activeCompany.bankDetails, newRow]);
  };

  const handleUpdateBankRow = (id: string, field: 'label' | 'value', val: string) => {
    handleFieldChange(
      'bankDetails',
      activeCompany.bankDetails.map((b) => (b.id === id ? { ...b, [field]: val } : b))
    );
  };

  const handleRemoveBankRow = (item: BankDetailItem) => {
    setConfirmModal({
      title: 'Delete Bank Account Line?',
      description: `Are you sure you want to remove "${item.label}: ${item.value || '—'}" from ${activeCompany.nameEn}?`,
      confirmLabel: 'Confirm Delete',
      variant: 'danger',
      onConfirm: () => {
        handleFieldChange(
          'bankDetails',
          activeCompany.bankDetails.filter((b) => b.id !== item.id)
        );
        showToast('Bank account line removed.');
      },
    });
  };

  const handleCreateNewCompany = () => {
    const id = `company-${Date.now()}`;
    const initRowId = `row-init-${Date.now()}`;
    const newComp: SubContractCompany = {
      id,
      code: 'NEW',
      nameEn: 'NEW PARTNER COMPANY',
      subtitleEn: 'General Trading & Contracting Co.',
      nameAr: '',
      subtitleAr: '',
      emblemCaption: '',
      clientName: 'M/S. Talabat General Trading Company',
      invoiceTitle: 'INVOICE',
      statementTitle: 'Statement of Accounts',
      salutationLine1: 'Dear Sir / Madam,',
      salutationTemplate:
        'Please find the below our invoice for manpower supplied to your organization for the month of {MONTH}',
      bankStyle: 'colon',
      bankDetails: [
        { id: `b1-${Date.now()}`, label: 'Company Account Name', value: '' },
        { id: `b2-${Date.now()}`, label: 'Account Number', value: '' },
        { id: `b3-${Date.now()}`, label: 'IBAN Number', value: '' },
      ],
      closingPhrase: 'Thank You and Regards,',
      signatoryName: 'Best Regards,',
      signatoryTitle: 'General Manager',
      footerStyle: 'bilingual_centered',
      footerAr: '',
      footerEn: 'Kuwait - Tel: +965 ',
      showPageNumber: true,
      totalPrefixStyle: 'with_space',
      customTotalInvoicedFils: null,
      branding: {
        padMode: 'dynamic',
        headerStyle: 'gmk_centered_emblem',
        primaryColor: '#0f766e',
        tableHeaderBg: '#a9d08e',
        logoUrl: '',
        watermarkUrl: '',
        showWatermark: false,
        watermarkOpacity: 0.14,
        stampUrl: '',
        showStamp: true,
        signatureUrl: '',
        showSignature: true,
        fullPadUrl: '',
      },
      activeLedgerEntryId: initRowId,
      ledger: [
        {
          id: initRowId,
          seqNumber: 1,
          invoiceNo: 'INV0126',
          invoiceDate: '08-Nov-2026',
          statementDateDisplay: '08 November 2026',
          monthTag: '11-Oct',
          billingMonthFull: 'October 2026',
          description: 'Charges for Manpower Supplied for the month of October - 2026',
          invoiceAmountFils: 0,
          receivedAmountFils: null,
          receivedDate: '',
          manualBalanceFils: null,
        },
      ],
    };
    onCreateCompany(newComp);
    showToast('New company created. Fill in details and upload Pad, Seal & Sign.');
  };

  return (
    <div className="space-y-5">
      <ActionConfirmModal
        state={confirmModal}
        onClose={() => setConfirmModal(null)}
      />
      {/* Top Company Selector & Add Company Button */}
      <div className="flex flex-wrap items-center justify-between gap-4 bg-white dark:bg-slate-900 px-5 py-3.5 rounded-xl border border-slate-200 dark:border-slate-800">
        <div className="flex flex-wrap items-center gap-2">
          {companies.map((c) => (
            <button
              key={c.id}
              onClick={() => onSelectCompany(c.id)}
              className={`px-3.5 py-2 rounded-lg text-xs font-semibold transition-colors whitespace-nowrap shrink-0 ${
                c.id === activeCompany.id
                  ? 'bg-teal-700 text-white'
                  : 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700'
              }`}
            >
              {c.nameEn}
            </button>
          ))}
        </div>

        <button
          onClick={handleCreateNewCompany}
          className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold text-white bg-teal-700 rounded-lg hover:bg-teal-800 transition-colors whitespace-nowrap shrink-0"
        >
          <Plus className="w-3.5 h-3.5" />
          Add New Company
        </button>
      </div>

      {saveFeedback && (
        <div className="flex items-center gap-2 px-4 py-2.5 rounded-lg bg-emerald-50 dark:bg-emerald-950/60 border border-emerald-200 dark:border-emerald-800 text-emerald-800 dark:text-emerald-200 text-xs font-medium">
          <Check className="w-4 h-4 shrink-0" />
          <span>{saveFeedback}</span>
        </div>
      )}

      {/* Simple 2-Column Company Setup: Left = Company & Bank Info | Right = Pad, Seal & Sign */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Left: Company Name & Bank Info */}
        <div className="lg:col-span-6 space-y-5">
          <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 p-5 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
              <div className="flex items-center gap-2">
                <Building2 className="w-4 h-4 text-teal-700" />
                <h2 className="text-sm font-bold text-slate-900 dark:text-white">
                  Company Information
                </h2>
              </div>
              {companies.length > 1 && (
                <button
                  onClick={() =>
                    setConfirmModal({
                      title: 'Delete Sub-Contract Client Company?',
                      description: `Are you sure you want to delete "${activeCompany.nameEn}" (${activeCompany.code}) and all its invoices and statement entries?`,
                      confirmLabel: 'Confirm Delete',
                      variant: 'danger',
                      onConfirm: () => {
                        onDeleteCompany(activeCompany.id);
                      },
                    })
                  }
                  className="inline-flex items-center gap-1 text-xs text-rose-600 hover:text-rose-700 font-medium"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  Delete Company
                </button>
              )}
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5">
              <div className="sm:col-span-2">
                <label className="block text-xs font-semibold text-slate-600 dark:text-slate-400 mb-1">
                  Company Name (English)
                </label>
                <input
                  type="text"
                  value={activeCompany.nameEn}
                  onChange={(e) => handleFieldChange('nameEn', e.target.value)}
                  className="w-full px-3 py-2 text-sm font-semibold bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-600"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-600 dark:text-slate-400 mb-1">
                  Short Code
                </label>
                <input
                  type="text"
                  value={activeCompany.code}
                  onChange={(e) => handleFieldChange('code', e.target.value)}
                  className="w-full px-3 py-2 text-sm font-mono-tabular bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-600"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
              <div>
                <label className="block text-xs font-semibold text-slate-600 dark:text-slate-400 mb-1">
                  Subtitle (English)
                </label>
                <input
                  type="text"
                  value={activeCompany.subtitleEn}
                  onChange={(e) => handleFieldChange('subtitleEn', e.target.value)}
                  className="w-full px-3 py-2 text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-600 dark:text-slate-400 mb-1">
                  Company Name (Arabic / Optional)
                </label>
                <input
                  type="text"
                  dir="rtl"
                  value={activeCompany.nameAr}
                  onChange={(e) => handleFieldChange('nameAr', e.target.value)}
                  className="w-full px-3 py-2 text-xs font-arabic bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-600 dark:text-slate-400 mb-1">
                Client Organization Name (TO:)
              </label>
              <input
                type="text"
                value={activeCompany.clientName}
                onChange={(e) => handleFieldChange('clientName', e.target.value)}
                className="w-full px-3 py-2 text-sm bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-600 dark:text-slate-400 mb-1">
                Footer Address &amp; Contact Line
              </label>
              <input
                type="text"
                value={activeCompany.footerEn}
                onChange={(e) => handleFieldChange('footerEn', e.target.value)}
                className="w-full px-3 py-2 text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg"
              />
            </div>
          </div>

          {/* Bank Details Card */}
          <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 p-5 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
              <div className="flex items-center gap-2">
                <Landmark className="w-4 h-4 text-teal-700" />
                <h2 className="text-sm font-bold text-slate-900 dark:text-white">
                  Bank Account Details
                </h2>
              </div>
              <button
                onClick={handleAddBankRow}
                className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-semibold text-teal-700 dark:text-teal-300 bg-teal-50 dark:bg-teal-950/50 rounded-lg hover:bg-teal-100"
              >
                <Plus className="w-3.5 h-3.5" />
                Add Line
              </button>
            </div>

            <div className="space-y-2.5">
              {activeCompany.bankDetails.map((item) => (
                <div key={item.id} className="flex items-center gap-2">
                  <input
                    type="text"
                    value={item.label}
                    onChange={(e) => handleUpdateBankRow(item.id, 'label', e.target.value)}
                    placeholder="Label (e.g. IBAN Number)"
                    className="w-2/5 px-3 py-2 text-xs font-semibold bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg"
                  />
                  <input
                    type="text"
                    value={item.value}
                    onChange={(e) => handleUpdateBankRow(item.id, 'value', e.target.value)}
                    placeholder="Account / IBAN Value"
                    className="flex-1 px-3 py-2 text-xs font-mono-tabular bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg"
                  />
                  <button
                    onClick={() => handleRemoveBankRow(item)}
                    className="p-2 text-slate-400 hover:text-rose-600"
                    title="Remove line"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Right: Pad, Logo, Seal & Signature Uploaders */}
        <div className="lg:col-span-6">
          <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 p-5 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
              <div className="flex items-center gap-2">
                <FileImage className="w-4 h-4 text-teal-700" />
                <h2 className="text-sm font-bold text-slate-900 dark:text-white">
                  Company Pad, Logo, Seal &amp; Signature
                </h2>
              </div>
              <span className="text-xs text-slate-400">Upload or replace anytime</span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {/* 1. Company Pad (Full A4 Letterhead) */}
              <div className="p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/60 dark:bg-slate-800/40 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-slate-800 dark:text-slate-200">
                    1. Company Pad (Full A4)
                  </span>
                  {activeCompany.branding.fullPadUrl && (
                    <button
                      onClick={() => {
                        onUpdateCompany({
                          ...activeCompany,
                          branding: {
                            ...activeCompany.branding,
                            fullPadUrl: '',
                            padMode: 'dynamic',
                          },
                        });
                      }}
                      className="text-[11px] text-rose-600 hover:underline"
                    >
                      Remove
                    </button>
                  )}
                </div>
                <div className="h-28 rounded-lg border border-dashed border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 flex items-center justify-center p-2 overflow-hidden">
                  {activeCompany.branding.fullPadUrl ? (
                    <img
                      src={activeCompany.branding.fullPadUrl}
                      alt="Company Pad"
                      referrerPolicy="no-referrer"
                      className="max-h-full max-w-full object-contain"
                    />
                  ) : (
                    <span className="text-xs text-slate-400">Using Dynamic Header</span>
                  )}
                </div>
                <label className="w-full inline-flex items-center justify-center gap-1.5 px-3 py-2 text-xs font-semibold text-slate-700 dark:text-slate-200 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg hover:bg-slate-100 cursor-pointer transition-colors">
                  <Upload className="w-3.5 h-3.5" />
                  <span>
                    {uploadingSlot === 'fullPadUrl' ? 'Uploading...' : 'Upload Pad Image'}
                  </span>
                  <input
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={(e) => handleImageUpload(e, 'fullPadUrl')}
                  />
                </label>
              </div>

              {/* 2. Company Logo */}
              <div className="p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/60 dark:bg-slate-800/40 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-slate-800 dark:text-slate-200">
                    2. Company Logo
                  </span>
                  {activeCompany.branding.logoUrl && (
                    <button
                      onClick={() => handleBrandingChange('logoUrl', '')}
                      className="text-[11px] text-rose-600 hover:underline"
                    >
                      Remove
                    </button>
                  )}
                </div>
                <div className="h-28 rounded-lg border border-dashed border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 flex items-center justify-center p-2 overflow-hidden">
                  {activeCompany.branding.logoUrl ? (
                    <img
                      src={activeCompany.branding.logoUrl}
                      alt="Company Logo"
                      referrerPolicy="no-referrer"
                      className="max-h-full max-w-full object-contain"
                    />
                  ) : (
                    <span className="text-xs text-slate-400">No Logo</span>
                  )}
                </div>
                <label className="w-full inline-flex items-center justify-center gap-1.5 px-3 py-2 text-xs font-semibold text-slate-700 dark:text-slate-200 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg hover:bg-slate-100 cursor-pointer transition-colors">
                  <Upload className="w-3.5 h-3.5" />
                  <span>{uploadingSlot === 'logoUrl' ? 'Uploading...' : 'Upload Logo'}</span>
                  <input
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={(e) => handleImageUpload(e, 'logoUrl')}
                  />
                </label>
              </div>

              {/* 3. Official Seal / Stamp */}
              <div className="p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/60 dark:bg-slate-800/40 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-slate-800 dark:text-slate-200">
                    3. Official Seal (Stamp)
                  </span>
                  {activeCompany.branding.stampUrl && (
                    <button
                      onClick={() => handleBrandingChange('stampUrl', '')}
                      className="text-[11px] text-rose-600 hover:underline"
                    >
                      Remove
                    </button>
                  )}
                </div>
                <div className="h-28 rounded-lg border border-dashed border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 flex items-center justify-center p-2 overflow-hidden">
                  {activeCompany.branding.stampUrl ? (
                    <img
                      src={activeCompany.branding.stampUrl}
                      alt="Company Seal"
                      referrerPolicy="no-referrer"
                      className="max-h-full max-w-full object-contain"
                    />
                  ) : (
                    <span className="text-xs text-slate-400">No Seal Uploaded</span>
                  )}
                </div>
                <label className="w-full inline-flex items-center justify-center gap-1.5 px-3 py-2 text-xs font-semibold text-slate-700 dark:text-slate-200 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg hover:bg-slate-100 cursor-pointer transition-colors">
                  <Upload className="w-3.5 h-3.5" />
                  <span>{uploadingSlot === 'stampUrl' ? 'Uploading...' : 'Upload Seal'}</span>
                  <input
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={(e) => handleImageUpload(e, 'stampUrl')}
                  />
                </label>
              </div>

              {/* 4. Authorized Signature */}
              <div className="p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/60 dark:bg-slate-800/40 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-slate-800 dark:text-slate-200">
                    4. Signature
                  </span>
                  {activeCompany.branding.signatureUrl && (
                    <button
                      onClick={() => handleBrandingChange('signatureUrl', '')}
                      className="text-[11px] text-rose-600 hover:underline"
                    >
                      Remove
                    </button>
                  )}
                </div>
                <div className="h-28 rounded-lg border border-dashed border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 flex items-center justify-center p-2 overflow-hidden">
                  {activeCompany.branding.signatureUrl ? (
                    <img
                      src={activeCompany.branding.signatureUrl}
                      alt="Signature"
                      referrerPolicy="no-referrer"
                      className="max-h-full max-w-full object-contain"
                    />
                  ) : (
                    <span className="text-xs text-slate-400">No Separate Signature</span>
                  )}
                </div>
                <label className="w-full inline-flex items-center justify-center gap-1.5 px-3 py-2 text-xs font-semibold text-slate-700 dark:text-slate-200 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg hover:bg-slate-100 cursor-pointer transition-colors">
                  <Upload className="w-3.5 h-3.5" />
                  <span>
                    {uploadingSlot === 'signatureUrl' ? 'Uploading...' : 'Upload Signature'}
                  </span>
                  <input
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={(e) => handleImageUpload(e, 'signatureUrl')}
                  />
                </label>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
