import {
  Inter_400Regular,
  Inter_500Medium,
  Inter_600SemiBold,
  Inter_700Bold,
  useFonts,
} from '@expo-google-fonts/inter';
import { Poppins_600SemiBold, Poppins_700Bold } from '@expo-google-fonts/poppins';

/** Loads brand faces before the first paint. Resolves true on failure so the app still opens. */
export function useBrandFonts(): boolean {
  const [loaded, error] = useFonts({
    Inter_400Regular,
    Inter_500Medium,
    Inter_600SemiBold,
    Inter_700Bold,
    Poppins_600SemiBold,
    Poppins_700Bold,
  });
  return loaded || error != null;
}
