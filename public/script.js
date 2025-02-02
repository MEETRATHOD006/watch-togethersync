// Import Socket.IO client
const socket = io("https://watch-togethersync.onrender.com"); // Update the URL as per your server

const peers = {}; // Store peer connections
let localStream; // Store the local video stream
let isScreenSharing = false; // Flag to check screen sharing status
let screenStream; // Screen share stream
const startScreenShareBtn = document.getElementById("startScreenShare");
const stopScreenShareBtn = document.getElementById("stopScreenShare");

// Connection established
socket.on("connect", () => {
  console.log("Connected to Socket.IO server with ID:", socket.id);
});


const videoGrid = document.getElementById("displayvideocalls"); 
const video = document.getElementById("video");

// Function to extract room ID from URL
function getRoomIdFromURL() {
  const pathParts = window.location.pathname.split("/");
  return pathParts.length > 1 && pathParts[1] ? pathParts[1] : null;
}

// Room-specific functionality
const roomId = getRoomIdFromURL();

if (roomId) {
  console.log(`Joined room: ${roomId}`);

  
  // Emit join room event
  const participantName = generateRandomName(); // Ensure this function is implemented
  const myPeer = new Peer(undefined, {
    host: 'peerjs-server-gdyx.onrender.com',
    secure: true,
    port: 443,
    path: '/peerjs',
  });


  myPeer.on("open", id => {
    console.log("befor emit join_room")
    socket.emit("join-room", roomId, id);
    console.log("after emit room_join")
  })

  

  // Room-specific UI updates
  updateRoomUI(roomId);
  const myVideo = document.createElement('video');
  myVideo.muted = true;

  navigator.mediaDevices.getUserMedia({
    video: true,
    audio: true
  }).then(stream => {
    addVideoStream(myVideo, stream)

    myPeer.on('call', call => {
      call.answer(stream)
      const video = document.createElement('video')
      call.on('stream', userVideoStream => {
        addVideoStream(video, userVideoStream)
      })
    })
    
    // Listen for new user joining the room
    socket.on("user-connected", userId => {
      if (userId !== myPeer.id) {  // Check if the userId is not the same as the current user's ID
        connectToNewUser(userId, stream);
      }
      displayNotification(`${userId} has joined the room.`);
    });
  })

  socket.on('user-disconnected', userId => {
    console.log("User disconnected:", { roomId, userId }); // Debugging
    if (peers[userId]) {
      peers[userId].close();
      delete peers[userId];
    }
    const individualsVideo = document.querySelector(`.individualsVideo[data-user-id="${userId}"]`);
    if (individualsVideo) {
      individualsVideo.remove();
      displayNotification(`${userId} has left the room.`);
    }
  })

function connectToNewUser(userId, stream) {
  const call = myPeer.call(userId, stream);
  const userVideo = document.createElement('video');

  call.on('stream', userStream => {
    addVideoStream(userVideo, userStream, userId);
  });

  call.on('close', () => {
    userVideo.remove();
    const wrapper = document.querySelector(`[data-user-id="${userId}"]`);
    if (wrapper) wrapper.remove();
  });

  peers[userId] = call;
}
  
// Improved addVideoStream function
function addVideoStream(videoElement, stream, userId) {
  videoElement.srcObject = stream;
  videoElement.playsInline = true;

  // Detect screen shares by track label
  const isScreenShare = stream.getVideoTracks().some(track => 
    track.label.toLowerCase().includes('screen')
  );

  const videoContainer = document.getElementById("video");
  const participantGrid = document.getElementById("displayvideocalls");

  videoElement.addEventListener('loadedmetadata', () => {
    videoElement.play().catch(err => console.error("Video play failed:", err));
  });

  if (isScreenShare) {
    // Screen share handling
    const existingScreen = videoContainer.querySelector('.shared-screen');
    if (existingScreen) existingScreen.remove();

    videoElement.classList.add('shared-screen');
    videoElement.id = 'shared-screen-video';
    videoContainer.innerHTML = ''; // Clear previous content
    videoContainer.appendChild(videoElement);
  } else {
    // Regular video handling
    const wrapper = document.createElement('div');
    wrapper.className = 'individualsVideo';
    wrapper.dataset.userId = userId;
    wrapper.appendChild(videoElement);
    participantGrid.appendChild(wrapper);
  }
}
// Improved screen sharing logic
async function startScreenShare() {
  try {
    screenStream = await navigator.mediaDevices.getDisplayMedia({
      video: true,
      audio: false
    });

    isScreenSharing = true;
    const screenTrack = screenStream.getVideoTracks()[0];

    // Replace video track in all peer connections
    Object.values(peers).forEach(peerConnection => {
      const videoSender = peerConnection.peerConnection
        .getSenders()
        .find(s => s.track?.kind === 'video');
      if (videoSender) videoSender.replaceTrack(screenTrack);
    });

    // Handle local display
    const screenVideo = document.createElement('video');
    screenVideo.muted = true;
    addVideoStream(screenVideo, screenStream, 'screen-share');

    // Handle screen share termination
    screenTrack.onended = () => stopScreenShare();

    // UI updates
    document.getElementById('startScreenShare').disabled = true;
    document.getElementById('stopScreenShare').disabled = false;

  } catch (error) {
    console.error('Screen share error:', error);
    displayNotification('Screen sharing failed or was cancelled');
  }
}

 // Improved screen share cleanup
function stopScreenShare() {
  if (!isScreenSharing) return;

  // Restore original video track
  const originalVideoTrack = localStream.getVideoTracks()[0];
  Object.values(peers).forEach(peerConnection => {
    const videoSender = peerConnection.peerConnection
      .getSenders()
      .find(s => s.track?.kind === 'video');
    if (videoSender) videoSender.replaceTrack(originalVideoTrack);
  });

  // Clean up screen elements
  const screenElement = document.getElementById('shared-screen-video');
  if (screenElement) screenElement.remove();

  // Stop screen stream
  screenStream.getTracks().forEach(track => track.stop());
  isScreenSharing = false;

  // UI updates
  document.getElementById('startScreenShare').disabled = false;
  document.getElementById('stopScreenShare').disabled = true;
}


// Event listeners
startScreenShareBtn.addEventListener('click', startScreenShare);
stopScreenShareBtn.addEventListener('click', stopScreenShare);

// Initialize local video
navigator.mediaDevices.getUserMedia({ video: true, audio: true })
  .then(stream => {
    localStream = stream;
    const selfVideo = document.createElement('video');
    selfVideo.muted = true;
    addVideoStream(selfVideo, stream, 'self');
  });


  // Listen for screen share track information from other users
    socket.on("screen-share-started", (roomId, trackInfo) => {
    // Reconstruct the MediaStream from the track info
    navigator.mediaDevices.enumerateDevices().then(devices => {
      const videoDevice = devices.find(device => device.kind === 'videoinput');
      
      if (videoDevice) {
        // Get the MediaStream for the specific device (only if needed)
        navigator.mediaDevices.getUserMedia({ video: { deviceId: videoDevice.deviceId } })
          .then(userStream => {
            const mediaStream = new MediaStream();
            
            // Instead of matching by trackId, match by kind or label
            const videoTrack = userStream.getVideoTracks().find(track => {
              // Match track based on kind or label
              return track.kind === trackInfo.kind || track.label === trackInfo.label;
            });
            console.log("videoTrack", videoTrack);
            if (videoTrack) {
              mediaStream.addTrack(videoTrack); // Add the track to the stream
  
              // Create a video element for the screen share
              const screenVideo = document.createElement('video');
              screenVideo.srcObject = mediaStream;
              screenVideo.muted = true;
              screenVideo.classList.add('sharedScreen');
              screenVideo.id = "videoPlayer";  // Optional: Assign an ID for the video element
  
              console.log(screenVideo); // Confirm the video element is created
  
              // Append to the video element with id="video"
              const videoElement = document.getElementById("video");
              if (videoElement) {
                videoElement.append(screenVideo); // Append inside the #video div
                screenVideo.play();
              }
            } else {
              console.error("No matching video track found.");
            }
          })
          .catch((err) => {
            console.error("Error accessing the video device for screen share:", err);
          });
      }
    });
  });


} else {
  console.log("No room detected in the URL. Displaying default interface.");
}


