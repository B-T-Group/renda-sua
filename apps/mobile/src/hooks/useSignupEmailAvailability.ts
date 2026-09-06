import { useEffect, useState } from 'react';
import { getEmailAvailability } from '../services/publicAuthApi';

export function isValidEmailFormat(email: string): boolean {
  const s = email.trim();
  if (!s) return false;
  return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/i.test(s);
}

export function useSignupEmailAvailability(email: string) {
  const [emailTaken, setEmailTaken] = useState(false);
  const [checkingEmail, setCheckingEmail] = useState(false);

  useEffect(() => {
    const trimmed = email.trim();
    if (!isValidEmailFormat(trimmed)) {
      setEmailTaken(false);
      setCheckingEmail(false);
      return;
    }
    // Delay both the spinner and the network call so the indicator doesn't
    // flicker on every keystroke — it only appears after the debounce window.
    const id = setTimeout(() => {
      setCheckingEmail(true);
      void (async () => {
        try {
          const { taken } = await getEmailAvailability(trimmed);
          setEmailTaken(taken);
        } catch {
          setEmailTaken(false);
        } finally {
          setCheckingEmail(false);
        }
      })();
    }, 400);
    return () => clearTimeout(id);
  }, [email]);

  return { emailTaken, checkingEmail };
}
