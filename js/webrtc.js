/**
 * Parsed SDP representation
 */
class SdpDesc {
    constructor(sdp) {
        this.sess = [];
        this.streams = {}
        var stream = this.sess;
        var mid = null;
        sdp.split("\r\n").forEach((line) => {
            line = line.trim();
            if (line.startsWith("m=")) {
                if (mid != null)
                    this.streams[mid] = stream;
                stream = [];
                mid = line.substr(2);
            } else if (line.startsWith("a=mid:")) {
                mid = line.substr(6);
            }
            if (line != "")
                stream.push(line);
        });

        if (stream != null)
            this.streams[mid] = stream;
    }

    to_sdp() {
        var sdp = this.sess.join("\r\n");
        for (var mid in this.streams)
            sdp += "\r\n" + this.streams[mid].join("\r\n");
        sdp += "\r\n";
        return sdp;
    }

    suspend(mid) {
        if (mid in this.streams) {
            for (var i in this.streams[mid]) {
                var l = this.streams[mid][i];
                if (l.startsWith("m=")) {
                    // media line for video stream looks like this: 
                    // m=video 9 UDP/TLS/RTP/SAVPF 98
                    // replace the port (9) with 0
                    var parts = l.split(' ', 4);
                    this.streams[mid][i] = parts[0] + ' 0 ' + parts[2] + ' ' + parts[3];
                    return true;
                }
            }
        }
        return false;
    }
}

/**
 * A JsonChannel
 *
 * Can be either a ApiSignal or a WebRtcStream and can interconnect between
 * them.
 */
class JsonChannel {
    /**
     * Create a json channel and connect as with api signal
     */
    constructor(name, remote, peer) {
        this.name = name;
        this.remote = remote;
        this.peer = peer;
        this.funcs = [];
        this._connect_signal();
        this._connect_channel();
    }

    async _connect_signal() {
        this._sig = await this.remote.connect(this.name, (body) => {
            this._msg(body, "WS");
        });
    }

    _connect_channel() {
        this.chan = this.peer.createDataChannel(this.name);
        if (!this.chan) {
            delete this.chan;
            return;
        }
        this.chan.onopen = (ev) => {
            console.log("WebRTC data channel opened: " + this.name);
            this._disconnect_signal();
        };
        this.chan.onmessage = (ev) => {
            this._msg(JSON.parse(ev.data), "WebRTC");
            this._disconnect_signal();
        };
        this.chan.onerror = (ev) => {
            console.log("ON ERROR");
            this._connect_signal();
        };
    }

    _disconnect_signal() {
        if (this._sig !== undefined) {
            console.log("Disconnecting signal: " + this.name);
            this.remote.disconnect(this._sig);
            delete this._sig;
        }
    }

    add_event(func) {
        this.funcs.push(func);
    }

    _msg(body, type) {
        this.funcs.forEach((func) => {
            func(body[0], body[1], type);
        });
    }

    /**
     * Disconnect to closed state
     */
    close() {
        if (this.chan) {
            this.chan.close();
            delete this.chan;
        }
        if (this.sig) {
            this.remote.disconnect(this.sig);
            delete this.sig;
        }
    }
}

class WebRtc {
    constructor(sceneel, eyeel = null, overlayel = null, localip = null, log = null, stun = null) {
        /* Media elements. Names should match mid in SDP */
        this.medias = {
            "sceneaudio": {},
            /* We always have audio */
        };
        this.drawovl = true;
        this.localip = localip;
        this.stun = stun;
        this.logdiv = log;

        this.onrender = function() {};
        this.channels = {};
        if (sceneel !== undefined && sceneel != null) {
            this.medias["scenevideo"] = {
                element: sceneel,
                stream: new MediaStream()
            };
        }
        if (eyeel !== undefined && eyeel != null) {
            eyeel.muted = true;
            eyeel.classList.add("hide");
            this.medias["eyesvideo"] = {
                element: eyeel,
                stream: new MediaStream(),
            };
        }
        if (overlayel !== undefined && overlayel != null) {
            overlayel.style.display = "none";
            this.medias["gaze"] = {
                element: overlayel,
            };
        }
    }

