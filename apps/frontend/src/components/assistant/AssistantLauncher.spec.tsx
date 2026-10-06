import { act, fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { AssistantLauncher, requestAssistantAttention } from './AssistantLauncher';
import { NUDGE_AUTO_HIDE_MS } from './AssistantLauncherNudge';
import { ATTENTION_LOG_KEY, NUDGE_SEEN_KEY } from './launcherStorage';

const mockTrack = jest.fn();
jest.mock('../../hooks/useTrackSiteEvent', () => ({
  ...jest.requireActual('../../hooks/useTrackSiteEvent'),
  useTrackSiteEvent: () => ({ trackSiteEvent: mockTrack }),
}));
jest.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (_k: string, fallback: string) => fallback,
    i18n: { language: 'fr-FR' },
  }),
}));

const events = (type?: string) =>
  mockTrack.mock.calls
    .map(([payload, options]) => ({ ...payload, options }))
    .filter((p) => !type || p.eventType === type);

function setMotion(reduce: boolean) {
  Object.defineProperty(window, 'matchMedia', {
    configurable: true,
    writable: true,
    value: (query: string) => ({
      matches: reduce && query.includes('prefers-reduced-motion'),
      media: query,
      addEventListener: () => undefined,
      removeEventListener: () => undefined,
    }),
  });
}

function renderLauncher(screenName = 'home', props: Partial<React.ComponentProps<typeof AssistantLauncher>> = {}) {
  return render(
    <MemoryRouter initialEntries={['/']}>
      <Routes>
        <Route
          path="/"
          element={<AssistantLauncher isMobile={false} bottomOffset={24} screen={screenName} isSignedIn={false} {...props} />}
        />
        <Route path="/assistant" element={<div data-testid="assistant-route" />} />
      </Routes>
    </MemoryRouter>
  );
}

beforeEach(() => {
  jest.useFakeTimers();
  localStorage.clear();
  sessionStorage.clear();
  mockTrack.mockReset();
  setMotion(false);
  jest.spyOn(window, 'requestAnimationFrame').mockImplementation(() => 1);
});
afterEach(() => {
  jest.useRealTimers();
  jest.restoreAllMocks();
});

