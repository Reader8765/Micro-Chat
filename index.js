const e = require("express");
const app = e();

const bodyParser = require('body-parser');
app.use(bodyParser.json());

function makeError(response, message, code) {
	return response.json({
		error: {
			message,
			code,
		},
	});
}

function validName(name) {
	return !(name.replace(/[^a-zA-Z]/g, "").match(/server/gi));
}

app.post("/api/v1/message", (req, res) => {
	if (!req.body || Object.keys(req.body).length === 0) {
		return makeError(res, "Provide a body.", 1);
	} else if (!req.body.content) {
		return makeError(res, "Provide content for the message.", 2);
	} else if (req.body.nickname && !validName(req.body.nickname)) {
		return makeError(res, "The nickname is invalid.", 3);
	} else {
		const msg = {
			message: req.body.content,
			who: req.body.nickname || "Unknown",
			color: "black",
		};
		io.emit("msg", msg);

		return res.json(msg);
	}
});

const http = require("http")
const serv = http.Server(app);

const sid = require("short-id").generate;
const ord = require("ordinal")

const io = require("socket.io")(serv);
io.on("connection", socket => {
	let id = sid();
	function sys(message, type = "self") {
		const things = ["msg", {
			message,
			who: "[Server]",
			color: "blue",
		}];

		if (type === "self") {
			socket.emit(...things);
		} else if (type === "global") {
			io.emit(...things);
		} else if (type === "others") {
			socket.broadcast.emit(...things);
		}
	}
	sys("Welcome to the chat room!");
	sys(`'${id}' joined the chatroom!`, "others");

	let lastMsg;
	let dabCount = 0;

	function setName(newID, silent) {
		if (!validName(newID)) {
			if (!silent) {
				sys("Don't impersonate the server.");
			}
		} else {
			if (!silent) {
				sys("Your nickname has been updated.");
				sys(`'${id}' has changed their nickname to '${newID}'.`, 'others');
			}
			id = newID;
			socket.emit("nameset", newID);
		}
	}

	socket.on("setname", (n) => {
		console.log("new name?", n)
		if (n) {
			setName(n, true);
		}
	});

	socket.on("newmsg", msg => {
		const message = msg.trim();
		if (message === "") return;

		if (message.startsWith("/nick ")) {
			setName(message.split(" ").slice(1).join(" "), false)
		} else if (message.startsWith("/clear")) {
			const num = parseInt(message.split(" ")[1]);
			socket.emit("clear", isNaN(num) ? Infinity : num)
		} else if (message.startsWith("/dab")) {
			dabCount += 1;
			sys(`*You dabbed for the ${ord(dabCount)} time.*`)
			sys(`*'${id}' dabbed for the ${ord(dabCount)} time.*`, "others")
		} else {
			if (message === lastMsg) {
				sys("Don't flood the chat.");
			} else {
				lastMsg = message;
				io.emit("msg", {
					message,
					who: id,
					color: "black"
				});
			}
		}
	});
})

app.use(e.static("./static"))

serv.listen(8585, () => {
	console.log("It's time")
});
