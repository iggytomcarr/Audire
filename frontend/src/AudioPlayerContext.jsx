import React, { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import { GetMediaBaseURL } from '../wailsjs/go/main/App';

const AudioPlayerContext = createContext();

export function AudioPlayerProvider({ children }) {
    const [queue, setQueue] = useState([]);
    const [index, setIndex] = useState(-1);
    const [isPlaying, setIsPlaying] = useState(false);
    const [isLoading, setIsLoading] = useState(false);
    const [currentTime, setCurrentTime] = useState(0);
    const [duration, setDuration] = useState(0);
    const [volume, setVolume] = useState(0.7);
    const [error, setError] = useState(null);
    const [durations, setDurations] = useState({}); // track path -> seconds, learned as tracks load
    const [mediaBaseURL, setMediaBaseURL] = useState("");

    // Web Audio API nodes
    const audioContextRef = useRef(null);
    const sourceNodeRef = useRef(null);
    const gainNodeRef = useRef(null);
    const analyserNodeRef = useRef(null);

    // HTML Audio element (we still need this for easier playback control)
    const audioElementRef = useRef(null);
    const queueRef = useRef([]);
    const indexRef = useRef(-1);

    const currentTrack = index >= 0 ? queue[index] || null : null;

    useEffect(() => {
        GetMediaBaseURL().then(setMediaBaseURL).catch((err) => console.error("Failed to get media URL:", err));

        const audio = new Audio();
        audio.crossOrigin = "anonymous"; // Required to route the stream through Web Audio
        audio.preload = "auto";
        audioElementRef.current = audio;
        return () => {
            audio.pause();
            audio.removeAttribute("src");
            audioContextRef.current?.close();
        };
    }, []);

    const mediaURL = useCallback(
        (kind, path) => (mediaBaseURL && path ? `${mediaBaseURL}/${kind}?path=${encodeURIComponent(path)}` : null),
        [mediaBaseURL]
    );
    const coverURL = useCallback((path) => mediaURL("cover", path), [mediaURL]);

    // Create the Web Audio graph on demand (first play, or when the visualiser needs it).
    // It starts suspended until playback resumes it from a user gesture.
    const getAudioGraph = () => {
        if (!audioContextRef.current && audioElementRef.current) {
            const ctx = new (window.AudioContext || window.webkitAudioContext)();
            analyserNodeRef.current = ctx.createAnalyser();
            analyserNodeRef.current.fftSize = 2048;
            gainNodeRef.current = ctx.createGain();
            gainNodeRef.current.gain.value = volume;
            sourceNodeRef.current = ctx.createMediaElementSource(audioElementRef.current);
            sourceNodeRef.current
                .connect(gainNodeRef.current)
                .connect(analyserNodeRef.current)
                .connect(ctx.destination);
            audioContextRef.current = ctx;
        }
        // The source node is tapped before the volume control so visuals don't fade with volume
        return { audioContext: audioContextRef.current, sourceNode: sourceNodeRef.current };
    };

    const ensureAudioGraph = async () => {
        getAudioGraph();
        if (audioContextRef.current.state === "suspended") {
            await audioContextRef.current.resume();
        }
    };

    // Update volume when it changes
    useEffect(() => {
        if (gainNodeRef.current) {
            gainNodeRef.current.gain.value = volume;
        }
    }, [volume]);

    const loadAndPlay = async (i) => {
        const track = queueRef.current[i];
        const audio = audioElementRef.current;
        if (!track || !audio) return;

        indexRef.current = i;
        setIndex(i);
        setError(null);
        setCurrentTime(0);
        setDuration(0);
        setIsLoading(true);

        await ensureAudioGraph();
        audio.src = mediaURL("audio", track.path);
        try {
            await audio.play();
        } catch (err) {
            // AbortError just means another track was picked before this one started
            if (err.name !== "AbortError") {
                console.error("Playback failed:", err);
            }
        }
    };

    const playQueue = (tracks, startIndex = 0) => {
        queueRef.current = tracks;
        setQueue(tracks);
        loadAndPlay(startIndex);
    };

    const next = () => {
        if (indexRef.current + 1 < queueRef.current.length) {
            loadAndPlay(indexRef.current + 1);
        }
    };

    const previous = () => {
        const audio = audioElementRef.current;
        if (audio && audio.currentTime > 3) {
            audio.currentTime = 0;
        } else if (indexRef.current > 0) {
            loadAndPlay(indexRef.current - 1);
        } else if (audio) {
            audio.currentTime = 0;
        }
    };

    const pause = () => audioElementRef.current?.pause();

    const togglePlayPause = async () => {
        const audio = audioElementRef.current;
        if (!audio || indexRef.current < 0) return;
        if (audio.paused) {
            await ensureAudioGraph();
            audio.play().catch((err) => console.error("Playback failed:", err));
        } else {
            audio.pause();
        }
    };

    const seek = (time) => {
        if (audioElementRef.current) {
            audioElementRef.current.currentTime = time;
            setCurrentTime(time);
        }
    };

    // Audio element events drive the UI state
    useEffect(() => {
        const audio = audioElementRef.current;
        if (!audio) return;

        const onTime = () => setCurrentTime(audio.currentTime);
        const onMeta = () => {
            setDuration(audio.duration);
            const track = queueRef.current[indexRef.current];
            if (track && Number.isFinite(audio.duration)) {
                setDurations((prev) => ({ ...prev, [track.path]: audio.duration }));
            }
        };
        const onPlaying = () => {
            setIsPlaying(true);
            setIsLoading(false);
        };
        const onPause = () => setIsPlaying(false);
        const onWaiting = () => setIsLoading(true);
        const onEnded = () => {
            if (indexRef.current + 1 < queueRef.current.length) {
                loadAndPlay(indexRef.current + 1);
            } else {
                setIsPlaying(false);
                audio.currentTime = 0;
            }
        };
        const onError = () => {
            if (!audio.getAttribute("src")) return;
            const track = queueRef.current[indexRef.current];
            setIsLoading(false);
            setIsPlaying(false);
            setError(`Couldn't play "${track?.title || "track"}"`);
            // Skip past files the player can't decode, unless the user has moved on already
            const failed = indexRef.current;
            if (failed + 1 < queueRef.current.length) {
                setTimeout(() => {
                    if (indexRef.current === failed) loadAndPlay(failed + 1);
                }, 1500);
            }
        };

        audio.addEventListener('timeupdate', onTime);
        audio.addEventListener('loadedmetadata', onMeta);
        audio.addEventListener('durationchange', onMeta);
        audio.addEventListener('playing', onPlaying);
        audio.addEventListener('pause', onPause);
        audio.addEventListener('waiting', onWaiting);
        audio.addEventListener('ended', onEnded);
        audio.addEventListener('error', onError);
        return () => {
            audio.removeEventListener('timeupdate', onTime);
            audio.removeEventListener('loadedmetadata', onMeta);
            audio.removeEventListener('durationchange', onMeta);
            audio.removeEventListener('playing', onPlaying);
            audio.removeEventListener('pause', onPause);
            audio.removeEventListener('waiting', onWaiting);
            audio.removeEventListener('ended', onEnded);
            audio.removeEventListener('error', onError);
        };
    });

    // Space toggles playback; media keys work through the Media Session API
    useEffect(() => {
        const onKey = (e) => {
            if (e.code !== "Space" || e.target.closest?.("textarea, select, input:not([type=range])")) return;
            e.preventDefault();
            togglePlayPause();
        };
        window.addEventListener("keydown", onKey);

        if ("mediaSession" in navigator) {
            navigator.mediaSession.setActionHandler("play", togglePlayPause);
            navigator.mediaSession.setActionHandler("pause", pause);
            navigator.mediaSession.setActionHandler("nexttrack", next);
            navigator.mediaSession.setActionHandler("previoustrack", previous);
        }
        return () => window.removeEventListener("keydown", onKey);
    });

    useEffect(() => {
        if (!("mediaSession" in navigator) || !currentTrack) return;
        const artwork = currentTrack.cover ? [{ src: coverURL(currentTrack.cover) }] : [];
        navigator.mediaSession.metadata = new window.MediaMetadata({
            title: currentTrack.title,
            artist: currentTrack.artist,
            album: currentTrack.album,
            artwork,
        });
    }, [currentTrack, coverURL]);

    const value = {
        queue,
        currentTrack,
        isPlaying,
        isLoading,
        currentTime,
        duration,
        durations,
        volume,
        error,
        setVolume,
        playQueue,
        pause,
        togglePlayPause,
        next,
        previous,
        seek,
        coverURL,
        queueIndex: index,
        hasNext: index + 1 < queue.length,
        hasPrevious: index >= 0,
        analyserNode: analyserNodeRef.current, // For visualization
        getAudioGraph,
    };

    return (
        <AudioPlayerContext.Provider value={value}>
            {children}
        </AudioPlayerContext.Provider>
    );
}

export function useAudioPlayer() {
    const context = useContext(AudioPlayerContext);
    if (!context) {
        throw new Error('useAudioPlayer must be used within AudioPlayerProvider');
    }
    return context;
}

export function formatTime(seconds) {
    if (!Number.isFinite(seconds) || seconds < 0) return "0:00";
    const s = Math.floor(seconds);
    const h = Math.floor(s / 3600);
    const m = Math.floor((s % 3600) / 60);
    const sec = String(s % 60).padStart(2, "0");
    return h > 0 ? `${h}:${String(m).padStart(2, "0")}:${sec}` : `${m}:${sec}`;
}
