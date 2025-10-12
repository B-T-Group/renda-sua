// Example demonstrating the updated AddressDialog with state names as values

import React, { useState } from 'react';
import AddressDialog, { AddressFormData } from './AddressDialog';

const AddressDialogExample: React.FC = () => {
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [addressData, setAddressData] = useState<AddressFormData>({
    address_line_1: '',
    address_line_2: '',
    city: '',
    state: '', // Now stores state name instead of state code
    postal_code: '',
    country: '',
    latitude: undefined,
    longitude: undefined,
  });

  const handleAddressChange = (address: AddressFormData) => {
    setAddressData(address);
    console.log('Address updated:', address);
    console.log('State value (now state name):', address.state);
  };

  const handleSave = () => {
    console.log('Saving address with state name:', addressData.state);
    // The state field now contains the state name (e.g., "Estuaire") instead of state code (e.g., "ES")
    setIsDialogOpen(false);
  };

  const handleClose = () => {
    setIsDialogOpen(false);
  };

  return (
    <div>
      <h2>Updated AddressDialog Example</h2>

      <button onClick={() => setIsDialogOpen(true)}>Open Address Dialog</button>

      {addressData.state && (
        <div
          style={{
            marginTop: '20px',
            padding: '10px',
            backgroundColor: '#f5f5f5',
          }}
        >
          <h3>Current Address Data:</h3>
          <p>
            <strong>State:</strong> {addressData.state}
          </p>
          <p>
            <strong>Country:</strong> {addressData.country}
          </p>
          <p>
            <strong>City:</strong> {addressData.city}
          </p>
          <p>
            <strong>Address:</strong> {addressData.address_line_1}
          </p>
        </div>
      )}

      <AddressDialog
        open={isDialogOpen}
        title="Add Address"
        addressData={addressData}
        onAddressChange={handleAddressChange}
        onClose={handleClose}
        onSave={handleSave}
      />
    </div>
  );
};

export default AddressDialogExample;

/*
Key Changes Made:

1. State Select Value:
   - Before: <MenuItem value={state.isoCode}>{state.name}</MenuItem>
   - After:  <MenuItem value={state.name}>{state.name}</MenuItem>

2. State Validation:
   - Before: !states.find((state) => state.isoCode === addressData.state)
   - After:  !states.find((state) => state.name === addressData.state)

3. City Loading:
   - Before: City.getCitiesOfState(addressData.country, addressData.state)
   - After:  City.getCitiesOfState(addressData.country, findStateCode(addressData.state, addressData.country))

4. Current Location:
   - Before: state: stateCode (stored state code)
   - After:  state: location.state (stores state name directly)

Benefits:
- Works correctly with countries like Gabon (GA) where state isoCodes are numbers
- More user-friendly as state names are displayed and stored
- Maintains compatibility with City.getCitiesOfState by converting names to codes internally
- Better integration with backend APIs that expect state names
*/
