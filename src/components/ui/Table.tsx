import React from 'react';

export interface TableColumn {
  key: string;
  label: string;
  sortable?: boolean;
  width?: string;
  align?: 'left' | 'center' | 'right';
  render?: (value: any, row: any) => React.ReactNode;
}

export interface TableProps {
  columns: TableColumn[];
  data: any[];
  onSort?: (key: string) => void;
  sortKey?: string;
  sortDirection?: 'asc' | 'desc';
  className?: string;
  striped?: boolean;
  hover?: boolean;
  bordered?: boolean;
}

export const Table: React.FC<TableProps> = ({ 
  columns,
  data,
  onSort,
  sortKey,
  sortDirection = 'asc',
  className = '',
  striped = false,
  hover = true,
  bordered = true,
}) => {
  const handleSort = (column: TableColumn) => {
    if (column.sortable && onSort) {
      onSort(column.key);
    }
  };

  const borderClass = bordered ? 'border-b border-stroke dark:border-dark-3' : '';

  return (
    <div className="overflow-x-auto">
      <table className={`w-full table-auto ${className}`}>
        <thead>
          <tr className="bg-gray-2 text-left dark:bg-dark-2">
            {columns.map((column, index) => (
              <th
                key={column.key}
                className={`px-4 py-4 font-semibold text-dark dark:text-white ${
                  index === 0 ? 'pl-9 xl:pl-7.5' : ''
                } ${column.sortable ? 'cursor-pointer select-none hover:bg-gray-3 dark:hover:bg-dark-3' : ''}`}
                style={{ width: column.width, textAlign: column.align || 'left' }}
                onClick={() => handleSort(column)}
              >
                <div className="flex items-center gap-2">
                  <span>{column.label}</span>
                  {column.sortable && (
                    <span className="inline-flex flex-col">
                      <svg
                        className={`h-3 w-3 ${sortKey === column.key && sortDirection === 'asc' ? 'text-primary' : 'text-body'}`}
                        fill="currentColor"
                        viewBox="0 0 20 20"
                      >
                        <path d="M5 10l5-5 5 5z" />
                      </svg>
                      <svg
                        className={`h-3 w-3 -mt-1 ${sortKey === column.key && sortDirection === 'desc' ? 'text-primary' : 'text-body'}`}
                        fill="currentColor"
                        viewBox="0 0 20 20"
                      >
                        <path d="M15 10l-5 5-5-5z" />
                      </svg>
                    </span>
                  )}
                </div>
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {data.length === 0 ? (
            <tr>
              <td 
                colSpan={columns.length} 
                className="px-4 py-8 text-center text-body dark:text-body-dark"
              >
                No data available
              </td>
            </tr>
          ) : (
            data.map((row, rowIndex) => (
              <tr
                key={rowIndex}
                className={`${borderClass} ${hover ? 'hover:bg-gray-2 dark:hover:bg-dark-2' : ''} ${
                  striped && rowIndex % 2 === 1 ? 'bg-gray-2/50 dark:bg-dark-2/50' : ''
                }`}
              >
                {columns.map((column, colIndex) => (
                  <td
                    key={`${rowIndex}-${column.key}`}
                    className={`px-4 py-4 ${colIndex === 0 ? 'pl-9 xl:pl-7.5' : ''}`}
                    style={{ textAlign: column.align || 'left' }}
                  >
                    {column.render ? (
                      column.render(row[column.key], row)
                    ) : (
                      <p className="text-dark dark:text-white">
                        {row[column.key]}
                      </p>
                    )}
                  </td>
                ))}
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  );
};

export default Table;

