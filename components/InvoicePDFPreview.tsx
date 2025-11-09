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
    // Create a simple HTML version for printing/PDF
    const printWindow = window.open('', '_blank');
    if (!printWindow) return;

    const htmlContent = document.getElementById('invoice-preview')?.innerHTML || '';
    
    printWindow.document.write(`
      <!DOCTYPE html>
      <html>
        <head>
          <title>Faktura ${invoiceData.invoiceNumber}</title>
          <style>
            body { 
              font-family: Arial, sans-serif; 
              padding: 40px;
              color: #000;
              background: white;
            }
            table { 
              width: 100%; 
              border-collapse: collapse; 
              margin: 20px 0;
            }
            th, td { 
              border: 1px solid #333; 
              padding: 8px; 
              text-align: left;
            }
            th { 
              background-color: #f5f5f5;
            }
            .header { 
              margin-bottom: 30px; 
            }
            .section { 
              margin: 20px 0; 
            }
            .company-info {
              display: inline-block;
              width: 45%;
              vertical-align: top;
              margin: 10px 2%;
            }
            .summary {
              margin-top: 20px;
              text-align: right;
            }
            .logo {
              text-align: center;
              margin-bottom: 20px;
            }
            .logo img {
              max-height: 80px;
            }
            @media print {
              body { padding: 20px; }
            }
          </style>
        </head>
        <body>
          ${htmlContent}
        </body>
      </html>
    `);
    
    printWindow.document.close();
    setTimeout(() => {
      printWindow.print();
    }, 250);
  };

  return (
    <div className="w-1/2 bg-gray-100 flex flex-col">
      <div className="p-6 bg-white border-b border-gray-200 flex items-center justify-between">
        <div>
          <h2>Podgląd faktury</h2>
          <p className="text-gray-600">Użyj Ctrl+P lub przycisku poniżej, aby zapisać jako PDF</p>
        </div>
        <Button onClick={handleDownload}>
          <Download className="mr-2 h-4 w-4" />
          Drukuj / Zapisz PDF
        </Button>
      </div>

      <ScrollArea className="flex-1">
        <div className="p-8 flex justify-center">
          <div
            id="invoice-preview"
            className="bg-white shadow-lg p-12 max-w-4xl w-full"
            style={{ minHeight: '297mm' }}
          >
            {/* Logo */}
            {invoiceData.logo && (
              <div className="flex justify-center mb-8">
                <img src={invoiceData.logo} alt="Logo" className="max-h-20 object-contain" />
              </div>
            )}

            {/* Header */}
            <div className="mb-8">
              <h1 className="mb-2">FAKTURA VAT</h1>
              <div className="text-gray-700">
                <p>Nr: {invoiceData.invoiceNumber || '___________'}</p>
              </div>
            </div>

            {/* Dates and Payment */}
            <div className="grid grid-cols-3 gap-4 mb-8 text-sm">
              <div>
                <p className="text-gray-600">Data wystawienia:</p>
                <p>{formatDate(invoiceData.issueDate)}</p>
              </div>
              <div>
                <p className="text-gray-600">Data sprzedaży:</p>
                <p>{formatDate(invoiceData.saleDate)}</p>
              </div>
              <div>
                <p className="text-gray-600">Termin płatności:</p>
                <p>{formatDate(invoiceData.paymentDeadline)}</p>
              </div>
            </div>

            {/* Seller and Buyer */}
            <div className="grid grid-cols-2 gap-8 mb-8">
              <div>
                <h3 className="mb-3 text-gray-700">Sprzedawca:</h3>
                <div className="space-y-1 text-sm">
                  <p>{invoiceData.seller.name || '___________'}</p>
                  <p>{invoiceData.seller.address || '___________'}</p>
                  <p>{invoiceData.seller.postalCode} {invoiceData.seller.city}</p>
                  <p>NIP: {invoiceData.seller.nip || '___________'}</p>
                  {invoiceData.seller.bankAccount && (
                    <p className="mt-2">Nr konta: {invoiceData.seller.bankAccount}</p>
                  )}
                </div>
              </div>
              <div>
                <h3 className="mb-3 text-gray-700">Nabywca:</h3>
                <div className="space-y-1 text-sm">
                  <p>{invoiceData.buyer.name || '___________'}</p>
                  <p>{invoiceData.buyer.address || '___________'}</p>
                  <p>{invoiceData.buyer.postalCode} {invoiceData.buyer.city}</p>
                  <p>NIP: {invoiceData.buyer.nip || '___________'}</p>
                </div>
              </div>
            </div>

            {/* Items Table */}
            <table className="w-full mb-6 text-sm">
              <thead>
                <tr className="bg-gray-100">
                  <th className="p-2 text-left border border-gray-300">Lp.</th>
                  <th className="p-2 text-left border border-gray-300">Nazwa</th>
                  <th className="p-2 text-center border border-gray-300">Ilość</th>
                  <th className="p-2 text-center border border-gray-300">Jedn.</th>
                  <th className="p-2 text-right border border-gray-300">Cena netto</th>
                  <th className="p-2 text-right border border-gray-300">Wartość netto</th>
                  <th className="p-2 text-center border border-gray-300">VAT</th>
                  <th className="p-2 text-right border border-gray-300">Kwota VAT</th>
                  <th className="p-2 text-right border border-gray-300">Wartość brutto</th>
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
                      <td className="p-2 border border-gray-300">{index + 1}</td>
                      <td className="p-2 border border-gray-300">{item.name || '___________'}</td>
                      <td className="p-2 text-center border border-gray-300">{item.quantity}</td>
                      <td className="p-2 text-center border border-gray-300">{item.unit}</td>
                    <td className="p-2 text-right border border-gray-300">
                      {formatCurrency(item.netPrice, invoiceData.currency)}
                    </td>
                    <td className="p-2 text-right border border-gray-300">
                      {formatCurrency(netAmount, invoiceData.currency)}
                    </td>
                    <td className="p-2 text-center border border-gray-300">{vatDisplay}</td>
                    <td className="p-2 text-right border border-gray-300">
                      {formatCurrency(vatAmount, invoiceData.currency)}
                    </td>
                      <td className="p-2 text-right border border-gray-300">
                        {formatCurrency(grossAmount, invoiceData.currency)}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>

            {/* VAT Summary */}
            <div className="mb-6">
              <table className="ml-auto w-2/3 text-sm">
                <thead>
                  <tr className="bg-gray-100">
                    <th className="p-2 text-left border border-gray-300">Stawka VAT</th>
                    <th className="p-2 text-right border border-gray-300">Wartość netto</th>
                    <th className="p-2 text-right border border-gray-300">Kwota VAT</th>
                    <th className="p-2 text-right border border-gray-300">Wartość brutto</th>
                  </tr>
                </thead>
                <tbody>
                  {calculations.vatBreakdown.map(item => {
                    const vatDisplay = getVatLabel(item.rate);
                    return (
                      <tr key={item.rate}>
                        <td className="p-2 border border-gray-300">{vatDisplay}</td>
                        <td className="p-2 text-right border border-gray-300">
                          {formatCurrency(item.net, invoiceData.currency)}
                        </td>
                        <td className="p-2 text-right border border-gray-300">
                          {formatCurrency(item.vat, invoiceData.currency)}
                        </td>
                        <td className="p-2 text-right border border-gray-300">
                          {formatCurrency(item.gross, invoiceData.currency)}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* Totals */}
            <div className="mb-8">
              <table className="ml-auto w-2/3 text-sm">
                <tbody>
                  <tr>
                    <td className="p-2 text-right border border-gray-300">Razem netto:</td>
                    <td className="p-2 text-right border border-gray-300">
                      {formatCurrency(calculations.netTotal, invoiceData.currency)}
                    </td>
                  </tr>
                  <tr>
                    <td className="p-2 text-right border border-gray-300">Razem VAT:</td>
                    <td className="p-2 text-right border border-gray-300">
                      {formatCurrency(calculations.vatTotal, invoiceData.currency)}
                    </td>
                  </tr>
                  <tr className="bg-gray-100">
                    <td className="p-2 text-right border border-gray-300">Do zapłaty:</td>
                    <td className="p-2 text-right border border-gray-300">
                      {formatCurrency(calculations.grossTotal, invoiceData.currency)}
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>

            {shouldShowPlnBreakdown && plnTotals && (
              <div className="mb-8">
                <h3 className="mb-2 text-gray-700">Przeliczenie pozycji na PLN</h3>
                <p className="mb-3 text-xs text-gray-500">
                  Kurs średni NBP (tabela A) z dnia {effectiveRateDate || selectedRateDate || '—'} wynosi{' '}
                  {conversionRate?.toFixed(4)} PLN.
                  {selectedRateDate &&
                    effectiveRateDate &&
                    selectedRateDate !== effectiveRateDate &&
                    ` (Wybrana data: ${selectedRateDate})`}
                </p>
                <table className="w-full mb-4 text-sm">
                  <thead>
                    <tr className="bg-gray-100">
                      <th className="p-2 text-left border border-gray-300">Lp.</th>
                      <th className="p-2 text-left border border-gray-300">Nazwa</th>
                      <th className="p-2 text-center border border-gray-300">Ilość</th>
                      <th className="p-2 text-center border border-gray-300">Jedn.</th>
                      <th className="p-2 text-right border border-gray-300">Cena netto (PLN)</th>
                      <th className="p-2 text-right border border-gray-300">Wartość netto (PLN)</th>
                      <th className="p-2 text-center border border-gray-300">VAT</th>
                      <th className="p-2 text-right border border-gray-300">Kwota VAT (PLN)</th>
                      <th className="p-2 text-right border border-gray-300">Wartość brutto (PLN)</th>
                    </tr>
                  </thead>
                  <tbody>
                    {plnItems.map(item => {
                      const vatDisplay = getVatLabel(item.vatRate);
                      return (
                        <tr key={item.index}>
                          <td className="p-2 border border-gray-300">{item.index + 1}</td>
                          <td className="p-2 border border-gray-300">{item.name || '___________'}</td>
                          <td className="p-2 text-center border border-gray-300">{item.quantity}</td>
                          <td className="p-2 text-center border border-gray-300">{item.unit}</td>
                          <td className="p-2 text-right border border-gray-300">
                            {formatCurrency(item.netUnitPln, 'PLN')}
                          </td>
                          <td className="p-2 text-right border border-gray-300">
                            {formatCurrency(item.netAmountPln, 'PLN')}
                          </td>
                          <td className="p-2 text-center border border-gray-300">{vatDisplay}</td>
                          <td className="p-2 text-right border border-gray-300">
                            {formatCurrency(item.vatAmountPln, 'PLN')}
                          </td>
                          <td className="p-2 text-right border border-gray-300">
                            {formatCurrency(item.grossAmountPln, 'PLN')}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
                <table className="ml-auto w-2/3 text-sm">
                  <tbody>
                    <tr>
                      <td className="p-2 text-right border border-gray-300">Razem netto (PLN):</td>
                      <td className="p-2 text-right border border-gray-300">
                        {formatCurrency(plnTotals.net, 'PLN')}
                      </td>
                    </tr>
                    <tr>
                      <td className="p-2 text-right border border-gray-300">Razem VAT (PLN):</td>
                      <td className="p-2 text-right border border-gray-300">
                        {formatCurrency(plnTotals.vat, 'PLN')}
                      </td>
                    </tr>
                    <tr className="bg-gray-100">
                      <td className="p-2 text-right border border-gray-300">Do zapłaty (PLN):</td>
                      <td className="p-2 text-right border border-gray-300">
                        {formatCurrency(plnTotals.gross, 'PLN')}
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>
            )}

            {/* Payment Info */}
            <div className="mb-6 text-sm">
              <p className="text-gray-700">Sposób płatności: {invoiceData.paymentMethod}</p>
              {invoiceData.seller.bankAccount && (
                <p className="text-gray-700">Numer konta: {invoiceData.seller.bankAccount}</p>
              )}
            </div>

            {/* Notes */}
            {invoiceData.notes && (
              <div className="mt-6 pt-4 border-t border-gray-300">
                <p className="text-sm text-gray-700">Uwagi:</p>
                <p className="text-sm mt-1">{invoiceData.notes}</p>
              </div>
            )}
          </div>
        </div>
      </ScrollArea>
    </div>
  );
}
