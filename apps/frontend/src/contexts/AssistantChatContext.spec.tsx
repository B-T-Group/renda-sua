import { act, render, renderHook } from '@testing-library/react';
import { Fragment, ReactNode, StrictMode } from 'react';
import {
  AssistantChatProvider,
  assistantOwnerKey,
  clearAssistantChatStorage,
  generateThreadId,
  IDLE_TIMEOUT_MS,
  STORAGE_KEY_LAST_ACTIVITY,
  STORAGE_KEY_MESSAGES,
  STORAGE_KEY_OWNER,
  STORAGE_KEY_PENDING,
  STORAGE_KEY_THREAD_ID,
  useAssistantChat,
} from './AssistantChatContext';

jest.unmock('./AssistantChatContext');

const mockUseSessionAuth = jest.fn();
const mockApiClient = { post: jest.fn() };

jest.mock('./SessionAuthContext', () => ({
  useSessionAuth: () => mockUseSessionAuth(),
}));
jest.mock('../hooks/useApiClient', () => ({
  useApiClient: () => mockApiClient,
}));

const V4 =
  /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;
const GUEST = { isAuthenticated: false, isLoading: false, user: null };
const LOADING = { isAuthenticated: false, isLoading: true, user: null };
const USER_A = {
  isAuthenticated: true,
  isLoading: false,
  user: { sub: 'auth0|alice@example.com' },
};
const USER_B = {
  isAuthenticated: true,
  isLoading: false,
  user: { sub: 'auth0|bob' },
};
/** Signed in, but no user/sub decoded yet (e.g. a refresh that returned no id_token). */
const SIGNED_IN_NO_SUB = { isAuthenticated: true, isLoading: false, user: undefined };

const wrapper = ({ children }: { children: ReactNode }) => (
  <AssistantChatProvider>{children}</AssistantChatProvider>
);
const realCrypto = globalThis.crypto;
function setCrypto(value: unknown) {
  Object.defineProperty(globalThis, 'crypto', {
    value,
    configurable: true,
    writable: true,
  });
}
/** Contents of every /assistant/chat payload, in call order. */
const payloads = () =>
  mockApiClient.post.mock.calls.map((call) =>
    call[1].messages.map((m: { content: string }) => m.content)
  );
const contents = (h: { result: { current: { messages: { content: string }[] } } }) =>
  h.result.current.messages.map((m) => m.content);

