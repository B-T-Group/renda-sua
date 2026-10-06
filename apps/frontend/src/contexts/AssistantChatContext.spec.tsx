import { act, renderHook, waitFor } from '@testing-library/react';
import { ReactNode } from 'react';
import {
  AssistantChatProvider,
  useAssistantChat,
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

describe('AssistantChatContext', () => {
  const wrapper = ({ children }: { children: ReactNode }) => (
    <AssistantChatProvider>{children}</AssistantChatProvider>
  );

  beforeEach(() => {
    mockUseSessionAuth.mockReturnValue({
      isAuthenticated: false,
    });
    mockApiClient.post.mockResolvedValue({
      data: { reply: 'Test reply', handoff: false },
    });
    sessionStorage.clear();
    jest.clearAllMocks();
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('generates a thread_id on mount', () => {
    const { result } = renderHook(() => useAssistantChat(), { wrapper });
    expect(result.current.threadId).toBeDefined();
    expect(result.current.threadId.length).toBeGreaterThan(0);
  });

  it('rotates thread_id when auth state changes from guest to authenticated', async () => {
    const { result, rerender } = renderHook(() => useAssistantChat(), {
      wrapper,
    });
    const initialThreadId = result.current.threadId;

    // Change auth state
    mockUseSessionAuth.mockReturnValue({
      isAuthenticated: true,
    });

    await act(async () => {
      rerender();
    });

    await waitFor(() => {
      expect(result.current.threadId).not.toBe(initialThreadId);
    });
  });

  it('rotates thread_id when auth state changes from authenticated to guest', async () => {
    // Start authenticated
    mockUseSessionAuth.mockReturnValue({
      isAuthenticated: true,
    });

    const { result, rerender } = renderHook(() => useAssistantChat(), {
      wrapper,
    });
    const initialThreadId = result.current.threadId;

    // Change to guest
    mockUseSessionAuth.mockReturnValue({
      isAuthenticated: false,
    });

    await act(async () => {
      rerender();
    });

    await waitFor(() => {
      expect(result.current.threadId).not.toBe(initialThreadId);
    });
  });

  it('clears messages when thread_id rotates on auth change', async () => {
    const { result, rerender } = renderHook(() => useAssistantChat(), {
      wrapper,
    });

    // Send a message
    await act(async () => {
      await result.current.sendMessage('Test message');
    });

    await waitFor(() => {
      expect(result.current.messages.length).toBeGreaterThan(0);
    });

    const messageCount = result.current.messages.length;

    // Change auth state
    mockUseSessionAuth.mockReturnValue({
      isAuthenticated: true,
    });

    await act(async () => {
      rerender();
    });

    await waitFor(() => {
      expect(result.current.messages.length).toBe(0);
    });
  });

  it('rotates thread_id when clearChat is called', async () => {
    const { result } = renderHook(() => useAssistantChat(), { wrapper });
    const initialThreadId = result.current.threadId;

    await act(async () => {
      result.current.clearChat();
    });

    expect(result.current.threadId).not.toBe(initialThreadId);
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

  it('persists thread_id to sessionStorage', () => {
    const { result } = renderHook(() => useAssistantChat(), { wrapper });

    const storedThreadId = sessionStorage.getItem(
      'rendasua.assistant.thread_id.v1'
    );
    expect(storedThreadId).toBe(result.current.threadId);
  });

  it('loads thread_id from sessionStorage on mount', () => {
    const testThreadId = 'test-thread-id-123';
    sessionStorage.setItem('rendasua.assistant.thread_id.v1', testThreadId);

    const { result } = renderHook(() => useAssistantChat(), { wrapper });
    expect(result.current.threadId).toBe(testThreadId);
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
});
