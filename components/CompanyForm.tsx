import { CompanyInfo } from '../types/invoice';
import { Input } from './ui/input';
import { Label } from './ui/label';

interface CompanyFormProps {
  data: CompanyInfo;
  onChange: (data: CompanyInfo) => void;
  type: 'seller' | 'buyer';
}

export function CompanyForm({ data, onChange, type }: CompanyFormProps) {
  const updateField = (field: keyof CompanyInfo, value: string) => {
    onChange({ ...data, [field]: value });
  };

  const idPrefix = type === 'seller' ? 'seller' : 'buyer';

  return (
    <div className="space-y-4">
      <div>
        <Label htmlFor={`${idPrefix}Name`}>Nazwa *</Label>
        <Input
          id={`${idPrefix}Name`}
          value={data.name}
          onChange={(e) => updateField('name', e.target.value)}
          placeholder="Nazwa firmy"
        />
      </div>
      <div>
        <Label htmlFor={`${idPrefix}Address`}>Adres *</Label>
        <Input
          id={`${idPrefix}Address`}
          value={data.address}
          onChange={(e) => updateField('address', e.target.value)}
          placeholder="Ulica i numer"
        />
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div>
          <Label htmlFor={`${idPrefix}PostalCode`}>Kod pocztowy *</Label>
          <Input
            id={`${idPrefix}PostalCode`}
            value={data.postalCode}
            onChange={(e) => updateField('postalCode', e.target.value)}
            placeholder="00-000"
          />
        </div>
        <div>
          <Label htmlFor={`${idPrefix}City`}>Miasto *</Label>
          <Input
            id={`${idPrefix}City`}
            value={data.city}
            onChange={(e) => updateField('city', e.target.value)}
            placeholder="Miasto"
          />
        </div>
      </div>
      <div>
        <Label htmlFor={`${idPrefix}Nip`}>NIP *</Label>
        <Input
          id={`${idPrefix}Nip`}
          value={data.nip}
          onChange={(e) => updateField('nip', e.target.value)}
          placeholder="0000000000"
        />
      </div>
      {type === 'seller' && (
        <div>
          <Label htmlFor={`${idPrefix}BankAccount`}>Numer konta bankowego</Label>
          <Input
            id={`${idPrefix}BankAccount`}
            value={data.bankAccount || ''}
            onChange={(e) => updateField('bankAccount', e.target.value)}
            placeholder="00 0000 0000 0000 0000 0000 0000"
          />
        </div>
      )}
    </div>
  );
}
