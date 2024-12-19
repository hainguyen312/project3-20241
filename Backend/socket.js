const express = require('express');
const http = require('http');
const { Server } = require('socket.io');

const app = express();

const server = http.createServer(app);
const io = new Server(server, {
    cors: {
        origin: "https://project3-20241-1.onrender.com",
        methods: ["GET", "POST"],
        // credentials:true
    }
});

const getRecieverSocketId = (username) => {
    return userSocketMap[username];
}

const userSocketMap = {};

io.on("connection", (socket) => {
    const username = socket.handshake.query.username;

    if (username) {
        console.log(`Created socket connection for ${username}: ${socket.id}`);
        userSocketMap[username] = userSocketMap[username] || [];
        userSocketMap[username].push(socket.id);

        socket.on("calling", (data) => {
            console.log(data);

            const memberIds = JSON.parse(data.memberIds);
            const calledMembers = {};

            memberIds.forEach(memberId => {
                const memberSockets = userSocketMap[memberId];
                if (memberSockets && memberSockets.length > 0) {
                    memberSockets.forEach(memberSocketId => {
                        if (memberSocketId !== socket.id && !calledMembers[memberSocketId]) {
                            io.to(memberSocketId).emit("someone_calling", {
                                caller: username,
                                callType: data.callType,
                                isGroup: data.isGroup,
                                name: data.name,
                                image: data.image,
                                callId: data.callId,
                                groupOwner: data.groupOwner
                            });
                            console.log(`Ringing call to ${memberSocketId}`);
                            calledMembers[memberSocketId] = true;
                        }
                    });
                }
            });
        });

        socket.on("detect_face", (data) => {
            const { memberIds, owner } = data;
            console.log(`Detect face initiated by ${owner}`);
        
            memberIds.forEach(memberId => {
                const memberSockets = userSocketMap[memberId];
                if (memberSockets && memberSockets.length > 0) {
                    memberSockets.forEach(memberSocketId => {
                        console.log(`Requesting face detect to ${memberSocketId}`);
                        io.to(memberSocketId).emit("request_face_detect", { owner });
                    });
                }
            });
        });

        socket.on("face_detect_result", (data) => {
            const { owner, result } = data;
        
            // Log dữ liệu nhận từ client
            console.log(`Received face_detect_result from client:`, data); 
        
            const ownerSockets = userSocketMap[owner];
            if (ownerSockets && ownerSockets.length > 0) {
                ownerSockets.forEach(ownerSocketId => {
                    // Log socketId của owner và dữ liệu được gửi
                    console.log(`Sending face detect result to owner (${owner}) at socket ID: ${ownerSocketId}`);
                    console.log(`Data sent to owner:`, result); 
        
                    io.to(ownerSocketId).emit("receive_face_result", { result });
                });
            } else {
                console.log(`No socket found for owner: ${owner}`);
            }
        });

        socket.on("disconnect", () => {
            console.log(`${username} disconnected: ${socket.id}`);
            if (userSocketMap[username]) {
                const index = userSocketMap[username].indexOf(socket.id);
                if (index !== -1) {
                    userSocketMap[username].splice(index, 1);
                    if (userSocketMap[username].length === 0) {
                        delete userSocketMap[username];
                    }
                }
            }
        });
    }
});

module.exports = { app, io, server, getRecieverSocketId };