import { useCallback, useMemo, useRef, useState, type ReactElement } from 'react';
import { useTranslation } from 'react-i18next';
import {
  CompleteAddressPrompt,
  type CompleteAddressReason,
} from '../components/address/CompleteAddressPrompt';
import type { DeliveryAddressFormValue } from '../components/forms/DeliveryAddressForm';
import { agentApi } from '../services/agentApi';
import type { UserAddress } from '../types/agent';
import {
  isAddressComplete,
  toDeliveryAddressFormValue,
} from '../utils/addressCompleteness';

const EMPTY_FORM: DeliveryAddressFormValue = {
  address_line_1: '',
  address_line_2: '',
  city: '',
  state: '',
  postal_code: '',
  country: '',
};

export interface UseCompleteAddressPromptResult {
  visible: boolean;
  reason: CompleteAddressReason;
  form: DeliveryAddressFormValue;
  setForm: (next: DeliveryAddressFormValue) => void;
  saving: boolean;
  error: string | null;
  openPrompt: (opts: {
    address?: UserAddress | null;
    reason: CompleteAddressReason;
    onSaved?: () => void | Promise<void>;
  }) => void;
  save: () => Promise<boolean>;
  dismiss: () => void;
  Prompt: ReactElement;
}

/**
 * Fullscreen complete-address modal + create/update via `/addresses`.
 */
export function useCompleteAddressPrompt(): UseCompleteAddressPromptResult {
  const { t } = useTranslation();
  const [visible, setVisible] = useState(false);
  const [reason, setReason] = useState<CompleteAddressReason>('enroll');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<DeliveryAddressFormValue>(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const onSavedRef = useRef<(() => void | Promise<void>) | null>(null);

  const openPrompt = useCallback(
    (opts: {
      address?: UserAddress | null;
      reason: CompleteAddressReason;
      onSaved?: () => void | Promise<void>;
    }) => {
      setReason(opts.reason);
      setEditingId(opts.address?.id ?? null);
      setForm(toDeliveryAddressFormValue(opts.address ?? null));
      setError(null);
      onSavedRef.current = opts.onSaved ?? null;
      setVisible(true);
    },
    []
  );

  const dismiss = useCallback(() => {
    if (saving) return;
    setVisible(false);
    onSavedRef.current = null;
  }, [saving]);

  const save = useCallback(async (): Promise<boolean> => {
    if (!isAddressComplete(form)) return false;
    setSaving(true);
    setError(null);
    try {
      const fields = {
        address_line_1: form.address_line_1.trim(),
        address_line_2: form.address_line_2.trim() || undefined,
        city: form.city.trim(),
        state: form.state.trim(),
        country: form.country.trim(),
        postal_code: form.postal_code.trim() || undefined,
        latitude: form.latitude,
        longitude: form.longitude,
      };
      if (editingId) {
        // Do not force is_primary / address_type on update — preserves the
        // selected delivery address without promoting it to account default.
        await agentApi.addresses.update(editingId, fields);
      } else {
        await agentApi.addresses.create({
          ...fields,
          is_primary: true,
          address_type: 'home',
        });
      }
      const cb = onSavedRef.current;
      setVisible(false);
      onSavedRef.current = null;
      if (cb) await cb();
      return true;
    } catch (e: unknown) {
      const msg =
        e instanceof Error
          ? e.message
          : t('addresses.completePrompt.saveError', 'Could not save address. Try again.');
      setError(msg);
      return false;
    } finally {
      setSaving(false);
    }
  }, [editingId, form, t]);

  const allowDismiss = reason === 'checkout';

  const Prompt = useMemo(
    () => (
      <CompleteAddressPrompt
        visible={visible}
        reason={reason}
        value={form}
        onChange={setForm}
        onSave={() => void save()}
        saving={saving}
        error={error}
        allowDismiss={allowDismiss}
        onDismiss={dismiss}
      />
    ),
    [allowDismiss, dismiss, error, form, reason, save, saving, visible]
  );

  return {
    visible,
    reason,
    form,
    setForm,
    saving,
    error,
    openPrompt,
    save,
    dismiss,
    Prompt,
  };
}
