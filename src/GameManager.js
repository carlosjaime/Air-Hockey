"use strict"; 

/* GameManager
	desc: handles an instance of a game
*/
class GameManager {
	/* Ctor
		room: the ID on the server of the room this GameManager is managing
		io: a reference to socket.io
		p1: a reference to player 1's socket
		p2: a reference to player 2's socket
	*/
	constructor(room, io, p1, p2) {
		this.room = room;
		this.io = io;	
		this.p1 = p1;
		this.p2 = p2;
	}
	
	/* update
		desc: updates game physics
	*/
	update() {
	}
}

// Export the class as a module
module.exports = GameManager;