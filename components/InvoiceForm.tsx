import { Dispatch, SetStateAction, useState, useEffect } from 'react';
import { InvoiceData, CompanyInfo } from '../types/invoice';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { Button } from './ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select';
import { Textarea } from './ui/textarea';
import { ScrollArea } from './ui/scroll-area';
import { Separator } from './ui/separator';
import { Plus, Trash2, Upload, Download, Save } from 'lucide-react';
import { Card } from './ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from './ui/tabs';
import { CompanyForm } from './CompanyForm';
import { toast } from 'sonner@2.0.3';

interface InvoiceFormProps {
  invoiceData: InvoiceData;
  setInvoiceData: Dispatch<SetStateAction<InvoiceData>>;
}

interface SavedCompany {
  name: string;
  data: CompanyInfo;
}

const NOTE_PRESETS = [
  'Zwolnienie z VAT na podstawie art. 113 ust. 1 ustawy o VAT.',
  'Usługa nie podlega opodatkowaniu VAT w Polsce — miejsce świadczenia poza terytorium UE (art. 28b ustawy o VAT).',
];

const MAX_RATE_LOOKBACK_DAYS = 10;

function parseISODate(dateString?: string): Date | null {
  if (!dateString) return null;
  const parts = dateString.split('-').map(Number);
  if (parts.length !== 3) return null;
  const [year, month, day] = parts;
  if (
    Number.isNaN(year) ||
    Number.isNaN(month) ||
    Number.isNaN(day)
  ) {
    return null;
  }
  return new Date(Date.UTC(year, month - 1, day));
}

function toDateString(date: Date): string {
  return date.toISOString().split('T')[0];
}

function getPreviousBusinessDay(referenceDate?: string): string {
  const base = parseISODate(referenceDate);
  const today = new Date();
  const source = base ?? new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate()));
  const date = new Date(Date.UTC(source.getUTCFullYear(), source.getUTCMonth(), source.getUTCDate()));
  date.setUTCDate(date.getUTCDate() - 1);

  while (date.getUTCDay() === 0 || date.getUTCDay() === 6) {
    date.setUTCDate(date.getUTCDate() - 1);
  }

  return toDateString(date);
}

function shiftDateString(dateString: string, offset: number): string {
  const [year, month, day] = dateString.split('-').map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  date.setUTCDate(date.getUTCDate() + offset);
  return toDateString(date);
}

