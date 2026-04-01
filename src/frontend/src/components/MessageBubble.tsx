"use client";

import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { ChatMessage } from "@/types";

import { getApiUrl } from "@/lib/config";

/** Marker prefix so we can identify our download links in the rendered markdown. */
const DL_PREFIX = `${getApiUrl()}/api/files/download/`;

/**
 * Detect absolute file paths (e.g. /tmp/foo.pdf) in agent responses and rewrite
 * them as markdown download links pointing at the backend file-serving endpoint.
 * Also strips surrounding backticks/bold markers so the link isn't rendered as code.
 */
function rewriteFilePaths(text: string): string {
  return text.replace(
    /`{0,3}\*{0,2}(\/tmp\/[\w.\-\/]+\.[a-zA-Z0-9]{1,10})\*{0,2}`{0,3}/g,
    (_match, path: string) => {
      const filename = path.split("/").pop() || path;
      return `[${filename}](${DL_PREFIX}${encodeURIComponent(filename)}?path=${encodeURIComponent(path)})`;
    }
  );
}

/** Fetch a file via the backend and trigger a browser download with the correct name. */
async function downloadFile(url: string, filename: string) {
  try {
    const res = await fetch(url);
    if (!res.ok) throw new Error(`Download failed: ${res.status}`);
    const blob = await res.blob();
    const blobUrl = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = blobUrl;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(blobUrl);
  } catch (err) {
    console.error("File download error:", err);
    // Fallback: open the URL directly
    window.open(url, "_blank");
  }
}

interface Props {
  message: ChatMessage;
}

export function MessageBubble({ message }: Props) {
  const isUser = message.role === "user";
  const content = isUser ? message.content : rewriteFilePaths(message.content);

  return (
    <div className={`flex ${isUser ? "justify-end" : "justify-start"} animate-slide-up`}>
      {/* Assistant avatar */}
      {!isUser && (
        <div className="flex-shrink-0 mr-3 mt-1">
          <div className="w-8 h-8 rounded-full bg-gradient-to-br from-violet-600 via-primary-500 to-cyan-400 flex items-center justify-center shadow-md shadow-primary-500/20 ring-2 ring-white/10">
            <svg className="w-4 h-4 text-white" viewBox="0 0 24 24" fill="currentColor">
              <path fillRule="evenodd" d="M14.615 1.595a.75.75 0 01.359.852L12.982 9.75h7.268a.75.75 0 01.548 1.262l-10.5 11.25a.75.75 0 01-1.272-.71l1.992-7.302H3.75a.75.75 0 01-.548-1.262l10.5-11.25a.75.75 0 01.913-.143z" clipRule="evenodd" />
            </svg>
          </div>
        </div>
      )}

      <div
        className={`max-w-[75%] ${
          isUser
            ? "rounded-2xl rounded-br-sm px-4 py-3 bg-primary-600 text-white shadow-sm"
            : "rounded-2xl rounded-bl-sm px-4 py-3 bg-white dark:bg-navy-900/80 border border-slate-100 dark:border-white/[0.06] text-slate-800 dark:text-slate-200"
        }`}
      >
        {isUser ? (
          <p className="text-sm leading-relaxed whitespace-pre-wrap">{message.content}</p>
        ) : (
          <div className="text-sm leading-relaxed prose prose-sm dark:prose-invert max-w-none prose-p:my-1.5 prose-li:my-0 prose-table:my-2 prose-th:px-3 prose-th:py-2 prose-td:px-3 prose-td:py-2 prose-th:text-left prose-th:bg-slate-50 dark:prose-th:bg-white/[0.04] prose-th:font-semibold prose-table:border-collapse prose-table:w-full prose-headings:text-slate-900 dark:prose-headings:text-white prose-a:text-primary-600 dark:prose-a:text-primary-400 prose-strong:text-slate-900 dark:prose-strong:text-white">
            <ReactMarkdown
              remarkPlugins={[remarkGfm]}
              components={{
                a: ({ href, children }) => {
                  const isDownload = href?.startsWith(DL_PREFIX);
                  if (isDownload && href) {
                    const urlFilename = decodeURIComponent(
                      href.slice(DL_PREFIX.length).split("?")[0]
                    );
                    return (
                      <button
                        onClick={() => downloadFile(href, urlFilename)}
                        className="inline-flex items-center gap-1.5 text-primary-600 hover:text-primary-700 underline decoration-primary-300 underline-offset-2 cursor-pointer bg-transparent border-none p-0 font-inherit text-inherit transition-colors"
                      >
                        <svg className="w-4 h-4 inline-block flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                        </svg>
                        {children}
                      </button>
                    );
                  }
                  return (
                    <a
                      href={href}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 text-primary-600 hover:text-primary-700 underline decoration-primary-300 underline-offset-2 transition-colors"
                    >
                      {children}
                    </a>
                  );
                },
              }}
            >
              {content}
            </ReactMarkdown>
          </div>
        )}
      </div>

      {/* User avatar */}
      {isUser && (
        <div className="flex-shrink-0 ml-3 mt-1">
          <div className="w-8 h-8 rounded-full bg-slate-200 dark:bg-slate-700 flex items-center justify-center">
            <svg className="w-4 h-4 text-slate-500 dark:text-slate-300" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 6a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0zM4.501 20.118a7.5 7.5 0 0114.998 0A17.933 17.933 0 0112 21.75c-2.676 0-5.216-.584-7.499-1.632z" />
            </svg>
          </div>
        </div>
      )}
    </div>
  );
}
