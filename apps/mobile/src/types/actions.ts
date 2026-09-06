export type ActionPriority = 'critical' | 'high' | 'normal';

export interface ActionItemDto {
  id: string;
  kind: string;
  priority: ActionPriority;
  count: number;
  primaryId?: string;
  primaryLabel?: string;
}

export interface ActionsNeededDto {
  actions: ActionItemDto[];
  totalCount: number;
}
