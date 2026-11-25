import React from 'react';

const NARROW_PAGINATION_QUERY = '(max-width: 640px)';

function useNarrowPagination() {
  const [matches, setMatches] = React.useState(() => (
    typeof window !== 'undefined' && window.matchMedia(NARROW_PAGINATION_QUERY).matches
  ));

  React.useEffect(() => {
    const media = window.matchMedia(NARROW_PAGINATION_QUERY);
    const onChange = () => setMatches(media.matches);
    onChange();
    media.addEventListener('change', onChange);
    return () => media.removeEventListener('change', onChange);
  }, []);

  return matches;
}

export function PaginationBar({ 
  currentPage, 
  totalPages, 
  totalResults,
  onPageChange, 
  onNext, 
  onPrevious,
  isLoading,
  canGoNext,
  canGoPrevious
}) {
  const paginationRef = React.useRef(null);
  const narrow = useNarrowPagination();
  const CHUNK_SIZE = 100; // Progressive navigation chunk size
  
  // Reset scroll position when page changes
  React.useEffect(() => {
    if (paginationRef.current) {
      paginationRef.current.scrollLeft = 0;
    }
  }, [currentPage]);

  // Calculate the next chunk boundary
  // If on a chunk boundary (100, 200, etc), show the next chunk
  // Otherwise show the end of current chunk
  const nextChunkEnd = Math.ceil(currentPage / CHUNK_SIZE) * CHUNK_SIZE;
  const actualNextChunk = currentPage === nextChunkEnd ? nextChunkEnd + CHUNK_SIZE : nextChunkEnd;
  const displayedNextChunk = Math.min(actualNextChunk, totalPages);
  const showProgressiveLast = displayedNextChunk > currentPage && displayedNextChunk < totalPages;

  const renderPageNumberButtons = () => {
    if (!totalPages || totalPages <= 1) return null;

    const buttons = [];
    const maxToShow = narrow ? 3 : 5;
    const side = Math.floor((maxToShow - 1) / 2);

    // Show pages around current page
    let start = Math.max(1, currentPage - side);
    let end = Math.min(totalPages, start + maxToShow - 1);

    if (end - start < maxToShow - 1) {
      start = Math.max(1, end - maxToShow + 1);
    }

    const pushPageButton = (p) => {
      buttons.push(
        <button
          key={p}
          type="button"
          className={
            p === currentPage
              ? 'secondary-button page-button page-button-active'
              : 'secondary-button page-button'
          }
          onClick={() => onPageChange(p)}
          disabled={isLoading || p === currentPage}
          aria-label={`Go to page ${p}`}
          aria-current={p === currentPage ? 'page' : undefined}
        >
          {p}
        </button>
      );
    };

    // On a wide screen, keep a shortcut back to the first page.
    if (!narrow && start > 1) {
      pushPageButton(1);
      if (start > 2) {
        buttons.push(
          <span key="start-ellipsis" className="page-ellipsis" aria-hidden="true">
            …
          </span>
        );
      }
    }

    for (let p = start; p <= end; p += 1) {
      pushPageButton(p);
    }

    // Show progressive "last" page (next chunk boundary)
    // Phone: three nearby pages, then the next jump (100, 200, …).
    if (narrow) {
      if (displayedNextChunk > end) {
        if (displayedNextChunk > end + 1) {
          buttons.push(
            <span key="end-ellipsis" className="page-ellipsis" aria-hidden="true">
              …
            </span>
          );
        }
        pushPageButton(displayedNextChunk);
      }
    } else if (showProgressiveLast && end < displayedNextChunk) {
      buttons.push(
        <span key="end-ellipsis" className="page-ellipsis" aria-hidden="true">
          …
        </span>
      );
      pushPageButton(displayedNextChunk);
    }

    return buttons;
  };

  // Don't show pagination if there are no results yet
  if (!totalPages) {
    return null;
  }

  return (
    <div className="pagination-bar" role="navigation" aria-label="Pagination">
      {/* Total results info */}
      {typeof totalResults === 'number' && (
        <div className="pagination-info" style={{ fontSize: '0.9rem', color: '#94a3b8', marginBottom: '0.5rem', textAlign: 'center' }}>
          {totalResults.toLocaleString()} wallpapers found • Page {currentPage.toLocaleString()} of {totalPages.toLocaleString()}
        </div>
      )}
      
      <div className="pagination-buttons" ref={paginationRef} style={{ scrollBehavior: 'smooth' }}>
        <button
          type="button"
          className="secondary-button"
          onClick={onPrevious}
          disabled={!canGoPrevious || isLoading}
          aria-label="Previous page"
        >
          Prev
        </button>

        {renderPageNumberButtons()}

        <button
          type="button"
          className="secondary-button"
          onClick={onNext}
          disabled={!canGoNext || isLoading}
          aria-label="Next page"
        >
          Next
        </button>
      </div>
    </div>
  );
}
