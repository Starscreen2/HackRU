// Copyright 2023 The MediaPipe Authors.
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//      http://www.apache.org/licenses/LICENSE-2.0
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS IS" BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
// See the License for the specific language governing permissions and
// limitations under the License.
import { ObjectDetector, FilesetResolver } from "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.2";
const demosSection = document.getElementById("demos");
let objectDetector;
let runningMode = "IMAGE";
// Initialize the object detector
const initializeObjectDetector = async () => {
    const vision = await FilesetResolver.forVisionTasks("https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.2/wasm");
    objectDetector = await ObjectDetector.createFromOptions(vision, {
        baseOptions: {
            modelAssetPath: `https://storage.googleapis.com/mediapipe-models/object_detector/efficientdet_lite0/float16/1/efficientdet_lite0.tflite`,
            delegate: "GPU"
        },
        scoreThreshold: 0.5,
        runningMode: runningMode
    });
    demosSection.classList.remove("invisible");
};
initializeObjectDetector();
const socket = new WebSocket("ws://192.168.61.118:81");

/********************************************************************
 // Demo 2: Continuously grab image from webcam stream and detect it.
 ********************************************************************/
let video = document.getElementById("webcam");
const liveView = document.getElementById("liveView");
let enableWebcamButton;
// Check if webcam access is supported.
function hasGetUserMedia() {
    return !!(navigator.mediaDevices && navigator.mediaDevices.getUserMedia);
}
// Keep a reference of all the child elements we create
// so we can remove them easilly on each render.
var children = [];
// If webcam supported, add event listener to button for when user
// wants to activate it.
if (hasGetUserMedia()) {
    enableWebcamButton = document.getElementById("webcamButton");
    enableWebcamButton.addEventListener("click", enableCam);
}
else {
    console.warn("getUserMedia() is not supported by your browser");
}
// Enable the live webcam view and start detection.
async function enableCam(event) {
    if (!objectDetector) {
        console.log("Wait! objectDetector not loaded yet.");
        return;
    }
    // Hide the button.
    enableWebcamButton.classList.add("removed");
    // getUsermedia parameters
    const constraints = {
        video: true
    };
    // Activate the webcam stream.
    navigator.mediaDevices
        .getUserMedia(constraints)
        .then(function (stream) {
        video.srcObject = stream;
        video.addEventListener("loadeddata", predictWebcam);
    })
        .catch((err) => {
        console.error(err);
        /* handle the error */
    });
}
let lastVideoTime = -1;
async function predictWebcam() {
    // if image mode is initialized, create a new classifier with video runningMode.
    if (runningMode === "IMAGE") {
        runningMode = "VIDEO";
        await objectDetector.setOptions({ runningMode: "VIDEO" });
    }
    let startTimeMs = performance.now();
    // Detect objects using detectForVideo.
    if (video.currentTime !== lastVideoTime) {
        lastVideoTime = video.currentTime;
        const detections = objectDetector.detectForVideo(video, startTimeMs);
        //Detection to only focus on th first human
        displayVideoDetections(detections);
    }
    // Call this function again to keep predicting when the browser is ready.
    window.requestAnimationFrame(predictWebcam);
}
function displayVideoDetections(result) {
    // Remove any highlighting from previous frame.
    for (let child of children) {
        liveView.removeChild(child);
    }
    children.splice(0);

    // Check if there are any detections and proceed with the first one
    if (result.detections && result.detections.length > 0) {
        // Considering only the first detection
        let detection = result.detections[0];

        // Existing element creation and appending code here...
        const p = document.createElement("p");
        p.innerText =
            detection.categories[0].categoryName +
            " - with " +
            Math.round(parseFloat(detection.categories[0].score) * 100) +
            "% confidence.";
        p.style =
            "left: " +
            (video.offsetWidth -
                detection.boundingBox.width -
                detection.boundingBox.originX) +
            "px;" +
            "top: " +
            detection.boundingBox.originY +
            "px; " +
            "width: " +
            (detection.boundingBox.width - 10) +
            "px;";

        const highlighter = document.createElement("div");
        highlighter.setAttribute("class", "highlighter");
        highlighter.style =
            "left: " +
            (video.offsetWidth -
                detection.boundingBox.width -
                detection.boundingBox.originX) +
            "px;" +
            "top: " +
            detection.boundingBox.originY +
            "px;" +
            "width: " +
            (detection.boundingBox.width - 10) +
            "px;" +
            "height: " +
            detection.boundingBox.height +
            "px;";

        liveView.appendChild(highlighter);
        liveView.appendChild(p);

        // Store drawn objects in memory so they are queued to delete at next call.
        children.push(highlighter);
        children.push(p);

        // Send the data
        if( detection.categories[0].categoryName == "person"){
        sendData(  detection.boundingBox.height,   detection.boundingBox.width);
        }
        else sendData(0,0);
    }
    else sendData(0,0);
}


function sendData(width,height) {
    
    const dataToSend = height/2;
    fetch("http://192.168.61.118/data", {
        method: "POST",
        headers: {
            "Content-Type": "application/x-www-form-urlencoded"
        },
        body: "data=" + dataToSend
    })
    .then(response => response.text())
    .then(data => {
        console.log("Data sent:", data);
    })
    .catch(error => {
        console.error("Error sending data:", error);
    });
  }