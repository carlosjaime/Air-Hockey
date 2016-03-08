// REQUIRES
// Load in web and file system requires, and socket.io
var http = require("http");				// web server
var socketio = require("socket.io");	// socket.io
var router = require("./router.js");
var GameManager = require("./GameManager.js"); // loads in GameManager class

// Attempt to use Node"s global port, otherwise use 3000
var PORT = process.env.PORT || process.env.NODE_PORT || 3000;

// The current room number to create - increments when a new match is created
var curRoomNum = 1;

// Start server
var app = http.createServer(router).listen(PORT);
console.log("HTTP server started, listening on port " + PORT);


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
	
	// add the two users to the next room in the cycle - they're alone, ready for their match!
	userQueue[0].roomName = roomName;
	userQueue[1].roomName = roomName;
	userQueue[0].join(roomName);
	userQueue[1].join(roomName);
	
	// create the new game instance
	var newGame = new GameManager(roomName, io, userQueue[0], userQueue[1]);
	currentGames.push(newGame);
	
	// clear those two users from the queue
	userQueue.splice(0, 2);
}

/* cleanGames
	desc: checks games to find finished ones and clear them out
*/
function cleanGames() {
	for (var i = 0; i < currentGames.length; ++i) {
		// grab current one
		var curr = currentGames[i];
		
		// delete the game from the list if its complete
		// just to save memory so old games don't linger in the list
		if (curr.gameComplete) {
			currentGames.splice(currentGames.indexOf(curr), 1);
		}
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
		
		// tell the client the registration went through
		socket.emit("joinSuccess");
		
		// attempt to create a new game room if we have two users in the queue
		if (userQueue.length >= 2) {	
			createGame();
		}
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
	onDisconnect(socket);
});

console.log("Websocket server started");

// start a loop to clear empty games
setInterval(cleanGames, 1000);