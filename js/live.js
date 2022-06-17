var gaze_x = null;
var gaze_y = null;

const scenev_width = 1920;
const scenev_height = 1080;

function gaze(ts, msg, type) {
    if ("gaze2d" in msg) {
        gaze_x = msg["gaze2d"][0] * scenev_width;
        gaze_y = msg["gaze2d"][1] * scenev_height;
    } else {
        gaze_x = null;
        gaze_y = null;
    }
}

class BurnInGaze {
    constructor(root) {
        this.settings = root.child("settings");
        this.live = null;
        this.gaze = null;
        this.id = 0;

    }

    async update() {
        var ovlset = await this.settings.get("gaze-overlay");
        this.live.drawovl = this.gaze.value == "always" || (this.gaze.value == "default" && !ovlset);
    }

    set_live(live) {
        this.live = live;
        if (this.live) {
            this.settings.connect("changed", (name) => this.update())
                .then((id) => {
                    this.id = id;
                });
            this.update();
            this.gaze = document.getElementById("gazeoverlay");
            this.gaze.addEventListener('change', (event) => {
                this.update();
            });
        } else {
            this.settings.disconnect(this.id);
        }

    }
}

async function init_live() {
    let root = new G3Obj();
    var live = null;
    await root.open();
    console.log("wait root open");
    var localip = await root.call("remote-host", []);
    var burnin = new BurnInGaze(root);

    var play = document.getElementById("play");
    play.onclick = async() => {
        play.disabled = true;
        //var eyes = document.getElementById("eyes");
        if (live == null) {
            var useeyes = false; //document.getElementById("useeyes").checked;
            var usestun = false; //document.getElementById("usestun").checked;
            var uselocalip = false; //document.getElementById("uselocalip").checked;
            // if (useeyes)
            //     eyes.classList.remove("hide");
            // else
            //     eyes.classList.add("hide");
            var stunserver = null;
            if (usestun)
                stunserver = stunel.value;
            live = new WebRtc(
                video, //document.getElementById("scene"),
                null, //(useeyes ? eyes : null),
                null, //document.getElementById("overlay"),
                null, //(uselocalip ? localip : null),
                null,
                stunserver
            );
            await live.start(null, root.child("webrtc"));
            live.connect_channel("gaze", (ts, body, type) => gaze(ts, body, type));
            burnin.set_live(live);
            play.innerHTML = ICON_STOP;
        } else {
            //eyes.classList.add("hide");
            burnin.set_live(null);
            await live.stop();
            live = null;
            play.innerHTML = ICON_PLAY;
        }
        play.disabled = false;
    };

    var calib = document.getElementById("calib");
    calib.onclick = async() => {
        calib.innerHTML = ICON_CALIBRATE + ICON_WAIT;
        var succ = await root.child("calibrate").call("run");
        if (succ)
            calib.innerHTML = ICON_CALIBRATE + ICON_OK;
        else
            calib.innerHTML = ICON_CALIBRATE + ICON_CANCEL;
    };

}
init_live();