import { useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';

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

  const performSearch = useCallback(async (term: string) => {
    if (!term.trim()) {
      setSearchResults([]);
      return;
    }

    setIsSearching(true);
    
    try {
      // For now, we'll navigate to the items page with search query
      // Later this can be enhanced with actual search API
      const searchParams = new URLSearchParams({ search: term });
      navigate(`/items?${searchParams.toString()}`);
    } catch (error) {
      console.error('Search error:', error);
    } finally {
      setIsSearching(false);
    }
  }, [navigate]);

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
