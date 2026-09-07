import { useEffect } from 'react';
import { useNavigation } from '@react-navigation/native';
import { gql, useQuery } from '@apollo/client';

const GET_PRODUCT_APPLICATION = gql`
  query GetProductApplication($id: Int!) {
    getProductApplication(id: $id) {
      id
      type
    }
  }
`;

interface UseProductRedirectOptions {
  productId: string | number;
  onRedirect?: (screen: string, params?: any) => void;
}

/**
 * Hook pour rediriger automatiquement vers le bon écran selon le type de produit
 */
export const useProductRedirect = ({ productId, onRedirect }: UseProductRedirectOptions) => {
  const navigation = useNavigation();
  
  const { data, loading } = useQuery(GET_PRODUCT_APPLICATION, {
    variables: { id: typeof productId === 'string' ? parseInt(productId) : productId },
    skip: !productId,
    errorPolicy: 'all',
  });

  useEffect(() => {
    if (!loading && data?.getProductApplication) {
      const product = data.getProductApplication;
      let screen: string | null = null;
      let params: any = {};

      switch (product.type) {
        case 'Investment':
          screen = 'ProjectDepositApplication';
          params = { productApplicationId: product.id };
          break;
        case 'Mortgage':
        case 'RealEstate':
          screen = 'RealEstateApplicationDetail';
          params = { productApplicationId: product.id };
          break;
        default:
          console.warn('⚠️ [useProductRedirect] Type de produit non reconnu:', product.type);
          return;
      }

      if (screen) {
        if (onRedirect) {
          onRedirect(screen, params);
        } else {
          (navigation as any).navigate('Others', { screen, params });
        }
      }
    }
  }, [data, loading, navigation, onRedirect]);

  return { loading, product: data?.getProductApplication };
};

export default useProductRedirect;
