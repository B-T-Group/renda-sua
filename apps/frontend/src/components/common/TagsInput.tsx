import { Autocomplete, Chip, TextField } from '@mui/material';
import React, { useState } from 'react';

export interface TagsInputProps {
  value: string[];
  onChange: (tags: string[]) => void;
  label: string;
  placeholder?: string;
  helperText?: string;
}

export function normalizeTags(raw: string[]): string[] {
  const seen = new Set<string>();
  return raw
    .flatMap((entry) => entry.split(/[,\n]/))
    .map((tag) => tag.trim())
    .filter((tag) => {
      const key = tag.toLowerCase();
      if (!tag || seen.has(key)) return false;
      seen.add(key);
      return true;
    });
}

/** Free-text tag editor: press enter or comma to turn text into removable chips. */
export const TagsInput: React.FC<TagsInputProps> = ({
  value,
  onChange,
  label,
  placeholder,
  helperText,
}) => {
  const [inputValue, setInputValue] = useState('');

  const handleInputChange = (_: unknown, next: string, reason: string) => {
    if (reason === 'reset') return;
    if (next.includes(',')) {
      onChange(normalizeTags([...value, next]));
      setInputValue('');
      return;
    }
    setInputValue(next);
  };

  return (
    <Autocomplete
      multiple
      freeSolo
      autoSelect
      options={[] as string[]}
      value={value}
      inputValue={inputValue}
      onInputChange={handleInputChange}
      onChange={(_, next) => onChange(normalizeTags(next))}
      renderTags={(tags, getTagProps) =>
        tags.map((tag, index) => {
          const { key, ...chipProps } = getTagProps({ index });
          return (
            <Chip
              key={key}
              label={tag}
              size="small"
              color="primary"
              variant="outlined"
              {...chipProps}
            />
          );
        })
      }
      renderInput={(params) => (
        <TextField
          {...params}
          label={label}
          placeholder={value.length ? undefined : placeholder}
          helperText={helperText}
        />
      )}
    />
  );
};
