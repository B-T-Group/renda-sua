import { useCallback, useState } from 'react';
import { useFocusEffect } from '@react-navigation/native';
import dedicatedAgentsService from '../services/dedicatedAgentsService';

/** Location ids where this agent has a live dedicated assignment. */
export function useDedicatedStoreLocationIds(): ReadonlySet<string> {
  const [ids, setIds] = useState<ReadonlySet<string>>(() => new Set());

  useFocusEffect(
    useCallback(() => {
      let active = true;
      dedicatedAgentsService
        .getMyAssignments()
        .then((res) => {
          if (!active) return;
          setIds(new Set(res.assignments.map((row) => row.locationId).filter(Boolean)));
        })
        .catch(() => undefined);
      return () => {
        active = false;
      };
    }, [])
  );

  return ids;
}