export function InvoiceForm({ invoiceData, setInvoiceData }: InvoiceFormProps) {
  const [savedSellers, setSavedSellers] = useState<SavedCompany[]>([]);
  const [savedBuyers, setSavedBuyers] = useState<SavedCompany[]>([]);
  const [rateFetchTrigger, setRateFetchTrigger] = useState(0);
  const [rateStatus, setRateStatus] = useState<{ loading: boolean; error: string | null }>({
    loading: false,
    error: null,
  });
  const normalizedCurrency = (invoiceData.currency || '').trim().toUpperCase();
  const isForeignCurrency = normalizedCurrency !== '' && normalizedCurrency !== 'PLN';
  const maxRateDate = getPreviousBusinessDay(invoiceData.issueDate);

  const handleCurrencyChange = (value: string) => {
    const normalizedValue = value.trim().toUpperCase();
    setInvoiceData(prev => {
      const defaultTargetDate = getPreviousBusinessDay(prev.issueDate);
      if (normalizedValue === 'PLN') {
        return {
          ...prev,
          currency: normalizedValue,
          exchangeRate: {
            targetDate: '',
            effectiveDate: '',
            value: null,
          },
        };
      }

      return {
        ...prev,
        currency: normalizedValue,
        exchangeRate: {
          targetDate: prev.exchangeRate.targetDate || defaultTargetDate,
          effectiveDate: '',
          value: null,
        },
      };
    });
    setRateStatus({ loading: false, error: null });
  };

  const handleRateDateChange = (value: string) => {
    const sanitized = value ? (value > maxRateDate ? maxRateDate : value) : '';
    setInvoiceData(prev => ({
      ...prev,
      exchangeRate: {
        ...prev.exchangeRate,
        targetDate: sanitized,
        effectiveDate: '',
        value: null,
      },
    }));
    setRateStatus(current => ({ ...current, error: null }));
  };

  const handleUsePreviousBusinessDay = () => {
    const previousDay = getPreviousBusinessDay(invoiceData.issueDate);
    setInvoiceData(prev => ({
      ...prev,
      exchangeRate: {
        ...prev.exchangeRate,
        targetDate: previousDay,
        effectiveDate: '',
        value: null,
      },
    }));
    setRateStatus(current => ({ ...current, error: null }));
    setRateFetchTrigger(prev => prev + 1);
  };

  const handleRefreshRate = () => {
    setRateStatus(current => ({ ...current, error: null }));
    if (!invoiceData.exchangeRate.targetDate) {
      const previousDay = getPreviousBusinessDay(invoiceData.issueDate);
      setInvoiceData(prev => ({
        ...prev,
        exchangeRate: {
          ...prev.exchangeRate,
          targetDate: previousDay,
          effectiveDate: '',
          value: null,
        },
      }));
      setRateFetchTrigger(prev => prev + 1);
      return;
    }
    setRateFetchTrigger(prev => prev + 1);
  };

  const handleIssueDateChange = (value: string) => {
    let shouldRefetch = false;
    setInvoiceData(prev => {
      const nextState = { ...prev, issueDate: value };
      const prevCurrency = (prev.currency || '').trim().toUpperCase();
      if (prevCurrency && prevCurrency !== 'PLN') {
        const newDefault = getPreviousBusinessDay(value);
        const previousDefault = getPreviousBusinessDay(prev.issueDate);
        const targetWasDefault =
          !prev.exchangeRate.targetDate || prev.exchangeRate.targetDate === previousDefault;
        if (targetWasDefault) {
          if (prev.exchangeRate.targetDate !== newDefault) {
            shouldRefetch = true;
            nextState.exchangeRate = {
              ...prev.exchangeRate,
              targetDate: newDefault,
              effectiveDate: '',
              value: null,
            };
          }
        }
      }
      return nextState;
    });
    if (shouldRefetch) {
      setRateStatus(current => ({ ...current, error: null }));
      setRateFetchTrigger(prev => prev + 1);
    }
  };

  useEffect(() => {
    // Load saved companies from localStorage
    const sellers = localStorage.getItem('savedSellers');
    const buyers = localStorage.getItem('savedBuyers');
    if (sellers) setSavedSellers(JSON.parse(sellers));
    if (buyers) setSavedBuyers(JSON.parse(buyers));
  }, []);

  useEffect(() => {
    if (!isForeignCurrency) {
      if (
        invoiceData.exchangeRate.targetDate ||
        invoiceData.exchangeRate.effectiveDate ||
        invoiceData.exchangeRate.value !== null
      ) {
        setInvoiceData(prev => ({
          ...prev,
          exchangeRate: {
            targetDate: '',
            effectiveDate: '',
            value: null,
          },
        }));
      }
      setRateStatus({ loading: false, error: null });
      return;
    }

    if (!invoiceData.exchangeRate.targetDate) {
      const defaultDate = getPreviousBusinessDay(invoiceData.issueDate);
      setInvoiceData(prev => ({
        ...prev,
        exchangeRate: {
          ...prev.exchangeRate,
          targetDate: defaultDate,
        },
      }));
    }
  }, [isForeignCurrency, invoiceData.exchangeRate.targetDate, invoiceData.issueDate]);

  useEffect(() => {
    if (!isForeignCurrency) {
      return;
    }

    const targetDate = invoiceData.exchangeRate.targetDate;
    if (!targetDate) {
      return;
    }

    let isCancelled = false;
    const controller = new AbortController();

    const fetchRate = async () => {
      setRateStatus({ loading: true, error: null });
      let lookupDate = targetDate;
      let attempts = 0;
      let fetched = false;

      while (!isCancelled && attempts < MAX_RATE_LOOKBACK_DAYS) {
        try {
          const response = await fetch(
            `https://api.nbp.pl/api/exchangerates/rates/A/${normalizedCurrency}/${lookupDate}/?format=json`,
            {
              signal: controller.signal,
              headers: {
                Accept: 'application/json',
              },
            }
          );

          if (response.status === 404) {
            lookupDate = shiftDateString(lookupDate, -1);
            attempts += 1;
            continue;
          }

          if (!response.ok) {
            throw new Error('Nie udało się pobrać kursu NBP.');
          }

          const data = await response.json();
          const rate = data?.rates?.[0];
          if (!rate || typeof rate.mid !== 'number') {
            throw new Error('Brak danych kursu NBP dla wybranej daty.');
          }

          if (isCancelled) {
            return;
          }

          setInvoiceData(prev => ({
            ...prev,
            exchangeRate: {
              targetDate,
              effectiveDate: rate.effectiveDate,
              value: rate.mid,
            },
          }));
          setRateStatus({ loading: false, error: null });
          fetched = true;
          break;
        } catch (error: any) {
          if (isCancelled || controller.signal.aborted) {
            return;
          }
          if (error.name === 'AbortError') {
            return;
          }
          setRateStatus({
            loading: false,
            error: error?.message || 'Błąd podczas pobierania kursu NBP.',
          });
          setInvoiceData(prev => ({
            ...prev,
            exchangeRate: {
              targetDate,
              effectiveDate: '',
              value: null,
            },
          }));
          toast.error(error?.message || 'Nie udało się pobrać kursu NBP.');
          return;
        }
      }

      if (!isCancelled && !fetched) {
        const message = 'Brak kursu NBP dla wybranej daty w ostatnich dniach roboczych.';
        setRateStatus({ loading: false, error: message });
        setInvoiceData(prev => ({
          ...prev,
          exchangeRate: {
            targetDate,
            effectiveDate: '',
            value: null,
          },
        }));
        toast.error(message);
      }
    };

    fetchRate();

    return () => {
      isCancelled = true;
      controller.abort();
    };
  }, [isForeignCurrency, invoiceData.exchangeRate.targetDate, rateFetchTrigger]);

  const handleLogoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setInvoiceData(prev => ({ ...prev, logo: reader.result as string }));
      };
      reader.readAsDataURL(file);
    }
  };

  const addItem = () => {
    const newId = (Math.max(...invoiceData.items.map(i => parseInt(i.id) || 0), 0) + 1).toString();
    setInvoiceData(prev => ({
      ...prev,
      items: [...prev.items, { id: newId, name: '', quantity: 1, unit: 'szt.', netPrice: 0, vatRate: 23 }],
    }));
  };

  const removeItem = (id: string) => {
    if (invoiceData.items.length > 1) {
      setInvoiceData(prev => ({
        ...prev,
        items: prev.items.filter(item => item.id !== id),
      }));
    }
  };

  const updateItem = (id: string, field: string, value: any) => {
    setInvoiceData(prev => ({
      ...prev,
      items: prev.items.map(item =>
        item.id === id ? { ...item, [field]: value } : item
      ),
    }));
  };

  const appendNote = (note: string) => {
    setInvoiceData(prev => {
      const current = prev.notes || '';
      if (current.includes(note)) {
        return prev;
      }
      const separator = current.trim().length > 0 ? '\n' : '';
      return {
        ...prev,
        notes: `${current}${separator}${note}`,
      };
    });
  };

  const saveToCache = (data: CompanyInfo, type: 'seller' | 'buyer') => {
    if (!data.name) {
      toast.error('Podaj nazwę firmy, aby zapisać dane');
      return;
    }

    const saved: SavedCompany = { name: data.name, data };
    const storageKey = type === 'seller' ? 'savedSellers' : 'savedBuyers';
    const currentSaved = type === 'seller' ? savedSellers : savedBuyers;
    
    // Check if company already exists
    const existingIndex = currentSaved.findIndex(c => c.name === data.name);
    let updatedSaved;
    
    if (existingIndex >= 0) {
      // Update existing
      updatedSaved = [...currentSaved];
      updatedSaved[existingIndex] = saved;
      toast.success(`Dane zaktualizowane: ${data.name}`);
    } else {
      // Add new
      updatedSaved = [...currentSaved, saved];
      toast.success(`Dane zapisane: ${data.name}`);
    }
    
    localStorage.setItem(storageKey, JSON.stringify(updatedSaved));
    if (type === 'seller') {
      setSavedSellers(updatedSaved);
    } else {
      setSavedBuyers(updatedSaved);
    }
  };

  const loadFromCache = (companyName: string, type: 'seller' | 'buyer') => {
    const saved = type === 'seller' ? savedSellers : savedBuyers;
    const company = saved.find(c => c.name === companyName);
    
    if (company) {
      if (type === 'seller') {
        setInvoiceData(prev => ({ ...prev, seller: company.data }));
      } else {
        setInvoiceData(prev => ({ ...prev, buyer: company.data }));
      }
      toast.success(`Wczytano: ${companyName}`);
    }
  };

  const downloadCompanyData = (data: CompanyInfo, type: 'seller' | 'buyer') => {
    const fileName = type === 'seller' ? 'sprzedawca.json' : 'nabywca.json';
    const jsonString = JSON.stringify(data, null, 2);
    const blob = new Blob([jsonString], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = fileName;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    toast.success(`Dane ${type === 'seller' ? 'sprzedawcy' : 'nabywcy'} pobrane`);
  };

  const importCompanyData = (type: 'seller' | 'buyer') => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'application/json';
    input.onchange = (e: Event) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (file) {
        const reader = new FileReader();
        reader.onload = (event) => {
          try {
            const data = JSON.parse(event.target?.result as string) as CompanyInfo;
            if (type === 'seller') {
              setInvoiceData(prev => ({ ...prev, seller: data }));
            } else {
              setInvoiceData(prev => ({ ...prev, buyer: data }));
            }
            toast.success(`Dane ${type === 'seller' ? 'sprzedawcy' : 'nabywcy'} zaimportowane`);
          } catch (error) {
            toast.error('Błąd podczas importu danych. Sprawdź format pliku JSON.');
          }
        };
        reader.readAsText(file);
      }
    };
    input.click();
  };

  return (
    <div className="w-1/2 border-r border-gray-200 bg-white">
      <ScrollArea className="h-full">
        <div className="p-8 space-y-8">
          <div>
            <h1 className="mb-2">Generator Faktur</h1>
            <p className="text-gray-600">Wypełnij wszystkie pola, aby wygenerować fakturę zgodną z polskimi przepisami</p>
          </div>

          {/* Logo Upload */}
          <Card className="p-4">
            <Label>Logo</Label>
            <div className="mt-2">
              <Button
                variant="outline"
                onClick={() => document.getElementById('logo-upload')?.click()}
                className="w-full"
              >
                <Upload className="mr-2 h-4 w-4" />
                {invoiceData.logo ? 'Zmień logo' : 'Dodaj logo'}
              </Button>
              <input
                id="logo-upload"
                type="file"
                accept="image/*"
                onChange={handleLogoUpload}
                className="hidden"
              />
              {invoiceData.logo && (
                <div className="mt-2 flex justify-center">
                  <img src={invoiceData.logo} alt="Logo" className="max-h-20 object-contain" />
                </div>
              )}
            </div>
          </Card>

          {/* Invoice Details */}
          <Card className="p-4 space-y-4">
            <h2>Dane faktury</h2>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="invoiceNumber">Numer faktury *</Label>
                <Input
                  id="invoiceNumber"
                  value={invoiceData.invoiceNumber}
                  onChange={(e) => setInvoiceData(prev => ({ ...prev, invoiceNumber: e.target.value }))}
                  placeholder="FV/2024/11/001"
                />
              </div>
              <div>
                <Label htmlFor="currency">Waluta</Label>
                <Select
                  value={invoiceData.currency}
                  onValueChange={handleCurrencyChange}
                >
                  <SelectTrigger id="currency">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="PLN">PLN (zł)</SelectItem>
                    <SelectItem value="EUR">EUR (€)</SelectItem>
                    <SelectItem value="USD">USD ($)</SelectItem>
                    <SelectItem value="GBP">GBP (£)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            {isForeignCurrency && (
              <div className="rounded-lg border border-indigo-100 bg-indigo-50/60 p-4 text-sm space-y-3">
                <div className="grid gap-3 md:grid-cols-[minmax(0,1fr)_auto] md:items-end">
                  <div>
                    <Label htmlFor="exchangeRateDate">Data kursu NBP</Label>
                    <Input
                      id="exchangeRateDate"
                      type="date"
                      max={maxRateDate}
                      min="2002-01-02"
                      value={invoiceData.exchangeRate.targetDate}
                      onChange={(e) => handleRateDateChange(e.target.value)}
                    />
                    <p className="mt-1 text-xs text-gray-500">
                      Domyślnie pobieramy kurs średni z poprzedniego dnia roboczego.
                    </p>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={handleUsePreviousBusinessDay}
                      disabled={rateStatus.loading}
                    >
                      Poprzedni dzień roboczy
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={handleRefreshRate}
                      disabled={rateStatus.loading}
                    >
                      Odśwież kurs
                    </Button>
                  </div>
                </div>
                <div className="text-sm">
                  {rateStatus.loading && <span className="text-gray-600">Pobieranie kursu z NBP...</span>}
                  {!rateStatus.loading && invoiceData.exchangeRate.value !== null && invoiceData.exchangeRate.effectiveDate && (
                    <span className="text-gray-700">
                      Kurs średni NBP (tabela A) z dnia {invoiceData.exchangeRate.effectiveDate}:{' '}
                      <strong>{invoiceData.exchangeRate.value.toFixed(4)} PLN</strong>
                    </span>
                  )}
                  {!rateStatus.loading && invoiceData.exchangeRate.value === null && !rateStatus.error && (
                    <span className="text-gray-600">Wybierz datę, aby pobrać kurs średni z NBP.</span>
                  )}
                </div>
                {rateStatus.error && (
                  <p className="text-sm text-red-600">{rateStatus.error}</p>
                )}
                {!rateStatus.loading &&
                  invoiceData.exchangeRate.targetDate &&
                  invoiceData.exchangeRate.effectiveDate &&
                  invoiceData.exchangeRate.targetDate !== invoiceData.exchangeRate.effectiveDate && (
                    <p className="text-xs text-gray-500">
                      Wybrana data nie była dniem publikacji NBP. Zastosowano kurs z dnia{' '}
                      {invoiceData.exchangeRate.effectiveDate}.
                    </p>
                  )}
              </div>
            )}
            <div className="grid grid-cols-3 gap-4">
              <div>
                <Label htmlFor="issueDate">Data wystawienia *</Label>
                <Input
                  id="issueDate"
                  type="date"
                  value={invoiceData.issueDate}
                  onChange={(e) => handleIssueDateChange(e.target.value)}
                />
              </div>
              <div>
                <Label htmlFor="saleDate">Data sprzedaży *</Label>
                <Input
                  id="saleDate"
                  type="date"
                  value={invoiceData.saleDate}
                  onChange={(e) => setInvoiceData(prev => ({ ...prev, saleDate: e.target.value }))}
                />
              </div>
              <div>
                <Label htmlFor="paymentDeadline">Termin płatności *</Label>
                <Input
                  id="paymentDeadline"
                  type="date"
                  value={invoiceData.paymentDeadline}
                  onChange={(e) => setInvoiceData(prev => ({ ...prev, paymentDeadline: e.target.value }))}
                />
              </div>
            </div>
            <div>
              <Label htmlFor="paymentMethod">Sposób płatności</Label>
              <Select
                value={invoiceData.paymentMethod}
                onValueChange={(value) => setInvoiceData(prev => ({ ...prev, paymentMethod: value }))}
              >
                <SelectTrigger id="paymentMethod">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Przelew">Przelew</SelectItem>
                  <SelectItem value="Gotówka">Gotówka</SelectItem>
                  <SelectItem value="Karta">Karta</SelectItem>
                  <SelectItem value="Blik">Blik</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </Card>

          {/* Company Info - Seller and Buyer */}
          <Card className="p-4">
            <h2 className="mb-4">Dane firm</h2>
            <Tabs defaultValue="seller" className="w-full">
              <TabsList className="grid w-full grid-cols-2">
                <TabsTrigger value="seller">Sprzedawca</TabsTrigger>
                <TabsTrigger value="buyer">Nabywca</TabsTrigger>
              </TabsList>
              
              <TabsContent value="seller" className="space-y-4">
                <div className="flex gap-2 flex-wrap">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => saveToCache(invoiceData.seller, 'seller')}
                  >
                    <Save className="mr-2 h-4 w-4" />
                    Zapisz
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => importCompanyData('seller')}
                  >
                    <Upload className="mr-2 h-4 w-4" />
                    Import
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => downloadCompanyData(invoiceData.seller, 'seller')}
                  >
                    <Download className="mr-2 h-4 w-4" />
                    Pobierz
                  </Button>
                </div>
                
                {savedSellers.length > 0 && (
                  <div>
                    <Label>Wczytaj zapisane dane</Label>
                    <Select onValueChange={(value) => loadFromCache(value, 'seller')}>
                      <SelectTrigger>
                        <SelectValue placeholder="Wybierz firmę..." />
                      </SelectTrigger>
                      <SelectContent>
                        {savedSellers.map((company) => (
                          <SelectItem key={company.name} value={company.name}>
                            {company.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                )}
                
                <CompanyForm
                  data={invoiceData.seller}
                  onChange={(data) => setInvoiceData(prev => ({ ...prev, seller: data }))}
                  type="seller"
                />
              </TabsContent>
              
              <TabsContent value="buyer" className="space-y-4">
                <div className="flex gap-2 flex-wrap">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => saveToCache(invoiceData.buyer, 'buyer')}
                  >
                    <Save className="mr-2 h-4 w-4" />
                    Zapisz
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => importCompanyData('buyer')}
                  >
                    <Upload className="mr-2 h-4 w-4" />
                    Import
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => downloadCompanyData(invoiceData.buyer, 'buyer')}
                  >
                    <Download className="mr-2 h-4 w-4" />
                    Pobierz
                  </Button>
                </div>
                
                {savedBuyers.length > 0 && (
                  <div>
                    <Label>Wczytaj zapisane dane</Label>
                    <Select onValueChange={(value) => loadFromCache(value, 'buyer')}>
                      <SelectTrigger>
                        <SelectValue placeholder="Wybierz firmę..." />
                      </SelectTrigger>
                      <SelectContent>
                        {savedBuyers.map((company) => (
                          <SelectItem key={company.name} value={company.name}>
                            {company.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                )}
                
                <CompanyForm
                  data={invoiceData.buyer}
                  onChange={(data) => setInvoiceData(prev => ({ ...prev, buyer: data }))}
                  type="buyer"
                />
              </TabsContent>
            </Tabs>
          </Card>

          {/* Items */}
          <Card className="p-4 space-y-4">
            <div className="flex items-center justify-between">
              <h2>Pozycje faktury</h2>
              <Button onClick={addItem} size="sm">
                <Plus className="mr-2 h-4 w-4" />
                Dodaj pozycję
              </Button>
            </div>
            <div className="space-y-4">
              {invoiceData.items.map((item, index) => (
                <div key={item.id} className="p-4 border rounded-lg space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-gray-600">Pozycja {index + 1}</span>
                    {invoiceData.items.length > 1 && (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => removeItem(item.id)}
                      >
                        <Trash2 className="h-4 w-4 text-red-500" />
                      </Button>
                    )}
                  </div>
                  <div>
                    <Label>Nazwa *</Label>
                    <Input
                      value={item.name}
                      onChange={(e) => updateItem(item.id, 'name', e.target.value)}
                      placeholder="Nazwa produktu/usługi"
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <Label>Ilość *</Label>
                      <Input
                        type="number"
                        value={item.quantity}
                        onChange={(e) => updateItem(item.id, 'quantity', parseFloat(e.target.value) || 0)}
                        min="0"
                        step="0.01"
                      />
                    </div>
                    <div>
                      <Label>Jednostka</Label>
                      <Select
                        value={item.unit}
                        onValueChange={(value) => updateItem(item.id, 'unit', value)}
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="szt.">szt.</SelectItem>
                          <SelectItem value="kg">kg</SelectItem>
                          <SelectItem value="m">m</SelectItem>
                          <SelectItem value="m²">m²</SelectItem>
                          <SelectItem value="m³">m³</SelectItem>
                          <SelectItem value="godz.">godz.</SelectItem>
                          <SelectItem value="usł.">usł.</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <Label>Cena netto *</Label>
                      <Input
                        type="number"
                        value={item.netPrice}
                        onChange={(e) => updateItem(item.id, 'netPrice', parseFloat(e.target.value) || 0)}
                        min="0"
                        step="0.01"
                      />
                    </div>
                    <div>
                      <Label>Stawka VAT (%)</Label>
                      <Select
                        value={item.vatRate.toString()}
                        onValueChange={(value) => updateItem(item.id, 'vatRate', parseFloat(value))}
                      >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="23">23%</SelectItem>
                        <SelectItem value="8">8%</SelectItem>
                        <SelectItem value="5">5%</SelectItem>
                        <SelectItem value="0">0%</SelectItem>
                        <SelectItem value="-1">ZW</SelectItem>
                        <SelectItem value="-2">NP</SelectItem>
                        <SelectItem value="-3">OO</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </Card>

          {/* Notes */}
          <Card className="p-4 space-y-4">
            <h2>Uwagi</h2>
            <Textarea
              value={invoiceData.notes}
              onChange={(e) => setInvoiceData(prev => ({ ...prev, notes: e.target.value }))}
              placeholder="Dodatkowe informacje dla nabywcy"
              rows={3}
            />
            <div className="flex flex-wrap gap-2">
              {NOTE_PRESETS.map((note) => (
                <Button
                  key={note}
                  type="button"
                  variant="outline"
                  size="sm"
                  className="text-left whitespace-normal"
                  onClick={() => appendNote(note)}
                >
                  {note}
                </Button>
              ))}
            </div>
          </Card>
        </div>
      </ScrollArea>
    </div>
  );
}
