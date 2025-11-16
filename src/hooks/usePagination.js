import { useState, useCallback } from 'react';

/**
 * Custom hook for pagination logic
 */
export function usePagination(initialPage = 1) {
  const [page, setPage] = useState(initialPage);
  const [totalPages, setTotalPages] = useState(null);

  const goToPage = useCallback((targetPage) => {
    if (!targetPage) return;
    const max = totalPages && totalPages > 0 ? totalPages : targetPage;
    const next = Math.min(Math.max(1, targetPage), max);
    setPage(next);
    return next;
  }, [totalPages]);

  const goToNextPage = useCallback(() => {
    setPage((current) => {
      const next = current + 1;
      if (totalPages && next > totalPages) {
        return current;
      }
      return next;
    });
  }, [totalPages]);

  const goToPreviousPage = useCallback(() => {
    setPage((current) => (current > 1 ? current - 1 : 1));
  }, []);

  const resetPage = useCallback(() => {
    setPage(1);
  }, []);

  const canGoNext = totalPages ? page < totalPages : true;
  const canGoPrevious = page > 1;

  return {
    page,
    totalPages,
    setPage,
    setTotalPages,
    goToPage,
    goToNextPage,
    goToPreviousPage,
    resetPage,
    canGoNext,
    canGoPrevious,
  };
}
