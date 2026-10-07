# Agent Hold Ceiling Runbook

**Issue:** #450  
**Feature:** Phase 1 agent caution hold ceiling (flag-gated, OFF by default)

## Overview

The agent hold ceiling feature caps the agent caution hold at a configurable XAF amount for eligible verified agents. This helps reduce the financial barrier for high-performing, trusted agents while maintaining risk controls through eligibility criteria and a loss guard.

**Default state:** OFF (flag `agent_hold_ceiling_enabled = false`)

## Configuration Keys

All keys are stored in `application_configurations` table as **global rows** (no `country_code`):

| Key | Type | Default | Description |
|-----|------|---------|-------------|
| `agent_hold_ceiling_enabled` | boolean | `false` | Master kill switch. When false, all agents use raw percentage-based holds (legacy behavior). When true, eligible agents get capped holds. |
| `agent_hold_ceiling_xaf` | number | `50000` | Absolute XAF ceiling for eligible agents. If ≤0 or missing, ceiling is not applied (falls back to raw hold). |
| `agent_hold_ceiling_city` | string | `Yaoundé` | Pilot city for eligibility. Agent's profile primary address city must match (case/accent/whitespace normalized). |
| `agent_hold_ceiling_min_clean_deliveries` | number | `10` | Minimum PIN-confirmed completed deliveries required (`orders.status=completed` AND `delivery_pin_verified=true` AND `deliveryMethod=agent_delivery`). |
| `agent_hold_loss_weekly_cap_xaf` | number | `100000` | Weekly XAF cap on agent-fault losses. When exceeded and >0, loss guard auto-sets `agent_hold_ceiling_enabled=false` and logs/alerts. |

### Tags

- `agent_hold_ceiling_enabled`: `['feature-flag', 'agent', 'hold', 'ceiling']`
- Other keys: `['agent', 'hold', 'ceiling']` or `['agent', 'hold', 'loss-guard', 'ceiling']`

## Eligibility Criteria

An agent is eligible for the hold ceiling when **ALL** of the following are true:

1. **Verified:** `agents.is_verified = true`
2. **Not Internal:** `agents.is_internal = false`
3. **Clean Deliveries:** ≥ `agent_hold_ceiling_min_clean_deliveries` PIN-confirmed completed deliveries (all-time)
4. **No Agent Faults:** Zero `failed_deliveries` rows with `resolution_type = 'agent_fault'` for that agent (all-time)
5. **In Pilot City:** Agent's profile primary address city matches `agent_hold_ceiling_city` (normalized: lowercase, trimmed, accents removed, whitespace collapsed)

## Hold Calculation Logic

```
rawHold = subtotal × holdPct / 100  (integer XAF math, existing rounding)

IF stripe rail:           holdAmount = 0
ELSE IF internal agent:   holdAmount = 0
ELSE IF unverified:       holdAmount = rawHold (100%)
ELSE IF flag OFF:         holdAmount = rawHold (80% for verified)
ELSE IF not eligible:     holdAmount = rawHold (80% for verified)
ELSE IF ceilingXaf ≤ 0:   holdAmount = rawHold
ELSE:                     holdAmount = min(rawHold, ceilingXaf)
```

**Invariant:** Verified agent, subtotal > 0, non-stripe ⇒ hold > 0.

## How to Enable on DEV

1. **Connect to DEV Hasura Console** (port 8080 or DEV endpoint)
2. **Run SQL:**
   ```sql
   UPDATE application_configurations
   SET boolean_value = true
   WHERE config_key = 'agent_hold_ceiling_enabled'
     AND country_code IS NULL;
   ```
3. **Verify:**
   ```sql
   SELECT config_key, boolean_value, number_value, string_value
   FROM application_configurations
   WHERE config_key IN (
     'agent_hold_ceiling_enabled',
     'agent_hold_ceiling_xaf',
     'agent_hold_ceiling_city',
     'agent_hold_ceiling_min_clean_deliveries',
     'agent_hold_loss_weekly_cap_xaf'
   );
   ```
4. **Test:** Use `/orders/check-claim-availability/:orderId` or `/order-offers/:orderId/details` with an eligible agent. Response should include:
   - `ceilingApplied: true` (when ceiling is lower than raw hold)
   - `ceilingXaf: 50000` (or configured value)
   - `holdAmount` ≤ `ceilingXaf`

## How to Disable

### Immediate Disable (Manual)

```sql
UPDATE application_configurations
SET boolean_value = false
WHERE config_key = 'agent_hold_ceiling_enabled'
  AND country_code IS NULL;
```

Changes take effect on the next API request (30-60s cache TTL).

### Adjust Ceiling Value

```sql
UPDATE application_configurations
SET number_value = 75000  -- New ceiling in XAF
WHERE config_key = 'agent_hold_ceiling_xaf'
  AND country_code IS NULL;
```

### Change Pilot City

```sql
UPDATE application_configurations
SET string_value = 'Douala'  -- New pilot city
WHERE config_key = 'agent_hold_ceiling_city'
  AND country_code IS NULL;
```

## Loss Guard Behavior

**Purpose:** Auto-disable the ceiling if weekly agent-fault losses exceed the configured cap.

