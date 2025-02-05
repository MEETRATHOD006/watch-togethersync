// Import Socket.IO client
const socket = io("https://watch-togethersync.onrender.com"); // Update the URL as per your server

const peers = {}; // Store peer connections
let myPeerId = null;  // Store the peer ID
let localStream; // Store the local video stream
let isScreenSharing = false; // Flag to check screen sharing status
const startScreenShareBtn = document.getElementById("startScreenShare");
const stopScreenShareBtn = document.getElementById("stopScreenShare");
const videoCallsbtn = document.getElementById("videocalls");
const chatsbtn = document.getElementById("chats");
const displayvideocallsDiv = document.getElementById("displayvideocalls");
const chatsHereDiv = document.getElementById("chatsHere");
const mainChatDiv = document.getElementById("mainChat");
const senderNameInput = document.getElementById("senderName");
const messageInput = document.getElementById("message");
const sendBtn = document.getElementById("sendbtn");
const photoInput = document.getElementById("photoInput");
const sendPhotoBtn = document.getElementById("sendPhotoBtn");
const muteMe = document.getElementById("mute");
const hideV = document.getElementById("hideV");
console.log(muteMe)
console.log(hideV)

videoCallsbtn.addEventListener("click", () => {
  console.log("videoCall clicked");
  displayvideocallsDiv.style.display = 'grid';
  chatsHereDiv.style.display = 'none';
  // videoCallsbtn.style.backgroundColor = 'rgba(117, 117, 117, 0.342)';
  // chatsbtn.style.backgroundColor = 'rgba(0, 0, 0, 0)';
  videoCallsbtn.style.borderBottom = "2px solid orange";
  chatsbtn.style.borderBottom = "0px solid orange";
});

chatsbtn.addEventListener("click", () => {
  console.log("chats clicked");
  chatsHereDiv.style.display = 'flex';
  displayvideocallsDiv.style.display = 'none';
  mainChatDiv.scrollTop = mainChatDiv.scrollHeight;
  // chatsbtn.style.backgroundColor = 'rgba(117, 117, 117, 0.342)';
  // videoCallsbtn.style.backgroundColor = 'rgba(0, 0, 0, 0)';
  chatsbtn.style.borderBottom = "2px solid orange";
  videoCallsbtn.style.borderBottom = "0px solid orange";
});

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

// Room-specific functionality
const roomId = getRoomIdFromURL();

