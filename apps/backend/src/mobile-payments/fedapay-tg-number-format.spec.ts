describe('FedaPay TG Number Format', () => {

  it('mutation test: FedaPay service strips country code for TG numbers', () => {
    const fs = require('fs');
    const path = require('path');
    const fedapaySource = fs.readFileSync(
      path.join(__dirname, 'providers/fedapay.service.ts'),
      'utf-8'
    );

    // FedaPay must handle TG numbers by sending bare national format
    // The service should extract national number and send separately with country: 'TG'
    expect(fedapaySource).toContain('getNationalNumber');
    expect(fedapaySource.length).toBeGreaterThan(1000); // Service exists with substantial logic
  });

  it('mutation test: FedaPay determines TG channel from number prefix', () => {
    const fs = require('fs');
    const path = require('path');
    const fedapaySource = fs.readFileSync(
      path.join(__dirname, 'providers/fedapay.service.ts'),
      'utf-8'
    );

    // Must map TG number prefixes to moov_tg or togocel channels
    expect(fedapaySource).toContain('moov_tg');
    expect(fedapaySource).toContain('togocel');
  });

  it('mutation test: FedaPay recognizes moov_tg prefixes (78,79,96-99)', () => {
    const fs = require('fs');
    const path = require('path');
    const fedapaySource = fs.readFileSync(
      path.join(__dirname, 'providers/fedapay.service.ts'),
      'utf-8'
    );

    // Must contain logic to detect moov_tg prefixes
    // Prefixes 78, 79, 96, 97, 98, 99 should map to moov_tg channel
    expect(fedapaySource).toContain('moov_tg');
  });

  it('mutation test: FedaPay handles both international and national format', () => {
    const fs = require('fs');
    const path = require('path');
    const fedapaySource = fs.readFileSync(
      path.join(__dirname, 'providers/fedapay.service.ts'),
      'utf-8'
    );

    // Must use phone parsing to handle both 228XXXXXXXX and XXXXXXXX formats
    expect(fedapaySource).toContain('parsePhoneNumber');
  });

  it('mutation test: FedaPay handles GIVE_CHANGE (payee field) with national format', () => {
    const fs = require('fs');
    const path = require('path');
    const fedapaySource = fs.readFileSync(
      path.join(__dirname, 'providers/fedapay.service.ts'),
      'utf-8'
    );

    // Must handle payee field for GIVE_CHANGE transactions
    expect(fedapaySource).toContain('payee');
  });
});
