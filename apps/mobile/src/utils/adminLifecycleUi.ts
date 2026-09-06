export function accurateLifecyclePill(
  status: string | undefined,
  colors: {
    success: { main: string; dark?: string };
    warning: { main: string; dark?: string };
    error: { main: string; dark?: string };
    info: { main: string; dark?: string };
    text: { secondary: string };
    background: { paper: string };
  },
  t: (key: string, defaultValue: string) => string
): { label: string; backgroundColor: string; textColor: string } {
  switch (status) {
    case 'active':
      return {
        label: t('admin.businesses.lifecycle.active', 'Active'),
        backgroundColor: `${colors.success.main}22`,
        textColor: colors.success.dark ?? colors.success.main,
      };
    case 'suspended':
      return {
        label: t('admin.businesses.lifecycle.suspended', 'Suspended'),
        backgroundColor: `${colors.error.main}22`,
        textColor: colors.error.dark ?? colors.error.main,
      };
    case 'contract_signed':
      return {
        label: t('admin.businesses.lifecycle.contractSigned', 'Contract signed'),
        backgroundColor: `${colors.info.main}22`,
        textColor: colors.info.dark ?? colors.info.main,
      };
    case 'created':
      return {
        label: t('admin.businesses.lifecycle.draft', 'Draft'),
        backgroundColor: `${colors.warning.main}18`,
        textColor: colors.warning.dark ?? colors.warning.main,
      };
    default:
      return {
        label: status || t('admin.businesses.lifecycle.unknown', 'Unknown'),
        backgroundColor: colors.background.paper,
        textColor: colors.text.secondary,
      };
  }
}
