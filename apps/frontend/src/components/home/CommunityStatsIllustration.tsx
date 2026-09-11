import { Box, Skeleton, Stack } from '@mui/material';
import { alpha } from '@mui/material/styles';
import { useReducedMotion } from 'framer-motion';
import React from 'react';
import { useTranslation } from 'react-i18next';
import { HOME_ACCENTS } from './homeTheme';

type StatCounts = {
  clients: number;
  agents: number;
  businesses: number;
  products: number;
};

type CommunityStatsIllustrationProps = {
  counts?: StatCounts;
  loading?: boolean;
};

const HUB = { x: 280, y: 128, r: 42 };
const NODE_R = 30;

const CommunityStatsIllustration: React.FC<CommunityStatsIllustrationProps> = ({
  counts,
  loading = false,
}) => {
  const { t } = useTranslation();
  const reduceMotion = Boolean(useReducedMotion());
  const nodes = buildNodes(counts, t);

  if (loading) {
    return (
      <Stack alignItems="center" sx={{ mb: { xs: 1, md: 2 } }}>
        <Skeleton
          variant="rounded"
          sx={{ width: '100%', maxWidth: 520, height: { xs: 220, md: 280 }, borderRadius: 4 }}
        />
      </Stack>
    );
  }

  return (
    <Box
      sx={{
        display: 'flex',
        justifyContent: 'center',
        mb: { xs: 1, md: 2 },
        px: 1,
      }}
    >
      <Box
        component="svg"
        viewBox="0 0 560 300"
        role="img"
        aria-label={t(
          'home.stats.illustrationAria',
          'Rendasua marketplace connecting clients, agents, businesses, and products'
        )}
        sx={{
          width: '100%',
          maxWidth: { xs: 380, sm: 480, md: 540 },
          height: 'auto',
          overflow: 'visible',
        }}
      >
        <defs>
          <filter id="communityGlow" x="-50%" y="-50%" width="200%" height="200%">
            <feGaussianBlur stdDeviation="6" result="blur" />
            <feMerge>
              <feMergeNode in="blur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
          <radialGradient id="hubFill" cx="50%" cy="38%" r="72%">
            <stop offset="0%" stopColor="#FFFFFF" />
            <stop offset="55%" stopColor={alpha(HOME_ACCENTS.primary, 0.1)} />
            <stop offset="100%" stopColor={alpha(HOME_ACCENTS.primary, 0.18)} />
          </radialGradient>
          <linearGradient id="stageFill" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor={alpha(HOME_ACCENTS.primary, 0.04)} />
            <stop offset="50%" stopColor={alpha(HOME_ACCENTS.delivery, 0.03)} />
            <stop offset="100%" stopColor={alpha(HOME_ACCENTS.business, 0.04)} />
          </linearGradient>
        </defs>

        <rect x="24" y="8" width="512" height="284" rx="28" fill="url(#stageFill)" />
        <AmbientBackdrop />

        {nodes.map((node) => (
          <FlowLink
            key={`link-${node.key}`}
            color={node.color}
            x={node.x}
            y={node.y}
            animate={!reduceMotion}
          />
        ))}

        <HubCenter
          subtitle={t('home.stats.hubSubtitle', 'Marketplace')}
          animate={!reduceMotion}
        />

        {nodes.map((node) => (
          <PersonaNode key={node.key} node={node} animate={!reduceMotion} />
        ))}
      </Box>
    </Box>
  );
};

function buildNodes(
  counts: StatCounts | undefined,
  t: (key: string, fallback: string) => string
) {
  return [
    {
      key: 'clients',
      x: 92,
      y: 58,
      color: HOME_ACCENTS.primary,
      label: t('home.stats.clients', 'Clients'),
      value: counts?.clients,
      icon: 'clients' as const,
    },
    {
      key: 'businesses',
      x: 468,
      y: 58,
      color: HOME_ACCENTS.business,
      label: t('home.stats.businesses', 'Businesses'),
      value: counts?.businesses,
      icon: 'shops' as const,
    },
    {
      key: 'agents',
      x: 92,
      y: 208,
      color: HOME_ACCENTS.delivery,
      label: t('home.stats.agents', 'Agents'),
      value: counts?.agents,
      icon: 'agents' as const,
    },
    {
      key: 'products',
      x: 468,
      y: 208,
      color: HOME_ACCENTS.info,
      label: t('home.stats.products', 'Products'),
      value: counts?.products,
      icon: 'products' as const,
    },
  ];
}

