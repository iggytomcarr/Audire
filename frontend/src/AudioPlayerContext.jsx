import React, { createContext, useContext, useState, useRef, useEffect } from 'react';

const AudioPlayerContext = createContext();

export function AudioPlayerProvider({ children }) {
    const [currentTrack, setCurrentTrack] = useState(null);
    const [isPlaying, setIsPlaying] = useState(false);
    const [currentTime, setCurrentTime] = useState(0);
    const [duration, setDuration] = useState(0);
    const [volume, setVolume] = useState(0.7);

    // Web Audio API nodes
    const audioContextRef = useRef(null);
    const sourceNodeRef = useRef(null);
    const gainNodeRef = useRef(null);
    const analyserNodeRef = useRef(null);
    
    // HTML Audio element (we still need this for easier playback control)
    const audioElementRef = useRef(null);

    // Initialize Audio Context and nodes
    useEffect(() => {
        audioContextRef.current = new (window.AudioContext || window.webkitAudioContext)();
        analyserNodeRef.current = audioContextRef.current.createAnalyser();
        gainNodeRef.current = audioContextRef.current.createGain();
        
        analyserNodeRef.current.fftSize = 2048;
        gainNodeRef.current.gain.value = volume;
        
        // Create audio element
        audioElementRef.current = new Audio();
        
        return () => {
            if (audioContextRef.current) {
                audioContextRef.current.close();
            }
        };
    }, []);

    // Update volume when it changes
    useEffect(() => {
        if (gainNodeRef.current) {
            gainNodeRef.current.gain.value = volume;
        }
    }, [volume]);

    // Track time updates
    useEffect(() => {
        const audio = audioElementRef.current;
        if (!audio) return;

        const updateTime = () => setCurrentTime(audio.currentTime);
        const updateDuration = () => setDuration(audio.duration);
        const handleEnded = () => {
            setIsPlaying(false);
            // TODO: Auto-play next track
        };

        audio.addEventListener('timeupdate', updateTime);
        audio.addEventListener('loadedmetadata', updateDuration);
        audio.addEventListener('ended', handleEnded);

        return () => {
            audio.removeEventListener('timeupdate', updateTime);
            audio.removeEventListener('loadedmetadata', updateDuration);
            audio.removeEventListener('ended', handleEnded);
        };
    }, []);

    const playTrack = async (track) => {
    console.log('playTrack called with:', track);
    
    const audio = audioElementRef.current;
    const audioContext = audioContextRef.current;
    
    console.log('Audio element:', audio);
    console.log('Audio context state:', audioContext.state);
    
    // Resume audio context (required by browsers)
    if (audioContext.state === 'suspended') {
        console.log('Resuming audio context...');
        await audioContext.resume();
    }

    // If switching tracks, load new track
    if (!currentTrack || currentTrack.filePath !== track.filePath) {
        console.log('Loading new track:', track.streamURL);
        audio.src = track.streamURL;
        audio.crossOrigin = "anonymous";  // Critical for CORS!
        setCurrentTrack(track);
        
        // Connect audio element to Web Audio API ONCE
        if (!sourceNodeRef.current) {
            console.log('Creating MediaElementSource...');
            sourceNodeRef.current = audioContext.createMediaElementSource(audio);
            sourceNodeRef.current
                .connect(gainNodeRef.current)
                .connect(analyserNodeRef.current)
                .connect(audioContext.destination);
            console.log('Audio nodes connected');
        }
    }

    console.log('Attempting to play...');
    await audio.play();
    setIsPlaying(true);
    console.log('Playback started!');
};

    const pause = () => {
        audioElementRef.current?.pause();
        setIsPlaying(false);
    };

    const togglePlayPause = () => {
        if (isPlaying) {
            pause();
        } else if (currentTrack) {
            playTrack(currentTrack);
        }
    };

    const seek = (time) => {
        if (audioElementRef.current) {
            audioElementRef.current.currentTime = time;
            setCurrentTime(time);
        }
    };

    const value = {
        currentTrack,
        isPlaying,
        currentTime,
        duration,
        volume,
        setVolume,
        playTrack,
        pause,
        togglePlayPause,
        seek,
        analyserNode: analyserNodeRef.current, // For visualization
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