function deferred<T>() {
  let resolve!: (v: T) => void;
  let reject!: (e: unknown) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

/** Mounts the provider as `auth` and sends each text (each gets an OK reply). */
async function chatAs(auth: object, texts: string[] = []) {
  mockUseSessionAuth.mockReturnValue(auth);
  const h = renderHook(() => useAssistantChat(), { wrapper });
  for (const text of texts) {
    await act(async () => {
      await h.result.current.sendMessage(text);
    });
  }
  return h;
}

let replyCount = 0;
beforeEach(() => {
  sessionStorage.clear();
  jest.clearAllMocks();
  mockApiClient.post.mockReset(); // drop queued *Once values so failures can't cascade
  replyCount = 0;
  mockUseSessionAuth.mockReturnValue(GUEST);
  mockApiClient.post.mockImplementation(async () => ({
    data: { reply: `reply ${++replyCount}`, handoff: false },
  }));
  Object.defineProperty(document, 'visibilityState', {
    configurable: true,
    value: 'visible',
  });
});

afterEach(() => {
  setCrypto(realCrypto);
  jest.restoreAllMocks();
});

describe('generateThreadId', () => {
  const nodeCrypto = jest.requireActual('crypto') as typeof import('crypto');
  const fill = (a: Uint8Array) => nodeCrypto.randomFillSync(a);

  it('uses crypto.randomUUID when available', () => {
    setCrypto({
      randomUUID: () => '11111111-1111-4111-8111-111111111111',
      getRandomValues: fill,
    });
    expect(generateThreadId()).toBe('11111111-1111-4111-8111-111111111111');
  });

  it('builds a valid v4 from getRandomValues when randomUUID is missing', () => {
    setCrypto({ getRandomValues: fill });
    const ids = new Set<string>();
    for (let i = 0; i < 2000; i++) {
      const id = generateThreadId();
      expect(id).toMatch(V4);
      ids.add(id);
    }
    expect(ids.size).toBe(2000);
    setCrypto({ getRandomValues: (a: Uint8Array) => a.fill(0) });
    expect(generateThreadId()).toMatch(V4);
    setCrypto({ getRandomValues: (a: Uint8Array) => a.fill(255) });
    expect(generateThreadId()).toMatch(V4);
  });

  it('falls back when randomUUID throws (insecure context)', () => {
    setCrypto({
      randomUUID: () => {
        throw new Error('insecure');
      },
      getRandomValues: fill,
    });
    expect(generateThreadId()).toMatch(V4);
  });

  it('falls back to Math.random without any crypto', () => {
    setCrypto(undefined);
    for (let i = 0; i < 2000; i++) expect(generateThreadId()).toMatch(V4);
  });
});

describe('assistantOwnerKey', () => {
  it('is "guest" when signed out, unknown (null) when signed in without a sub, and an opaque hash otherwise', () => {
    expect(assistantOwnerKey(false, 'auth0|x')).toBe('guest');
    expect(assistantOwnerKey(false, undefined)).toBe('guest');
    expect(assistantOwnerKey(true, undefined)).toBeNull();
    expect(assistantOwnerKey(true, '')).toBeNull();
    const a = assistantOwnerKey(true, 'auth0|alice@example.com');
    expect(a).toMatch(/^u:[0-9a-f]{14}$/);
    expect(a).not.toContain('alice');
    expect(assistantOwnerKey(true, 'auth0|alice@example.com')).toBe(a);
    expect(assistantOwnerKey(true, 'auth0|bob')).not.toBe(a);
  });
});

describe('AssistantChatProvider: thread ownership', () => {
  it('persists a v4 thread id and an opaque owner on first mount, without raw PII', async () => {
    const h = await chatAs(USER_A);
    expect(h.result.current.ready).toBe(true);
    expect(h.result.current.threadId).toMatch(V4);
    expect(sessionStorage.getItem(STORAGE_KEY_THREAD_ID)).toBe(
      h.result.current.threadId
    );
    expect(sessionStorage.getItem(STORAGE_KEY_OWNER)).toBe(
      assistantOwnerKey(true, USER_A.user.sub)
    );
    const everything = JSON.stringify({ ...sessionStorage });
    expect(everything).not.toContain('alice');
    expect(everything).not.toContain('auth0|');
  });

  it('works without crypto.randomUUID', async () => {
    const nodeCrypto = jest.requireActual('crypto') as typeof import('crypto');
    setCrypto({ getRandomValues: (a: Uint8Array) => nodeCrypto.randomFillSync(a) });
    const h = await chatAs(GUEST, ['hello']);
    expect(h.result.current.threadId).toMatch(V4);
    expect(contents(h)).toEqual(['hello', 'reply 1']);
  });

  it('keeps the chat and thread across a remount for the same signed-in user', async () => {
    const first = await chatAs(USER_A, ['A1', 'A2']);
    const thread = first.result.current.threadId;
    first.unmount();
    const second = await chatAs(USER_A);
    expect(contents(second)).toEqual(['A1', 'reply 1', 'A2', 'reply 2']);
    expect(second.result.current.threadId).toBe(thread);
  });

  it.each([
    ['guest -> user A (sign-in)', GUEST, USER_A],
    ['user A -> guest (sign-out)', USER_A, GUEST],
    ['user A -> user B (account switch)', USER_A, USER_B],
  ])('rotates on remount with a different identity: %s', async (_label, from, to) => {
    const first = await chatAs(from, ['private 1', 'private 2']);
    const thread = first.result.current.threadId;
    first.unmount();

    const second = await chatAs(to);
    expect(second.result.current.threadId).not.toBe(thread);
    expect(second.result.current.threadId).toMatch(V4);
    expect(second.result.current.messages).toEqual([]);
    expect(sessionStorage.getItem(STORAGE_KEY_MESSAGES)).toBe('[]');

    await act(async () => {
      await second.result.current.sendMessage('first as new identity');
    });
    expect(payloads().at(-1)).toEqual(['first as new identity']);
  });

  it('rotates when the provider is rebuilt by a wrapper that swaps on auth (ApolloProvider pattern)', async () => {
    // ApolloProvider renders <Base>{children}</Base> when signed in and <>{children}</> when not,
    // so the whole app (and this provider) remounts on every sign-in and sign-out.
    const Base = ({ children }: { children: ReactNode }) => <div>{children}</div>;
    let api: ReturnType<typeof useAssistantChat> | null = null;
    const Probe = () => {
      api = useAssistantChat();
      return null;
    };
    const chat = () => {
      if (!api) throw new Error('provider not mounted');
      return api;
    };
    const Tree = ({ signedIn }: { signedIn: boolean }) => {
      const Wrap = signedIn ? Base : Fragment;
      return (
        <Wrap>
          <AssistantChatProvider>
            <Probe />
          </AssistantChatProvider>
        </Wrap>
      );
    };

    mockUseSessionAuth.mockReturnValue(GUEST);
    const view = render(<Tree signedIn={false} />);
    await act(async () => {
      await chat().sendMessage('guest secret');
    });
    const guestThread = chat().threadId;

    mockUseSessionAuth.mockReturnValue(USER_A);
    view.rerender(<Tree signedIn />);
    expect(chat().messages).toEqual([]);
    expect(chat().threadId).not.toBe(guestThread);
    await act(async () => {
      await chat().sendMessage('first as A');
    });
    expect(payloads().at(-1)).toEqual(['first as A']);

    mockUseSessionAuth.mockReturnValue(GUEST);
    view.rerender(<Tree signedIn={false} />);
    expect(chat().messages).toEqual([]);
  });

  it('rotates on an in-session identity change and clears messages, draft and error', async () => {
    mockApiClient.post.mockRejectedValueOnce({ code: 'ERR_NETWORK' });
    const h = await chatAs(GUEST, ['guest q']);
    await act(async () => {
      h.result.current.setDraft('half typed');
    });
    expect(h.result.current.error).toBeTruthy();
    const thread = h.result.current.threadId;

    mockUseSessionAuth.mockReturnValue(USER_A);
    await act(async () => {
      h.rerender();
    });
    expect(h.result.current.threadId).not.toBe(thread);
    expect(h.result.current.messages).toEqual([]);
    expect(h.result.current.draft).toBe('');
    expect(h.result.current.error).toBeNull();
    expect(h.result.current.isOffline).toBe(false);

    mockUseSessionAuth.mockReturnValue(USER_B);
    await act(async () => {
      h.rerender();
    });
    expect(sessionStorage.getItem(STORAGE_KEY_OWNER)).toBe(
      assistantOwnerKey(true, USER_B.user.sub)
    );
  });

  it('neither restores nor sends until auth has settled, then checks ownership', async () => {
    const guest = await chatAs(GUEST, ['guest secret']);
    guest.unmount();

    mockUseSessionAuth.mockReturnValue(LOADING);
    const h = renderHook(() => useAssistantChat(), { wrapper });
    expect(h.result.current.ready).toBe(false);
    expect(h.result.current.messages).toEqual([]);
    let sent = true;
    await act(async () => {
      sent = await h.result.current.sendMessage('too early');
    });
    expect(sent).toBe(false);
    expect(mockApiClient.post).toHaveBeenCalledTimes(1);

    mockUseSessionAuth.mockReturnValue(USER_A);
    await act(async () => {
      h.rerender();
    });
    expect(h.result.current.ready).toBe(true);
    expect(h.result.current.messages).toEqual([]);
  });

  it('restores after auth settles when the owner matches', async () => {
    const first = await chatAs(GUEST, ['mine']);
    first.unmount();
    mockUseSessionAuth.mockReturnValue(LOADING);
    const h = renderHook(() => useAssistantChat(), { wrapper });
    expect(h.result.current.messages).toEqual([]);
    mockUseSessionAuth.mockReturnValue(GUEST);
    await act(async () => {
      h.rerender();
    });
    expect(contents(h)).toEqual(['mine', 'reply 1']);
  });

  it('discards a stored thread that has no owner marker (data from an older build)', async () => {
    sessionStorage.setItem(STORAGE_KEY_THREAD_ID, '11111111-1111-4111-8111-111111111111');
    sessionStorage.setItem(
      STORAGE_KEY_MESSAGES,
      JSON.stringify([{ id: '1', role: 'user', content: 'legacy' }])
    );
    const h = await chatAs(USER_A);
    expect(h.result.current.messages).toEqual([]);
    expect(h.result.current.threadId).not.toBe('11111111-1111-4111-8111-111111111111');
  });

  it('is stable under StrictMode double effects', async () => {
    const strictWrapper = ({ children }: { children: ReactNode }) => (
      <StrictMode>
        <AssistantChatProvider>{children}</AssistantChatProvider>
      </StrictMode>
    );
    const first = await chatAs(GUEST, ['kept']);
    first.unmount();
    const h = renderHook(() => useAssistantChat(), { wrapper: strictWrapper });
    expect(contents(h)).toEqual(['kept', 'reply 1']);
  });
});

describe('AssistantChatProvider: idle rotation', () => {
  let now = 1_800_000_000_000;
  beforeEach(() => {
    now = 1_800_000_000_000;
    jest.spyOn(Date, 'now').mockImplementation(() => now);
  });

  it('rotates on send after 30+ min idle, even with no focus/visibility event', async () => {
    const h = await chatAs(GUEST, ['before idle']);
    const thread = h.result.current.threadId;
    now += IDLE_TIMEOUT_MS + 60_000;
    await act(async () => {
      await h.result.current.sendMessage('after idle');
    });
    expect(h.result.current.threadId).not.toBe(thread);
    expect(payloads().at(-1)).toEqual(['after idle']);
    expect(contents(h)).toEqual(['after idle', 'reply 2']);
  });

  it('does not rotate on send within 30 min', async () => {
    const h = await chatAs(GUEST, ['one']);
    now += 29 * 60_000;
    await act(async () => {
      await h.result.current.sendMessage('two');
    });
    expect(payloads().at(-1)).toEqual(['one', 'reply 1', 'two']);
  });

  it('rotates on window focus after idle', async () => {
    const h = await chatAs(GUEST, ['x']);
    now += IDLE_TIMEOUT_MS + 1;
    await act(async () => {
      window.dispatchEvent(new Event('focus'));
    });
    expect(h.result.current.messages).toEqual([]);
  });

  it('rotates on visibilitychange to visible after idle', async () => {
    const h = await chatAs(GUEST, ['x']);
    now += IDLE_TIMEOUT_MS + 1;
    await act(async () => {
      document.dispatchEvent(new Event('visibilitychange'));
    });
    expect(h.result.current.messages).toEqual([]);
  });

  it('rotates on remount after idle', async () => {
    const h = await chatAs(GUEST, ['x']);
    h.unmount();
    now += IDLE_TIMEOUT_MS + 1;
    const again = await chatAs(GUEST);
    expect(again.result.current.messages).toEqual([]);
  });

  it('does not rotate on focus within 30 min', async () => {
    const h = await chatAs(GUEST, ['x']);
    now += 20 * 60_000;
    await act(async () => {
      window.dispatchEvent(new Event('focus'));
    });
    expect(h.result.current.messages).toHaveLength(2);
    expect(sessionStorage.getItem(STORAGE_KEY_LAST_ACTIVITY)).toBe(
      String(now - 20 * 60_000)
    );
  });
});

describe('AssistantChatProvider: in-flight requests across rotation', () => {
  it('drops a reply whose request belonged to the previous identity, and resets sending', async () => {
    const pending = deferred<{ data: { reply: string; handoff: boolean } }>();
    mockApiClient.post.mockImplementationOnce(() => pending.promise);
    const h = await chatAs(GUEST);
    act(() => {
      void h.result.current.sendMessage('guest q');
    });
    expect(h.result.current.isSending).toBe(true);

    mockUseSessionAuth.mockReturnValue(USER_A);
    await act(async () => {
      h.rerender();
    });
    expect(h.result.current.isSending).toBe(false);

    await act(async () => {
      pending.resolve({ data: { reply: 'GUEST REPLY', handoff: true } });
    });
    expect(h.result.current.messages).toEqual([]);
    expect(h.result.current.handoff).toBe(false);
    expect(h.result.current.isSending).toBe(false);
  });

  it('drops an error whose request belonged to a thread cleared by Start over', async () => {
    const pending = deferred<never>();
    mockApiClient.post.mockImplementationOnce(() => pending.promise);
    const h = await chatAs(GUEST);
    act(() => {
      void h.result.current.sendMessage('q');
    });
    await act(async () => {
      h.result.current.clearChat();
    });
    expect(h.result.current.isSending).toBe(false);
    await act(async () => {
      pending.reject({ code: 'ERR_NETWORK' });
    });
    expect(h.result.current.error).toBeNull();
    expect(h.result.current.isOffline).toBe(false);
    // A new send works straight away on the new thread.
    await act(async () => {
      await h.result.current.sendMessage('fresh');
    });
    expect(payloads().at(-1)).toEqual(['fresh']);
  });
});

describe('AssistantChatProvider: requests across provider unmount/remount (QA B1)', () => {
  type Reply = { data: { reply: string; handoff: boolean } };
  const signalOf = (call: number) =>
    (mockApiClient.post.mock.calls[call][2] as { signal?: AbortSignal } | undefined)?.signal;

  it('a guest reply pending across unmount -> remount as A is never written, and A sends only A (QA repro R1)', async () => {
    const pending = deferred<Reply>();
    mockApiClient.post.mockImplementationOnce(() => pending.promise);
    mockUseSessionAuth.mockReturnValue(GUEST);
    const guest = renderHook(() => useAssistantChat(), { wrapper });
    act(() => {
      void guest.result.current.sendMessage('GUEST SECRET');
    });
    // OTP sign-in batched with navigate('/app'): App shows LoadingPage, the provider unmounts.
    guest.unmount();
    expect(signalOf(0)?.aborted).toBe(true);

    mockUseSessionAuth.mockReturnValue(USER_A);
    const a1 = renderHook(() => useAssistantChat(), { wrapper });
    expect(a1.result.current.messages).toEqual([]);
    const aThread = sessionStorage.getItem(STORAGE_KEY_THREAD_ID);
    const aOwner = assistantOwnerKey(true, USER_A.user.sub);
    expect(sessionStorage.getItem(STORAGE_KEY_OWNER)).toBe(aOwner);
    const storedBefore = sessionStorage.getItem(STORAGE_KEY_MESSAGES);
    const activityBefore = sessionStorage.getItem(STORAGE_KEY_LAST_ACTIVITY);

    // The guest reply lands late (the mock ignores the abort signal, like a reply already in flight).
    await act(async () => {
      pending.resolve({ data: { reply: 'GUEST REPLY', handoff: true } });
    });
    expect(sessionStorage.getItem(STORAGE_KEY_MESSAGES)).toBe(storedBefore);
    expect(sessionStorage.getItem(STORAGE_KEY_LAST_ACTIVITY)).toBe(activityBefore);
    expect(sessionStorage.getItem(STORAGE_KEY_THREAD_ID)).toBe(aThread);
    expect(sessionStorage.getItem(STORAGE_KEY_OWNER)).toBe(aOwner);
    expect(a1.result.current.messages).toEqual([]);
    expect(a1.result.current.handoff).toBe(false);
    a1.unmount();

    // Any later remount as A (reload, /app) restores nothing from the guest.
    const a2 = renderHook(() => useAssistantChat(), { wrapper });
    expect(a2.result.current.messages).toEqual([]);
    await act(async () => {
      await a2.result.current.sendMessage('first as A');
    });
    expect(payloads().at(-1)).toEqual(['first as A']);
    // Every request after the guest's own one carries no guest content.
    expect(JSON.stringify(payloads().slice(1))).not.toContain('GUEST');
  });

  it('unmount orphans the request: a reply after remount as the same owner is not written by the dead instance', async () => {
    const pending = deferred<Reply>();
    mockApiClient.post.mockImplementationOnce(() => pending.promise);
    const first = await chatAs(USER_A);
    act(() => {
      void first.result.current.sendMessage('q while navigating');
    });
    first.unmount();
    expect(signalOf(0)?.aborted).toBe(true);

    const second = renderHook(() => useAssistantChat(), { wrapper });
    const storedBefore = sessionStorage.getItem(STORAGE_KEY_MESSAGES);
    await act(async () => {
      pending.resolve({ data: { reply: 'LATE REPLY', handoff: false } });
    });
    expect(sessionStorage.getItem(STORAGE_KEY_MESSAGES)).toBe(storedBefore);
    expect(sessionStorage.getItem(STORAGE_KEY_MESSAGES)).not.toContain('LATE REPLY');
    expect(contents(second)).toEqual(['q while navigating']);
  });

  it('checks storage at response time: a reply is dropped if the stored thread was cleared mid-request (e.g. logout)', async () => {
    const pending = deferred<Reply>();
    mockApiClient.post.mockImplementationOnce(() => pending.promise);
    const h = await chatAs(USER_A);
    act(() => {
      void h.result.current.sendMessage('my order address?');
    });
    // Same instance stays mounted; storage changes underneath it.
    clearAssistantChatStorage();
    await act(async () => {
      pending.resolve({ data: { reply: 'Your address is 1 Main St', handoff: true } });
    });
    expect(sessionStorage.getItem(STORAGE_KEY_MESSAGES)).toBeNull();
    expect(sessionStorage.getItem(STORAGE_KEY_LAST_ACTIVITY)).toBeNull();
    expect(contents(h)).toEqual(['my order address?']);
    expect(h.result.current.handoff).toBe(false);
    expect(h.result.current.isSending).toBe(false);
  });

  it('checks the stored owner at response time: a reply is dropped if storage now belongs to someone else', async () => {
    const pending = deferred<Reply>();
    mockApiClient.post.mockImplementationOnce(() => pending.promise);
    const h = await chatAs(USER_A);
    act(() => {
      void h.result.current.sendMessage('q');
    });
    sessionStorage.setItem(STORAGE_KEY_OWNER, assistantOwnerKey(true, USER_B.user.sub) as string);
    await act(async () => {
      pending.resolve({ data: { reply: 'A REPLY', handoff: false } });
    });
    expect(sessionStorage.getItem(STORAGE_KEY_MESSAGES)).not.toContain('A REPLY');
    expect(contents(h)).toEqual(['q']);
  });

  it('passes an abort signal and aborts it on Start over', async () => {
    const pending = deferred<Reply>();
    mockApiClient.post.mockImplementationOnce(() => pending.promise);
    const h = await chatAs(GUEST);
    act(() => {
      void h.result.current.sendMessage('q');
    });
    const signal = signalOf(0);
    expect(signal).toBeDefined();
    expect(signal?.aborted).toBe(false);
    await act(async () => {
      h.result.current.clearChat();
    });
    expect(signal?.aborted).toBe(true);
  });
});

describe('AssistantChatProvider: signed in without a sub (QA N1)', () => {
  it('stays locked: no restore, no send, nothing written', async () => {
    const guest = await chatAs(GUEST, ['GUEST SECRET']);
    guest.unmount();
    const before = { ...sessionStorage };
    mockApiClient.post.mockClear();

    mockUseSessionAuth.mockReturnValue(SIGNED_IN_NO_SUB);
    const h = renderHook(() => useAssistantChat(), { wrapper });
    expect(h.result.current.ready).toBe(false);
    expect(h.result.current.messages).toEqual([]);
    let sent = true;
    await act(async () => {
      sent = await h.result.current.sendMessage('as signed-in');
    });
    expect(sent).toBe(false);
    expect(mockApiClient.post).not.toHaveBeenCalled();
    expect({ ...sessionStorage }).toEqual(before);
  });

  it('in session: guest -> signed-in-without-sub locks the chat, then the real sub rotates (QA repro R2)', async () => {
    const h = await chatAs(GUEST, ['GUEST SECRET']);
    mockUseSessionAuth.mockReturnValue(SIGNED_IN_NO_SUB);
    await act(async () => {
      h.rerender();
    });
    expect(h.result.current.ready).toBe(false);
    let sent = true;
    await act(async () => {
      sent = await h.result.current.sendMessage('as signed-in');
    });
    expect(sent).toBe(false);
    expect(payloads()).toEqual([['GUEST SECRET']]);

    mockUseSessionAuth.mockReturnValue(USER_A);
    await act(async () => {
      h.rerender();
    });
    expect(h.result.current.ready).toBe(true);
    expect(h.result.current.messages).toEqual([]);
    await act(async () => {
      await h.result.current.sendMessage('as A');
    });
    expect(payloads().at(-1)).toEqual(['as A']);
  });
});

describe('AssistantChatProvider: back/forward cache restore (QA N3)', () => {
  const pageshow = (persisted: boolean) => {
    const e = new Event('pageshow');
    Object.defineProperty(e, 'persisted', { value: persisted });
    window.dispatchEvent(e);
  };

  it('drops the restored chat when storage moved on (logout, rotation) while the page was cached', async () => {
    const h = await chatAs(USER_A, ['A secret']);
    expect(contents(h)).toEqual(['A secret', 'reply 1']);
    // Simulate what a logout + later page did to this tab's storage while the document sat in bfcache.
    clearAssistantChatStorage();
    sessionStorage.setItem(STORAGE_KEY_OWNER, 'guest');
    sessionStorage.setItem(STORAGE_KEY_THREAD_ID, generateThreadId());
    await act(async () => {
      pageshow(true);
    });
    expect(h.result.current.messages).toEqual([]);
    expect(JSON.stringify({ ...sessionStorage })).not.toContain('A secret');
  });

  it('ignores a normal (non-persisted) pageshow and a bfcache restore with unchanged storage', async () => {
    const h = await chatAs(USER_A, ['A q']);
    const thread = h.result.current.threadId;
    await act(async () => {
      pageshow(false);
    });
    await act(async () => {
      pageshow(true);
    });
    expect(contents(h)).toEqual(['A q', 'reply 1']);
    expect(h.result.current.threadId).toBe(thread);
  });
});

describe('clearAssistantChatStorage (QA N4)', () => {
  it('removes every assistant key and leaves other keys alone', async () => {
    await chatAs(USER_A, ['A q']);
    sessionStorage.setItem('unrelated', 'keep');
    expect(sessionStorage.getItem(STORAGE_KEY_MESSAGES)).not.toBeNull();
    clearAssistantChatStorage();
    for (const key of [STORAGE_KEY_MESSAGES, STORAGE_KEY_THREAD_ID, STORAGE_KEY_LAST_ACTIVITY, STORAGE_KEY_OWNER, STORAGE_KEY_PENDING]) {
      expect(sessionStorage.getItem(key)).toBeNull();
    }
    expect(sessionStorage.getItem('unrelated')).toBe('keep');
  });
});

describe('AssistantChatProvider: retry, draft and offline', () => {
  it('retry re-sends the failed message once (no duplicate in thread or payload)', async () => {
    mockApiClient.post.mockRejectedValueOnce({ code: 'ERR_NETWORK' });
    const h = await chatAs(GUEST, ['Where is my order?']);
    expect(h.result.current.error).toBeTruthy();
    await act(async () => {
      await h.result.current.retry();
    });
    expect(payloads()).toEqual([['Where is my order?'], ['Where is my order?']]);
    expect(contents(h)).toEqual(['Where is my order?', 'reply 1']);
    expect(h.result.current.error).toBeNull();
  });

  it('keeps the draft and the failed text on send error, and does not wipe the draft on retry success', async () => {
    mockApiClient.post.mockRejectedValueOnce({ code: 'ERR_NETWORK' });
    const h = await chatAs(GUEST);
    await act(async () => {
      h.result.current.setDraft('and my refund?');
    });
    await act(async () => {
      await h.result.current.sendMessage('Where is my order?');
    });
    expect(h.result.current.error).toBeTruthy();
    expect(h.result.current.draft).toBe('and my refund?');
    expect(contents(h)).toEqual(['Where is my order?']);
    await act(async () => {
      await h.result.current.retry();
    });
    expect(h.result.current.draft).toBe('and my refund?');
  });

  it('marks offline only for network failures', async () => {
    mockApiClient.post.mockRejectedValueOnce({
      response: { status: 500, data: { message: 'Internal' } },
    });
    const h = await chatAs(GUEST, ['q']);
    expect(h.result.current.error).toBe('Internal');
    expect(h.result.current.isOffline).toBe(false);

    mockApiClient.post.mockRejectedValueOnce({ response: { status: 429, data: {} } });
    await act(async () => {
      await h.result.current.retry();
    });
    expect(h.result.current.isOffline).toBe(false);

    mockApiClient.post.mockRejectedValueOnce({ code: 'ERR_NETWORK', message: 'Network Error' });
    await act(async () => {
      await h.result.current.retry();
    });
    expect(h.result.current.isOffline).toBe(true);

    await act(async () => {
      await h.result.current.retry();
    });
    expect(h.result.current.isOffline).toBe(false);
    expect(h.result.current.error).toBeNull();
  });

  it('sends only { messages } with the last 20 turns', async () => {
    const h = await chatAs(GUEST);
    for (let i = 0; i < 12; i++) {
      await act(async () => {
        await h.result.current.sendMessage(`m${i}`);
      });
    }
    const body = mockApiClient.post.mock.calls.at(-1)[1];
    expect(Object.keys(body)).toEqual(['messages']);
    expect(body.messages).toHaveLength(20);
    expect(mockApiClient.post.mock.calls.at(-1)[0]).toBe('/assistant/chat');
    // The only request config is the abort signal: no extra headers (no X-Anonymous-Id).
    const config = mockApiClient.post.mock.calls.at(-1)[2];
    expect(Object.keys(config)).toEqual(['signal']);
  });
});

function tokenWithSub(sub: string): string {
  const payload = btoa(JSON.stringify({ sub }))
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');
  return `header.${payload}.sig`;
}

describe('AssistantChatProvider: follow-ups from #463', () => {
  it('does not post A history when the access token belongs to B', async () => {
    const h = await chatAs(USER_A, ['A secret']);
    expect(mockApiClient.post).toHaveBeenCalledTimes(1);
    mockUseSessionAuth.mockReturnValue({
      ...USER_A,
      getAccessToken: async () => tokenWithSub(USER_B.user.sub),
    });
    await act(async () => {
      h.rerender();
    });
    let sent = true;
    await act(async () => {
      sent = await h.result.current.sendMessage('hello as A');
    });
    expect(sent).toBe(false);
    expect(mockApiClient.post).toHaveBeenCalledTimes(1);
    expect(h.result.current.messages).toEqual([]);
    expect(JSON.stringify({ ...sessionStorage })).not.toContain('A secret');
  });

  it('rotates a visible tab when the idle timer fires', async () => {
    const now = { t: Date.now() };
    jest.spyOn(Date, 'now').mockImplementation(() => now.t);
    const long = new Map<number, () => void>();
    let nextId = 1;
    const realSet = window.setTimeout.bind(window);
    const realClear = window.clearTimeout.bind(window);
    jest.spyOn(window, 'setTimeout').mockImplementation(((
      fn: TimerHandler,
      ms?: number
    ) => {
      if (typeof fn === 'function' && (ms ?? 0) > 60_000) {
        const handle = nextId++;
        long.set(handle, fn as () => void);
        return handle as unknown as ReturnType<typeof setTimeout>;
      }
      return realSet(fn, ms);
    }) as typeof window.setTimeout);
    jest.spyOn(window, 'clearTimeout').mockImplementation(((handle: number) => {
      if (long.delete(handle)) return;
      realClear(handle);
    }) as typeof window.clearTimeout);
    try {
      const h = await chatAs(GUEST, ['x']);
      expect(h.result.current.messages).toHaveLength(2);
      expect(long.size).toBeGreaterThan(0);
      now.t += IDLE_TIMEOUT_MS + 1;
      await act(async () => {
        long.forEach((fn) => fn());
      });
      expect(h.result.current.messages).toEqual([]);
    } finally {
      jest.restoreAllMocks();
    }
  });

  it('does not rotate from the idle timer while the tab is hidden', async () => {
    const now = { t: Date.now() };
    jest.spyOn(Date, 'now').mockImplementation(() => now.t);
    const long = new Map<number, () => void>();
    let nextId = 1;
    const realSet = window.setTimeout.bind(window);
    const realClear = window.clearTimeout.bind(window);
    jest.spyOn(window, 'setTimeout').mockImplementation(((
      fn: TimerHandler,
      ms?: number
    ) => {
      if (typeof fn === 'function' && (ms ?? 0) > 60_000) {
        const handle = nextId++;
        long.set(handle, fn as () => void);
        return handle as unknown as ReturnType<typeof setTimeout>;
      }
      return realSet(fn, ms);
    }) as typeof window.setTimeout);
    jest.spyOn(window, 'clearTimeout').mockImplementation(((handle: number) => {
      if (long.delete(handle)) return;
      realClear(handle);
    }) as typeof window.clearTimeout);
    try {
      const h = await chatAs(GUEST, ['x']);
      Object.defineProperty(document, 'visibilityState', {
        configurable: true,
        value: 'hidden',
      });
      now.t += IDLE_TIMEOUT_MS + 1;
      await act(async () => {
        long.forEach((fn) => fn());
      });
      expect(h.result.current.messages).toHaveLength(2);
    } finally {
      jest.restoreAllMocks();
      Object.defineProperty(document, 'visibilityState', {
        configurable: true,
        value: 'visible',
      });
    }
  });

  it('keeps the reply when sessionStorage writes fail', async () => {
    const h = await chatAs(GUEST);
    const setItem = jest
      .spyOn(Storage.prototype, 'setItem')
      .mockImplementation(() => {
        throw new DOMException('quota', 'QuotaExceededError');
      });
    try {
      await act(async () => {
        await h.result.current.sendMessage('hi');
      });
      expect(contents(h)).toEqual(['hi', 'reply 1']);
      expect(h.result.current.error).toBeNull();
    } finally {
      setItem.mockRestore();
    }
  });

  it('offers Retry when a signed-in request is aborted by remount', async () => {
    const pending = deferred<{ data: { reply: string; handoff: boolean } }>();
    mockApiClient.post.mockImplementationOnce(() => pending.promise);
    const first = await chatAs(USER_A);
    act(() => {
      void first.result.current.sendMessage('q while navigating');
    });
    first.unmount();
    mockUseSessionAuth.mockReturnValue(USER_A);
    const second = renderHook(() => useAssistantChat(), { wrapper });
    expect(contents(second)).toEqual(['q while navigating']);
    expect(second.result.current.error).toBeTruthy();
    expect(second.result.current.isSending).toBe(false);
  });

  it('an aborted request shows no error banner', async () => {
    mockApiClient.post.mockRejectedValueOnce({
      code: 'ERR_CANCELED',
      name: 'CanceledError',
    });
    const h = await chatAs(GUEST, ['q']);
    expect(h.result.current.error).toBeNull();
    expect(h.result.current.isOffline).toBe(false);
    expect(contents(h)).toEqual(['q']);
  });
});
