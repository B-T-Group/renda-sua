import type { ParamListBase } from '@react-navigation/native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';

export type OrdersStackParamList = {
  OrdersList: undefined;
  OrderDetail: {
    orderId: string;
    openMessages?: boolean;
    highlightMessageId?: string;
    rate?: 'agent' | 'item';
  };
  OrderMessages: {
    orderId: string;
    highlightMessageId?: string;
  };
};

/** Stack minimal pour l’écran détail (agent + client root). */
export type OrderDetailStackParamList = ParamListBase & {
  OrderDetail: {
    orderId: string;
    openMessages?: boolean;
    highlightMessageId?: string;
    rate?: 'agent' | 'item';
  };
  OrderMessages: {
    orderId: string;
    highlightMessageId?: string;
  };
};

export type OrderDetailScreenProps = NativeStackScreenProps<OrderDetailStackParamList, 'OrderDetail'>;
