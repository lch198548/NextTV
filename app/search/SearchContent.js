"use client";

import { useState, useEffect } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { MovieCard } from "../../components/MovieCard";
import { useSettingsStore } from "../../store/useSettingsStore";
import { searchVideos } from "../../lib/api";

export default function SearchContent() {
  const searchParams = useSearchParams();
  const query = searchParams.get("q") || "";
  const router = useRouter();
  const [inputValue, setInputValue] = useState(query);
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [mediaType, setMediaType] = useState("all"); // 'all', 'movie', 'tv'
  const [sourceFilter, setSourceFilter] = useState("all"); // 视频源筛选
  const videoSources = useSettingsStore((state) => state.videoSources);

  useEffect(() => {
    setInputValue(query);
  }, [query]);

  // 执行搜索
  useEffect(() => {
    async function performSearch() {
      if (!query || !query.trim()) {
        setResults([]);
        return;
      }

      setLoading(true);
      setError(null);

      try {
        const searchResults = await searchVideos(query, videoSources);
        setResults(searchResults);

        if (searchResults.length === 0) {
          setError("未找到相关结果，请尝试其他关键词");
        }
      } catch (err) {
        console.error("搜索错误:", err);
        setError("搜索失败，请稍后重试");
        setResults([]);
      } finally {
        setLoading(false);
      }
    }

    performSearch();
  }, [query, videoSources]);

  const handleSearch = (e) => {
    e.preventDefault();
    if (inputValue && inputValue.trim()) {
      router.push(`/search?q=${encodeURIComponent(inputValue)}`);
    }
  };

  // 根据媒体类型和视频源过滤结果
  const filteredResults = results.filter((result) => {
    // 媒体类型筛选
    let matchMediaType = true;
    if (mediaType === "movie") {
      matchMediaType = result.type === "movie";
    } else if (mediaType === "tv") {
      matchMediaType = result.type === "tv";
    }

    // 视频源筛选
    let matchSource = true;
    if (sourceFilter !== "all") {
      matchSource = result.source === sourceFilter;
    }

    return matchMediaType && matchSource;
  });

  return (
    <div className="w-full max-w-7xl flex flex-col gap-8 pt-6">
      <div className="flex flex-col items-center justify-start gap-6 w-full max-w-3xl mx-auto">
        <form onSubmit={handleSearch} className="w-full relative group">
          <div className="absolute inset-y-0 left-4 flex items-center pointer-events-none text-gray-400 group-focus-within:text-primary transition-colors">
            <span className="material-symbols-outlined">search</span>
          </div>
          <input
            className="w-full h-14 bg-white border border-gray-200 rounded-xl pl-12 pr-4 text-gray-900 placeholder-gray-400 focus:ring-2 focus:ring-primary focus:border-transparent transition-all shadow-sm text-lg"
            placeholder="搜索电影、电视剧..."
            type="text"
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
          />
          <div className="absolute inset-y-0 right-4 flex items-center">
            <div className="flex gap-2">
              {inputValue && (
                <button
                  type="button"
                  onClick={() => {
                    setInputValue("");
                    router.push("/search");
                  }}
                  className="p-1 hover:bg-gray-100 rounded-md text-gray-400 hover:text-gray-600 transition-colors"
                >
                  <span className="material-symbols-outlined text-xl">
                    close
                  </span>
                </button>
              )}
              <div className="w-px h-6 bg-gray-200 self-center"></div>
              <span className="bg-gray-100 text-gray-500 text-xs px-2 py-1 rounded border border-gray-200 self-center">
                ⌘K
              </span>
            </div>
          </div>
        </form>

        <div className="bg-white p-1.5 rounded-xl inline-flex shadow-sm border border-gray-200">
          <label className="cursor-pointer relative">
            <input
              className="peer sr-only"
              name="media-type"
              type="radio"
              value="all"
              checked={mediaType === "all"}
              onChange={(e) => setMediaType(e.target.value)}
            />
            <div className="px-6 py-2 rounded-lg text-sm font-semibold text-gray-500 peer-checked:bg-primary peer-checked:text-white peer-checked:shadow-md transition-all flex items-center gap-2">
              <span className="material-symbols-outlined text-[18px]">
                grid_view
              </span>
              全部
            </div>
          </label>
          <label className="cursor-pointer relative">
            <input
              className="peer sr-only"
              name="media-type"
              type="radio"
              value="movie"
              checked={mediaType === "movie"}
              onChange={(e) => setMediaType(e.target.value)}
            />
            <div className="px-6 py-2 rounded-lg text-sm font-semibold text-gray-500 peer-checked:bg-primary peer-checked:text-white peer-checked:shadow-md transition-all flex items-center gap-2">
              <span className="material-symbols-outlined text-[18px]">
                movie
              </span>
              电影
            </div>
          </label>
          <label className="cursor-pointer relative">
            <input
              className="peer sr-only"
              name="media-type"
              type="radio"
              value="tv"
              checked={mediaType === "tv"}
              onChange={(e) => setMediaType(e.target.value)}
            />
            <div className="px-6 py-2 rounded-lg text-sm font-semibold text-gray-500 peer-checked:bg-primary peer-checked:text-white peer-checked:shadow-md transition-all flex items-center gap-2">
              <span className="material-symbols-outlined text-[18px]">tv</span>
              电视剧
            </div>
          </label>
        </div>
      </div>

      <div>
        {loading ? (
          <div className="flex flex-col items-center justify-center py-20">
            <div className="animate-spin rounded-full h-16 w-16 border-4 border-primary border-t-transparent mb-4"></div>
            <p className="text-gray-500">正在搜索中...</p>
          </div>
        ) : error ? (
          <div className="flex flex-col items-center justify-center py-20">
            <span className="material-symbols-outlined text-6xl text-gray-300 mb-4">
              search_off
            </span>
            <p className="text-gray-500">{error}</p>
          </div>
        ) : query && results.length > 0 ? (
          <>
            <div className="flex items-baseline justify-between mb-6">
              <h2 className="text-xl text-gray-500 font-medium">
                找到 {filteredResults.length} 个关于{" "}
                <span className="text-gray-900 font-bold text-2xl mx-1">
                  "{query}"
                </span>{" "}
                的结果
              </h2>
              <div className="flex items-center gap-2 text-sm text-gray-500">
                <span>视频源：</span>
                <select
                  className="bg-transparent border-none text-gray-900 font-medium focus:ring-0 cursor-pointer py-0 pr-8 pl-0"
                  value={sourceFilter}
                  onChange={(e) => setSourceFilter(e.target.value)}
                >
                  <option value="all">全部</option>
                  {videoSources.map((source) => (
                    <option key={source.key} value={source.key}>
                      {source.name}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-6">
              {filteredResults.map((movie) => (
                <MovieCard key={`${movie.source}-${movie.id}`} movie={movie} />
              ))}
            </div>
          </>
        ) : query && results.length === 0 && !loading ? (
          <div className="flex flex-col items-center justify-center py-20">
            <span className="material-symbols-outlined text-6xl text-gray-300 mb-4">
              movie
            </span>
            <p className="text-gray-500">请输入关键词开始搜索</p>
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center py-20">
            <span className="material-symbols-outlined text-6xl text-gray-300 mb-4">
              search
            </span>
            <p className="text-gray-500">请输入关键词开始搜索</p>
          </div>
        )}
      </div>
    </div>
  );
}
