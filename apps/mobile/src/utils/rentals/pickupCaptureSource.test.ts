import { describe, expect, it } from 'vitest';
import { pickupCaptureSource } from './pickupCaptureSource';

describe('pickup capture source', () => {
  it('opens the camera and never the photo library when pickup rules are on', () => {
    expect(pickupCaptureSource(true, true)).toBe('camera');
    expect(pickupCaptureSource(true, false)).toBe('denied');
    expect(pickupCaptureSource(true, true)).not.toBe('library');
    expect(pickupCaptureSource(true, false)).not.toBe('library');
  });

  it('keeps the library fallback when the flag is off', () => {
    expect(pickupCaptureSource(false, false)).toBe('library');
    expect(pickupCaptureSource(false, true)).toBe('camera');
  });
});
