import { Box, Link, Typography } from '@mui/material';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useSnackbar } from 'notistack';
import { useTranslation } from 'react-i18next';
import { useCart } from '../../contexts/CartContext';
import { useTrackSiteEvent, SITE_EVENT_ORDERS_REORDER_TAP, SITE_EVENT_ORDERS_REORDER_RESULT, SITE_EVENT_ASSISTANT_DEEPLINK_SHOWN, SITE_EVENT_ASSISTANT_DEEPLINK_TAP } from '../../hooks/useTrackSiteEvent';
import { useReorderOrder } from '../../hooks/useClientFlags';
import { ReorderCartConflictDialog } from '../orders/ReorderCartConflictDialog';
import type { ReorderCartAction, ReorderOrderResponse } from '../../types/reorder';
import { formatSkippedNames, mapReorderLineToCartItem, resolveReorderCartAction } from '../../utils/reorderCart';

type DeeplinkType = 'item' | 'store' | 'cart' | 'reorder' | 'order' | 'search';

/**
 * Parse a URL to extract deeplink metadata for analytics.
 * Returns null if the URL doesn't match any known pattern.
 */
function parseDeeplinkUrl(url: string): { type: DeeplinkType; targetId?: string } | null {
  // /items/:id
  const itemMatch = url.match(/\/items\/([0-9a-f-]{36})/i);
  if (itemMatch) return { type: 'item', targetId: itemMatch[1] };
  
  // /store/:id
  const storeMatch = url.match(/\/store\/([0-9a-f-]{36})/i);
  if (storeMatch) return { type: 'store', targetId: storeMatch[1] };
  
  // /cart
  if (url.includes('/cart')) return { type: 'cart' };
  
  // /orders/:id/reorder
  const reorderMatch = url.match(/\/orders\/([0-9a-f-]{36})\/reorder/i);
  if (reorderMatch) return { type: 'reorder', targetId: reorderMatch[1] };
  
  // /orders/:id
  const orderMatch = url.match(/\/orders\/([0-9a-f-]{36})/i);
  if (orderMatch) return { type: 'order', targetId: orderMatch[1] };
  
  // /shop?q=...
  if (url.includes('/shop')) return { type: 'search' };
  
  return null;
}

type Inline =
  | { type: 'text'; text: string }
  | { type: 'bold'; text: string }
  | { type: 'italic'; text: string }
  | { type: 'link'; text: string; url: string };

type Block =
  | { type: 'paragraph'; inlines: Inline[] }
  | { type: 'bullet'; inlines: Inline[] };

const INLINE_RE = /(\[([^\]]+)\]\(([^)]+)\)|\*\*[^*]+\*\*|\*[^*]+\*|_[^_]+_)/g;

function parseInline(text: string): Inline[] {
  if (!text) return [];
  const parts: Inline[] = [];
  let last = 0;
  for (const match of text.matchAll(INLINE_RE)) {
    const index = match.index ?? 0;
    if (index > last) {
      parts.push({ type: 'text', text: text.slice(last, index) });
    }
    const token = match[0];
    
    // Check for [text](url) link
    if (token.startsWith('[')) {
      const linkText = match[2];
      const url = match[3];
      if (linkText && url) {
        parts.push({ type: 'link', text: linkText, url });
      } else {
        parts.push({ type: 'text', text: token });
      }
    } else if (token.startsWith('**') && token.endsWith('**')) {
      parts.push({ type: 'bold', text: token.slice(2, -2) });
    } else if (
      (token.startsWith('*') && token.endsWith('*')) ||
      (token.startsWith('_') && token.endsWith('_'))
    ) {
      parts.push({ type: 'italic', text: token.slice(1, -1) });
    } else {
      parts.push({ type: 'text', text: token });
    }
    last = index + token.length;
  }
  if (last < text.length) {
    parts.push({ type: 'text', text: text.slice(last) });
  }
  return parts.length ? parts : [{ type: 'text', text }];
}

