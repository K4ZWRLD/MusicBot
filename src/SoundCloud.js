const play = require('play-dl');
const LanguageManager = require('./LanguageManager');

class SoundCloud {
    static async search(query, limit = 1, guildId = null) {
        try {
            // If it's already a SoundCloud URL, get info directly
            if (this.isSoundCloudURL(query)) {
                const info = await this.getInfo(query, guildId);
                return info ? [info] : [];
            }

            // Search SoundCloud
            const searchResults = await play.search(query, { 
                limit: limit, 
                source: { soundcloud: 'tracks' } 
            });

            if (!searchResults || searchResults.length === 0) {
                return [];
            }

            const tracks = [];
            for (const track of searchResults) {
                const formattedTrack = await this.formatTrack(track, guildId);
                if (formattedTrack) {
                    tracks.push(formattedTrack);
                }
            }

            return tracks;

        } catch (error) {
            console.error('❌ SoundCloud search error:', error.message);
            return [];
        }
    }

    static async getInfo(url, guildId = null) {
        try {
            const info = await play.soundcloud(url);

            if (!info) {
                return null;
            }

            const track = await this.formatTrack(info, guildId);
            return track;

        } catch (error) {
            console.error('❌ SoundCloud getInfo error:', error.message);
            return null;
        }
    }

    static async getStream(url, guildId = null, startSeconds = 0) {
        try {
            const stream = await play.stream(url, { seek: startSeconds });

            return {
                url: stream.stream,
                type: stream.type === 'opus' ? 'opus' : 'arbitrary',
            };

        } catch (error) {
            console.error('❌ SoundCloud getStream error:', error.message);
            throw error;
        }
    }

    static async getPlaylist(url, guildId = null) {
        try {
            const playlist = await play.soundcloud(url);

            if (!playlist || playlist.type !== 'playlist') {
                return null;
            }

            const tracks = [];
            for (const track of playlist.tracks) {
                const formattedTrack = await this.formatTrack(track, guildId);
                if (formattedTrack) {
                    tracks.push(formattedTrack);
                }
            }

            const unknownPlaylist = guildId ? await LanguageManager.getTranslation(guildId, 'soundcloud.unknown_playlist') : 'Unknown Playlist';

            return {
                title: playlist.name || unknownPlaylist,
                tracks: tracks,
                totalTracks: playlist.tracksCount || tracks.length,
                url: url,
                platform: 'soundcloud',
                type: 'playlist',
                description: playlist.description,
                user: playlist.user?.name || playlist.user?.username,
            };

        } catch (error) {
            console.error('❌ SoundCloud getPlaylist error:', error.message);
            return null;
        }
    }

    static async getUserTracks(userUrl, limit = 10, guildId = null) {
        try {
            // play-dl doesn't have direct user track fetching
            // This is a limitation compared to yt-dlp
            console.warn('⚠️ getUserTracks not fully supported with play-dl');
            return [];

        } catch (error) {
            console.error('❌ SoundCloud getUserTracks error:', error.message);
            return [];
        }
    }

    static async formatTrack(soundcloudTrack, guildId = null) {
        try {
            const unknownTitle = guildId ? await LanguageManager.getTranslation(guildId, 'soundcloud.unknown_title') : 'Unknown Title';
            const unknownArtist = guildId ? await LanguageManager.getTranslation(guildId, 'soundcloud.unknown_artist') : 'Unknown Artist';

            const track = {
                title: soundcloudTrack.name || soundcloudTrack.title || unknownTitle,
                artist: soundcloudTrack.user?.name || soundcloudTrack.user?.username || soundcloudTrack.publisher?.name || unknownArtist,
                url: soundcloudTrack.url || soundcloudTrack.permalink,
                duration: soundcloudTrack.durationInSec || 0,
                thumbnail: soundcloudTrack.thumbnail,
                platform: 'soundcloud',
                type: 'track',
                id: soundcloudTrack.id,
                description: soundcloudTrack.description,
                uploadDate: soundcloudTrack.publishedAt,
                viewCount: soundcloudTrack.playCount,
                likeCount: soundcloudTrack.likes,
                channel: soundcloudTrack.user?.name || soundcloudTrack.user?.username,
                channelId: soundcloudTrack.user?.id,
            };

            return track;
        } catch (error) {
            console.error('❌ SoundCloud formatTrack error:', error.message);
            return null;
        }
    }

    static isSoundCloudURL(url) {
        const patterns = [
            /^https?:\/\/(www\.)?soundcloud\.com\/[\w-]+\/[\w-]+/,
            /^https?:\/\/(www\.)?soundcloud\.com\/[\w-]+\/sets\/[\w-]+/,
            /^https?:\/\/(www\.)?soundcloud\.com\/[\w-]+$/,
        ];
        return patterns.some(pattern => pattern.test(url));
    }

    static isPlaylist(url) {
        return url.includes('/sets/');
    }

    static isTrack(url) {
        return this.isSoundCloudURL(url) && !this.isPlaylist(url) && !this.isUser(url);
    }

    static isUser(url) {
        const match = url.match(/^https?:\/\/(www\.)?soundcloud\.com\/([\w-]+)$/);
        return !!match;
    }

    static extractUsername(url) {
        const match = url.match(/^https?:\/\/(www\.)?soundcloud\.com\/([\w-]+)/);
        return match ? match[2] : null;
    }

    static extractTrackSlug(url) {
        const match = url.match(/^https?:\/\/(www\.)?soundcloud\.com\/[\w-]+\/([\w-]+)/);
        return match ? match[2] : null;
    }

    static extractPlaylistSlug(url) {
        const match = url.match(/^https?:\/\/(www\.)?soundcloud\.com\/[\w-]+\/sets\/([\w-]+)/);
        return match ? match[2] : null;
    }

    static async validateUrl(url) {
        try {
            if (!this.isSoundCloudURL(url)) {
                return false;
            }

            const info = await play.soundcloud(url);
            return !!info && !!(info.name || info.title);

        } catch (error) {
            return false;
        }
    }

    static formatDuration(milliseconds) {
        const seconds = Math.floor(milliseconds / 1000);
        const minutes = Math.floor(seconds / 60);
        const remainingSeconds = seconds % 60;

        if (minutes >= 60) {
            const hours = Math.floor(minutes / 60);
            const remainingMinutes = minutes % 60;
            return `${hours}:${remainingMinutes.toString().padStart(2, '0')}:${remainingSeconds.toString().padStart(2, '0')}`;
        } else {
            return `${minutes}:${remainingSeconds.toString().padStart(2, '0')}`;
        }
    }

    static createTrackUrl(username, trackSlug) {
        return `https://soundcloud.com/${username}/${trackSlug}`;
    }

    static createPlaylistUrl(username, playlistSlug) {
        return `https://soundcloud.com/${username}/sets/${playlistSlug}`;
    }

    static createUserUrl(username) {
        return `https://soundcloud.com/${username}`;
    }

    static async getRelatedTracks(trackUrl, limit = 5) {
        try {
            // Not supported by play-dl
            return [];
        } catch (error) {
            return [];
        }
    }

    static async searchAdvanced(query, options = {}, guildId = null) {
        try {
            const { limit = 20 } = options;
            return await this.search(query, limit, guildId);
        } catch (error) {
            return [];
        }
    }
}

module.exports = SoundCloud;
