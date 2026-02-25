# Orders Service Optimization Recommendations

## Overview
This document outlines specific optimization opportunities identified in `orders.service.ts` that can significantly improve performance by reducing database queries, parallelizing operations, and implementing caching strategies.

## Key Optimization Areas

### 1. Parallelize Sequential Configuration Fetches

**Current Issue**: Multiple methods fetch commission configs and hold percentage sequentially when they could be fetched in parallel.

**Affected Methods**:
- `getOrderById()` (lines 2432-2436)
- `getOrders()` (lines 1786-1791)
- `getOpenOrders()` (lines 1921-1923)

**Current Code Pattern**:
```typescript
const commissionConfig = await this.commissionsService.getCommissionConfigs();
const holdPercentage = await this.getAgentHoldPercentage();
```

**Optimized Code**:
```typescript
const [commissionConfig, holdPercentage] = await Promise.all([
  this.commissionsService.getCommissionConfigs(),
  this.getAgentHoldPercentage()
]);
```

**Performance Impact**: Reduces 2 sequential queries to 1 parallel operation (~50% faster for these calls)

---

### 2. Batch Address Lookups

**Current Issue**: Methods fetch addresses one by one when they could be batched.

**Affected Methods**:
- `calculateItemDeliveryFee()` (lines 4045-4057)
- `calculateDeliveryFee()` (lines 4191-4206)

**Current Code Pattern**:
```typescript
const userAddresses = await this.addressesService.getAddressesByIds([targetAddressId]);
const businessAddresses = await this.addressesService.getAddressesByIds([item.business_location.address_id]);
```

**Optimized Code**:
```typescript
const [userAddresses, businessAddresses] = await Promise.all([
  this.addressesService.getAddressesByIds([targetAddressId]),
  this.addressesService.getAddressesByIds([item.business_location.address_id])
]);
```

**Performance Impact**: Reduces 2 sequential queries to 1 parallel operation

---

### 3. Cache User Information Within Request Context

**Current Issue**: `hasuraUserService.getUser()` is called multiple times in the same request flow.

**Affected Methods**:
- `getOrderById()` - calls `getUser()` twice (lines 1942, implicit in `getOrderDetails`)
- `calculateItemDeliveryFee()` - calls `getUser()` (line 4032)
- `calculateDeliveryFee()` - calls `getUser()` (line 4173)
- Multiple status change methods call `getUser()` at the start

**Optimization Strategy**:
1. Pass user object as parameter to private methods instead of fetching repeatedly
2. Or implement request-scoped caching using NestJS request context

**Example Refactor**:
```typescript
// Before
async getOrderById(orderId: string): Promise<OrderWithDetails> {
  const user = await this.hasuraUserService.getUser();
  const order = await this.getOrderDetails(orderId);
  // ... later
  const agentInfo = await this.getAgentInfo(); // Fetches user again
}

// After
async getOrderById(orderId: string): Promise<OrderWithDetails> {
  const user = await this.hasuraUserService.getUser();
  const order = await this.getOrderDetails(orderId);
  // ... later
  const agentInfo = await this.getAgentInfo(user); // Pass user as parameter
}
```

**Performance Impact**: Eliminates redundant user fetches (saves 1-2 queries per request)

---

### 4. Optimize getOrderById for Agents

**Current Issue**: `getOrderById()` makes multiple sequential calls that could be parallelized.

**Current Flow** (lines 1941-2450):
1. Get user
2. Get order details
3. Check access (synchronous)
4. Execute main query
5. Get agent info
6. Get commission config
7. Get hold percentage

