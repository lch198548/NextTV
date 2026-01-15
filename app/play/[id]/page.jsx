"use client";

import { useState, useEffect, useEffectEvent, useRef, Suspense, use } from "react";
import { useParams, useSearchParams } from "next/navigation";
import Link from "next/link";
import Artplayer from "artplayer";
import Hls from "hls.js";
import artplayerPluginDanmuku from "artplayer-plugin-danmuku";
import artplayerPluginLiquidGlass from "@/lib/artplayer-plugin-liquid-glass";
import { FavoriteButton } from "@/components/FavoriteButton";
import { EpisodeList } from "@/components/EpisodeList";
import { useSettingsStore } from "@/store/useSettingsStore";
import { usePlayHistoryStore } from "@/store/usePlayHistoryStore";
import { formatTime } from "@/lib/util";
import { filterAdsFromM3U8 } from "@/lib/util";
import { getInitialDataPromise, fetchDanmakuForEpisode } from "@/lib/paralleLoadingData";
// ============================================================================
// 主组件
// ============================================================================

export default function PlayerPage() {
  const params = useParams();
  const searchParams = useSearchParams();
  const id = params.id;
  const source = searchParams.get("source");
  // -------------------------------------------------------------------------
  // Store
  // -------------------------------------------------------------------------
  const addPlayRecord = usePlayHistoryStore((state) => state.addPlayRecord);
  const getPlayRecord = usePlayHistoryStore((state) => state.getPlayRecord);
  const danmakuSources = useSettingsStore((state) => state.danmakuSources);
  const blockAdEnabled = useSettingsStore((state) => state.blockAdEnabled);
  const setBlockAdEnabled = useSettingsStore((state) => state.setBlockAdEnabled);
  const skipConfig = useSettingsStore((state) => state.skipConfig);
  const setSkipConfig = useSettingsStore((state) => state.setSkipConfig);
  const videoSources = useSettingsStore((state) => state.videoSources);
  const playHistory = usePlayHistoryStore((state) => state.playHistory);
  // 获取或创建初始数据 Promise
  const dataPromise = getInitialDataPromise(id, source, videoSources, danmakuSources, playHistory);

  // 使用 React 19 的 use hook 消费 Promise

  const { videoDetail, initialDanmaku, doubanActors, initialEpisodeIndex, initialTime } = use(dataPromise);

  // -------------------------------------------------------------------------
  // 状态
  // -------------------------------------------------------------------------
  const [currentEpisodeIndex, setCurrentEpisodeIndex] = useState(initialEpisodeIndex);

  // -------------------------------------------------------------------------
  // 播放器相关的 Refs（只保留必要的）
  // -------------------------------------------------------------------------
  const artRef = useRef(null); // 播放器容器 DOM
  const artPlayerRef = useRef(null); // Artplayer 实例

  // 时间控制
  const lastSkipCheckRef = useRef(0);
  const lastSaveTimeRef = useRef(0);

  // ============================================================================
  // 普通非响应式函数
  // ============================================================================
  // 更新弹幕到播放器
  const updateDanmakuPlugin = (newDanmaku) => {
    if (!artPlayerRef.current.plugins.artplayerPluginDanmuku || !artPlayerRef.current) return;

    if (newDanmaku.length === 0) {
      console.log("清空弹幕");
      if (typeof artPlayerRef.current.plugins.artplayerPluginDanmuku.reset === "function") {
        artPlayerRef.current.plugins.artplayerPluginDanmuku.reset();
      }
      return;
    }

    if (typeof artPlayerRef.current.plugins.artplayerPluginDanmuku.load === "function") {
      console.log("重新加载弹幕，共", newDanmaku.length, "条");

      artPlayerRef.current.plugins.artplayerPluginDanmuku.reset();
      artPlayerRef.current.plugins.artplayerPluginDanmuku.config({
        danmuku: newDanmaku,
      });
      artPlayerRef.current.plugins.artplayerPluginDanmuku.load();

      if (artPlayerRef.current && artPlayerRef.current.notice) {
        artPlayerRef.current.notice.show = `已加载 ${newDanmaku.length} 条弹幕`;
      }
    } else {
      console.warn("弹幕插件不支持 load 方法，无法动态更新弹幕");
    }
  };

  // ============================================================================
  // 普通版本的响应式函数
  // ============================================================================
  // 保存播放进度（普通响应式）
  const savePlayProgress = () => {
    if (!artPlayerRef.current || !videoDetail || !id || !source) return;

    const currentTime = artPlayerRef.current.currentTime || 0;
    const duration = artPlayerRef.current.duration || 0;

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
  };
  // 切换到指定集数（普通函数，可以在任何地方调用）
  const switchToEpisode = async (newIndex) => {
    if (!videoDetail || !artPlayerRef.current) return;

    const newUrl = videoDetail.episodes?.[newIndex];
    const newTitle = videoDetail.episodes_titles?.[newIndex] || `第 ${newIndex + 1} 集`;

    if (!newUrl) {
      console.error("无效的集数索引:", newIndex);
      return;
    }

    console.log("切换到集数:", newIndex + 1);

    // 1. 保存当前进度
    savePlayProgress();

    // 2. 更新集数索引
    setCurrentEpisodeIndex(newIndex);

    // 3. 检查 store 中是否有该集的播放记录
    const playRecord = getPlayRecord(source, id);
    let resumeTime = 0;
    if (playRecord && playRecord.currentEpisodeIndex === newIndex) {
      resumeTime = playRecord.currentTime > 5 ? playRecord.currentTime : 0;
      console.log(`找到第${newIndex + 1}集的播放记录，将恢复到 ${Math.floor(resumeTime)} 秒`);
    }

    // 4. 切换播放器 URL
    artPlayerRef.current.switch = newUrl;
    artPlayerRef.current.title = `${videoDetail.title} - ${newTitle}`;
    artPlayerRef.current.poster = videoDetail?.backdrop || videoDetail?.poster || "";
    // 4.1 清空弹幕
    artPlayerRef.current.plugins.artplayerPluginDanmuku.reset();
    artPlayerRef.current.plugins.artplayerPluginDanmuku.config({
      danmuku: [],
    });
    artPlayerRef.current.plugins.artplayerPluginDanmuku.load();
    console.log("清空弹幕");
    // 5. 恢复播放进度（如果有）
    if (resumeTime > 0) {
      // 使用 once 监听，确保只执行一次
      artPlayerRef.current.once("video:canplay", () => {
        try {
          const duration = artPlayerRef.current.duration || 0;
          let target = resumeTime;
          if (duration && target >= duration - 2) {
            target = Math.max(0, duration - 5);
          }
          artPlayerRef.current.currentTime = target;
          artPlayerRef.current.notice.show = `已恢复到 ${Math.floor(target / 60)}:${String(Math.floor(target % 60)).padStart(2, "0")}`;
          console.log("成功恢复播放进度到:", target);
        } catch (err) {
          console.warn("恢复播放进度失败:", err);
        }
      });
    }

    // 6. 异步加载新弹幕并更新
    try {
      const newDanmaku = await fetchDanmakuForEpisode(videoDetail, newIndex, danmakuSources);
      updateDanmakuPlugin(newDanmaku);
    } catch (error) {
      console.error("加载弹幕失败:", error);
      updateDanmakuPlugin([]);
    }
  };
  // -------------------------------------------------------------------------
  // useEffectEvent 创建只能在 useEffect 中调用的稳定函数
  // -------------------------------------------------------------------------
  // 保存播放进度 - 只在 useEffect 中调用
  const savePlayProgressEvent = useEffectEvent(savePlayProgress);

  // 定期保存进度 - 只在 useEffect 的 timeupdate 中调用
  // 先本地更新进度，再保存到store
  const handleTimeupdateSaveEvent = useEffectEvent(() => {
    const now = Date.now();
    if (now - lastSaveTimeRef.current > 5000) {
      savePlayProgress();
      lastSaveTimeRef.current = now;
    }
  });
  // 处理跳过片头片尾逻辑
  const handleSkipEvent = useEffectEvent(() => {
    if (!skipConfig.enable || !artPlayerRef.current) return;

    const currentTime = artPlayerRef.current.currentTime || 0;
    const duration = artPlayerRef.current.duration || 0;
    const now = Date.now();

    // 限制检查频率
    if (now - lastSkipCheckRef.current < 1500) return;
    lastSkipCheckRef.current = now;

    // 跳过片头
    if (skipConfig.intro_time > 0 && currentTime < skipConfig.intro_time) {
      artPlayerRef.current.currentTime = skipConfig.intro_time;
      artPlayerRef.current.notice.show = `已跳过片头 (${formatTime(skipConfig.intro_time)})`;
    }

    // 跳过片尾
    if (skipConfig.outro_time < 0 && duration > 0 && currentTime > duration + skipConfig.outro_time) {
      artPlayerRef.current.notice.show = `已跳过片尾 (${formatTime(-skipConfig.outro_time)})`;
      // 触发下一集或暂停
      if (videoDetail && videoDetail.episodes && currentEpisodeIndex < videoDetail.episodes.length - 1) {
        switchToEpisode(currentEpisodeIndex + 1);
      } else {
        artPlayerRef.current.pause();
      }
    }
  });

  // 键盘快捷键处理
  const handleKeyboardShortcutsEvent = useEffectEvent((e) => {
    if (e.target.tagName === "INPUT" || e.target.tagName === "TEXTAREA") return;

    // Alt + 左箭头 = 上一集
    if (e.altKey && e.key === "ArrowLeft") {
      if (currentEpisodeIndex > 0) {
        switchToEpisode(currentEpisodeIndex - 1);
        e.preventDefault();
      }
    }

    // Alt + 右箭头 = 下一集
    if (e.altKey && e.key === "ArrowRight") {
      if (videoDetail && videoDetail.episodes && currentEpisodeIndex < videoDetail.episodes.length - 1) {
        switchToEpisode(currentEpisodeIndex + 1);
        e.preventDefault();
      }
    }

    // 左箭头 = 快退
    if (!e.altKey && e.key === "ArrowLeft") {
      if (artPlayerRef.current && artPlayerRef.current.currentTime > 5) {
        artPlayerRef.current.currentTime -= 10;
        e.preventDefault();
      }
    }

    // 右箭头 = 快进
    if (!e.altKey && e.key === "ArrowRight") {
      if (artPlayerRef.current && artPlayerRef.current.currentTime < artPlayerRef.current.duration - 5) {
        artPlayerRef.current.currentTime += 10;
        e.preventDefault();
      }
    }

    // 上箭头 = 音量+
    if (e.key === "ArrowUp") {
      if (artPlayerRef.current && artPlayerRef.current.volume < 1) {
        artPlayerRef.current.volume = Math.round((artPlayerRef.current.volume + 0.1) * 10) / 10;
        artPlayerRef.current.notice.show = `音量: ${Math.round(artPlayerRef.current.volume * 100)}`;
        e.preventDefault();
      }
    }

    // 下箭头 = 音量-
    if (e.key === "ArrowDown") {
      if (artPlayerRef.current && artPlayerRef.current.volume > 0) {
        artPlayerRef.current.volume = Math.round((artPlayerRef.current.volume - 0.1) * 10) / 10;
        artPlayerRef.current.notice.show = `音量: ${Math.round(artPlayerRef.current.volume * 100)}`;
        e.preventDefault();
      }
    }

    // 空格 = 播放/暂停
    if (e.key === " ") {
      if (artPlayerRef.current) {
        artPlayerRef.current.toggle();
        e.preventDefault();
      }
    }

    // f 键 = 切换全屏
    if (e.key === "f" || e.key === "F") {
      if (artPlayerRef.current) {
        artPlayerRef.current.fullscreen = !artPlayerRef.current.fullscreen;
        e.preventDefault();
      }
    }
  });
  const handleControlNextButtonEvent = useEffectEvent(() => {
    if (videoDetail && videoDetail.episodes && currentEpisodeIndex < videoDetail.episodes.length - 1) {
      savePlayProgress();
      switchToEpisode(currentEpisodeIndex + 1);
    }
  });
  const handleAutoNextEpisodeEvent = useEffectEvent(() => {
    if (videoDetail && videoDetail.episodes && currentEpisodeIndex < videoDetail.episodes.length - 1) {
      savePlayProgressEvent();
      setTimeout(() => {
        switchToEpisode(currentEpisodeIndex + 1);
      }, 1000);
    }
  });
  // -------------------------------------------------------------------------
  // 播放器初始化（只执行一次，使用初始数据）
  // -------------------------------------------------------------------------
  useEffect(() => {
    if (!artRef.current || artPlayerRef.current) {
      return;
    }

    // 自定义 HLS Loader（去广告）
    class CustomHlsJsLoader extends Hls.DefaultConfig.loader {
      constructor(config) {
        super(config);
        const load = this.load.bind(this);
        this.load = function (context, config, callbacks) {
          if (context.type === "manifest" || context.type === "level") {
            const onSuccess = callbacks.onSuccess;
            callbacks.onSuccess = function (response, stats, context) {
              if (response.data && typeof response.data === "string") {
                response.data = filterAdsFromM3U8(response.data);
              }
              return onSuccess(response, stats, context, null);
            };
          }
          load(context, config, callbacks);
        };
      }
    }

    try {
      console.log("初始化播放器:", {
        episode: initialEpisodeIndex + 1,
        time: initialTime,
        danmakuCount: initialDanmaku.length,
      });

      const currentUrl = videoDetail?.episodes?.[initialEpisodeIndex] || "";
      const currentTitle = videoDetail?.episodes_titles?.[initialEpisodeIndex] || `第${initialEpisodeIndex + 1}集`;

      artPlayerRef.current = new Artplayer({
        container: artRef.current,
        url: currentUrl,
        title: `${videoDetail.title} - ${currentTitle}`,
        poster: videoDetail?.backdrop || videoDetail?.poster || "",
        volume: 0.7, // 默认音量
        isLive: false,
        muted: false,
        autoplay: true,
        pip: true,
        autoSize: false,
        autoMini: false,
        screenshot: false,
        setting: true,
        loop: false,
        flip: false,
        playbackRate: true,
        aspectRatio: false,
        fullscreen: true,
        fullscreenWeb: true,
        subtitleOffset: false,
        miniProgressBar: false,
        mutex: true,
        playsInline: true,
        autoPlayback: false,
        airplay: true,
        theme: "#FAC638",
        lang: "zh-cn",
        hotkey: false,
        fastForward: true,
        autoOrientation: true,
        lock: true,
        moreVideoAttr: {
          crossOrigin: "anonymous",
        },

        // 弹幕插件
        plugins: [
          artplayerPluginDanmuku({
            danmuku: initialDanmaku,
            speed: 7.5,
            opacity: 1,
            fontSize: 23,
            emitter: false,
            color: "#FFFFFF",
            mode: 0,
            margin: [10, "25%"],
            antiOverlap: true,
            useWorker: true,
            synchronousPlayback: true,
            filter: (danmu) => danmu.text.length <= 50,
            lockTime: 5,
            maxLength: 100,
            minWidth: 200,
            maxWidth: 400,
            theme: "dark",
          }),
          artplayerPluginLiquidGlass(),
        ],

        // HLS 支持配置
        customType: {
          m3u8: function (video, url) {
            if (video.canPlayType("application/vnd.apple.mpegurl") || video.canPlayType("application/x-mpegurl")) {
              console.log("使用原生 HLS 播放");
              video.src = url;
              return;
            }

            if (!Hls || !Hls.isSupported()) {
              console.warn("HLS.js 不支持，尝试原生播放");
              video.src = url;
              return;
            }

            console.log("使用 HLS.js 播放");

            if (video.hls) {
              video.hls.destroy();
            }

            const hls = new Hls({
              debug: false,
              enableWorker: true,
              lowLatencyMode: true,
              maxBufferLength: 30,
              backBufferLength: 30,
              maxBufferSize: 60 * 1000 * 1000,
              loader: blockAdEnabled ? CustomHlsJsLoader : Hls.DefaultConfig.loader,
            });

            hls.loadSource(url);
            hls.attachMedia(video);
            video.hls = hls;

            hls.on(Hls.Events.ERROR, function (event, data) {
              if (data.fatal) {
                console.error("HLS 致命错误:", data.type, data.details);
                switch (data.type) {
                  case Hls.ErrorTypes.NETWORK_ERROR:
                    console.log("网络错误，尝试恢复...");
                    hls.startLoad();
                    break;
                  case Hls.ErrorTypes.MEDIA_ERROR:
                    console.log("媒体错误，尝试恢复...");
                    hls.recoverMediaError();
                    break;
                  default:
                    console.log("无法恢复的错误，回退到原生播放");
                    hls.destroy();
                    video.src = url;
                    break;
                }
              } else {
                console.warn("HLS 非致命错误:", data.details);
              }
            });
          },
        },

        // 设置面板配置
        settings: [
          {
            html: "去广告",
            icon: '<svg width="22" height="22" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><text x="50%" y="50%" font-size="14" font-weight="bold" text-anchor="middle" dominant-baseline="middle" fill="currentColor">AD</text></svg>',
            tooltip: blockAdEnabled ? "已开启" : "已关闭",
            switch: blockAdEnabled,
            onSwitch: function (item) {
              const newVal = !item.switch;
              setBlockAdEnabled(newVal);
              if (artPlayerRef.current) {
                artPlayerRef.current.notice.show = newVal ? "去广告已开启，刷新生效" : "去广告已关闭，刷新生效";
              }
              return newVal;
            },
          },
          {
            html: "跳过片头片尾",
            tooltip: skipConfig.enable ? "已开启" : "已关闭",
            switch: skipConfig.enable,
            onSwitch: function (item) {
              const newConfig = {
                ...skipConfig,
                enable: !item.switch,
              };
              setSkipConfig(newConfig);
              if (artPlayerRef.current) {
                artPlayerRef.current.notice.show = newConfig.enable ? "跳过片头片尾已开启" : "跳过片头片尾已关闭";
              }
              return !item.switch;
            },
          },
          {
            html: "设置片头",
            icon: '<svg width="22" height="22" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><circle cx="6" cy="12" r="2" fill="currentColor"/><path d="M10 12L17 12" stroke="currentColor" stroke-width="2"/><path d="M17 7L17 17" stroke="currentColor" stroke-width="2"/></svg>',
            tooltip: skipConfig.intro_time === 0 ? "点击设置片头时间" : `片头：${formatTime(skipConfig.intro_time)}`,
            onClick: function () {
              if (artPlayerRef.current) {
                const currentTime = artPlayerRef.current.currentTime || 0;
                if (currentTime > 0) {
                  const newConfig = {
                    ...skipConfig,
                    intro_time: currentTime,
                  };
                  setSkipConfig(newConfig);
                  artPlayerRef.current.notice.show = `片头已设置：${formatTime(currentTime)}`;
                  return `片头：${formatTime(currentTime)}`;
                }
              }
            },
          },
          {
            html: "设置片尾",
            icon: '<svg width="22" height="22" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M7 7L7 17" stroke="currentColor" stroke-width="2"/><path d="M7 12L14 12" stroke="currentColor" stroke-width="2"/><circle cx="18" cy="12" r="2" fill="currentColor"/></svg>',
            tooltip: skipConfig.outro_time >= 0 ? "点击设置片尾时间" : `片尾：${formatTime(-skipConfig.outro_time)}`,
            onClick: function () {
              if (artPlayerRef.current) {
                const outroTime = -(artPlayerRef.current.duration - artPlayerRef.current.currentTime) || 0;
                if (outroTime < 0) {
                  const newConfig = {
                    ...skipConfig,
                    outro_time: outroTime,
                  };
                  setSkipConfig(newConfig);
                  artPlayerRef.current.notice.show = `片尾已设置：${formatTime(-outroTime)}`;
                  return `片尾：${formatTime(-outroTime)}`;
                }
              }
            },
          },
          {
            html: "清除跳过配置",
            icon: '<svg width="22" height="22" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M6 18L18 6M6 6l12 12" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>',
            onClick: function () {
              const newConfig = { enable: false, intro_time: 0, outro_time: 0 };
              setSkipConfig(newConfig);
              if (artPlayerRef.current) {
                artPlayerRef.current.notice.show = "跳过配置已清除";
              }
              return "已清除";
            },
          },
        ],

        // 控制栏：下一集按钮
        controls: [
          {
            position: "right",
            index: 10,
            html: '<button class="art-icon art-icon-next" style="display: flex; align-items: center; justify-content: center; cursor: pointer;"><svg width="22" height="22" viewBox="0 0 24 24" fill="currentColor"><path d="M6 18l8.5-6L6 6v12zM16 6v12h2V6h-2z"/></svg></button>',
            tooltip: "下一集",
            click: handleControlNextButtonEvent,
          },
        ],
      });

      // -----------------------------------------------------------------------
      // 播放器事件监听（使用 useEffectEvent 中的函数）
      // -----------------------------------------------------------------------

      // 播放器就绪
      artPlayerRef.current.on("ready", () => {
        console.log("播放器就绪");
      });

      // 视频可播放时恢复初始进度（仅首次）
      artPlayerRef.current.once("video:canplay", () => {
        if (initialTime > 0) {
          try {
            const duration = artPlayerRef.current.duration || 0;
            let target = initialTime;
            if (duration && target >= duration - 2) {
              target = Math.max(0, duration - 5);
            }
            artPlayerRef.current.currentTime = target;
            artPlayerRef.current.notice.show = `已恢复到 ${Math.floor(target / 60)}:${String(Math.floor(target % 60)).padStart(2, "0")}`;
            console.log("成功恢复播放进度到:", target);
          } catch (err) {
            console.warn("恢复播放进度失败:", err);
          }
        }
      });

      // 时间更新：跳过片头片尾 + 定期保存进度
      artPlayerRef.current.on("video:timeupdate", () => {
        handleSkipEvent();
        handleTimeupdateSaveEvent();
      });

      // 暂停时保存进度
      artPlayerRef.current.on("pause", () => {
        savePlayProgressEvent();
      });

      // 视频播放结束时自动播放下一集
      artPlayerRef.current.on("video:ended", handleAutoNextEpisodeEvent);

      artPlayerRef.current.on("error", (err) => {
        console.error("播放器错误:", err);
      });
    } catch (err) {
      console.error("创建播放器失败:", err);
    }

    // 组件卸载时清理
    return () => {
      if (artPlayerRef.current) {
        try {
          if (artPlayerRef.current.video && artPlayerRef.current.video.hls) {
            artPlayerRef.current.video.hls.destroy();
          }
          artPlayerRef.current.destroy();
          artPlayerRef.current = null;
          console.log("播放器资源已清理");
        } catch (err) {
          console.warn("清理播放器资源时出错:", err);
          artPlayerRef.current = null;
        }
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // 仅在挂载时执行一次

  // -------------------------------------------------------------------------
  // 键盘快捷键监听
  // -------------------------------------------------------------------------
  useEffect(() => {
    document.addEventListener("keydown", handleKeyboardShortcutsEvent);
    return () => {
      document.removeEventListener("keydown", handleKeyboardShortcutsEvent);
    };
  }, []);

  // -------------------------------------------------------------------------
  // 页面卸载前保存播放进度
  // -------------------------------------------------------------------------
  useEffect(() => {
    window.addEventListener("beforeunload", savePlayProgressEvent);
    return () => {
      window.removeEventListener("beforeunload", savePlayProgressEvent);
    };
  }, []); // useEffectEvent 无需依赖数组

  // -------------------------------------------------------------------------
  // 切换剧集（用户点击事件）
  // -------------------------------------------------------------------------
  const handleEpisodeClick = (index) => {
    switchToEpisode(index);
  };
  // 参数校验

  // -------------------------------------------------------------------------
  // 渲染
  // -------------------------------------------------------------------------
  if (!id || !source) {
    return (
      <div className="w-full max-w-7xl pt-4 flex items-center justify-center min-h-screen">
        <div className="flex flex-col items-center gap-4">
          <span className="material-symbols-outlined text-6xl text-gray-300">error</span>
          <p className="text-gray-500">缺少必要的参数</p>
          <Link href="/" className="text-primary hover:underline">
            返回首页
          </Link>
        </div>
      </div>
    );
  }
  return (
    <div className="w-full max-w-7xl pt-4 px-4">
      <nav aria-label="Breadcrumb" className="flex mb-6 text-sm text-gray-500 overflow-x-auto">
        <ol className="inline-flex items-center space-x-1 md:space-x-3 whitespace-nowrap">
          <li className="inline-flex items-center">
            <Link href="/" className="inline-flex items-center hover:text-primary transition-colors">
              <span className="material-symbols-outlined text-lg mr-1">home</span>
              首页
            </Link>
          </li>
          <li>
            <div className="flex items-center">
              <span className="material-symbols-outlined text-gray-400">chevron_right</span>
              <span className="ml-1 md:ml-2 hover:text-primary transition-colors cursor-pointer">{videoDetail.type === "movie" ? "电影" : "电视剧"}</span>
            </div>
          </li>
          <li>
            <div className="flex items-center">
              <span className="material-symbols-outlined text-gray-400">chevron_right</span>
              <span className="ml-1 md:ml-2 text-gray-900 font-medium truncate max-w-[200px]">{videoDetail.title}</span>
            </div>
          </li>
        </ol>
      </nav>

      <div className="grid grid-cols-1 gap-8 transition-all duration-300 lg:grid-cols-12">
        {/* Left Column: Player and Info */}
        <div className="flex flex-col gap-8 transition-all duration-300 lg:col-span-8">
          <div className="relative w-full aspect-video bg-black rounded-xl overflow-hidden shadow-2xl group ring-1 ring-gray-900/5">
            {videoDetail?.episodes?.[currentEpisodeIndex] ? (
              <div ref={artRef} className="w-full h-full" />
            ) : (
              <div className="w-full h-full flex items-center justify-center text-white">
                <span>暂无播放源</span>
              </div>
            )}
          </div>

          <div className="flex flex-col md:flex-row gap-8 bg-white p-4 md:p-6 rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
            <div className="hidden md:block w-48 shrink-0">
              <div className="aspect-2/3 rounded-xl overflow-hidden shadow-lg ring-1 ring-gray-900/5 relative group">
                <img alt={`${videoDetail.title} Poster`} className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105" src={videoDetail.poster} />
              </div>
            </div>
            <div className="flex-1 space-y-5 min-w-0">
              <div>
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-2">
                  <h1 className="text-2xl md:text-3xl font-bold text-gray-900 wrap-break-words">{videoDetail.title}</h1>
                  <div className="flex items-center gap-3 shrink-0">
                    <div className="flex items-center text-primary h-10">
                      <span className="material-symbols-outlined material-symbols-filled text-xl">star</span>
                      <span className="text-lg font-bold ml-1 leading-none">{videoDetail.rating}</span>
                      <span className="text-gray-400 text-sm font-normal ml-1 leading-none self-end pb-1">/ 10</span>
                    </div>
                    <FavoriteButton source={source} id={id} videoDetail={videoDetail} />
                    <button className="flex items-center justify-center h-10 w-10 rounded-full hover:bg-gray-100 text-gray-400 hover:text-blue-500 transition-colors">
                      <span className="material-symbols-outlined">share</span>
                    </button>
                  </div>
                </div>
                <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-sm text-gray-600 mb-4">
                  <span className="bg-gray-100 px-2 py-1 rounded text-xs font-semibold text-gray-700">{videoDetail.year}</span>
                  <span className="w-1 h-1 bg-gray-300 rounded-full"></span>
                  <span className="truncate">{videoDetail.genre}</span>
                  {videoDetail.class && (
                    <>
                      <span className="w-1 h-1 bg-gray-300 rounded-full"></span>
                      <span className="truncate">{videoDetail.type_name}</span>
                    </>
                  )}
                  {videoDetail.episodes.length > 1 && (
                    <>
                      <span className="w-1 h-1 bg-gray-300 rounded-full"></span>
                      <span>全 {videoDetail.episodes.length} 集</span>
                    </>
                  )}
                  <span className="w-1 h-1 bg-gray-300 rounded-full"></span>
                  <span className="text-primary text-xs bg-primary/10 px-2 py-1 rounded">{videoDetail.source || source}</span>
                </div>
              </div>
              {videoDetail.desc && (
                <div className="prose prose-sm max-w-none text-gray-600">
                  <h3 className="text-gray-900 font-semibold mb-1">剧情简介</h3>
                  <p className="leading-relaxed wrap-break-words">{videoDetail.desc}</p>
                </div>
              )}
              {(doubanActors.length > 0 || (videoDetail.actors && videoDetail.actors.length > 0)) && (
                <div>
                  <h3 className="text-gray-900 font-semibold mb-3">演员表</h3>
                  <div className="flex gap-4 overflow-x-auto pb-2 -mx-4 px-4 md:mx-0 md:px-0">
                    {(doubanActors.length > 0 ? doubanActors : videoDetail.actors).map((actor, idx) => (
                      <div key={actor.id || idx} className="flex flex-col items-center gap-2 min-w-[70px] shrink-0">
                        <div className="size-16 rounded-full overflow-hidden border border-gray-200 shadow-sm bg-gray-100 flex items-center justify-center">
                          {actor.avatar ? (
                            <img
                              src={actor.avatar}
                              alt={actor.name}
                              className="w-full h-full object-cover"
                              onError={(e) => {
                                e.target.style.display = "none";
                                e.target.nextSibling.style.display = "flex";
                              }}
                            />
                          ) : null}
                          <span className="material-symbols-outlined text-gray-400 text-2xl" style={{ display: actor.avatar ? "none" : "flex" }}>
                            person
                          </span>
                        </div>
                        <span className="text-xs font-medium text-gray-900 text-center truncate w-full">{actor.name}</span>
                        {actor.role && <span className="text-xs text-gray-500 text-center truncate w-full">{actor.role}</span>}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Right Column: Episodes */}
        <div className="space-y-6 transition-all duration-300 lg:col-span-4">
          <EpisodeList episodes={videoDetail.episodes} episodesTitles={videoDetail.episodes_titles} currentEpisodeIndex={currentEpisodeIndex} onEpisodeClick={handleEpisodeClick} />
        </div>
      </div>
    </div>
  );
}
