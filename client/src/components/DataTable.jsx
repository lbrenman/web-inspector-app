function formatCell(value) {
  if (value === null || value === undefined) {
    return <span className="muted">null</span>;
  }
  return String(value);
}

/**
 * Generic table. `rows` is an array of arrays aligned with `columns`.
 * `leading` optionally adds a first column: { header, cell(rowIndex) }.
 */
export default function DataTable({ columns, rows, leading }) {
  return (
    <div className="table-scroll">
      <table>
        <thead>
          <tr>
            {leading && <th scope="col">{leading.header}</th>}
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
              {leading && <td>{leading.cell(rowIndex)}</td>}
              {row.map((value, columnIndex) => (
                <td key={columns[columnIndex]}>{formatCell(value)}</td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
