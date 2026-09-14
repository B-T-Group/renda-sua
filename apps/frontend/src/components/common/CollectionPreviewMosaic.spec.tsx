import { ThemeProvider, createTheme } from '@mui/material/styles';
import { render } from '@testing-library/react';
import React from 'react';
import { CollectionPreviewMosaic } from './CollectionPreviewMosaic';

const theme = createTheme();

function injectedCss(): string {
  return Array.from(document.styleSheets)
    .flatMap((sheet) => {
      try {
        return Array.from(sheet.cssRules).map((rule) => rule.cssText);
      } catch {
        return [];
      }
    })
    .join('\n');
}

describe('CollectionPreviewMosaic', () => {
  it('applies pixel gap and radius instead of MUI theme units', () => {
    render(
      <ThemeProvider theme={theme}>
        <CollectionPreviewMosaic
          imageUrls={['https://example.com/a.jpg']}
          gap={6}
          tileBorderRadius={10}
        />
      </ThemeProvider>
    );

    const css = injectedCss();
    expect(css).toMatch(/gap:\s*6px/);
    expect(css).toMatch(/border-radius:\s*10px/);
    expect(css).not.toMatch(/gap:\s*48px/);
    expect(css).not.toMatch(/border-radius:\s*40px/);
  });
});
