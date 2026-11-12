import ClientMyRentalsScreen from './ClientMyRentalsScreen';
import { useClientRentalsTabCount } from '../../navigation/clientRentalsTabCount';

/** Tab root for My rentals. Stack pushes keep using ClientMyRentalsScreen directly. */
export default function ClientRentalsTabScreen() {
  const todoCount = useClientRentalsTabCount();
  return <ClientMyRentalsScreen asTab todoCount={todoCount} />;
}