const AmbientBackdrop: React.FC = () => (
  <g opacity={0.7}>
    <circle cx={HUB.x} cy={HUB.y} r="88" fill={alpha(HOME_ACCENTS.primary, 0.04)} />
    <circle
      cx={HUB.x}
      cy={HUB.y}
      r="118"
      fill="none"
      stroke={alpha(HOME_ACCENTS.primary, 0.08)}
      strokeWidth="1"
      strokeDasharray="3 10"
    />
  </g>
);

const HubCenter: React.FC<{ subtitle: string; animate: boolean }> = ({
  subtitle,
  animate,
}) => (
  <g filter="url(#communityGlow)">
    {animate ? (
      <circle
        cx={HUB.x}
        cy={HUB.y}
        r={HUB.r + 6}
        fill="none"
        stroke={alpha(HOME_ACCENTS.primary, 0.3)}
        strokeWidth="1.5"
      >
        <animate
          attributeName="r"
          values={`${HUB.r + 4};${HUB.r + 14};${HUB.r + 4}`}
          dur="3.2s"
          repeatCount="indefinite"
        />
        <animate
          attributeName="opacity"
          values="0.55;0.12;0.55"
          dur="3.2s"
          repeatCount="indefinite"
        />
      </circle>
    ) : null}
    <circle
      cx={HUB.x}
      cy={HUB.y}
      r={HUB.r}
      fill="url(#hubFill)"
      stroke={HOME_ACCENTS.primary}
      strokeWidth="2.5"
    />
    <text
      x={HUB.x}
      y={HUB.y - 4}
      textAnchor="middle"
      fill={HOME_ACCENTS.primary}
      fontSize="15"
      fontWeight="800"
      letterSpacing="-0.02em"
    >
      Rendasua
    </text>
    <text
      x={HUB.x}
      y={HUB.y + 14}
      textAnchor="middle"
      fill={HOME_ACCENTS.muted}
      fontSize="10"
      fontWeight="600"
      letterSpacing="0.04em"
    >
      {subtitle}
    </text>
  </g>
);

type NodeDef = ReturnType<typeof buildNodes>[number];

function rimPoint(fromX: number, fromY: number, toX: number, toY: number, r: number) {
  const dx = toX - fromX;
  const dy = toY - fromY;
  const len = Math.hypot(dx, dy) || 1;
  return {
    x: fromX + (dx / len) * r,
    y: fromY + (dy / len) * r,
  };
}

const FlowLink: React.FC<{
  color: string;
  x: number;
  y: number;
  animate: boolean;
}> = ({ color, x, y, animate }) => {
  const start = rimPoint(x, y, HUB.x, HUB.y, NODE_R + 2);
  const end = rimPoint(HUB.x, HUB.y, x, y, HUB.r + 2);
  const midX = (start.x + end.x) / 2;
  const midY = (start.y + end.y) / 2 + (y < HUB.y ? -16 : 16);
  const path = `M ${start.x} ${start.y} Q ${midX} ${midY} ${end.x} ${end.y}`;

  return (
    <g>
      <path
        d={path}
        fill="none"
        stroke={alpha(color, 0.16)}
        strokeWidth="7"
        strokeLinecap="round"
      />
      <path
        d={path}
        fill="none"
        stroke={color}
        strokeWidth="1.8"
        strokeDasharray="5 7"
        strokeLinecap="round"
        opacity={0.9}
      >
        {animate ? (
          <animate
            attributeName="stroke-dashoffset"
            values="0;-48"
            dur="2.2s"
            repeatCount="indefinite"
          />
        ) : null}
      </path>
      {animate ? (
        <circle r="3.2" fill={color}>
          <animateMotion dur="2.8s" repeatCount="indefinite" path={path} />
          <animate
            attributeName="opacity"
            values="0;1;1;0"
            keyTimes="0;0.15;0.85;1"
            dur="2.8s"
            repeatCount="indefinite"
          />
        </circle>
      ) : null}
    </g>
  );
};

