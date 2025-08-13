# Frontend Components Architecture Guide

## 🏗️ Component Hierarchy & Organization

### Directory Structure

```
src/components/
├── common/          # ✅ Reusable UI components (USE FIRST)
├── business/        # 🏢 Business domain components
├── dialogs/         # 💬 Modal and dialog components
├── layout/          # 📐 Layout and navigation components
├── pages/           # 📄 Page-level components
├── auth/            # 🔐 Authentication components
├── seo/             # 🔍 SEO and meta components
├── routing/         # 🛣️ Routing components
└── examples/        # 📚 Example/demo components
```

## 🔍 Component Reuse Strategy

### MANDATORY: Search Before Creating

**Always search existing components before creating new ones:**

1. **Check `common/` directory first** - Most reusable components
2. **Search similar functionality** - Use codebase_search
3. **Extend existing components** - Add props instead of duplicating
4. **Extract common patterns** - Create base components for shared logic

### Reuse Decision Matrix

| Similarity | Action                                         |
| ---------- | ---------------------------------------------- |
| 90%+       | ✅ Use existing component, add props if needed |
| 70-89%     | 🔧 Extend existing component with variants     |
| 50-69%     | 🏗️ Extract common base component               |
| <50%       | 🆕 Create new component following patterns     |

## 🎨 Loading States - MANDATORY Skeleton Loading

### ❌ FORBIDDEN Loading Patterns

```tsx
// NEVER DO THESE:
if (loading) return <div>Loading...</div>;
if (loading) return <CircularProgress />;
if (loading) return <Typography>Loading...</Typography>;
```

### ✅ REQUIRED Skeleton Patterns

#### 1. Card Loading

```tsx
if (loading) {
  return (
    <Card>
      <Skeleton variant="rectangular" height={200} />
      <CardContent>
        <Skeleton variant="text" height={24} sx={{ mb: 1 }} />
        <Skeleton variant="text" height={20} width="80%" />
      </CardContent>
    </Card>
  );
}
```

#### 2. List Loading

```tsx
if (loading) {
  return (
    <Box>
      {Array.from(new Array(5)).map((_, index) => (
        <Box key={index} sx={{ mb: 2 }}>
          <Skeleton variant="rectangular" height={60} />
        </Box>
      ))}
    </Box>
  );
}
```

#### 3. Table Loading

```tsx
if (loading) {
  return (
    <TableContainer>
      <Table>
        <TableBody>
          {Array.from(new Array(5)).map((_, index) => (
            <TableRow key={index}>
              <TableCell>
                <Skeleton />
              </TableCell>
              <TableCell>
                <Skeleton />
              </TableCell>
              <TableCell>
                <Skeleton />
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </TableContainer>
  );
}
```

#### 4. Full Page Loading

```tsx
// Use existing LoadingPage component
if (loading) {
  return <LoadingPage message={t('common.loading')} subtitle={t('common.pleaseWait')} showProgress={true} />;
}
```

## 📝 Form Layout Rules - MANDATORY

### ✅ REQUIRED Form Layout Patterns

**Always put each input on a separate line unless otherwise noted.**

#### 1. Standard Form Layout

```tsx
<Grid container spacing={3}>
  <Grid item xs={12} md={6}>
    <TextField fullWidth label={t('form.fieldName')} value={formData.fieldName} onChange={(e) => handleInputChange('fieldName', e.target.value)} />
  </Grid>
  <Grid item xs={12} md={6}>
    <TextField fullWidth label={t('form.anotherField')} value={formData.anotherField} onChange={(e) => handleInputChange('anotherField', e.target.value)} />
  </Grid>
</Grid>
```

#### 2. EXCEPTIONS - Related Fields on Same Line

**Price and Currency:**

```tsx
<Grid item xs={12} md={6}>
  <TextField
    fullWidth
    label={t('form.price')}
    type="number"
    value={formData.price}
    onChange={(e) => handleInputChange('price', parseFloat(e.target.value) || 0)}
  />
</Grid>
<Grid item xs={12} md={6}>
  <TextField
    fullWidth
    label={t('form.currency')}
    value={formData.currency}
    onChange={(e) => handleInputChange('currency', e.target.value)}
  />
</Grid>
```

**Size and Size Unit:**

```tsx
<Grid item xs={12} md={6}>
  <TextField
    fullWidth
    label={t('form.size')}
    type="number"
    value={formData.size || ''}
    onChange={(e) => handleInputChange('size', parseFloat(e.target.value) || null)}
  />
</Grid>
<Grid item xs={12} md={6}>
  <TextField
    fullWidth
    label={t('form.sizeUnit')}
    value={formData.size_unit}
    onChange={(e) => handleInputChange('size_unit', e.target.value)}
  />
</Grid>
```

