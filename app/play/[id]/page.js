"use client";

import { useState, useEffect, useMemo, useRef, useCallback } from "react";
import { useParams, useSearchParams } from "next/navigation";
import Link from "next/link";
import { Player } from "../../../components/Artplayer";
import { FavoriteButton } from "../../../components/FavoriteButton";
import { EpisodeList } from "../../../components/EpisodeList";
import { getVideoDetail } from "../../../lib/api";
import { useSettingsStore } from "../../../store/useSettingsStore";
import { usePlayHistoryStore } from "../../../store/usePlayHistoryStore";
import { fetchDanmakuFromSources } from "../../../lib/danmakuApi";
import { extractEpisodeNumberFromTitle } from "../../../lib/util";

export default function PlayerPage() {
  const params = useParams();
  const searchParams = useSearchParams();
  const id = params.id;
  const source = searchParams.get("source");

  const [videoDetail, setVideoDetail] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [currentEpisodeIndex, setCurrentEpisodeIndex] = useState(0);
  const [danmaku, setDanmaku] = useState([]); // 弹幕数据

  // 播放器引用
  const playerRef = useRef(null);

  // 稳定的 getInstance 回调，避免因为引用变化导致播放器重新创建
  const handleGetInstance = useCallback((art) => {
    playerRef.current = art;
  }, []);

  // 播放记录store
  const addPlayRecord = usePlayHistoryStore((state) => state.addPlayRecord);
  const getPlayRecord = usePlayHistoryStore((state) => state.getPlayRecord);

  // 获取弹幕源配置
  const danmakuSources = useSettingsStore((state) => state.danmakuSources);

  // 保存播放进度的间隔引用
  const saveIntervalRef = useRef(null);
  const lastSaveTimeRef = useRef(0);

  // 获取视频详情
  useEffect(() => {
    async function fetchVideoDetail() {
      if (!id || !source) {
        setError("缺少必要的参数");
        setLoading(false);
        return;
      }

      // 在 effect 内部直接获取当前的 videoSources，避免作为依赖项
      const videoSources = useSettingsStore.getState().videoSources;
      const sourceConfig = videoSources.find((s) => s.key === source);
      if (!sourceConfig) {
        setError("未找到对应的视频源");
        setLoading(false);
        return;
      }

      setLoading(true);
      setError(null);

      try {
        const detail = await getVideoDetail(id, source, sourceConfig.url);
        setVideoDetail(detail);
      } catch (err) {
        console.error("获取视频详情失败:", err);
        setError("获取视频详情失败，请稍后重试");
      } finally {
        setLoading(false);
      }
    }

    fetchVideoDetail();
    // 只在 id 或 source 改变时重新获取数据，不依赖 videoSources
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id, source]);

  // 获取弹幕数据
  useEffect(() => {
    async function loadDanmaku() {
      // 检查是否有视频详情和豆瓣ID
      if (!videoDetail || !videoDetail.douban_id) {
        console.log('没有豆瓣ID，无法获取弹幕');
        setDanmaku([]);
        return;
      }

      // 检查是否有启用的弹幕源
      const enabledSources = danmakuSources.filter(s => s.enabled);
      if (enabledSources.length === 0) {
        console.log('没有启用的弹幕源');
        setDanmaku([]);
        return;
      }

      try {
        // 判断是否是电影（只有1集）
        const isMovie = videoDetail.episodes?.length === 1;

        // 获取当前剧集标题
        const currentEpisodeTitle =
          videoDetail.episodes_titles?.[currentEpisodeIndex] ||
          `第${currentEpisodeIndex + 1}集`;

        // 从标题中提取集数
        let episodeNumber = extractEpisodeNumberFromTitle(
          currentEpisodeTitle,
          isMovie
        );

        // 如果提取失败，回退到使用索引
        if (episodeNumber === null) {
          episodeNumber = currentEpisodeIndex + 1;
          console.warn(
            `无法从标题 "${currentEpisodeTitle}" 中提取集数，使用索引 ${episodeNumber}`
          );
        }

        console.log(
          `获取弹幕: 豆瓣ID=${videoDetail.douban_id}, 标题="${currentEpisodeTitle}", 集数=${episodeNumber}${isMovie ? ' (电影)' : ''}`
        );

        const danmakuData = await fetchDanmakuFromSources(
          danmakuSources,
          videoDetail.douban_id,
          episodeNumber
        );

        setDanmaku(danmakuData);
        console.log(`弹幕加载完成，共 ${danmakuData.length} 条`);
      } catch (error) {
        console.error('获取弹幕失败:', error);
        setDanmaku([]);
      }
    }

    loadDanmaku();
  }, [videoDetail, currentEpisodeIndex, danmakuSources]);

  // 切换剧集
  const handleEpisodeClick = (index) => {
    setCurrentEpisodeIndex(index);
  };

  // 处理全局快捷键
  const handleKeyboardShortcuts = useCallback(
    (e) => {
      // 忽略输入框中的按键事件
      if (
        e.target.tagName === "INPUT" ||
        e.target.tagName === "TEXTAREA"
      )
        return;

      // Alt + 左箭头 = 上一集
      if (e.altKey && e.key === "ArrowLeft") {
        if (videoDetail && currentEpisodeIndex > 0) {
          setCurrentEpisodeIndex(currentEpisodeIndex - 1);
          e.preventDefault();
        }
      }

      // Alt + 右箭头 = 下一集
      if (e.altKey && e.key === "ArrowRight") {
        if (
          videoDetail &&
          videoDetail.episodes &&
          currentEpisodeIndex < videoDetail.episodes.length - 1
        ) {
          setCurrentEpisodeIndex(currentEpisodeIndex + 1);
          e.preventDefault();
        }
      }

      // 左箭头 = 快退
      if (!e.altKey && e.key === "ArrowLeft") {
        if (playerRef.current && playerRef.current.currentTime > 5) {
          playerRef.current.currentTime -= 10;
          e.preventDefault();
        }
      }

      // 右箭头 = 快进
      if (!e.altKey && e.key === "ArrowRight") {
        if (
          playerRef.current &&
          playerRef.current.currentTime < playerRef.current.duration - 5
        ) {
          playerRef.current.currentTime += 10;
          e.preventDefault();
        }
      }

      // 上箭头 = 音量+
      if (e.key === "ArrowUp") {
        if (playerRef.current && playerRef.current.volume < 1) {
          playerRef.current.volume =
            Math.round((playerRef.current.volume + 0.1) * 10) / 10;
          playerRef.current.notice.show = `音量: ${Math.round(
            playerRef.current.volume * 100
          )}`;
          e.preventDefault();
        }
      }

      // 下箭头 = 音量-
      if (e.key === "ArrowDown") {
        if (playerRef.current && playerRef.current.volume > 0) {
          playerRef.current.volume =
            Math.round((playerRef.current.volume - 0.1) * 10) / 10;
          playerRef.current.notice.show = `音量: ${Math.round(
            playerRef.current.volume * 100
          )}`;
          e.preventDefault();
        }
      }

      // 空格 = 播放/暂停
      if (e.key === " ") {
        if (playerRef.current) {
          playerRef.current.toggle();
          e.preventDefault();
        }
      }

      // f 键 = 切换全屏
      if (e.key === "f" || e.key === "F") {
        if (playerRef.current) {
          playerRef.current.fullscreen = !playerRef.current.fullscreen;
          e.preventDefault();
        }
      }
    },
    [videoDetail, currentEpisodeIndex]
  );

  // 监听键盘事件
  useEffect(() => {
    document.addEventListener("keydown", handleKeyboardShortcuts);
    return () => {
      document.removeEventListener("keydown", handleKeyboardShortcuts);
    };
  }, [handleKeyboardShortcuts]);

  // 保存播放进度函数
  const savePlayProgress = useCallback(() => {
    if (!playerRef.current || !videoDetail || !id || !source) return;

    const currentTime = playerRef.current.currentTime || 0;
    const duration = playerRef.current.duration || 0;

    // 如果播放时间太短或者视频时长无效，不保存
    if (currentTime < 1 || !duration) return;

    try {
      addPlayRecord({
        source,
        id,
        title: videoDetail.title,
        poster: videoDetail.poster,
        year: videoDetail.year,
        currentEpisodeIndex,
        totalEpisodes: videoDetail.episodes?.length || 1,
        currentTime,
        duration,
      });
      console.log("播放进度已保存:", {
        title: videoDetail.title,
        episode: currentEpisodeIndex + 1,
        progress: `${Math.floor(currentTime)}/${Math.floor(duration)}`,
      });
    } catch (err) {
      console.error("保存播放进度失败:", err);
    }
  }, [playerRef, videoDetail, id, source, currentEpisodeIndex, addPlayRecord]);

  // 恢复播放进度
  useEffect(() => {
    if (!videoDetail || !id || !source) return;

    const playRecord = getPlayRecord(source, id);
    if (playRecord && playRecord.currentEpisodeIndex === currentEpisodeIndex) {
      // 如果有播放记录且集数匹配，保存到引用中，在播放器准备好后恢复
      const targetTime = playRecord.currentTime;
      if (targetTime > 5 && playerRef.current) {
        // 延迟执行，确保播放器已经加载好视频
        const timer = setTimeout(() => {
          if (playerRef.current && playerRef.current.duration > 0) {
            playerRef.current.currentTime = targetTime;
            playerRef.current.notice.show = `已恢复到 ${Math.floor(targetTime / 60)}:${String(
              Math.floor(targetTime % 60)
            ).padStart(2, "0")}`;
            console.log("已恢复播放进度:", targetTime);
          }
        }, 1000);
        return () => clearTimeout(timer);
      }
    }
  }, [videoDetail, id, source, currentEpisodeIndex, getPlayRecord, playerRef]);

  // 定期保存播放进度
  useEffect(() => {
    if (!playerRef.current) return;

    // 监听时间更新事件，每5秒保存一次
    const handleTimeUpdate = () => {
      const now = Date.now();
      if (now - lastSaveTimeRef.current > 5000) {
        savePlayProgress();
        lastSaveTimeRef.current = now;
      }
    };

    // 监听暂停事件，立即保存
    const handlePause = () => {
      savePlayProgress();
    };

    // 添加事件监听
    const art = playerRef.current;
    art.on("video:timeupdate", handleTimeUpdate);
    art.on("pause", handlePause);

    return () => {
      // 清理事件监听
      if (art && art.on) {
        art.off("video:timeupdate", handleTimeUpdate);
        art.off("pause", handlePause);
      }
      // 组件卸载时保存进度
      savePlayProgress();
    };
  }, [savePlayProgress]);

  // 页面卸载前保存播放进度
  useEffect(() => {
    const handleBeforeUnload = () => {
      savePlayProgress();
    };

    window.addEventListener("beforeunload", handleBeforeUnload);
    return () => {
      window.removeEventListener("beforeunload", handleBeforeUnload);
      savePlayProgress();
    };
  }, [savePlayProgress]);

  // 计算当前剧集信息（放在条件返回之前以保证 Hooks 顺序一致）
  const currentEpisodeUrl = videoDetail?.episodes?.[currentEpisodeIndex] || "";
  const currentEpisodeTitle =
    videoDetail?.episodes_titles?.[currentEpisodeIndex] ||
    `第 ${currentEpisodeIndex + 1} 集`;

  // 使用 useMemo 记忆 playerOption，避免不相关状态变化导致播放器重新渲染
  const playerOption = useMemo(
    () => ({
      url: currentEpisodeUrl,
      poster: videoDetail?.backdrop || videoDetail?.poster || "",
      theme: "#FAC638",
      lang: "zh-cn",
      title: videoDetail ? `${videoDetail.title} - ${currentEpisodeTitle}` : "",
      autoplay: true,
    }),
    [
      currentEpisodeUrl,
      videoDetail?.backdrop,
      videoDetail?.poster,
      videoDetail?.title,
      currentEpisodeTitle,
    ]
  );

  if (loading) {
    return (
      <div className="w-full max-w-7xl pt-4 flex items-center justify-center min-h-screen">
        <div className="flex flex-col items-center gap-4">
          <div className="animate-spin rounded-full h-16 w-16 border-4 border-primary border-t-transparent"></div>
          <p className="text-gray-500">加载中...</p>
        </div>
      </div>
    );
  }

  if (error || !videoDetail) {
    return (
      <div className="w-full max-w-7xl pt-4 flex items-center justify-center min-h-screen">
        <div className="flex flex-col items-center gap-4">
          <span className="material-symbols-outlined text-6xl text-gray-300">
            error
          </span>
          <p className="text-gray-500">{error || "未找到视频"}</p>
          <Link href="/" className="text-primary hover:underline">
            返回首页
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="w-full max-w-7xl pt-4">
      <nav aria-label="Breadcrumb" className="flex mb-6 text-sm text-gray-500">
        <ol className="inline-flex items-center space-x-1 md:space-x-3">
          <li className="inline-flex items-center">
            <Link
              href="/"
              className="inline-flex items-center hover:text-primary transition-colors"
            >
              <span className="material-symbols-outlined text-lg mr-1">
                home
              </span>
              首页
            </Link>
          </li>
          <li>
            <div className="flex items-center">
              <span className="material-symbols-outlined text-gray-400">
                chevron_right
              </span>
              <span className="ml-1 md:ml-2 hover:text-primary transition-colors cursor-pointer">
                {videoDetail.type === "movie" ? "电影" : "电视剧"}
              </span>
            </div>
          </li>
          <li>
            <div className="flex items-center">
              <span className="material-symbols-outlined text-gray-400">
                chevron_right
              </span>
              <span className="ml-1 md:ml-2 text-gray-900 font-medium">
                {videoDetail.title}
              </span>
            </div>
          </li>
        </ol>
      </nav>

      <div className={`grid grid-cols-1 gap-8 transition-all duration-300 lg:grid-cols-12`}>
        {/* Left Column: Player and Info */}
        <div className={`flex flex-col gap-8 transition-all duration-300 lg:col-span-8`}>
          <div className="relative w-full aspect-video bg-black rounded-xl overflow-hidden shadow-2xl group ring-1 ring-gray-900/5">
            {currentEpisodeUrl ? (
              <Player
                option={playerOption}
                style={{
                  width: "100%",
                  height: "100%",
                }}
                className="w-full h-full"
                danmaku={danmaku}
                getInstance={handleGetInstance}
              />
            ) : (
              <div className="w-full h-full flex items-center justify-center text-white">
                <span>暂无播放源</span>
              </div>
            )}
          </div>

          <div className="flex flex-col md:flex-row gap-8 bg-white p-6 rounded-2xl border border-gray-100 shadow-sm">
            <div className="w-full md:w-48 shrink-0 mx-auto md:mx-0">
              <div className="aspect-2/3 rounded-xl overflow-hidden shadow-lg ring-1 ring-gray-900/5 relative group">
                <img
                  alt={`${videoDetail.title} Poster`}
                  className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
                  src={videoDetail.poster}
                />
              </div>
            </div>
            <div className="flex-1 space-y-5">
              <div>
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-2">
                  <h1 className="text-3xl font-bold text-gray-900">
                    {videoDetail.title}
                  </h1>
                  <div className="flex items-center gap-3">
                    <div className="flex items-center text-primary h-10">
                      <span className="material-symbols-outlined material-symbols-filled text-xl">
                        star
                      </span>
                      <span className="text-lg font-bold ml-1 leading-none">
                        {videoDetail.rating}
                      </span>
                      <span className="text-gray-400 text-sm font-normal ml-1 leading-none self-end pb-1">
                        / 10
                      </span>
                    </div>
                    <FavoriteButton
                      source={source}
                      id={id}
                      videoDetail={videoDetail}
                    />
                    <button className="flex items-center justify-center h-10 w-10 rounded-full hover:bg-gray-100 text-gray-400 hover:text-blue-500 transition-colors">
                      <span className="material-symbols-outlined">share</span>
                    </button>
                  </div>
                </div>
                <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-sm text-gray-600 mb-4">
                  <span className="bg-gray-100 px-2 py-1 rounded text-xs font-semibold text-gray-700">
                    {videoDetail.year}
                  </span>
                  <span className="w-1 h-1 bg-gray-300 rounded-full"></span>
                  <span>{videoDetail.genre}</span>
                  {videoDetail.class && (
                    <>
                      <span className="w-1 h-1 bg-gray-300 rounded-full"></span>
                      <span>{videoDetail.type_name}</span>
                    </>
                  )}
                  {videoDetail.episodes.length > 1 && (
                    <>
                      <span className="w-1 h-1 bg-gray-300 rounded-full"></span>
                      <span>全 {videoDetail.episodes.length} 集</span>
                    </>
                  )}
                  <span className="w-1 h-1 bg-gray-300 rounded-full"></span>
                  <span className="text-primary text-xs bg-primary/10 px-2 py-1 rounded">
                    {videoDetail.source_name || source}
                  </span>
                </div>
              </div>
              {videoDetail.desc && (
                <div className="prose prose-sm max-w-none text-gray-600">
                  <h3 className="text-gray-900 font-semibold mb-1">剧情简介</h3>
                  <p className="leading-relaxed">{videoDetail.desc}</p>
                </div>
              )}
              {videoDetail.actors && videoDetail.actors.length > 0 && (
                <div>
                  <h3 className="text-gray-900 font-semibold mb-3">演员表</h3>
                  <div className="flex gap-4 overflow-x-auto pb-2 hide-scrollbar">
                    {videoDetail.actors.map((actor, idx) => (
                      <div
                        key={idx}
                        className="flex flex-col items-center gap-2 min-w-[70px]"
                      >
                        <div className="size-16 rounded-full overflow-hidden border border-gray-200 shadow-sm bg-gray-100 flex items-center justify-center">
                          <span className="material-symbols-outlined text-gray-400 text-2xl">
                            person
                          </span>
                        </div>
                        <span className="text-xs font-medium text-gray-900 text-center truncate w-full">
                          {actor.name}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Right Column: Episodes */}
        <div className={`space-y-6 transition-all duration-300 lg:col-span-4`}>
          <EpisodeList
            episodes={videoDetail.episodes}
            episodesTitles={videoDetail.episodes_titles}
            currentEpisodeIndex={currentEpisodeIndex}
            onEpisodeClick={handleEpisodeClick}
          />
        </div>
      </div>
    </div>
  );
}
