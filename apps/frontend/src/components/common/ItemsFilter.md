# ItemsFilter Component

A generic, reusable filter component for filtering inventory items in the client dashboard.

## Features

- **Business Filter**: Filter items by business name
- **Business Location Filter**: Filter items by specific business location (dependent on business selection)
- **Price Range Filter**: Filter items by price range using a slider
- **Category Filter**: Filter items by main category
- **Subcategory Filter**: Filter items by subcategory (dependent on category selection)
- **Item Name Search**: Search items by name (case-insensitive)
- **Clear Filters**: One-click clear all active filters
- **Results Count**: Shows filtered results count
- **Loading State**: Skeleton loading state while data is being fetched
- **Responsive Design**: Adapts to different screen sizes

## Usage

```tsx
import ItemsFilter from '../common/ItemsFilter';
import { InventoryItem } from '../../hooks/useInventoryItems';

const MyComponent = () => {
  const [filteredItems, setFilteredItems] = useState<InventoryItem[]>([]);

  return <ItemsFilter items={inventoryItems} onFilterChange={setFilteredItems} loading={isLoading} />;
};
```

## Props

| Prop             | Type                                       | Required | Description                                       |
| ---------------- | ------------------------------------------ | -------- | ------------------------------------------------- |
| `items`          | `InventoryItem[]`                          | Yes      | Array of inventory items to filter                |
| `onFilterChange` | `(filteredItems: InventoryItem[]) => void` | Yes      | Callback function called when filters change      |
| `loading`        | `boolean`                                  | No       | Whether to show loading skeleton (default: false) |
| `className`      | `string`                                   | No       | Additional CSS class name                         |

## Filter Logic

### Business Filter

- Shows all unique business names from the items
- When selected, filters items to only show those from the selected business

### Business Location Filter

- Shows locations only for the selected business
- Disabled when no business is selected
- When selected, filters items to only show those from the selected location

### Price Range Filter

- Uses a slider with min/max values calculated from the items
- Filters items within the selected price range

### Category Filter

- Shows all unique main categories from the items
- When selected, filters items to only show those in the selected category

### Subcategory Filter

- Shows subcategories only for the selected category
- Disabled when no category is selected
- When selected, filters items to only show those in the selected subcategory

### Item Name Search

- Case-insensitive search through item names
- Updates results in real-time as user types

## Dependencies

- Material-UI components
- React hooks (useState, useMemo, useEffect)
- react-i18next for internationalization

## Translation Keys Required

The component uses the following translation keys:

- `common.filters`
- `common.business`
- `common.location`
- `common.category`
- `common.subcategory`
- `common.search`
- `common.searchItems`
- `common.priceRange`
- `common.showing`
- `common.of`
- `common.items`
- `common.all`
- `common.clear`

## Styling

The component uses Material-UI's `Paper` component with consistent spacing and responsive design. It adapts to different screen sizes using flexbox and responsive breakpoints.
