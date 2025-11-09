import { useState } from 'react';
import { InvoiceForm } from './components/InvoiceForm';
import { InvoicePDFPreview } from './components/InvoicePDFPreview';
import { InvoiceData, InvoiceItem } from './types/invoice';
import { Toaster } from './components/ui/sonner';

export default function App() {
  const [invoiceData, setInvoiceData] = useState<InvoiceData>({
    invoiceNumber: '',
    issueDate: new Date().toISOString().split('T')[0],
    saleDate: new Date().toISOString().split('T')[0],
    paymentDeadline: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
    paymentMethod: 'Przelew',
    currency: 'PLN',
    seller: {
      name: '',
      address: '',
      postalCode: '',
      city: '',
      nip: '',
      bankAccount: '',
    },
    buyer: {
      name: '',
      address: '',
      postalCode: '',
      city: '',
      nip: '',
    },
    items: [
      {
        id: '1',
        name: '',
        quantity: 1,
        unit: 'szt.',
        netPrice: 0,
        vatRate: 23,
      },
    ],
    notes: '',
    logo: null,
  });

  return (
    <>
      <div className="flex h-screen bg-gray-50">
        <InvoiceForm 
          invoiceData={invoiceData} 
          setInvoiceData={setInvoiceData} 
        />
        <InvoicePDFPreview invoiceData={invoiceData} />
      </div>
      <Toaster />
    </>
  );
}
