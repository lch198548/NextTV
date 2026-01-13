"use client";

import { useRouter } from "next/navigation";

export function ContinueWatching({ playHistory }) {
  const router = useRouter();

  if (!playHistory || playHistory.length === 0) {
    return null;
  }

  // 格式化时间
  const formatTime = (seconds) => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins} 分 ${secs} 秒`;
  };

  // 格式化集数信息
  const formatEpisodeInfo = (record) => {
    if (record.totalEpisodes > 1) {
      return `第${record.currentEpisodeIndex + 1}集 • 剩余 ${formatTime(
        record.duration - record.currentTime
      )}`;
    }
    return `剩余 ${formatTime(record.duration - record.currentTime)}`;
  };

  const handlePlayClick = (record) => {
    router.push(`/play/${record.id}?source=${record.source}`);
  };

  return (
    <div className="w-full">
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
          <span className="w-1 h-6 bg-primary rounded-full"></span>
          继续观看
        </h2>
      </div>

      <div className="flex gap-4 overflow-x-auto hide-scrollbar pb-2">
        {playHistory.slice(0, 6).map((record) => (
          <div
            key={`${record.source}-${record.id}`}
            className="group relative shrink-0 w-[280px] bg-white rounded-xl border border-gray-200 overflow-hidden hover:shadow-xl transition-all duration-300 cursor-pointer"
            onClick={() => handlePlayClick(record)}
          >
            <div className="flex gap-4 p-4">
              {/* 海报 */}
              <div className="relative w-24 h-36 bg-gray-100 rounded-lg overflow-hidden shrink-0">
                <img
                  src={record.poster}
                  alt={record.title}
                  className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                />

                {/* 播放图标 */}
                <div className="absolute inset-0 bg-black/0 group-hover:bg-black/40 transition-all duration-300 flex items-center justify-center">
                  <div className="w-10 h-10 rounded-full bg-white/90 backdrop-blur-sm flex items-center justify-center opacity-0 group-hover:opacity-100 transform scale-75 group-hover:scale-100 transition-all duration-300">
                    <span className="material-symbols-outlined text-primary text-2xl ml-0.5">
                      play_arrow
                    </span>
                  </div>
                </div>
              </div>

              {/* 信息区域 */}
              <div className="flex-1 flex flex-col justify-between min-w-0">
                <div>
                  <h3 className="font-bold text-gray-900 text-base mb-1 line-clamp-2 group-hover:text-primary transition-colors">
                    {record.title}
                  </h3>
                  <p className="text-xs text-gray-500 mb-1">
                    {formatEpisodeInfo(record)}
                  </p>
                  {record.year && (
                    <p className="text-xs text-gray-400">{record.year}</p>
                  )}
                </div>

                {/* 进度条 */}
                <div className="mt-2">
                  <div className="h-1 bg-gray-200 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-primary transition-all duration-300"
                      style={{ width: `${Math.min(record.progress, 100)}%` }}
                    ></div>
                  </div>
                  <p className="text-xs text-gray-400 mt-1">
                    {Math.floor(record.progress)}%
                  </p>
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
