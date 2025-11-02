import React from 'react';
import { ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight, ChevronDown } from 'lucide-react';
import { clsx } from 'clsx';

interface PaginationProps {
  currentPage: number;
  totalPages: number;
  itemsPerPage: number;
  totalItems: number;
  onPageChange: (page: number) => void;
  onItemsPerPageChange: (itemsPerPage: number) => void;
  itemsPerPageOptions?: number[];
}

const Pagination: React.FC<PaginationProps> = ({
  currentPage,
  totalPages,
  itemsPerPage,
  totalItems,
  onPageChange,
  onItemsPerPageChange,
  itemsPerPageOptions = [10, 25, 50, 100]
}) => {
  const handleFirstPage = () => onPageChange(1);
  const handlePrevPage = () => onPageChange(Math.max(1, currentPage - 1));
  const handleNextPage = () => onPageChange(Math.min(totalPages, currentPage + 1));
  const handleLastPage = () => onPageChange(totalPages);

  const startItem = totalItems === 0 ? 0 : (currentPage - 1) * itemsPerPage + 1;
  const endItem = Math.min(currentPage * itemsPerPage, totalItems);

  return (
    <div className="flex flex-col sm:flex-row items-center justify-between gap-3 sm:gap-4 px-3 sm:px-4 md:px-6 py-3 sm:py-4 bg-white dark:bg-[#161616] border-t border-gray-100 dark:border-gray-800">
      {/* Left side - Items per page */}
      <div className="flex items-center space-x-2 sm:space-x-3 w-full sm:w-auto justify-center sm:justify-start">
        <span className="text-xs sm:text-sm text-gray-600 dark:text-gray-400 hidden sm:inline">Items per page:</span>
        <span className="text-xs sm:text-sm text-gray-600 dark:text-gray-400 sm:hidden">Show:</span>
        <div className="relative">
          <select
            value={itemsPerPage}
            onChange={(e) => onItemsPerPageChange(Number(e.target.value))}
            className="appearance-none px-2 sm:px-3 py-1 sm:py-1.5 pr-6 sm:pr-8 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg text-xs sm:text-sm font-medium text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500 cursor-pointer"
          >
            {itemsPerPageOptions.map(option => (
              <option key={option} value={option}>
                {option}
              </option>
            ))}
          </select>
          <ChevronDown className="absolute right-1 sm:right-2 top-1/2 transform -translate-y-1/2 w-3 sm:w-4 h-3 sm:h-4 text-gray-400 pointer-events-none" />
        </div>
        <span className="text-xs sm:text-sm text-gray-600 dark:text-gray-400">
          {startItem}-{endItem} of {totalItems}
        </span>
      </div>

      {/* Center - Page indicator - Hidden on mobile to save space */}
      <div className="hidden md:flex items-center space-x-2">
        <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
          Page {totalPages === 0 ? 0 : currentPage} of {totalPages}
        </span>
      </div>

      {/* Right side - Navigation buttons */}
      <div className="flex items-center space-x-1.5 sm:space-x-2">
        {/* First page button - hidden on mobile */}
        <button
          onClick={handleFirstPage}
          disabled={currentPage === 1 || totalPages === 0}
          className={clsx(
            'hidden sm:block p-1.5 sm:p-2 rounded-lg border transition-colors',
            currentPage === 1 || totalPages === 0
              ? 'border-gray-200 dark:border-gray-700 text-gray-300 dark:text-gray-600 cursor-not-allowed'
              : 'border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800'
          )}
          title="First page"
        >
          <ChevronsLeft className="w-3.5 sm:w-4 h-3.5 sm:h-4" />
        </button>
        
        {/* Previous page button */}
        <button
          onClick={handlePrevPage}
          disabled={currentPage === 1 || totalPages === 0}
          className={clsx(
            'p-1.5 sm:p-2 rounded-lg border transition-colors',
            currentPage === 1 || totalPages === 0
              ? 'border-gray-200 dark:border-gray-700 text-gray-300 dark:text-gray-600 cursor-not-allowed'
              : 'border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800'
          )}
          title="Previous page"
        >
          <ChevronLeft className="w-3.5 sm:w-4 h-3.5 sm:h-4" />
        </button>
        
        {/* Page indicator - Show on mobile between arrows */}
        <span className="md:hidden text-xs font-medium text-gray-700 dark:text-gray-300 px-2">
          {totalPages === 0 ? 0 : currentPage}/{totalPages}
        </span>
        
        {/* Next page button */}
        <button
          onClick={handleNextPage}
          disabled={currentPage === totalPages || totalPages === 0}
          className={clsx(
            'p-1.5 sm:p-2 rounded-lg border transition-colors',
            currentPage === totalPages || totalPages === 0
              ? 'border-gray-200 dark:border-gray-700 text-gray-300 dark:text-gray-600 cursor-not-allowed'
              : 'border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800'
          )}
          title="Next page"
        >
          <ChevronRight className="w-3.5 sm:w-4 h-3.5 sm:h-4" />
        </button>
        
        {/* Last page button - hidden on mobile */}
        <button
          onClick={handleLastPage}
          disabled={currentPage === totalPages || totalPages === 0}
          className={clsx(
            'hidden sm:block p-1.5 sm:p-2 rounded-lg border transition-colors',
            currentPage === totalPages || totalPages === 0
              ? 'border-gray-200 dark:border-gray-700 text-gray-300 dark:text-gray-600 cursor-not-allowed'
              : 'border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800'
          )}
          title="Last page"
        >
          <ChevronsRight className="w-3.5 sm:w-4 h-3.5 sm:h-4" />
        </button>
      </div>
    </div>
  );
};

export default Pagination;

