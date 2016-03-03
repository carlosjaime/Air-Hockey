// REQUIRES
// Load in web and file system requires, and socket.io
var http = require("http");				// web server
var fs = require("fs");					// file system
var socketio = require("socket.io");	// socket.io
var GameManager = require("./GameManager.js"); // loads in GameManager class

// Attempt to use Node"s global port, otherwise use 3000
var port = process.env.PORT || process.env.NODE_PORT || 3000;

// Read the client HTML page into memory
var index = fs.readFileSync(__dirname + "/../client/client.html");

// The current room number to create - increments when a new match is created
var curRoomNum = 1;

/* onRequest 
	desc: our callback function for when our server receives a request.
	returns: index - our chat page
*/
function onRequest(request, response) {
	// send an "ok", tell them we"re returning HTML
	response.writeHead(200, {"Content-Type": "text/html"});
	response.write(index);
	
	// close the response stream
	response.end();
}

// Start server
var app = http.createServer(onRequest).listen(port);
console.log("HTTP server started, listening on port " + port);


// WEBSOCKETS
// Pass the http server into socketio and save the returned websocket server
var io = socketio(app);

// Object which stores all connected users
var users = {};

// Array which stores users currently waiting for a connection
// If it has >1 users in, a new game room is created
var userQueue = [];

// A list of all of our GameManagers - the games currently running
var currentGames = [];

/* createGame
	desc: creates a new game from the first two users in the queue
*/
function createGame() {
	// build the string for a new room name
	// two players join the new room and are passed to a GameManager
	var roomName = "room" + curRoomNum;
	
	// increment room number so no users can join this room again
	++curRoomNum;
	
	// add the two users to the next room in the cycle - they"re alone, ready for their match!
	userQueue[0].roomName = roomName;
	userQueue[1].roomName = roomName;
	userQueue[0].join(roomName);
	userQueue[1].join(roomName);
	
	/* update player 1's info:
		- tell them player 2's name
		- tell them their side
	*/
	userQueue[0].emit(
		"updateInfo",
		{
			object: "otherUser",
			username: userQueue[1].name,
			side: 1
		});
	userQueue[0].emit("updateInfo", { object: "user", side: 0 });
	
	/* update player 2's info:
		- tell them player 1's name
		- tell them their side
	*/
	userQueue[1].emit(
		"updateInfo",
		{
			object: "otherUser",
			username: userQueue[0].name,
			side: 0
		});
	userQueue[1].emit("updateInfo", { object: "user", side: 1 });
	
	// create the new game instance
	var newGame = new GameManager(roomName, io, userQueue[0], userQueue[1]);
	currentGames.push(newGame);
	
	// clear those two users from the queue
	delete userQueue[0];
	delete userQueue[1];
}

/* loop
	desc: main server loop, loops through currentGames and updates all of the GameManagers
*/
function loop() {
	for (var i = 0; i < currentGames.length; ++i) {
		currentGames[i].update();
	}
}

// User joined - emitted after a socket is completed and processed
var onJoined = function(socket) {
	
	socket.on ("join", function(data) {
		
		// check if a user with that name already exists
		if (users[data.name]) {
			socket.emit("msg", { msg: "That name is already in use. Please choose another." });
			return;
		}
		
		// store socket"s username on the socket for future use
		socket.name = data.name;
		
		// store the user in the database for future reference
		users[data.name] = socket.name;
		
		// add user to user queue
		userQueue.push(socket);
		
		// notifies the user that they"re waiting for another connection
		socket.emit("msg", { msg: "Searching for another user to play with..." });
		
		// attempt to create a new game room if we have two users in the queue
		if (userQueue.length >= 2) {	
			createGame();
		}
	});
};

// User update - emitted by each socket each tick, data is sent back to other user
var onUpdate = function(socket) {
	
	socket.on("update", function(data) {
		socket.broadcast.to(socket.roomName).emit("updateInfo", { object: "otherUser", pos: data.pos });
	});
};

// User disconnect - emitted when a user disconnects, ends game and informs other user
var onDisconnect = function(socket) {
	
	// listen for disconnect events
	socket.on("disconnect", function(data) {
		// delete the user from the users list
		delete users[socket.name];
		
		// delete the user from the queue
		delete userQueue[socket.name];
	});
};

// Pass any new connections to our handler delegates
io.sockets.on("connection", function(socket) {
	
	onJoined(socket);
	onUpdate(socket);
	onDisconnect(socket);
});

console.log("Websocket server started");
setInterval(loop, 1);