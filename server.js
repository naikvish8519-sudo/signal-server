const express = require("express");
const http = require("http");
const { Server } = require("socket.io");
const cors = require("cors");
const { v4: uuidv4 } = require("uuid");

const app = express();

app.use(cors());

app.get("/", (req, res) => {
    res.send("Planning Poker Server is running.");
});

const server = http.createServer(app);

const io = new Server(server, {
    cors: {
        origin: "*",
        methods: ["GET", "POST"]
    }
});

const rooms = {};

io.on("connection", (socket) => {

    console.log(`✅ Connected: ${socket.id}`);

    // ===========================
    // Create Room
    // ===========================
    socket.on("create-room", ({ hostName }) => {

        const roomId = uuidv4()
            .replace(/-/g, "")
            .substring(0, 6)
            .toUpperCase();

        rooms[roomId] = {
            id: roomId,
            host: socket.id,
            revealed: false,
            users: {}
        };

        rooms[roomId].users[socket.id] = {
            id: socket.id,
            name: hostName,
            vote: null,
            isHost: true,
            isObserver: false
        };

        socket.join(roomId);

        console.log(`🟢 Room Created: ${roomId}`);

        socket.emit("room-created", {
            roomId
        });

        io.to(roomId).emit("room-updated", rooms[roomId]);

        console.log("Current Room:");
        console.log(JSON.stringify(rooms[roomId], null, 2));
    });

    // ===========================
    // Join Room
    // ===========================
    socket.on("join-room", ({ roomId, name, isObserver}) => {

        if (!rooms[roomId]) {

            socket.emit("error", "Room does not exist.");

            return;
        }

        rooms[roomId].users[socket.id] = {
            id: socket.id,
            name,
            vote: null,
            isHost: false,
            isObserver
        };

        socket.join(roomId);

        console.log(`👤 ${name} joined ${roomId}`);

        io.to(roomId).emit("room-updated", rooms[roomId]);

        console.log("Current Room:");
        console.log(JSON.stringify(rooms[roomId], null, 2));
    });

    // ===========================
    // Vote
    // ===========================
    // socket.on("vote", ({ roomId, vote }) => {

    //     if (!rooms[roomId]) return;

    //     if (!rooms[roomId].users[socket.id]) return;

    //     rooms[roomId].users[socket.id].vote = vote;

    //     io.to(roomId).emit("room-updated", rooms[roomId]);
    // });
    socket.on("vote", ({ roomId, vote }) => {

    if (!rooms[roomId]) return;

    const user = rooms[roomId].users[socket.id];

    if (!user) return;

    if (user.isObserver) {
        return;
    }

    user.vote = vote;

    io.to(roomId).emit("room-updated", rooms[roomId]);

});
    // ===========================
    // Reveal Votes
    // ===========================
    socket.on("reveal", ({ roomId }) => {

        if (!rooms[roomId]) return;

        rooms[roomId].revealed = true;

        io.to(roomId).emit("room-updated", rooms[roomId]);
    });

    // ===========================
    // Clear Votes
    // ===========================
    socket.on("clear-votes", ({ roomId }) => {

        if (!rooms[roomId]) return;

        rooms[roomId].revealed = false;

        Object.values(rooms[roomId].users).forEach(user => {
            user.vote = null;
        });

        io.to(roomId).emit("room-updated", rooms[roomId]);
    });
// ===========================
// Leave Room
// ===========================
socket.on("leave-room", ({ roomId }) => {

    const room = rooms[roomId];

    if (!room) return;

    // Was this user the host?
    const wasHost = room.host === socket.id;

    // Remove the user
    delete room.users[socket.id];

    // Leave the Socket.IO room
    socket.leave(roomId);

    // Delete room if empty
    if (Object.keys(room.users).length === 0) {

        console.log(`🗑️ Deleting empty room ${roomId}`);

        delete rooms[roomId];

        return;
    }

    // Transfer host if necessary
    if (wasHost) {

        const remainingUsers = Object.values(room.users);

        const newHost = remainingUsers[0];

        room.host = newHost.id;

        newHost.isHost = true;

        console.log(`👑 Host transferred to ${newHost.name}`);

    }

    io.to(roomId).emit("room-updated", room);

    console.log("Current Room:");
    console.log(JSON.stringify(room, null, 2));

});

    // ===========================
    // Disconnect
    // ===========================
    socket.on("disconnect", () => {

        console.log(`❌ Disconnected: ${socket.id}`);

        for (const roomId in rooms) {

            if (!rooms[roomId].users[socket.id]) {
                continue;
            }

            const wasHost = rooms[roomId].host === socket.id;

            delete rooms[roomId].users[socket.id];

            // Transfer host if necessary
            if (wasHost) {

                const remainingUsers = Object.values(rooms[roomId].users);

                if (remainingUsers.length > 0) {

                    const newHost = remainingUsers[0];

                    rooms[roomId].host = newHost.id;

                    newHost.isHost = true;
                }
            }

            if (Object.keys(rooms[roomId].users).length === 0) {

                console.log(`🗑️ Deleting empty room ${roomId}`);

                delete rooms[roomId];

            } else {

                io.to(roomId).emit("room-updated", rooms[roomId]);

                console.log("Current Room:");
                console.log(JSON.stringify(rooms[roomId], null, 2));
            }
        }

    });

});

const PORT = process.env.PORT || 3000;

server.listen(PORT, () => {

    console.log(`🚀 Server running on port ${PORT}`);

});