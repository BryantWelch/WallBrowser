import React from 'react';

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
    const maxToShow = 5;

    // Show pages around current page
    let start = Math.max(1, currentPage - 2);
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

    // Show first page if not visible
    if (start > 1) {
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
    if (showProgressiveLast && end < displayedNextChunk) {
      if (end < displayedNextChunk - 1) {
        buttons.push(
          <span key="end-ellipsis" className="page-ellipsis" aria-hidden="true">
            …
          </span>
        );
      }
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
      {totalResults && (
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
