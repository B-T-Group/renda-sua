import { AdminMapActivity, AdminMapPin } from './adminMap.types';

const COLORS: Record<AdminMapActivity, string> = {
  active: '#2e7d32',
  unavailable: '#757575',
  suspended: '#c62828',
  open: '#1565c0',
  inactive: '#ef6c00',
};

export function pinColor(activity: AdminMapActivity): string {
  return COLORS[activity];
}

export function markerContent(
  pin: AdminMapPin,
  showLabel: boolean,
  activityLabel: string
): HTMLElement {
  const root = document.createElement('div');
  root.appendChild(markerDot(pinColor(pin.activity)));
  if (showLabel) root.appendChild(markerCaption(pin.title, activityLabel));
  return root;
}

function markerDot(color: string): HTMLElement {
  const dot = document.createElement('div');
  dot.style.cssText = [
    'width:14px',
    'height:14px',
    'border-radius:50%',
    `background:${color}`,
    'border:2px solid #fff',
    'box-shadow:0 1px 4px rgba(0,0,0,.35)',
  ].join(';');
  return dot;
}

function markerCaption(title: string, activityLabel: string): HTMLElement {
  const caption = document.createElement('div');
  caption.style.cssText = [
    'margin-top:4px',
    'max-width:160px',
    'padding:2px 6px',
    'border-radius:6px',
    'background:#fff',
    'box-shadow:0 1px 4px rgba(0,0,0,.2)',
    'font:600 12px/1.3 sans-serif',
    'color:#1a1a1a',
  ].join(';');
  caption.textContent = `${title} · ${activityLabel}`;
  return caption;
}
