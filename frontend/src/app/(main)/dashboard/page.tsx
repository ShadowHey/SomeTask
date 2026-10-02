"use client";

import { useCallback, useEffect, useState, useMemo } from "react";
import { api } from "@/lib/api";
import { useAuth } from "@/components/AuthProvider";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  AreaChart,
  Area
} from "recharts";

interface UsageData {
  summary: {
    total_requests: number;
    total_duration_seconds: number;
    completed_requests: number;
    failed_requests: number;
  };
  daily_usage: {
    date: string;
    request_count: number;
    duration_seconds: number;
  }[];
  history: {
    id: string;
    created_at: string;
    recording_name?: string;
    original_filename: string;
    model?: string;
    job_id?: string;
    duration_seconds?: number;
    status: string;
  }[];
}

export default function Dashboard() {
  const { isLoading: isAuthLoading } = useAuth();
  const [data, setData] = useState<UsageData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");

  const [startDate, setStartDate] = useState<string>("");
  const [endDate, setEndDate] = useState<string>("");
  const [isDateDropdownOpen, setIsDateDropdownOpen] = useState(false);

  const fetchUsage = useCallback(async () => {
    try {
      setIsLoading(true);
      const res = await api.usage.get({ start_date: startDate, end_date: endDate });
      setData(res);
      setError("");
    } catch (err) {
      console.error(err);
      setError("Unable to load usage data.");
    } finally {
      setIsLoading(false);
    }
  }, [startDate, endDate]);

  useEffect(() => {
    if (isAuthLoading) return;
    fetchUsage();
  }, [fetchUsage, isAuthLoading]);

  // Chart Data preparation
  const chartData = useMemo(() => {
    if (!data) return [];
    return data.daily_usage.map(d => ({
      date: new Date(d.date).toLocaleDateString(undefined, { month: 'short', day: 'numeric' }),
      requests: d.request_count,
      minutes: parseFloat((d.duration_seconds / 60).toFixed(2))
    }));
  }, [data]);

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "completed": return <span className="inline-flex items-center rounded border border-green-200 px-2 py-0.5 bg-green-50 text-[10px] font-bold text-green-700 uppercase tracking-wider">Completed</span>;
      case "failed": 
      case "start_failed":
      case "partial_failure":
        return <span className="inline-flex items-center rounded border border-red-200 px-2 py-0.5 bg-red-50 text-[10px] font-bold text-red-700 uppercase tracking-wider">Failed</span>;
      case "created":
      case "queued":
      case "in_progress":
        return <span className="inline-flex items-center rounded border border-blue-200 px-2 py-0.5 bg-blue-50 text-[10px] font-bold text-blue-700 uppercase tracking-wider">Processing</span>;
      default: return <span className="inline-flex items-center rounded border border-gray-200 px-2 py-0.5 bg-gray-50 text-[10px] font-bold text-gray-700 uppercase tracking-wider">{status}</span>;
    }
  };

  const cardStyle = "rounded-[1.5rem] bg-white ring-1 ring-gray-900/5 shadow-[inset_0_1px_1px_rgba(255,255,255,0.9),0_2px_4px_rgba(0,0,0,0.02),0_8px_20px_rgba(0,0,0,0.04),0_16px_32px_rgba(0,0,0,0.02)]";

  return (
    <div className="px-4 sm:px-0 pb-16">
      <div className="mb-6 border-b border-gray-200 pb-5 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <h1 className="text-2xl font-bold leading-7 text-gray-900 sm:truncate sm:text-3xl sm:tracking-tight uppercase tracking-wider">
          Dashboard
        </h1>
        
        {/* Date Filter */}
        <div className="relative z-40">
          <button 
            onClick={() => setIsDateDropdownOpen(!isDateDropdownOpen)}
            className={`flex items-center gap-2 px-4 py-2 border rounded-lg text-sm font-medium shadow-sm transition-colors ${(startDate || endDate) ? 'bg-blue-50 border-blue-200 text-blue-700' : 'bg-white border-gray-200 text-gray-700 hover:bg-gray-50'}`}
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
            </svg>
            {(startDate || endDate) ? (
              `${startDate ? new Date(startDate).toLocaleDateString() : 'Start'} → ${endDate ? new Date(endDate).toLocaleDateString() : 'End'}`
            ) : (
              'Date Range'
            )}
            <svg className="w-4 h-4 ml-2 opacity-50" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
            </svg>
          </button>
          
          {isDateDropdownOpen && (
            <>
              <div className="fixed inset-0 z-10" onClick={() => setIsDateDropdownOpen(false)}></div>
              <div className="absolute top-full right-0 mt-2 w-64 bg-white border border-gray-200 rounded-lg shadow-lg z-20 p-4">
                <div className="space-y-4">
                  <div>
                    <label className="block text-xs font-medium text-gray-700 mb-1">From Date</label>
                    <input 
                      type="date" 
                      value={startDate}
                      onChange={(e) => setStartDate(e.target.value)}
                      className="block w-full rounded-md border border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm px-3 py-2 bg-white"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-700 mb-1">To Date (inclusive)</label>
                    <input 
                      type="date" 
                      value={endDate}
                      onChange={(e) => setEndDate(e.target.value)}
                      className="block w-full rounded-md border border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm px-3 py-2 bg-white"
                    />
                  </div>
                  {(startDate || endDate) && (
                    <button 
                      onClick={() => { setStartDate(""); setEndDate(""); }}
                      className="w-full text-center text-xs font-medium text-blue-600 hover:text-blue-800"
                    >
                      Clear Range
                    </button>
                  )}
                </div>
              </div>
            </>
          )}
        </div>
      </div>

      {error ? (
        <div className="bg-red-50 border-l-4 border-red-500 p-4 mb-6 rounded-md">
          <p className="text-sm text-red-700 mb-2">{error}</p>
          <button onClick={fetchUsage} className="text-sm font-semibold text-red-700 hover:text-red-900 underline">
            Retry
          </button>
        </div>
      ) : isLoading && !data ? (
        <div className="flex justify-center py-12">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-blue-600 border-t-transparent"></div>
        </div>
      ) : !data || (data.history.length === 0 && !startDate && !endDate) ? (
        <div className="text-center rounded-[1.5rem] border border-dashed border-gray-300 p-12 bg-white">
          <svg className="mx-auto h-12 w-12 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
          </svg>
          <h3 className="mt-2 text-sm font-semibold text-gray-900">No transcription usage yet</h3>
          <p className="mt-1 text-sm text-gray-500">Upload an audio recording to start seeing your usage analytics.</p>
        </div>
      ) : (
        <div className="space-y-8">
          
          {/* Summary Cards */}
          <div className="grid grid-cols-1 gap-6 sm:grid-cols-3">
            <div className={`${cardStyle} p-6 flex flex-col`}>
              <h3 className="text-sm font-semibold text-gray-500 tracking-wide uppercase">Transcription Minutes</h3>
              <div className="mt-2 flex items-baseline gap-2">
                <span className="text-4xl font-bold tracking-tight text-gray-900">
                  {data.summary.total_duration_seconds > 0 ? (data.summary.total_duration_seconds / 60).toFixed(1) : "0"}
                </span>
                <span className="text-sm font-medium text-gray-500">min</span>
              </div>
            </div>
            
            <div className={`${cardStyle} p-6 flex flex-col`}>
              <h3 className="text-sm font-semibold text-gray-500 tracking-wide uppercase">Total Requests</h3>
              <div className="mt-2 flex items-baseline gap-2">
                <span className="text-4xl font-bold tracking-tight text-gray-900">
                  {data.summary.total_requests}
                </span>
              </div>
            </div>
            
            <div className={`${cardStyle} p-6 flex flex-col`}>
              <h3 className="text-sm font-semibold text-gray-500 tracking-wide uppercase">Completed Transcriptions</h3>
              <div className="mt-2 flex items-baseline gap-2">
                <span className="text-4xl font-bold tracking-tight text-gray-900">
                  {data.summary.completed_requests}
                </span>
              </div>
              {data.summary.failed_requests > 0 && (
                <div className="mt-1 text-sm font-medium text-red-500">
                  {data.summary.failed_requests} failed
                </div>
              )}
            </div>
          </div>

          {/* Charts */}
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
            <div className={`${cardStyle} p-6 flex flex-col min-h-[350px]`}>
              <h3 className="text-sm font-semibold text-gray-500 tracking-wide uppercase mb-6">Request Volume</h3>
              <div className="flex-1 w-full h-full min-h-[250px]">
                {chartData.length > 0 ? (
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={chartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                      <defs>
                        <linearGradient id="colorReq" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#2563eb" stopOpacity={0.3}/>
                          <stop offset="95%" stopColor="#2563eb" stopOpacity={0}/>
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e5e7eb" />
                      <XAxis dataKey="date" axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: '#6b7280' }} dy={10} />
                      <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: '#6b7280' }} />
                      <Tooltip 
                        contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                        formatter={(value: any) => [`${value} requests`, 'Volume']}
                      />
                      <Area type="monotone" dataKey="requests" stroke="#2563eb" strokeWidth={2} fillOpacity={1} fill="url(#colorReq)" />
                    </AreaChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="h-full flex items-center justify-center text-sm text-gray-400">No data for selected period</div>
                )}
              </div>
            </div>

            <div className={`${cardStyle} p-6 flex flex-col min-h-[350px]`}>
              <h3 className="text-sm font-semibold text-gray-500 tracking-wide uppercase mb-6">Daily Transcription Duration</h3>
              <div className="flex-1 w-full h-full min-h-[250px]">
                {chartData.length > 0 ? (
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={chartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                      <defs>
                        <linearGradient id="colorMin" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#8b5cf6" stopOpacity={0.3}/>
                          <stop offset="95%" stopColor="#8b5cf6" stopOpacity={0}/>
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e5e7eb" />
                      <XAxis dataKey="date" axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: '#6b7280' }} dy={10} />
                      <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: '#6b7280' }} />
                      <Tooltip 
                        contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                        formatter={(value: any) => [`${value} min`, 'Duration']}
                      />
                      <Area type="monotone" dataKey="minutes" stroke="#8b5cf6" strokeWidth={2} fillOpacity={1} fill="url(#colorMin)" />
                    </AreaChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="h-full flex items-center justify-center text-sm text-gray-400">No data for selected period</div>
                )}
              </div>
            </div>
          </div>

          {/* Usage History Table */}
          <div className={`${cardStyle} overflow-hidden`}>
            <div className="p-6 border-b border-gray-100">
              <h3 className="text-sm font-semibold text-gray-500 tracking-wide uppercase">Usage History</h3>
            </div>
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50/50">
                  <tr>
                    <th scope="col" className="whitespace-nowrap py-3.5 pl-6 pr-3 text-left text-xs font-semibold text-gray-900 uppercase tracking-wider">Date / Time</th>
                    <th scope="col" className="whitespace-nowrap px-3 py-3.5 text-left text-xs font-semibold text-gray-900 uppercase tracking-wider">Recording</th>
                    <th scope="col" className="whitespace-nowrap px-3 py-3.5 text-left text-xs font-semibold text-gray-900 uppercase tracking-wider">Model</th>
                    <th scope="col" className="whitespace-nowrap px-3 py-3.5 text-left text-xs font-semibold text-gray-900 uppercase tracking-wider">Request ID</th>
                    <th scope="col" className="whitespace-nowrap px-3 py-3.5 text-left text-xs font-semibold text-gray-900 uppercase tracking-wider">Duration</th>
                    <th scope="col" className="whitespace-nowrap px-3 py-3.5 text-left text-xs font-semibold text-gray-900 uppercase tracking-wider">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 bg-white">
                  {data.history.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="py-8 text-center text-sm text-gray-500">
                        No usage history found for this period.
                      </td>
                    </tr>
                  ) : (
                    data.history.map((row, idx) => (
                      <tr key={idx} className="hover:bg-gray-50 transition-colors">
                        <td className="whitespace-nowrap py-4 pl-6 pr-3 text-sm text-gray-500">
                          {new Date(row.created_at).toLocaleString(undefined, {
                            year: 'numeric', month: 'short', day: 'numeric',
                            hour: '2-digit', minute: '2-digit'
                          })}
                        </td>
                        <td className="whitespace-nowrap px-3 py-4 text-sm text-gray-900">
                          <div className="flex flex-col">
                            <span className="font-medium text-gray-900">{row.recording_name || "NULL"}</span>
                            <span className="text-xs text-gray-400">{row.original_filename}</span>
                          </div>
                        </td>
                        <td className="whitespace-nowrap px-3 py-4 text-sm text-gray-500">
                          {row.model || "—"}
                        </td>
                        <td className="whitespace-nowrap px-3 py-4 text-sm font-mono text-gray-500">
                          {row.job_id ? (
                            <span className="inline-flex items-center gap-1.5 cursor-pointer hover:text-gray-900" title="Copy ID" onClick={() => navigator.clipboard.writeText(row.job_id!)}>
                              {row.job_id.substring(0, 16)}...
                              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                              </svg>
                            </span>
                          ) : "—"}
                        </td>
                        <td className="whitespace-nowrap px-3 py-4 text-sm text-gray-500">
                          {row.duration_seconds != null ? `${(row.duration_seconds / 60).toFixed(2)} min` : "—"}
                        </td>
                        <td className="whitespace-nowrap px-3 py-4 text-sm text-gray-500">
                          {getStatusBadge(row.status)}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
          
        </div>
      )}
    </div>
  );
}
