import React, { useEffect, useRef, useState } from 'react';
import { ComputedStatementSummary, LedgerEntry, SubContractCompany } from '../types/billing';
import {
  computeBillingMonthAndCodeFromIsoDate,
  formatFilsToKwd,
  formatIsoDateForInvoice,
  getTodayIsoDate,
} from '../utils/kwdMath';

interface A4DocumentPreviewProps {
  company: SubContractCompany;
  activeEntry?: LedgerEntry;
  statementSummary: ComputedStatementSummary;
  viewMode: 'both' | 'invoice' | 'statement';
}

// Standard A4 dimensions at 96 DPI: 210mm x 297mm = 794px x 1123px
const A4_WIDTH_PX = 794;
const A4_HEIGHT_PX = 1123;

interface ShrinkToFitSheetProps {
  children: React.ReactNode;
  containerWidth: number;
}

const ShrinkToFitA4Sheet: React.FC<ShrinkToFitSheetProps> = ({
  children,
  containerWidth,
}) => {
  // Compute scale factor so the 794px A4 sheet fits cleanly inside the available container width
  const available = Math.max(280, containerWidth - 8);
  const scale = Math.min(1, available / A4_WIDTH_PX);
  const scaledWidth = Math.round(A4_WIDTH_PX * scale);
  const scaledHeight = Math.round(A4_HEIGHT_PX * scale);

  return (
    <div
      className="a4-scale-wrapper relative mx-auto overflow-hidden shadow-md border border-slate-300 dark:border-slate-700 bg-white transition-all duration-150"
      style={{
        width: `${scaledWidth}px`,
        height: `${scaledHeight}px`,
      }}
    >
      <div
        className="a4-page-sheet relative bg-white text-black flex flex-col justify-between box-border overflow-hidden origin-top-left"
        style={{
          width: `${A4_WIDTH_PX}px`,
          height: `${A4_HEIGHT_PX}px`,
          minHeight: `${A4_HEIGHT_PX}px`,
          padding: '48px 60px 42px 60px',
          transform: `scale(${scale})`,
        }}
      >
        {children}
      </div>
    </div>
  );
};

