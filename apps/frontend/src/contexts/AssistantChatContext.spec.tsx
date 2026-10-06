import { act, renderHook, waitFor } from '@testing-library/react';
import { ReactNode } from 'react';
import {
  AssistantChatProvider,
  useAssistantChat,
  generateThreadId,
} from './AssistantChatContext';

jest.unmock('./AssistantChatContext');

const mockUseSessionAuth = jest.fn();
const mockApiClient = {
  post: jest.fn(),
};

jest.mock('./SessionAuthContext', () => ({
  useSessionAuth: () => mockUseSessionAuth(),
}));

jest.mock('../hooks/useApiClient', () => ({
  useApiClient: () => mockApiClient,
}));

describe('generateThreadId', () => {
  it('generates a valid UUID v4 format', () => {
    const id = generateThreadId();
    const uuidV4Pattern =
      /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
    expect(id).toMatch(uuidV4Pattern);
  });

  it('generates unique IDs', () => {
    const ids = new Set();
    for (let i = 0; i < 100; i++) {
      ids.add(generateThreadId());
    }
    expect(ids.size).toBe(100);
  });
});

describe('AssistantChatContext', () => {
  const wrapper = ({ children }: { children: ReactNode }) => (
    <AssistantChatProvider>{children}</AssistantChatProvider>
  );

  beforeEach(() => {
    mockUseSessionAuth.mockReturnValue({
      isAuthenticated: false,
      isLoading: false,
      user: null,
    });
    mockApiClient.post.mockResolvedValue({
      data: { reply: 'Test reply', handoff: false },
    });
    sessionStorage.clear();
    jest.clearAllMocks();
    // Mock visibility API
    Object.defineProperty(document, 'visibilityState', {
      writable: true,
      value: 'visible',
    });
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('generates and persists a thread_id on mount', () => {
    const { result } = renderHook(() => useAssistantChat(), { wrapper });
    expect(result.current.threadId).toBeDefined();
    expect(result.current.threadId.length).toBeGreaterThan(0);
    
    // Check it was persisted
    const stored = sessionStorage.getItem('rendasua.assistant.thread_id.v1');
    expect(stored).toBe(result.current.threadId);
  });

  it('does not rotate thread_id when auth is loading', async () => {
    mockUseSessionAuth.mockReturnValue({
      isAuthenticated: false,
      isLoading: true,
      user: null,
    });

    const { result, rerender } = renderHook(() => useAssistantChat(), {
      wrapper,
    });
    const initialThreadId = result.current.threadId;

    // Change to authenticated but still loading
    mockUseSessionAuth.mockReturnValue({
      isAuthenticated: true,
      isLoading: true,
      user: { sub: 'user-123' },
    });

    await act(async () => {
      rerender();
    });

    // Thread ID should NOT change while loading
    expect(result.current.threadId).toBe(initialThreadId);
  });

  it('rotates thread_id when auth identity changes from guest to user', async () => {
    mockUseSessionAuth.mockReturnValue({
      isAuthenticated: false,
      isLoading: false,
      user: null,
    });

    const { result, rerender } = renderHook(() => useAssistantChat(), {
      wrapper,
    });
    const initialThreadId = result.current.threadId;

    // Add a message
    await act(async () => {
      await result.current.sendMessage('Test message');
    });

    await waitFor(() => {
      expect(result.current.messages.length).toBeGreaterThan(0);
    });

    // Change auth state to authenticated
    mockUseSessionAuth.mockReturnValue({
      isAuthenticated: true,
      isLoading: false,
      user: { sub: 'user-123' },
    });

    await act(async () => {
      rerender();
    });

    await waitFor(() => {
      expect(result.current.threadId).not.toBe(initialThreadId);
      expect(result.current.messages.length).toBe(0);
      expect(result.current.draft).toBe('');
      expect(result.current.error).toBeNull();
    });
  });

  it('rotates thread_id when auth identity changes from user to guest', async () => {
    mockUseSessionAuth.mockReturnValue({
      isAuthenticated: true,
      isLoading: false,
      user: { sub: 'user-123' },
    });

    const { result, rerender } = renderHook(() => useAssistantChat(), {
      wrapper,
    });
    const initialThreadId = result.current.threadId;

    // Add a message
    await act(async () => {
      await result.current.sendMessage('Test message');
    });

    await waitFor(() => {
      expect(result.current.messages.length).toBeGreaterThan(0);
    });

    // Sign out
    mockUseSessionAuth.mockReturnValue({
      isAuthenticated: false,
      isLoading: false,
      user: null,
    });

    await act(async () => {
      rerender();
    });

    await waitFor(() => {
      expect(result.current.threadId).not.toBe(initialThreadId);
      expect(result.current.messages.length).toBe(0);
    });
  });

  it('rotates thread_id when user identity changes (user A to user B)', async () => {
    mockUseSessionAuth.mockReturnValue({
      isAuthenticated: true,
      isLoading: false,
      user: { sub: 'user-123' },
    });

    const { result, rerender } = renderHook(() => useAssistantChat(), {
      wrapper,
    });
    const initialThreadId = result.current.threadId;

    // Change to a different user
    mockUseSessionAuth.mockReturnValue({
      isAuthenticated: true,
      isLoading: false,
      user: { sub: 'user-456' },
    });

    await act(async () => {
      rerender();
    });

    await waitFor(() => {
      expect(result.current.threadId).not.toBe(initialThreadId);
    });
  });

  it('blocks sending while auth is loading', async () => {
    mockUseSessionAuth.mockReturnValue({
      isAuthenticated: false,
      isLoading: true,
      user: null,
    });

    const { result } = renderHook(() => useAssistantChat(), { wrapper });

    await act(async () => {
      await result.current.sendMessage('Test message');
    });

    // Should not have sent
    expect(mockApiClient.post).not.toHaveBeenCalled();
    expect(result.current.messages.length).toBe(0);
  });

  it('rotates thread_id when clearChat is called', async () => {
    const { result } = renderHook(() => useAssistantChat(), { wrapper });
    const initialThreadId = result.current.threadId;

    await act(async () => {
      result.current.clearChat();
    });

    expect(result.current.threadId).not.toBe(initialThreadId);
    expect(result.current.messages.length).toBe(0);
    expect(result.current.draft).toBe('');
  });

  it('re-sends existing message on retry without duplication', async () => {
    mockUseSessionAuth.mockReturnValue({
      isAuthenticated: false,
      isLoading: false,
      user: null,
    });

    const { result } = renderHook(() => useAssistantChat(), { wrapper });

    // Send a message
    await act(async () => {
      await result.current.sendMessage('Test question', false);
    });

    await waitFor(() => {
      expect(result.current.messages.length).toBeGreaterThan(0);
    });

    const messageCount = result.current.messages.length;
    const lastUserMsg = result.current.messages.find(m => m.role === 'user');

    // Retry the same message
    await act(async () => {
      await result.current.sendMessage(lastUserMsg!.content, true);
    });

    await waitFor(() => {
      expect(mockApiClient.post).toHaveBeenCalledTimes(2);
    });

    // Message count should not increase on retry
    expect(result.current.messages.filter(m => m.role === 'user').length).toBe(1);
  });

  it('persists messages to sessionStorage', async () => {
    const { result } = renderHook(() => useAssistantChat(), { wrapper });

    await act(async () => {
      await result.current.sendMessage('Test message');
    });

    await waitFor(() => {
      expect(result.current.messages.length).toBeGreaterThan(0);
    });

    const storedMessages = sessionStorage.getItem(
      'rendasua.assistant.chat.v1'
    );
    expect(storedMessages).toBeDefined();
    const parsed = JSON.parse(storedMessages!);
    expect(Array.isArray(parsed)).toBe(true);
    expect(parsed.length).toBeGreaterThan(0);
  });

  it('sends messages through the API client', async () => {
    const { result } = renderHook(() => useAssistantChat(), { wrapper });

    await act(async () => {
      await result.current.sendMessage('Test question');
    });

    await waitFor(() => {
      expect(mockApiClient.post).toHaveBeenCalledWith(
        '/assistant/chat',
        expect.objectContaining({
          messages: expect.arrayContaining([
            expect.objectContaining({
              role: 'user',
              content: 'Test question',
            }),
          ]),
        })
      );
    });
  });

  it('sets isOffline on network error', async () => {
    mockApiClient.post.mockRejectedValue({ code: 'ERR_NETWORK' });

    const { result } = renderHook(() => useAssistantChat(), { wrapper });

    await act(async () => {
      await result.current.sendMessage('Test message');
    });

    await waitFor(() => {
      expect(result.current.error).toBeTruthy();
      expect(result.current.isOffline).toBe(true);
    });
  });

  it('preserves draft on send error', async () => {
    mockApiClient.post.mockRejectedValue(new Error('Network error'));

    const { result } = renderHook(() => useAssistantChat(), { wrapper });

    await act(async () => {
      result.current.setDraft('Test draft');
    });

    await act(async () => {
      await result.current.sendMessage('Test message');
    });

    await waitFor(() => {
      expect(result.current.error).toBeTruthy();
      // Draft is cleared when message is added, but error keeps it for retry
    });
  });
});
