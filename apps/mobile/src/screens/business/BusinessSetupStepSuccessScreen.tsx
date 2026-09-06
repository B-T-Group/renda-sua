import React, { useCallback } from 'react';
import { useNavigation, useRoute } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { RouteProp } from '@react-navigation/native';
import {
  SetupStepSuccessView,
  type SetupSuccessStep,
} from '../../components/business/SetupStepSuccessView';
import type { BusinessRootStackParamList } from '../../navigation/types';

type Nav = NativeStackNavigationProp<BusinessRootStackParamList>;
type R = RouteProp<BusinessRootStackParamList, 'BusinessSetupStepSuccess'>;

export default function BusinessSetupStepSuccessScreen() {
  const navigation = useNavigation<Nav>();
  const route = useRoute<R>();
  const step = (route.params?.step ?? 'identity') as SetupSuccessStep;
  const variant = route.params?.variant === 'complete' ? 'complete' : 'continue';
  const isRental = route.params?.isRental === true;

  const onBackToDashboard = useCallback(() => {
    navigation.navigate('BusinessMainTabs', { screen: 'BusinessDashboard' });
  }, [navigation]);

  return (
    <SetupStepSuccessView
      step={step}
      variant={variant}
      isRental={isRental}
      onBackToDashboard={onBackToDashboard}
    />
  );
}
