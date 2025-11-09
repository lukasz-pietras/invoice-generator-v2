import { InvoiceData, InvoiceCalculations } from '../types/invoice';
import { Button } from './ui/button';
import { Download } from 'lucide-react';
import { ScrollArea } from './ui/scroll-area';

interface InvoicePDFPreviewProps {
  invoiceData: InvoiceData;
}

function isPercentageRate(rate: number): boolean {
  return rate >= 0;
}

function calculateVatAmount(rate: number, netAmount: number): number {
  return isPercentageRate(rate) ? (netAmount * rate) / 100 : 0;
}

function getVatLabel(rate: number): string {
  if (isPercentageRate(rate)) {
    return `${rate}%`;
  }

  switch (rate) {
    case -1:
      return 'ZW';
    case -2:
      return 'NP';
    case -3:
      return 'OO';
    default:
      return 'ZW';
  }
}

function calculateInvoice(data: InvoiceData): InvoiceCalculations {
  const vatBreakdown: { [key: number]: { net: number; vat: number; gross: number } } = {};

  data.items.forEach(item => {
    const netAmount = item.quantity * item.netPrice;
    const vatAmount = calculateVatAmount(item.vatRate, netAmount);
    const grossAmount = netAmount + vatAmount;

    if (!vatBreakdown[item.vatRate]) {
      vatBreakdown[item.vatRate] = { net: 0, vat: 0, gross: 0 };
    }

    vatBreakdown[item.vatRate].net += netAmount;
    vatBreakdown[item.vatRate].vat += vatAmount;
    vatBreakdown[item.vatRate].gross += grossAmount;
  });

  const netTotal = Object.values(vatBreakdown).reduce((sum, v) => sum + v.net, 0);
  const vatTotal = Object.values(vatBreakdown).reduce((sum, v) => sum + v.vat, 0);
  const grossTotal = netTotal + vatTotal;

  return {
    netTotal,
    vatTotal,
    grossTotal,
    vatBreakdown: Object.entries(vatBreakdown).map(([rate, values]) => ({
      rate: parseFloat(rate),
      ...values,
    })),
  };
}

function formatCurrency(amount: number, currency: string): string {
  const symbols: { [key: string]: string } = {
    PLN: 'zł',
    EUR: '€',
    USD: '$',
    GBP: '£',
  };
  return `${amount.toFixed(2)} ${symbols[currency] || currency}`;
}

function formatDate(dateString: string): string {
  if (!dateString) return '';
  const date = new Date(dateString);
  return date.toLocaleDateString('pl-PL');
}

