/**
 * Client-side version of testStreamUrl
 * Adapted from lib/speedTest.js for browser usage
 */
export async function testStreamUrl(
  url,
  method = "GET",
  timeout = 30000,
  downloadSpeedTest = true,
) {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeout);

  try {
    const startTime = Date.now();

    // Browser fetch doesn't support 'agent' for SSL configuration
    const response = await fetch(url, {
      method: method,
      // headers: {
      //   "User-Agent": "Mozilla/5.0..." // User-Agent header is usually controlled by the browser
      // },
      signal: controller.signal,
    });

    const responseTime = Date.now() - startTime;
    let downloadSpeed = null;
    let downloadSize = 0;
    let contentType = response.headers.get("content-type") || "";
    let isM3u8 =
      url.toLowerCase().includes(".m3u8") || contentType.includes("mpegurl");
    let content = null;
    let realMediaUrl = null;

    if (method === "GET" && response.ok && downloadSpeedTest) {
      try {
        const downloadStartTime = Date.now();
        content = await response.text();

        // Use Blob to get byte size in browser
        downloadSize = new Blob([content]).size;

        if (isM3u8 && content.includes("#EXTM3U")) {
          // Recursively parse M3U8
          async function parseM3u8(m3u8Url, m3u8Content, depth = 0) {
            if (depth > 2) return null;

            const lines = m3u8Content.split("\n");
            const segmentUrls = [];
            let isStreamInfoFound = false;

            for (let i = 0; i < lines.length; i++) {
              const line = lines[i].trim();

              if (line.startsWith("#EXT-X-STREAM-INF:")) {
                isStreamInfoFound = true;
                continue;
              }

              if (!line.startsWith("#")) {
                if (line.length === 0) continue;

                let segmentUrl = line;

                if (!segmentUrl.startsWith("http")) {
                  const baseUrl = new URL(m3u8Url);
                  if (segmentUrl.startsWith("/")) {
                    segmentUrl = `${baseUrl.protocol}//${baseUrl.host}${segmentUrl}`;
                  } else {
                    const urlPath = baseUrl.pathname.substring(
                      0,
                      baseUrl.pathname.lastIndexOf("/") + 1,
                    );
                    segmentUrl = `${baseUrl.protocol}//${baseUrl.host}${urlPath}${segmentUrl}`;
                  }
                }

                if (isStreamInfoFound || segmentUrl.includes(".m3u8")) {
                  try {
                    const nestedResponse = await fetch(segmentUrl, {
                      method: "GET",
                      signal: controller.signal,
                    });

                    if (nestedResponse.ok) {
                      const nestedContent = await nestedResponse.text();
                      const nestedResult = await parseM3u8(
                        segmentUrl,
                        nestedContent,
                        depth + 1,
                      );
                      if (nestedResult) return nestedResult;
                    }
                  } catch (err) {
                    console.error(
                      `Client nested M3U8 parse failed: ${err.message}`,
                    );
                  }
                }

                if (
                  segmentUrl.includes(".ts") ||
                  segmentUrl.includes(".mp4") ||
                  segmentUrl.includes(".jpeg") ||
                  segmentUrl.includes(".jpg") ||
                  segmentUrl.includes("/hls/") ||
                  segmentUrl.includes("segment")
                ) {
                  segmentUrls.push(segmentUrl);
                  if (segmentUrls.length >= 1) break;
                }
              }
            }
            return segmentUrls.length > 0 ? segmentUrls[0] : null;
          }

          realMediaUrl = await parseM3u8(url, content);

          if (realMediaUrl) {
            try {
              const segmentStartTime = Date.now();
              const segmentResponse = await fetch(realMediaUrl, {
                method: "GET",
                signal: controller.signal,
              });

              if (segmentResponse.ok) {
                const segmentBlob = await segmentResponse.blob();
                const segmentSize = segmentBlob.size;
                const segmentTime = Date.now() - segmentStartTime;

                if (segmentTime > 0 && segmentSize > 0) {
                  downloadSpeed = Math.round(
                    (segmentSize / segmentTime) * 1000,
                  );
                  downloadSize = segmentSize;
                }
              }
            } catch (segmentError) {
              console.error(
                `Client media download failed: ${segmentError.message}`,
              );
            }
          }
        } else {
          // Not M3U8, calculate based on text download
          const downloadTime = Date.now() - downloadStartTime;
          if (downloadTime > 0 && downloadSize > 0) {
            downloadSpeed = Math.round((downloadSize / downloadTime) * 1000);
          }
        }
      } catch (err) {
        console.error("Client speed test failed:", err);
      }
    }

    return {
      success: response.ok,
      responseTime,
      status: response.status,
      downloadSpeed,
      downloadSize,
      contentType,
      isM3u8,
      realMediaUrl,
      content: content
        ? content.substring(0, 200) + (content.length > 200 ? "..." : "")
        : null,
      error: null,
    };
  } catch (error) {
    return {
      success: false,
      error: error.message,
      // ... default nulls
      responseTime: null,
      downloadSpeed: null,
    };
  } finally {
    clearTimeout(timeoutId);
  }
}