    log(msg) {
        if (this.logdiv) {
            var current = new Date();
            logdiv.innerHTML += current.toLocaleTimeString() + ":" + msg + "<br>";
        }
    }

    loghint(msg, hint) {
        if (this.logdiv) {
            var current = new Date();
            logdiv.innerHTML += current.toLocaleTimeString() + ":<span title=\"" + hint + "\">" + msg + " *</span><br>";
        }
    }

    connect_channel(name, func) {
        var chan;
        if (this.remote === undefined || this.peer === undefined) {
            console.log("Connection to channels only allowed after start");
            return;
        }
        if (name in this.channels) {
            chan = this.channels[name];
        } else {
            chan = new JsonChannel(name, this.remote, this.peer);
            this.channels[name] = chan;
        }
        chan.add_event(func);
    }

    _render() {
        /* pop all old gaze samples */
        var scene = this.medias["scenevideo"].element;
        var data = this.gaze;
        var gazeel = this.medias["gaze"].element;
        var ovl = this.medias["gaze"].element;
        var gaze = null;
        if (data !== undefined) {
            gazeel.currentTime = data[0];
            if ("gaze2d" in data[1])
                gaze = data[1].gaze2d;
        }

        if (this.drawovl && gaze != null) {
            var x = (scene.clientWidth * gaze[0]) - (ovl.width / 2);
            var y = (scene.clientHeight * gaze[1]) - (ovl.height / 2);
            x += scene.offsetLeft;
            y += scene.offsetTop;
            ovl.style.left = x + "px";
            ovl.style.top = y + "px";
            ovl.style.width = ((scene.clientWidth / 50.0) + 10) + "px";
            ovl.style.display = "block";
            ovl.style.opacity = 1.0 - (scene.currentTime - gazeel.currentTime);
        } else {
            ovl.style.display = "none"
        }
        this.onrender(scene.currentTime);
        if (this.peer !== undefined)
            window.requestAnimationFrame(() => this._render());
    }

    _peer_track(ev) {
        if (ev.track.kind == "audio") {
            for (var m in this.medias) {
                if (this.medias[m].stream !== undefined)
                    this.medias[m].stream.addTrack(ev.track);
            }
        } else if (ev.transceiver.mid in this.medias) {
            var media = this.medias[ev.transceiver.mid];
            media.stream.addTrack(ev.track);
            media.element.srcObject = media.stream;
            media.element.autoplay = true;
            media.element.classList.remove("hide");
        } else {
            this.peer.removeTrack(ev.transceiver.sender);
        }
    }

    _new_remote_ice(body) {
        var c = { sdpMLineIndex: body[0], candidate: body[1] };
        var candidate = new RTCIceCandidate(c);
        if (this._candidates !== undefined) {
            this.log("Queueing remote ICE candidate:" + JSON.stringify(candidate));
            this._candidates.push(candidate);
            return;
        }

        this.log("Applying remote ICE candidate: " + JSON.stringify(candidate));
        this.peer.addIceCandidate(candidate)
            .catch(e => {
                this.log("Could not set ICE candidate in local peer: " + e + " - " + JSON.stringify(candidate));
            });
    }

    _new_local_ice(ev) {
        /* local ice candidate */
        if (ev.candidate == null)
            return;
        var cand = ev.candidate.candidate;
        if (this.localip != null) {
            /* This is a temporary fix for mDNS lookups failing on
             * browser generated .local hosts.
             */
            const regex = /[\w,-]*.local/gi;
            cand = cand.replace(regex, this.localip);
        }
        this.log("Sending ICE candidate to RU: " + cand);
        this.remote.call("add-ice-candidate", [ev.candidate.sdpMLineIndex, cand]);
    }

