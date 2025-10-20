const play = require('play-dl');
const LanguageManager = require('./LanguageManager');

class YouTube {
    static async search(query, limit = 1, guildId = null) {
        try {
            console.log('🔍 YouTube search called with:', query);
            
            // If it's already a YouTube URL, get info directly
            if (this.isYouTubeURL(query)) {
                console.log('✓ Detected YouTube URL');
                const info = await this.getInfo(query, guildId);
                return info ? [info] : [];
            }

            console.log('✓ Performing YouTube search');
            // Search YouTube
            const searchResults = await play.search(query, { limit: limit, source: { youtube: 'video' } });

            if (!searchResults || searchResults.length === 0) {
                console.log('❌ No search results found');
                return [];
            }

            console.log(`✓ Found ${searchResults.length} results`);
            const tracks = [];
            for (const video of searchResults) {
                const unknownTitle = guildId ? await LanguageManager.getTranslation(guildId, 'youtube.unknown_title') : 'Unknown Title';
                const unknownArtist = guildId ? await LanguageManager.getTranslation(guildId, 'youtube.unknown_artist') : 'Unknown Artist';

                const track = {
                    title: video.title || unknownTitle,
                    artist: video.channel?.name || unknownArtist,
                    url: video.url,
                    duration: video.durationInSec || 0,
                    thumbnail: video.thumbnails?.[0]?.url,
                    platform: 'youtube',
                    type: 'track',
                    id: video.id,
                    views: video.views,
                    uploadDate: video.uploadedAt,
                    description: video.description,
                };

                tracks.push(track);
            }

            console.log('✓ Formatted tracks successfully');
            return tracks;

        } catch (error) {
            console.error('❌ YouTube search error:', error.message);
            console.error('Stack:', error.stack);
            return [];
        }
    }

    static async getInfo(url, guildId = null) {
        try {
            console.log('🔍 Getting video info for:', url);
            
            const info = await play.video_info(url);

            if (!info || !info.video_details) {
                console.log('❌ No video info returned');
                return null;
            }

            const video = info.video_details;
            const unknownTitle = guildId ? await LanguageManager.getTranslation(guildId, 'youtube.unknown_title') : 'Unknown Title';
            const unknownArtist = guildId ? await LanguageManager.getTranslation(guildId, 'youtube.unknown_artist') : 'Unknown Artist';

            const track = {
                title: video.title || unknownTitle,
                artist: video.channel?.name || unknownArtist,
                url: video.url,
                duration: video.durationInSec || 0,
                thumbnail: video.thumbnails?.[0]?.url,
                platform: 'youtube',
                type: 'track',
                id: video.id,
                views: video.views,
                uploadDate: video.uploadedAt,
                description: video.description,
            };

            console.log('✓ Video info retrieved:', track.title);
            return track;

        } catch (error) {
            console.error('❌ YouTube getInfo error:', error.message);
            console.error('Stack:', error.stack);
            return null;
        }
    }

    static async getStream(url, guildId = null, startSeconds = 0) {
        try {
            console.log('🎵 Getting stream for:', url, 'Type:', typeof url);
            
            if (!url) {
                const errorMsg = guildId ? await LanguageManager.getTranslation(guildId, 'youtube.url_required') : 'URL is required';
                throw new Error(errorMsg);
            }

            // Clean the URL - remove tracking parameters like ?si=
            let cleanUrl = String(url);
            if (cleanUrl.includes('?si=')) {
                cleanUrl = cleanUrl.split('?si=')[0];
                console.log('🧹 Cleaned URL:', cleanUrl);
            }
            
            // Also remove any other query parameters that might cause issues
            if (cleanUrl.includes('&')) {
                const baseUrl = cleanUrl.split('&')[0];
                cleanUrl = baseUrl;
                console.log('🧹 Further cleaned URL:', cleanUrl);
            }
            
            // Validate it's a proper YouTube URL
            const isValid = await play.yt_validate(cleanUrl);
            console.log('🔍 URL validation result:', isValid, 'for URL:', cleanUrl);
            
            if (!isValid || isValid === 'search') {
                console.error('❌ Invalid YouTube URL:', cleanUrl);
                throw new Error('Invalid YouTube URL');
            }

            console.log('✓ URL validated, getting video info first...');
            
            // Get video info first - this is required for play-dl to work properly
            const info = await play.video_info(cleanUrl);
            console.log('✓ Video info obtained:', info.video_details.title);
            
            // Now get stream using the video info
            const streamData = await play.stream_from_info(info, { 
                quality: 2 // 0 = lowest, 1 = medium, 2 = highest
            });

            console.log('✓ Stream obtained, type:', streamData.type);
            
            return {
                stream: streamData.stream,
                type: streamData.type,
                url: cleanUrl,
                duration: info.video_details.durationInSec || 0,
                canSeek: false,
            };

        } catch (error) {
            console.error('❌ YouTube getStream error:', error.message);
            console.error('Full error:', error);
            throw error;
        }
    }