describe('AssistantLauncher', () => {
  it('is a labelled button with a hint, at 24/24 on desktop, below MUI dialogs', () => {
    renderLauncher('items');
    const button = screen.getByRole('button', { name: 'Open shopping assistant' });
    const hint = document.getElementById(button.getAttribute('aria-describedby') || '');
    expect(hint?.textContent).toBe('Find items, reorder or track an order');
    const root = screen.getByTestId('assistant-launcher');
    const style = getComputedStyle(root);
    expect([style.position, style.right, style.bottom, style.zIndex]).toEqual(['fixed', '24px', '24px', '1030']);
    // Decorative character, 52 px tall.
    const svg = root.querySelector('svg[data-renda]') as SVGElement;
    expect(svg.getAttribute('aria-hidden')).toBe('true');
    expect(svg.getAttribute('height')).toBe('52');
  });

  it('extended "Ask" label for the first 3 sessions, collapsing on the first scroll', () => {
    renderLauncher('items');
    expect(screen.getByTestId('assistant-launcher').getAttribute('data-variant')).toBe('orb_extended');
    expect(screen.getByText('Ask')).toBeInTheDocument();
    act(() => {
      fireEvent.scroll(window);
    });
    expect(screen.queryByText('Ask')).toBeNull();
  });

  it('is compact from the 4th session on', () => {
    localStorage.setItem('assistant.launcher.sessions.v1', '3');
    renderLauncher('items');
    expect(screen.getByTestId('assistant-launcher').getAttribute('data-variant')).toBe('orb');
  });

  it('fires one impression per screen per session with #458-valid metadata, keyed without the install id', () => {
    const { unmount } = renderLauncher('items');
    unmount();
    renderLauncher('items');
    const imps = events('assistant.launcher.impression');
    expect(imps).toHaveLength(1);
    expect(imps[0].metadata).toEqual({
      screen: 'items',
      variant: 'orb_extended',
      motion: 'on',
      persona: 'guest',
      locale: 'fr',
      is_signed_in: false,
    });
    // Guests: the chat thread id (none outside the provider), never the per-install id.
    expect(imps[0].options).toEqual({ anonymousId: null });
  });

  it('hover/focus makes the character attentive; leaving returns to idle after 150 ms', () => {
    renderLauncher('items');
    const button = screen.getByRole('button', { name: 'Open shopping assistant' });
    const svg = () => screen.getByTestId('assistant-launcher-character');
    expect(svg().getAttribute('data-renda-state')).toBe('idle');
    fireEvent.pointerEnter(button);
    expect(svg().getAttribute('data-renda-state')).toBe('attentive');
    fireEvent.pointerLeave(button);
    act(() => {
      jest.advanceTimersByTime(149);
    });
    expect(svg().getAttribute('data-renda-state')).toBe('attentive');
    act(() => {
      jest.advanceTimersByTime(1);
    });
    expect(svg().getAttribute('data-renda-state')).toBe('idle');
  });

  it('tap tracks and opens /assistant', () => {
    renderLauncher('store_detail', { isSignedIn: true });
    fireEvent.click(screen.getByRole('button', { name: 'Open shopping assistant' }));
    expect(events('assistant.launcher.tap')[0].metadata).toMatchObject({
      screen: 'store_detail',
      variant: 'orb_extended',
      entry: 'orb_extended',
      persona: 'client',
      is_signed_in: true,
    });
    expect(screen.getByTestId('assistant-route')).toBeInTheDocument();
  });

  describe('first-run nudge', () => {
    it('shows after 3 s on home with the attention ripple, once per device', () => {
      renderLauncher('home');
      act(() => {
        jest.advanceTimersByTime(2999);
      });
      expect(screen.queryByTestId('assistant-launcher-nudge')).toBeNull();
      act(() => {
        jest.advanceTimersByTime(1);
      });
      expect(screen.getByText('Hi! I can find items, track your order or reorder for you.')).toBeInTheDocument();
      expect(localStorage.getItem(NUDGE_SEEN_KEY)).toBe('1');
      expect(events('assistant.nudge.shown')[0].metadata).toMatchObject({ screen: 'home' });
      expect(events('assistant.attention.played')[0].metadata).toMatchObject({ trigger: 'first_run' });
      expect(screen.getByTestId('assistant-launcher-character').getAttribute('data-renda-state')).toBe('attention');
      act(() => {
        jest.advanceTimersByTime(1600);
      });
      expect(screen.getByTestId('assistant-launcher-character').getAttribute('data-renda-state')).toBe('idle');
    });

    it('dismiss via ✕ is reported and it never shows again', () => {
      const { unmount } = renderLauncher('home');
      act(() => {
        jest.advanceTimersByTime(3000);
      });
      fireEvent.click(screen.getByRole('button', { name: 'Dismiss' }));
      expect(screen.queryByTestId('assistant-launcher-nudge')).toBeNull();
      expect(events('assistant.nudge.dismissed')[0].metadata).toMatchObject({ screen: 'home', dismiss_reason: 'close' });
      unmount();
      renderLauncher('home');
      act(() => {
        jest.advanceTimersByTime(10000);
      });
      expect(screen.queryByTestId('assistant-launcher-nudge')).toBeNull();
      expect(events('assistant.nudge.shown')).toHaveLength(1);
    });

    it('auto-hides after 8 s (timeout)', () => {
      renderLauncher('home');
      act(() => {
        jest.advanceTimersByTime(3000);
      });
      expect(screen.getByTestId('assistant-launcher-nudge')).toBeInTheDocument();
      act(() => {
        jest.advanceTimersByTime(NUDGE_AUTO_HIDE_MS);
      });
      expect(screen.queryByTestId('assistant-launcher-nudge')).toBeNull();
      expect(events('assistant.nudge.dismissed')[0].metadata.dismiss_reason).toBe('timeout');
    });

    it('a tap outside dismisses with reason outside', () => {
      renderLauncher('home');
      act(() => {
        jest.advanceTimersByTime(3000);
      });
      fireEvent.pointerDown(document.body);
      expect(screen.queryByTestId('assistant-launcher-nudge')).toBeNull();
      expect(events('assistant.nudge.dismissed')[0].metadata.dismiss_reason).toBe('outside');
    });

    it('"Try it" opens the chat (entry nudge, dismiss reason opened)', () => {
      renderLauncher('home');
      act(() => {
        jest.advanceTimersByTime(3000);
      });
      fireEvent.click(screen.getByRole('button', { name: 'Try it' }));
      expect(events('assistant.launcher.tap')[0].metadata.entry).toBe('nudge');
      expect(events('assistant.nudge.dismissed')[0].metadata.dismiss_reason).toBe('opened');
      expect(screen.getByTestId('assistant-route')).toBeInTheDocument();
    });

    it('never shows on other screens', () => {
      renderLauncher('items');
      act(() => {
        jest.advanceTimersByTime(10000);
      });
      expect(screen.queryByTestId('assistant-launcher-nudge')).toBeNull();
    });
  });

  describe('attention caps', () => {
    it('plays at most once per session', () => {
      renderLauncher('items');
      act(() => requestAssistantAttention('zero_results'));
      act(() => {
        jest.advanceTimersByTime(2000);
      });
      act(() => requestAssistantAttention('reorder_eligible'));
      expect(events('assistant.attention.played')).toHaveLength(1);
      expect(events('assistant.attention.played')[0].metadata.trigger).toBe('zero_results');
    });

    it('plays at most 3 times per 7 days', () => {
      const now = Date.now();
      localStorage.setItem(ATTENTION_LOG_KEY, JSON.stringify([now - 1000, now - 2000, now - 3000]));
      renderLauncher('items');
      act(() => requestAssistantAttention('zero_results'));
      expect(events('assistant.attention.played')).toHaveLength(0);
    });

    it('waits for 2 s of scroll idle', () => {
      renderLauncher('items');
      act(() => {
        fireEvent.scroll(window);
      });
      act(() => requestAssistantAttention('zero_results'));
      expect(events('assistant.attention.played')).toHaveLength(0);
      act(() => {
        jest.advanceTimersByTime(2000);
      });
      expect(events('assistant.attention.played')).toHaveLength(1);
    });

    it('reduce motion: no ripple, but the nudge still shows', () => {
      setMotion(true);
      renderLauncher('home');
      act(() => {
        jest.advanceTimersByTime(3000);
      });
      expect(screen.getByTestId('assistant-launcher-nudge')).toBeInTheDocument();
      expect(events('assistant.attention.played')).toHaveLength(0);
      expect(events('assistant.launcher.impression')[0].metadata.motion).toBe('reduced');
    });
  });
});
