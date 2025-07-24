import React from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { atomDark } from 'react-syntax-highlighter/dist/esm/styles/prism';

const MarkdownPreview = ({ markdown }) => {
  // Handle Confluence macros and syntax
  const preprocessConfluenceSyntax = (text) => {
    if (!text) return '';
    
    let processed = text;
    
    // Convert Confluence panel macros
    processed = processed.replace(
      /{panel:title=([^|]*)\|titleBGColor=([^|]*)\|borderStyle=([^}]*)}/g,
      '<div class="panel panel-default"><div class="panel-heading" style="background-color:$2;"><h3>$1</h3></div><div class="panel-body">'
    );
    processed = processed.replace(/{panel}/g, '</div></div>');
    
    // Convert Confluence headings (h1., h2., etc.)
    processed = processed.replace(/^h1\.\s*(.*?)$/gm, '# $1');
    processed = processed.replace(/^h2\.\s*(.*?)$/gm, '## $1');
    processed = processed.replace(/^h3\.\s*(.*?)$/gm, '### $1');
    processed = processed.replace(/^h4\.\s*(.*?)$/gm, '#### $1');
    processed = processed.replace(/^h5\.\s*(.*?)$/gm, '##### $1');
    
    // Convert Confluence tables
    // First replace the header row
    processed = processed.replace(/^\|\|(.*?)\|\|$/gm, (match, content) => {
      const headers = content.split('||').map(header => header.trim());
      return '| ' + headers.join(' | ') + ' |';
    });
    
    // Then add the header separator row if it's not already there
    processed = processed.replace(/^(\|(.*?)\|)$/gm, (match, row, content) => {
      // Count pipes to determine number of columns
      const columnCount = (row.match(/\|/g) || []).length - 1;
      // Skip if the next line is a separator row
      const nextLineIsSeparator = processed.split('\n')
        .findIndex(line => line === match) < processed.split('\n').length - 1 &&
        processed.split('\n')[processed.split('\n').findIndex(line => line === match) + 1]
          .match(/^\|(\s*-+\s*\|)+$/);
      
      if (!nextLineIsSeparator) {
        return row + '\n|' + ' --- |'.repeat(columnCount);
      }
      return row;
    });
    
    // Convert regular table rows (skip headers we've already processed)
    processed = processed.replace(/^\|((?!\|).+?)\|$/gm, (match) => {
      if (!match.includes('||')) {
        return match; // It's already a proper Markdown table row
      }
      return match; // Otherwise leave it as is
    });
    
    // Handle Confluence code blocks
    processed = processed.replace(/{code(?::([a-z]+))?}/g, '```$1');
    processed = processed.replace(/{code}/g, '```');
    
    // Handle Confluence links
    processed = processed.replace(/\[([^\]]+)\|([^\]]+)\]/g, '[$1]($2)');
    
    // Handle Confluence images with thumbnail
    processed = processed.replace(/!([^|]+)\|thumbnail!/g, '![]($1)');
    
    return processed;
  };

  const processedMarkdown = preprocessConfluenceSyntax(markdown);

  return (
    <div className="markdown-preview">
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
          code({ node, inline, className, children, ...props }) {
            const match = /language-(\w+)/.exec(className || '');
            return !inline && match ? (
              <SyntaxHighlighter
                style={atomDark}
                language={match[1]}
                PreTag="div"
                {...props}
              >
                {String(children).replace(/\n$/, '')}
              </SyntaxHighlighter>
            ) : (
              <code className={className} {...props}>
                {children}
              </code>
            );
          },
          table({ node, ...props }) {
            return (
              <div className="table-responsive">
                <table className="table table-bordered" {...props} />
              </div>
            );
          }
        }}
      >
        {processedMarkdown}
      </ReactMarkdown>
    </div>
  );
};

export default MarkdownPreview;
