/**
 * 弹幕相关API函数
 */

/**
 * 位置映射：将API返回的位置转换为插件需要的模式
 * right -> 0 (滚动)
 * top -> 1 (顶部)
 * bottom -> 2 (底部)
 */
const POSITION_MAP = {
  'right': 0,
  'top': 1,
  'bottom': 2,
};

/**
 * 转换弹幕数据格式
 * 从API格式转换为插件格式
 * @param {Array} rawDanmaku - API返回的弹幕数组 [[时间, 位置, 颜色, 文字大小, 弹幕内容], ...]
 * @returns {Array} 插件格式的弹幕数组 [{ text, time, color, mode }, ...]
 */
export function convertDanmakuFormat(rawDanmaku) {
  if (!Array.isArray(rawDanmaku)) {
    return [];
  }

  return rawDanmaku.map(item => {
    if (!Array.isArray(item) || item.length < 5) {
      return null;
    }

    const [time, position, color, fontSize, text] = item;

    return {
      time: Number(time) || 0,
      mode: POSITION_MAP[position] || 0,
      color: color || '#ffffff',
      text: String(text || ''),
      // fontSize: fontSize || '25px', // 插件可能不支持自定义字体大小，这里注释掉
    };
  }).filter(Boolean); // 过滤掉null值
}

/**
 * 从弹幕源获取弹幕数据
 * @param {string} baseUrl - 弹幕源的基础URL
 * @param {string} doubanId - 豆瓣ID
 * @param {number} episodeNumber - 集数（从1开始）
 * @returns {Promise<Array>} 插件格式的弹幕数组
 */
export async function fetchDanmaku(baseUrl, doubanId, episodeNumber) {
  if (!baseUrl || !doubanId) {
    console.warn('缺少必要的参数：baseUrl 或 doubanId');
    return [];
  }

  try {
    // 构建请求URL
    const url = `${baseUrl}?douban_id=${doubanId}&episode_number=${episodeNumber || 1}`;

    console.log('获取弹幕:', url);

    const response = await fetch(url);

    if (!response.ok) {
      throw new Error(`HTTP错误: ${response.status}`);
    }

    const data = await response.json();

    // 检查返回状态码
    if (data.code !== 0 && data.code !== 23) {
      console.warn('弹幕获取失败，状态码:', data.code);
      return [];
    }

    // 转换弹幕格式
    const danmaku = convertDanmakuFormat(data.danmuku || []);

    console.log(`成功获取 ${danmaku.length} 条弹幕`);

    return danmaku;
  } catch (error) {
    console.error('获取弹幕失败:', error);
    return [];
  }
}

/**
 * 从多个启用的弹幕源获取弹幕
 * 按顺序尝试，返回第一个成功的结果
 * @param {Array} danmakuSources - 弹幕源列表
 * @param {string} doubanId - 豆瓣ID
 * @param {number} episodeNumber - 集数
 * @returns {Promise<Array>} 插件格式的弹幕数组
 */
export async function fetchDanmakuFromSources(danmakuSources, doubanId, episodeNumber) {
  if (!doubanId) {
    console.warn('缺少豆瓣ID，无法获取弹幕');
    return [];
  }

  // 过滤出启用的弹幕源
  const enabledSources = danmakuSources.filter(source => source.enabled);

  if (enabledSources.length === 0) {
    console.warn('没有启用的弹幕源');
    return [];
  }

  // 按顺序尝试每个弹幕源
  for (const source of enabledSources) {
    try {
      const danmaku = await fetchDanmaku(source.url, doubanId, episodeNumber);

      if (danmaku.length > 0) {
        console.log(`从弹幕源 "${source.name}" 成功获取 ${danmaku.length} 条弹幕`);
        return danmaku;
      }
    } catch (error) {
      console.warn(`弹幕源 "${source.name}" 获取失败:`, error);
      // 继续尝试下一个源
    }
  }

  console.warn('所有弹幕源都未能获取到弹幕');
  return [];
}
