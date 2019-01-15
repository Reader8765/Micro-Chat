try {
	const socket = io();

	socket.on("connect", (name) => {
		socket.emit("setname", localStorage.getItem("nickname"));
	});

	const msg = document.getElementById("msg");
	const send = document.getElementById("send");

	socket.on("msg", ({ message, who, color }) => {
		const p = document.createElement("p");

		const name = document.createElement("span");
		name.style.fontWeight = "bold";
		name.innerText = who + ":";
		name.style.marginRight = "4px";
		name.style.color = color || "black";

		const text = document.createElement("span");
		text.innerText = message;

		p.appendChild(name);
		p.appendChild(text);
		msg.appendChild(p);

		send.scrollIntoView();
	});
	socket.on("clear", count => {
		Array.from(msg.childNodes).slice(count * -1).forEach(element => element.remove());
	})

	socket.on("nameset", (name) => {
		localStorage.setItem("nickname", name);
	})

	function submit() {
		socket.emit("newmsg", send.value);
		send.value = "";
		send.focus();
	}

	send.addEventListener("keydown", e => {
		if (e.code === "Enter") {
			submit();
		}
	})
} catch (error) {
	alert(error)
}
