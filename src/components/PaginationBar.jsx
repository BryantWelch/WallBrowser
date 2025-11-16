import React from 'react';

export function PaginationBar({ 
  currentPage, 
  totalPages, 
  onPageChange, 
  onNext, 
  onPrevious,
  isLoading,
  canGoNext,
  canGoPrevious
}) {
  const renderPageNumberButtons = () => {
    if (!totalPages || totalPages <= 1) return null;

    const buttons = [];
    const maxToShow = 5;

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

    if (end < totalPages) {
      if (end < totalPages - 1) {
        buttons.push(
          <span key="end-ellipsis" className="page-ellipsis" aria-hidden="true">
            …
          </span>
        );
      }
      pushPageButton(totalPages);
    }

    return buttons;
  };

  // Don't show pagination if there are no results yet
  if (!totalPages) {
    return null;
  }

  return (
    <div className="pagination-bar" role="navigation" aria-label="Pagination">
      <div className="pagination-buttons">
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
