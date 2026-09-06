import { observer } from 'mobx-react-lite';
import { useStore } from '../../stores/RootStore';
import ClientOrderDetailScreen from '../client/ClientOrderDetailScreen';
import AgentOrderDetailScreen from '../agent/AgentOrderDetailScreen';
import type { OrderDetailScreenProps } from './orderDetail/types';

export type { OrdersStackParamList } from './orderDetail/types';

type Props = OrderDetailScreenProps;

/** Compatibility shim — prefer Client/AgentOrderDetailScreen from navigators. */
function OrderDetailScreenBase(props: Props) {
  const { persona } = useStore();
  if (persona.activePersona === 'client') {
    return <ClientOrderDetailScreen {...props} />;
  }
  return <AgentOrderDetailScreen {...props} />;
}

export default observer(OrderDetailScreenBase);