export function parseAssistantMarkdown(source: string): Block[] {
  const lines = source.replace(/\r\n/g, '\n').split('\n');
  const blocks: Block[] = [];
  let paragraph: string[] = [];

  const flushParagraph = () => {
    if (!paragraph.length) return;
    const text = paragraph.join('\n').trim();
    paragraph = [];
    if (!text) return;
    blocks.push({ type: 'paragraph', inlines: parseInline(text) });
  };

  for (const line of lines) {
    const bullet = line.match(/^\s*[-*•]\s+(.+)$/);
    if (bullet) {
      flushParagraph();
      blocks.push({ type: 'bullet', inlines: parseInline(bullet[1]) });
      continue;
    }
    if (!line.trim()) {
      flushParagraph();
      continue;
    }
    paragraph.push(line);
  }
  flushParagraph();
  return blocks;
}

export function stripAssistantMarkdown(source: string): string {
  return source
    .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1') // [text](url) → text
    .replace(/\*\*([^*]+)\*\*/g, '$1')
    .replace(/\*([^*]+)\*/g, '$1')
    .replace(/_([^_]+)_/g, '$1')
    .replace(/^\s*[-*•]\s+/gm, '• ');
}

function InlineRuns({ 
  inlines, 
  onLinkClick,
  trackSiteEvent,
}: { 
  inlines: Inline[];
  onLinkClick: (e: React.MouseEvent, url: string) => void;
  trackSiteEvent: ReturnType<typeof useTrackSiteEvent>['trackSiteEvent'];
}) {
  const shownLinksRef = useRef(new Set<string>());

  // Track deeplink.shown when links are rendered (once per URL)
  useEffect(() => {
    inlines.forEach((part, index) => {
      if (part.type === 'link') {
        const key = `${part.url}:${index}`;
        if (shownLinksRef.current.has(key)) return;
        shownLinksRef.current.add(key);
        
        const metadata = parseDeeplinkUrl(part.url);
        if (metadata) {
          void trackSiteEvent({
            eventType: SITE_EVENT_ASSISTANT_DEEPLINK_SHOWN,
            metadata: {
              type: metadata.type,
              position: index,
              ...(metadata.targetId && { target_id: metadata.targetId }),
            },
          });
        }
      }
    });
  }, [inlines, trackSiteEvent]);

  return (
    <>
      {inlines.map((part, index) => {
        if (part.type === 'bold') {
          return (
            <Box key={index} component="strong" sx={{ fontWeight: 700 }}>
              {part.text}
            </Box>
          );
        }
        if (part.type === 'italic') {
          return (
            <Box key={index} component="em" sx={{ fontStyle: 'italic' }}>
              {part.text}
            </Box>
          );
        }
        if (part.type === 'link') {
          return (
            <Link
              key={index}
              href={part.url}
              onClick={(e) => onLinkClick(e, part.url)}
              sx={{
                color: 'primary.main',
                textDecorationColor: 'primary.main',
                cursor: 'pointer',
                '&:hover': {
                  textDecorationColor: 'primary.dark',
                },
              }}
            >
              {part.text}
            </Link>
          );
        }
        return <React.Fragment key={index}>{part.text}</React.Fragment>;
      })}
    </>
  );
}

type Props = {
  content: string;
  /** When false, strip markers and show plain text (e.g. mid typewriter). */
  rich?: boolean;
};