**Optimized Flow**:
```typescript
async getOrderById(orderId: string): Promise<OrderWithDetails> {
  const user = await this.hasuraUserService.getUser();
  
  // Parallelize order fetch and agent info check
  const [order, agentInfo] = await Promise.all([
    this.getOrderDetails(orderId),
    this.getAgentInfo(user) // Pass user to avoid re-fetch
  ]);
  
  // ... access check ...
  
  // Execute main query
  const result = await this.hasuraSystemService.executeQuery(query, { orderId });
  
  // If agent, parallelize config fetches
  if (agentInfo?.isAgent) {
    const [commissionConfig, holdPercentage] = await Promise.all([
      this.commissionsService.getCommissionConfigs(),
      this.getAgentHoldPercentage()
    ]);
    // ... transform order ...
  }
  
  return orderData;
}
```

**Performance Impact**: Reduces sequential operations from 7 to 4-5 parallel batches

---

### 5. Batch Address Queries in Delivery Fee Calculations

**Current Issue**: `calculateItemDeliveryFee()` and `calculateDeliveryFee()` fetch addresses sequentially.

**Optimization**:
```typescript
// Current (lines 4045-4057)
const userAddresses = await this.addressesService.getAddressesByIds([targetAddressId]);
const userAddress = userAddresses[0];
const businessAddresses = await this.addressesService.getAddressesByIds([item.business_location.address_id]);
const businessAddress = businessAddresses[0];

// Optimized
const [userAddresses, businessAddresses] = await Promise.all([
  this.addressesService.getAddressesByIds([targetAddressId]),
  this.addressesService.getAddressesByIds([item.business_location.address_id])
]);
const userAddress = userAddresses[0];
const businessAddress = businessAddresses[0];
```

**Performance Impact**: Reduces 2 sequential queries to 1 parallel operation

---

### 6. Cache Configuration Values

**Current Issue**: Commission configs and delivery configs are fetched from database on every request.

**Optimization Strategy**:
1. Implement in-memory cache with TTL (e.g., 5-10 minutes)
2. Use NestJS CacheModule with Redis or memory store
3. Invalidate cache when configurations are updated

**Example Implementation**:
```typescript
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import { Inject, Injectable } from '@nestjs/common';
import { Cache } from 'cache-manager';

@Injectable()
export class OrdersService {
  constructor(
    // ... other dependencies
    @Inject(CACHE_MANAGER) private cacheManager: Cache,
  ) {}

  async getAgentHoldPercentage(): Promise<number> {
    const cacheKey = 'agent_hold_percentage';
    const cached = await this.cacheManager.get<number>(cacheKey);
    
    if (cached !== undefined) {
      return cached;
    }
    
    const value = await this.agentHoldService.getHoldPercentageForAgent();
    
    // Cache for 10 minutes
    await this.cacheManager.set(cacheKey, value, 600000);
    
    return value;
  }
}
```

**Performance Impact**: Eliminates database queries for frequently accessed configs (99% cache hit rate expected)

---

### 7. Optimize getOrders() Method

**Current Issue**: Fetches configs sequentially after query execution.

**Optimization** (lines 1786-1791):
```typescript
// Current
const agentInfo = await this.getAgentInfo();
if (agentInfo?.isAgent) {
  const commissionConfig = await this.commissionsService.getCommissionConfigs();
  const holdPercentage = await this.getAgentHoldPercentage();
  // ...
}

// Optimized
const agentInfo = await this.getAgentInfo();
if (agentInfo?.isAgent) {
  const [commissionConfig, holdPercentage] = await Promise.all([
    this.commissionsService.getCommissionConfigs(),
    this.getAgentHoldPercentage()
  ]);
  // ...
}
```

---

### 8. Reduce Redundant Order Detail Fetches

**Current Issue**: Some methods fetch order details multiple times.

**Example**: `confirmOrder()` (line 716):
- Line 723: `getOrderDetails()` - fetches order
- Line 777: `updateOrderStatus()` - might fetch order again internally
- Line 783: `updateOrderDeliveryWindow()` - might need order data

**Optimization**: Pass order object to subsequent methods instead of re-fetching.

---

### 9. Batch Delivery Config Queries

**Current Issue**: `calculateTieredDeliveryFee()` fetches configs sequentially (lines 4325-4330).

