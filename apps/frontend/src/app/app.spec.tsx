jest.mock('graphql-request', () => ({
  GraphQLClient: jest.fn().mockImplementation(() => ({
    request: jest.fn().mockResolvedValue({}),
  })),
  gql: (strings: TemplateStringsArray, ...values: unknown[]) =>
    strings.reduce(
      (query, part, index) => `${query}${part}${values[index] ?? ''}`,
      ''
    ),
  ClientError: class ClientError extends Error {},
}));

import App from './app';

describe('App', () => {
  it('exports the app component', () => {
    expect(App).toBeDefined();
  });
});
