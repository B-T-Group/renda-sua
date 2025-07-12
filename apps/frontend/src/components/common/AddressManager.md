# AddressManager Component

A reusable, comprehensive address management component that can be used across different entity types (agents, clients, businesses) in the Rendasua platform.

## Features

- **Universal Entity Support**: Works with agents, clients, and businesses
- **Full CRUD Operations**: Create, read, update, and delete addresses
- **Customizable UI**: Configurable options for different use cases
- **Type Safety**: Full TypeScript support with proper interfaces
- **Internationalization**: Full i18n support with translations
- **Material-UI Integration**: Consistent design with the rest of the application
- **Skeleton Loading**: Proper loading states with skeleton components
- **Error Handling**: Comprehensive error handling and user feedback
- **Responsive Design**: Works on all screen sizes

## Usage

### Basic Usage

```tsx
import AddressManager from '../common/AddressManager';

const MyComponent = () => {
  return <AddressManager entityType="client" entityId="client-uuid-here" />;
};
```

### Advanced Usage

```tsx
import AddressManager from '../common/AddressManager';

const BusinessAddressManager = () => {
  return (
    <AddressManager
      entityType="business"
      entityId="business-uuid-here"
      title="Business Locations"
      maxAddresses={5}
      showCoordinates={true}
      allowDelete={true}
      addressTypeOptions={[
        { value: 'store', label: 'Store' },
        { value: 'warehouse', label: 'Warehouse' },
        { value: 'office', label: 'Office' },
      ]}
      emptyStateMessage="No business locations configured yet."
    />
  );
};
```

## Props

| Prop                 | Type                                    | Required | Default         | Description                                |
| -------------------- | --------------------------------------- | -------- | --------------- | ------------------------------------------ |
| `entityType`         | `'agent' \| 'client' \| 'business'`     | Yes      | -               | The type of entity to manage addresses for |
| `entityId`           | `string`                                | Yes      | -               | The unique identifier of the entity        |
| `title`              | `string`                                | No       | Auto-generated  | Custom title for the address section       |
| `showAddressType`    | `boolean`                               | No       | `true`          | Whether to show address type selection     |
| `showIsPrimary`      | `boolean`                               | No       | `true`          | Whether to show primary address option     |
| `showCoordinates`    | `boolean`                               | No       | `false`         | Whether to show latitude/longitude fields  |
| `addressTypeOptions` | `Array<{value: string, label: string}>` | No       | Default types   | Custom address type options                |
| `maxAddresses`       | `number`                                | No       | Unlimited       | Maximum number of addresses allowed        |
| `allowDelete`        | `boolean`                               | No       | `true`          | Whether to allow address deletion          |
| `emptyStateMessage`  | `string`                                | No       | Default message | Custom message when no addresses exist     |

## Address Types

The component supports various address types:

- **home**: Personal home address
- **work**: Work/office address
- **delivery**: Delivery address
- **billing**: Billing address
- **store**: Store/retail location
- **warehouse**: Warehouse location
- **office**: Office location

## Database Schema

The component works with the following database structure:

### Tables

1. **addresses**: Main address table

   - `id`: UUID primary key
   - `address_line_1`: First address line (required)
   - `address_line_2`: Second address line (optional)
   - `city`: City name (required)
   - `state`: State/province (required)
   - `postal_code`: Postal/ZIP code (required)
   - `country`: Country code (required)
   - `is_primary`: Boolean flag for primary address
   - `address_type`: Type of address (home, work, etc.)
   - `latitude`: GPS latitude (optional)
   - `longitude`: GPS longitude (optional)

2. **Junction Tables** (for many-to-many relationships):
   - `agent_addresses`: Links agents to addresses
   - `client_addresses`: Links clients to addresses
   - `business_addresses`: Links businesses to addresses

## Hook Integration

The component uses the `useAddressManager` hook which provides:

### Data

- `addresses`: Array of addresses for the entity
- `loading`: Loading state
- `error`: Error message if any
- `successMessage`: Success message after operations

### Actions

- `fetchAddresses()`: Reload addresses from the server
- `addAddress(addressData)`: Add a new address
- `updateAddress(addressId, addressData)`: Update an existing address
- `deleteAddress(addressId)`: Delete an address
- `clearMessages()`: Clear success/error messages

## GraphQL Operations

The component performs the following GraphQL operations:

### Queries

- `GET_AGENT_ADDRESSES`: Fetch addresses for an agent
- `GET_CLIENT_ADDRESSES`: Fetch addresses for a client
- `GET_BUSINESS_ADDRESSES`: Fetch addresses for a business

### Mutations

