import { createElement, useLayoutEffect } from 'react';
import { useNavigation } from '@react-navigation/native';
import { RentalMessagesHeaderRight } from '../components/rentals/RentalMessagesHeaderRight';

interface RentalMessagesHeaderOptions {
  showMessages: boolean;
  unreadCount: number;
  onOpenMessages: () => void;
}

export function useRentalMessagesHeader({
  showMessages,
  unreadCount,
  onOpenMessages,
}: RentalMessagesHeaderOptions): void {
  const navigation = useNavigation();

  useLayoutEffect(() => {
    navigation.setOptions({
      headerRight: () =>
        createElement(RentalMessagesHeaderRight, {
          showMessages,
          unreadCount,
          onOpenMessages,
        }),
    });
  }, [navigation, showMessages, unreadCount, onOpenMessages]);
}
