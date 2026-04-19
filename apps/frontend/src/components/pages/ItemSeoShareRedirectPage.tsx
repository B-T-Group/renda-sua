import { Navigate, useParams } from 'react-router-dom';

/**
 * Fallback when users open `/items/:id/seo` on the SPA host without hitting the
 * share HTML endpoint (e.g. local dev). Sends them to the real item page.
 */
export default function ItemSeoShareRedirectPage() {
  const { id } = useParams<{ id: string }>();
  if (!id) {
    return <Navigate to="/items" replace />;
  }
  return <Navigate to={`/items/${id}`} replace />;
}
