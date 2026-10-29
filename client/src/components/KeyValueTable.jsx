export default function KeyValueTable({ items, label }) {
  return (
    <div className="table-wrap">
      <table className="kv" aria-label={label}>
        <thead>
          <tr>
            <th scope="col">Name</th>
            <th scope="col">Value</th>
          </tr>
        </thead>
        <tbody>
          {items.map((item, index) => (
            <tr key={index}>
              <td>{item.name}</td>
              <td className="wrap">{item.value}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
