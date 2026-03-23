"use client";

import { useState, useEffect, useCallback } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { MovieCard } from "@/components/MovieCard";
import { SkeletonCard } from "@/components/SkeletonCard";
import { SearchBox } from "@/components/SearchBox";
import { useSettingsStore } from "@/store/useSettingsStore";
import { searchVideos } from "@/lib/cmsApi";
import {
  MaterialSymbolsSearchRounded,
  MaterialSymbolsGridViewOutlineRounded,
  MaterialSymbolsMovieOutlineRounded,
  MaterialSymbolsTvOutlineRounded,
  MaterialSymbolsSmartphoneOutline,
  MaterialSymbolsChevronLeftRounded,
  MaterialSymbolsChevronRightRounded,
} from "@/components/icons";

export default function SearchContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const query = searchParams.get("q") || "";
  const currentPage = Number(searchParams.get("page")) || 1;
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [mediaType, setMediaType] = useState("all"); // 'all', 'movie', 'tv'
  const [pageCount, setPageCount] = useState(1);
  const videoSources = useSettingsStore((state) => state.videoSources);

  // 只显示已激活的源
  const enabledSources = videoSources.filter((s) => s.enabled);
  // 从 URL 参数读取源过滤，默认为第一个激活源
  const sourceParam = searchParams.get("source");
  const sourceFilter = sourceParam && enabledSources.some((s) => s.key === sourceParam)
    ? sourceParam
    : enabledSources.length > 0 ? enabledSources[0].key : "";

  const handlePageChange = useCallback(
    (page) => {
      const params = new URLSearchParams(searchParams);
      if (page <= 1) {
        params.delete("page");
      } else {
        params.set("page", String(page));
      }
      router.push(`/search?${params.toString()}`);
      window.scrollTo({ top: 0, behavior: "smooth" });
    },
    [searchParams, router],
  );

  const handleSourceChange = useCallback(
    (sourceKey) => {
      const params = new URLSearchParams(searchParams);
      params.set("source", sourceKey);
      params.delete("page");
      router.push(`/search?${params.toString()}`);
    },
    [searchParams, router],
  );

  // 执行搜索
  useEffect(() => {
    async function performSearch() {
      if (!query || !query.trim()) {
        setResults([]);
        setPageCount(1);
        return;
      }

      setLoading(true);
      setError(null);

      try {
        const searchData = await searchVideos(query, videoSources, currentPage);
        setResults(searchData.results);
        setPageCount(searchData.pageCount);

        if (searchData.results.length === 0) {
          setError("未找到相关结果，请尝试其他关键词");
        }
      } catch (err) {
        console.error("搜索错误:", err);
        setError("搜索失败，请稍后重试");
        setResults([]);
        setPageCount(1);
      } finally {
        setLoading(false);
      }
    }

    performSearch();
  }, [query, videoSources, currentPage]);

  // 根据媒体类型和视频源过滤结果
  const filteredResults = results.filter((result) => {
    // 媒体类型筛选
    let matchMediaType = true;
    if (mediaType === "movie") {
      matchMediaType = result.type === "movie";
    } else if (mediaType === "tv") {
      matchMediaType = result.type === "tv";
    } else if (mediaType === "short") {
      matchMediaType = result.type === "short";
    }

    // 视频源筛选
    const matchSource = sourceFilter ? result.source === sourceFilter : true;

    return matchMediaType && matchSource;
  });

  // Render content based on search state - clearer than nested ternaries
  function renderContent() {
    if (loading) {
      return (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-6">
          {Array.from({ length: 12 }).map((_, index) => (
            <SkeletonCard key={index} />
          ))}
        </div>
      );
    }

    if (error) {
      return (
        <div className="flex flex-col items-center justify-center py-20">
          <MaterialSymbolsSearchRounded className="text-6xl text-gray-300 mb-4" />
          <p className="text-gray-500">{error}</p>
        </div>
      );
    }

    if (query && results.length > 0) {
      return (
        <>
          <div className="mb-6">
            <h2 className="text-xl text-gray-500 font-medium">
              找到 {filteredResults.length} 个关于{" "}
              <span className="text-gray-900 font-bold text-2xl mx-1">
                &quot;{query}&quot;
              </span>{" "}
              的结果
            </h2>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-6">
            {filteredResults.map((movie, index) => (
              <div
                key={`${movie.source}-${movie.id}`}
                className="grid-item-animate"
              >
                <MovieCard movie={movie} />
              </div>
            ))}
          </div>

          {pageCount > 1 && (
            <Pagination
              currentPage={currentPage}
              pageCount={pageCount}
              onPageChange={handlePageChange}
            />
          )}
        </>
      );
    }

    // Empty state - no query or no results
    return (
      <div className="flex flex-col items-center justify-center py-20">
        <MaterialSymbolsSearchRounded className="text-6xl text-gray-300 mb-4" />
        <p className="text-gray-500">请输入关键词开始搜索</p>
      </div>
    );
  }

  return (
    <div className="w-full max-w-7xl flex flex-col gap-8 pt-6 page-enter">
      <div className="flex flex-col items-center justify-start gap-6 w-full max-w-3xl mx-auto">
        <SearchBox initialValue={query} />

        <div className="bg-gray-100 p-1 rounded-lg inline-flex items-center gap-0.5">
          <label className="cursor-pointer relative">
            <input
              className="peer sr-only"
              name="media-type"
              type="radio"
              value="all"
              checked={mediaType === "all"}
              onChange={(e) => setMediaType(e.target.value)}
            />
            <div className="media-toggle-btn px-6 py-2 rounded-lg text-sm font-semibold text-gray-500 peer-checked:bg-primary peer-checked:text-white peer-checked:shadow-sm flex items-center gap-2 transition-all">
              <MaterialSymbolsGridViewOutlineRounded className="text-[18px]" />
              全部
            </div>
          </label>
          <div className={`w-px h-4 bg-gray-300 ${mediaType === "all" || mediaType === "movie" ? "opacity-0" : "opacity-100"} transition-opacity`}></div>
          <label className="cursor-pointer relative">
            <input
              className="peer sr-only"
              name="media-type"
              type="radio"
              value="movie"
              checked={mediaType === "movie"}
              onChange={(e) => setMediaType(e.target.value)}
            />
            <div className="media-toggle-btn px-6 py-2 rounded-lg text-sm font-semibold text-gray-500 peer-checked:bg-primary peer-checked:text-white peer-checked:shadow-sm flex items-center gap-2 transition-all">
              <MaterialSymbolsMovieOutlineRounded className="text-[18px]" />
              电影
            </div>
          </label>
          <div className={`w-px h-4 bg-gray-300 ${mediaType === "movie" || mediaType === "tv" ? "opacity-0" : "opacity-100"} transition-opacity`}></div>
          <label className="cursor-pointer relative">
            <input
              className="peer sr-only"
              name="media-type"
              type="radio"
              value="tv"
              checked={mediaType === "tv"}
              onChange={(e) => setMediaType(e.target.value)}
            />
            <div className="media-toggle-btn px-6 py-2 rounded-lg text-sm font-semibold text-gray-500 peer-checked:bg-primary peer-checked:text-white peer-checked:shadow-sm flex items-center gap-2 transition-all">
              <MaterialSymbolsTvOutlineRounded className="text-[18px]" />
              电视剧
            </div>
          </label>
          <div className={`w-px h-4 bg-gray-300 ${mediaType === "tv" || mediaType === "short" ? "opacity-0" : "opacity-100"} transition-opacity`}></div>
          <label className="cursor-pointer relative">
            <input
              className="peer sr-only"
              name="media-type"
              type="radio"
              value="short"
              checked={mediaType === "short"}
              onChange={(e) => setMediaType(e.target.value)}
            />
            <div className="media-toggle-btn px-6 py-2 rounded-lg text-sm font-semibold text-gray-500 peer-checked:bg-primary peer-checked:text-white peer-checked:shadow-sm flex items-center gap-2 transition-all">
              <MaterialSymbolsSmartphoneOutline className="text-[18px]" />
              短剧
            </div>
          </label>
        </div>
      </div>

      {/* 视频源标签过滤 */}
      {query && enabledSources.length > 0 && (
        <div className="w-full overflow-hidden relative">
          <div className="flex gap-3 overflow-x-auto hide-scrollbar py-2 px-1">
            {enabledSources.map((source) => (
              <button
                key={source.key}
                onClick={() => handleSourceChange(source.key)}
                className={`shrink-0 px-5 py-2 rounded-lg text-sm font-medium whitespace-nowrap transition-all cursor-pointer btn-press ${
                  source.key === sourceFilter
                    ? "bg-primary/10 border border-primary text-primary font-semibold hover:bg-primary hover:text-white"
                    : "bg-white border border-gray-200 text-gray-600 hover:bg-gray-50 hover:text-gray-900"
                }`}
              >
                {source.name}
              </button>
            ))}
          </div>
          <div className="absolute right-0 top-0 bottom-0 w-24 bg-linear-to-l from-background-light to-transparent pointer-events-none"></div>
        </div>
      )}

      <div>{renderContent()}</div>
    </div>
  );
}

