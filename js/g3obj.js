class G3WebSocket {
    constructor(hostname = window.location.hostname, port = window.location.port) {
        const urlParams = new URLSearchParams(window.location.search);
        if (urlParams.get('address') != undefined)
            this.hostname = urlParams.get('address');
        else
            this.hostname = hostname;

        if (urlParams.get('port') != undefined)
            this.port = urlParams.get('port');
        else
            this.port = port;

        this.hostname = "169.254.254.229";
        this.port = "";

        this.nextid = 0;
        this.queue = {};
        this.signals = {};
        this.statuswait = 0;
    }

    open(path = "", user = "") {
        if (this.popen != undefined)
            return this.popen;

        this.popen = new Promise((resolve, reject) => {
            this.ws = new WebSocket("ws://" + user + this.hostname + ":" +
                this.port + path + "/websocket", "g3api");
            this.ws.onclose = (e) => this._close(e);
            this.ws.onerror = (e) => {
                reject();
            };
            this.ws.onopen = () => {
                this.ws.onmessage = (msg) => { this._msg(JSON.parse(msg.data)) };
                this.ws.onerror = (e) => {
                    this._error();
                };
                resolve(this);
            };
        });
        return this.popen;
    }

    _close(e) {
        if (e.wasClean == true)
            return;
        var nocon = new G3PopUp(
            "Communication lost",
            "The connection to the Recording Unit was lost. Trying to reconnect.<p>"
        );
        if (!nocon)
            return;
        var timeout = setInterval(() => {
            var xhttp = new XMLHttpRequest();
            xhttp.onreadystatechange = () => {
                if (xhttp.readyState == 4) {
                    if (xhttp.status == 200) {
                        location.reload();
                    }
                }
            }
            xhttp.open("GET", window.location.href);
            xhttp.send();
        }, 2000);
    }

    async _error() {
        var div = document.createElement("div");
        div.innerHTML = "TEST";
        document.getElementsByTagName("body")[0].append(div);
    }

    _msg(msg) {
        if ("signal" in msg) {
            if (msg.signal in this.signals)
                this.signals[msg.signal].func(msg.body);
            else
                console.log("Missing signal: " + msg.signal, msg);
            return;
        }
        if (msg.id in this.queue) {
            if ("error" in msg) {
                this.queue[msg.id][1](msg.message);
            } else {
                this.queue[msg.id][0](msg.body);
            }
            delete this.queue[msg.id];
        }
        if (this._statusdone !== undefined) {
            clearTimeout(this._statusdone);
            delete this._statusdone;
        }
        if (Object.keys(this.queue).length == 0) {
            this._statusdone = setTimeout(() => {
                statusdiv.classList.remove("menucom");
            }, 100);
        }
    }


    async close() {
        for (var sig in this.signals) {
            this.disconnect(sig);
        }
        await this.ws.close();
    }

    send(context) {
        return new Promise((resolve, reject) => {
            var obj = {
                path: context.path,
                id: this.nextid += 1,
            };
            if (context.body !== undefined) {
                obj.method = "POST";
                obj.body = context.body;
            } else {
                obj.method = "GET";
            }
            if (context.args !== undefined)
                obj.params = context.args;
            this.queue[obj.id] = [
                (body) => { resolve(body) },
                (msg) => { reject(msg) },
                context
            ];
            statusdiv.classList.add("menucom");
            this.ws.send(JSON.stringify(obj));
        });
    }

    connect(path, func) {
        return this.send({ path: path, body: null })
            .then((body) => {
                this.signals[body] = {
                    path: path,
                    name: path.split(":").pop(),
                    func: func
                };
                return body;
            })
            .catch((msg) => {
                console.log("Signal error: " + path + " : " + msg);
            });
    }

    async disconnect(id) {
        if (id in this.signals) {
            await this.send({ path: this.signals[id].path, body: id })
            delete this.signals[id];
        } else {
            console.log("Id not in signals");
        }
    }
}


class G3Obj {
    constructor(ws = null, path = "/") {
        this.path = path;
        if (ws == null)
            ws = new G3WebSocket();
        this.ws = ws;
    }

    async open() {
        return await this.ws.open();
    }

    name() {
        return this.path.split("/").pop();
    }

    get(name) {
        return this.ws.send({
            path: this.path + "." + name
        });
    }

    set(name, val) {
        return this.ws.send({
            path: this.path + "." + name,
            body: val
        });
    }

    call(action, args = []) {
        return this.ws.send({
            path: this.path + "!" + action,
            body: args
        });
    }

    connect(signal, func) {
        return this.ws.connect(this.path + ":" + signal, func);
    }

    async connect_children(addfunc, remfunc) {
        var lst = await this.children();
        for (var i in lst)
            addfunc(lst[i]);
        return [
            this.connect("child-added", (v) => addfunc(v[0])),
            this.connect("child-removed", (v) => remfunc(v[0]))
        ];
    }

    async disconnect_children(ret) {
        this.disconnect("child-added", ret[0]);
        this.disconnect("child-removed", ret[1]);
    }

    disconnect(id) {
        return this.ws.disconnect(id);
    }

    child(name) {
        return new G3Obj(this.ws, this.path + "/" + name);
    }

    children() {
        return this.object()
            .then((obj) => { return obj.children; });
    }

    properties() {
        return this.object()
            .then((obj) => { return obj.properties; });
    }

    object(help = false) {
        return this.ws.send({
            path: this.path,
            args: { "help": help }
        });
    }
}