// Helper: Update room-specific UI
function updateRoomUI(roomId) {
  const createJoinBtnDiv = document.querySelector(".creatJoinBtn");
  createJoinBtnDiv.innerHTML = `
    <span id="roomIdDisplay">Room ID: ${roomId}</span>
    <i class="fa-solid fa-copy" id="copyRoomId" style="cursor: pointer; color: yellow;"></i>
  `;

  // Enable copying Room ID
  document.getElementById("copyRoomId").addEventListener("click", () => {
    navigator.clipboard.writeText(roomId).then(() => {
      const copyMessage = document.createElement("div");
      copyMessage.textContent = "Room ID copied to clipboard!";
      copyMessage.style.position = "fixed";
      copyMessage.style.bottom = "20px";
      copyMessage.style.right = "20px";
      copyMessage.style.backgroundColor = "#4CAF50";
      copyMessage.style.color = "#fff";
      copyMessage.style.padding = "10px";
      copyMessage.style.borderRadius = "5px";
      document.body.appendChild(copyMessage);
      setTimeout(() => copyMessage.remove(), 3000);
    });
  });
}

// Helper: Display notification
function displayNotification(message) {
  const notification = document.createElement("div");
  notification.textContent = message;
  notification.style.position = "fixed";
  notification.style.top = "10px";
  notification.style.right = "10px";
  notification.style.backgroundColor = "#f0ad4e";
  notification.style.color = "#fff";
  notification.style.padding = "10px";
  notification.style.borderRadius = "5px";
  document.body.appendChild(notification);
  setTimeout(() => notification.remove(), 3000);
}


// Display Local Video
// 📌 CREATE ROOM EVENT LISTENER
const createRoomButton = document.getElementById("create");
const createRoomPopup = document.getElementById("createRoomPopup");
const createRoomConfirmButton = document.getElementById("createRoomConfirm");
const closeCreateRoomPopupButton = document.getElementById("closeCreateRoomPopup");