**How it works:**
1. Scheduled job runs **every hour** (`AgentHoldLossGuardService.checkLossGuard`)
2. Calculates sum of `order_holds.agent_hold_amount` for all `failed_deliveries` with `resolution_type='agent_fault'` resolved in the last 7 days
3. If `weeklyLoss > agent_hold_loss_weekly_cap_xaf` (and cap > 0):
   - Logs warning with loss amount and cap
   - Sets `agent_hold_ceiling_enabled = false` (idempotent)
   - Alerts ops (via existing notification/alerting patterns)
4. On next API call (after cache expires), all agents revert to raw percentage-based holds

**Manual Check:**
```typescript
// In AgentHoldLossGuardService
await agentHoldLossGuardService.manualCheck();
```

**Bypass Loss Guard (Ops Decision):**
- Set `agent_hold_loss_weekly_cap_xaf = 0` to disable the guard
- Or set a very high value (e.g., 10000000) to effectively disable

## Rollback

1. **Disable Feature:**
   ```sql
   UPDATE application_configurations
   SET boolean_value = false
   WHERE config_key = 'agent_hold_ceiling_enabled';
   ```

2. **Verify Legacy Behavior:**
   - All verified agents should have `holdAmount = subtotal * 80 / 100`
   - `ceilingApplied = false` in all API responses

3. **Monitor:**
   - Check `agent.claim_funds_check` site events for hold amounts
   - Verify no agents are blocked from claiming due to hold calculation errors

## API Response Fields

### `/orders/check-claim-availability/:orderId`

Added fields:
- `holdPercentage: number` — Applied hold % (0, 80, or 100)
- `rawHoldAmount: number` — Pre-ceiling hold (subtotal × pct / 100)
- `ceilingApplied: boolean` — True if ceiling was applied
- `ceilingXaf: number | null` — Ceiling value when applied, else null
- `availableBalance: number` — Agent's available balance
- `shortfallXaf: number` — max(0, holdAmount - availableBalance)

### `/order-offers/:orderId/details`

Added fields (same as above, plus):
- `needsTopUp: boolean` — True if shortfallXaf > 0

## Monitoring

**Key Metrics:**
- Ceiling application rate: % of claims with `ceilingApplied: true`
- Weekly agent-fault loss (from loss guard logs)
- Agent claim success rate (before/after ceiling)
- Hold amount distribution (raw vs. capped)

**Log Patterns:**
- `Weekly agent-fault loss exceeded cap` → Loss guard triggered
- `Agent hold ceiling eligibility check` → Debug eligibility (if added)

**Alerts:**
- Loss guard auto-disable (weekly cap exceeded)
- Unexpected hold calculation errors (hold = 0 for verified agents)

## Testing Checklist

### DEV Testing

1. **Enable Flag:**
   ```sql
   UPDATE application_configurations SET boolean_value = true
   WHERE config_key = 'agent_hold_ceiling_enabled';
   ```

2. **Create Eligible Agent:**
   - `is_verified = true`, `is_internal = false`
   - Profile primary address city = pilot city
   - ≥ N completed deliveries with PIN verification
   - Zero agent-fault failed deliveries

3. **Test Claim Availability:**
   - High-value order (subtotal > ceiling): `ceilingApplied = true`, `holdAmount = ceilingXaf`
   - Low-value order (subtotal < ceiling): `ceilingApplied = false`, `holdAmount = rawHoldAmount`

4. **Test Ineligible Agent:**
   - Unverified: `holdAmount = subtotal` (100%)
   - Wrong city: `holdAmount = subtotal * 0.8` (80%)
   - Has agent-fault: `holdAmount = subtotal * 0.8`

5. **Test Loss Guard:**
   - Manually trigger: `agentHoldLossGuardService.manualCheck()`
   - Simulate exceeding cap (create agent-fault failed deliveries)
   - Verify flag auto-disables

### Flag OFF (Default)

- **ALL agents** use raw percentage holds:
  - Internal: 0%
  - Verified: 80%
  - Unverified: 100%
- `ceilingApplied = false` for all
- `ceilingXaf = null` for all

## Troubleshooting

### Ceiling Not Applied (Eligible Agent)

1. Check flag: `SELECT boolean_value FROM application_configurations WHERE config_key = 'agent_hold_ceiling_enabled';` → Must be `true`
2. Check ceiling value: `SELECT number_value FROM application_configurations WHERE config_key = 'agent_hold_ceiling_xaf';` → Must be > 0
3. Check eligibility:
   - Agent verified: `SELECT is_verified FROM agents WHERE id = '<agent_id>';`
   - City match: `SELECT city FROM addresses WHERE id = (SELECT primary_address_id FROM users WHERE id = '<user_id>');`
   - Deliveries: `SELECT COUNT(*) FROM orders WHERE assigned_agent_id = '<agent_id>' AND current_status = 'completed' AND delivery_pin_verified = true AND deliveryMethod = 'agent_delivery';`
   - No faults: `SELECT COUNT(*) FROM failed_deliveries WHERE order_id IN (SELECT id FROM orders WHERE assigned_agent_id = '<agent_id>') AND resolution_type = 'agent_fault';`

### Loss Guard False Positive

- Check 7-day window: ensure only recent faults are counted
- Verify `resolution_type = 'agent_fault'` filter
- Check `order_holds.agent_hold_amount` values (not subtotal)

### High Shortfall Rate

- Ceiling may be too low relative to order subtotals
- Increase `agent_hold_ceiling_xaf` or adjust eligibility criteria

## Contact

**Ops:** [Contact info]  
**Engineering:** Backend team (issue #450)  
**Escalation:** [Escalation path]
