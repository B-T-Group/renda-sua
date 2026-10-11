/** Every GraphQL document used by restock alerts (validated against DEV Hasura in CI-less QA). */
export const RESTOCK_QUERIES = {
  flagRows: `
    query RestockFlagRows($key: String!) {
      application_configurations(
        where: { config_key: { _eq: $key }, status: { _eq: "active" } }
      ) {
        country_code
        boolean_value
      }
    }
  `,
  acquireLock: `
    mutation RestockAcquireLock($key: String!, $now: timestamptz!, $expiry: timestamptz!) {
      update_application_configurations(
        where: {
          config_key: { _eq: $key }
          country_code: { _is_null: true }
          date_value: { _lt: $now }
        }
        _set: { date_value: $expiry }
      ) {
        affected_rows
      }
    }
  `,
  releaseLock: `
    mutation RestockReleaseLock($key: String!, $expiry: timestamptz!, $free: timestamptz!) {
      update_application_configurations(
        where: {
          config_key: { _eq: $key }
          country_code: { _is_null: true }
          date_value: { _eq: $expiry }
        }
        _set: { date_value: $free }
      ) {
        affected_rows
      }
    }
  `,
  dueEvents: `
    query RestockDueEvents($cutoff: timestamptz!, $limit: Int!) {
      restock_events(
        where: { status: { _eq: "pending" }, created_at: { _lte: $cutoff } }
        order_by: { created_at: asc }
        limit: $limit
      ) {
        id
        item_id
        inventory_id
        business_location_id
        created_at
        out_of_stock_since
      }
    }
  `,
  setEventStatus: `
    mutation RestockSetEventStatus($id: uuid!, $status: String!, $note: String!, $at: timestamptz!) {
      update_restock_events(
        where: { id: { _eq: $id }, status: { _eq: "pending" } }
        _set: { status: $status, status_note: $note, processed_at: $at }
      ) {
        affected_rows
      }
    }
  `,
  itemStock: `
    query RestockItemStock($itemId: uuid!) {
      items_by_pk(id: $itemId) {
        id
        name
        is_active
        status
        moderation_status
        business {
          name
        }
      }
      business_inventory(where: { item_id: { _eq: $itemId } }) {
        id
        quantity
        reserved_quantity
        is_active
        last_restocked_at
        item_variant {
          quantity
          is_active
        }
        business_location {
          is_active
          address {
            country
          }
        }
      }
    }
  `,
  fanoutCount: `
    query RestockFanoutCount($itemId: uuid!, $since: timestamptz!) {
      restock_item_fanouts_aggregate(
        where: { item_id: { _eq: $itemId }, fanned_out_at: { _gte: $since } }
      ) {
        aggregate {
          count
        }
      }
    }
  `,
  likesPage: `
    query RestockLikesPage($itemId: uuid!, $limit: Int!, $offset: Int!) {
      user_item_likes(
        where: { item_id: { _eq: $itemId } }
        order_by: [{ created_at: asc }, { id: asc }]
        limit: $limit
        offset: $offset
      ) {
        user_id
        item_id
        created_at
        user {
          country
        }
      }
    }
  `,
  alertsFor: `
    query RestockAlertsFor($itemId: uuid!, $userIds: [uuid!]!) {
      restock_alerts(where: { item_id: { _eq: $itemId }, user_id: { _in: $userIds } }) {
        user_id
        item_id
        state
        alert_enabled
        armed_at
        expires_at
        last_alert_at
        last_event_id
      }
    }
  `,
  markExpired: `
    mutation RestockMarkExpired($userId: uuid!, $itemId: uuid!) {
      insert_restock_alerts_one(
        object: { user_id: $userId, item_id: $itemId, state: "disarmed", disarm_reason: "expired" }
        on_conflict: {
          constraint: restock_alerts_user_item_key
          update_columns: [state, disarm_reason]
        }
      ) {
        id
      }
    }
  `,
  insertSends: `
    mutation RestockInsertSends($objects: [restock_alert_sends_insert_input!]!) {
      insert_restock_alert_sends(
        objects: $objects
        on_conflict: {
          constraint: restock_alert_sends_idempotency_key_key
          update_columns: []
        }
      ) {
        affected_rows
      }
    }
  `,
  recordFanout: `
    mutation RestockRecordFanout($object: restock_item_fanouts_insert_input!) {
      insert_restock_item_fanouts_one(
        object: $object
        on_conflict: { constraint: restock_item_fanouts_event_key, update_columns: [] }
      ) {
        id
      }
    }
  `,
  recoverStale: `
    mutation RestockRecoverStale($before: timestamptz!, $now: timestamptz!) {
      update_restock_alert_sends(
        where: { status: { _eq: "sending" }, updated_at: { _lt: $before } }
        _set: { status: "failed", last_error: "stale_sending", updated_at: $now }
      ) {
        affected_rows
      }
    }
  `,
  queuedSends: `
    query RestockQueuedSends($now: timestamptz!, $limit: Int!) {
      restock_alert_sends(
        where: { status: { _eq: "queued" }, not_before: { _lte: $now } }
        order_by: { created_at: asc }
        limit: $limit
      ) {
        id
        user_id
        item_id
        event_id
        attempts
        idempotency_key
        event {
          created_at
        }
      }
    }
  `,
  user: `
    query RestockUser($userId: uuid!) {
      users_by_pk(id: $userId) {
        id
        country
        timezone
        preferred_language
        phone_number
        phone_number_verified
      }
      user_notification_preferences_by_pk(user_id: $userId) {
        push_enabled
        whatsapp_enabled
        sms_enabled
        restock_alerts_push_enabled
        restock_alerts_whatsapp_enabled
        restock_alerts_sms_enabled
      }
    }
  `,
  likesAndAlerts: `
    query RestockLikesAndAlerts($userId: uuid!, $itemIds: [uuid!]!) {
      user_item_likes(where: { user_id: { _eq: $userId }, item_id: { _in: $itemIds } }) {
        item_id
      }
      restock_alerts(where: { user_id: { _eq: $userId }, item_id: { _in: $itemIds } }) {
        user_id
        item_id
        state
        alert_enabled
        armed_at
        last_alert_at
        last_event_id
      }
    }
  `,
  activeOrderItems: `
    query RestockActiveOrderItems($userId: uuid!, $itemIds: [uuid!]!) {
      order_items(
        where: {
          item_id: { _in: $itemIds }
          order: {
            client: { user_id: { _eq: $userId } }
            current_status: { _nin: [cancelled, complete, failed, refunded] }
          }
        }
      ) {
        item_id
      }
    }
  `,
  sentSince: `
    query RestockSentSince($userId: uuid!, $since: timestamptz!) {
      restock_alert_sends(
        where: { user_id: { _eq: $userId }, status: { _eq: "sent" }, sent_at: { _gte: $since } }
      ) {
        id
        digest_key
        is_digest
        sent_at
      }
    }
  `,
  claimSends: `
    mutation RestockClaimSends($ids: [uuid!]!, $now: timestamptz!) {
      update_restock_alert_sends(
        where: { id: { _in: $ids }, status: { _eq: "queued" } }
        _set: { status: "sending", updated_at: $now }
        _inc: { attempts: 1 }
      ) {
        returning {
          id
        }
      }
    }
  `,
  finishSend: `
    mutation RestockFinishSend($id: uuid!, $set: restock_alert_sends_set_input!) {
      update_restock_alert_sends(
        where: { id: { _eq: $id }, status: { _eq: "sending" } }
        _set: $set
      ) {
        affected_rows
      }
    }
  `,
  settleSends: `
    mutation RestockSettleSends($ids: [uuid!]!, $set: restock_alert_sends_set_input!) {
      update_restock_alert_sends(
        where: { id: { _in: $ids }, status: { _in: ["queued", "sending"] } }
        _set: $set
      ) {
        affected_rows
      }
    }
  `,
  ensureAlert: `
    mutation RestockEnsureAlert($userId: uuid!, $itemId: uuid!) {
      insert_restock_alerts_one(
        object: { user_id: $userId, item_id: $itemId }
        on_conflict: { constraint: restock_alerts_user_item_key, update_columns: [] }
      ) {
        id
      }
    }
  `,
  recordAlertSent: `
    mutation RestockRecordAlertSent($userId: uuid!, $itemId: uuid!, $eventId: uuid!, $at: timestamptz!) {
      update_restock_alerts(
        where: { user_id: { _eq: $userId }, item_id: { _eq: $itemId } }
        _set: { state: "sent", last_alert_at: $at, last_event_id: $eventId, updated_at: $at }
        _inc: { sent_count: 1 }
      ) {
        affected_rows
      }
    }
  `,
} as const;
