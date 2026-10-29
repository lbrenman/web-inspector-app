function formatCell(value) {
  if (value === null || value === undefined) {
    return <span className="muted">null</span>;
  }
  return String(value);
}

/**
 * Generic table. `rows` is an array of arrays aligned with `columns`.
 * `leading` optionally adds a sticky first column: { header, cell(rowIndex) }.
 * Long text is truncated with the full value available as a tooltip.
 */
export default function DataTable({ columns, rows, leading, className = '' }) {
  return (
    <div className={`table-wrap ${className}`}>
      <table>
        <thead>
          <tr>
            {leading && (
              <th scope="col" className="leading">
                {leading.header}
              </th>
            )}
            {columns.map((column) => (
              <th key={column} scope="col">
                {column}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, rowIndex) => (
            <tr key={rowIndex}>
              {leading && <td className="leading">{leading.cell(rowIndex)}</td>}
              {row.map((value, columnIndex) => (
                <td
                  key={columns[columnIndex]}
                  className={typeof value === 'number' ? 'num' : undefined}
                  title={typeof value === 'string' ? value : undefined}
                >
                  {formatCell(value)}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
