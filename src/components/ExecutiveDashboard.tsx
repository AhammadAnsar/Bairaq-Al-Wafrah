import React from 'react';
import { FileText, BarChart3 } from 'lucide-react';
import { SubContractCompany } from '../types/billing';
import { computeStatementLedger, formatFilsToKwd } from '../utils/kwdMath';

interface ExecutiveDashboardProps {
  companies: SubContractCompany[];
  onOpenCompanyInvoice: (companyId: string) => void;
  onOpenCompanyStatement: (companyId: string) => void;
}

export const ExecutiveDashboard: React.FC<ExecutiveDashboardProps> = ({
  companies,
  onOpenCompanyInvoice,
  onOpenCompanyStatement,
}) => {
  const companySummaries = companies.map((company) => ({
    company,
    summary: computeStatementLedger(company),
    latestEntry: company.ledger[company.ledger.length - 1],
  }));

  const grandTotalInvoicedFils = companySummaries.reduce(
    (sum, item) => sum + item.summary.displayTotalInvoicedFils,
    0
  );
  const grandTotalReceivedFils = companySummaries.reduce(
    (sum, item) => sum + item.summary.totalReceivedFils,
    0
  );
  const grandNetOutstandingFils = companySummaries.reduce(
    (sum, item) => sum + item.summary.netOutstandingBalanceFils,
    0
  );

  return (
    <div className="space-y-6">
      {/* Corporate Identity Summary Header */}
      <div className="bg-white dark:bg-slate-900 p-5 rounded-xl border border-slate-200 dark:border-slate-800 flex items-center gap-3.5">
        <img
          src="/icon.svg"
          alt="Bairaq Al-Wafrah"
          className="w-10 h-10 rounded-xl object-contain shrink-0"
        />
        <div>
          <h2 className="text-base font-bold text-slate-900 dark:text-white">
            Bairaq Al-Wafrah
          </h2>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            Sub-Contract Manpower Billing &amp; Statement of Accounts Overview
          </p>
        </div>
      </div>

      {/* Functional 3-Column Receivables Summary */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-white dark:bg-slate-900 p-5 rounded-xl border border-slate-200 dark:border-slate-800">
          <div className="text-xs font-medium text-slate-500 dark:text-slate-400">
            Total Invoiced
          </div>
          <div className="text-2xl font-bold font-mono-tabular text-slate-900 dark:text-white mt-1">
            KWD {formatFilsToKwd(grandTotalInvoicedFils, true)}
          </div>
        </div>

        <div className="bg-white dark:bg-slate-900 p-5 rounded-xl border border-slate-200 dark:border-slate-800">
          <div className="text-xs font-medium text-slate-500 dark:text-slate-400">
            Total Received
          </div>
          <div className="text-2xl font-bold font-mono-tabular text-emerald-700 dark:text-emerald-400 mt-1">
            KWD {formatFilsToKwd(grandTotalReceivedFils, true)}
          </div>
        </div>

        <div className="bg-white dark:bg-slate-900 p-5 rounded-xl border border-slate-200 dark:border-slate-800">
          <div className="text-xs font-medium text-slate-500 dark:text-slate-400">
            Balance Due
          </div>
          <div className="text-2xl font-bold font-mono-tabular text-amber-700 dark:text-amber-400 mt-1">
            KWD {formatFilsToKwd(grandNetOutstandingFils, true)}
          </div>
        </div>
      </div>

      {/* Partner Companies Billing Table */}
      <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-200 dark:border-slate-800">
          <h2 className="text-sm font-bold text-slate-900 dark:text-slate-100">
            Company Billing Summary
          </h2>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-slate-200 dark:border-slate-800 text-xs font-semibold text-slate-500 dark:text-slate-400 bg-slate-50/50 dark:bg-slate-800/30">
                <th className="py-3 px-6">Company</th>
                <th className="py-3 px-4">Client</th>
                <th className="py-3 px-4">Latest Invoice</th>
                <th className="py-3 px-4 text-right">Total Invoiced (KWD)</th>
                <th className="py-3 px-4 text-right">Received (KWD)</th>
                <th className="py-3 px-4 text-right">Balance Due (KWD)</th>
                <th className="py-3 px-6 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800 text-sm">
              {companySummaries.map(({ company, summary, latestEntry }) => (
                <tr
                  key={company.id}
                  className="hover:bg-slate-50/80 dark:hover:bg-slate-800/40 transition-colors"
                >
                  <td className="py-4 px-6">
                    <div className="flex items-center gap-3">
                      {company.branding.logoUrl ? (
                        <img
                          src={company.branding.logoUrl}
                          alt={company.nameEn}
                          referrerPolicy="no-referrer"
                          className="w-9 h-9 object-contain rounded bg-white p-0.5 border border-slate-200 shrink-0"
                        />
                      ) : (
                        <div className="w-9 h-9 rounded bg-slate-100 text-slate-700 flex items-center justify-center font-bold text-xs shrink-0">
                          {company.code}
                        </div>
                      )}
                      <div>
                        <div className="font-bold text-slate-900 dark:text-white">
                          {company.nameEn}
                        </div>
                        <div className="text-xs text-slate-500 font-mono-tabular">
                          {company.code}
                        </div>
                      </div>
                    </div>
                  </td>

                  <td className="py-4 px-4 text-xs font-medium text-slate-700 dark:text-slate-300">
                    {company.clientName}
                  </td>

                  <td className="py-4 px-4 text-xs font-mono-tabular text-slate-700 dark:text-slate-300">
                    <div className="font-bold">{latestEntry?.invoiceNo}</div>
                    <div className="text-slate-500">
                      {latestEntry?.invoiceDate} · {latestEntry?.monthTag}
                    </div>
                  </td>

                  <td className="py-4 px-4 text-right font-mono-tabular text-slate-700 dark:text-slate-300">
                    {formatFilsToKwd(summary.displayTotalInvoicedFils, true)}
                  </td>

                  <td className="py-4 px-4 text-right font-mono-tabular text-emerald-700 dark:text-emerald-400">
                    {formatFilsToKwd(summary.totalReceivedFils, true)}
                  </td>

                  <td className="py-4 px-4 text-right font-mono-tabular font-bold text-amber-700 dark:text-amber-400">
                    {formatFilsToKwd(summary.netOutstandingBalanceFils, true)}
                  </td>

                  <td className="py-4 px-6 text-right whitespace-nowrap">
                    <div className="inline-flex items-center gap-2">
                      <button
                        onClick={() => onOpenCompanyStatement(company.id)}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-slate-700 dark:text-slate-300 bg-slate-100 dark:bg-slate-800 rounded-lg hover:bg-slate-200 transition-colors whitespace-nowrap shrink-0"
                      >
                        <BarChart3 className="w-3.5 h-3.5" />
                        Statement
                      </button>
                      <button
                        onClick={() => onOpenCompanyInvoice(company.id)}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-white bg-[#0088FF] rounded-lg hover:bg-blue-600 transition-colors whitespace-nowrap shrink-0"
                      >
                        <FileText className="w-3.5 h-3.5" />
                        Invoices
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
