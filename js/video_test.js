var video, canvas, context, imageData;
var output_canvas,output_context;
var detector;
var debug;
var has_markers=false;


const id_mapping={
    1:"top-left",
    0:"top-right",
    3:"bottom-left",
    2:"bottom-right",
    4:"target",
}
const correct_ids=[0,1,2,3,4];
var mark_coordinates={
    "top-left":null,
    "top-right":null,
    "bottom-left":null,
    "bottom-right":null,
    "target":null,
};

function onLoad(){
    video = document.getElementById("view");
    canvas = document.getElementById("canvas");
    debug = document.getElementById("debug");
    context = canvas.getContext("2d");
    output_canvas = document.getElementById("outputCanvas");
    output_context=output_canvas.getContext("2d");

    canvas.width = parseInt(canvas.style.width);
    canvas.height = parseInt(canvas.style.height);
    //get webcam data and show on video element
    if (navigator.mediaDevices === undefined) {
    navigator.mediaDevices = {};
    }
    if (navigator.mediaDevices.getUserMedia === undefined) {
    navigator.mediaDevices.getUserMedia = function(constraints) {
        var getUserMedia = navigator.webkitGetUserMedia || navigator.mozGetUserMedia;
        
        if (!getUserMedia) {
        return Promise.reject(new Error('getUserMedia is not implemented in this browser'));
        }

        return new Promise(function(resolve, reject) {
        getUserMedia.call(navigator, constraints, resolve, reject);
        });
    }
    }
    navigator.mediaDevices
    .getUserMedia({ video: true })
    .then(function(stream) {
        if ("srcObject" in video) {
        video.srcObject = stream;
        } else {
        video.src = window.URL.createObjectURL(stream);
        }
    })
    .catch(function(err) {
        console.log(err.name + ": " + err.message);
    }
    );
    detector = new AR.Detector();

    //call every frame
    requestAnimationFrame(tick);

}

function getCenter(corners){
    var x=0;
    var y=0;
    for (j = 0; j !== corners.length; ++ j){
        x+=corners[j].x;
        y+=corners[j].y;
    }
    return [x/4,y/4];
}

//call every frame
function tick(){
    requestAnimationFrame(tick);

    if (video.readyState === video.HAVE_ENOUGH_DATA){
    snapshot();
    var markers = detector.detect(imageData);
    if (markers.length==5){
        var ids = [];
        for(var i=0;i<markers.length;i++){
            ids.push(markers[i].id);
        }
        if(ids.sort().join(',')=== correct_ids.sort().join(',')){
            has_markers=true;
            for(var i=0;i<markers.length;i++){
                mark_coordinates[id_mapping[markers[i].id]]=getCenter(markers[i].corners);
            }
        }
        else{
            has_markers=false;
        }
    }
    else{
        has_markers=false;
    }
    debug.innerHTML = has_markers;
    drawCorners(markers);
    if (has_markers)
    {
        let img = cv.matFromImageData(imageData);
        let gaze2D = [mark_coordinates["target"][0],mark_coordinates["target"][1],1];
        getTransformedImage(img,gaze2D);
        
    }
    else
    {
        //output_context.clearRect(0, 0, output_canvas.width, output_canvas.height);
    }

    }
}

function getTransformedImage(img,gaze2D)
{
    let cols =  output_canvas.width;
    let rows =  output_canvas.height;
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
    let trans_gaze_x = m_data[0]*gaze2D[0]+m_data[1]*gaze2D[1]+m_data[2];
    let trans_gaze_y = m_data[3]*gaze2D[0]+m_data[4]*gaze2D[1]+m_data[5];
    console.log(trans_gaze_x,trans_gaze_y);
    
    cv.imshow('outputCanvas', transformedIm);   
    drawGaze(trans_gaze_x,trans_gaze_y);

    from_coordinates.delete();
    des_coordinates.delete();
    M.delete();
}


function snapshot(){
    context.drawImage(video, 0, 0, canvas.width, canvas.height);
    imageData = context.getImageData(0, 0, canvas.width, canvas.height);
}

function drawGaze(x,y){
    output_context.strokeStyle = "red";
    let center = new cv.Point(x,y);
    let radius = 10;
    //cv.circle(srcMat,center,radius,[255,0,0,255],15);
    output_context.strokeRect(center.x - radius, center.y - radius, radius*2, radius*2);
}
        
function drawCorners(markers){
    var corners, corner, i, j;

    context.lineWidth = 3;

    for (i = 0; i !== markers.length; ++ i){
        corners = markers[i].corners;
        
        context.strokeStyle = "red";
        context.beginPath();
        
        for (j = 0; j !== corners.length; ++ j){
            corner = corners[j];
            context.moveTo(corner.x, corner.y);
            corner = corners[(j + 1) % corners.length];
            context.lineTo(corner.x, corner.y);
        }

        context.stroke();
        context.closePath();
        
        context.strokeStyle = "green";
        context.strokeRect(corners[0].x - 2, corners[0].y - 2, 4, 4);
    }
}


window.onload = onLoad;