function Pagination({ currentPage, pageCount, onPageChange }) {
  // 计算要显示的页码范围，最多显示 5 个页码按钮
  function getPageNumbers() {
    const maxVisible = 5;
    if (pageCount <= maxVisible) {
      return Array.from({ length: pageCount }, (_, i) => i + 1);
    }

    let start = Math.max(1, currentPage - Math.floor(maxVisible / 2));
    let end = start + maxVisible - 1;

    if (end > pageCount) {
      end = pageCount;
      start = end - maxVisible + 1;
    }

    return Array.from({ length: end - start + 1 }, (_, i) => start + i);
  }

  const pages = getPageNumbers();

  return (
    <div className="flex items-center justify-center gap-1.5 mt-8 mb-4">
      <button
        className="p-2 rounded-lg text-gray-500 hover:bg-gray-100 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
        disabled={currentPage === 1}
        onClick={() => onPageChange(currentPage - 1)}
        aria-label="上一页"
      >
        <MaterialSymbolsChevronLeftRounded className="text-xl" />
      </button>

      {pages[0] > 1 && (
        <>
          <button
            className="min-w-[36px] h-9 rounded-lg text-sm font-medium text-gray-600 hover:bg-gray-100 transition-colors"
            onClick={() => onPageChange(1)}
          >
            1
          </button>
          {pages[0] > 2 && (
            <span className="min-w-[36px] h-9 flex items-center justify-center text-sm text-gray-400">
              ...
            </span>
          )}
        </>
      )}

      {pages.map((page) => (
        <button
          key={page}
          className={`min-w-[36px] h-9 rounded-lg text-sm font-medium transition-colors ${
            page === currentPage
              ? "bg-primary text-white shadow-sm"
              : "text-gray-600 hover:bg-gray-100"
          }`}
          onClick={() => onPageChange(page)}
        >
          {page}
        </button>
      ))}

      {pages[pages.length - 1] < pageCount && (
        <>
          {pages[pages.length - 1] < pageCount - 1 && (
            <span className="min-w-[36px] h-9 flex items-center justify-center text-sm text-gray-400">
              ...
            </span>
          )}
          <button
            className="min-w-[36px] h-9 rounded-lg text-sm font-medium text-gray-600 hover:bg-gray-100 transition-colors"
            onClick={() => onPageChange(pageCount)}
          >
            {pageCount}
          </button>
        </>
      )}

      <button
        className="p-2 rounded-lg text-gray-500 hover:bg-gray-100 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
        disabled={currentPage === pageCount}
        onClick={() => onPageChange(currentPage + 1)}
        aria-label="下一页"
      >
        <MaterialSymbolsChevronRightRounded className="text-xl" />
      </button>
    </div>
  );
}
