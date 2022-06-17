var video = document.getElementById("scene");
var imageData;
var detector;
var debug;
var has_markers = false;
var canvas, context;
var output_canvas, output_context;
var rows, cols;

const offset = 60;

const id_mapping = {
    1: "top-left",
    0: "top-right",
    3: "bottom-left",
    2: "bottom-right",
}
const correct_ids = [0, 1, 2, 3];
var mark_coordinates = {
    "top-left": null,
    "top-right": null,
    "bottom-left": null,
    "bottom-right": null,
};

function getCenter(corners) {
    var x = 0;
    var y = 0;
    for (j = 0; j !== corners.length; ++j) {
        x += corners[j].x;
        y += corners[j].y;
    }
    return [x / 4, y / 4];
}

function onLoad() {
    //video = document.getElementById("scene");
    displayWindowSize();
    detector = new AR.Detector();

    canvas = document.getElementById("canvas");
    context = canvas.getContext("2d");

    output_canvas = document.getElementById("outputCanvas");
    output_context = output_canvas.getContext("2d");

    requestAnimationFrame(tick); //call every frame
    // canvas.width = parseInt(canvas.style.width);
    // canvas.height = parseInt(canvas.style.height);
}

window.onresize = displayWindowSize;

function displayWindowSize() {
    cols = window.innerWidth;
    rows = window.innerHeight;
};

//call every frame
function tick() {
    requestAnimationFrame(tick);
    if (video.readyState === video.HAVE_ENOUGH_DATA) {
        snapshot();
        var markers = detector.detect(imageData);
        drawId(markers);
        has_markers = false;
        if (markers.length >= 4) {
            var ids = [];
            for (var i = 0; i < markers.length; i++) {
                ids.push(markers[i].id);
            }
            let checker = (arr, target) => target.every(v => arr.includes(v));
            has_markers = checker(ids, correct_ids);

        }
        if (has_markers) {
            for (var i = 0; i < markers.length; i++) {
                if (markers[i].id in correct_ids) {
                    mark_coordinates[id_mapping[markers[i].id]] = getCenter(markers[i].corners);
                }
            }
            let img = cv.matFromImageData(imageData);
            if (gaze_x && gaze_y) {
                getTransformedImage(img);
            }
        }
    }
    //console.log(has_markers);
}

function getTransformedImage(img) {
    const from_coordinates = cv.matFromArray(4, 1, cv.CV_32FC2, [
        mark_coordinates["top-right"][0], mark_coordinates["top-right"][1],
        mark_coordinates["top-left"][0], mark_coordinates["top-left"][1],
        mark_coordinates["bottom-left"][0], mark_coordinates["bottom-left"][1],
        mark_coordinates["bottom-right"][0], mark_coordinates["bottom-right"][1],
    ]);
    const des_coordinates = cv.matFromArray(4, 1, cv.CV_32FC2, [
        cols, 0, 0, 0, 0, rows, cols, rows
    ]);
    const M = cv.getPerspectiveTransform(from_coordinates, des_coordinates);
    let dsize = new cv.Size(cols, rows);
    let transformedIm = new cv.Mat();
    cv.warpPerspective(img, transformedIm, M, dsize);
    let m_data = M.data64F;
    let trans_gaze_x = m_data[0] * gaze_x + m_data[1] * gaze_y + m_data[2];
    let trans_gaze_y = m_data[3] * gaze_x + m_data[4] * gaze_y + m_data[5];
    //cv.imshow('outputCanvas', transformedIm);
    ///drawGaze(trans_gaze_x, trans_gaze_y);
    console.log(trans_gaze_x, trans_gaze_y);

    let overlay = document.getElementById("overlay");
    overlay.style.position = 'absolute';
    overlay.style.top = (trans_gaze_y + offset).toString() + 'px';
    overlay.style.left = (trans_gaze_x + offset).toString() + 'px';

    from_coordinates.delete();
    des_coordinates.delete();
    M.delete();
}


function snapshot() {
    context.drawImage(video, 0, 0, canvas.width, canvas.height);
    imageData = context.getImageData(0, 0, canvas.width, canvas.height);
}


function drawId(markers) {
    var corners, corner, x, y, i, j;

    context.strokeStyle = "blue";
    context.lineWidth = 1;

    for (i = 0; i !== markers.length; ++i) {
        corners = markers[i].corners;

        x = Infinity;
        y = Infinity;

        for (j = 0; j !== corners.length; ++j) {
            corner = corners[j];

            x = Math.min(x, corner.x);
            y = Math.min(y, corner.y);
        }

        context.strokeText(markers[i].id, x, y)
    }
}


window.onload = onLoad;