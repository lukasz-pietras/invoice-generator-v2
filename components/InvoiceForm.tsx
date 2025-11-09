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

export function InvoiceForm({ invoiceData, setInvoiceData }: InvoiceFormProps) {
  const [savedSellers, setSavedSellers] = useState<SavedCompany[]>([]);
  const [savedBuyers, setSavedBuyers] = useState<SavedCompany[]>([]);

  useEffect(() => {
    // Load saved companies from localStorage
    const sellers = localStorage.getItem('savedSellers');
    const buyers = localStorage.getItem('savedBuyers');
    if (sellers) setSavedSellers(JSON.parse(sellers));
    if (buyers) setSavedBuyers(JSON.parse(buyers));
  }, []);

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
                  onValueChange={(value) => setInvoiceData(prev => ({ ...prev, currency: value }))}
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
            <div className="grid grid-cols-3 gap-4">
              <div>
                <Label htmlFor="issueDate">Data wystawienia *</Label>
                <Input
                  id="issueDate"
                  type="date"
                  value={invoiceData.issueDate}
                  onChange={(e) => setInvoiceData(prev => ({ ...prev, issueDate: e.target.value }))}
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
                          <SelectItem value="-1">zw.</SelectItem>
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
              placeholder="Dodatkowe uwagi do faktury (opcjonalne)"
              rows={3}
            />
          </Card>
        </div>
      </ScrollArea>
    </div>
  );
}
