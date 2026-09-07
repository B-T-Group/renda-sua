import { useQuery } from "@apollo/client";
import { useEffect, useState } from "react";
import { gql } from "@apollo/client";

// Types pour les produits et services
interface ProductAndService {
  id: number;
  description: string;
  type: string;
  createdAt: string;
  status: string;
}

const GET_CLIENT_PRODUCTS_AND_SERVICES = gql`
  query clientProfile {
    clientProfile {
      productsAndServices {
        id
        description
        type
        createdAt
        status
      }
    }
  }
`;

const useClientProductsAndServices = () => {
  const [productsAndServices, setProductsAndServices] = useState<ProductAndService[]>([]);
  const [loading, setLoading] = useState(false);

  const { refetch } = useQuery(GET_CLIENT_PRODUCTS_AND_SERVICES, {
    skip: true,
  });

  const reload = async () => {
    try {
      setLoading(true);
      const data = await refetch();
      if (data.data?.clientProfile?.productsAndServices) {
        setProductsAndServices(data.data.clientProfile.productsAndServices);
      }
    } catch (e) {
      console.log(
        `An error occurred while trying to load products and services`,
        e
      );
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    (async () => {
      await reload();
    })();
  }, []);

  return { loading, productsAndServices, reload };
};

export default useClientProductsAndServices;
