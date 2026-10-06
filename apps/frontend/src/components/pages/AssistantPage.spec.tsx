import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { readFileSync } from 'fs';
import { join } from 'path';
import { BrowserRouter } from 'react-router-dom';
import { ThemeProvider } from '@mui/material/styles';
import AssistantPage from './AssistantPage';
import {
  AssistantChatProvider,
  STORAGE_KEY_MESSAGES,
  STORAGE_KEY_OWNER,
  STORAGE_KEY_THREAD_ID,
} from '../../contexts/AssistantChatContext';
import { theme } from '../../theme/theme';

jest.unmock('./AssistantPage');
jest.unmock('../../contexts/AssistantChatContext');

const mockUseSessionAuth = jest.fn();
const mockApiClient = { post: jest.fn() };

jest.mock('../../contexts/SessionAuthContext', () => ({
  useSessionAuth: () => mockUseSessionAuth(),
}));
jest.mock('../../hooks/useApiClient', () => ({
  useApiClient: () => mockApiClient,
}));

const renderPage = () =>
  render(
    <ThemeProvider theme={theme}>
      <BrowserRouter>
        <AssistantChatProvider>
          <AssistantPage />
        </AssistantChatProvider>
      </BrowserRouter>
    </ThemeProvider>
  );

const composer = () =>
  document.querySelector('textarea[name="message"]') as HTMLTextAreaElement;
function typeAndEnter(text: string) {
  fireEvent.change(composer(), { target: { value: text } });
  fireEvent.keyDown(composer(), { key: 'Enter' });
}
const payloads = () =>
  mockApiClient.post.mock.calls.map((call) =>
    call[1].messages.map((m: { content: string }) => m.content)
  );

type Rgba = [number, number, number, number];
/** Parses `rgb(...)`, `rgba(...)` or `#rrggbb`. */
function parseColour(c: string): Rgba {
  if (c.startsWith('#')) {
    const [r, g, b] = [1, 3, 5].map((i) => parseInt(c.slice(i, i + 2), 16));
    return [r, g, b, 1];
  }
  const [r, g, b, a] = (c.match(/\d+(\.\d+)?/g) || []).map(Number);
  return [r, g, b, a ?? 1];
}
/** Composites a (possibly translucent) colour over an opaque backdrop. */
function over(fg: string, backdrop: string): string {
  const [r, g, b, a] = parseColour(fg);
  const [br, bg, bb] = parseColour(backdrop);
  const mix = (x: number, y: number) => Math.round(x * a + y * (1 - a));
  return `rgb(${mix(r, br)}, ${mix(g, bg)}, ${mix(b, bb)})`;
}

