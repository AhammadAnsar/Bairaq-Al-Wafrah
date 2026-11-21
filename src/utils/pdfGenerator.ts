import { jsPDF } from 'jspdf';
import { ComputedStatementSummary, LedgerEntry, SubContractCompany } from '../types/billing';
import {
  computeBillingMonthAndCodeFromIsoDate,
  formatFilsToKwd,
  formatIsoDateForInvoice,
  getTodayIsoDate,
} from './kwdMath';

export type PdfExportTarget = 'invoice' | 'statement' | 'both';

/**
 * Converts an SVG or PNG data URL into a high-resolution PNG data URL via HTML5 Canvas
 * so jsPDF can embed logos, watermarks, stamps, and signatures reliably.
 */
async function rasterizeDataUrlToPng(
  dataUrl: string,
  targetWidth = 400,
  targetHeight = 400,
  opacity = 1
): Promise<string | null> {
  if (!dataUrl) return null;
  return new Promise((resolve) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      const canvas = document.createElement('canvas');
      canvas.width = targetWidth;
      canvas.height = targetHeight;
      const ctx = canvas.getContext('2d');
      if (!ctx) {
        resolve(null);
        return;
      }
      ctx.globalAlpha = opacity;
      ctx.drawImage(img, 0, 0, targetWidth, targetHeight);
      resolve(canvas.toDataURL('image/png'));
    };
    img.onerror = () => resolve(null);
    img.src = dataUrl;
  });
}

function hexToRgb(hex: string): [number, number, number] {
  const cleaned = hex.replace('#', '');
  const num = Number.parseInt(
    cleaned.length === 3
      ? cleaned
          .split('')
          .map((c) => c + c)
          .join('')
      : cleaned,
    16
  );
  if (Number.isNaN(num)) return [169, 208, 142];
  return [(num >> 16) & 255, (num >> 8) & 255, num & 255];
}

/**
 * Generates an A4 PDF for:
 * - 'invoice': Page 1 Invoice / Bill only
 * - 'statement': Page 2 Statement of Accounts only
 * - 'both': Combined 2-page PDF (Invoice + Statement of Accounts)
 */