export function AssistantMarkdown({ content, rich = true }: Props) {
  const navigate = useNavigate();
  const { trackSiteEvent } = useTrackSiteEvent();
  const { t } = useTranslation();
  const { cartItems, replaceItems, addItems } = useCart();
  const { reorder } = useReorderOrder();
  const { enqueueSnackbar } = useSnackbar();
  
  // Track clicked reorder link and conflict sheet
  const [pendingReorderId, setPendingReorderId] = useState<string | undefined>(undefined);
  const [pendingPayload, setPendingPayload] = useState<ReorderOrderResponse | null>(null);
  const [sheetOpen, setSheetOpen] = useState(false);

  // Helper callbacks (declared before effect to avoid temporal dead zone)
  const toastSkips = useCallback((payload: ReorderOrderResponse) => {
    const names = payload.skipped.map((s) => s.name);
    if (!names.length) return;
    const list = formatSkippedNames(names, (n) =>
      t('orders.reorder.andMore', 'and {{count}} more', { count: n })
    );
    enqueueSnackbar(
      t('orders.reorder.skippedToast', 'Unavailable: {{names}}', { names: list }),
      { variant: 'warning' }
    );
  }, [enqueueSnackbar, t]);

  const navigateAfter = useCallback((payload: ReorderOrderResponse, cartAction: ReorderCartAction) => {
    if (!pendingReorderId) return;
    void trackSiteEvent({
      eventType: SITE_EVENT_ORDERS_REORDER_RESULT,
      subjectType: 'order',
      subjectId: pendingReorderId,
      metadata: {
        source: 'web',
        dest: payload.navigation_hint,
        skipped_count: payload.skipped.length,
        cart_action: cartAction,
      },
    });
    toastSkips(payload);
    if (payload.navigation_hint === 'none') return;
    
    if (payload.navigation_hint === 'checkout') {
      navigate('/checkout', {
        state: {
          deliveryAddressId: payload.fulfillment.address_id ?? undefined,
          fulfillmentMethod: payload.fulfillment.type,
        },
      });
      return;
    }
    
    let reorderBanner: 'business_closed' | 'address_invalid' | undefined;
    if (!payload.fulfillment.business_accepting_orders) {
      reorderBanner = 'business_closed';
    } else if (!payload.fulfillment.address_valid) {
      reorderBanner = 'address_invalid';
    }
    navigate('/cart', { state: { reorderBanner } });
  }, [navigate, pendingReorderId, toastSkips, trackSiteEvent]);

  const applyLines = useCallback((payload: ReorderOrderResponse, action: 'replace' | 'add') => {
    const items = payload.lines.map((line) => mapReorderLineToCartItem(line, payload.business_id));
    if (action === 'replace') replaceItems(items);
    else addItems(items);
    navigateAfter(payload, action);
  }, [addItems, navigateAfter, replaceItems]);

  // Handle reorder when pendingReorderId is set
  React.useEffect(() => {
    if (!pendingReorderId) return;
    let cancelled = false;
    
    const executeReorder = async () => {
      try {
        const payload = await reorder(pendingReorderId);
        if (cancelled) return;
        
        // No items? Navigate immediately
        if (payload.lines.length === 0) {
          toastSkips(payload);
          navigateAfter(payload, 'replace');
          setPendingReorderId(undefined);
          return;
        }
        
        // Check cart conflict
        const cartBizIds = [...new Set(cartItems.map((i) => i.businessId))];
        const decision = resolveReorderCartAction(cartBizIds, payload.business_id);
        
        if (decision === 'replace') {
          // Auto-replace when cart is empty or same business
          applyLines(payload, 'replace');
          setPendingReorderId(undefined);
          return;
        }
        
        // Show conflict sheet
        setPendingPayload(payload);
        setSheetOpen(true);
        
        if (decision === 'blocked_other_store') {
          enqueueSnackbar(
            t('orders.reorder.otherStoreToast', 'Your cart has items from another store'),
            { variant: 'warning' }
          );
        }
      } catch (err: any) { // eslint-disable-line @typescript-eslint/no-explicit-any
        if (cancelled) return;
        enqueueSnackbar(
          err?.response?.data?.message || 
          err?.message || 
          t('orders.reorder.failed', 'Could not reorder. Try again.'),
          { variant: 'error' }
        );
        setPendingReorderId(undefined);
      }
    };
    
    void executeReorder();
    return () => { cancelled = true; };
  }, [pendingReorderId, reorder, cartItems, enqueueSnackbar, t, applyLines, navigateAfter, toastSkips]);

  const onReplace = useCallback(() => {
    if (!pendingPayload) return;
    setSheetOpen(false);
    applyLines(pendingPayload, 'replace');
    setPendingPayload(null);
    setPendingReorderId(undefined);
  }, [applyLines, pendingPayload]);

  const onAdd = useCallback(() => {
    if (!pendingPayload) return;
    const cartBizIds = [...new Set(cartItems.map((i) => i.businessId))];
    const decision = resolveReorderCartAction(cartBizIds, pendingPayload.business_id);
    if (decision === 'blocked_other_store') {
      enqueueSnackbar(
        t('orders.reorder.otherStoreToast', 'Your cart has items from another store'),
        { variant: 'warning' }
      );
      return;
    }
    setSheetOpen(false);
    applyLines(pendingPayload, 'add');
    setPendingPayload(null);
    setPendingReorderId(undefined);
  }, [applyLines, cartItems, enqueueSnackbar, pendingPayload, t]);

  const onDismissSheet = useCallback(() => {
    setSheetOpen(false);
    setPendingPayload(null);
    setPendingReorderId(undefined);
  }, []);

  const allowAdd = !!pendingPayload && 
    resolveReorderCartAction(
      [...new Set(cartItems.map((i) => i.businessId))],
      pendingPayload.business_id
    ) !== 'blocked_other_store';

  const handleLinkClick = useCallback(
    async (e: React.MouseEvent, url: string) => {
      e.preventDefault();
      
      // Track deeplink.tap with allowlisted metadata
      const deeplinkMetadata = parseDeeplinkUrl(url);
      if (deeplinkMetadata) {
        void trackSiteEvent({
          eventType: SITE_EVENT_ASSISTANT_DEEPLINK_TAP,
          metadata: {
            type: deeplinkMetadata.type,
            ...(deeplinkMetadata.targetId && { target_id: deeplinkMetadata.targetId }),
          },
        });
      }

      // Check for reorder links first
      const reorderMatch = url.match(/\/orders\/([^/?]+)\/reorder/);
      if (reorderMatch) {
        const orderId = reorderMatch[1];
        void trackSiteEvent({
          eventType: SITE_EVENT_ORDERS_REORDER_TAP,
          subjectType: 'order',
          subjectId: orderId,
          metadata: { source: 'web' },
        });
        setPendingReorderId(orderId);
        return;
      }

      // Try in-app navigation for relative paths
      if (url.startsWith('/')) {
        navigate(url);
        return;
      }

      // Check if absolute URL is same-origin (or *.rendasua.com)
      if (url.startsWith('http://') || url.startsWith('https://')) {
        try {
          const urlObj = new URL(url);
          const currentOrigin = window.location.origin;
          const isSameOrigin = urlObj.origin === currentOrigin;
          const isRendasuaDomain =
            urlObj.hostname.endsWith('.rendasua.com') ||
            urlObj.hostname === 'rendasua.com';

          if (isSameOrigin || isRendasuaDomain) {
            // Same origin or Rendasua domain - navigate in-app to pathname + search
            navigate(urlObj.pathname + urlObj.search);
            return;
          }
        } catch {
          // Invalid URL - fall through to external open
        }

        // External URLs open in new tab
        window.open(url, '_blank', 'noopener,noreferrer');
        return;
      }

      // Relative URLs navigate
      navigate(url);
    },
    [navigate, trackSiteEvent]
  );

  if (!rich) {
    return (
      <Typography variant="body2" sx={{ whiteSpace: 'pre-wrap', lineHeight: 1.7 }}>
        {stripAssistantMarkdown(content)}
      </Typography>
    );
  }

  const blocks = parseAssistantMarkdown(content);
  return (
    <>
      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
        {blocks.map((block, index) => {
          if (block.type === 'bullet') {
            return (
              <Box
                key={index}
                sx={{
                  display: 'flex',
                  alignItems: 'flex-start',
                  gap: 1,
                }}
              >
                <Typography variant="body2" sx={{ lineHeight: 1.7, fontWeight: 700 }}>
                  •
                </Typography>
                <Typography variant="body2" sx={{ lineHeight: 1.7, flex: 1, minWidth: 0 }}>
                  <InlineRuns inlines={block.inlines} onLinkClick={handleLinkClick} trackSiteEvent={trackSiteEvent} />
                </Typography>
              </Box>
            );
          }
          return (
            <Typography key={index} variant="body2" sx={{ lineHeight: 1.7, whiteSpace: 'pre-wrap' }}>
              <InlineRuns inlines={block.inlines} onLinkClick={handleLinkClick} trackSiteEvent={trackSiteEvent} />
            </Typography>
          );
        })}
      </Box>
      <ReorderCartConflictDialog
        open={sheetOpen}
        allowAdd={allowAdd}
        otherStoreBlocked={!!pendingPayload && !allowAdd}
        onReplace={onReplace}
        onAdd={onAdd}
        onCancel={onDismissSheet}
      />
    </>
  );
}
