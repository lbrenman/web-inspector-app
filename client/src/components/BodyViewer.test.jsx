import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import BodyViewer from './BodyViewer.jsx';

const jsonBody = { encoding: 'utf8', size: 17, text: '{"hello":"world"}', isJson: true };

describe('BodyViewer', () => {
  it('shows pretty-printed JSON by default and the original text under Raw', async () => {
    const user = userEvent.setup();
    render(<BodyViewer body={jsonBody} tables={[]} />);

    expect(screen.getByLabelText('Pretty JSON')).toHaveTextContent('"hello": "world"');

    await user.click(screen.getByRole('tab', { name: 'Raw' }));

    expect(screen.getByText('{"hello":"world"}')).toBeInTheDocument();
  });

  it('highlights JSON keys, strings, numbers, booleans and null without altering the text', () => {
    const text = '{"name":"ann","age":30,"ok":true,"none":null,"note":"has 42 and true inside"}';
    render(
      <BodyViewer body={{ encoding: 'utf8', size: text.length, text, isJson: true }} tables={[]} />,
    );

    const pretty = screen.getByLabelText('Pretty JSON');
    const classOf = (value) =>
      [...pretty.querySelectorAll('span')].find((el) => el.textContent === value)?.className;

    expect(classOf('"name"')).toBe('tok-key');
    expect(classOf('"ann"')).toBe('tok-string');
    expect(classOf('30')).toBe('tok-number');
    expect(classOf('true')).toBe('tok-bool');
    expect(classOf('null')).toBe('tok-null');
    // Numbers and keywords inside strings stay part of the string token.
    expect(classOf('"has 42 and true inside"')).toBe('tok-string');
    expect(pretty.textContent).toBe(JSON.stringify(JSON.parse(text), null, 2));
  });

  it('shows plain text bodies as raw only', () => {
    render(
      <BodyViewer body={{ encoding: 'utf8', size: 5, text: 'hello', isJson: false }} tables={[]} />,
    );

    expect(screen.queryByRole('tab', { name: 'Pretty' })).not.toBeInTheDocument();
    expect(screen.getByText('hello')).toBeInTheDocument();
  });

  it('falls back to the original text when JSON cannot be pretty-printed', () => {
    render(
      <BodyViewer body={{ encoding: 'utf8', size: 5, text: '{"a":', isJson: true }} tables={[]} />,
    );

    expect(screen.getByLabelText('Pretty JSON')).toHaveTextContent('{"a":');
  });

  it('describes binary bodies and shows base64', () => {
    render(
      <BodyViewer
        body={{ encoding: 'base64', size: 4, base64: '//4AAQ==', isJson: false }}
        tables={[]}
      />,
    );

    expect(screen.getByText(/Binary body \(4 bytes\)/)).toBeInTheDocument();
    expect(screen.getByText('//4AAQ==')).toBeInTheDocument();
  });

  it('says so when there is no body', () => {
    render(<BodyViewer body={{ encoding: 'empty', size: 0, text: '', isJson: false }} tables={[]} />);

    expect(screen.getByText('No body.')).toBeInTheDocument();
  });

  it('offers a Tables tab only when tables were detected, and renders them', async () => {
    const user = userEvent.setup();
    const tables = [
      {
        path: '$.users',
        totalRows: 2,
        columns: ['id', 'address.city'],
        columnsTruncated: false,
        rows: [
          [1, 'X'],
          [2, null],
        ],
      },
    ];
    const { rerender } = render(<BodyViewer body={jsonBody} tables={[]} />);
    expect(screen.queryByRole('tab', { name: /tables/i })).not.toBeInTheDocument();

    rerender(<BodyViewer body={jsonBody} tables={tables} />);
    await user.click(screen.getByRole('tab', { name: 'Tables (1)' }));

    expect(screen.getByText('$.users')).toBeInTheDocument();
    expect(screen.getByRole('columnheader', { name: 'address.city' })).toBeInTheDocument();
    expect(screen.getByRole('cell', { name: 'X' })).toBeInTheDocument();
  });

  it('notes when only part of a large table is shown', async () => {
    const user = userEvent.setup();
    const tables = [
      {
        path: '$',
        totalRows: 1500,
        columns: ['a'],
        columnsTruncated: true,
        rows: [[1], [2]],
      },
    ];
    render(<BodyViewer body={jsonBody} tables={tables} />);

    await user.click(screen.getByRole('tab', { name: 'Tables (1)' }));

    expect(screen.getByText(/1500 rows \(showing 2\), columns truncated/)).toBeInTheDocument();
  });
});
