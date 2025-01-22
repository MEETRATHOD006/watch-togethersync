// public/videoPlayer.js

const videoPlayer = document.getElementById('videoPlayer');

// Emit video events
videoPlayer.addEventListener('play', () => {
    socket.emit('video-sync', { 
        roomId: roomIdInput?.value || 'default', 
        currentTime: videoPlayer.currentTime, 
        isPlaying: true 
    });
});

videoPlayer.addEventListener('pause', () => {
    socket.emit('video-sync', { 
        roomId: roomIdInput?.value || 'default', 
        currentTime: videoPlayer.currentTime, 
        isPlaying: false 
    });
});

// Listen for video updates
socket.on('video-update', ({ currentTime, isPlaying }) => {
    videoPlayer.currentTime = currentTime;
    if (isPlaying) {
        videoPlayer.play();
    } else {
        videoPlayer.pause();
    }
});
