import { render, screen, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import DataTable from './DataTable.jsx';

describe('DataTable', () => {
  it('renders column headers and row values', () => {
    render(
      <DataTable
        columns={['id', 'user.name']}
        rows={[
          [1, 'ann'],
          [2, 'bob'],
        ]}
      />,
    );

    expect(screen.getAllByRole('columnheader').map((h) => h.textContent)).toEqual([
      'id',
      'user.name',
    ]);
    const rows = screen.getAllByRole('row').slice(1);
    expect(within(rows[0]).getAllByRole('cell').map((c) => c.textContent)).toEqual(['1', 'ann']);
    expect(within(rows[1]).getAllByRole('cell').map((c) => c.textContent)).toEqual(['2', 'bob']);
  });

  it('renders null and missing values as a muted "null" and booleans as text', () => {
    render(<DataTable columns={['a', 'b']} rows={[[null, false]]} />);

    const cells = screen.getAllByRole('cell');
    expect(cells[0]).toHaveTextContent('null');
    expect(cells[1]).toHaveTextContent('false');
  });

  it('adds a leading column when provided', () => {
    render(
      <DataTable
        columns={['a']}
        rows={[[10], [20]]}
        leading={{ header: 'Request', cell: (index) => `#${index + 1}` }}
      />,
    );

    expect(screen.getAllByRole('columnheader').map((h) => h.textContent)).toEqual([
      'Request',
      'a',
    ]);
    expect(screen.getAllByRole('cell').map((c) => c.textContent)).toEqual([
      '#1',
      '10',
      '#2',
      '20',
    ]);
  });
});
