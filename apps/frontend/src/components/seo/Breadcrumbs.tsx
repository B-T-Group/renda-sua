import { Link, Breadcrumbs as MuiBreadcrumbs, Typography } from '@mui/material';
import { useTranslation } from 'react-i18next';
import { Link as RouterLink, useLocation } from 'react-router-dom';
import StructuredData, { BreadcrumbStructuredData } from './StructuredData';

interface BreadcrumbItem {
  label: string;
  path: string;
  isActive?: boolean;
}

interface BreadcrumbsProps {
  items?: BreadcrumbItem[];
  showHome?: boolean;
}

const Breadcrumbs: React.FC<BreadcrumbsProps> = ({
  items = [],
  showHome = true,
}) => {
  const { t } = useTranslation();
  const location = useLocation();

  const generateBreadcrumbs = (): BreadcrumbItem[] => {
    const pathSegments = location.pathname.split('/').filter(Boolean);
    const breadcrumbs: BreadcrumbItem[] = [];

    if (showHome) {
      breadcrumbs.push({
        label: t('common.home'),
        path: '/',
        isActive: location.pathname === '/',
      });
    }

    let currentPath = '';
    pathSegments.forEach((segment, index) => {
      currentPath += `/${segment}`;

      // Convert segment to readable label
      const label = segment
        .split('-')
        .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
        .join(' ');

      breadcrumbs.push({
        label: t(`breadcrumbs.${segment}`, label),
        path: currentPath,
        isActive: index === pathSegments.length - 1,
      });
    });

    return breadcrumbs;
  };

  const breadcrumbItems = items.length > 0 ? items : generateBreadcrumbs();

  const structuredData: BreadcrumbStructuredData = {
    items: breadcrumbItems.map((item) => ({
      name: item.label,
      url: `${window.location.origin}${item.path}`,
    })),
  };

  return (
    <>
      <StructuredData type="breadcrumb" data={structuredData} />
      <MuiBreadcrumbs
        aria-label="breadcrumb"
        sx={{ mb: 2, '& .MuiBreadcrumbs-separator': { mx: 1 } }}
      >
        {breadcrumbItems.map((item, index) => (
          <div key={item.path}>
            {item.isActive ? (
              <Typography color="text.primary" sx={{ fontWeight: 500 }}>
                {item.label}
              </Typography>
            ) : (
              <Link
                component={RouterLink}
                to={item.path}
                color="inherit"
                underline="hover"
                sx={{
                  textDecoration: 'none',
                  '&:hover': { textDecoration: 'underline' },
                }}
              >
                {item.label}
              </Link>
            )}
          </div>
        ))}
      </MuiBreadcrumbs>
    </>
  );
};

export default Breadcrumbs;
