import {
  Code,
  FormatBold,
  FormatItalic,
  FormatListBulleted,
  FormatListNumbered,
  FormatQuote,
  FormatStrikethrough,
  Link,
} from '@mui/icons-material';
import { Box, IconButton, Stack, Tooltip } from '@mui/material';
import React, { useCallback, useMemo } from 'react';

interface RichTextEditorProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  disabled?: boolean;
}

export const RichTextEditor: React.FC<RichTextEditorProps> = ({
  value,
  onChange,
  placeholder,
  disabled = false,
}) => {
  const textareaRef = React.useRef<HTMLTextAreaElement>(null);

  const applyFormat = useCallback(
    (format: string) => {
      if (!textareaRef.current || disabled) return;

      const textarea = textareaRef.current;
      const start = textarea.selectionStart;
      const end = textarea.selectionEnd;
      const selectedText = value.substring(start, end);

      let newText = '';
      let newCursorPos = start;

      switch (format) {
        case 'bold':
          newText =
            value.substring(0, start) +
            `**${selectedText}**` +
            value.substring(end);
          newCursorPos = start + selectedText.length + 4;
          break;
        case 'italic':
          newText =
            value.substring(0, start) +
            `*${selectedText}*` +
            value.substring(end);
          newCursorPos = start + selectedText.length + 2;
          break;
        case 'strikethrough':
          newText =
            value.substring(0, start) +
            `~~${selectedText}~~` +
            value.substring(end);
          newCursorPos = start + selectedText.length + 4;
          break;
        case 'code':
          newText =
            value.substring(0, start) +
            `\`${selectedText}\`` +
            value.substring(end);
          newCursorPos = start + selectedText.length + 2;
          break;
        case 'quote':
          const lines = selectedText.split('\n');
          const quotedLines = lines.map((line) => `> ${line}`).join('\n');
          newText =
            value.substring(0, start) + quotedLines + value.substring(end);
          newCursorPos = start + quotedLines.length;
          break;
        case 'bullet':
          const bulletLines = selectedText.split('\n');
          const bulletList = bulletLines.map((line) => `- ${line}`).join('\n');
          newText =
            value.substring(0, start) + bulletList + value.substring(end);
          newCursorPos = start + bulletList.length;
          break;
        case 'number':
          const numberLines = selectedText.split('\n');
          const numberList = numberLines
            .map((line, index) => `${index + 1}. ${line}`)
            .join('\n');
          newText =
            value.substring(0, start) + numberList + value.substring(end);
          newCursorPos = start + numberList.length;
          break;
        case 'link':
          const url = prompt('Enter URL:');
          if (url) {
            newText =
              value.substring(0, start) +
              `[${selectedText}](${url})` +
              value.substring(end);
            newCursorPos = start + selectedText.length + url.length + 4;
          } else {
            return;
          }
          break;
      }

      onChange(newText);

      // Set cursor position after format is applied
      setTimeout(() => {
        if (textareaRef.current) {
          textareaRef.current.setSelectionRange(newCursorPos, newCursorPos);
          textareaRef.current.focus();
        }
      }, 0);
    },
    [value, onChange, disabled]
  );

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === 'Tab') {
        e.preventDefault();
        const textarea = textareaRef.current;
        if (textarea) {
          const start = textarea.selectionStart;
          const end = textarea.selectionEnd;
          const newValue =
            value.substring(0, start) + '  ' + value.substring(end);
          onChange(newValue);
          setTimeout(() => {
            textarea.setSelectionRange(start + 2, start + 2);
          }, 0);
        }
      }
    },
    [value, onChange]
  );

  const formatButtons = useMemo(
    () => [
      { format: 'bold', icon: <FormatBold />, tooltip: 'Bold (Ctrl+B)' },
      { format: 'italic', icon: <FormatItalic />, tooltip: 'Italic (Ctrl+I)' },
      {
        format: 'strikethrough',
        icon: <FormatStrikethrough />,
        tooltip: 'Strikethrough',
      },
      { format: 'code', icon: <Code />, tooltip: 'Code' },
      { format: 'link', icon: <Link />, tooltip: 'Insert Link' },
      { format: 'quote', icon: <FormatQuote />, tooltip: 'Quote' },
      {
        format: 'bullet',
        icon: <FormatListBulleted />,
        tooltip: 'Bullet List',
      },
      {
        format: 'number',
        icon: <FormatListNumbered />,
        tooltip: 'Numbered List',
      },
    ],
    []
  );

  return (
    <Box
      sx={{
        border: '1px solid',
        borderColor: 'grey.300',
        borderRadius: 1,
        overflow: 'hidden',
        '&:focus-within': {
          borderColor: 'primary.main',
        },
      }}
    >
      {/* Toolbar */}
      <Box
        sx={{
          p: 1,
          borderBottom: '1px solid',
          borderColor: 'grey.200',
          bgcolor: 'grey.50',
        }}
      >
        <Stack direction="row" spacing={0.5}>
          {formatButtons.map(({ format, icon, tooltip }) => (
            <Tooltip key={format} title={tooltip}>
              <IconButton
                size="small"
                onClick={() => applyFormat(format)}
                disabled={disabled}
                sx={{
                  p: 0.5,
                  '&:hover': {
                    bgcolor: 'grey.200',
                  },
                }}
              >
                {icon}
              </IconButton>
            </Tooltip>
          ))}
        </Stack>
      </Box>

      {/* Textarea */}
      <Box sx={{ p: 1 }}>
        <textarea
          ref={textareaRef}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={placeholder}
          disabled={disabled}
          style={{
            width: '100%',
            minHeight: '120px',
            border: 'none',
            outline: 'none',
            resize: 'vertical',
            fontFamily: 'inherit',
            fontSize: '14px',
            lineHeight: '1.5',
            backgroundColor: 'transparent',
          }}
        />
      </Box>

      {/* Preview (optional) */}
      {value && (
        <Box
          sx={{
            p: 1,
            borderTop: '1px solid',
            borderColor: 'grey.200',
            bgcolor: 'grey.50',
            fontSize: '12px',
            color: 'text.secondary',
          }}
        >
          <strong>Preview:</strong>
          <Box
            sx={{
              mt: 0.5,
              p: 1,
              bgcolor: 'white',
              borderRadius: 0.5,
              border: '1px solid',
              borderColor: 'grey.200',
              fontSize: '13px',
              lineHeight: '1.4',
            }}
            dangerouslySetInnerHTML={{
              __html: value
                .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
                .replace(/\*(.*?)\*/g, '<em>$1</em>')
                .replace(/~~(.*?)~~/g, '<del>$1</del>')
                .replace(
                  /`(.*?)`/g,
                  '<code style="background: #f0f0f0; padding: 2px 4px; border-radius: 3px;">$1</code>'
                )
                .replace(
                  /^> (.*$)/gm,
                  '<blockquote style="border-left: 3px solid #ccc; margin: 0; padding-left: 10px;">$1</blockquote>'
                )
                .replace(/^- (.*$)/gm, '<li>$1</li>')
                .replace(/^(\d+)\. (.*$)/gm, '<li>$2</li>')
                .replace(
                  /\[(.*?)\]\((.*?)\)/g,
                  '<a href="$2" target="_blank">$1</a>'
                )
                .replace(/\n/g, '<br>'),
            }}
          />
        </Box>
      )}
    </Box>
  );
};
