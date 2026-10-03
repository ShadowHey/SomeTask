"use client";

import { useEffect, useState, useCallback } from "react";
import { api } from "@/lib/api";
import { SystemLog } from "@/types";

export default function LogsPage() {
  const [logs, setLogs] = useState<SystemLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filterLevel, setFilterLevel] = useState<string>("");
  const [autoRefresh, setAutoRefresh] = useState(true);

  const fetchLogs = useCallback(async () => {
    try {
      const data = await api.logs.list({ level: filterLevel || undefined });
      setLogs(data.items);
      setError(null);
    } catch (err: any) {
      setError(err.message || "Failed to fetch data for logs");
    } finally {
      setLoading(false);
    }
  }, [filterLevel]);

  useEffect(() => {
    fetchLogs();
  }, [fetchLogs]);

  useEffect(() => {
    let interval: NodeJS.Timeout;
    if (autoRefresh) {
      interval = setInterval(() => {
        fetchLogs();
      }, 5000); // refresh every 5 seconds
    }
    return () => clearInterval(interval);
  }, [autoRefresh, fetchLogs]);

  const getLevelColor = (level: string) => {
    switch (level) {
      case "info":
        return "bg-blue-500 ring-blue-100";
      case "warning":
        return "bg-amber-500 ring-amber-100";
      case "error":
        return "bg-red-500 ring-red-100";
      default:
        return "bg-gray-500 ring-gray-100";
    }
  };

  const getLevelBadge = (level: string) => {
    switch (level) {
      case "info":
        return <span className="inline-flex items-center rounded-md bg-blue-50 px-2 py-1 text-xs font-medium text-blue-700 ring-1 ring-inset ring-blue-600/20">INFO</span>;
      case "warning":
        return <span className="inline-flex items-center rounded-md bg-amber-50 px-2 py-1 text-xs font-medium text-amber-800 ring-1 ring-inset ring-amber-600/20">WARNING</span>;
      case "error":
        return <span className="inline-flex items-center rounded-md bg-red-50 px-2 py-1 text-xs font-medium text-red-700 ring-1 ring-inset ring-red-600/10">ERROR</span>;
      default:
        return <span className="inline-flex items-center rounded-md bg-gray-50 px-2 py-1 text-xs font-medium text-gray-600 ring-1 ring-inset ring-gray-500/10">{level.toUpperCase()}</span>;
    }
  };

  return (
    <div className="w-full">
      <div className="md:flex md:items-center md:justify-between mb-8">
        <div className="min-w-0 flex-1">
          <h2 className="text-2xl font-bold leading-7 text-gray-900 sm:truncate sm:text-3xl sm:tracking-tight font-[family-name:var(--font-jakarta)]">
            System Activity
          </h2>
          <p className="mt-1 flex items-center text-sm text-gray-500">
            Audit logs tracking audio notes processing.
          </p>
        </div>
        <div className="mt-4 flex md:ml-4 md:mt-0 items-center space-x-4">
          <select
            value={filterLevel}
            onChange={(e) => setFilterLevel(e.target.value)}
            className="block w-full rounded-md border-0 py-1.5 pl-3 pr-10 text-gray-900 ring-1 ring-inset ring-gray-300 focus:ring-2 focus:ring-blue-600 sm:text-sm sm:leading-6"
          >
            <option value="">All Levels</option>
            <option value="info">Info</option>
            <option value="warning">Warning</option>
            <option value="error">Error</option>
          </select>

          <div className="flex items-center">
            <button
              type="button"
              onClick={() => setAutoRefresh(!autoRefresh)}
              className={`relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-blue-600 focus:ring-offset-2 ${
                autoRefresh ? "bg-blue-600" : "bg-gray-200"
              }`}
              role="switch"
              aria-checked={autoRefresh}
            >
              <span className="sr-only">Auto refresh</span>
              <span
                aria-hidden="true"
                className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
                  autoRefresh ? "translate-x-5" : "translate-x-0"
                }`}
              />
            </button>
            <span className="ml-3 text-sm text-gray-500" id="auto-refresh-label">
              Auto-refresh
            </span>
          </div>
          
          <button
            onClick={() => fetchLogs()}
            disabled={loading}
            className="ml-3 inline-flex items-center rounded-md bg-white px-3 py-2 text-sm font-semibold text-gray-900 shadow-sm ring-1 ring-inset ring-gray-300 hover:bg-gray-50 disabled:opacity-50"
          >
            Refresh
          </button>
        </div>
      </div>

      {error && (
        <div className="rounded-md bg-red-50 p-4 mb-6">
          <div className="flex">
            <div className="ml-3">
              <h3 className="text-sm font-medium text-red-800">Error loading logs</h3>
              <div className="mt-2 text-sm text-red-700">
                <p>{error}</p>
              </div>
            </div>
          </div>
        </div>
      )}

      <div className="bg-white shadow sm:rounded-lg">
        <div className="px-4 py-5 sm:p-6">
          {loading && logs.length === 0 ? (
            <div className="flex justify-center py-12">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
            </div>
          ) : logs.length === 0 ? (
            <div className="text-center py-12">
              <svg className="mx-auto h-12 w-12 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
              <h3 className="mt-2 text-sm font-semibold text-gray-900">No logs found</h3>
              <p className="mt-1 text-sm text-gray-500">
                {filterLevel ? `No logs found for level "${filterLevel}".` : "No system activity has been recorded yet."}
              </p>
            </div>
          ) : (
            <div className="flow-root">
              <ul role="list" className="-mb-8">
                {logs.map((log, idx) => (
                  <li key={log.id}>
                    <div className="relative pb-8">
                      {idx !== logs.length - 1 ? (
                        <span className="absolute left-4 top-4 -ml-px h-full w-0.5 bg-gray-200" aria-hidden="true" />
                      ) : null}
                      <div className="relative flex space-x-3">
                        <div>
                          <span className={`h-8 w-8 rounded-full flex items-center justify-center ring-8 ${getLevelColor(log.level)}`}>
                            <svg className="h-5 w-5 text-white" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
                              {log.level === 'error' ? (
                                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.28 7.22a.75.75 0 00-1.06 1.06L8.94 10l-1.72 1.72a.75.75 0 101.06 1.06L10 11.06l1.72 1.72a.75.75 0 101.06-1.06L11.06 10l1.72-1.72a.75.75 0 00-1.06-1.06L10 8.94 8.28 7.22z" clipRule="evenodd" />
                              ) : (
                                <path fillRule="evenodd" d="M16.704 4.153a.75.75 0 01.143 1.052l-8 10.5a.75.75 0 01-1.127.075l-4.5-4.5a.75.75 0 011.06-1.06l3.894 3.893 7.48-9.817a.75.75 0 011.05-.143z" clipRule="evenodd" />
                              )}
                            </svg>
                          </span>
                        </div>
                        <div className="flex min-w-0 flex-1 justify-between space-x-4 pt-1.5">
                          <div>
                            <p className="text-sm text-gray-800 font-medium">
                              {log.message}
                            </p>
                            <div className="mt-1 flex gap-2">
                              {getLevelBadge(log.level)}
                              <span className="inline-flex items-center rounded-md bg-gray-100 px-2 py-1 text-xs font-medium text-gray-600">
                                {log.stage}
                              </span>
                            </div>
                            {log.details && Object.keys(log.details).length > 0 && (
                              <div className="mt-2 rounded-md bg-red-50 p-3 ring-1 ring-inset ring-red-100">
                                <p className="text-xs text-red-700 whitespace-pre-wrap break-all font-mono">
                                  {typeof log.details === 'string' ? log.details : JSON.stringify(log.details, null, 2)}
                                </p>
                              </div>
                            )}
                          </div>
                          <div className="whitespace-nowrap text-right text-sm text-gray-500">
                            <time dateTime={log.created_at}>
                              {new Date(log.created_at).toLocaleString('en-US', {
                                month: 'short',
                                day: 'numeric',
                                hour: 'numeric',
                                minute: '2-digit',
                                second: '2-digit',
                                hour12: true
                              })}
                            </time>
                          </div>
                        </div>
                      </div>
                    </div>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
