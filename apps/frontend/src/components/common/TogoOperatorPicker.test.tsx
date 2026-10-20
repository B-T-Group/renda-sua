import { render, screen, fireEvent } from '@testing-library/react';
import { TogoOperatorPicker, detectTogoOperator } from './TogoOperatorPicker';

describe('TogoOperatorPicker', () => {
  it('renders with moov selected', () => {
    const onChange = jest.fn();
    render(
      <TogoOperatorPicker
        value="moov"
        onChange={onChange}
        phoneNumber="+22878123456"
        disabled={false}
      />
    );

    expect(screen.getByText(/Moov Money/i)).toBeInTheDocument();
  });

  it('renders with togocel selected', () => {
    const onChange = jest.fn();
    render(
      <TogoOperatorPicker
        value="togocel"
        onChange={onChange}
        phoneNumber="+22890123456"
        disabled={false}
      />
    );

    expect(screen.getByText(/Mixx by Yas/i)).toBeInTheDocument();
  });

  it('calls onChange when operator is changed', () => {
    const onChange = jest.fn();
    render(
      <TogoOperatorPicker
        value="moov"
        onChange={onChange}
        phoneNumber="+22878123456"
        disabled={false}
      />
    );

    const togocelButton = screen.getByLabelText(/Mixx by Yas/i);
    fireEvent.click(togocelButton);

    expect(onChange).toHaveBeenCalledWith('togocel');
  });
});

describe('detectTogoOperator', () => {
  describe('Moov Money prefixes (78, 79, 96-99)', () => {
    it('detects 78 prefix as moov', () => {
      expect(detectTogoOperator('+22878123456')).toBe('moov');
      expect(detectTogoOperator('22878123456')).toBe('moov');
      expect(detectTogoOperator('78123456')).toBe('moov');
    });

    it('detects 79 prefix as moov', () => {
      expect(detectTogoOperator('+22879123456')).toBe('moov');
      expect(detectTogoOperator('79123456')).toBe('moov');
    });

    it('detects 96 prefix as moov', () => {
      expect(detectTogoOperator('+22896123456')).toBe('moov');
      expect(detectTogoOperator('96123456')).toBe('moov');
    });

    it('detects 97 prefix as moov', () => {
      expect(detectTogoOperator('+22897123456')).toBe('moov');
      expect(detectTogoOperator('97123456')).toBe('moov');
    });

    it('detects 98 prefix as moov', () => {
      expect(detectTogoOperator('+22898123456')).toBe('moov');
      expect(detectTogoOperator('98123456')).toBe('moov');
    });

    it('detects 99 prefix as moov', () => {
      expect(detectTogoOperator('+22899123456')).toBe('moov');
      expect(detectTogoOperator('99123456')).toBe('moov');
    });
  });

  describe('Togocel/Mixx prefixes (70-73, 90-93)', () => {
    it('detects 70 prefix as togocel', () => {
      expect(detectTogoOperator('+22870123456')).toBe('togocel');
      expect(detectTogoOperator('70123456')).toBe('togocel');
    });

    it('detects 71 prefix as togocel', () => {
      expect(detectTogoOperator('+22871123456')).toBe('togocel');
      expect(detectTogoOperator('71123456')).toBe('togocel');
    });

    it('detects 72 prefix as togocel', () => {
      expect(detectTogoOperator('+22872123456')).toBe('togocel');
      expect(detectTogoOperator('72123456')).toBe('togocel');
    });

    it('detects 73 prefix as togocel', () => {
      expect(detectTogoOperator('+22873123456')).toBe('togocel');
      expect(detectTogoOperator('73123456')).toBe('togocel');
    });

    it('detects 90 prefix as togocel', () => {
      expect(detectTogoOperator('+22890123456')).toBe('togocel');
      expect(detectTogoOperator('90123456')).toBe('togocel');
    });

    it('detects 91 prefix as togocel', () => {
      expect(detectTogoOperator('+22891123456')).toBe('togocel');
      expect(detectTogoOperator('91123456')).toBe('togocel');
    });

    it('detects 92 prefix as togocel', () => {
      expect(detectTogoOperator('+22892123456')).toBe('togocel');
      expect(detectTogoOperator('92123456')).toBe('togocel');
    });

    it('detects 93 prefix as togocel', () => {
      expect(detectTogoOperator('+22893123456')).toBe('togocel');
      expect(detectTogoOperator('93123456')).toBe('togocel');
    });
  });

  describe('edge cases', () => {
    it('defaults to togocel for empty string', () => {
      expect(detectTogoOperator('')).toBe('togocel');
    });

    it('defaults to togocel for non-Togo number', () => {
      expect(detectTogoOperator('+237671234567')).toBe('togocel');
    });

    it('defaults to togocel for invalid prefix', () => {
      expect(detectTogoOperator('+22880123456')).toBe('togocel');
    });
  });
});
