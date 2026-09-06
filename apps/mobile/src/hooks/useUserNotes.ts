import { gql, useQuery } from '@apollo/client';
import { useEffect, useState } from 'react';

export type EntityType = 
  | 'Project'
  | 'ProductApplication'
  | 'ServiceApplication'
  | 'PurchaseOrder'
  | 'Contact';

interface PaginationParams {
  page: number;
  pageSize: number;
}

const USER_NOTES_QUERY = gql`
  query UserNotes($pagination: PaginationParams!, $entityType: EntityType) {
    userNotes(pagination: $pagination, entityType: $entityType) {
      notes {
        id
        note
        viewed
        entityType
        entityId
        dateCreated
        user {
          firstName
          lastName
          email
        }
      }
      count
    }
  }
`;

const useUserNotes = (pagination: PaginationParams, entityType?: EntityType) => {
  const [notes, setNotes] = useState<any[]>([]);
  const [count, setCount] = useState(0);

  const { data, loading, refetch } = useQuery(USER_NOTES_QUERY, {
    variables: {
      pagination,
      entityType,
    },
    notifyOnNetworkStatusChange: true,
    fetchPolicy: 'cache-and-network',
    nextFetchPolicy: 'cache-first',
  });

  useEffect(() => {
    if (data?.userNotes) {
      setNotes(data.userNotes.notes);
      setCount(data.userNotes.count);
    }
  }, [data]);

  return { loading, notes, count, refetch };
};

export default useUserNotes;
