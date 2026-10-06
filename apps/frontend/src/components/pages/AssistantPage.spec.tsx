import { render, screen } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import AssistantPage from './AssistantPage';
import { AssistantChatProvider } from '../../contexts/AssistantChatContext';

jest.unmock('./AssistantPage');

const mockUseSessionAuth = jest.fn();
const mockApiClient = {
  post: jest.fn(),
};

jest.mock('../../contexts/SessionAuthContext', () => ({
  useSessionAuth: () => mockUseSessionAuth(),
}));

jest.mock('../../hooks/useApiClient', () => ({
  useApiClient: () => mockApiClient,
}));

const TestWrapper = ({ children }: { children: React.ReactNode }) => (
  <BrowserRouter>
    <AssistantChatProvider>{children}</AssistantChatProvider>
  </BrowserRouter>
);

describe('AssistantPage', () => {
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

  it('renders without crashing', () => {
    render(
      <TestWrapper>
        <AssistantPage />
      </TestWrapper>
    );
    expect(
      screen.getByText(/RendaSua Assistant|Rendasua Assistant/i)
    ).toBeInTheDocument();
  });

  it('composer input is not wrapped in a form element', () => {
    const { container } = render(
      <TestWrapper>
        <AssistantPage />
      </TestWrapper>
    );

    // Find the input element
    const input = container.querySelector('textarea, input[type="text"]');
    expect(input).toBeInTheDocument();

    // Check that there is no form element as an ancestor
    let parent = input?.parentElement;
    while (parent) {
      expect(parent.tagName.toLowerCase()).not.toBe('form');
      parent = parent.parentElement;
    }
  });

  it('composer input has autocomplete="off"', () => {
    const { container } = render(
      <TestWrapper>
        <AssistantPage />
      </TestWrapper>
    );

    // Find the input element (MUI InputBase renders a textarea for multiline)
    const input = container.querySelector(
      'textarea[name="message"]'
    ) as HTMLTextAreaElement;
    expect(input).toBeInTheDocument();
    expect(input.getAttribute('autocomplete')).toBe('off');
  });

  it('composer input has a generic name attribute', () => {
    const { container } = render(
      <TestWrapper>
        <AssistantPage />
      </TestWrapper>
    );

    // Find the input element
    const input = container.querySelector(
      'textarea[name="message"]'
    ) as HTMLTextAreaElement;
    expect(input).toBeInTheDocument();
    expect(input.getAttribute('name')).toBe('message');
  });

  it('does not contain dark theme color values', () => {
    const { container } = render(
      <TestWrapper>
        <AssistantPage />
      </TestWrapper>
    );

    // Check that the old dark color is not present in the rendered HTML
    const html = container.innerHTML;
    expect(html).not.toMatch(/#050b16/i);
    expect(html).not.toMatch(/#00bcd4/i);
    expect(html).not.toMatch(/#006978/i);
    expect(html).not.toMatch(/#26c6da/i);
  });
});