/** WCAG relative-luminance contrast between two opaque colours. */
function contrast(a: string, b: string): number {
  const lum = (c: string) => {
    const [r, g, bl] = parseColour(c).slice(0, 3).map((v) => {
      const s = v / 255;
      return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
    });
    return 0.2126 * r + 0.7152 * g + 0.0722 * bl;
  };
  const [hi, lo] = [lum(a), lum(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
}

beforeEach(() => {
  sessionStorage.clear();
  jest.clearAllMocks();
  // mockReset also drops queued *Once values, so a failing test can't leak into the next one.
  mockApiClient.post.mockReset();
  mockUseSessionAuth.mockReturnValue({ isAuthenticated: false, isLoading: false, user: null });
  mockApiClient.post.mockResolvedValue({ data: { reply: 'Test reply', handoff: false } });
});

describe('AssistantPage', () => {
  it('renders the header', () => {
    renderPage();
    expect(screen.getByRole('heading', { name: /RendaSua Assistant/i })).toBeInTheDocument();
  });

  it('composer is a textarea named "message" with autocomplete off and no <form> ancestor', () => {
    renderPage();
    const ta = composer();
    expect(ta.tagName).toBe('TEXTAREA');
    expect(ta.getAttribute('name')).toBe('message');
    expect(ta.getAttribute('autocomplete')).toBe('off');
    expect(ta.closest('form')).toBeNull();
  });

  it('assistant chat sources contain none of the old dark-theme colours', () => {
    const forbidden = ['#050b16', '#00bcd4', '#006978', '#26c6da', 'PAGE_BG'];
    const files = [
      join(__dirname, 'AssistantPage.tsx'),
      join(__dirname, 'AssistantMarkdown.tsx'),
      join(__dirname, '../../contexts/AssistantChatContext.tsx'),
    ];
    for (const file of files) {
      const source = readFileSync(file, 'utf8').toLowerCase();
      for (const token of forbidden) {
        expect({ file, token, found: source.includes(token.toLowerCase()) }).toEqual({
          file,
          token,
          found: false,
        });
      }
    }
  });

  it('renders the page on the light background', () => {
    renderPage();
    const page = screen.getByTestId('assistant-page');
    expect(getComputedStyle(page).backgroundColor).toBe('rgb(250, 249, 247)');
  });

  it('user message bubble uses white text on the primary blue background', async () => {
    renderPage();
    typeAndEnter('Is pickup available?');
    await screen.findByText('Test reply');
    const text = screen.getByText('Is pickup available?');
    const bubble = text.closest('[data-testid="assistant-user-bubble"]') as HTMLElement;
    expect(getComputedStyle(text).color).toBe('rgb(255, 255, 255)');
    expect(getComputedStyle(bubble).backgroundColor).toBe('rgb(10, 79, 181)');
    expect(
      contrast(getComputedStyle(text).color, getComputedStyle(bubble).backgroundColor)
    ).toBeGreaterThanOrEqual(4.5);
  });

  it('keeps the draft on send error: the failed text stays for Retry and new composer text is not wiped', async () => {
    mockApiClient.post.mockRejectedValueOnce({ code: 'ERR_NETWORK', message: 'Network Error' });
    mockApiClient.post.mockResolvedValueOnce({ data: { reply: 'On the way', handoff: false } });
    renderPage();
    typeAndEnter('Where is my order?');
    await screen.findByTestId('assistant-error-banner');
    expect(screen.getByText('Where is my order?')).toBeInTheDocument();

    fireEvent.change(composer(), { target: { value: 'and my refund?' } });
    fireEvent.click(screen.getByRole('button', { name: /retry/i }));
    await screen.findByText('On the way');
    expect(composer().value).toBe('and my refund?');
    expect(screen.getAllByText('Where is my order?')).toHaveLength(1);
    expect(payloads()).toEqual([['Where is my order?'], ['Where is my order?']]);
  });

  it('shows Offline in the header only for network errors', async () => {
    mockApiClient.post.mockRejectedValueOnce({ response: { status: 500, data: {} } });
    renderPage();
    typeAndEnter('q1');
    await screen.findByTestId('assistant-error-banner');
    expect(screen.queryByText(/^(Offline|assistant\.statusOffline)$/)).toBeNull();
    mockApiClient.post.mockRejectedValueOnce({ code: 'ERR_NETWORK' });
    fireEvent.click(screen.getByRole('button', { name: /retry/i }));
    await screen.findByText(/^(Offline|assistant\.statusOffline)$/);
  });

  const NETWORK_COPY = /^(Message not sent\. Check your connection\.|assistant\.errorMessage)$/;
  const SERVER_COPY = /^(Message not sent\. Please try again\.|assistant\.errorServer)$/;

  it.each([
    ['axios network error (ERR_NETWORK)', { code: 'ERR_NETWORK', message: 'Network Error' }],
    ['request that never got a response (offline / timeout)', { message: 'timeout of 0ms exceeded' }],
  ])('network failure shows "Check your connection": %s', async (_label, rejection) => {
    mockApiClient.post.mockRejectedValueOnce(rejection);
    renderPage();
    typeAndEnter('q');
    const banner = await screen.findByTestId('assistant-error-banner');
    expect(banner.getAttribute('data-error-kind')).toBe('network');
    expect(within(banner).getByText(NETWORK_COPY)).toBeInTheDocument();
    expect(within(banner).queryByText(SERVER_COPY)).toBeNull();
  });

  it.each([
    ['500 Internal Server Error', { response: { status: 500, data: { message: 'Internal server error' } } }],
    ['429 Too Many Requests', { response: { status: 429, data: {} } }],
    ['400 API error body', { response: { status: 400, data: { message: 'Bad request' } }, code: 'ERR_BAD_REQUEST' }],
  ])('server error shows "Please try again", not the connection copy: %s', async (_label, rejection) => {
    mockApiClient.post.mockRejectedValueOnce(rejection);
    renderPage();
    typeAndEnter('q');
    const banner = await screen.findByTestId('assistant-error-banner');
    expect(banner.getAttribute('data-error-kind')).toBe('server');
    expect(within(banner).getByText(SERVER_COPY)).toBeInTheDocument();
    expect(within(banner).queryByText(NETWORK_COPY)).toBeNull();
  });

  it('switches the error copy when a retry fails for a different reason', async () => {
    mockApiClient.post.mockRejectedValueOnce({ response: { status: 500, data: {} } });
    mockApiClient.post.mockRejectedValueOnce({ code: 'ERR_NETWORK' });
    renderPage();
    typeAndEnter('q');
    await screen.findByText(SERVER_COPY);
    fireEvent.click(screen.getByRole('button', { name: /retry/i }));
    await screen.findByText(NETWORK_COPY);
    expect(screen.queryByText(SERVER_COPY)).toBeNull();
  });

  it('handoff card is a primary-tint brand surface whose body text meets WCAG AA', async () => {
    mockApiClient.post.mockResolvedValueOnce({ data: { reply: 'Connecting you', handoff: true } });
    renderPage();
    typeAndEnter('human please');
    const card = await screen.findByTestId('assistant-handoff-card');
    const body = screen.getByTestId('assistant-handoff-body');
    const cardStyle = getComputedStyle(card);

    // Surface: primary.main at 6-8% alpha (not the old cyan fill), border primary at ~30% alpha.
    const [r, g, b, a] = parseColour(cardStyle.backgroundColor);
    expect(parseColour(theme.palette.primary.main).slice(0, 3)).toEqual([r, g, b]);
    expect(a).toBeGreaterThanOrEqual(0.06);
    expect(a).toBeLessThanOrEqual(0.08);
    const [br, bg, bb, ba] = parseColour(cardStyle.borderTopColor);
    expect(parseColour(theme.palette.primary.main).slice(0, 3)).toEqual([br, bg, bb]);
    expect(ba).toBeCloseTo(0.3, 2);

    // Contrast is measured on what is actually painted: the tint over the message area background.
    const painted = over(cardStyle.backgroundColor, theme.palette.background.default);
    const ratio = contrast(getComputedStyle(body).color, painted);
    expect(ratio).toBeGreaterThanOrEqual(4.5);

    const whatsapp = card.querySelector('a[href="https://wa.me/18556488855"]') as HTMLElement;
    expect(whatsapp).not.toBeNull();
    expect(whatsapp.className).toMatch(/MuiButton-containedPrimary/);
  });

  it('shows the mini-orb only on the first assistant bubble of a group', () => {
    sessionStorage.setItem(STORAGE_KEY_OWNER, 'guest');
    sessionStorage.setItem(STORAGE_KEY_THREAD_ID, '11111111-1111-4111-8111-111111111111');
    sessionStorage.setItem(
      STORAGE_KEY_MESSAGES,
      JSON.stringify([
        { id: '1', role: 'user', content: 'u1' },
        { id: '2', role: 'assistant', content: 'a1' },
        { id: '3', role: 'assistant', content: 'a2' },
        { id: '4', role: 'user', content: 'u2' },
        { id: '5', role: 'assistant', content: 'a3' },
      ])
    );
    renderPage();
    expect(screen.getAllByTestId('assistant-reply-bubble')).toHaveLength(3);
    expect(screen.getAllByTestId('assistant-mini-orb')).toHaveLength(2);
  });

  it('Start over rotates the thread and clears the conversation', async () => {
    renderPage();
    typeAndEnter('hello');
    await screen.findByText('Test reply');
    const before = sessionStorage.getItem(STORAGE_KEY_THREAD_ID);
    fireEvent.click(screen.getByRole('button', { name: /start over|startOver/i }));
    await waitFor(() => expect(screen.queryByText('hello')).toBeNull());
    expect(sessionStorage.getItem(STORAGE_KEY_THREAD_ID)).not.toBe(before);
  });

  it('does not send or clear the composer while auth is still loading', () => {
    mockUseSessionAuth.mockReturnValue({ isAuthenticated: false, isLoading: true, user: null });
    renderPage();
    expect(composer().disabled).toBe(true);
    expect(mockApiClient.post).not.toHaveBeenCalled();
  });
});
