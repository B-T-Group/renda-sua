// Example usage of the updated useFastDeliveryConfig hook

import React from 'react';
import { useFastDeliveryConfig } from '../hooks/useFastDeliveryConfig';

const FastDeliveryExample: React.FC = () => {
  // Now requires both countryCode and stateCode as required parameters
  const { config, loading, error, isEnabledForLocation, refreshConfig } =
    useFastDeliveryConfig('GA', 'Estuaire');

  if (loading) {
    return <div>Loading fast delivery configuration...</div>;
  }

  if (error) {
    return <div>Error: {error}</div>;
  }

  if (!config) {
    return <div>No fast delivery configuration available</div>;
  }

  return (
    <div>
      <h3>Fast Delivery Configuration for Gabon - Estuaire</h3>

      <div>
        <strong>Enabled:</strong> {config.enabled ? 'Yes' : 'No'}
      </div>

      <div>
        <strong>Fee:</strong> {config.fee} XAF
      </div>

      <div>
        <strong>Delivery Time:</strong> {config.minHours} - {config.maxHours}{' '}
        hours
      </div>

      <div>
        <strong>Operating Hours:</strong>
        <ul>
          {Object.entries(config.operatingHours).map(([day, hours]) => (
            <li key={day}>
              {day}:{' '}
              {hours.enabled ? `${hours.start} - ${hours.end}` : 'Closed'}
            </li>
          ))}
        </ul>
      </div>

      <button onClick={refreshConfig}>Refresh Configuration</button>

      <div>
        <strong>Is enabled for this location:</strong>{' '}
        {isEnabledForLocation('GA', 'Estuaire') ? 'Yes' : 'No'}
      </div>
    </div>
  );
};

export default FastDeliveryExample;
