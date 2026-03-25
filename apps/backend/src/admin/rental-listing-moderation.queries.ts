export const RENTAL_LISTINGS_MODERATION_LIST = `
  query RentalListingsModeration($where: rental_location_listings_bool_exp!, $limit: Int!, $offset: Int!) {
    rental_location_listings(
      where: $where
      order_by: { created_at: asc }
      limit: $limit
      offset: $offset
    ) {
      id
      moderation_status
      created_at
      base_price_per_hour
      rental_item {
        id
        name
        business {
          name
          user_id
        }
      }
      business_location {
        id
        name
      }
    }
    rental_location_listings_aggregate(where: $where) {
      aggregate {
        count
      }
    }
  }
`;

export const LISTING_FOR_MODERATION_BY_PK = `
  query ListingForModeration($id: uuid!) {
    rental_location_listings_by_pk(id: $id) {
      id
      moderation_status
      deleted_at
      rental_item {
        name
        business {
          user_id
        }
      }
    }
  }
`;

export const APPROVE_RENTAL_LISTING_MODERATION = `
  mutation ApproveRentalListingModeration(
    $id: uuid!
    $moderatedAt: timestamptz!
    $moderatorId: uuid!
  ) {
    update_rental_location_listings_by_pk(
      pk_columns: { id: $id }
      _set: {
        moderation_status: approved
        moderated_at: $moderatedAt
        moderated_by_user_id: $moderatorId
      }
    ) {
      id
    }
  }
`;

export const REJECT_RENTAL_LISTING_MODERATION = `
  mutation RejectRentalListingModeration(
    $id: uuid!
    $moderatedAt: timestamptz!
    $moderatorId: uuid!
  ) {
    update_rental_location_listings_by_pk(
      pk_columns: { id: $id }
      _set: {
        moderation_status: rejected
        moderated_at: $moderatedAt
        moderated_by_user_id: $moderatorId
      }
    ) {
      id
    }
  }
`;

export const INSERT_RENTAL_LISTING_REJECTION_MESSAGE = `
  mutation InsertRentalListingRejectionMessage(
    $userId: uuid!
    $listingId: uuid!
    $message: String!
  ) {
    insert_user_messages_one(
      object: {
        user_id: $userId
        entity_type: rental_listing
        entity_id: $listingId
        message: $message
      }
    ) {
      id
    }
  }
`;
