"use client";

import { useEffect, useRef, useCallback } from "react";
import Artplayer from "artplayer";
import Hls from "hls.js";
import artplayerPluginDanmuku from "artplayer-plugin-danmuku";

// 去广告功能：过滤 M3U8 中的广告片段
function filterAdsFromM3U8(m3u8Content) {
  if (!m3u8Content) return "";

  // 按行分割M3U8内容
  const lines = m3u8Content.split("\n");
  const filteredLines = [];

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    // 只过滤#EXT-X-DISCONTINUITY标识（通常用于广告分段）
    if (!line.includes("#EXT-X-DISCONTINUITY")) {
      filteredLines.push(line);
    }
  }

  return filteredLines.join("\n");
}

// 自定义 HLS Loader，用于去广告
class CustomHlsJsLoader extends Hls.DefaultConfig.loader {
  constructor(config) {
    super(config);
    const load = this.load.bind(this);
    this.load = function (context, config, callbacks) {
      // 拦截manifest和level请求
      if (context.type === "manifest" || context.type === "level") {
        const onSuccess = callbacks.onSuccess;
        callbacks.onSuccess = function (response, stats, context) {
          // 如果是m3u8文件，处理内容以移除广告分段
          if (response.data && typeof response.data === "string") {
            response.data = filterAdsFromM3U8(response.data);
          }
          return onSuccess(response, stats, context, null);
        };
      }
      // 执行原始load方法
      load(context, config, callbacks);
    };
  }
}

// 格式化时间（秒 -> HH:MM:SS 或 MM:SS）
function formatTime(seconds) {
  if (seconds === 0) return "00:00";

  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const remainingSeconds = Math.round(seconds % 60);

  if (hours === 0) {
    return `${minutes.toString().padStart(2, "0")}:${remainingSeconds
      .toString()
      .padStart(2, "0")}`;
  } else {
    return `${hours.toString().padStart(2, "0")}:${minutes
      .toString()
      .padStart(2, "0")}:${remainingSeconds.toString().padStart(2, "0")}`;
  }
}