- `INSERT_AGENT_ADDRESS`: Add address for an agent
- `INSERT_CLIENT_ADDRESS`: Add address for a client
- `INSERT_BUSINESS_ADDRESS`: Add address for a business
- `UPDATE_ADDRESS`: Update an existing address
- `DELETE_ADDRESS`: Delete an address

## Translation Keys

The component uses the following translation keys:

```json
{
  "addresses": {
    "title": "Addresses",
    "addAddress": "Add Address",
    "editAddress": "Edit Address",
    "addFirstAddress": "Add First Address",
    "noAddresses": "No addresses added yet.",
    "primary": "Primary",
    "coordinates": "Coordinates",
    "maxAddressesReached": "Maximum of {{max}} addresses allowed.",
    "deleteConfirmTitle": "Delete Address",
    "deleteConfirmMessage": "Are you sure you want to delete this address?",
    "types": {
      "home": "Home",
      "work": "Work",
      "delivery": "Delivery",
      "billing": "Billing",
      "store": "Store",
      "warehouse": "Warehouse",
      "office": "Office"
    }
  }
}
```

## Examples

### Profile Page Integration

```tsx
// In Profile.tsx
import AddressManager from '../common/AddressManager';

const Profile = () => {
  const { profile } = useUserProfileContext();

  const getEntityId = () => {
    switch (profile.user_type_id) {
      case 'agent':
        return profile.agent?.id;
      case 'client':
        return profile.client?.id;
      case 'business':
        return profile.business?.id;
      default:
        return undefined;
    }
  };

  return <AddressManager entityType={profile.user_type_id} entityId={getEntityId()} title="Personal Addresses" showCoordinates={false} />;
};
```

### Business Location Management

```tsx
// For business locations with specific requirements
<AddressManager
  entityType="business"
  entityId={businessId}
  title="Business Locations"
  maxAddresses={10}
  showCoordinates={true}
  addressTypeOptions={[
    { value: 'store', label: 'Store' },
    { value: 'warehouse', label: 'Warehouse' },
    { value: 'office', label: 'Office' },
  ]}
/>
```

### Agent Delivery Addresses

```tsx
// For agents with delivery-specific addresses
<AddressManager
  entityType="agent"
  entityId={agentId}
  title="Delivery Addresses"
  maxAddresses={3}
  showCoordinates={true}
  addressTypeOptions={[
    { value: 'home', label: 'Home' },
    { value: 'work', label: 'Work' },
    { value: 'delivery', label: 'Delivery' },
  ]}
  emptyStateMessage="No delivery addresses configured yet."
/>
```

## Error Handling

The component handles various error scenarios:

- **Network errors**: Connection issues with the GraphQL API
- **Validation errors**: Invalid address data
- **Permission errors**: Insufficient permissions to modify addresses
- **Entity not found**: Invalid entity ID provided

## Performance Considerations

- **Lazy loading**: Addresses are only fetched when needed
- **Optimistic updates**: UI updates immediately while syncing with server
- **Debounced operations**: Rapid consecutive operations are debounced
- **Skeleton loading**: Provides immediate visual feedback

## Best Practices

1. **Always provide entityId**: Ensure the entity ID is valid and exists
2. **Handle loading states**: The component provides loading indicators
3. **Customize for use case**: Use appropriate props for your specific needs
4. **Validate permissions**: Ensure users have permission to modify addresses
5. **Test error scenarios**: Handle network failures gracefully

## Migration Guide

If you're migrating from the old address handling in Profile.tsx:

### Before

```tsx
// Old approach with manual address handling
const [addressForm, setAddressForm] = useState({...});
const [addressDialogOpen, setAddressDialogOpen] = useState(false);

// Manual address CRUD operations
const handleAddAddress = () => { ... };
const handleEditAddress = () => { ... };
const handleDeleteAddress = () => { ... };

// Custom address display
{addresses.map(address => (
  <Box key={address.id}>
    {/* Manual address display */}
  </Box>
))}
```

### After

```tsx
// New approach with AddressManager
<AddressManager entityType={userType} entityId={entityId} title="Personal Addresses" />
```

## Contributing

When contributing to the AddressManager component:

1. **Follow the existing patterns**: Use the same coding style and patterns
2. **Add tests**: Include unit tests for new features
3. **Update translations**: Add new translation keys to both en.json and fr.json
4. **Update documentation**: Keep this documentation up to date
5. **Consider backwards compatibility**: Avoid breaking changes when possible

## Related Components

- **AddressDialog**: Used internally for address editing
- **ConfirmationModal**: Used for delete confirmations
- **LoadingSpinner**: Used for loading states
- **useAddressManager**: The underlying hook for data management