    /* Start a WebRTC session */
    async start(uuid = null, wrobj = null) {
        /* Create peer */
        if (this.stun != null) {
            var rtc_configuration = {
                "iceServers": [
                    { "urls": "stun:" + this.stun }
                ],
            }
            this.peer = new RTCPeerConnection(rtc_configuration);
        } else {
            this.peer = new RTCPeerConnection();
        }

        this.peer.ontrack = (ev) => this._peer_track(ev);
        this.peer.onicecandidate = (ev) => this._new_local_ice(ev);

        if (wrobj == null) {
            var ws = new G3WebSocket();
            await ws.open();
            this.wrobj = new G3Obj(ws, "/webrtc");
        } else {
            this.wrobj = wrobj;
        }

        var id;
        if (uuid == null) {
            this.log("Creating webrtc session");
            id = await this.wrobj.call("create");
        } else
            id = await this.wrobj.call("play", [uuid]);
        if (id == null) {
            alert("Could not create WebRTC Instance");
            return false;
        }
        this.id = id;
        this.remote = this.wrobj.child(id);
        if (this.stun != null) {
            this.log("Setting stun server: " + this.stun);
            this.remote.set("stun-server", "stun://" + this.stun)
        }

        this.connect_channel("gaze", (ts, body) => { this.gaze = [ts, body]; });

        /* Setup local object */
        this.keepalive = setInterval(() => {
            this.remote.call("keepalive");
        }, 5000);
        this._candidates = [];
        this._newiceid = await this.remote.connect("new-ice-candidate", (body) => this._new_remote_ice(body));

        /* tell server to setup (will return with the offer SDP) */
        this.log("Requesting SDP");

        var sdp = await this.remote.call("setup", []);
        console.log(sdp);
        if (!sdp) {
            this.loghint("!!! Empty SDP received from setup");
            alert("WebRTC setup returned an empty sdp");
            return false;
        }
        this.loghint("Received SDP", sdp);

        var desc = new SdpDesc(sdp);
        for (var v in desc.streams) {
            if (!(v in this.medias) && !v.startsWith('application'))
                desc.suspend(v);
        }
        /* Set offer to peer */
        await this.peer.setRemoteDescription(new RTCSessionDescription({ type: "offer", sdp: desc.to_sdp() }));

        /* Flush candidate list */
        var candidates = this._candidates;
        delete this._candidates;
        while (candidates.length != 0) {
            var candidate = candidates.pop();
            this.log("Flushing ICE candidate: " + JSON.stringify(candidate));
            this.peer.addIceCandidate(candidate)
                .catch(e => {
                    this.log("Could not set ICE candidate: " + e + " - " + JSON.stringify(candidate));
                });
        }

        /* Create answer from peer and set as local description then use it to
         * start the pipeline */
        var answer = await this.peer.createAnswer();

        await this.peer.setLocalDescription(answer);
        this.loghint("Sending SDP answer", answer.sdp);
        var result = await this.remote.call("start", [answer.sdp]);
        if (!result) {
            this.log("!!! The call to webrtc!start failed");
            alert("WebRTC start failed");
            return false;
        }

        this.log("WebRTC session started");

        window.requestAnimationFrame(() => this._render());
        return true;
    }

    async iframestream(val) {
        this.remote.set("iframe-stream", val);
    }

    running() {
        return this.peer !== undefined;
    }

    send_event(tag, obj) {
        this.remote.call("send-event", [tag, obj]);
    }

    async stop() {
        clearInterval(this.keepalive);
        for (var c in this.channels)
            this.channels[c].close();
        this.channels = {};

        if (this._newiceid !== undefined) {
            this.remote.disconnect(this._newiceid);
            delete this._newiceid;
        }
        for (var id in this.medias) {
            if (this.medias[id].element !== undefined)
                this.medias[id].element.srcObject = null;
            this.medias[id].stream = new MediaStream();
        }

        if (this.remote !== undefined) {
            /* Close will close any signals */
            delete this.remote;
        }
        delete this.gaze;
        await this.wrobj.call("delete", [this.id]);
        delete this.wrobj;
        delete this.peer;
        delete this.id;
        delete this.dchan;
    }
}