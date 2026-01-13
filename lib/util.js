export function extractEpisodeNumberFromTitle(episodeTitle, ismovie) {
  // 如果是电影，则返回1, 因为电影只有1集
  if (ismovie) {
    return 1;
  }
  // 匹配格式：第1集、第01集、第10集等
  const chineseMatch = episodeTitle.match(/第(\d+)集/);
  if (chineseMatch) {
    return parseInt(chineseMatch[1], 10);
  }
  // 匹配格式：EP01、EP1、E01、E1等
  const epMatch = episodeTitle.match(/[Ee][Pp]?(\d+)/);
  if (epMatch) {
    return parseInt(epMatch[1], 10);
  }
  // 匹配格式：01、1（纯数字，通常在标题开头或结尾）
  const numberMatch = episodeTitle.match(/(?:^|\s)(\d+)(?:\s|$)/);
  if (numberMatch) {
    return parseInt(numberMatch[1], 10);
  }
  return null;
}
