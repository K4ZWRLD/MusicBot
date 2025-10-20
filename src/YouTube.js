const play = require('play-dl');

class YouTube {
    constructor() {
        this.name = 'YouTube';
    }

    async search(query, limit = 1) {
        try {
            console.log(`🔍 YouTube search called with: ${query}`);
            
            // Check if it's a URL first
            const urlValidation = await play.yt_validate(query);
            
            if (urlValidation === 'video') {
                console.log('✓ Detected YouTube URL');
                return await this.getVideoInfo(query);
            } else if (urlValidation === 'playlist') {
                console.log('✓ Detected YouTube Playlist URL');
                return await this.getPlaylist(query);
            }
            
            // If not a URL, perform search
            console.log(`🔍 Searching YouTube for: ${query}`);
            const searchResults = await play.search(query, {
                limit: limit,
                source: { youtube: "video" }
            });

            if (!searchResults || searchResults.length === 0) {
                return [];
            }

            return searchResults.map(video => ({
                title: video.title,
                url: video.url,
                duration: video.durationInSec,
                thumbnail: video.thumbnails[0]?.url || null,
                artist: video.channel?.name || 'Unknown',
                platform: 'youtube'
            }));

        } catch (error) {
            console.error('❌ YouTube search error:', error);
            throw error;
        }
    }

    async getVideoInfo(url) {
        try {
            console.log(`🔍 Getting video info for: ${url}`);
            const videoInfo = await play.video_info(url);
            
            const track = {
                title: videoInfo.video_details.title,
                url: videoInfo.video_details.url,
                duration: videoInfo.video_details.durationInSec,
                thumbnail: videoInfo.video_details.thumbnails[0]?.url || null,
                artist: videoInfo.video_details.channel?.name || 'Unknown',
                platform: 'youtube'
            };

            console.log(`✓ Video info retrieved: ${track.title}`);
            return [track];

        } catch (error) {
            console.error('❌ YouTube getVideoInfo error:', error);
            throw error;
        }
    }

    async getPlaylist(url) {
        try {
            console.log(`🔍 Getting playlist info for: ${url}`);
            const playlist = await play.playlist_info(url, { incomplete: true });
            const videos = await playlist.all_videos();

            const tracks = videos.map(video => ({
                title: video.title,
                url: video.url,
                duration: video.durationInSec,
                thumbnail: video.thumbnails[0]?.url || null,
                artist: video.channel?.name || 'Unknown',
                platform: 'youtube'
            }));

            console.log(`✓ Playlist retrieved: ${tracks.length} tracks`);
            return tracks;

        } catch (error) {
            console.error('❌ YouTube getPlaylist error:', error);
            throw error;
        }
    }

    async getStream(url) {
        try {
            console.log(`🎵 Getting stream for: ${url} Type: ${typeof url}`);
            
            // Validate URL before proceeding
            if (!url || typeof url !== 'string') {
                throw new Error(`Invalid URL provided to getStream: ${url}`);
            }

            // Clean the URL - remove any query parameters that might cause issues
            let cleanUrl = url;
            try {
                const urlObj = new URL(url);
                // Keep only the essential parts for YouTube
                if (urlObj.hostname.includes('youtube.com')) {
                    const videoId = urlObj.searchParams.get('v');
                    if (videoId) {
                        cleanUrl = `https://www.youtube.com/watch?v=${videoId}`;
                    }
                } else if (urlObj.hostname.includes('youtu.be')) {
                    const videoId = urlObj.pathname.slice(1).split('?')[0];
                    if (videoId) {
                        cleanUrl = `https://www.youtube.com/watch?v=${videoId}`;
                    }
                }
                console.log(`🧹 Cleaned URL: ${cleanUrl}`);
            } catch (e) {
                console.log(`⚠️ Could not parse URL, using original: ${e.message}`);
            }

            // Validate the cleaned URL
            const urlValidation = await play.yt_validate(cleanUrl);
            console.log(`🔍 URL validation result: ${urlValidation} for URL: ${cleanUrl}`);
            
            if (urlValidation === false || urlValidation === 'search') {
                throw new Error(`URL validation failed: ${cleanUrl} returned ${urlValidation}`);
            }

            if (urlValidation === 'video') {
                // Method 1: Try direct streaming (most reliable)
                try {
                    console.log(`✓ Attempting direct stream for: ${cleanUrl}`);
                    const stream = await play.stream(cleanUrl, {
                        quality: 2, // 0 = lowest, 1 = medium, 2 = highest
                        discordPlayerCompatibility: true
                    });
                    
                    // Get video info separately for metadata
                    const videoInfo = await play.video_info(cleanUrl);
                    
                    console.log(`✅ Stream obtained successfully`);
                    return {
                        stream: stream.stream,
                        type: stream.type,
                        url: cleanUrl,
                        title: videoInfo.video_details.title,
                        duration: videoInfo.video_details.durationInSec
                    };
                } catch (streamError) {
                    console.log(`⚠️ Direct stream failed: ${streamError.message}`);
                    console.log(`🔄 Attempting alternative method...`);
                    
                    // Method 2: Get info first, then stream from info
                    const videoInfo = await play.video_info(cleanUrl);
                    console.log(`✓ Video info obtained: ${videoInfo.video_details.title}`);
                    
                    // Extract the actual video URL from info
                    const videoUrl = videoInfo.video_details.url;
                    console.log(`✓ Extracted video URL: ${videoUrl}`);
                    
                    // Now try streaming with the extracted URL
                    const stream = await play.stream(videoUrl, {
                        quality: 2,
                        discordPlayerCompatibility: true
                    });
                    
                    console.log(`✅ Stream obtained via alternative method`);
                    return {
                        stream: stream.stream,
                        type: stream.type,
                        url: videoUrl,
                        title: videoInfo.video_details.title,
                        duration: videoInfo.video_details.durationInSec
                    };
                }
            } else if (urlValidation === 'playlist') {
                throw new Error('Playlists should be handled by getPlaylist method');
            }

            throw new Error(`Unexpected validation result: ${urlValidation}`);

        } catch (error) {
            console.error('❌ YouTube getStream error:', error.message);
            console.error('Full error:', error);
            
            // Provide helpful debugging info
            if (error.message.includes('Invalid URL') || error.code === 'ERR_INVALID_URL') {
                console.error('💡 This usually means:');
                console.error('   1. The video URL format is incorrect');
                console.error('   2. play-dl needs to be updated: npm install play-dl@latest');
                console.error('   3. YouTube cookies might be needed for some videos');
                console.error(`   4. The problematic URL was: ${url}`);
            }
            
            throw error;
        }
    }

    async refreshCookies() {
        try {
            // This helps with age-restricted or region-locked videos
            // You'll need to get cookies from your browser
            // Instructions: https://github.com/play-dl/play-dl/tree/main#youtube-cookies
            
            // For now, just return - implement later if needed
            console.log('ℹ️ Cookie refresh not implemented yet');
            return false;
        } catch (error) {
            console.error('Failed to refresh cookies:', error);
            return false;
        }
    }

    async validate(query) {
        try {
            return await play.yt_validate(query);
        } catch (error) {
            console.error('❌ YouTube validate error:', error);
            return false;
        }
    }
}

module.exports = YouTube;
