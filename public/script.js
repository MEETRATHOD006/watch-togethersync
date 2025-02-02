// Import Socket.IO client
const socket = io("https://watch-togethersync.onrender.com"); // Update the URL as per your server

import 'reflect-metadata';
import { plainToInstance, instanceToPlain } from 'class-transformer';

const peers = {}; // Store peer connections
let localStream; // Store the local video stream
let isScreenSharing = false; // Flag to check screen sharing status
let screenStream = null;
const startScreenShareBtn = document.getElementById("startScreenShare");
const stopScreenShareBtn = document.getElementById("stopScreenShare");

// Connection established
socket.on("connect", () => {
  console.log("Connected to Socket.IO server with ID:", socket.id);
});


const videoGrid = document.getElementById("displayvideocalls"); 
const videoEle = document.getElementById("video");

// Function to extract room ID from URL
function getRoomIdFromURL() {
  const pathParts = window.location.pathname.split("/");
  return pathParts.length > 1 && pathParts[1] ? pathParts[1] : null;
}

function toPlainObject(obj) {
  return { ...obj, __type: obj.constructor.name }; // Add type metadata
}

// Restore from plain object
function fromPlainObject(obj, typeMap) {
    if (obj.__type && typeMap[obj.__type]) {
        const instance = Object.assign(new typeMap[obj.__type](), obj);
        delete instance.__type; // Remove metadata after restoration
        return instance;
    }
    return obj; // Return as-is if no matching type
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

  function connectToNewUser(userId, stream){
    const call = myPeer.call(userId, stream);
    const video = document.createElement('video');
    call.on("stream", userVideoStream => {
      addVideoStream(video, userVideoStream, userId);
    })
    call.on('close', () => {
       const individualsVideo = document.querySelector(`.individualsVideo[data-user-id="${userId}"]`);
      if (individualsVideo) {
        individualsVideo.remove();
      }
      video.remove()
    })

    peers[userId] = call
    console.log(peers);
  }
  
  function addVideoStream(video, stream, userId) {
    video.srcObject = stream;
    video.addEventListener('loadedmetadata', () => {
      video.play();
    });

    console.log('addVideoStream userId', userId)

    // Check if the video already exists in the videoGrid to avoid duplicates and empty divs
    if (![...videoGrid.getElementsByTagName('video')].some(v => v.srcObject === stream)) {
      const individualsVideo = document.createElement('div');
      individualsVideo.classList.add('individualsVideo');
      individualsVideo.setAttribute("data-user-id", userId);
      videoGrid.append(individualsVideo);
      individualsVideo.append(video);
    }
  }

startScreenShareBtn.addEventListener("click", () => {
  if (isScreenSharing) return;

  navigator.mediaDevices.getDisplayMedia({ video: true, audio: false })
    .then((screenStream) => {
      isScreenSharing = true;
      const screenTrack = screenStream.getVideoTracks()[0];

      // Replace video track in all existing connections
      for (const connId in myPeer.connections) {
        const sender = myPeer.connections[connId][0].peerConnection
          .getSenders()
          .find((s) => s.track?.kind === "video");

        if (sender) sender.replaceTrack(screenTrack);
      }
      console.log(myPeer.id)
      
      // Notify others about screen share with YOUR user ID
      let screenStreamPlain = instanceToPlain(screenStream);
      console.log(screenStreamPlain);
      socket.emit("screen-share-start", roomId, myPeer.id, screenStreamPlain); // 👈 Send user ID

      // Display screen locally in #video
      const videoElement = document.getElementById("videoPlayer");
      videoElement.innerHTML = ""; // Clear previous content
      const screenVideo = document.createElement("video");
      screenVideo.srcObject = screenStream;
      screenVideo.autoplay = true;
      screenVideo.muted = true;
      videoElement.appendChild(screenVideo);
    });
});

// Stop screen sharing
stopScreenShareBtn.addEventListener("click", stopScreenShare);
  
function stopScreenShare() {
  if (!isScreenSharing) return;

  // Restore original video track
  const videoTrack = localStream.getVideoTracks()[0];
  for (const connId in myPeer.connections) {
    const sender = myPeer.connections[connId][0].peerConnection
      .getSenders()
      .find((s) => s.track?.kind === "video");
    if (sender) sender.replaceTrack(videoTrack);
  }

  // Notify others
  socket.emit("screen-share-stop", roomId, myPeer.id); // 👈 Send user ID

  // Clear local #video element
  isScreenSharing = false;
}
  
// When someone starts screen sharing
socket.on("screen-share-started", (sharedUserId, screenStream) => {
  // Find their video element in the grid
  // const sharedVideoElement = document.querySelector(
  //   `.individualsVideo[data-user-id="${sharedUserId}"] video`
  // );
  
  // console.log(sharedVideoElement.srcObject)

  let bigScreen = document.querySelector('#videoPlayer video')
  console.log(screenStream);
  screenStreamC = plainToInstance(MediaStream, screenStream);
  bigScreen.srcObject = screenStreamC;
  bigScreen.play();
});

// When screen sharing stops
socket.on("screen-share-stopped", (sharerUserId) => {
  const videoContainer = document.getElementById("video");
  videoContainer.innerHTML = ""; // Clear the screen share
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