export const Player = ({
  option,
  getInstance,
  className,
  style,
  danmaku = [], // 弹幕数据
  onDanmakuLoad, // 弹幕加载完成回调
}) => {
  const artRef = useRef(null);
  const playerRef = useRef(null);
  const danmakuPluginRef = useRef(null); // 弹幕插件实例引用
  const hasLoadedFirstDanmaku = useRef(false); // 追踪是否已经首次加载弹幕

  // 使用 ref 保存状态，避免重新渲染
  const getInitialBlockAdEnabled = () => {
    if (typeof window !== "undefined") {
      const saved = localStorage.getItem("enable_blockad");
      return saved !== null ? saved === "true" : true;
    }
    return true;
  };

  const getInitialSkipConfig = () => {
    if (typeof window !== "undefined") {
      const saved = localStorage.getItem("skip_config");
      if (saved) {
        try {
          return JSON.parse(saved);
        } catch {
          return { enable: false, intro_time: 0, outro_time: 0 };
        }
      }
    }
    return { enable: false, intro_time: 0, outro_time: 0 };
  };

  const blockAdEnabledRef = useRef(getInitialBlockAdEnabled());
  const skipConfigRef = useRef(getInitialSkipConfig());

  // 跳过检查的时间间隔控制
  const lastSkipCheckRef = useRef(0);

  // 保存跳过配置到 localStorage
  const saveSkipConfig = useCallback((config) => {
    skipConfigRef.current = config;
    if (typeof window !== "undefined") {
      localStorage.setItem("skip_config", JSON.stringify(config));
    }
  }, []);

  // 稳定的回调函数
  const handleBlockAdSwitch = useCallback((item) => {
    const newVal = !item.switch;
    blockAdEnabledRef.current = newVal;

    if (typeof window !== "undefined") {
      localStorage.setItem("enable_blockad", String(newVal));
    }

    if (playerRef.current) {
      playerRef.current.notice.show = newVal
        ? "去广告已开启，刷新生效"
        : "去广告已关闭，刷新生效";
    }

    return newVal;
  }, []);

  const handleSkipSwitch = useCallback(
    (item) => {
      const newConfig = { ...skipConfigRef.current, enable: !item.switch };
      saveSkipConfig(newConfig);

      if (playerRef.current) {
        playerRef.current.notice.show = newConfig.enable
          ? "跳过片头片尾已开启"
          : "跳过片头片尾已关闭";
      }

      return !item.switch;
    },
    [saveSkipConfig]
  );

  const handleSetIntro = useCallback(() => {
    if (playerRef.current) {
      const currentTime = playerRef.current.currentTime || 0;
      if (currentTime > 0) {
        const newConfig = { ...skipConfigRef.current, intro_time: currentTime };
        saveSkipConfig(newConfig);
        playerRef.current.notice.show = `片头已设置：${formatTime(
          currentTime
        )}`;
        return `片头：${formatTime(currentTime)}`;
      }
    }
  }, [saveSkipConfig]);

  const handleSetOutro = useCallback(() => {
    if (playerRef.current) {
      const outroTime =
        -(playerRef.current.duration - playerRef.current.currentTime) || 0;
      if (outroTime < 0) {
        const newConfig = { ...skipConfigRef.current, outro_time: outroTime };
        saveSkipConfig(newConfig);
        playerRef.current.notice.show = `片尾已设置：${formatTime(-outroTime)}`;
        return `片尾：${formatTime(-outroTime)}`;
      }
    }
  }, [saveSkipConfig]);

  const handleClearSkipConfig = useCallback(() => {
    const newConfig = { enable: false, intro_time: 0, outro_time: 0 };
    saveSkipConfig(newConfig);

    if (playerRef.current) {
      playerRef.current.notice.show = "跳过配置已清除";
    }

    return "已清除";
  }, [saveSkipConfig]);

  useEffect(() => {
    if (!artRef.current) return;

    // 重置弹幕加载标志（每次播放器重新创建时）
    hasLoadedFirstDanmaku.current = false;

    const art = new Artplayer({
      volume: 0.7,
      isLive: false,
      muted: false,
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
      lang: "zh-cn",
      hotkey: false,
      fastForward: true,
      autoOrientation: true,
      lock: true,
      moreVideoAttr: {
        crossOrigin: "anonymous",
      },
      ...option,
      container: artRef.current,

      // 插件配置
      plugins: [
        // 弹幕插件
        artplayerPluginDanmuku({
          danmuku: danmaku,
          speed: 5, // 弹幕速度，数字越小速度越快
          opacity: 1, // 弹幕透明度
          fontSize: 25, // 弹幕字体大小
          emitter: false, // 是否启用弹幕发射器
          color: "#FFFFFF", // 默认弹幕颜色
          mode: 0, // 弹幕模式：0-滚动，1-顶部，2-底部
          margin: [10, "25%"], // 弹幕上下边距
          antiOverlap: true, // 是否防重叠
          useWorker: true, // 是否使用 web worker
          synchronousPlayback: false, // 是否同步到播放速度
          filter: (danmu) => danmu.text.length <= 50, // 过滤过长弹幕
          lockTime: 5, // 弹幕锁定时间
          maxLength: 100, // 最大弹幕长度
          minWidth: 200, // 最小弹幕宽度
          maxWidth: 400, // 最大弹幕宽度
          theme: "dark", // 弹幕主题
        }),
        ...(option.plugins || []),
      ],

      // HLS 支持配置
      customType: {
        m3u8: function (video, url) {
          // 检查浏览器是否原生支持 HLS（如 Safari）
          if (
            video.canPlayType("application/vnd.apple.mpegurl") ||
            video.canPlayType("application/x-mpegurl")
          ) {
            console.log("使用原生 HLS 播放");
            video.src = url;
            return;
          }

          // 检查 HLS.js 是否支持
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
            // 根据去广告开关决定是否使用自定义 Loader
            loader: blockAdEnabledRef.current
              ? CustomHlsJsLoader
              : Hls.DefaultConfig.loader,
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
              // 非致命错误，仅记录日志
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
          tooltip: blockAdEnabledRef.current ? "已开启" : "已关闭",
          switch: blockAdEnabledRef.current,
          onSwitch: handleBlockAdSwitch,
        },
        {
          html: "跳过片头片尾",
          tooltip: skipConfigRef.current.enable ? "已开启" : "已关闭",
          switch: skipConfigRef.current.enable,
          onSwitch: handleSkipSwitch,
        },
        {
          html: "设置片头",
          icon: '<svg width="22" height="22" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><circle cx="6" cy="12" r="2" fill="currentColor"/><path d="M10 12L17 12" stroke="currentColor" stroke-width="2"/><path d="M17 7L17 17" stroke="currentColor" stroke-width="2"/></svg>',
          tooltip:
            skipConfigRef.current.intro_time === 0
              ? "点击设置片头时间"
              : `片头：${formatTime(skipConfigRef.current.intro_time)}`,
          onClick: handleSetIntro,
        },
        {
          html: "设置片尾",
          icon: '<svg width="22" height="22" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M7 7L7 17" stroke="currentColor" stroke-width="2"/><path d="M7 12L14 12" stroke="currentColor" stroke-width="2"/><circle cx="18" cy="12" r="2" fill="currentColor"/></svg>',
          tooltip:
            skipConfigRef.current.outro_time >= 0
              ? "点击设置片尾时间"
              : `片尾：${formatTime(-skipConfigRef.current.outro_time)}`,
          onClick: handleSetOutro,
        },
        {
          html: "清除跳过配置",
          icon: '<svg width="22" height="22" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M6 18L18 6M6 6l12 12" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>',
          onClick: handleClearSkipConfig,
        },
      ],

      // 控制栏按钮配置
      controls: [...(option.controls || [])],
    });

    playerRef.current = art;

    // 保存弹幕插件实例
    if (art.plugins && art.plugins.artplayerPluginDanmuku) {
      danmakuPluginRef.current = art.plugins.artplayerPluginDanmuku;

      // 通知父组件弹幕已加载
      if (onDanmakuLoad && typeof onDanmakuLoad === "function") {
        onDanmakuLoad(danmakuPluginRef.current);
      }
    }

    // 监听视频时间更新事件，实现跳过片头片尾
    art.on("video:timeupdate", () => {
      if (!skipConfigRef.current.enable) return;

      const currentTime = art.currentTime || 0;
      const duration = art.duration || 0;
      const now = Date.now();

      // 限制跳过检查频率为1.5秒一次
      if (now - lastSkipCheckRef.current < 1500) return;
      lastSkipCheckRef.current = now;

      // 跳过片头
      if (
        skipConfigRef.current.intro_time > 0 &&
        currentTime < skipConfigRef.current.intro_time
      ) {
        art.currentTime = skipConfigRef.current.intro_time;
        art.notice.show = `已跳过片头 (${formatTime(
          skipConfigRef.current.intro_time
        )})`;
      }

      // 跳过片尾
      if (
        skipConfigRef.current.outro_time < 0 &&
        duration > 0 &&
        currentTime > duration + skipConfigRef.current.outro_time
      ) {
        art.notice.show = `已跳过片尾 (${formatTime(
          -skipConfigRef.current.outro_time
        )})`;
        // 触发视频结束或跳转到下一集
        art.emit("video:ended");
      }
    });

    if (getInstance && typeof getInstance === "function") {
      getInstance(art);
    }

    return () => {
      if (art && art.destroy) {
        // 销毁 HLS 实例
        if (art.video && art.video.hls) {
          art.video.hls.destroy();
        }
        art.destroy(false);
      }
    };
  }, [
    option,
    getInstance,
    handleBlockAdSwitch,
    handleSkipSwitch,
    handleSetIntro,
    handleSetOutro,
    handleClearSkipConfig,
  ]);

  // 监听弹幕数据变化，动态更新弹幕
  useEffect(() => {
    if (!danmakuPluginRef.current || !playerRef.current) return;

    // 如果弹幕为空，跳过（避免不必要的更新）
    if (danmaku.length === 0) {
      // 如果之前已经加载过弹幕，现在变成空了（切换到无弹幕的剧集），需要清空
      if (hasLoadedFirstDanmaku.current) {
        console.log("清空弹幕");
        if (typeof danmakuPluginRef.current.load === "function") {
          danmakuPluginRef.current.reset();
        }
      }
      return;
    }

    // 检查弹幕插件是否有 load 方法
    if (typeof danmakuPluginRef.current.load === "function") {
      // 标记首次加载
      if (!hasLoadedFirstDanmaku.current) {
        console.log("首次加载弹幕，共", danmaku.length, "条");
        hasLoadedFirstDanmaku.current = true;
      } else {
        console.log("重新加载弹幕，共", danmaku.length, "条");
      }

      // 使用 config + load 更新弹幕数据
      // 注意：load() 方法只会更新弹幕数据，不会影响视频播放状态
      danmakuPluginRef.current.reset();
      danmakuPluginRef.current.config({
        danmuku: danmaku,
      });
      danmakuPluginRef.current.load();

      // 显示通知
      if (playerRef.current && playerRef.current.notice) {
        playerRef.current.notice.show = `已加载 ${danmaku.length} 条弹幕`;
      }
    } else {
      console.warn("弹幕插件不支持 load 方法，无法动态更新弹幕");
    }
  }, [danmaku]); // 只监听弹幕数据变化

  return <div ref={artRef} className={className} style={style}></div>;
};
