const naturalCollator = new Intl.Collator("en", {
  numeric: true,
  sensitivity: "base",
});

function naturalValue(value) {
  if (value === null || value === undefined) return "";
  if (typeof value === "number") return value;
  return String(value).trim();
}

function compareRows(firstColumn) {
  return (a, b) => {
    const first = naturalValue(firstColumn.sortValue ? firstColumn.sortValue(a) : a[firstColumn.key]);
    const second = naturalValue(firstColumn.sortValue ? firstColumn.sortValue(b) : b[firstColumn.key]);

    if (typeof first === "number" && typeof second === "number") return first - second;
    return naturalCollator.compare(first, second);
  };
}

function resolveSortColumn(columns, sortBy) {
  if (sortBy === false) return null;
  if (sortBy) return columns.find((column) => column.key === sortBy) || null;
  return columns.find((column) => column.sortable !== false) || columns[0];
}

export function DataTable({ columns, rows, emptyMessage, rowClassName, sortBy, sortDirection = "asc" }) {
  if (!rows.length) {
    return (
      <div className="rounded-md border border-dashed border-slate-300 bg-white px-4 py-8 text-center text-sm text-slate-500">
        {emptyMessage}
      </div>
    );
  }

  const sortColumn = resolveSortColumn(columns, sortBy);
  const sortedRows = sortColumn ? [...rows].sort(compareRows(sortColumn)) : [...rows];
  if (sortColumn && sortDirection === "desc") {
    sortedRows.reverse();
  }

  return (
    <div className="overflow-hidden rounded-md border border-slate-200 bg-white">
      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-slate-200 text-sm">
          <thead className="bg-slate-50">
            <tr>
              {columns.map((column) => (
                <th key={column.key} className="px-4 py-3 text-left font-semibold text-slate-600">
                  {column.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {sortedRows.map((row, rowIndex) => (
              <tr key={row.id} className={rowClassName ? rowClassName(row) : ""}>
                {columns.map((column) => (
                  <td key={column.key} className="px-4 py-3 text-slate-700">
                    {column.render ? column.render(row, rowIndex) : row[column.key] || "-"}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
