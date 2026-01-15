import { getVideoDetail } from "@/lib/cmsApi";
import { fetchDanmakuFromSources } from "@/lib/danmakuApi";
import { extractEpisodeNumberFromTitle } from "@/lib/util";
import { scrapeDoubanDetails } from "@/lib/getDouban";

// ============================================================================
// 初始数据加载 Promise 缓存
// ============================================================================
const dataPromiseCache = new Map();

/**
 * 获取初始数据加载 Promise（带缓存）
 */
export function getInitialDataPromise(id, source, videoSources, danmakuSources, playHistory) {
  const key = `${source}:${id}`;
  if (!dataPromiseCache.has(key)) {
    dataPromiseCache.set(key, fetchInitialData(id, source, videoSources, danmakuSources, playHistory));
  }
  return dataPromiseCache.get(key);
}

/**
 * 获取初始数据：视频详情、豆瓣演员、初始弹幕、播放记录
 * 这是核心优化：一次性获取所有初始数据，包括从 store 读取的播放记录
 */
async function fetchInitialData(id, source, videoSources, danmakuSources, playHistory) {
  // 1. 获取视频详情
  const sourceConfig = videoSources.find((s) => s.key === source);
  if (!sourceConfig) {
    throw new Error("未找到对应的视频源");
  }

  const videoDetail = await getVideoDetail(id, sourceConfig.name, sourceConfig.url);

  // 2. 读取播放记录，确定初始集数
  const playRecord = playHistory.find((item) => item.source === source && item.id === id);
  const initialEpisodeIndex = playRecord?.currentEpisodeIndex ?? 0;
  const initialTime = playRecord?.currentTime && playRecord.currentTime > 5 ? playRecord.currentTime : 0;

  console.log("播放记录:", playRecord ? `第${initialEpisodeIndex + 1}集, ${Math.floor(initialTime)}秒` : "无");

  // 3. 并行获取初始集数的弹幕和豆瓣演员数据
  const enabledSources = danmakuSources.filter((s) => s.enabled);

  const [danmakuResult, doubanResult] = await Promise.allSettled([
    // 获取初始集数的弹幕
    videoDetail.douban_id && enabledSources.length > 0
      ? (async () => {
          const isMovie = videoDetail.episodes?.length === 1;
          const episodeTitle = videoDetail.episodes_titles?.[initialEpisodeIndex] || `第${initialEpisodeIndex + 1}集`;
          let episodeNumber = extractEpisodeNumberFromTitle(episodeTitle, isMovie);
          if (episodeNumber === null) {
            episodeNumber = initialEpisodeIndex + 1;
          }
          console.log(`获取初始弹幕: 豆瓣ID=${videoDetail.douban_id}, 第${episodeNumber}集${isMovie ? " (电影)" : ""}`);
          return fetchDanmakuFromSources(danmakuSources, videoDetail.douban_id, episodeNumber);
        })()
      : Promise.resolve([]),
    // 获取豆瓣演员数据
    videoDetail.douban_id ? scrapeDoubanDetails(videoDetail.douban_id) : Promise.resolve({ code: 404, data: { actors: [] } }),
  ]);

  // 处理弹幕结果
  let initialDanmaku = [];
  if (danmakuResult.status === "fulfilled") {
    initialDanmaku = danmakuResult.value;
    console.log(`初始弹幕加载完成，共 ${initialDanmaku.length} 条`);
  } else {
    console.error("获取初始弹幕失败:", danmakuResult.reason);
  }

  // 处理豆瓣演员结果
  let doubanActors = [];
  if (doubanResult.status === "fulfilled" && doubanResult.value.code === 200 && doubanResult.value.data.actors) {
    doubanActors = doubanResult.value.data.actors;
    doubanActors.forEach((actor) => {
      actor.avatar = actor.avatar.replace(/img\d+\.doubanio\.com/g, "img.doubanio.cmliussss.com");
    });
    console.log(`豆瓣演员数据加载完成，共 ${doubanActors.length} 位演员`);
  } else if (doubanResult.status === "rejected") {
    console.warn("获取豆瓣演员数据失败:", doubanResult.reason?.message);
  }

  return {
    videoDetail,
    initialDanmaku,
    doubanActors,
    initialEpisodeIndex,
    initialTime,
  };
}

/**
 * 获取指定集数的弹幕（事件驱动）
 */
export async function fetchDanmakuForEpisode(videoDetail, episodeIndex, danmakuSources) {
  if (!videoDetail || !videoDetail.douban_id) {
    console.log("没有豆瓣ID，无法获取弹幕");
    return [];
  }

  const enabledSources = danmakuSources.filter((s) => s.enabled);
  if (enabledSources.length === 0) {
    console.log("没有启用的弹幕源");
    return [];
  }

  try {
    const isMovie = videoDetail.episodes?.length === 1;
    const episodeTitle = videoDetail.episodes_titles?.[episodeIndex] || `第${episodeIndex + 1}集`;

    let episodeNumber = extractEpisodeNumberFromTitle(episodeTitle, isMovie);
    if (episodeNumber === null) {
      episodeNumber = episodeIndex + 1;
      console.warn(`无法从标题 "${episodeTitle}" 中提取集数，使用索引 ${episodeNumber}`);
    }

    console.log(`获取弹幕: 豆瓣ID=${videoDetail.douban_id}, 第${episodeNumber}集${isMovie ? " (电影)" : ""}`);

    const danmakuData = await fetchDanmakuFromSources(danmakuSources, videoDetail.douban_id, episodeNumber);
    console.log(`弹幕加载完成，共 ${danmakuData.length} 条`);
    return danmakuData;
  } catch (error) {
    console.error("获取弹幕失败:", error);
    return [];
  }
}
