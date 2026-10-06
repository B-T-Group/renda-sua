import { act, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { DeferredFloatingWhatsApp } from '../common/DeferredFloatingWhatsApp';
import { DeferredAssistantLauncher } from './DeferredAssistantLauncher';
import { assistantScreenName } from './assistantLauncherRoutes';
import { useAssistantEntryGate } from './useAssistantEntryGate';

const mockFlags = { flags: { assistant_launcher_v1: false }, loaded: true };
jest.mock('../../hooks/useClientFlags', () => ({
  useClientFlags: () => mockFlags,
}));
jest.mock('@digicroz/react-floating-whatsapp', () => ({
  FloatingWhatsApp: () => <div data-testid="whatsapp-bubble" />,
}));
jest.mock('./AssistantLauncher', () => ({
  AssistantLauncher: ({ screen: s }: { screen: string }) => (
    <div data-testid="assistant-launcher" data-screen={s} />
  ),
}));

/** Mirrors the composition in app.tsx (app.spec cannot run: lottie canvas, pre-existing). */
type Persona = 'guest' | 'client' | 'business' | 'agent' | 'loading';
function Floating({ persona, path, isMobile = false }: { persona: Persona; path: string; isMobile?: boolean }) {
  const isAuthenticated = persona !== 'guest';
  const gate = useAssistantEntryGate({
    isAuthenticated,
    userType: isAuthenticated && persona !== 'loading' ? persona : null,
    personaLoading: persona === 'loading',
    pathname: path,
    isMobile,
  });
  const isItemDetailPage = /^\/items\/[^/]+\/?$/.test(path);
  const hideWhatsapp =
    path === '/assistant' || (isMobile && isItemDetailPage) || gate.whatsappYieldsToOrb;
  return (
    <>
      <span data-testid="header-entry">{gate.headerEntry}</span>
      <DeferredFloatingWhatsApp whatsappBottomOffset={24} hidden={hideWhatsapp} />
      <DeferredAssistantLauncher
        hidden={!gate.showLauncher}
        isMobile={isMobile}
        bottomOffset={24}
        screen={assistantScreenName(path)}
        isSignedIn={isAuthenticated}
      />
    </>
  );
}

async function renderAt(persona: Persona, path: string, isMobile = false) {
  render(
    <MemoryRouter initialEntries={[path]}>
      <Floating persona={persona} path={path} isMobile={isMobile} />
    </MemoryRouter>
  );
  // Both widgets idle-mount (jsdom has no requestIdleCallback → 2 s timeout), then lazy-load.
  await act(async () => {
    jest.advanceTimersByTime(2500);
  });
  await act(async () => {
    await Promise.resolve();
    await Promise.resolve();
  });
}

beforeEach(() => {
  jest.useFakeTimers();
  mockFlags.flags.assistant_launcher_v1 = false;
  mockFlags.loaded = true;
});
afterEach(() => jest.useRealTimers());

describe('D2: the orb replaces the floating WhatsApp bubble (flag-gated)', () => {
  it('flag off: client on / keeps the WhatsApp bubble and gets no launcher', async () => {
    await renderAt('client', '/');
    expect(await screen.findByTestId('whatsapp-bubble')).toBeInTheDocument();
    expect(screen.queryByTestId('assistant-launcher')).toBeNull();
    expect(screen.getByTestId('header-entry').textContent).toBe('icon');
  });

  it('flag on: client on / gets the launcher instead of the bubble', async () => {
    mockFlags.flags.assistant_launcher_v1 = true;
    await renderAt('client', '/');
    expect(await screen.findByTestId('assistant-launcher')).toBeInTheDocument();
    expect(screen.queryByTestId('whatsapp-bubble')).toBeNull();
    expect(screen.getByTestId('header-entry').textContent).toBe('hidden');
  });

  it('flag on: guest on /items gets the launcher instead of the bubble', async () => {
    mockFlags.flags.assistant_launcher_v1 = true;
    await renderAt('guest', '/items');
    expect((await screen.findByTestId('assistant-launcher')).getAttribute('data-screen')).toBe('items');
    expect(screen.queryByTestId('whatsapp-bubble')).toBeNull();
  });

  it('flag on: business keeps the bubble and never sees the launcher', async () => {
    mockFlags.flags.assistant_launcher_v1 = true;
    await renderAt('business', '/');
    expect(await screen.findByTestId('whatsapp-bubble')).toBeInTheDocument();
    expect(screen.queryByTestId('assistant-launcher')).toBeNull();
    expect(screen.getByTestId('header-entry').textContent).toBe('icon');
  });

  it('flag on: client on /cart keeps the bubble (support one tap away at payment)', async () => {
    mockFlags.flags.assistant_launcher_v1 = true;
    await renderAt('client', '/cart');
    expect(await screen.findByTestId('whatsapp-bubble')).toBeInTheDocument();
    expect(screen.queryByTestId('assistant-launcher')).toBeNull();
    expect(screen.getByTestId('header-entry').textContent).toBe('character');
  });

  it('client/guest: no bubble until flags have loaded (no flash-then-swap)', async () => {
    mockFlags.loaded = false;
    await renderAt('guest', '/items');
    expect(screen.queryByTestId('whatsapp-bubble')).toBeNull();
    expect(screen.queryByTestId('assistant-launcher')).toBeNull();
  });

  it('flags fetch failed or timed out (loaded, defaults): guest on /items gets the bubble and the icon', async () => {
    // useClientFlags reports loaded=true with the defaults on failure or after CLIENT_FLAGS_WAIT_MS.
    mockFlags.loaded = true;
    mockFlags.flags.assistant_launcher_v1 = false;
    await renderAt('guest', '/items');
    expect(await screen.findByTestId('whatsapp-bubble')).toBeInTheDocument();
    expect(screen.queryByTestId('assistant-launcher')).toBeNull();
    expect(screen.getByTestId('header-entry').textContent).toBe('icon');
  });

  it('client/guest: the header slot is pending (invisible) until flags resolve', async () => {
    mockFlags.loaded = false;
    await renderAt('client', '/cart');
    expect(screen.getByTestId('header-entry').textContent).toBe('pending');
  });

  it.each(['agent', 'business'] as const)('%s is never held while flags load (bubble + icon as today)', async (persona) => {
    mockFlags.loaded = false;
    await renderAt(persona, '/');
    expect(await screen.findByTestId('whatsapp-bubble')).toBeInTheDocument();
    expect(screen.getByTestId('header-entry').textContent).toBe('icon');
  });

  it('flag on + signed-in persona still loading: nothing flashes before the persona is known', async () => {
    mockFlags.flags.assistant_launcher_v1 = true;
    await renderAt('loading', '/');
    expect(screen.queryByTestId('whatsapp-bubble')).toBeNull();
    expect(screen.queryByTestId('assistant-launcher')).toBeNull();
    expect(screen.getByTestId('header-entry').textContent).toBe('pending');
  });

  it('flag off + signed-in persona still loading: today\'s bubble and icon', async () => {
    await renderAt('loading', '/');
    expect(await screen.findByTestId('whatsapp-bubble')).toBeInTheDocument();
    expect(screen.getByTestId('header-entry').textContent).toBe('icon');
  });
});
