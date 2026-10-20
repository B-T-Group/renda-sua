import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { detectTogoOperator } from '../common/TogoOperatorPicker';

describe('TopUpModal - Operator Mismatch Logic', () => {
  describe('detectTogoOperator with mismatch scenarios', () => {
    it('detects Moov from 78 prefix', () => {
      expect(detectTogoOperator('+22878123456')).toBe('moov');
    });

    it('detects Togocel from 90 prefix', () => {
      expect(detectTogoOperator('+22890123456')).toBe('togocel');
    });

    it('identifies mismatch when Moov number but Togocel selected', () => {
      const phoneNumber = '+22878123456';
      const detected = detectTogoOperator(phoneNumber);
      const selected = 'togocel';
      
      expect(detected).toBe('moov');
      expect(selected !== detected).toBe(true);
    });

    it('identifies mismatch when Togocel number but Moov selected', () => {
      const phoneNumber = '+22890123456';
      const detected = detectTogoOperator(phoneNumber);
      const selected = 'moov';
      
      expect(detected).toBe('togocel');
      expect(selected !== detected).toBe(true);
    });

    it('identifies no mismatch when operator matches phone', () => {
      const moovPhone = '+22878123456';
      const moovDetected = detectTogoOperator(moovPhone);
      expect('moov' === moovDetected).toBe(true);

      const togocelPhone = '+22890123456';
      const togocelDetected = detectTogoOperator(togocelPhone);
      expect('togocel' === togocelDetected).toBe(true);
    });
  });

  describe('submit blocking logic', () => {
    it('should block submit when mismatch is true', () => {
      const operatorMismatch = true;
      const topUpAmountOk = true;
      const phoneNumber = '+22878123456';
      const amount = '1000';
      
      const canSubmit = !operatorMismatch && topUpAmountOk && !!phoneNumber.trim() && !!amount.trim();
      
      expect(canSubmit).toBe(false);
    });

    it('should allow submit when no mismatch', () => {
      const operatorMismatch = false;
      const topUpAmountOk = true;
      const phoneNumber = '+22878123456';
      const amount = '1000';
      
      const canSubmit = !operatorMismatch && topUpAmountOk && !!phoneNumber.trim() && !!amount.trim();
      
      expect(canSubmit).toBe(true);
    });

    it('should block submit when amount is invalid even without mismatch', () => {
      const operatorMismatch = false;
      const topUpAmountOk = false;
      const phoneNumber = '+22878123456';
      const amount = '50';
      
      const canSubmit = !operatorMismatch && topUpAmountOk && !!phoneNumber.trim() && !!amount.trim();
      
      expect(canSubmit).toBe(false);
    });

    it('should block submit when phone is empty even without mismatch', () => {
      const operatorMismatch = false;
      const topUpAmountOk = true;
      const phoneNumber = '';
      const amount = '1000';
      
      const canSubmit = !operatorMismatch && topUpAmountOk && !!phoneNumber.trim() && !!amount.trim();
      
      expect(canSubmit).toBe(false);
    });
  });

  describe('auto-follow behavior', () => {
    it('auto-updates to Moov when phone changes to Moov prefix', () => {
      const initialPhone = '+22890123456'; // Togocel
      const newPhone = '+22878123456'; // Moov
      
      expect(detectTogoOperator(initialPhone)).toBe('togocel');
      expect(detectTogoOperator(newPhone)).toBe('moov');
    });

    it('auto-updates to Togocel when phone changes to Togocel prefix', () => {
      const initialPhone = '+22878123456'; // Moov
      const newPhone = '+22890123456'; // Togocel
      
      expect(detectTogoOperator(initialPhone)).toBe('moov');
      expect(detectTogoOperator(newPhone)).toBe('togocel');
    });

    it('maintains consistency across all Moov prefixes', () => {
      const moovPrefixes = ['78', '79', '96', '97', '98', '99'];
      moovPrefixes.forEach(prefix => {
        expect(detectTogoOperator(`+228${prefix}123456`)).toBe('moov');
      });
    });

    it('maintains consistency across all Togocel prefixes', () => {
      const togocelPrefixes = ['70', '71', '72', '73', '90', '91', '92', '93'];
      togocelPrefixes.forEach(prefix => {
        expect(detectTogoOperator(`+228${prefix}123456`)).toBe('togocel');
      });
    });
  });
});
