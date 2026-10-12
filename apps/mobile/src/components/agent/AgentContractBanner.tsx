import { useCallback, useState } from 'react';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import { useTranslation } from 'react-i18next';
import { Banner } from 'react-native-paper';
import { agentContractApi, type AgentContractStatus } from '../../services/agentContractApi';

export function AgentContractBanner() {
  const { t } = useTranslation();
  const navigation = useNavigation<any>();
  const [status, setStatus] = useState<AgentContractStatus | null>(null);

  useFocusEffect(
    useCallback(() => {
      let active = true;
      void agentContractApi
        .status()
        .then((res) => {
          if (active) setStatus(res.data);
        })
        .catch(() => {
          if (active) setStatus(null);
        });
      return () => {
        active = false;
      };
    }, [])
  );

  if (!status?.required || status.signed) return null;

  return (
    <Banner
      visible
      actions={[
        {
          label: t('agentContract.review', 'Review agreement'),
          onPress: () => navigation.navigate('AgentAgreement'),
        },
      ]}
    >
      {t('agentContract.banner', 'Sign your agent agreement to start claiming deliveries.')}
    </Banner>
  );
}
