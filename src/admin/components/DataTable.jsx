import { useT } from '../i18n.js';

export default function DataTable({ columns, rows, rowKey = 'id', empty = 'No records match your filters.', onRowClick }) {
  const { t } = useT();
  return (
    <div className="table-wrap">
      <table className="data-table">
        <thead>
          <tr>{columns.map((c) => <th key={c.key} style={c.width ? { width: c.width } : undefined}>{c.label}</th>)}</tr>
        </thead>
        <tbody>
          {rows.length === 0 && (
            <tr><td colSpan={columns.length} className="empty-cell">{t(empty)}</td></tr>
          )}
          {rows.map((row) => (
            <tr key={row[rowKey]} className={onRowClick ? 'clickable' : ''} onClick={onRowClick ? () => onRowClick(row) : undefined}>
              {columns.map((c) => (
                <td key={c.key} data-label={c.label}>{c.render ? c.render(row) : row[c.key]}</td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
