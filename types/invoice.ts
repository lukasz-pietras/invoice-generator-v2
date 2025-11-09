export interface CompanyInfo {
  name: string;
  address: string;
  postalCode: string;
  city: string;
  nip: string;
  bankAccount?: string;
}

export interface InvoiceItem {
  id: string;
  name: string;
  quantity: number;
  unit: string;
  netPrice: number;
  vatRate: number;
}

export interface InvoiceData {
  invoiceNumber: string;
  issueDate: string;
  saleDate: string;
  paymentDeadline: string;
  paymentMethod: string;
  currency: string;
  seller: CompanyInfo;
  buyer: CompanyInfo;
  items: InvoiceItem[];
  notes: string;
  logo: string | null;
}

export interface InvoiceCalculations {
  netTotal: number;
  vatTotal: number;
  grossTotal: number;
  vatBreakdown: { rate: number; net: number; vat: number; gross: number }[];
}
