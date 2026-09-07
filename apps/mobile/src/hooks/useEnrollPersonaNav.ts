import { useCallback } from 'react';
import { useNavigation } from '@react-navigation/native';
import type { PersonaSlug } from '@/types/persona';
import type { EnrollPersonaParams } from '@/navigation/types';

type EnrollNav = {
  navigate: (name: string, params?: EnrollPersonaParams) => void;
  getParent?: () => EnrollNav | undefined;
};

export function useEnrollPersonaNav() {
  const navigation = useNavigation<EnrollNav>();

  const goToExplain = useCallback(
    (targetPersona: PersonaSlug) => {
      const root = navigation.getParent?.() ?? navigation;
      root.navigate('EnrollPersonaExplain', { targetPersona });
    },
    [navigation]
  );

  return { goToExplain };
}
