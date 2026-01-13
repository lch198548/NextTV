"use client";

import { useState } from "react";

export function EpisodeList({
  episodes,
  episodesTitles,
  currentEpisodeIndex,
  onEpisodeClick,
}) {
  const [episodesCollapsed, setEpisodesCollapsed] = useState(false);

  if (!episodes || episodes.length === 0) {
    return null;
  }

  return (
    <div className="bg-white rounded-xl border border-gray-200 overflow-hidden shadow-sm sticky top-28">
      <div className="p-4 border-b border-gray-100 flex items-center justify-between bg-gray-50/50">
        <h3 className="font-bold text-gray-900 text-lg">选集</h3>
        <button className="text-xs text-gray-500 hover:text-primary flex items-center gap-1 transition-colors">
          {episodes.length > 1 ? `共 ${episodes.length} 集` : "电影"}
          <span className="material-symbols-outlined text-sm">info</span>
        </button>
      </div>

      {episodes.length > 1 && (
        <>
          <div
            className="px-4 py-3 border-b border-gray-100 flex items-center justify-between cursor-pointer hover:bg-gray-50 transition-colors"
            onClick={() => setEpisodesCollapsed(!episodesCollapsed)}
          >
            <span className="text-sm font-semibold text-gray-700">
              第 1 - {episodes.length} 集
            </span>
            <span
              className={`material-symbols-outlined text-gray-400 text-lg transition-transform ${
                episodesCollapsed ? "" : "rotate-180"
              }`}
            >
              expand_less
            </span>
          </div>
          {!episodesCollapsed && (
            <div className="p-4 pt-6 grid grid-cols-5 sm:grid-cols-6 md:grid-cols-7 lg:grid-cols-8 gap-2.5 max-h-[500px] overflow-y-auto custom-scrollbar">
              {episodes.map((_, index) => {
                const episodeTitle =
                  episodesTitles?.[index] || `第${index + 1}集`;
                const displayIndex = String(index + 1).padStart(2, "0");
                return (
                  <div key={index} className="relative group/episode">
                    <button
                      className={`w-full aspect-square flex items-center justify-center rounded-lg font-medium border transition-all relative text-xs cursor-pointer
                        ${
                          index === currentEpisodeIndex
                            ? "bg-primary text-white font-semibold shadow-md ring-2 ring-primary/20 border-transparent"
                            : "bg-gray-50 text-gray-700 border-gray-200 hover:border-primary hover:text-primary hover:bg-white"
                        }
                      `}
                      onClick={() => onEpisodeClick(index)}
                    >
                      {displayIndex}
                      {index === currentEpisodeIndex && (
                        <span className="absolute -top-1 -right-1 flex h-2.5 w-2.5">
                          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-white opacity-75"></span>
                          <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-white"></span>
                        </span>
                      )}
                    </button>
                    {/* Hover Tooltip */}
                    <div className="absolute top-full left-1/2 -translate-x-1/2 mt-2 px-2 py-1 bg-gray-900 text-white text-xs rounded whitespace-nowrap opacity-0 invisible group-hover/episode:opacity-100 group-hover/episode:visible transition-all duration-200 pointer-events-none z-50">
                      {episodeTitle}
                      <div className="absolute bottom-full left-1/2 -translate-x-1/2 -mb-1 border-4 border-transparent border-b-gray-900"></div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </>
      )}

      {episodes.length === 1 && (
        <div className="p-4 text-center text-gray-500">
          这是一部电影，无需选集
        </div>
      )}
    </div>
  );
}
