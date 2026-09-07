import { gql, useQuery } from "@apollo/client";
import { useEffect, useMemo, useState } from "react";

const GET_PRODUCT_APPLICATION_PHASES = gql`
  query getProductApplication($id: Int!) {
    getProductApplication(id: $id) {
      id
      phases {
        id
        status
        startDate
        completionDate
        phase {
          id
          name
          description
        }
      }
    }
  }
`;

const useProjectPhases = (productApplicationId: number) => {
  const [phases, setPhases] = useState<any[]>([]);
  const { data, loading, refetch } = useQuery(GET_PRODUCT_APPLICATION_PHASES, {
    variables: { id: productApplicationId },
    skip: !productApplicationId,
  });

  useEffect(() => {
    if (data?.getProductApplication?.phases) {
      // Sort phases by their position if available, otherwise by ID
      const sortedPhases = [...data.getProductApplication.phases].sort((a, b) => {
        // Assuming 'position' field exists or a default sorting logic
        return (a.position || a.id) - (b.position || b.id);
      });
      setPhases(sortedPhases);
    }
  }, [data]);

  const completedPhases = useMemo(() => phases.filter(p => p.status === 'Complete').length, [phases]);
  const totalPhases = useMemo(() => phases.length, [phases]);
  const progressPercentage = useMemo(() => totalPhases > 0 ? (completedPhases / totalPhases) * 100 : 0, [completedPhases, totalPhases]);

  return { phases, loading, refetch, completedPhases, totalPhases, progressPercentage };
};

export default useProjectPhases;
