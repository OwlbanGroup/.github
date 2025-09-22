// Music Editor JavaScript
class MusicEditor {
    constructor() {
        this.audioContext = null;
        this.audioBuffer = null;
        this.source = null;
        this.gainNode = null;
        this.analyser = null;
        this.isPlaying = false;
        this.startTime = 0;
        this.pauseTime = 0;
        this.currentTrack = null;
        this.tracks = new Map();
        this.effects = {
