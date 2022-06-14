var menuitems = {
    "Home": "index.html",
    "Live": "live.html"
};

var ICON_EMPTY = "&nbsp;";
var ICON_WAIT = "&#10711;";
var ICON_COM = "&#9889;";
var ICON_PLAY = "&#9654;";
var ICON_STOP = "&#9632;";
var ICON_CALIBRATE = "&#9673;";
var ICON_OK = "&#10004";
var ICON_CANCEL = "&#10008";
var ICON_RECORD = "&#9899";
var ICON_REFRESH = "&#8635;"

var statusdiv = document.createElement("span")
statusdiv.innerHTML = ICON_COM;
statusdiv.classList.add("menu");
statusdiv.classList.add("right");

/* Build menu */
function common_menu() {
    var page = window.location.pathname.split("/").slice(-1)[0];
    var menu = document.createElement("div");
    var icon = document.createElement('link');
    icon.type = "image/png";
    icon.rel = "shortcut icon";
    icon.href = "resources/favicon.png";
    document.getElementsByTagName('head')[0].appendChild(icon);

    menu.y = 0;
    menu.classList.add("menu");
    const urlParams = new URLSearchParams(window.location.search).toString();
    for (var i in menuitems) {
        var a = document.createElement("a");
        a.classList.add("menu");
        if (menuitems[i] == page)
            a.classList.add("menuactive");

        a.innerHTML = i;
        var url = menuitems[i];
        if (urlParams != "")
            url = url + "?" + urlParams;

        a.href = url;
        menu.appendChild(a);
    }
    menu.appendChild(statusdiv);
    document.body.prepend(menu);
}

common_menu();

function g3_dur_to_time(dur, dig = 0) {
    if (dur < 0)
        return "-:--:--";
    var h = Math.floor(dur / (60 * 60));
    var m = Math.floor((dur.toFixed(0) % (60 * 60)) / 60);
    if (m < 10)
        m = "0" + m;
    var s = Math.floor(dur) % 60;
    if (s < 10)
        s = "0" + s;
    d = (dig > 0) ? "." : "";

    return h + ":" + m + ":" + s;
}

var g3_checkbox_cnt = 0;

function g3_checkbox(title = "") {
    g3_checkbox_cnt++;
    var id = "checkbox" + g3_checkbox_cnt;
    var div = document.createElement("div");
    var box = document.createElement("input");
    box.type = "checkbox";
    box.id = id;
    div.append(box);
    var lbl = document.createElement("label");
    lbl.innerHTML = title;
    lbl.setAttribute("for", id);
    div.append(lbl);
    return [div, box];
}


class G3PopUp {
    constructor(headtext, label) {
        this.div = document.createElement("div");
        this.div.classList.add("popup");
        var box = document.createElement("div");
        box.classList.add("box");
        this.div.append(box);

        var head = document.createElement("h1");
        head.innerHTML = headtext;
        box.append(head);

        this.info = document.createElement("div");
        this.info.classList.add("info");
        this.info.innerHTML = label;
        box.append(this.info);
        document.getElementsByTagName("body")[0].append(this.div);
    }
}

function g3_v2s(vert, decimals = 3, leftpad = 0) {
    var s = [];
    vert.forEach((v) => {
        s.push(((v >= 0) ? " " + v.toFixed(decimals) : v.toFixed(decimals)).padStart(leftpad, " "))
    });
    return "(" + s.join(", ") + ")";
}