const play = require('play-dl');
const LanguageManager = require('./LanguageManager');

class YouTube {
    static async search(query, limit = 1, guildId = null) {
        try {
            // If it's already a YouTube URL, get info directly
            if (this.isYouTubeURL(query)) {
                const info = await this.getInfo(query, guildId);
                return info ? [info] : [];
            }

            // Search YouTube
            const searchResults = await play.search(query, { limit: limit, source: { youtube: 'video' } });

            if (!searchResults || searchResults.length === 0) {
                return [];
            }

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

            return tracks;

        } catch (error) {
            console.error('❌ YouTube search error:', error.message);
            return [];
        }
    }

    static async getInfo(url, guildId = null) {
        try {
            const info = await play.video_info(url);

            if (!info || !info.video_details) {
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

            return track;

        } catch (error) {
            console.error('❌ YouTube getInfo error:', error.message);
            return null;
        }
    }

    static async getStream(url, guildId = null, startSeconds = 0) {
        try {
            if (!url) {
                const errorMsg = guildId ? await LanguageManager.getTranslation(guildId, 'youtube.url_required') : 'URL is required';
                throw new Error(errorMsg);
            }

            const stream = await play.stream(url, { seek: startSeconds });

            return {
                url: stream.stream,
                type: stream.type === 'opus' ? 'opus' : 'arbitrary',
                duration: 0,
                canSeek: true,
            };

        } catch (error) {
            console.error('❌ YouTube getStream error:', error.message);
            throw error;
        }
    }

    static async getPlaylist(url, guildId = null) {
        try {
            const playlist = await play.playlist_info(url, { incomplete: true });

            if (!playlist) {
                return null;
            }

            const videos = await playlist.all_videos();

            if (!videos || videos.length === 0) {
                return null;
            }

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
