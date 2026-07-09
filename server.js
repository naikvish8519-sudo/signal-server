const express = require("express");
const http = require("http");
const { Server } = require("socket.io");
const cors = require("cors");

const app = express();

app.use(cors());

app.get("/", (req, res) => {
    res.send("Planning Poker Server is running.");
});

const server = http.createServer(app);

const io = new Server(server, {
    cors: {
        origin: [
            "http://localhost:4200",
            "https://YOUR_GITHUB_USERNAME.github.io"
        ],
        methods: ["GET", "POST"]
    }
});

const rooms = {};

io.on("connection", (socket) => {

    console.log(`Connected: ${socket.id}`);

    socket.on("create-room", ({ roomId, hostName }) => {

        rooms[roomId] = {
            host: socket.id,
            revealed: false,
            users: {}
        };

        rooms[roomId].users[socket.id] = {
            name: hostName,
            vote: null
        };

        socket.join(roomId);

        io.to(roomId).emit("room-updated", rooms[roomId]);
    });

    socket.on("join-room", ({ roomId, name }) => {

        if (!rooms[roomId]) {
            socket.emit("error", "Room does not exist.");
            return;
        }

        rooms[roomId].users[socket.id] = {
            name,
            vote: null
        };

        socket.join(roomId);

        io.to(roomId).emit("room-updated", rooms[roomId]);
    });

    socket.on("vote", ({ roomId, vote }) => {

        if (!rooms[roomId]) return;

        rooms[roomId].users[socket.id].vote = vote;

        io.to(roomId).emit("room-updated", rooms[roomId]);
    });

    socket.on("reveal", ({ roomId }) => {

        if (!rooms[roomId]) return;

        rooms[roomId].revealed = true;

        io.to(roomId).emit("room-updated", rooms[roomId]);
    });

    socket.on("clear-votes", ({ roomId }) => {

        if (!rooms[roomId]) return;

        rooms[roomId].revealed = false;

        Object.values(rooms[roomId].users).forEach(user => {
            user.vote = null;
        });

        io.to(roomId).emit("room-updated", rooms[roomId]);
    });

    socket.on("disconnect", () => {

        console.log(`Disconnected: ${socket.id}`);

        for (const roomId in rooms) {

            if (rooms[roomId].users[socket.id]) {

                delete rooms[roomId].users[socket.id];

                if (Object.keys(rooms[roomId].users).length === 0) {
                    delete rooms[roomId];
                } else {
                    io.to(roomId).emit("room-updated", rooms[roomId]);
                }
            }
        }
    });

});

const PORT = process.env.PORT || 3000;

server.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});