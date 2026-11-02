import type { AxiosInstance } from 'axios';
import type {
  AppealDetail,
  AppealQueueCounts,
  AppealQueueQuery,
  AppealQueueResult,
  DecideAppealBody,
  DecideAppealResult,
} from '../types/itemAppealsAdmin';
import { unwrapApiData } from '../utils/itemRejectionRecovery';

export const ADMIN_ITEM_APPEALS_PATH = '/admin/item-appeals';

export function createItemAppealsAdminApi(client: AxiosInstance) {
  return {
    list: (query?: AppealQueueQuery) => listAppeals(client, query),
    counts: () => getCounts(client),
    detail: (appealId: string) => getDetail(client, appealId),
    decide: (appealId: string, body: DecideAppealBody) =>
      decideAppeal(client, appealId, body),
  };
}

async function listAppeals(
  client: AxiosInstance,
  query: AppealQueueQuery = {}
): Promise<AppealQueueResult> {
  const res = await client.get(ADMIN_ITEM_APPEALS_PATH, {
    params: compactQuery(query),
  });
  return unwrapApiData(res.data);
}

async function getCounts(client: AxiosInstance): Promise<AppealQueueCounts> {
  const res = await client.get(`${ADMIN_ITEM_APPEALS_PATH}/count`);
  return unwrapApiData(res.data);
}

async function getDetail(
  client: AxiosInstance,
  appealId: string
): Promise<AppealDetail> {
  const res = await client.get(
    `${ADMIN_ITEM_APPEALS_PATH}/${encodeURIComponent(appealId)}`
  );
  return unwrapApiData(res.data);
}

async function decideAppeal(
  client: AxiosInstance,
  appealId: string,
  body: DecideAppealBody
): Promise<DecideAppealResult> {
  const res = await client.post(
    `${ADMIN_ITEM_APPEALS_PATH}/${encodeURIComponent(appealId)}/decide`,
    body
  );
  return unwrapApiData(res.data);
}

function compactQuery(query: AppealQueueQuery): Record<string, string | number> {
  const params: Record<string, string | number> = {};
  if (query.status) params.status = query.status;
  if (query.category) params.category = query.category;
  if (query.businessId) params.businessId = query.businessId;
  if (query.limit != null) params.limit = query.limit;
  if (query.offset != null) params.offset = query.offset;
  return params;
}
