import { useState, useCallback, useEffect } from 'react';
import { useLocation, useNavigate, useSearchParams } from 'react-router-dom';

export interface SearchResult {
  id: string;
  name: string;
  description?: string;
  price?: number;
  business_name?: string;
  category?: string;
}

export const useItemSearch = () => {
  const [searchTerm, setSearchTerm] = useState('');
  const [searchResults, setSearchResults] = useState<SearchResult[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const navigate = useNavigate();
  const location = useLocation();
  const [searchParams] = useSearchParams();

  useEffect(() => {
    if (location.pathname !== '/items') return;
    const q = searchParams.get('search') ?? '';
    setSearchTerm(q);
  }, [location.pathname, searchParams]);

  const performSearch = useCallback(async (term: string) => {
    const q = term.trim();
    if (!q) {
      setSearchResults([]);
      return;
    }

    setIsSearching(true);

    try {
      const qs = new URLSearchParams({ search: q }).toString();
      const target = `/items?${qs}`;
      if (location.pathname === '/items') {
        navigate(target, { replace: true });
      } else {
        navigate(target);
      }
    } catch (error) {
      console.error('Search error:', error);
    } finally {
      setIsSearching(false);
    }
  }, [navigate, location.pathname]);

  const handleSearchSubmit = useCallback((term: string) => {
    performSearch(term);
  }, [performSearch]);

  const clearSearch = useCallback(() => {
    setSearchTerm('');
    setSearchResults([]);
  }, []);

  return {
    searchTerm,
    setSearchTerm,
    searchResults,
    isSearching,
    handleSearchSubmit,
    clearSearch,
  };
};