if (roomId) {
  console.log(`Joined room: ${roomId}`);

  // Fetch chat history for the room
  fetch(`/messages/${roomId}`)
  .then(response => response.json())
  .then(messages => {
    messages.forEach(msg => {
      if (msg.photo_url) {
        // If a photo URL exists, use the photo appending function.
        appendPhotoMessage(msg.sender, msg.photo_url, msg.timestamp, "not me", msg.message);
      } else {
        appendMessage(msg.sender, msg.message, msg.timestamp, "not me");
      }
    });
  })
  .catch(err => console.error("Error fetching messages:", err));

  
  // Emit join room event
  const participantName = generateRandomName(); // Ensure this function is implemented
  const myPeer = new Peer(undefined, {
    host: 'peerjs-server-gdyx.onrender.com',
    secure: true,
    port: 443,
    path: '/peerjs',
  });


  // Room-specific UI updates
  updateRoomUI(roomId);
  const myVideo = document.createElement('video');
  myVideo.muted = true;

  navigator.mediaDevices.getUserMedia({
    video: true,
    audio: true
  }).then(stream => {
    localStream = stream;
    myPeer.on("open", id => {
      myPeerId = id;
      console.log("My Peer ID:", myPeerId);
      socket.emit("join-room", roomId, myPeerId);
      addVideoStream(myVideo, stream, myPeerId);  // Now pass the correct ID
    });
  

    myPeer.on('call', call => {
      call.answer(stream)
      const video = document.createElement('video')
      call.on('stream', userVideoStream => {
        const remoteUserId = call.peer || "unknown";
        addVideoStream(video, userVideoStream, remoteUserId);
        // When a new user joins and there is an active screen share, this event is triggered
        socket.on("active-screen-share", (sharedUserId) => {
          console.log("Active screen share detected from user:", sharedUserId);
          // You can use the same code you use for "screen-share-started"
          const sharedVideoElement = document.querySelector(
            `.individualsVideo[data-user-id="${sharedUserId}"] video`
          );

          console.log(sharedVideoElement);
          if (sharedVideoElement){
            let bigScreen = document.querySelector('#videoPlayer video')
            bigScreen.srcObject = sharedVideoElement.srcObject;
            bigScreen.play();
            startScreenShareBtn.disabled = true;
            stopScreenShareBtn.disabled = true;
            console.log(sharedVideoElement.srcObject)
          } else {
            console.log("dfgfdgdfh")
          }
        
          
        });
      })
    })
    
    // Listen for new user joining the room
    socket.on("user-connected", userId => {
      if (userId !== myPeerId) {  // Check if the userId is not the same as the current user's ID
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
  
  function addVideoStream(video, stream, userId = myPeerId) {

    if (document.querySelector(`.individualsVideo[data-user-id="${userId}"]`)) {
      console.log(`Video element for user ${userId} already exists.`);
      return;
    }
    
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
      const blankProfilePic = document.createElement('img');
      blankProfilePic.classList.add("blankProfilePic");
      blankProfilePic.src = "/blank-profile-picture.webp"
      blankProfilePic .setAttribute("data-user-id", userId);
      individualsVideo.append(blankProfilePic)
    }
  }

  muteMe.addEventListener("click", () => {
    console.log("mute clicked");
    if (muteMe.className === "on"){
      muteMe.innerHTML = `<i class="fa-solid fa-volume-xmark"></i>`
      muteMe.classList.remove("on");
      muteMe.classList.add("off");

      socket.emit("mute-user", roomId, myPeerId);
    } else {
      muteMe.innerHTML = `<i class="fa-solid fa-volume-high"></i>`
      muteMe.classList.remove("off");
      muteMe.classList.add("on");
      
      socket.emit("unmute-user", roomId, myPeerId);
    }
  });

  socket.on("user-muted", (roomId, userPeerId) => {
    if (userPeerId !== myPeerId) {
      let muteV = document.querySelector(`.individualsVideo[data-user-id="${userPeerId}"] video`);
      muteV.muted = true;
    }
  });

  socket.on("user-unmuted", (roomId, userPeerId) => {
    if (userPeerId !== myPeerId) {
      let muteV = document.querySelector(`.individualsVideo[data-user-id="${userPeerId}"] video`);
      muteV.muted = false;
    }
  });
  
  hideV.addEventListener("click", () => {
    console.log("hideV clicked");
    if (hideV.className === "on"){
      hideV.innerHTML = `<span class="mdi mdi-camera-off"></span>`
      hideV.classList.remove("on");
      hideV.classList.add("off");
      
      let hideVimg = document.querySelector(`.individualsVideo .blankProfilePic[data-user-id="${myPeerId}"]`);
      hideVimg.style.display = 'block'
      socket.emit("camera-turn-off", roomId, myPeerId);
    } else {
      hideV.innerHTML = `<span class="mdi mdi-camera"></span>`
      hideV.classList.remove("off");
      hideV.classList.add("on");
      
      let hideVimg = document.querySelector(`.individualsVideo .blankProfilePic[data-user-id="${myPeerId}"]`);
      hideVimg.style.display = 'none'
      socket.emit("camera-turn-on", roomId, myPeerId);
    }
  });

  socket.on("camera-turn-offed", (roomId, userPeerId) => {
    let hideVimg = document.querySelector(`.individualsVideo .blankProfilePic[data-user-id="${userPeerId}"]`);
    hideVimg.style.display = 'block'
  });
  
  socket.on("camera-turn-oned", (roomId, userPeerId) => {
    let hideVimg = document.querySelector(`.individualsVideo .blankProfilePic[data-user-id="${userPeerId}"]`);
    hideVimg.style.display = 'none'
  });
  
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
      socket.emit("screen-share-start", roomId, myPeer.id); // 👈 Send user ID

      // Display screen locally in #video
      const videoElement = document.getElementById("videoPlayer");
      videoElement.innerHTML = ""; // Clear previous content
      const screenVideo = document.createElement("video");
      screenVideo.srcObject = screenStream;
      screenVideo.autoplay = true;
      screenVideo.muted = true;
      videoElement.appendChild(screenVideo);
      startScreenShareBtn.disabled = true;
      stopScreenShareBtn.disabled = false;
      
    });
});

// Stop screen sharing
stopScreenShareBtn.addEventListener("click", stopScreenShare);
  
function stopScreenShare() {
  if (!isScreenSharing) return;

  // Ensure localStream is available
  if (!localStream) {
    console.error("Local stream is not available.");
    return;
  }
  
  // Retrieve the original video track from localStream
  const videoTrack = localStream.getVideoTracks()[0];
  if (!videoTrack) {
    console.error("No video track found on localStream.");
    return;
  }

  // Replace the current (screen-sharing) track with the original video track
  for (const connId in myPeer.connections) {
    // For each connection, find the sender responsible for video
    const sender = myPeer.connections[connId][0].peerConnection
      .getSenders()
      .find((s) => s.track && s.track.kind === "video");
    if (sender) {
      sender.replaceTrack(videoTrack);
    }
  }

  // Clear the screen share display area (assuming #videoPlayer shows the screen share)
  const videoElement = document.getElementById("videoPlayer");
  if (videoElement) {
    videoElement.innerHTML = "";
  }

  // Notify others that screen sharing has stopped
  socket.emit("screen-share-stop", roomId, myPeer.id);

  // Update state and UI buttons
  isScreenSharing = false;
  startScreenShareBtn.disabled = false;
  stopScreenShareBtn.disabled = true;
}
  
// When someone starts screen sharing
socket.on("screen-share-started", (sharedUserId) => {
  // Find their video element in the grid
  const sharedVideoElement = document.querySelector(
    `.individualsVideo[data-user-id="${sharedUserId}"] video`
  );
  
  console.log(sharedVideoElement.srcObject)

  let bigScreen = document.querySelector('#videoPlayer video')
  bigScreen.srcObject = sharedVideoElement.srcObject;
  bigScreen.play();
  startScreenShareBtn.disabled = true;
  stopScreenShareBtn.disabled = true;
});

// When screen sharing stops
socket.on("screen-share-stopped", (sharerUserId) => {
  const videoContainer = document.getElementById("videoPlayer");
  videoContainer.innerHTML = ""; // Clear the screen share
  startScreenShareBtn.disabled = false;
  stopScreenShareBtn.disabled = true;
});

  // *** Chat Functionality ***

  // Send message event listener
  sendBtn.addEventListener("click", () => {
    const sender = senderNameInput.value.trim() || 'Anonymous';
    const message = messageInput.value.trim();
    if (!message) return; // Prevent sending empty messages

    console.log("before", myPeerId);
    console.log(typeof myPeerId);
    // Emit the message to the server
    socket.emit("send-message", { roomId, sender, message, myPeerId });
    
    // Optionally, immediately append the message to the chat (optimistic update)
    let who = "me"
    appendMessage(sender, message, new Date(), who);
    
    // Clear the message input
    messageInput.value = "";
  });

  sendPhotoBtn.addEventListener("click", () => {
  photoInput.click();
});

  // When a file is selected...
  // photoInput.addEventListener("change", function() {
  //   if (photoInput.files && photoInput.files[0]) {
  //     resizeImage(photoInput.files[0], function(resizedImage) {
  //       const file = photoInput.files[0];
  //       const reader = new FileReader();
  //       reader.onload = function(e) {
  //         const sender = senderNameInput.value.trim() || 'Anonymous';
  //         const photoDataUrl = e.target.result; // Base64 encoded image data
  //         // Emit the photo to the server along with the room and sender info.
  //         socket.emit("send-photo", { roomId, sender, photo: photoDataUrl, senderId: myPeerId });
  //         // Optionally, display the photo locally (optimistic update)
  //         appendPhotoMessage(sender, photoDataUrl, new Date(), "me");
  //       };
  //       reader.readAsDataURL(file);
  //     });
  //   }
  // });

  photoInput.addEventListener("change", function() {
    if (photoInput.files && photoInput.files[0]) {
        const formData = new FormData();
        formData.append("photo", photoInput.files[0]);

        fetch("/upload-photo", {
            method: "POST",
            body: formData
        })
        .then(response => response.json())
        .then(data => {
            const sender = senderNameInput.value.trim() || "Anonymous";
            const message = messageInput.value.trim() || '';
            console.log("send photo with message :", message);
            socket.emit("send-photo", { roomId, sender, photoUrl: data.url, senderId: myPeerId, message });
            let who = "me";
            let photoUrl = data.url;
            appendPhotoMessage(sender, photoUrl, new Date(), who, message);
        })
        .catch(error => console.error("Error uploading photo:", error));
    }
  });


  // Listen for photo messages from the server
  socket.on("receive-photo", ({ sender, photoUrl, timestamp, senderId, message }) => {
    if (senderId !== myPeerId) {
      appendPhotoMessage(sender, photoUrl, timestamp, "not me", message);
    }
  });

  // Listen for messages from server
  socket.on("receive-message", ({ sender, message, timestamp, senderId }) => {
    if (senderId !== myPeerId){
      let who = "not me"
      appendMessage(sender, message, timestamp, who);
    }
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

// Helper function to append a message to the chat
function appendMessage(sender, message, timestamp, who) {
  let mDiv = document.createElement("div");
  let sName = document.createElement("div");
  let ms = document.createElement("div");
  let tm = document.createElement("div")
  mDiv.classList.add("msgs");
  sName.classList.add("sender_name");
  ms.classList.add("ms");
  tm.classList.add("tm");

  sName.innerText = sender;
  ms.innerText = message;
  const time = new Date(timestamp).toLocaleTimeString('en-US', { hour: 'numeric', minute: 'numeric' });
  tm.innerText = time;

  if (who === "me") {
    mDiv.style.alignSelf = "flex-end";
  }

  mDiv.appendChild(sName);
  mDiv.appendChild(ms);
  mDiv.appendChild(tm);
  mainChatDiv.appendChild(mDiv);
  
  // Auto-scroll to the bottom
  mainChatDiv.scrollTop = mainChatDiv.scrollHeight;
}

// Helper function to append a photo message to the chat
function appendPhotoMessage(sender, photoUrl, timestamp, who, message) {
  const mDiv = document.createElement("div");
  const sName = document.createElement("div");
  let ms = document.createElement("div");
  const img = document.createElement("img");
  const tm = document.createElement("div");

  mDiv.classList.add("msgs");
  sName.classList.add("sender_name");
  ms.classList.add("ms");
  tm.classList.add("tm");

  sName.innerText = sender;
  ms.innerText = message;
  // Set the image source to the photo data URL
  img.src = photoUrl;
  // Optional: Style the image (e.g., max width, border radius)
  img.style.maxWidth = "100%";
  img.style.borderRadius = "5px";
  // Format the timestamp as "5:10 PM"
  const time = new Date(timestamp).toLocaleTimeString('en-US', { hour: 'numeric', minute: 'numeric' });
  tm.innerText = time;

  // Align your own messages to the right
  if (who === "me") {
    mDiv.style.alignSelf = "flex-end";
  }

  mDiv.appendChild(sName);
  mDiv.appendChild(img);
  mDiv.appendChild(ms);
  mDiv.appendChild(tm);
  mainChatDiv.appendChild(mDiv);
  mainChatDiv.scrollTop = mainChatDiv.scrollHeight;
  mainChatDiv.scrollTop = mainChatDiv.scrollHeight;
  mainChatDiv.scrollTop = mainChatDiv.scrollHeight;
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
