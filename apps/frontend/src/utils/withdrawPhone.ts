/** MoMo withdrawals support Cameroon (+237), Gabon (+241), and Togo (+228). */
export function isCmOrGaPhone(phone: string): boolean {
  const digits = phone.replace(/\D/g, '');
  if (digits.startsWith('237')) {
    return digits.length >= 12;
  }
  if (digits.startsWith('241')) {
    return digits.length >= 11;
  }
  if (digits.startsWith('228')) {
    return digits.length >= 11;
  }
  return false;
}