export function InvoicePDFPreview({ invoiceData }: InvoicePDFPreviewProps) {
  const calculations = calculateInvoice(invoiceData);
  const exchangeRate = invoiceData.exchangeRate;
  const conversionRate =
    invoiceData.currency !== 'PLN' && exchangeRate.value !== null ? exchangeRate.value : null;
  const selectedRateDate = exchangeRate.targetDate;
  const effectiveRateDate = exchangeRate.effectiveDate;
  const shouldShowPlnBreakdown = invoiceData.currency !== 'PLN' && conversionRate !== null;
  const rateValue = conversionRate ?? 0;
  const plnItems = shouldShowPlnBreakdown
    ? invoiceData.items.map((item, index) => {
        const netAmount = item.quantity * item.netPrice;
        const vatAmount = calculateVatAmount(item.vatRate, netAmount);
        const grossAmount = netAmount + vatAmount;
        return {
          index,
          name: item.name,
          quantity: item.quantity,
          unit: item.unit,
          vatRate: item.vatRate,
          netUnitPln: item.netPrice * rateValue,
          netAmountPln: netAmount * rateValue,
          vatAmountPln: vatAmount * rateValue,
          grossAmountPln: grossAmount * rateValue,
        };
      })
    : [];
  const plnTotals = shouldShowPlnBreakdown
    ? {
        net: calculations.netTotal * rateValue,
        vat: calculations.vatTotal * rateValue,
        gross: calculations.grossTotal * rateValue,
      }
    : null;

  const handleDownload = () => {
    const previewElement = document.getElementById('invoice-preview');
    if (!previewElement) {
      return;
    }

    const iframe = document.createElement('iframe');
    iframe.style.position = 'fixed';
    iframe.style.right = '0';
    iframe.style.bottom = '0';
    iframe.style.width = '0';
    iframe.style.height = '0';
    iframe.style.border = '0';
    iframe.style.visibility = 'hidden';
    document.body.appendChild(iframe);

    const iframeWindow = iframe.contentWindow;
    const iframeDocument = iframeWindow?.document;

    if (!iframeWindow || !iframeDocument) {
      iframe.remove();
      return;
    }

    iframeDocument.open();
    iframeDocument.write('<!DOCTYPE html><html lang="pl"><head></head><body></body></html>');

    const headElements = document.querySelectorAll('style, link[rel="stylesheet"]');
    headElements.forEach(node => {
      iframeDocument.head.appendChild(node.cloneNode(true));
    });

    const printStyles = iframeDocument.createElement('style');
    printStyles.textContent = `
      @page {
        size: A4;
        margin: 0;
      }

      html, body {
        margin: 0;
        padding: 0;
        background: #f3f4f6;
      }

      body {
        display: flex;
        justify-content: center;
        align-items: flex-start;
      }

      #invoice-preview-print {
        width: 210mm;
        min-height: 297mm;
        box-sizing: border-box;
        background: #ffffff;
        margin: 0 auto;
        box-shadow: none !important;
        -webkit-print-color-adjust: exact;
        print-color-adjust: exact;
      }
    `;
    iframeDocument.head.appendChild(printStyles);

    const documentTitle = invoiceData.invoiceNumber
      ? `Faktura ${invoiceData.invoiceNumber}`
      : 'Faktura';
    iframeDocument.title = documentTitle;

    const clonedPreview = previewElement.cloneNode(true) as HTMLElement;
    clonedPreview.id = 'invoice-preview-print';
    iframeDocument.body.appendChild(clonedPreview);
    iframeDocument.body.style.margin = '0';
    iframeDocument.body.style.backgroundColor = '#f3f4f6';
    iframeDocument.close();

    const cleanup = () => {
      iframeWindow.onafterprint = null;
      if (iframe.parentNode) {
        iframe.parentNode.removeChild(iframe);
      }
    };

    iframeWindow.onafterprint = cleanup;

    setTimeout(() => {
      iframeWindow.focus();
      iframeWindow.print();
      setTimeout(cleanup, 2000);
    }, 150);
  };

  return (
    <div className="flex-1 min-w-[960px] bg-gray-100 flex flex-col">
      <div className="px-5 py-4 bg-white border-b border-gray-200 flex items-center justify-between">
        <div>
          <h2>Podgląd faktury</h2>
          <p className="text-sm text-gray-600">Użyj Ctrl+P lub przycisku poniżej, aby zapisać jako PDF</p>
        </div>
        <Button onClick={handleDownload}>
          <Download className="mr-2 h-4 w-4" />
          Pobierz / wydrukuj
        </Button>
      </div>

      <ScrollArea className="flex-1 overflow-auto">
        <div className="p-6 flex justify-center">
          <div
            id="invoice-preview"
            className="bg-white shadow-lg px-8 py-7"
            style={{ width: '210mm', minHeight: '297mm', boxSizing: 'border-box', fontSize: '13px', lineHeight: 1.45 }}
          >
            {/* Logo */}
            {invoiceData.logo && (
              <div className="flex justify-center mb-6">
                <img src={invoiceData.logo} alt="Logo" className="max-h-16 object-contain" />
              </div>
            )}

            {/* Header */}
            <div className="mb-5">
              <h1 className="mb-1 text-xl font-semibold tracking-wide">FAKTURA VAT</h1>
              <div className="text-gray-700 text-sm">
                <p>Nr: {invoiceData.invoiceNumber || '___________'}</p>
              </div>
            </div>

            {/* Dates & Payment */}
            <div className="mb-5">
              <div className="grid grid-cols-2 gap-x-6 gap-y-3 rounded-md border border-gray-200 bg-gray-50 px-4 py-3 text-xs">
                <div>
                  <p className="text-[10px] uppercase tracking-[0.18em] text-gray-500">Data wystawienia</p>
                  <p className="font-semibold text-gray-900">{formatDate(invoiceData.issueDate) || 'brak'}</p>
                </div>
                <div>
                  <p className="text-[10px] uppercase tracking-[0.18em] text-gray-500">Data sprzedaży</p>
                  <p className="font-semibold text-gray-900">{formatDate(invoiceData.saleDate) || 'brak'}</p>
                </div>
                <div>
                  <p className="text-[10px] uppercase tracking-[0.18em] text-gray-500">Termin płatności</p>
                  <p className="font-semibold text-gray-900">{formatDate(invoiceData.paymentDeadline) || 'brak'}</p>
                </div>
                <div>
                  <p className="text-[10px] uppercase tracking-[0.18em] text-gray-500">Metoda płatności</p>
                  <p className="font-semibold text-gray-900">{invoiceData.paymentMethod || 'brak'}</p>
                </div>
              </div>
            </div>

            {/* Seller and Buyer */}
            <div className="grid grid-cols-2 gap-6 mb-5">
              <div>
                <h3 className="mb-2 text-gray-700 text-sm font-medium uppercase tracking-wide">Sprzedawca:</h3>
                <div className="space-y-1 text-xs">
                  <p>{invoiceData.seller.name || '___________'}</p>
                  <p>{invoiceData.seller.address || '___________'}</p>
                  <p>{invoiceData.seller.postalCode} {invoiceData.seller.city}</p>
                  <p>NIP: {invoiceData.seller.nip || '___________'}</p>
                  {invoiceData.seller.bankAccount && (
                    <p className="mt-1">Nr konta: {invoiceData.seller.bankAccount}</p>
                  )}
                </div>
              </div>
              <div>
                <h3 className="mb-2 text-gray-700 text-sm font-medium uppercase tracking-wide">Nabywca:</h3>
                <div className="space-y-1 text-xs">
                  <p>{invoiceData.buyer.name || '___________'}</p>
                  <p>{invoiceData.buyer.address || '___________'}</p>
                  <p>{invoiceData.buyer.postalCode} {invoiceData.buyer.city}</p>
                  <p>NIP: {invoiceData.buyer.nip || '___________'}</p>
                </div>
              </div>
            </div>

            {/* Items Table */}
            <table className="w-full mb-5 text-xs">
              <thead>
                <tr className="bg-gray-100">
                  <th className="px-2 py-1.5 text-left border border-gray-300">Lp.</th>
                  <th className="px-2 py-1.5 text-left border border-gray-300">Nazwa</th>
                  <th className="px-2 py-1.5 text-center border border-gray-300">Ilość</th>
                  <th className="px-2 py-1.5 text-center border border-gray-300">Jedn.</th>
                  <th className="px-2 py-1.5 text-right border border-gray-300">Cena netto</th>
                  <th className="px-2 py-1.5 text-right border border-gray-300">Wartość netto</th>
                  <th className="px-2 py-1.5 text-center border border-gray-300">VAT</th>
                  <th className="px-2 py-1.5 text-right border border-gray-300">Kwota VAT</th>
                  <th className="px-2 py-1.5 text-right border border-gray-300">Wartość brutto</th>
                </tr>
              </thead>
              <tbody>
                {invoiceData.items.map((item, index) => {
                  const netAmount = item.quantity * item.netPrice;
                  const vatAmount = calculateVatAmount(item.vatRate, netAmount);
                  const grossAmount = netAmount + vatAmount;
                  const vatDisplay = getVatLabel(item.vatRate);

                  return (
                    <tr key={item.id}>
                      <td className="px-2 py-1.5 border border-gray-300">{index + 1}</td>
                      <td className="px-2 py-1.5 border border-gray-300">{item.name || '___________'}</td>
                      <td className="px-2 py-1.5 text-center border border-gray-300">{item.quantity}</td>
                      <td className="px-2 py-1.5 text-center border border-gray-300">{item.unit}</td>
                    <td className="px-2 py-1.5 text-right border border-gray-300">
                      {formatCurrency(item.netPrice, invoiceData.currency)}
                    </td>
                    <td className="px-2 py-1.5 text-right border border-gray-300">
                      {formatCurrency(netAmount, invoiceData.currency)}
                    </td>
                    <td className="px-2 py-1.5 text-center border border-gray-300">{vatDisplay}</td>
                    <td className="px-2 py-1.5 text-right border border-gray-300">
                      {formatCurrency(vatAmount, invoiceData.currency)}
                    </td>
                      <td className="px-2 py-1.5 text-right border border-gray-300">
                        {formatCurrency(grossAmount, invoiceData.currency)}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>

            {/* VAT Summary */}
            <div className="mb-5">
              <table className="ml-auto w-3/5 text-xs">
                <thead>
                  <tr className="bg-gray-100">
                    <th className="px-2 py-1.5 text-left border border-gray-300">Stawka VAT</th>
                    <th className="px-2 py-1.5 text-right border border-gray-300">Wartość netto</th>
                    <th className="px-2 py-1.5 text-right border border-gray-300">Kwota VAT</th>
                    <th className="px-2 py-1.5 text-right border border-gray-300">Wartość brutto</th>
                  </tr>
                </thead>
                <tbody>
                  {calculations.vatBreakdown.map(item => {
                    const vatDisplay = getVatLabel(item.rate);
                    return (
                      <tr key={item.rate}>
                        <td className="px-2 py-1.5 border border-gray-300">{vatDisplay}</td>
                        <td className="px-2 py-1.5 text-right border border-gray-300">
                          {formatCurrency(item.net, invoiceData.currency)}
                        </td>
                        <td className="px-2 py-1.5 text-right border border-gray-300">
                          {formatCurrency(item.vat, invoiceData.currency)}
                        </td>
                        <td className="px-2 py-1.5 text-right border border-gray-300">
                          {formatCurrency(item.gross, invoiceData.currency)}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* Totals */}
            <div className="mb-5">
              <table className="ml-auto w-3/5 text-xs">
                <tbody>
                  <tr>
                    <td className="px-2 py-1.5 text-right border border-gray-300">Razem netto:</td>
                    <td className="px-2 py-1.5 text-right border border-gray-300">
                      {formatCurrency(calculations.netTotal, invoiceData.currency)}
                    </td>
                  </tr>
                  <tr>
                    <td className="px-2 py-1.5 text-right border border-gray-300">Razem VAT:</td>
                    <td className="px-2 py-1.5 text-right border border-gray-300">
                      {formatCurrency(calculations.vatTotal, invoiceData.currency)}
                    </td>
                  </tr>
                  <tr className="bg-gray-100">
                    <td className="px-2 py-1.5 text-right border border-gray-300">Do zapłaty:</td>
                    <td className="px-2 py-1.5 text-right border border-gray-300">
                      {formatCurrency(calculations.grossTotal, invoiceData.currency)}
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>

            {shouldShowPlnBreakdown && plnTotals && (
              <div className="mb-5">
                <h3 className="mb-1 text-gray-700 text-sm font-medium uppercase tracking-wide">Przeliczenie pozycji na PLN</h3>
                <p className="mb-3 text-xs text-gray-500">
                  Kurs średni NBP (tabela A) z dnia {effectiveRateDate || selectedRateDate || '—'} wynosi{' '}
                  {conversionRate?.toFixed(4)} PLN.
                  {selectedRateDate &&
                    effectiveRateDate &&
                    selectedRateDate !== effectiveRateDate &&
                    ` (Wybrana data: ${selectedRateDate})`}
                </p>
                <table className="w-full mb-4 text-xs">
                  <thead>
                    <tr className="bg-gray-100">
                      <th className="px-2 py-1.5 text-left border border-gray-300">Lp.</th>
                      <th className="px-2 py-1.5 text-left border border-gray-300">Nazwa</th>
                      <th className="px-2 py-1.5 text-center border border-gray-300">Ilość</th>
                      <th className="px-2 py-1.5 text-center border border-gray-300">Jedn.</th>
                      <th className="px-2 py-1.5 text-right border border-gray-300">Cena netto (PLN)</th>
                      <th className="px-2 py-1.5 text-right border border-gray-300">Wartość netto (PLN)</th>
                      <th className="px-2 py-1.5 text-center border border-gray-300">VAT</th>
                      <th className="px-2 py-1.5 text-right border border-gray-300">Kwota VAT (PLN)</th>
                      <th className="px-2 py-1.5 text-right border border-gray-300">Wartość brutto (PLN)</th>
                    </tr>
                  </thead>
                  <tbody>
                    {plnItems.map(item => {
                      const vatDisplay = getVatLabel(item.vatRate);
                      return (
                        <tr key={item.index}>
                          <td className="px-2 py-1.5 border border-gray-300">{item.index + 1}</td>
                          <td className="px-2 py-1.5 border border-gray-300">{item.name || '___________'}</td>
                          <td className="px-2 py-1.5 text-center border border-gray-300">{item.quantity}</td>
                          <td className="px-2 py-1.5 text-center border border-gray-300">{item.unit}</td>
                          <td className="px-2 py-1.5 text-right border border-gray-300">
                            {formatCurrency(item.netUnitPln, 'PLN')}
                          </td>
                          <td className="px-2 py-1.5 text-right border border-gray-300">
                            {formatCurrency(item.netAmountPln, 'PLN')}
                          </td>
                          <td className="px-2 py-1.5 text-center border border-gray-300">{vatDisplay}</td>
                          <td className="px-2 py-1.5 text-right border border-gray-300">
                            {formatCurrency(item.vatAmountPln, 'PLN')}
                          </td>
                          <td className="px-2 py-1.5 text-right border border-gray-300">
                            {formatCurrency(item.grossAmountPln, 'PLN')}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
                <table className="ml-auto w-3/5 text-xs">
                  <tbody>
                    <tr>
                      <td className="px-2 py-1.5 text-right border border-gray-300">Razem netto (PLN):</td>
                      <td className="px-2 py-1.5 text-right border border-gray-300">
                        {formatCurrency(plnTotals.net, 'PLN')}
                      </td>
                    </tr>
                    <tr>
                      <td className="px-2 py-1.5 text-right border border-gray-300">Razem VAT (PLN):</td>
                      <td className="px-2 py-1.5 text-right border border-gray-300">
                        {formatCurrency(plnTotals.vat, 'PLN')}
                      </td>
                    </tr>
                    <tr className="bg-gray-100">
                      <td className="px-2 py-1.5 text-right border border-gray-300">Do zapłaty (PLN):</td>
                      <td className="px-2 py-1.5 text-right border border-gray-300">
                        {formatCurrency(plnTotals.gross, 'PLN')}
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>
            )}

            {/* Notes */}
            {invoiceData.notes && (
              <div className="mt-4 pt-3 border-t border-gray-300">
                <p className="text-xs text-gray-700">Uwagi:</p>
                <p className="text-xs mt-1">{invoiceData.notes}</p>
              </div>
            )}
          </div>
        </div>
      </ScrollArea>
    </div>
  );
}
