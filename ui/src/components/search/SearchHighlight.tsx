'use client';

interface SearchHighlightProps {
  text: string;
  query: string;
  className?: string;
  highlightClassName?: string;
}

/**
 * Component that highlights matching search terms in text.
 */
export function SearchHighlight({
  text,
  query,
  className = '',
  highlightClassName = 'bg-yellow-500/30 text-yellow-200',
}: SearchHighlightProps) {
  if (!query.trim()) {
    return <span className={className}>{text}</span>;
  }

  const lowerText = text.toLowerCase();
  const lowerQuery = query.toLowerCase();
  const parts: { text: string; isMatch: boolean }[] = [];

  let lastIndex = 0;
  let index = lowerText.indexOf(lowerQuery);

  while (index !== -1) {
    // Add text before match
    if (index > lastIndex) {
      parts.push({ text: text.slice(lastIndex, index), isMatch: false });
    }
    // Add match
    parts.push({ text: text.slice(index, index + query.length), isMatch: true });
    lastIndex = index + query.length;
    index = lowerText.indexOf(lowerQuery, lastIndex);
  }

  // Add remaining text
  if (lastIndex < text.length) {
    parts.push({ text: text.slice(lastIndex), isMatch: false });
  }

  return (
    <span className={className}>
      {parts.map((part, i) =>
        part.isMatch ? (
          <mark key={i} className={`${highlightClassName} rounded px-0.5`}>
            {part.text}
          </mark>
        ) : (
          <span key={i}>{part.text}</span>
        )
      )}
    </span>
  );
}