const PersonaNode: React.FC<{ node: NodeDef; animate: boolean }> = ({
  node,
  animate,
}) => (
  <g>
    {animate ? (
      <circle
        cx={node.x}
        cy={node.y}
        r={NODE_R + 6}
        fill="none"
        stroke={alpha(node.color, 0.28)}
        strokeWidth="1.25"
      >
        <animate
          attributeName="r"
          values={`${NODE_R + 4};${NODE_R + 9};${NODE_R + 4}`}
          dur="2.8s"
          repeatCount="indefinite"
        />
        <animate
          attributeName="opacity"
          values="0.5;0.12;0.5"
          dur="2.8s"
          repeatCount="indefinite"
        />
      </circle>
    ) : null}
    <circle
      cx={node.x}
      cy={node.y}
      r={NODE_R}
      fill="#FFFFFF"
      stroke={node.color}
      strokeWidth="2"
    />
    <circle
      cx={node.x}
      cy={node.y}
      r={NODE_R - 3}
      fill={alpha(node.color, 0.1)}
    />
    <NodeIcon kind={node.icon} cx={node.x} cy={node.y - 2} color={node.color} />
    <text
      x={node.x}
      y={node.y + NODE_R + 18}
      textAnchor="middle"
      fill={node.color}
      fontSize="12"
      fontWeight="700"
    >
      {node.label}
    </text>
    {typeof node.value === 'number' ? (
      <text
        x={node.x}
        y={node.y + NODE_R + 38}
        textAnchor="middle"
        fill={HOME_ACCENTS.ink}
        fontSize="18"
        fontWeight="800"
      >
        {node.value.toLocaleString()}
      </text>
    ) : null}
  </g>
);

const NodeIcon: React.FC<{
  kind: NodeDef['icon'];
  cx: number;
  cy: number;
  color: string;
}> = ({ kind, cx, cy, color }) => {
  if (kind === 'clients') {
    return (
      <g fill={color}>
        <circle cx={cx - 5} cy={cy - 5} r="3.4" />
        <circle cx={cx + 6} cy={cy - 3} r="2.7" />
        <path d={`M ${cx - 13} ${cy + 8} Q ${cx - 5} ${cy + 1} ${cx + 2} ${cy + 8} Z`} />
        <path
          d={`M ${cx} ${cy + 8} Q ${cx + 6} ${cy + 2} ${cx + 13} ${cy + 8} Z`}
          opacity={0.75}
        />
      </g>
    );
  }
  if (kind === 'agents') {
    return (
      <g fill="none" stroke={color} strokeWidth="1.8" strokeLinecap="round">
        <circle cx={cx - 7} cy={cy + 5} r="4.2" />
        <circle cx={cx + 8} cy={cy + 5} r="4.2" />
        <path d={`M ${cx - 7} ${cy + 5} L ${cx + 1} ${cy - 4} L ${cx + 8} ${cy + 5}`} />
        <path d={`M ${cx + 1} ${cy - 4} L ${cx + 1} ${cy - 10}`} />
      </g>
    );
  }
  if (kind === 'shops') {
    return (
      <g fill="none" stroke={color} strokeWidth="1.8" strokeLinejoin="round">
        <path
          d={`M ${cx - 11} ${cy} L ${cx - 11} ${cy + 9} L ${cx + 11} ${cy + 9} L ${cx + 11} ${cy}`}
        />
        <path
          d={`M ${cx - 13} ${cy} L ${cx - 9} ${cy - 9} L ${cx + 9} ${cy - 9} L ${cx + 13} ${cy} Z`}
        />
        <path
          d={`M ${cx - 2} ${cy + 9} L ${cx - 2} ${cy + 2} L ${cx + 3} ${cy + 2} L ${cx + 3} ${cy + 9}`}
        />
      </g>
    );
  }
  return (
    <g fill="none" stroke={color} strokeWidth="1.8" strokeLinejoin="round">
      <rect x={cx - 9} y={cy - 3} width="18" height="13" rx="1.5" />
      <path d={`M ${cx - 9} ${cy} L ${cx} ${cy - 9} L ${cx + 9} ${cy}`} />
      <path d={`M ${cx} ${cy - 9} L ${cx} ${cy + 10}`} />
    </g>
  );
};

export default CommunityStatsIllustration;
