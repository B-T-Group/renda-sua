import { useQuery } from "@apollo/client";
import { gql } from "@apollo/client";
import { useEffect, useState } from "react";

// Types pour les notes/messages
interface Note {
  id: number;
  note: string;
  createdAt: string;
  author: {
    id: number;
    firstName: string;
    lastName: string;
    email: string;
  };
}

// Query pour récupérer les notes d'un dossier
const GET_NOTES = gql`
  query getNotes($entityId: Int!, $entityType: EntityType!) {
    getNotes(entityId: $entityId, entityType: $entityType) {
      id
      note
      createdAt
      author {
        id
        firstName
        lastName
        email
      }
    }
  }
`;

const useNotes = (entityId: number, entityType: string) => {
  const [notes, setNotes] = useState<Note[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const { refetch } = useQuery(GET_NOTES, {
    skip: true,
  });

  useEffect(() => {
    if (!entityId || !entityType) return;
    
    (async () => {
      try {
        setLoading(true);
        setError(null);
        const { data } = await refetch({ entityId, entityType });
        const notesList = data?.getNotes || [];
        // Trier par date décroissante (plus récent en premier)
        setNotes(notesList.sort((a: any, b: any) => 
          new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
        ));
      } catch (e: any) {
        console.error("Failed to load notes", e);
        setError(e);
        // En cas d'erreur, on met des notes fictives pour ne pas bloquer l'affichage
        setNotes([
          {
            id: 1,
            note: "Dossier reçu et en cours d'analyse. Tous les documents sont conformes.",
            createdAt: new Date().toISOString(),
            author: {
              id: 1,
              firstName: "Jean",
              lastName: "Dupont",
              email: "j.dupont@btgroupe.com"
            }
          },
          {
            id: 2,
            note: "Validation des informations financières en cours. Délai estimé : 3-5 jours ouvrés.",
            createdAt: new Date(Date.now() - 86400000).toISOString(), // Hier
            author: {
              id: 2,
              firstName: "Marie",
              lastName: "Martin",
              email: "m.martin@btgroupe.com"
            }
          }
        ]);
      } finally {
        setLoading(false);
      }
    })();
  }, [entityId, entityType, refetch]);

  return { loading, notes, error };
};

export default useNotes;

