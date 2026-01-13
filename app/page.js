"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { MovieCard } from "../components/MovieCard";
import { ContinueWatching } from "../components/ContinueWatching";
import { usePlayHistoryStore } from "../store/usePlayHistoryStore";
import {
  fetchRecommendations,
  loadUserTags,
  saveUserTags,
  defaultMovieTags,
  defaultTvTags,
  convertDoubanToMovie,
} from "../lib/doubanApi";

export default function Home() {
  const router = useRouter();
  const [searchValue, setSearchValue] = useState("");
  const [mediaType, setMediaType] = useState("movie");
  const [currentTag, setCurrentTag] = useState("热门");
  const [movies, setMovies] = useState([]);
  const [loading, setLoading] = useState(false);
  const [page, setPage] = useState(0);
  const [movieTags, setMovieTags] = useState([]);
  const [tvTags, setTvTags] = useState([]);
  const [showTagModal, setShowTagModal] = useState(false);
  const pageSize = 12;

  // 获取播放记录
  const playHistory = usePlayHistoryStore((state) => state.playHistory);

  useEffect(() => {
    const { movieTags: loadedMovieTags, tvTags: loadedTvTags } = loadUserTags();
    setMovieTags(loadedMovieTags);
    setTvTags(loadedTvTags);
  }, []);

  useEffect(() => {
    loadMovies();
  }, [mediaType, currentTag, page]);

  const loadMovies = async () => {
    setLoading(true);
    try {
      const data = await fetchRecommendations(
        mediaType,
        currentTag,
        pageSize,
        page * pageSize
      );
      const converted = data.subjects.map(convertDoubanToMovie);
      setMovies(converted);
    } catch (error) {
      console.error("加载失败:", error);
      setMovies([]);
    } finally {
      setLoading(false);
    }
  };

  const handleSearch = (e) => {
    e.preventDefault();
    if (searchValue.trim()) {
      router.push(`/search?q=${encodeURIComponent(searchValue)}`);
    }
  };

  const handleMediaTypeChange = (type) => {
    setMediaType(type);
    setCurrentTag("热门");
    setPage(0);
  };

  const handleTagClick = (tag) => {
    setCurrentTag(tag);
    setPage(0);
  };

  const handlePrevPage = () => {
    if (page > 0) {
      setPage(page - 1);
      window.scrollTo({ top: 0, behavior: "smooth" });
    }
  };

  const handleNextPage = () => {
    setPage(page + 1);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const currentTags = mediaType === "movie" ? movieTags : tvTags;

  const handleAddTag = (tagName) => {
    const trimmedTag = tagName.trim();
    if (!trimmedTag) return;

    if (mediaType === "movie") {
      if (movieTags.includes(trimmedTag)) {
        alert("标签已存在");
        return;
      }
      const newTags = [...movieTags, trimmedTag];
      setMovieTags(newTags);
      saveUserTags(newTags, tvTags);
    } else {
      if (tvTags.includes(trimmedTag)) {
        alert("标签已存在");
        return;
      }
      const newTags = [...tvTags, trimmedTag];
      setTvTags(newTags);
      saveUserTags(movieTags, newTags);
    }
  };

  const handleDeleteTag = (tag) => {
    if (tag === "热门") {
      alert("热门标签不能删除");
      return;
    }

    if (mediaType === "movie") {
      const newTags = movieTags.filter((t) => t !== tag);
      setMovieTags(newTags);
      saveUserTags(newTags, tvTags);
    } else {
      const newTags = tvTags.filter((t) => t !== tag);
      setTvTags(newTags);
      saveUserTags(movieTags, newTags);
    }

    if (currentTag === tag) {
      setCurrentTag("热门");
      setPage(0);
    }
  };

  const handleResetTags = () => {
    if (mediaType === "movie") {
      setMovieTags([...defaultMovieTags]);
      saveUserTags([...defaultMovieTags], tvTags);
    } else {
      setTvTags([...defaultTvTags]);
      saveUserTags(movieTags, [...defaultTvTags]);
    }
    setCurrentTag("热门");
    setPage(0);
  };

  return (
    <div className="w-full max-w-7xl flex flex-col gap-8 pt-6">
      {/* Search Hero */}
      <div className="flex flex-col items-center justify-start gap-6 w-full max-w-3xl mx-auto">
        <form onSubmit={handleSearch} className="w-full relative group">
          <div className="absolute inset-y-0 left-4 flex items-center pointer-events-none text-gray-400 group-focus-within:text-primary transition-colors">
            <span className="material-symbols-outlined">search</span>
          </div>
          <input
            className="w-full h-14 bg-white border border-gray-200 rounded-xl pl-12 pr-4 text-gray-900 placeholder-gray-400 focus:ring-2 focus:ring-primary focus:border-transparent transition-all shadow-sm text-lg"
            placeholder="搜索电影、电视剧..."
            type="text"
            value={searchValue}
            onChange={(e) => setSearchValue(e.target.value)}
          />
          <div className="absolute inset-y-0 right-4 flex items-center">
            <span className="bg-gray-100 text-gray-500 text-xs px-2 py-1 rounded border border-gray-200">
              ⌘K
            </span>
          </div>
        </form>

        <div className="bg-white p-1.5 rounded-xl inline-flex shadow-sm border border-gray-200">
          <label className="cursor-pointer relative">
            <input
              className="peer sr-only"
              name="media-type"
              type="radio"
              value="movie"
              checked={mediaType === "movie"}
              onChange={() => handleMediaTypeChange("movie")}
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
              onChange={() => handleMediaTypeChange("tv")}
            />
            <div className="px-6 py-2 rounded-lg text-sm font-semibold text-gray-500 peer-checked:bg-primary peer-checked:text-white peer-checked:shadow-md transition-all flex items-center gap-2">
              <span className="material-symbols-outlined text-[18px]">tv</span>
              电视剧
            </div>
          </label>
        </div>
      </div>

      {/* Categories */}
      <div className="w-full overflow-hidden relative group/scroll">
        <div className="flex gap-3 overflow-x-auto hide-scrollbar py-2 px-1">
          <button
            onClick={() => setShowTagModal(true)}
            className="shrink-0 px-5 py-2 rounded-lg text-sm font-medium whitespace-nowrap transition-all bg-white border border-gray-200 text-gray-600 hover:bg-gray-50 hover:text-gray-900 cursor-pointer"
          >
            <span className="material-symbols-outlined text-[16px] align-middle mr-1">
              add
            </span>
            管理标签
          </button>
          {currentTags.map((tag) => (
            <button
              key={tag}
              onClick={() => handleTagClick(tag)}
              className={`shrink-0 px-5 py-2 rounded-lg text-sm font-medium whitespace-nowrap transition-all cursor-pointer ${
                tag === currentTag
                  ? "bg-primary/10 border border-primary text-primary font-semibold hover:bg-primary hover:text-white"
                  : "bg-white border border-gray-200 text-gray-600 hover:bg-gray-50 hover:text-gray-900"
              }`}
            >
              {tag}
            </button>
          ))}
        </div>
        <div className="absolute right-0 top-0 bottom-0 w-24 bg-linear-to-l from-background-light to-transparent pointer-events-none"></div>
      </div>

      {/* Popular Section */}
      <div>
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <span className="w-1 h-6 bg-primary rounded-full"></span>
            当下热门 - {currentTag}
          </h2>

          {/* Pagination Controls */}
          <div className="flex items-center gap-2">
            <button
              onClick={handlePrevPage}
              disabled={page === 0}
              className={`flex items-center justify-center w-9 h-9 rounded-lg border transition-all ${
                page === 0
                  ? "border-gray-200 text-gray-300 cursor-not-allowed opacity-50"
                  : "border-gray-200 text-gray-600 hover:bg-gray-50 hover:border-primary hover:text-primary cursor-pointer"
              }`}
              title="上一页"
            >
              <span className="material-symbols-outlined text-[20px]">
                chevron_left
              </span>
            </button>
            <button
              onClick={handleNextPage}
              disabled={movies.length < pageSize}
              className={`flex items-center justify-center w-9 h-9 rounded-lg border transition-all ${
                movies.length < pageSize
                  ? "border-gray-200 text-gray-300 cursor-not-allowed opacity-50"
                  : "border-gray-200 text-gray-600 hover:bg-gray-50 hover:border-primary hover:text-primary cursor-pointer"
              }`}
              title="下一页"
            >
              <span className="material-symbols-outlined text-[20px]">
                chevron_right
              </span>
            </button>
          </div>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-20">
            <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin"></div>
            <span className="ml-4 text-gray-600">加载中...</span>
          </div>
        ) : (
          <div className="grid grid-cols-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 xl:grid-cols-6 gap-6">
            {movies.map((movie) => (
              <MovieCard key={movie.id} movie={movie} />
            ))}
          </div>
        )}
      </div>

      {/* Continue Watching Section */}
      {playHistory && playHistory.length > 0 && (
        <ContinueWatching playHistory={playHistory} />
      )}

      {/* Tag Management Modal */}
      {showTagModal && (
        <div
          className="fixed inset-0 bg-black/75 flex items-center justify-center z-50"
          onClick={() => setShowTagModal(false)}
        >
          <div
            className="bg-white rounded-2xl p-6 max-w-md w-full mx-4 max-h-[90vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-xl font-bold text-gray-900">
                标签管理 ({mediaType === "movie" ? "电影" : "电视剧"})
              </h3>
              <button
                onClick={() => setShowTagModal(false)}
                className="text-gray-400 hover:text-gray-600 cursor-pointer"
              >
                <span className="material-symbols-outlined">close</span>
              </button>
            </div>

            <div className="mb-6">
              <div className="flex items-center justify-between mb-3">
                <h4 className="font-semibold text-gray-700">当前标签</h4>
                <button
                  onClick={handleResetTags}
                  className="text-xs px-3 py-1 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg cursor-pointer transition-colors"
                >
                  恢复默认
                </button>
              </div>
              <div className="flex flex-wrap gap-2">
                {currentTags.map((tag) => (
                  <div
                    key={tag}
                    className="group bg-gray-100 text-gray-700 py-1.5 px-3 rounded-lg text-sm font-medium flex items-center gap-2"
                  >
                    <span>{tag}</span>
                    {tag !== "热门" && (
                      <button
                        onClick={() => handleDeleteTag(tag)}
                        className="text-gray-400 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer"
                      >
                        <span className="material-symbols-outlined text-[16px]">
                          close
                        </span>
                      </button>
                    )}
                  </div>
                ))}
              </div>
            </div>

            <div className="border-t border-gray-200 pt-4">
              <h4 className="font-semibold text-gray-700 mb-3">添加新标签</h4>
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  const input = e.target.elements.tagName;
                  handleAddTag(input.value);
                  input.value = "";
                }}
                className="flex gap-2"
              >
                <input
                  type="text"
                  name="tagName"
                  placeholder="输入标签名称..."
                  className="flex-1 bg-gray-50 border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
                />
                <button
                  type="submit"
                  className="bg-primary hover:bg-primary-dark text-white px-4 py-2 rounded-lg font-medium cursor-pointer transition-colors"
                >
                  添加
                </button>
              </form>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
