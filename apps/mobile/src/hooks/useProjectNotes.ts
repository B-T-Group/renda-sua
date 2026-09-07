import { gql, useMutation, useQuery } from '@apollo/client';
import { useCallback, useEffect, useState } from 'react';

export interface ProjectNoteItem {
  id: number;
  note: string;
  dateCreated: string;
  user?: { firstName?: string; lastName?: string };
}

const GET_NOTES = gql`
  query getNotes($entityId: Int!, $entityType: EntityType!) {
    getNotes(entityId: $entityId, entityType: $entityType) {
      id
      note
      dateCreated
      user { firstName lastName email }
    }
  }
`;

const ADD_NOTE = gql`
  mutation addOrUpdateNote($input: NoteInput!) {
    addOrUpdateNote(input: $input) {
      id
      note
      dateCreated
      user { firstName lastName email }
    }
  }
`;

const useProjectNotes = (projectId?: number) => {
  const [notes, setNotes] = useState<ProjectNoteItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const { refetch } = useQuery(GET_NOTES, { skip: true });
  const [mutate] = useMutation(ADD_NOTE);

  const reload = useCallback(async () => {
    if (!projectId) return;
    setLoading(true);
    try {
      const { data } = await refetch({ entityId: projectId, entityType: 'Project' });
      setNotes(data?.getNotes ?? []);
    } catch (e: any) {
      setError(e);
    } finally {
      setLoading(false);
    }
  }, [projectId, refetch]);

  useEffect(() => { reload(); }, [reload]);

  const addNote = async (htmlNote: string) => {
    if (!projectId) return false;
    await mutate({ variables: { input: { entityId: projectId, entityType: 'Project', note: htmlNote } } });
    await reload();
    return true;
  };

  return { loading, notes, error, reload, addNote };
};

export default useProjectNotes;