**Weight and Weight Unit:**

```tsx
<Grid item xs={12} md={6}>
  <TextField
    fullWidth
    label={t('form.weight')}
    type="number"
    value={formData.weight || ''}
    onChange={(e) => handleInputChange('weight', parseFloat(e.target.value) || null)}
  />
</Grid>
<Grid item xs={12} md={6}>
  <TextField
    fullWidth
    label={t('form.weightUnit')}
    value={formData.weight_unit}
    onChange={(e) => handleInputChange('weight_unit', e.target.value)}
  />
</Grid>
```

**Min and Max Order Quantity:**

```tsx
<Grid item xs={12} md={6}>
  <TextField
    fullWidth
    label={t('form.minOrderQuantity')}
    type="number"
    value={formData.min_order_quantity}
    onChange={(e) => handleInputChange('min_order_quantity', parseInt(e.target.value) || 1)}
  />
</Grid>
<Grid item xs={12} md={6}>
  <TextField
    fullWidth
    label={t('form.maxOrderQuantity')}
    type="number"
    value={formData.max_order_quantity || ''}
    onChange={(e) => handleInputChange('max_order_quantity', parseInt(e.target.value) || null)}
  />
</Grid>
```

### ❌ FORBIDDEN Form Layout Patterns

```tsx
// DON'T put unrelated fields on the same line
<Grid item xs={12} md={6}>
  <TextField label="Name" />
  <TextField label="Email" /> {/* WRONG - should be separate */}
</Grid>

// DON'T put related fields on separate lines when they should be together
<Grid item xs={12}>
  <TextField label="Price" />
</Grid>
<Grid item xs={12}>
  <TextField label="Currency" /> {/* WRONG - should be with price */}
</Grid>
```

## 📦 Available Reusable Components

### Common Components (`src/components/common/`)

#### Loading Components

- **`LoadingPage`** - Full page loading with animations and skeleton
- **`LoadingSpinner`** - Simple spinner for small sections
- **`LoadingScreen`** - Backdrop overlay loading

#### UI Components

- **`ConfirmationModal`** - Yes/No confirmation dialogs
- **`DashboardItemCard`** - Product/item display cards
- **`AccountInformation`** - Account balance display
- **`PhoneInput`** - Phone number input with validation
- **`LanguageSwitcher`** - Language selection dropdown
- **`Logo`** - Brand logo with variants
- **`ErrorBoundary`** - Error handling wrapper

### Dialog Components (`src/components/dialogs/`)

- **`OrderDialog`** - Order placement dialog
- **`AddressDialog`** - Address form dialog with country/state/city dropdowns

### Business Components (`src/components/business/`)

- **`BusinessOrderCard`** - Order display with status and actions
- **`InventoryCards`** - Inventory grid view with filters
- **`ItemsCards`** - Items grid view with filters
- **`BusinessInventoryTable`** - Inventory table view

## 🏗️ Component Creation Template

### Mandatory Component Structure

```tsx
import React from 'react';
import { Box, Skeleton, Typography } from '@mui/material';
import { useTranslation } from 'react-i18next';

interface ComponentNameProps {
  // Define clear, typed props
  data?: DataType[];
  loading?: boolean;
  error?: string;
  onAction?: (item: DataType) => void;
}

const ComponentName: React.FC<ComponentNameProps> = ({ data, loading = false, error, onAction }) => {
  const { t } = useTranslation();

  // MANDATORY: Error state
  if (error) {
    return <Alert severity="error">{error}</Alert>;
  }

  // MANDATORY: Skeleton loading
  if (loading) {
    return (
      <Box>
        <Skeleton variant="rectangular" height={200} />
        <Skeleton variant="text" height={24} sx={{ mt: 1 }} />
        <Skeleton variant="text" height={20} width="80%" />
      </Box>
    );
  }

  // MANDATORY: Empty state
  if (!data || data.length === 0) {
    return (
      <Box textAlign="center" py={4}>
        <Typography variant="body1" color="text.secondary">
          {t('common.noData')}
        </Typography>
      </Box>
    );
  }

  // Component content
  return (
    <Box>
      {data.map((item) => (
        <div key={item.id}>{/* Render item */}</div>
      ))}
    </Box>
  );
};

export default ComponentName;
```

## 📏 Component Size Guidelines

### Size Limits

- **Maximum 200 lines per component file**
- **Maximum 20 lines per method/function**
- **If larger → Split into smaller components**

### When to Split Components

