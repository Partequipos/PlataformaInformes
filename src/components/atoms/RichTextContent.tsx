import React from 'react';
import { cn } from '../../utils/cn';
import { formatStoredText, isRichTextEmpty } from '../../utils/richText';

type RichTextContentProps = {
  value?: string | null;
  emptyLabel?: string;
  className?: string;
};

export const RichTextContent: React.FC<RichTextContentProps> = ({
  value,
  emptyLabel = '—',
  className,
}) => {
  if (isRichTextEmpty(value)) {
    return <div className={cn(className)}>{emptyLabel}</div>;
  }

  return (
    <div
      className={cn('rich-text-content [&_ul]:list-disc [&_ul]:pl-5 [&_ol]:list-decimal [&_ol]:pl-5', className)}
      dangerouslySetInnerHTML={{ __html: formatStoredText(value) }}
    />
  );
};
