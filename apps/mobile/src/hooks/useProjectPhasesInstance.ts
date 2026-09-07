import { gql, useQuery } from '@apollo/client';
import { useEffect, useState } from 'react';

export interface ProjectPhaseItem {
  id: number;
  name: string;
  description?: string;
}

const GET_PROJECT_PHASES = gql`
  query projectPhases($type: ProjectPhaseType) {
    projectPhases(type: $type) {
      phases {
        id
        name
        description
      }
    }
  }
`;

const useProjectPhasesInstance = (projectId?: number) => {
  const [phases, setPhases] = useState<ProjectPhaseItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const { refetch } = useQuery(GET_PROJECT_PHASES, { skip: true });

  useEffect(() => {
    (async () => {
      // Le schéma expose les phases "catalogue" (pas instance par projet)
      try {
        setLoading(true);
        setError(null);
        const { data } = await refetch({});
        setPhases(data?.projectPhases?.phases ?? []);
      } catch (e: any) {
        setError(e);
      } finally {
        setLoading(false);
      }
    })();
  }, [projectId, refetch]);

  return { loading, phases, error, refetch };
};

export default useProjectPhasesInstance;




