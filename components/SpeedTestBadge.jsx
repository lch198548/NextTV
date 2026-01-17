import React, { useState, useEffect } from "react";
import { getVideoDetail } from "@/lib/cmsApi";
import { testStreamUrl } from "@/lib/clientSpeedTest";

// Global cache to store speed test results by key (videoId + sourceKey)
const resultCache = new Map();

export const SpeedTestBadge = React.memo(function SpeedTestBadge({ videoId, sourceKey, sourceUrl }) {
  const cacheKey = `${videoId}-${sourceKey}`;
  const [loading, setLoading] = useState(!resultCache.has(cacheKey));
  const [result, setResult] = useState(resultCache.get(cacheKey) || null);
  const [error, setError] = useState(null);

  useEffect(() => {
    // If we already have a cached result, don't run the test again
    if (resultCache.has(cacheKey)) {
        setResult(resultCache.get(cacheKey));
        setLoading(false);
        return;
    }

    let mounted = true;

    async function runTest() {
      try {
        setLoading(true);
        // 1. Get video details
        const detail = await getVideoDetail(videoId, sourceKey, sourceUrl);
        
        if (!detail || !detail.episodes || detail.episodes.length === 0) {
          throw new Error("No episodes found");
        }

        // 2. Get last episode URL
        const lastEpisodeUrl = detail.episodes[detail.episodes.length - 1];

        // 3. Run speed test client-side
        const testResult = await testStreamUrl(lastEpisodeUrl, "GET", 30000, true);
        
        // Cache the result
        resultCache.set(cacheKey, testResult);

        if (mounted) {
           setResult(testResult);
        }
      } catch (err) {
        if (mounted) {
          setError(err.message);
          console.error("Speed test error:", err);
        }
      } finally {
        if (mounted) {
          setLoading(false);
        }
      }
    }

    if (videoId && sourceUrl) {
      runTest();
    }

    return () => {
      mounted = false;
    };
  }, [videoId, sourceKey, sourceUrl, cacheKey]);

  if (loading) {
    return (
      <div className="absolute top-2 left-2 z-10">
         <span className="bg-black/60 backdrop-blur-sm text-white/80 text-[10px] px-2 py-1 rounded-md flex items-center gap-1 animate-pulse">
            <span className="material-symbols-outlined text-[10px] animate-spin">refresh</span>
            测速中...
         </span>
      </div>
    );
  }

  if (error || !result || !result.success) {
      // Optional: don't show anything on error to keep UI clean, or show a red dot
      return null;
  }

  // Format download speed
  let speedText = "";
  const speedBps = result.downloadSpeed || 0;
  
  if (speedBps >= 1048576) { // >= 1 MB/s
      speedText = `${(speedBps / 1048576).toFixed(1)} MB/s`;
  } else if (speedBps >= 1024) { // >= 1 KB/s
      speedText = `${(speedBps / 1024).toFixed(1)} KB/s`;
  } else {
      speedText = `${speedBps} B/s`;
  }

  // Color coding based on speed
  // > 5MB/s (5 * 1024 * 1024) or < 200ms
  // > 1MB/s or < 800ms
  let colorClass = "bg-red-500/70";
  const speedMb = speedBps / 1048576;
  
  if (speedMb > 5 || (result.responseTime && result.responseTime < 200)) {
    colorClass = "bg-green-500/70";
  } else if (speedMb > 1 || (result.responseTime && result.responseTime < 800)) {
    colorClass = "bg-yellow-500/70 text-black";
  }

  return (
    <div className="absolute top-2 left-2 z-10">
      <div className={`${colorClass} text-white shadow-sm backdrop-blur-md rounded-md px-2 py-1 flex flex-col items-start gap-0.5 min-w-[50px]`}>
         <span className="text-[10px] font-bold leading-none">{result.responseTime}ms</span>
         {speedText && (
            <span className="text-[9px] font-medium leading-none whitespace-nowrap opacity-90">
              {speedText}
            </span>
         )}
      </div>
    </div>
  );
});
