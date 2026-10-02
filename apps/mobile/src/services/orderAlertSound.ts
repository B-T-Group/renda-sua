import { Platform } from 'react-native';
import { ORDER_ALERT_SOURCE } from './orderAlertSource';
const DELEGATE_PULSE_MS = 12_000;

type AlertPlayer = {
  loop: boolean;
  play: () => void;
  pause: () => void;
  seekTo: (seconds: number) => void;
};

type Playback = 'off' | 'loop' | 'pulse';

/** Overlay that keeps the looping chime alive. */
export type OrderAlertOwner = 'incomingOrder' | 'orderOffer';

const owners = new Set<OrderAlertOwner>();

let player: AlertPlayer | null = null;
let loading: Promise<AlertPlayer | null> | null = null;
let generation = 0;
let playback: Playback = 'off';
let pulseTimer: ReturnType<typeof setTimeout> | null = null;

function clearPulse(): void {
  if (!pulseTimer) return;
  clearTimeout(pulseTimer);
  pulseTimer = null;
}

async function createPlayer(): Promise<AlertPlayer | null> {
  if (Platform.OS === 'web') return null;
  try {
    const audio = await import('expo-audio');
    await audio.setAudioModeAsync({
      playsInSilentMode: true,
      interruptionMode: 'duckOthers',
    });
    const next = audio.createAudioPlayer(ORDER_ALERT_SOURCE);
    next.loop = true;
    return next;
  } catch {
    return null;
  }
}

async function ensurePlayer(): Promise<AlertPlayer | null> {
  if (player) return player;
  if (!loading) loading = createPlayer();
  const created = await loading;
  loading = null;
  if (created) player = created;
  return player;
}

async function playLoop(token: number): Promise<void> {
  const active = await ensurePlayer();
  if (!active || token !== generation) return;
  active.loop = true;
  active.seekTo(0);
  active.play();
}

function begin(mode: Playback): void {
  clearPulse();
  playback = mode;
  const token = ++generation;
  void playLoop(token);
}

function silence(): void {
  clearPulse();
  playback = 'off';
  generation += 1;
  player?.pause();
}

/** Loop until every owner calls `stopOrderAlertSound`. Plays in silent mode while the app is open. */
export function startOrderAlertSound(owner: OrderAlertOwner): void {
  owners.add(owner);
  begin('loop');
}

function endPulse(token: number): void {
  pulseTimer = null;
  if (playback !== 'pulse' || token !== generation) return;
  silence();
}

/** Short burst for a delegate who does not get the full-screen order alert. */
export function pulseOrderAlertSound(durationMs = DELEGATE_PULSE_MS): void {
  if (playback === 'loop') return;
  begin('pulse');
  const token = generation;
  pulseTimer = setTimeout(() => endPulse(token), durationMs);
}

/** Release `owner`; the chime keeps looping while another overlay still owns it. */
export function stopOrderAlertSound(owner: OrderAlertOwner): void {
  owners.delete(owner);
  if (owners.size > 0) return;
  silence();
}
