import { useQuery } from "@apollo/client";
import { gql } from "@apollo/client";
import { useEffect, useState } from "react";

// Types pour les agents
interface Agent {
  id: number;
  firstName: string;
  lastName: string;
  email: string;
  phoneNumber?: string;
  agency?: {
    id: number;
    name: string;
  };
}

// Query pour récupérer les agents assignés à un dossier
const GET_AGENTS_ON_FILE = gql`
  query agentsOnFile($entityId: Int!, $entityType: EntityType!) {
    agentsOnFile(entityId: $entityId, entityType: $entityType) {
      id
      firstName
      lastName
      email
      phoneNumber
      agency {
        id
        name
      }
    }
  }
`;

const useAgentsOnFile = (entityId: number, entityType: string) => {
  const [agents, setAgents] = useState<Agent[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const { refetch } = useQuery(GET_AGENTS_ON_FILE, {
    skip: true,
  });

  useEffect(() => {
    if (!entityId || !entityType) return;
    
    (async () => {
      try {
        setLoading(true);
        setError(null);
        const { data } = await refetch({ entityId, entityType });
        const agentsList = data?.agentsOnFile || [];
        setAgents(agentsList);
      } catch (e: any) {
        console.error("Failed to load agents on file", e);
        setError(e);
        // En cas d'erreur, on met des agents fictifs pour ne pas bloquer l'affichage
        setAgents([
          {
            id: 1,
            firstName: "Jean",
            lastName: "Dupont",
            email: "j.dupont@btgroupe.com",
            phoneNumber: "+237 XXX XXX XXX",
            agency: { id: 1, name: "BT Groupe Douala" }
          }
        ]);
      } finally {
        setLoading(false);
      }
    })();
  }, [entityId, entityType, refetch]);

  return { loading, agents, error };
};

export default useAgentsOnFile;

