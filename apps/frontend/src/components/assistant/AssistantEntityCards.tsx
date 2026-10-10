import { Box, Button, Stack, Typography } from '@mui/material';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { useLoginMethodDialog } from '../../hooks/useLoginMethodDialog';
import { AssistantMarkdown } from '../pages/AssistantMarkdown';
import type { AssistantResultCard } from './assistantResultCards';

const ACTION_KEYS = {
  item: ['assistant.card.viewItem', 'View item'],
  order: ['assistant.card.viewOrder', 'View order'],
  rental: ['assistant.card.viewRental', 'View rental'],
  store: ['assistant.card.viewStore', 'View restaurant'],
  sign_in: ['assistant.card.signIn', 'Sign in'],
} as const;

export function AssistantEntityCards({ cards }: { cards: AssistantResultCard[] }) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { openLoginDialog, loginMethodDialog } = useLoginMethodDialog('/assistant');
  if (!cards.length) return null;

  return (
    <Stack spacing={1} sx={{ mt: 1, width: '100%' }} data-testid="assistant-entity-cards">
      {cards.map((card) => (
        <EntityCard
          key={`${card.kind}:${card.id}`}
          card={card}
          actionLabel={t(ACTION_KEYS[card.kind][0], ACTION_KEYS[card.kind][1])}
          onOpen={() => openCard(card, navigate, openLoginDialog)}
        />
      ))}
      {loginMethodDialog}
    </Stack>
  );
}

function EntityCard({
  card,
  actionLabel,
  onOpen,
}: {
  card: AssistantResultCard;
  actionLabel: string;
  onOpen: () => void;
}) {
  const { t } = useTranslation();
  const title = card.kind === 'sign_in'
    ? t('assistant.card.signInTitle', 'Sign in to see your account')
    : card.title || '';
  return (
    <Box
      sx={{
        display: 'flex',
        gap: 1.5,
        p: 1.25,
        borderRadius: 2,
        border: 1,
        borderColor: 'divider',
        bgcolor: 'background.paper',
      }}
    >
      {card.kind !== 'sign_in' ? <CardImage url={card.imageUrl} title={title} /> : null}
      <Box sx={{ minWidth: 0, flex: 1 }}>
        <Typography variant="subtitle2" noWrap>{title}</Typography>
        {card.priceLabel ? (
          <Typography variant="body2" color="text.secondary">{card.priceLabel}</Typography>
        ) : null}
        <Stack direction="row" spacing={1} sx={{ mt: 1 }} alignItems="center">
          <Button size="small" variant="contained" onClick={onOpen}>{actionLabel}</Button>
          {card.secondaryHref ? <ReorderLink href={card.secondaryHref} /> : null}
        </Stack>
      </Box>
    </Box>
  );
}

function CardImage({ url, title }: { url?: string | null; title: string }) {
  const [failed, setFailed] = useState(false);
  if (!url || failed) {
    return <Box sx={{ width: 72, height: 72, borderRadius: 1, bgcolor: 'action.hover', flexShrink: 0 }} />;
  }
  return (
    <Box
      component="img"
      src={url}
      alt={title}
      onError={() => setFailed(true)}
      sx={{ width: 72, height: 72, borderRadius: 1, objectFit: 'cover', flexShrink: 0 }}
    />
  );
}

function ReorderLink({ href }: { href: string }) {
  const { t } = useTranslation();
  const label = t('assistant.card.reorder', 'Reorder');
  return (
    <Box sx={{ '& p': { m: 0 }, '& a': { fontWeight: 600 } }}>
      <AssistantMarkdown content={`[${label}](${href})`} rich />
    </Box>
  );
}

function openCard(
  card: AssistantResultCard,
  navigate: (path: string) => void,
  openLogin: () => void
) {
  if (card.kind === 'sign_in') {
    openLogin();
    return;
  }
  if (card.href) navigate(card.href);
}
