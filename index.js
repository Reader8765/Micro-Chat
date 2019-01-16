let config = {
	port: 8585,
	redditChat: {
		credentials: {},
	},
};
try {
	config = Object.assign(config, require("./config.json"));
} catch (error) {
	// swallow peacefully
}

const reddit = require("snoowrap");
const sendbird = require("sendbird");

const e = require("express");
const app = e();

const http = require("http")
const serv = http.Server(app);

const sid = require("short-id").generate;
const ord = require("ordinal")
const io = require("socket.io")(serv);

function sendMessage(source = "none", msg = {}, socket = true) {
	if (socket) {
		// Socket.io
		io.emit("msg", {
			message: msg.content,
			who: msg.sender,
			color: msg.color || "black",
		});
	}

	if (source !== "reddit-chat") {
		// Reddit Chat
		sendToRC(msg.sender, msg.content);
	}
}

function sendToRC(id, message) {
	if (redditChatChannel && redditChatChannel.sendUserMessage) {
		console.log("sending reddit chat msg")
		return redditChatChannel.sendUserMessage(`${id}: ${message}`, (_, error) => {
			if (error) {
				console.log("Error forwarding to RC:", error)
			}
		});
	} else {
		return null;
	}
}

io.on("connection", socket => {
	let id = sid();
	function sys(message, type = "self") {
		if (type === "self") {
			socket.emit("msg", {
				message,
				who: "[Server]",
				color: "blue",
			});
		} else if (type === "global") {
			sendMessage("server", {
				content: message,
				sender: "[Server]",
				color: "blue",
			});
		} else if (type === "others") {
			sendMessage("server", {
				content: message,
				sender: "[Server]",
				color: "blue",
			}, false);
			socket.broadcast.emit("msg", {
				message,
				who: "[Server]",
				color: "blue",
			});
		}
	}
	sys("Welcome to the chat room!");
	sys(`'${id}' joined the chatroom!`, "others");

	let lastMsg;
	let dabCount = 0;

	function setName(newID, silent) {
		if (newID.replace(/[^a-zA-Z]/g, "").match(/server/gi)) {
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
				sendMessage("client", {
					content: message,
					sender: id,
				});
			}
		}
	});
})

let redditChatChannel;
if (config.redditChat) {
	(async () => {
		const redditChat = new sendbird({
			appId: "2515BDA8-9D3A-47CF-9325-330BC37ADA13",
		});
		const rClient = new reddit(Object.assign(config.redditChat.credentials || {}, {
			userAgent: `Micro Chat Linker for Reddit Chat`,
		}));

		const {
			sb_access_token
		} = await rClient.oauthRequest({
			baseUrl: "https://s.reddit.com/api/v1",
			method: "get",
			uri: "/sendbird/me",
		});
		const id = await rClient.getMe().id;

		let selfName;
		redditChat.connect("t2_" + id, sb_access_token, self => {
			if (self) {
				selfName = self.nickname;
			}
			redditChat.setChannelInvitationPreference(true);

			redditChat.GroupChannel.getChannel(config.redditChat.channel, (channel, error) => {
				if (!error) {
					redditChatChannel = channel;
				}
			});
		});

		const handler = new redditChat.ChannelHandler();
		handler.onMessageReceived = (channel, message) => {
			if (channel.url === config.redditChat.channel && message._sender.nickname !== selfName) {
				sendMessage("reddit-chat", {
					content: message.message,
					sender: message._sender.nickname,
				});
			}
		}
		redditChat.addChannelHandler("linker", handler);
	})();
}


app.use(e.static("./static"))

serv.listen(config.port, () => {
	console.log("It's time")
});