export const A4DocumentPreview: React.FC<A4DocumentPreviewProps> = ({
  company,
  activeEntry: propActiveEntry,
  statementSummary,
  viewMode,
}) => {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [containerWidth, setContainerWidth] = useState<number>(680);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    const updateWidth = () => {
      if (el.clientWidth > 0) {
        setContainerWidth(el.clientWidth);
      }
    };

    updateWidth();
    const observer = new ResizeObserver(() => {
      updateWidth();
    });
    observer.observe(el);
    window.addEventListener('resize', updateWidth);
    return () => {
      observer.disconnect();
      window.removeEventListener('resize', updateWidth);
    };
  }, []);

  const todayIso = getTodayIsoDate();
  const formattedToday = formatIsoDateForInvoice(todayIso);
  const derivedBilling = computeBillingMonthAndCodeFromIsoDate(todayIso);

  const activeEntry: LedgerEntry = propActiveEntry || {
    id: 'empty-ledger-entry',
    seqNumber: 1,
    invoiceNo: `${company.code}—`,
    invoiceDate: formattedToday.shortDate,
    statementDateDisplay: formattedToday.longDate,
    monthTag: derivedBilling.statementMonthCode,
    billingMonthFull: derivedBilling.billingMonthFull,
    description: 'No invoice entries recorded',
    invoiceAmountFils: 0,
    receivedAmountFils: null,
    receivedDate: '',
    manualBalanceFils: null,
    customerName: company.clientName,
  };

  const { branding } = company;
  const isFullPadOnly = branding.padMode === 'full_pad' && Boolean(branding.fullPadUrl);
  const showFullPadBg =
    (branding.padMode === 'full_pad' || branding.padMode === 'hybrid') &&
    Boolean(branding.fullPadUrl);

  const salutationBody = company.salutationTemplate.replace(
    '{MONTH}',
    activeEntry.billingMonthFull
  );

  const renderPageHeader = (pageTitle: string, isStatementPage: boolean) => {
    if (isFullPadOnly) {
      return <div className="h-28" />;
    }

    if (branding.headerStyle === 'gmk_centered_emblem') {
      return (
        <div className="relative z-10 mb-5">
          <div className="grid grid-cols-12 items-start gap-2">
            {/* Left English Company Title */}
            <div className="col-span-5 text-center pt-2">
              <div
                className="text-[17px] font-extrabold tracking-wide leading-tight uppercase"
                style={{ color: branding.primaryColor || '#548235' }}
              >
                {company.nameEn}
              </div>
              <div
                className="text-[10.5px] font-bold mt-0.5 tracking-tight"
                style={{ color: branding.primaryColor || '#548235' }}
              >
                {company.subtitleEn}
              </div>
            </div>

            {/* Center Emblem */}
            <div className="col-span-2 flex flex-col items-center justify-center">
              {branding.logoUrl && (
                <img
                  src={branding.logoUrl}
                  alt={company.nameEn}
                  referrerPolicy="no-referrer"
                  className="h-16 w-auto object-contain"
                />
              )}
              {company.emblemCaption && (
                <div
                  className="text-[14px] font-extrabold mt-0.5 tracking-tight whitespace-nowrap"
                  style={{ color: branding.primaryColor || '#548235' }}
                >
                  {company.emblemCaption}
                </div>
              )}
            </div>

            {/* Right Arabic Company Title */}
            <div className="col-span-5 text-center pt-1 font-arabic" dir="rtl">
              <div
                className="text-[19px] font-bold leading-tight"
                style={{ color: branding.primaryColor || '#548235' }}
              >
                {company.nameAr}
              </div>
              <div
                className="text-[11.5px] font-semibold mt-0.5"
                style={{ color: branding.primaryColor || '#548235' }}
              >
                {company.subtitleAr}
              </div>
            </div>
          </div>

          {/* Centered Document Title */}
          <div className="text-center mt-2">
            <span
              className="text-[20px] font-extrabold tracking-wide"
              style={{
                color: isStatementPage ? '#385723' : branding.primaryColor || '#548235',
              }}
            >
              {pageTitle}
            </span>
          </div>
        </div>
      );
    }

    // Salah Behbehani Header Style (sb_split_badge)
    return (
      <div className="relative z-10 flex items-start justify-between gap-4 mb-6 pt-1">
        <div className="mt-2">
          <div
            className="px-6 py-2 rounded-lg border border-slate-600 text-[18px] font-bold text-black shadow-2xs"
            style={{ backgroundColor: '#e2e8f0' }}
          >
            {pageTitle}
          </div>
        </div>

        <div className="flex items-center gap-2.5">
          {branding.logoUrl && (
            <img
              src={branding.logoUrl}
              alt={company.nameEn}
              referrerPolicy="no-referrer"
              className="h-20 w-auto object-contain shrink-0"
            />
          )}
          <div className="text-left">
            <div
              className="text-[24px] font-extrabold leading-none tracking-wide"
              style={{
                color: branding.primaryColor || '#1d4ed8',
                fontFamily: 'Georgia, Times New Roman, serif',
              }}
            >
              {company.nameEn}
            </div>
            <div className="text-[10.5px] font-bold text-slate-900 tracking-tight mt-0.5 border-t border-dotted border-slate-500 pt-0.5">
              {company.subtitleEn}
            </div>
            {company.nameAr && (
              <div
                className="text-[11px] font-semibold text-slate-700 font-arabic mt-0.5"
                dir="rtl"
              >
                {company.nameAr}
              </div>
            )}
          </div>
        </div>
      </div>
    );
  };

  const renderPageFooter = () => {
    if (isFullPadOnly) return null;

    if (company.footerStyle === 'split_contact_bar') {
      return (
        <div className="relative z-10 mt-auto pt-4 text-[10px] leading-[1.35] text-slate-900">
          <div className="flex items-stretch justify-center">
            <div className="pr-3 text-right font-medium space-y-0.5 border-r border-slate-500">
              {(company.footerPhones || []).map((line, i) => (
                <div key={i} className="whitespace-pre">
                  {line}
                </div>
              ))}
              {(company.footerAddressLines || []).map((line, i) => (
                <div key={i} className="whitespace-pre">
                  {line}
                </div>
              ))}
            </div>
            <div className="w-24" />
          </div>
        </div>
      );
    }

    return (
      <div className="relative z-10 mt-auto pt-4 text-center text-slate-900">
        {company.footerAr && (
          <div className="text-[10.5px] font-bold font-arabic leading-snug" dir="rtl">
            {company.footerAr}
          </div>
        )}
        {company.footerEn && (
          <div className="text-[9.5px] font-semibold leading-snug mt-0.5">{company.footerEn}</div>
        )}
        {company.showPageNumber && (
          <div className="text-[9px] font-extrabold text-emerald-900 mt-2">1 OF 1</div>
        )}
      </div>
    );
  };

  const renderWatermarkAndPad = () => (
    <>
      {showFullPadBg && (
        <img
          src={branding.fullPadUrl}
          alt="Company Letterhead Pad"
          referrerPolicy="no-referrer"
          className="absolute inset-0 w-full h-full object-cover pointer-events-none z-0"
        />
      )}
      {!isFullPadOnly && branding.showWatermark && branding.watermarkUrl && (
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none z-0 overflow-hidden">
          <img
            src={branding.watermarkUrl}
            alt=""
            referrerPolicy="no-referrer"
            className="w-[430px] h-[430px] object-contain select-none"
            style={{ opacity: branding.watermarkOpacity ?? 0.16 }}
          />
        </div>
      )}
    </>
  );

  return (
    <div
      ref={containerRef}
      className="print-only-container w-full flex flex-col items-center gap-6"
    >
      {/* ===================================================================
          PAGE 1: INVOICE / BILL (Shrink-to-Fit A4)
         =================================================================== */}
      {(viewMode === 'both' || viewMode === 'invoice') && (
        <ShrinkToFitA4Sheet containerWidth={containerWidth}>
          {renderWatermarkAndPad()}

          <div className="relative z-10 flex-1 flex flex-col">
            {renderPageHeader(company.invoiceTitle, false)}

            {/* Invoice Meta Block */}
            <div className="mt-2 space-y-1.5 text-[13.5px] leading-snug">
              <div className="font-bold italic">INVOICE No.: {activeEntry.invoiceNo}</div>
              <div className="grid grid-cols-12 items-baseline">
                <span className="col-span-2 italic">Date:</span>
                <span className="col-span-10 font-medium italic">{activeEntry.invoiceDate}</span>
              </div>
              <div className="grid grid-cols-12 items-baseline pt-1">
                <span className="col-span-2 italic">TO:</span>
                <span className="col-span-10 font-bold">
                  {activeEntry.customerName || company.clientName}
                </span>
              </div>
            </div>

            {/* Salutation */}
            <div className="mt-6 space-y-2 text-[13.5px] font-bold italic leading-relaxed">
              <div>{company.salutationLine1}</div>
              <div className="max-w-[92%]">{salutationBody}</div>
            </div>

            {/* Invoice Main Table */}
            <div className="mt-7 border border-black">
              <div
                className="grid grid-cols-12 border-b border-black text-[13.5px] font-bold italic text-center"
                style={{ backgroundColor: branding.tableHeaderBg || '#a9d08e' }}
              >
                <div className="col-span-7 py-1.5 px-3 border-r border-black">DESCRIPTION</div>
                <div className="col-span-5 py-1.5 px-3">AMOUNT IN KUWAITI DINAR</div>
              </div>

              <div className="grid grid-cols-12 border-b border-black min-h-[138px] items-center text-center">
                <div className="col-span-7 h-full flex flex-col items-center justify-center px-6 py-6 border-r border-black">
                  <div className="text-[12.5px] font-bold leading-snug">
                    {activeEntry.description}
                  </div>
                </div>
                <div className="col-span-5 h-full flex items-center justify-center px-4 py-6">
                  <span className="text-[14.5px] font-bold font-mono-tabular">
                    {formatFilsToKwd(activeEntry.invoiceAmountFils)}
                  </span>
                </div>
              </div>

              <div className="grid grid-cols-12 items-center text-[12.5px] font-bold">
                <div className="col-span-7 py-1.5 px-3 border-r border-black text-right uppercase">
                  TOTAL AMOUNT
                </div>
                <div className="col-span-5 py-1.5 px-3 text-center text-[14.5px] font-mono-tabular">
                  {formatFilsToKwd(activeEntry.invoiceAmountFils)}
                </div>
              </div>
            </div>

            {/* Bank Details Block */}
            <div className="mt-7 space-y-1.5 text-[13px] font-bold">
              {company.bankDetails.map((item) =>
                company.bankStyle === 'dash' ? (
                  <div key={item.id} className="grid grid-cols-12 items-baseline">
                    <span className="col-span-3">{item.label}</span>
                    <span className="col-span-9 font-mono-tabular">- {item.value}</span>
                  </div>
                ) : (
                  <div key={item.id}>
                    <span>{item.label}: </span>
                    <span className="font-mono-tabular">{item.value}</span>
                  </div>
                )
              )}
            </div>

            {/* Stamp & Sign-Off Block */}
            <div className="mt-8 relative min-h-[125px] flex items-center">
              {branding.headerStyle === 'gmk_centered_emblem' ? (
                <div className="relative flex items-center">
                  <span className="text-[13px] font-bold z-10">{company.closingPhrase}</span>
                  {branding.showStamp && branding.stampUrl && (
                    <img
                      src={branding.stampUrl}
                      alt="Official Company Stamp"
                      referrerPolicy="no-referrer"
                      className="w-44 h-36 object-contain -ml-16 -mt-2 pointer-events-none select-none"
                    />
                  )}
                  {branding.showSignature && branding.signatureUrl && (
                    <img
                      src={branding.signatureUrl}
                      alt="Authorized Signature"
                      referrerPolicy="no-referrer"
                      className="w-32 h-20 object-contain -ml-24 pointer-events-none select-none"
                    />
                  )}
                </div>
              ) : (
                <div className="flex items-center gap-5">
                  <div className="space-y-1 text-[13.5px] text-slate-900">
                    <div>{company.closingPhrase}</div>
                    {branding.showSignature && branding.signatureUrl ? (
                      <img
                        src={branding.signatureUrl}
                        alt="Signature"
                        referrerPolicy="no-referrer"
                        className="h-14 w-auto object-contain my-0.5 pointer-events-none select-none"
                      />
                    ) : (
                      <div className="h-10" />
                    )}
                    {company.signatoryName && <div>{company.signatoryName}</div>}
                    {company.signatoryTitle && <div>{company.signatoryTitle}</div>}
                  </div>
                  {branding.showStamp && branding.stampUrl && (
                    <img
                      src={branding.stampUrl}
                      alt="Company Stamp"
                      referrerPolicy="no-referrer"
                      className="w-36 h-36 object-contain pointer-events-none select-none"
                    />
                  )}
                </div>
              )}
            </div>
          </div>

          {renderPageFooter()}
        </ShrinkToFitA4Sheet>
      )}

      {/* ===================================================================
          PAGE 2: STATEMENT OF ACCOUNTS (Shrink-to-Fit A4)
         =================================================================== */}
      {(viewMode === 'both' || viewMode === 'statement') && (
        <ShrinkToFitA4Sheet containerWidth={containerWidth}>
          {renderWatermarkAndPad()}

          <div className="relative z-10 flex-1 flex flex-col">
            {renderPageHeader(company.statementTitle, true)}

            {/* Statement Date & Recipient */}
            <div className="mt-3 space-y-5 text-[13px] px-2">
              <div className="grid grid-cols-12 items-baseline">
                <span className="col-span-2 italic">Date:</span>
                <span className="col-span-10 font-bold italic">
                  {activeEntry.statementDateDisplay || activeEntry.invoiceDate}
                </span>
              </div>
              <div className="grid grid-cols-12 items-baseline">
                <span className="col-span-2 italic">TO:</span>
                <span className="col-span-10 font-bold text-[13.5px]">
                  {activeEntry.customerName || company.clientName}
                </span>
              </div>
            </div>

            {/* Statement Table */}
            <div className="mt-6">
              <table className="w-full border-collapse border border-slate-700 text-[12px]">
                <thead>
                  <tr className="border-b border-slate-700 text-[10.5px] font-bold text-center leading-tight">
                    <th className="border border-slate-700 py-1.5 px-1.5 w-[13%]">DATE</th>
                    <th className="border border-slate-700 py-1.5 px-1.5 w-[11%]">MONTH</th>
                    <th className="border border-slate-700 py-1.5 px-1 w-[12%]">
                      INV.
                      <br />
                      NUMBER
                    </th>
                    <th className="border border-slate-700 py-1.5 px-2 w-[20%]">INV. AMOUNT</th>
                    <th className="border border-slate-700 py-1.5 px-2 w-[15%]">RECEIVED</th>
                    <th className="border border-slate-700 py-1.5 px-1.5 w-[16%]">
                      DATE OF
                      <br />
                      RECEIVED
                    </th>
                    <th className="border border-slate-700 py-1.5 px-2 w-[13%]">BALANCE</th>
                  </tr>
                </thead>
                <tbody>
                  {statementSummary.rows.map((r) => {
                    const isBoldNumbers = branding.headerStyle === 'sb_split_badge';
                    return (
                      <tr key={r.entry.id} className="leading-tight">
                        <td className="border border-slate-700 py-1 px-1.5 text-center whitespace-nowrap">
                          {r.entry.invoiceDate}
                        </td>
                        <td className="border border-slate-700 py-1 px-1.5 text-center whitespace-nowrap">
                          {r.entry.monthTag}
                        </td>
                        <td className="border border-slate-700 py-1 px-1 text-center font-mono-tabular">
                          {r.entry.seqNumber}
                        </td>
                        <td
                          className={`border border-slate-700 py-1 px-2 text-right font-mono-tabular ${
                            isBoldNumbers ? 'font-bold' : ''
                          }`}
                        >
                          {formatFilsToKwd(r.entry.invoiceAmountFils)}
                        </td>
                        <td
                          className={`border border-slate-700 py-1 px-2 text-right font-mono-tabular ${
                            isBoldNumbers ? 'font-bold' : ''
                          }`}
                        >
                          {r.entry.receivedAmountFils !== null && r.entry.receivedAmountFils > 0
                            ? formatFilsToKwd(r.entry.receivedAmountFils)
                            : ''}
                        </td>
                        <td className="border border-slate-700 py-1 px-1.5 text-center whitespace-nowrap">
                          {r.entry.receivedDate || ''}
                        </td>
                        <td className="border border-slate-700 py-1 px-2 text-right font-mono-tabular">
                          {r.displayBalanceFils !== null && r.displayBalanceFils > 0
                            ? formatFilsToKwd(r.displayBalanceFils)
                            : ''}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
                <tfoot>
                  <tr className="font-bold text-[12.5px]">
                    <td colSpan={3} className="py-1.5 px-2" />
                    <td className="py-1.5 px-2 text-right font-mono-tabular whitespace-nowrap">
                      {company.totalPrefixStyle === 'with_space' ? 'KWD ' : 'KWD'}
                      {formatFilsToKwd(statementSummary.displayTotalInvoicedFils)}
                    </td>
                    <td colSpan={2} className="py-1.5 px-2" />
                    <td className="py-1.5 px-2 text-right font-mono-tabular whitespace-nowrap">
                      {formatFilsToKwd(statementSummary.netOutstandingBalanceFils)}
                    </td>
                  </tr>
                </tfoot>
              </table>
            </div>

            {/* Stamp & Signature on Statement Page */}
            <div className="mt-10 px-2">
              {branding.headerStyle === 'gmk_centered_emblem' ? (
                <div className="flex items-center">
                  {branding.showStamp && branding.stampUrl && (
                    <img
                      src={branding.stampUrl}
                      alt="Official Company Stamp"
                      referrerPolicy="no-referrer"
                      className="w-48 h-40 object-contain ml-6 pointer-events-none select-none"
                    />
                  )}
                </div>
              ) : (
                <div className="space-y-1 text-[13px]">
                  <div className="font-bold">
                    {(company.signatoryName || 'Best Regard').replace(',', '')}
                  </div>
                  {branding.showSignature && branding.signatureUrl && (
                    <img
                      src={branding.signatureUrl}
                      alt="Authorized Signature"
                      referrerPolicy="no-referrer"
                      className="h-14 w-auto object-contain pointer-events-none select-none"
                    />
                  )}
                  {company.signatoryTitle && (
                    <div className="font-bold">{company.signatoryTitle}</div>
                  )}
                  {branding.showStamp && branding.stampUrl && (
                    <div className="pl-28 -mt-4">
                      <img
                        src={branding.stampUrl}
                        alt="Official Company Stamp"
                        referrerPolicy="no-referrer"
                        className="w-36 h-36 object-contain pointer-events-none select-none"
                      />
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>

          {renderPageFooter()}
        </ShrinkToFitA4Sheet>
      )}
    </div>
  );
};
