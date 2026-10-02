import { beforeEach, describe, expect, it, vi } from 'vitest';

const play = vi.fn();
const pause = vi.fn();
const seekTo = vi.fn();
const setAudioModeAsync = vi.fn(async () => undefined);
const createAudioPlayer = vi.fn(() => ({
  loop: false,
  play,
  pause,
  seekTo,
}));

vi.mock('./orderAlertSource', () => ({
  ORDER_ALERT_SOURCE: 'order-alert',
}));

vi.mock('expo-audio', () => ({
  setAudioModeAsync,
  createAudioPlayer,
}));

async function loadAlert() {
  return import('./orderAlertSound');
}

describe('orderAlertSound', () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
  });

  it('plays a looping chime that ignores silent mode', async () => {
    const { startOrderAlertSound, stopOrderAlertSound } = await loadAlert();
    startOrderAlertSound('incomingOrder');
    await vi.waitFor(() => expect(play).toHaveBeenCalled());

    expect(setAudioModeAsync).toHaveBeenCalledWith({
      playsInSilentMode: true,
      interruptionMode: 'duckOthers',
    });
    expect(createAudioPlayer).toHaveBeenCalledTimes(1);
    stopOrderAlertSound('incomingOrder');
  });

  it('stops when the order screen closes', async () => {
    const { startOrderAlertSound, stopOrderAlertSound } = await loadAlert();
    startOrderAlertSound('incomingOrder');
    await vi.waitFor(() => expect(play).toHaveBeenCalled());
    stopOrderAlertSound('incomingOrder');

    expect(pause).toHaveBeenCalled();
  });

  it('keeps looping while another overlay still owns the chime', async () => {
    const { startOrderAlertSound, stopOrderAlertSound } = await loadAlert();
    startOrderAlertSound('incomingOrder');
    startOrderAlertSound('orderOffer');
    await vi.waitFor(() => expect(play).toHaveBeenCalled());

    stopOrderAlertSound('orderOffer');
    expect(pause).not.toHaveBeenCalled();

    stopOrderAlertSound('incomingOrder');
    expect(pause).toHaveBeenCalled();
  });

  it('does not let a delegate pulse silence an open order screen', async () => {
    const { startOrderAlertSound, pulseOrderAlertSound } = await loadAlert();
    startOrderAlertSound('incomingOrder');
    await vi.waitFor(() => expect(play).toHaveBeenCalled());
    pulseOrderAlertSound(20);
    await new Promise((resolve) => setTimeout(resolve, 40));

    expect(pause).not.toHaveBeenCalled();
  });

  it('stops a delegate pulse on its own', async () => {
    const { pulseOrderAlertSound } = await loadAlert();
    pulseOrderAlertSound(20);
    await vi.waitFor(() => expect(play).toHaveBeenCalled());
    await vi.waitFor(() => expect(pause).toHaveBeenCalled());
  });
});