    static async getPlaylist(url, guildId = null) {
        try {
            console.log('📋 Getting playlist for:', url);
            
            const playlist = await play.playlist_info(url, { incomplete: true });

            if (!playlist) {
                console.log('❌ No playlist info returned');
                return null;
            }

            console.log('✓ Fetching playlist videos...');
            const videos = await playlist.all_videos();

            if (!videos || videos.length === 0) {
                console.log('❌ No videos in playlist');
                return null;
            }

            console.log(`✓ Found ${videos.length} videos in playlist`);
            const unknownTitle = guildId ? await LanguageManager.getTranslation(guildId, 'youtube.unknown_title') : 'Unknown Title';
            const unknownArtist = guildId ? await LanguageManager.getTranslation(guildId, 'youtube.unknown_artist') : 'Unknown Artist';

            const tracks = [];
            for (const video of videos.slice(0, 50)) { // Limit to 50 tracks
                const track = {
                    title: video.title || unknownTitle,
                    artist: video.channel?.name || unknownArtist,
                    url: video.url,
                    duration: video.durationInSec || 0,
                    thumbnail: video.thumbnails?.[0]?.url,
                    platform: 'youtube',
                    type: 'track',
                    id: video.id,
                };

                tracks.push(track);
            }

            const unknownPlaylist = guildId ? await LanguageManager.getTranslation(guildId, 'youtube.unknown_playlist') : 'Unknown Playlist';

            console.log('✓ Playlist processed successfully');
            return {
                title: playlist.title || unknownPlaylist,
                tracks: tracks,
                totalTracks: playlist.videoCount || tracks.length,
                url: url,
                platform: 'youtube',
                type: 'playlist',
            };

        } catch (error) {
            console.error('❌ YouTube getPlaylist error:', error.message);
            console.error('Stack:', error.stack);
            return null;
        }
    }

    static isYouTubeURL(url) {
        const patterns = [
            /^https?:\/\/(www\.)?(youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/playlist\?list=)/,
            /^https?:\/\/(www\.)?youtube\.com\/embed\/[a-zA-Z0-9_-]+/,
            /^https?:\/\/(www\.)?youtube\.com\/v\/[a-zA-Z0-9_-]+/,
        ];
        return patterns.some(pattern => pattern.test(url));
    }

    static isPlaylist(url) {
        return url.includes('list=') &&
            (url.includes('youtube.com/playlist') ||
                url.includes('youtube.com/watch') ||
                url.includes('youtu.be'));
    }

    static formatDuration(seconds) {
        if (!seconds || seconds === 0) return '0:00';

        const totalSeconds = Math.floor(Number(seconds) || 0);
        const hours = Math.floor(totalSeconds / 3600);
        const minutes = Math.floor((totalSeconds % 3600) / 60);
        const remainingSeconds = totalSeconds % 60;

        if (hours > 0) {
            return `${hours}:${minutes.toString().padStart(2, '0')}:${remainingSeconds.toString().padStart(2, '0')}`;
        } else {
            return `${minutes}:${remainingSeconds.toString().padStart(2, '0')}`;
        }
    }

    static extractVideoId(url) {
        const patterns = [
            /(?:youtube\.com\/watch\?v=|youtu\.be\/)([a-zA-Z0-9_-]+)/,
            /youtube\.com\/embed\/([a-zA-Z0-9_-]+)/,
            /youtube\.com\/v\/([a-zA-Z0-9_-]+)/,
        ];

        for (const pattern of patterns) {
            const match = url.match(pattern);
            if (match) return match[1];
        }

        return null;
    }

    static extractPlaylistId(url) {
        const match = url.match(/[&?]list=([a-zA-Z0-9_-]+)/);
        return match ? match[1] : null;
    }

    static createThumbnailUrl(videoId, quality = 'maxresdefault') {
        return `https://img.youtube.com/vi/${videoId}/${quality}.jpg`;
    }

    static createVideoUrl(videoId) {
        return `https://www.youtube.com/watch?v=${videoId}`;
    }

    static async validateUrl(url) {
        try {
            if (!this.isYouTubeURL(url)) {
                return false;
            }

            const info = await play.video_info(url);
            return !!info && !!info.video_details;
        } catch (error) {
            return false;
        }
    }
}

module.exports = YouTube;
