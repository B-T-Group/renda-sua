import { getRequestLogContext } from './request-context-log.util';

jest.mock('nestjs-cls', () => ({
  ClsServiceManager: {
    getClsService: jest.fn(),
  },
}));

import { ClsServiceManager } from 'nestjs-cls';
import { REQUEST_CONTEXT_CLS_KEY } from '../auth/request-context';

describe('getRequestLogContext', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('returns requestId and userId from CLS', () => {
    (ClsServiceManager.getClsService as jest.Mock).mockReturnValue({
      get: (key: string) =>
        key === REQUEST_CONTEXT_CLS_KEY
          ? { requestId: 'r1', userId: 'u1' }
          : undefined,
    });

    expect(getRequestLogContext()).toEqual({
      requestId: 'r1',
      userId: 'u1',
    });
  });

  it('returns empty object when CLS is unavailable', () => {
    (ClsServiceManager.getClsService as jest.Mock).mockImplementation(() => {
      throw new Error('no cls');
    });

    expect(getRequestLogContext()).toEqual({});
  });
});
