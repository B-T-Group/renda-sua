import { StackActions } from '@react-navigation/native';
import type { NavigationProp, ParamListBase } from '@react-navigation/native';

/** Dismiss enroll flow back to Profile when present, otherwise root tab screen. */
export function dismissEnrollFlow(navigation: NavigationProp<ParamListBase>): void {
  const state = navigation.getState();
  const profileIndex = state.routes.findIndex((route) => route.name === 'Profile');
  if (profileIndex >= 0 && state.index > profileIndex) {
    navigation.dispatch(StackActions.pop(state.index - profileIndex));
    return;
  }
  navigation.dispatch(StackActions.popToTop());
}
