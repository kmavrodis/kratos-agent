"use client";

import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { ChatMessage } from "@/types";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

/** Marker prefix so we can identify our download links in the rendered markdown. */
const DL_PREFIX = `${API_URL}/api/files/download/`;

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
    <div className={`flex ${isUser ? "justify-end" : "justify-start"}`}>
      <div
        className={`max-w-[80%] rounded-2xl px-4 py-3 ${
          isUser
            ? "bg-primary-600 text-white"
            : "bg-gray-100 text-gray-900"
        }`}
      >
        {isUser ? (
          <p className="text-sm whitespace-pre-wrap">{message.content}</p>
        ) : (
          <div className="text-sm prose prose-sm max-w-none prose-p:my-1 prose-li:my-0 prose-table:my-2 prose-th:px-3 prose-th:py-1.5 prose-td:px-3 prose-td:py-1.5 prose-th:text-left prose-th:bg-gray-200 prose-th:font-semibold prose-table:border-collapse prose-table:w-full">
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
                        className="inline-flex items-center gap-1 text-primary-600 hover:text-primary-800 underline cursor-pointer bg-transparent border-none p-0 font-inherit text-inherit"
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
                      className="inline-flex items-center gap-1 text-primary-600 hover:text-primary-800 underline"
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
    </div>
  );
}
