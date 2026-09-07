import { describe, expect, it, vi, beforeEach } from 'vitest';

vi.mock('./apiClient', () => ({
  api: { post: vi.fn() },
}));
vi.mock('./publicApiClient', () => ({
  publicApiPost: vi.fn(),
}));
vi.mock('./auth0DirectService', () => ({
  default: { getAccessToken: vi.fn() },
}));

import { api } from './apiClient';
import { publicApiPost } from './publicApiClient';
import Auth0DirectService from './auth0DirectService';
import { postAssistantChat } from './assistantApi';

describe('postAssistantChat', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('uses authenticated api when a token is present', async () => {
    vi.mocked(Auth0DirectService.getAccessToken).mockResolvedValue('token');
    vi.mocked(api.post).mockResolvedValue({ reply: 'Hello', handoff: false });
    const result = await postAssistantChat([
      { role: 'user', content: 'Hi' },
    ]);
    expect(api.post).toHaveBeenCalledWith('/assistant/chat', {
      messages: [{ role: 'user', content: 'Hi' }],
    });
    expect(publicApiPost).not.toHaveBeenCalled();
    expect(result.reply).toBe('Hello');
  });

  it('falls back to public api when anonymous', async () => {
    vi.mocked(Auth0DirectService.getAccessToken).mockResolvedValue(null as any);
    vi.mocked(publicApiPost).mockResolvedValue({
      reply: 'Bienvenue',
      handoff: false,
    });
    const result = await postAssistantChat([
      { role: 'user', content: 'Bonjour' },
    ]);
    expect(publicApiPost).toHaveBeenCalled();
    expect(result.reply).toBe('Bienvenue');
  });
});