**Current Code**:
```typescript
const [baseFee, ratePerKm] = await Promise.all([
  requiresFastDelivery
    ? this.deliveryConfigService.getFastDeliveryBaseFee(countryCode)
    : this.deliveryConfigService.getNormalDeliveryBaseFee(countryCode),
  this.deliveryConfigService.getPerKmDeliveryFee(countryCode),
]);
```

**Note**: This is already optimized with `Promise.all()`. Good!

---

## Implementation Priority

### High Priority (Immediate Impact)
1. **Parallelize config fetches** (#1) - Easy to implement, high impact
2. **Batch address lookups** (#2, #5) - Easy to implement, reduces query count
3. **Cache user in request context** (#3) - Medium effort, eliminates redundant queries

### Medium Priority (Significant Impact)
4. **Optimize getOrderById** (#4) - Medium effort, improves most common query
5. **Cache configuration values** (#6) - Medium effort, requires cache setup

### Low Priority (Nice to Have)
6. **Reduce redundant order fetches** (#8) - Low effort, minor impact

---

## Expected Performance Improvements

### Query Reduction
- **Before**: ~8-12 queries per `getOrderById()` call
- **After**: ~5-7 queries per call (40-50% reduction)

### Response Time
- **Before**: ~200-400ms for complex order queries
- **After**: ~100-200ms (50% improvement expected)

### Database Load
- Reduced concurrent connections
- Lower query volume per request
- Better resource utilization

---

## Implementation Notes

1. **Testing**: Ensure all optimizations maintain existing functionality
2. **Error Handling**: Maintain current error handling patterns
3. **Backward Compatibility**: Changes should not break existing API contracts
4. **Monitoring**: Add logging to track performance improvements
5. **Gradual Rollout**: Implement optimizations incrementally and measure impact

---

## Code Examples

### Example 1: Optimized getOrderById
```typescript
async getOrderById(orderId: string): Promise<OrderWithDetails> {
  const user = await this.hasuraUserService.getUser();
  
  // Parallelize initial fetches
  const [order, agentInfo] = await Promise.all([
    this.getOrderDetails(orderId),
    this.getAgentInfo(user)
  ]);
  
  if (!order) {
    throw new HttpException('Order not found', HttpStatus.NOT_FOUND);
  }
  
  // ... access check ...
  
  // Execute main query
  const result = await this.hasuraSystemService.executeQuery(query, { orderId });
  const orderData = result.orders_by_pk;
  
  if (!orderData) {
    throw new HttpException('Order not found', HttpStatus.NOT_FOUND);
  }
  
  // Parallelize config fetches if agent
  if (agentInfo?.isAgent) {
    const [commissionConfig, holdPercentage] = await Promise.all([
      this.commissionsService.getCommissionConfigs(),
      this.getAgentHoldPercentage()
    ]);
    
    return this.transformOrderForAgentSync(
      orderData,
      agentInfo.isVerified,
      commissionConfig,
      holdPercentage
    );
  }
  
  return orderData;
}
```

### Example 2: Optimized calculateItemDeliveryFee
```typescript
async calculateItemDeliveryFee(...): Promise<{...}> {
  const user = await this.hasuraUserService.getUser();
  const item = await this.getItemDetails(itemId);
  
  const targetAddressId = addressId || user.addresses?.[0]?.id || '';
  
  // Batch address lookups
  const [userAddresses, businessAddresses] = await Promise.all([
    this.addressesService.getAddressesByIds([targetAddressId]),
    this.addressesService.getAddressesByIds([item.business_location.address_id])
  ]);
  
  const userAddress = userAddresses[0];
  const businessAddress = businessAddresses[0];
  
  // ... rest of method ...
}
```

---

## Monitoring & Metrics

After implementing optimizations, track:
1. Average response time per endpoint
2. Database query count per request
3. Cache hit rates (if caching implemented)
4. Error rates (ensure no regressions)
5. Concurrent request handling capacity









