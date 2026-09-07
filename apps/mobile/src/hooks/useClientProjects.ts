import { useQuery, useMutation, gql } from "@apollo/client";
import { useEffect, useMemo, useState } from "react";
import useClientProfile from "./useClientProfile";

// Types pour les projets client - champs disponibles dans getProjects
// Aligné avec ProjectFieldsFragment du web
interface ClientProject {
  id: number;
  title: string;
  description?: string | null;
  name?: string | null;
  rating: number;
  projectStatus?: string | null;
  dateCreated: string;
  currency: string;
  clientId: number;
  canEdit: boolean;
  paidForEvaluation: boolean;
  liked: boolean;
  likes: Array<{ clientId: number }>;
  city?: string | null;
  country?: string | null;
  projectCost?: string | null;
  personalContribution?: string | null;
  agency: {
    id: number;
    name: string;
    address?: {
      address?: string;
      city?: string;
      country?: string;
      state?: string;
    } | null;
  };
}

// Requête alignée avec le web - champs disponibles dans getProjects
// Utilise les mêmes champs que le web pour la parité complète
const GET_PROJECTS = gql`
  query getProjects($pagination: PaginationParams, $filter: ProjectFilter, $range: RangeParam) {
    getProjects(pagination: $pagination, filter: $filter, range: $range) {
      id
      title
      description
      name
      rating
      projectStatus
      dateCreated
      currency
      clientId
      canEdit
      paidForEvaluation
      liked
      likes {
        clientId
      }
      city
      country
      projectCost
      personalContribution
      agency {
        id
        name
        address {
          address
          city
          country
          state
        }
      }
    }
    getProjectsCount(filter: $filter, range: $range)
  }
`;

const TOGGLE_PROJECT_LIKE = gql`
  mutation toggleProjectLike($id: Int!) {
    toggleProjectLike(id: $id)
  }
`;

export type ProjectStatusFilter = 'all' | 'active' | 'reviewing' | 'financed';

interface UseClientProjectsOptions {
  filterByClientId?: boolean; // Par défaut true pour les stats du profil
}

const useClientProjects = (options: UseClientProjectsOptions = { filterByClientId: true }) => {
  const [projects, setProjects] = useState<ClientProject[]>([]);
  const [count, setCount] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  const [statusFilter, setStatusFilter] = useState<ProjectStatusFilter>('all');
  const [hasLoadedOnce, setHasLoadedOnce] = useState(false);

  // Récupérer le clientId de l'utilisateur connecté
  const { client } = useClientProfile();
  const clientId = client?.id;

  const baseVariables = useMemo(() => {
    const filter: any = {};
    
    // Filtrer par clientId de l'utilisateur connecté seulement si l'option est activée
    if (options.filterByClientId && clientId) {
      filter.client = clientId;
    }
    
    if (statusFilter === 'active') filter.projectStatus = 'Active';
    if (statusFilter === 'reviewing') filter.projectStatus = 'Reviewing';
    if (statusFilter === 'financed') filter.projectStatus = 'Financed';

    // Range étendu à 10 ans pour récupérer tous les projets
    const range = {
      from: new Date(new Date().setFullYear(new Date().getFullYear() - 10)),
      to: new Date(),
      dateColumn: 'dateCreated',
    } as any;

    // Pas de pagination - charger tous les projets en une seule fois
    const pagination = {
      page: 1,
      pageSize: 10000, // Très grand nombre pour charger tous les projets
      order: 'desc',
      orderBy: 'dateCreated',
    } as any;

    return { filter, range, pagination };
  }, [statusFilter, clientId, options.filterByClientId]);

  const { refetch } = useQuery(GET_PROJECTS, { skip: true });
  const [toggleLikeMutation] = useMutation(TOGGLE_PROJECT_LIKE);

  const reload = async () => {
    try {
      setLoading(true);
      setError(null);
      
      // Ne pas charger si on filtre par clientId mais que clientId n'est pas encore disponible
      if (options.filterByClientId && !clientId) {
        setProjects([]);
        setCount(0);
        setLoading(false);
        return;
      }
      
      const { data } = await refetch(baseVariables);
      const list = (data?.getProjects || []) as ClientProject[];
      setProjects(list);
      setCount(data?.getProjectsCount || 0);
      setHasLoadedOnce(true);
    } catch (e: any) {
      setError(e);
      console.log(`An error occurred while loading projects`, e);
    } finally {
      setLoading(false);
    }
  };

  const loadMore = async () => {
    // Pas de pagination - tous les projets sont déjà chargés
    return;
  };

  const setFilter = (f: ProjectStatusFilter) => {
    setStatusFilter(f);
  };

  const toggleLike = async (projectId: number) => {
    try {
      await toggleLikeMutation({ variables: { id: projectId } });
      // MAJ optimiste minimale: inverser liked localement
      setProjects((prev) => prev.map((p) => (p.id === projectId ? { ...p, liked: !p.liked } : p)));
    } catch (e) {
      console.log('toggleLike failed', e);
    }
  };

  useEffect(() => {
    // Recharger seulement si on ne filtre pas par clientId, ou si clientId est disponible
    // Recharger seulement lors du premier chargement (comme avant)
    if ((!options.filterByClientId || clientId) && !hasLoadedOnce) {
      reload();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [statusFilter, clientId, options.filterByClientId]);

  return { loading, projects, count, error, reload, loadMore, setFilter, statusFilter, toggleLike };
};

export default useClientProjects;
