import { fireEvent, render, screen } from '@testing-library/react';
import React, { useState } from 'react';
import { normalizeTags, TagsInput } from './TagsInput';

function Harness({ initial }: { initial: string[] }) {
  const [tags, setTags] = useState(initial);
  return <TagsInput value={tags} onChange={setTags} label="Tags" />;
}

describe('TagsInput', () => {
  it('normalizes commas, whitespace and duplicates', () => {
    expect(normalizeTags(['JBL', 'jbl, speaker', ' '])).toEqual(['JBL', 'speaker']);
  });

  it('renders existing tags as chips', () => {
    render(<Harness initial={['jbl', 'partybox']} />);
    expect(screen.getByText('jbl')).toBeTruthy();
    expect(screen.getByText('partybox')).toBeTruthy();
  });

  it('adds a chip when a comma is typed', () => {
    render(<Harness initial={[]} />);
    fireEvent.change(screen.getByRole('combobox'), {
      target: { value: 'outdoor speaker,' },
    });
    expect(screen.getByText('outdoor speaker')).toBeTruthy();
  });
});
