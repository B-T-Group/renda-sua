import {
  Alert,
  Box,
  Button,
  Card,
  CardActions,
  CardContent,
  Checkbox,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  FormControl,
  InputLabel,
  MenuItem,
  Select,
  Stack,
  TextField,
  Typography,
} from '@mui/material';
import IntegrationInstructionsIcon from '@mui/icons-material/IntegrationInstructions';
import { useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useSearchParams } from 'react-router-dom';
import {
  CommerceExternalLocation,
  CommerceIntegration,
  CommerceProductPreview,
  useCommerceIntegrations,
} from '../../hooks/useCommerceIntegrations';
import { useBusinessLocations } from '../../hooks/useBusinessLocations';

export default function BusinessIntegrationsPage() {
  const { t } = useTranslation();
  const [searchParams] = useSearchParams();
  const api = useCommerceIntegrations();
  const { locations, loading: locationsLoading } = useBusinessLocations();
  const [integrations, setIntegrations] = useState<CommerceIntegration[]>([]);
  const [shopDomain, setShopDomain] = useState('');
  const [banner, setBanner] = useState<string | null>(null);
  const [selected, setSelected] = useState<CommerceIntegration | null>(null);
  const [locationDialogOpen, setLocationDialogOpen] = useState(false);
  const [importDialogOpen, setImportDialogOpen] = useState(false);
  const [externalLocations, setExternalLocations] = useState<
    CommerceExternalLocation[]
  >([]);
  const [locationMap, setLocationMap] = useState<
    Record<string, string | null>
  >({});
  const [products, setProducts] = useState<CommerceProductPreview[]>([]);
  const [selectedProducts, setSelectedProducts] = useState<Set<string>>(
    new Set()
  );
  const [syncRuns, setSyncRuns] = useState<
    Array<{
      id: string;
      trigger: string;
      status: string;
      started_at: string;
      error: string | null;
    }>
  >([]);

  const refresh = useCallback(async () => {
    const data = await api.listIntegrations();
    setIntegrations(data);
    const shopify = data.find((i) => i.provider === 'shopify');
    if (shopify) setSelected(shopify);
  }, [api]);

  useEffect(() => {
    void refresh().catch(() => undefined);
  }, [refresh]);

  useEffect(() => {
    if (searchParams.get('connected') === 'shopify') {
      setBanner(
        t(
          'business.integrations.connectedSuccess',
          'Shopify connected successfully.'
        )
      );
      void refresh();
    }
    const err = searchParams.get('error');
    if (err) {
      setBanner(
        t('business.integrations.connectError', 'Shopify connection failed: {{error}}', {
          error: err,
        })
      );
    }
  }, [searchParams, refresh, t]);

  const handleConnect = async () => {
    const url = await api.startShopifyInstall(shopDomain.trim());
    window.location.href = url;
  };

  const openLocationMapping = async (integration: CommerceIntegration) => {
    setSelected(integration);
    const locs = await api.listLocations(integration.id);
    setExternalLocations(locs);
    const initial: Record<string, string | null> = {};
    for (const loc of locs) {
      initial[loc.externalId] = loc.mapping?.internalId ?? null;
    }
    setLocationMap(initial);
    setLocationDialogOpen(true);
  };

  const saveLocations = async () => {
    if (!selected) return;
    await api.saveLocationMappings(
      selected.id,
      externalLocations.map((loc) => ({
        externalId: loc.externalId,
        internalId: locationMap[loc.externalId] || null,
        syncEnabled: !!locationMap[loc.externalId],
      }))
    );
    setLocationDialogOpen(false);
    setBanner(
      t('business.integrations.locationsSaved', 'Location mappings saved.')
    );
  };

  const openImport = async (integration: CommerceIntegration) => {
    setSelected(integration);
    const page = await api.previewProducts(integration.id);
    setProducts(page.products);
    setSelectedProducts(new Set());
    setImportDialogOpen(true);
  };

  const runImport = async () => {
    if (!selected) return;
    const result = await api.importProducts(
      selected.id,
      Array.from(selectedProducts)
    );
    setImportDialogOpen(false);
    setBanner(
      t(
        'business.integrations.importResult',
        'Import {{status}}: {{success}} succeeded.',
        {
          status: result.status,
          success: result.results.filter((r) => r.success).length,
        }
      )
    );
  };

  const openSyncIssues = async (integration: CommerceIntegration) => {
    setSelected(integration);
    const runs = await api.listSyncRuns(integration.id);
    setSyncRuns(runs);
  };

  const shopify = integrations.find((i) => i.provider === 'shopify');

  return (
    <Box sx={{ p: { xs: 2, md: 3 }, maxWidth: 960, mx: 'auto' }}>
      <Stack direction="row" spacing={1.5} alignItems="center" mb={2}>
        <IntegrationInstructionsIcon color="primary" />
        <Typography variant="h4" component="h1">
          {t('business.integrations.title', 'Integrations')}
        </Typography>
      </Stack>
      <Typography color="text.secondary" mb={3}>
        {t(
          'business.integrations.subtitle',
          'Connect external commerce systems to import products and sync inventory.'
        )}
      </Typography>

      {banner && (
        <Alert severity="info" sx={{ mb: 2 }} onClose={() => setBanner(null)}>
          {banner}
        </Alert>
      )}
      {api.error && (
        <Alert severity="error" sx={{ mb: 2 }}>
          {api.error}
        </Alert>
      )}

      <Card variant="outlined" sx={{ mb: 3 }}>
        <CardContent>
          <Typography variant="h6" gutterBottom>
            {t('business.integrations.shopify.title', 'Shopify')}
          </Typography>
          {!shopify || shopify.status === 'disconnected' ? (
            <Stack spacing={2} maxWidth={480}>
              <TextField
                label={t(
                  'business.integrations.shopify.shopDomain',
                  'Shop domain'
                )}
                placeholder="my-store.myshopify.com"
                value={shopDomain}
                onChange={(e) => setShopDomain(e.target.value)}
                fullWidth
              />
              <Button
                variant="contained"
                disabled={!shopDomain.trim() || api.loading}
                onClick={() => void handleConnect()}
              >
                {t('business.integrations.shopify.connect', 'Connect Shopify')}
              </Button>
            </Stack>
          ) : (
            <Stack spacing={1}>
              <Typography>
                {t('business.integrations.status', 'Status')}:{' '}
                <strong>{shopify.status}</strong>
              </Typography>
              <Typography>
                {t('business.integrations.shopify.store', 'Store')}:{' '}
                {shopify.shopDomain}
              </Typography>
              <Typography>
                {t('business.integrations.lastSynced', 'Last synchronized')}:{' '}
                {shopify.lastSyncedAt
                  ? new Date(shopify.lastSyncedAt).toLocaleString()
                  : t('business.integrations.never', 'Never')}
              </Typography>
              {shopify.lastError && (
                <Alert severity="warning">{shopify.lastError}</Alert>
              )}
            </Stack>
          )}
        </CardContent>
        {shopify && shopify.status !== 'disconnected' && (
          <CardActions sx={{ flexWrap: 'wrap', gap: 1, px: 2, pb: 2 }}>
            <Button onClick={() => void openLocationMapping(shopify)}>
              {t('business.integrations.mapLocations', 'Map locations')}
            </Button>
            <Button onClick={() => void openImport(shopify)}>
              {t('business.integrations.importProducts', 'Import products')}
            </Button>
            <Button
              onClick={() =>
                void api.syncNow(shopify.id).then(() =>
                  setBanner(
                    t(
                      'business.integrations.syncQueued',
                      'Inventory sync queued.'
                    )
                  )
                )
              }
            >
              {t('business.integrations.syncNow', 'Sync now')}
            </Button>
            <Button onClick={() => void openSyncIssues(shopify)}>
              {t('business.integrations.viewSyncIssues', 'View sync history')}
            </Button>
            <Button
              color="error"
              onClick={() =>
                void api.disconnect(shopify.id).then(() => refresh())
              }
            >
              {t('business.integrations.disconnect', 'Disconnect')}
            </Button>
          </CardActions>
        )}
      </Card>

      {syncRuns.length > 0 && (
        <Card variant="outlined">
          <CardContent>
            <Typography variant="h6" gutterBottom>
              {t('business.integrations.syncHistory', 'Sync history')}
            </Typography>
            <Stack spacing={1}>
              {syncRuns.map((run) => (
                <Box key={run.id}>
                  <Typography variant="body2">
                    {run.trigger} — {run.status} —{' '}
                    {new Date(run.started_at).toLocaleString()}
                  </Typography>
                  {run.error && (
                    <Typography variant="caption" color="error">
                      {run.error}
                    </Typography>
                  )}
                </Box>
              ))}
            </Stack>
          </CardContent>
        </Card>
      )}

      <Dialog
        open={locationDialogOpen}
        onClose={() => setLocationDialogOpen(false)}
        fullWidth
        maxWidth="sm"
      >
        <DialogTitle>
          {t('business.integrations.mapLocations', 'Map locations')}
        </DialogTitle>
        <DialogContent>
          {(api.loading || locationsLoading) && <CircularProgress size={24} />}
          <Stack spacing={2} mt={1}>
            {externalLocations.map((loc) => (
              <FormControl key={loc.externalId} fullWidth>
                <InputLabel id={`loc-${loc.externalId}`}>{loc.name}</InputLabel>
                <Select
                  labelId={`loc-${loc.externalId}`}
                  label={loc.name}
                  value={locationMap[loc.externalId] || ''}
                  onChange={(e) =>
                    setLocationMap((prev) => ({
                      ...prev,
                      [loc.externalId]: e.target.value || null,
                    }))
                  }
                >
                  <MenuItem value="">
                    {t(
                      'business.integrations.notSynced',
                      'Not synchronized'
                    )}
                  </MenuItem>
                  {locations.map((l) => (
                    <MenuItem key={l.id} value={l.id}>
                      {l.name}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
            ))}
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setLocationDialogOpen(false)}>
            {t('common.cancel', 'Cancel')}
          </Button>
          <Button variant="contained" onClick={() => void saveLocations()}>
            {t('common.save', 'Save')}
          </Button>
        </DialogActions>
      </Dialog>

      <Dialog
        open={importDialogOpen}
        onClose={() => setImportDialogOpen(false)}
        fullWidth
        maxWidth="md"
      >
        <DialogTitle>
          {t('business.integrations.importProducts', 'Import products')}
        </DialogTitle>
        <DialogContent>
          <Stack spacing={1} mt={1}>
            {products.map((p) => (
              <Stack
                key={p.externalId}
                direction="row"
                spacing={1}
                alignItems="flex-start"
              >
                <Checkbox
                  checked={selectedProducts.has(p.externalId)}
                  disabled={p.alreadyMapped}
                  onChange={(e) => {
                    setSelectedProducts((prev) => {
                      const next = new Set(prev);
                      if (e.target.checked) next.add(p.externalId);
                      else next.delete(p.externalId);
                      return next;
                    });
                  }}
                />
                <Box>
                  <Typography fontWeight={600}>
                    {p.title}
                    {p.alreadyMapped
                      ? ` (${t('business.integrations.alreadyImported', 'already imported')})`
                      : ''}
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    {p.variants.length}{' '}
                    {t('business.integrations.variants', 'variants')}
                  </Typography>
                </Box>
              </Stack>
            ))}
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setImportDialogOpen(false)}>
            {t('common.cancel', 'Cancel')}
          </Button>
          <Button
            variant="contained"
            disabled={selectedProducts.size === 0}
            onClick={() => void runImport()}
          >
            {t('business.integrations.importSelected', 'Import selected')}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