export async function generateCompanyInvoiceAndStatementPdf(
  company: SubContractCompany,
  propActiveEntry: LedgerEntry | undefined,
  statementSummary: ComputedStatementSummary,
  target: PdfExportTarget = 'both'
): Promise<{ blob: Blob; fileName: string }> {
  const todayIso = getTodayIsoDate();
  const formattedToday = formatIsoDateForInvoice(todayIso);
  const derivedBilling = computeBillingMonthAndCodeFromIsoDate(todayIso);

  const activeEntry: LedgerEntry = propActiveEntry || {
    id: 'empty-ledger-entry',
    seqNumber: 1,
    invoiceNo: `${company.code}000`,
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

  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4',
  });

  // Pre-rasterize brand assets
  const [logoPng, watermarkPng, stampPng, signaturePng, fullPadPng] = await Promise.all([
    company.branding.logoUrl
      ? rasterizeDataUrlToPng(company.branding.logoUrl, 360, 320, 1)
      : Promise.resolve(null),
    company.branding.showWatermark && company.branding.watermarkUrl
      ? rasterizeDataUrlToPng(
          company.branding.watermarkUrl,
          800,
          720,
          company.branding.watermarkOpacity || 0.15
        )
      : Promise.resolve(null),
    company.branding.showStamp && company.branding.stampUrl
      ? rasterizeDataUrlToPng(company.branding.stampUrl, 420, 360, 1)
      : Promise.resolve(null),
    company.branding.showSignature && company.branding.signatureUrl
      ? rasterizeDataUrlToPng(company.branding.signatureUrl, 360, 180, 1)
      : Promise.resolve(null),
    company.branding.padMode !== 'dynamic' && company.branding.fullPadUrl
      ? rasterizeDataUrlToPng(company.branding.fullPadUrl, 1240, 1754, 1)
      : Promise.resolve(null),
  ]);

  const drawHeaderAndFooter = (pageTitle: string, isStatementPage: boolean) => {
    // 1. Optional Full A4 Letterhead Pad Background
    if (
      fullPadPng &&
      (company.branding.padMode === 'full_pad' || company.branding.padMode === 'hybrid')
    ) {
      doc.addImage(fullPadPng, 'PNG', 0, 0, 210, 297);
    }

    // 2. Optional Center Watermark
    if (
      watermarkPng &&
      company.branding.showWatermark &&
      company.branding.padMode !== 'full_pad'
    ) {
      doc.addImage(watermarkPng, 'PNG', 25, 62, 160, 145);
    }

    // 3. Header Section (unless pure full_pad mode)
    if (company.branding.padMode !== 'full_pad') {
      if (company.branding.headerStyle === 'gmk_centered_emblem') {
        const [r, g, b] = hexToRgb(company.branding.primaryColor || '#548235');
        doc.setTextColor(r, g, b);
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(13.5);
        doc.text(company.nameEn, 56, 17, { align: 'center' });
        doc.setFontSize(8.5);
        doc.text(company.subtitleEn, 56, 22, { align: 'center' });

        if (logoPng) {
          doc.addImage(logoPng, 'PNG', 95, 10, 20, 19);
        }
        if (company.emblemCaption) {
          doc.setFontSize(11);
          doc.text(company.emblemCaption, 105, 34, { align: 'center' });
        }

        doc.setFontSize(11);
        doc.text(company.code, 162, 18, { align: 'center' });

        // Main Document Title
        doc.setFontSize(15);
        doc.text(pageTitle, 105, 42, { align: 'center' });
      } else {
        // Left rounded title box + Right Logo & Name
        doc.setDrawColor(80, 95, 120);
        doc.setFillColor(238, 242, 248);
        doc.roundedRect(22, 13, isStatementPage ? 66 : 54, 12, 2.5, 2.5, 'FD');
        doc.setTextColor(15, 23, 42);
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(13);
        doc.text(pageTitle, 22 + (isStatementPage ? 33 : 27), 20.5, { align: 'center' });

        if (logoPng) {
          doc.addImage(logoPng, 'PNG', 108, 8, 28, 23);
        }
        const [r, g, b] = hexToRgb(company.branding.primaryColor || '#1d4ed8');
        doc.setTextColor(r, g, b);
        doc.setFont('times', 'bold');
        doc.setFontSize(18);
        doc.text(company.nameEn, 138, 19);
        doc.setTextColor(30, 41, 59);
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(8.2);
        doc.text(company.subtitleEn, 138, 23.5);
      }
    }

    // 4. Footer Section
    if (company.branding.padMode !== 'full_pad') {
      doc.setTextColor(40, 40, 40);
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(7.8);
      if (company.footerStyle === 'split_contact_bar' && company.footerAddressLines) {
        let yFooter = 266;
        (company.footerPhones || []).forEach((line) => {
          doc.text(line, 86, yFooter, { align: 'right' });
          yFooter += 3.8;
        });
        company.footerAddressLines.forEach((line) => {
          doc.text(line, 86, yFooter, { align: 'right' });
          yFooter += 3.8;
        });
        doc.setDrawColor(120, 120, 120);
        doc.line(89, 263, 89, 288);
      } else {
        doc.text(company.footerEn, 105, 279, { align: 'center' });
        if (company.showPageNumber) {
          doc.setFont('helvetica', 'bold');
          doc.setFontSize(7.5);
          doc.text('1 OF 1', 105, 286, { align: 'center' });
        }
      }
    }
  };

  const renderInvoicePage = () => {
    drawHeaderAndFooter(company.invoiceTitle, false);

    doc.setTextColor(0, 0, 0);
    doc.setFont('helvetica', 'bolditalic');
    doc.setFontSize(10.5);
    doc.text(`INVOICE No.: ${activeEntry.invoiceNo}`, 22, 55);

    doc.setFont('helvetica', 'italic');
    doc.text('Date:', 22, 62);
    doc.setFont('helvetica', 'bolditalic');
    doc.text(activeEntry.invoiceDate, 47, 62);

    doc.setFont('helvetica', 'italic');
    doc.text('TO:', 22, 70);
    doc.setFont('helvetica', 'bold');
    doc.text(activeEntry.customerName || company.clientName, 47, 70);

    doc.setFont('helvetica', 'bolditalic');
    doc.text(company.salutationLine1, 22, 82);
    const salutationBody = company.salutationTemplate.replace(
      '{MONTH}',
      activeEntry.billingMonthFull
    );
    const wrappedSalutation = doc.splitTextToSize(salutationBody, 165);
    doc.text(wrappedSalutation, 22, 90);

    // Invoice Table
    const tableTop = 108;
    const [hr, hg, hb] = hexToRgb(company.branding.tableHeaderBg || '#a9d08e');
    doc.setFillColor(hr, hg, hb);
    doc.setDrawColor(0, 0, 0);
    doc.setLineWidth(0.3);
    doc.rect(20, tableTop, 106, 8, 'FD');
    doc.rect(126, tableTop, 68, 8, 'FD');

    doc.setFont('helvetica', 'bolditalic');
    doc.setFontSize(10.5);
    doc.text('DESCRIPTION', 73, tableTop + 5.5, { align: 'center' });
    doc.text('AMOUNT IN KUWAITI DINAR', 160, tableTop + 5.5, { align: 'center' });

    // Table Body
    doc.rect(20, tableTop + 8, 106, 38);
    doc.rect(126, tableTop + 8, 68, 38);

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9.5);
    const descLines = doc.splitTextToSize(activeEntry.description, 96);
    doc.text(descLines, 73, tableTop + 25, { align: 'center' });

    doc.setFontSize(11);
    doc.text(formatFilsToKwd(activeEntry.invoiceAmountFils), 160, tableTop + 27, {
      align: 'center',
    });

    // Total Row
    doc.rect(20, tableTop + 46, 106, 8);
    doc.rect(126, tableTop + 46, 68, 8);
    doc.setFontSize(9.5);
    doc.text('TOTAL AMOUNT', 123, tableTop + 51.5, { align: 'right' });
    doc.setFontSize(11);
    doc.text(formatFilsToKwd(activeEntry.invoiceAmountFils), 160, tableTop + 51.5, {
      align: 'center',
    });

    // Bank Details
    let bankY = tableTop + 65;
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(10);
    company.bankDetails.forEach((bd) => {
      if (company.bankStyle === 'dash') {
        doc.text(bd.label, 22, bankY);
        doc.text(`- ${bd.value}`, 60, bankY);
      } else {
        doc.text(`${bd.label}: ${bd.value}`, 22, bankY);
      }
      bankY += 6;
    });

    // Stamp & Signature on Invoice
    const signBlockY = bankY + 18;
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(10.5);
    doc.text(company.closingPhrase, 22, signBlockY);

    if (signaturePng && company.branding.showSignature) {
      doc.addImage(signaturePng, 'PNG', 22, signBlockY + 2, 32, 16);
    }
    if (stampPng && company.branding.showStamp) {
      doc.addImage(
        stampPng,
        'PNG',
        company.branding.headerStyle === 'gmk_centered_emblem' ? 28 : 54,
        signBlockY - 12,
        42,
        36
      );
    }
    if (company.signatoryName) {
      doc.text(company.signatoryName, 22, signBlockY + 23);
    }
    if (company.signatoryTitle) {
      doc.text(company.signatoryTitle, 22, signBlockY + 29);
    }
  };

  const renderStatementPage = () => {
    drawHeaderAndFooter(company.statementTitle, true);

    doc.setTextColor(0, 0, 0);
    doc.setFont('helvetica', 'italic');
    doc.setFontSize(10);
    doc.text('Date:', 22, 56);
    doc.setFont('helvetica', 'bolditalic');
    doc.text(activeEntry.statementDateDisplay || activeEntry.invoiceDate, 44, 56);

    doc.setFont('helvetica', 'italic');
    doc.text('TO:', 22, 70);
    doc.setFont('helvetica', 'bold');
    doc.text(activeEntry.customerName || company.clientName, 44, 70);

    const colWidths = [22, 20, 22, 34, 28, 28, 24];
    const colX = [16, 38, 58, 80, 114, 142, 170];
    const headers = [
      'DATE',
      'MONTH',
      'INV. NUMBER',
      'INV. AMOUNT',
      'RECEIVED',
      'DATE OF RECEIVED',
      'BALANCE',
    ];

    let stY = 82;
    doc.setDrawColor(60, 60, 60);
    doc.setLineWidth(0.25);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(7.5);

    headers.forEach((h, i) => {
      doc.rect(colX[i], stY, colWidths[i], 9);
      const lines = doc.splitTextToSize(h, colWidths[i] - 2);
      doc.text(lines, colX[i] + colWidths[i] / 2, stY + (lines.length > 1 ? 3.8 : 5.5), {
        align: 'center',
      });
    });

    stY += 9;
    const rowH = 6.2;
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8.8);

    statementSummary.rows.forEach((r) => {
      colWidths.forEach((w, i) => {
        doc.rect(colX[i], stY, w, rowH);
      });

      const textY = stY + 4.4;
      doc.text(r.entry.invoiceDate, colX[0] + colWidths[0] / 2, textY, { align: 'center' });
      doc.text(r.entry.monthTag, colX[1] + colWidths[1] / 2, textY, { align: 'center' });
      doc.text(String(r.entry.seqNumber), colX[2] + colWidths[2] / 2, textY, {
        align: 'center',
      });

      doc.text(formatFilsToKwd(r.entry.invoiceAmountFils), colX[3] + colWidths[3] - 2, textY, {
        align: 'right',
      });

      if (r.entry.receivedAmountFils !== null && r.entry.receivedAmountFils > 0) {
        doc.text(
          formatFilsToKwd(r.entry.receivedAmountFils),
          colX[4] + colWidths[4] - 2,
          textY,
          {
            align: 'right',
          }
        );
      }
      if (r.entry.receivedDate) {
        doc.text(r.entry.receivedDate, colX[5] + colWidths[5] / 2, textY, { align: 'center' });
      }
      if (r.displayBalanceFils !== null && r.displayBalanceFils > 0) {
        doc.text(formatFilsToKwd(r.displayBalanceFils), colX[6] + colWidths[6] - 2, textY, {
          align: 'right',
        });
      }

      stY += rowH;
    });

    // Statement Summary Row
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9.5);
    const kwdPrefix = company.totalPrefixStyle === 'with_space' ? 'KWD ' : 'KWD';
    doc.text(
      `${kwdPrefix}${formatFilsToKwd(statementSummary.displayTotalInvoicedFils)}`,
      colX[3] + colWidths[3] - 1,
      stY + 5,
      { align: 'right' }
    );
    doc.text(
      formatFilsToKwd(statementSummary.netOutstandingBalanceFils),
      colX[6] + colWidths[6] - 1,
      stY + 5,
      { align: 'right' }
    );

    // Stamp & Signature on Statement
    const stSignY = Math.min(stY + 26, 225);
    if (company.signatoryName) {
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(9.5);
      doc.text(company.signatoryName.replace(',', ''), 22, stSignY);
    }
    if (signaturePng && company.branding.showSignature) {
      doc.addImage(signaturePng, 'PNG', 22, stSignY + 2, 32, 16);
    }
    if (company.signatoryTitle) {
      doc.text(company.signatoryTitle, 22, stSignY + 22);
    }
    if (stampPng && company.branding.showStamp) {
      doc.addImage(
        stampPng,
        'PNG',
        company.branding.headerStyle === 'gmk_centered_emblem' ? 35 : 65,
        stSignY - 4,
        44,
        38
      );
    }
  };

  const sanitizedMonth = activeEntry.billingMonthFull.replace(/\s+/g, '_');
  let fileName = `${company.code}_Invoice_and_Statement_${sanitizedMonth}.pdf`;

  if (target === 'invoice') {
    renderInvoicePage();
    fileName = `${company.code}_Invoice_${activeEntry.invoiceNo}_${sanitizedMonth}.pdf`;
  } else if (target === 'statement') {
    renderStatementPage();
    fileName = `${company.code}_Statement_${sanitizedMonth}.pdf`;
  } else {
    renderInvoicePage();
    doc.addPage();
    renderStatementPage();
    fileName = `${company.code}_Invoice_and_Statement_${sanitizedMonth}.pdf`;
  }

  const blob = doc.output('blob');
  return { blob, fileName };
}