```tsx
// ❌ TOO LARGE - Split this
const LargeComponent = () => {
  // 300+ lines of code
  return (
    <div>
      {/* Complex form */}
      {/* Complex table */}
      {/* Complex chart */}
    </div>
  );
};

// ✅ SPLIT INTO SMALLER COMPONENTS
const MainComponent = () => {
  return (
    <div>
      <ComplexForm />
      <ComplexTable />
      <ComplexChart />
    </div>
  );
};
```

## 🔧 Custom Hooks Integration

### Available Hooks (USE THESE FIRST)

- **`useLoading`** - Global loading state management
- **`useApiWithLoading`** - API calls with automatic loading
- **`useGraphQLRequest`** - GraphQL queries with loading
- **`useUserProfile`** - User profile data
- **`useBusinessInventory`** - Business inventory management
- **`useBusinessLocations`** - Business locations data

### Hook Usage Example

```tsx
const MyComponent = () => {
  const { data, loading, error } = useGraphQLRequest<DataType>(QUERY);

  // Component automatically handles loading, error, and data states
  if (loading) return <SkeletonLoader />;
  if (error) return <ErrorDisplay error={error} />;

  return <DataDisplay data={data} />;
};
```

## 🎯 Best Practices Checklist

### Before Creating Any Component

- [ ] **Searched** for existing similar components
- [ ] **Checked** if existing component can be extended
- [ ] **Verified** component serves single responsibility
- [ ] **Planned** for reusability from the start

### Component Implementation

- [ ] **Includes** skeleton loading for all loading states
- [ ] **Uses** proper TypeScript interfaces
- [ ] **Handles** empty states gracefully
- [ ] **Uses** translation keys (no hardcoded strings)
- [ ] **Follows** Material-UI design system
- [ ] **Includes** proper error handling
- [ ] **Wraps** in ErrorBoundary when needed

### Code Quality

- [ ] **Component** is <200 lines
- [ ] **Methods** are <20 lines each
- [ ] **Uses** React.memo for expensive components
- [ ] **Includes** proper ARIA labels
- [ ] **Follows** semantic HTML structure

## 🚫 Anti-Patterns to Avoid

### ❌ Don't Create These

```tsx
// Don't create duplicate loading components
const MyCustomSpinner = () => <CircularProgress />; // Use LoadingSpinner instead

// Don't create simple wrapper components
const MyButton = ({ children }) => <Button>{children}</Button>; // Use Button directly

// Don't create one-off components for simple layouts
const TwoColumnLayout = () => <Grid container>...</Grid>; // Use Grid directly
```

### ❌ Don't Use These Patterns

```tsx
// Don't use inline styles
<div style={{ marginTop: 20 }}>...</div>

// Don't hardcode strings
<Typography>Loading data...</Typography>

// Don't ignore loading states
const BadComponent = ({ data }) => <div>{data}</div>; // Missing loading state
```

## 🧪 Testing Guidelines

### Test Structure for Reusable Components

```tsx
describe('ComponentName', () => {
  it('shows skeleton loading when loading prop is true', () => {
    render(<ComponentName loading={true} />);
    expect(screen.getByTestId('skeleton')).toBeInTheDocument();
  });

  it('shows empty state when no data', () => {
    render(<ComponentName data={[]} />);
    expect(screen.getByText(/no data/i)).toBeInTheDocument();
  });

  it('renders data correctly', () => {
    const mockData = [{ id: 1, name: 'Test' }];
    render(<ComponentName data={mockData} />);
    expect(screen.getByText('Test')).toBeInTheDocument();
  });
});
```

## 📚 Examples

### Good Component Examples

- **`LoadingPage`** - Comprehensive loading with skeleton
- **`ConfirmationModal`** - Reusable dialog pattern
- **`DashboardItemCard`** - Complex card with multiple states
- **`BusinessOrderCard`** - Business domain component with actions

### Study These Patterns

1. **Loading States** - See `PublicItemsPage.tsx` skeleton implementation
2. **Error Handling** - See `ErrorBoundary.tsx` error recovery
3. **Empty States** - See `Dashboard.tsx` no-data handling
4. **Reusable Cards** - See `DashboardItemCard.tsx` composition pattern

---

## 🎯 Summary

**Remember the golden rules:**

1. **Search first** - Don't recreate existing components
2. **Skeleton always** - Never use simple loading text
3. **Size limits** - Keep components small and focused
4. **Reuse patterns** - Follow established component patterns
5. **Type everything** - Use proper TypeScript interfaces
6. **Test coverage** - Write tests for reusable components

Following these guidelines ensures a maintainable, performant, and consistent component architecture across the entire frontend application.