// Show Room Creation Popup
createRoomButton.addEventListener("click", () => {
  createRoomPopup.style.display = "grid"; // Show the popup
});

// Room Creation
async function createRoom() {
  const roomName = document.getElementById("roomName").value.trim();
  const adminName = document.getElementById("adminName").value.trim();
  if (!roomName || !adminName) {
    alert("Please enter both Room Name and Admin Name.");
    return;
  }

  const roomId = generateRoomId();

  try {
    const response = await fetch("/create_room", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ room_id: roomId, room_name: roomName, admin_name: adminName }),
    });

    if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
    const data = await response.json();

    if (data.message === "Room created successfully") {
      window.location.href = `/${roomId}`; // Redirect to room
    }
  } catch (error) {
    console.error("Error creating room:", error);
  }
}

// Confirm Room Creation
createRoomConfirmButton.addEventListener("click", createRoom);

/**
 * Update UI after room creation
 */
function updateUIAfterRoomCreation(roomId) {
  // Replace buttons with room details
  const createJoinBtnDiv = document.querySelector(".creatJoinBtn");
  createJoinBtnDiv.innerHTML = `
    <span id="roomIdDisplay">Room ID: ${roomId}</span>
    <i class="fa-solid fa-copy" id="copyRoomId" style="cursor: pointer; color: yellow;"></i>
  `;

  // Enable copying Room ID
  document.getElementById("copyRoomId").addEventListener("click", () => {
            navigator.clipboard.writeText(roomId).then(() => {
              // Toast-style notification
              const copyMessage = document.createElement("div");
              copyMessage.textContent = "Room ID copied to clipboard!";
              copyMessage.style.position = "fixed";
              copyMessage.style.bottom = "20px";
              copyMessage.style.right = "20px";
              copyMessage.style.backgroundColor = "#4CAF50";
              copyMessage.style.color = "#fff";
              copyMessage.style.padding = "10px";
              copyMessage.style.borderRadius = "5px";
              document.body.appendChild(copyMessage);
              setTimeout(() => copyMessage.remove(), 3000);
            });
          });

  // Clear and hide popup
  createRoomPopup.style.display = "none";
  document.getElementById("roomName").value = "";
  document.getElementById("adminName").value = "";
}

closeCreateRoomPopupButton.addEventListener("click", () => {
  createRoomPopup.style.display = "none"; // Close the create room popup
  document.getElementById("roomName").value = "";
  document.getElementById("adminName").value = "";
});


// 📌 JOIN ROOM POPUP HANDLER
const joinButton = document.getElementById("join");
const joinPopup = document.getElementById("join-popup");
const closePopupButton = document.getElementById("closePopup");
const joinRoomButton = document.getElementById("joinRoom");
const joinRoomIdInput = document.getElementById("joinRoomId");
const joinErrorText = document.getElementById("joinError");

// Show Join Popup
joinButton.addEventListener("click", () => {
  joinPopup.style.display = "grid";
});

// Close Join Popup
closePopupButton.addEventListener("click", () => {
  joinPopup.style.display = "none";
  joinErrorText.style.display = "none";
  joinRoomIdInput.value = "";
});

// Join Room
async function joinRoom(roomId, participantName) {
  try {
    const response = await fetch("/join_room", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ room_id: roomId, participant_name: participantName }),
    });

    if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
    const data = await response.json();

    if (data.message === "Joined room successfully") {
      socket.emit("join_room", { room_id: roomId, participant_name: participantName });
      window.location.href = `/${roomId}`;
    }
  } catch (error) {
    console.error("Error joining room:", error);
  }
}

// Handle join room button
joinRoomButton.addEventListener("click", async () => {
  const roomId = joinRoomIdInput.value.trim();

  // Validation
  if (!roomId) {
    joinErrorText.textContent = "Please enter a Room ID.";
    joinErrorText.style.display = "block";
    return;
  }

  const participantName = generateRandomName(); // Ensure this function is implemented
  joinErrorText.style.display = "none"; // Clear any previous error message
  joinRoom(roomId, participantName); // Ensure implementation exists
  joinPopup.style.display = "none";
  joinRoomIdInput.value = "";
});

// 📌 Utility Function: Copy to Clipboard
function copyToClipboard(text) {
  navigator.clipboard
    .writeText(text)
    .then(() => alert("Room ID copied to clipboard!"))
    .catch((err) => console.error("Error copying text:", err));
}


// 📌 Generate Random Room ID
function generateRoomId() {
  return Math.random().toString(36).substr(2, 9); // Random 9 character ID
}

function generateRandomName() {
  const adjectives = ["Quick", "Bright", "Brave", "Calm", "Sharp", "Wise"];
  const nouns = ["Lion", "Tiger", "Falcon", "Eagle", "Wolf", "Bear"];
  return `${adjectives[Math.floor(Math.random() * adjectives.length)]} ${
    nouns[Math.floor(Math.random() * nouns.length)]
  }`;
}
