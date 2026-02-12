'use client';

export function DashboardSkeleton() {
  return (
    <div className="animate-pulse">
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <div className="h-8 w-40 bg-gray-200 dark:bg-[#2a2f3a] rounded" />
          <div className="h-4 w-64 bg-gray-200 dark:bg-[#2a2f3a] rounded mt-2" />
        </div>
        <div className="flex gap-3">
          <div className="h-10 w-32 bg-gray-200 dark:bg-[#2a2f3a] rounded-lg" />
          <div className="h-10 w-24 bg-gray-200 dark:bg-[#2a2f3a] rounded-lg" />
        </div>
      </div>

      {/* Stat Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        {[...Array(4)].map((_, i) => (
          <div key={i} className="bg-white dark:bg-[#1a1d24] rounded-xl border border-gray-200 dark:border-[#2a2f3a] p-5">
            <div className="flex items-center gap-3 mb-3">
              <div className="w-9 h-9 bg-gray-200 dark:bg-[#2a2f3a] rounded-lg" />
              <div className="h-4 w-24 bg-gray-200 dark:bg-[#2a2f3a] rounded" />
            </div>
            <div className="h-8 w-16 bg-gray-200 dark:bg-[#2a2f3a] rounded" />
          </div>
        ))}
      </div>

      {/* Capacity & Activity */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white dark:bg-[#1a1d24] rounded-xl border border-gray-200 dark:border-[#2a2f3a] p-6">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-9 h-9 bg-gray-200 dark:bg-[#2a2f3a] rounded-lg" />
            <div>
              <div className="h-5 w-40 bg-gray-200 dark:bg-[#2a2f3a] rounded" />
              <div className="h-3 w-32 bg-gray-200 dark:bg-[#2a2f3a] rounded mt-2" />
            </div>
          </div>
          <div className="h-6 w-full bg-gray-200 dark:bg-[#2a2f3a] rounded-full mb-4" />
          <div className="grid grid-cols-3 gap-4">
            {[...Array(3)].map((_, i) => (
              <div key={i} className="h-16 bg-gray-100 dark:bg-[#0f1117] rounded-lg" />
            ))}
          </div>
        </div>
        <div className="bg-white dark:bg-[#1a1d24] rounded-xl border border-gray-200 dark:border-[#2a2f3a] p-6">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-9 h-9 bg-gray-200 dark:bg-[#2a2f3a] rounded-lg" />
            <div>
              <div className="h-5 w-40 bg-gray-200 dark:bg-[#2a2f3a] rounded" />
              <div className="h-3 w-48 bg-gray-200 dark:bg-[#2a2f3a] rounded mt-2" />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-6">
            {[...Array(2)].map((_, i) => (
              <div key={i} className="h-32 bg-gray-100 dark:bg-[#0f1117] rounded-xl" />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

export function InboxesTableSkeleton() {
  return (
    <div className="animate-pulse">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <div className="h-8 w-40 bg-gray-200 dark:bg-[#2a2f3a] rounded" />
          <div className="h-4 w-64 bg-gray-200 dark:bg-[#2a2f3a] rounded mt-2" />
        </div>
        <div className="flex gap-3">
          <div className="h-10 w-24 bg-gray-200 dark:bg-[#2a2f3a] rounded-lg" />
          <div className="h-10 w-36 bg-gray-200 dark:bg-[#2a2f3a] rounded-lg" />
        </div>
      </div>

      {/* Table */}
      <div className="bg-white dark:bg-[#1a1d24] rounded-xl border border-gray-200 dark:border-[#2a2f3a] overflow-hidden">
        {/* Header row */}
        <div className="border-b border-gray-200 dark:border-[#2a2f3a] p-4 flex gap-6">
          {[...Array(7)].map((_, i) => (
            <div key={i} className="h-4 w-20 bg-gray-200 dark:bg-[#2a2f3a] rounded" />
          ))}
        </div>
        {/* Data rows */}
        {[...Array(5)].map((_, i) => (
          <div key={i} className="border-b border-gray-100 dark:border-[#2a2f3a] p-4 flex gap-6 items-center">
            <div className="h-4 w-40 bg-gray-200 dark:bg-[#2a2f3a] rounded" />
            <div className="h-4 w-16 bg-gray-200 dark:bg-[#2a2f3a] rounded" />
            <div className="h-5 w-20 bg-gray-200 dark:bg-[#2a2f3a] rounded-full" />
            <div className="h-4 w-8 bg-gray-200 dark:bg-[#2a2f3a] rounded" />
            <div className="flex gap-2 flex-1">
              <div className="h-2 w-20 bg-gray-200 dark:bg-[#2a2f3a] rounded-full" />
              <div className="h-4 w-12 bg-gray-200 dark:bg-[#2a2f3a] rounded" />
            </div>
            <div className="h-4 w-8 bg-gray-200 dark:bg-[#2a2f3a] rounded" />
            <div className="flex gap-2">
              <div className="h-7 w-7 bg-gray-200 dark:bg-[#2a2f3a] rounded" />
              <div className="h-7 w-7 bg-gray-200 dark:bg-[#2a2f3a] rounded" />
              <div className="h-7 w-7 bg-gray-200 dark:bg-[#2a2f3a] rounded" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export function UsersTableSkeleton() {
  return (
    <div className="animate-pulse">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <div className="h-8 w-40 bg-gray-200 dark:bg-[#2a2f3a] rounded" />
          <div className="h-4 w-64 bg-gray-200 dark:bg-[#2a2f3a] rounded mt-2" />
        </div>
        <div className="h-10 w-24 bg-gray-200 dark:bg-[#2a2f3a] rounded-lg" />
      </div>

      {/* Filters */}
      <div className="bg-white dark:bg-[#1a1d24] rounded-xl border border-gray-200 dark:border-[#2a2f3a] p-4 mb-4">
        <div className="flex gap-4">
          <div className="flex-1 h-10 bg-gray-100 dark:bg-[#0f1117] rounded-lg" />
          <div className="h-10 w-32 bg-gray-100 dark:bg-[#0f1117] rounded-lg" />
        </div>
      </div>

      <div className="h-4 w-48 bg-gray-200 dark:bg-[#2a2f3a] rounded mb-4" />

      {/* Table */}
      <div className="bg-white dark:bg-[#1a1d24] rounded-xl border border-gray-200 dark:border-[#2a2f3a] overflow-hidden">
        {/* Header row */}
        <div className="border-b border-gray-200 dark:border-[#2a2f3a] p-4 flex gap-6">
          {[...Array(7)].map((_, i) => (
            <div key={i} className="h-4 w-20 bg-gray-200 dark:bg-[#2a2f3a] rounded" />
          ))}
        </div>
        {/* Data rows */}
        {[...Array(5)].map((_, i) => (
          <div key={i} className="border-b border-gray-100 dark:border-[#2a2f3a] p-4 flex gap-6 items-center">
            <div className="flex gap-2">
              <div className="h-4 w-4 bg-gray-200 dark:bg-[#2a2f3a] rounded" />
              <div className="h-4 w-40 bg-gray-200 dark:bg-[#2a2f3a] rounded" />
            </div>
            <div className="h-5 w-16 bg-gray-200 dark:bg-[#2a2f3a] rounded-full" />
            <div className="h-4 w-32 bg-gray-200 dark:bg-[#2a2f3a] rounded" />
            <div className="h-5 w-16 bg-gray-200 dark:bg-[#2a2f3a] rounded-full" />
            <div className="h-4 w-8 bg-gray-200 dark:bg-[#2a2f3a] rounded" />
            <div className="h-4 w-8 bg-gray-200 dark:bg-[#2a2f3a] rounded" />
            <div className="h-4 w-8 bg-gray-200 dark:bg-[#2a2f3a] rounded" />
          </div>
        ))}
      </div>
    </div>
  );
}

export function InboxDetailSkeleton() {
  return (
    <div className="animate-pulse">
      {/* Back link */}
      <div className="h-4 w-32 bg-gray-200 dark:bg-[#2a2f3a] rounded mb-4" />

      {/* Header */}
      <div className="flex items-start justify-between mb-6">
        <div className="flex items-center gap-4">
          <div className="w-14 h-14 bg-gray-200 dark:bg-[#2a2f3a] rounded-xl" />
          <div>
            <div className="h-8 w-64 bg-gray-200 dark:bg-[#2a2f3a] rounded" />
            <div className="flex gap-3 mt-2">
              <div className="h-4 w-16 bg-gray-200 dark:bg-[#2a2f3a] rounded" />
              <div className="h-6 w-20 bg-gray-200 dark:bg-[#2a2f3a] rounded-full" />
            </div>
          </div>
        </div>
        <div className="flex gap-2">
          <div className="h-10 w-36 bg-gray-200 dark:bg-[#2a2f3a] rounded-lg" />
          <div className="h-10 w-24 bg-gray-200 dark:bg-[#2a2f3a] rounded-lg" />
        </div>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        {[...Array(4)].map((_, i) => (
          <div key={i} className="bg-white dark:bg-[#1a1d24] rounded-xl border border-gray-200 dark:border-[#2a2f3a] p-5">
            <div className="flex items-center gap-3 mb-3">
              <div className="w-9 h-9 bg-gray-200 dark:bg-[#2a2f3a] rounded-lg" />
              <div className="h-4 w-24 bg-gray-200 dark:bg-[#2a2f3a] rounded" />
            </div>
            <div className="h-10 w-20 bg-gray-200 dark:bg-[#2a2f3a] rounded" />
          </div>
        ))}
      </div>

      {/* Info Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white dark:bg-[#1a1d24] rounded-xl border border-gray-200 dark:border-[#2a2f3a] p-6">
          <div className="h-6 w-32 bg-gray-200 dark:bg-[#2a2f3a] rounded mb-4" />
          {[...Array(6)].map((_, i) => (
            <div key={i} className="flex justify-between py-3 border-b border-gray-100 dark:border-[#2a2f3a]">
              <div className="h-4 w-24 bg-gray-200 dark:bg-[#2a2f3a] rounded" />
              <div className="h-4 w-32 bg-gray-200 dark:bg-[#2a2f3a] rounded" />
            </div>
          ))}
        </div>
        <div className="bg-white dark:bg-[#1a1d24] rounded-xl border border-gray-200 dark:border-[#2a2f3a] p-6">
          <div className="h-6 w-48 bg-gray-200 dark:bg-[#2a2f3a] rounded mb-4" />
          <div className="space-y-2">
            {[...Array(3)].map((_, i) => (
              <div key={i} className="h-16 bg-gray-100 dark:bg-[#0f1117] rounded-lg" />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
