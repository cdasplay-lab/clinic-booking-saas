export default function DashboardLoading() {
  return (
    <div className="flex h-screen overflow-hidden bg-gray-50" dir="rtl">
      {/* Sidebar skeleton */}
      <div className="w-64 bg-white border-l border-gray-200 flex flex-col animate-pulse">
        <div className="p-4 border-b border-gray-200">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 bg-gray-200 rounded-lg" />
            <div className="space-y-1">
              <div className="w-20 h-3 bg-gray-200 rounded" />
              <div className="w-28 h-2 bg-gray-100 rounded" />
            </div>
          </div>
        </div>
        <div className="p-3 space-y-2">
          {Array.from({ length: 8 }).map((_, i) => (
            <div key={i} className="h-8 bg-gray-100 rounded-lg" style={{ width: `${70 + Math.random() * 25}%` }} />
          ))}
        </div>
      </div>
      {/* Main content skeleton */}
      <div className="flex-1 flex flex-col">
        <div className="h-14 bg-white border-b border-gray-200 animate-pulse" />
        <div className="flex-1 p-6 space-y-6 animate-pulse">
          <div className="grid grid-cols-4 gap-4">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="h-24 bg-white rounded-xl border border-gray-100" />
            ))}
          </div>
          <div className="h-64 bg-white rounded-xl border border-gray-100" />
          <div className="grid grid-cols-2 gap-4">
            <div className="h-48 bg-white rounded-xl border border-gray-100" />
            <div className="h-48 bg-white rounded-xl border border-gray-100" />
          </div>
        </div>
      </div>
    </div>
  )
}
