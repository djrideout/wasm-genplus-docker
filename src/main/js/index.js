import wasm from './genplus.js';
import './genplus.wasm';

const ROM_PATH = './roms/sonic2.bin';
const CANVAS_WIDTH = 640;
const CANVAS_HEIGHT = 480;
const SOUND_FREQUENCY = 44100;
const SAMPLING_PER_FPS = 736;
const GAMEPAD_API_INDEX = 32;

// emulator
let gens;
let romdata;
let vram;
let input;
let initialized = false;
let pause = false;

// canvas member
let canvas;
let canvasContext;
let canvasImageData;

// fps control
const FPS = 60;
const INTERVAL = 1000 / FPS;
let now;
let then;
let delta;
let startTime;
let fps;
let frame;

// audio member
const DELAY_SOUND_FRAME = 10;
let audioContext;
let audio_l;
let audio_r;
let scheduledSoundTime = 0;
let delaySoundTime = SAMPLING_PER_FPS * DELAY_SOUND_FRAME / SOUND_FREQUENCY;

wasm().then(function(module) {
    gens = module;
    // memory allocate
    gens._init();
    console.log(gens);
    // load rom
    fetch(ROM_PATH).then(response => response.arrayBuffer())
    .then(bytes => {
        // create buffer from wasm
        romdata = new Uint8Array(gens.HEAPU8.buffer, gens._get_rom_buffer_ref(bytes.byteLength), bytes.byteLength);
        romdata.set(new Uint8Array(bytes));
        initialized = true;
    });
});

const start = function() {
    if(!initialized) return;
    canvasContext.clearRect(0, 0, canvas.width, canvas.height);
    // emulator start
    gens._start();
    // vram view
    vram = new Uint8ClampedArray(gens.HEAPU8.buffer, gens._get_frame_buffer_ref(), CANVAS_WIDTH * CANVAS_HEIGHT * 4);
    // audio view
    audio_l = new Float32Array(gens.HEAPF32.buffer, gens._get_web_audio_l_ref(), SAMPLING_PER_FPS);
    audio_r = new Float32Array(gens.HEAPF32.buffer, gens._get_web_audio_r_ref(), SAMPLING_PER_FPS);
    // input
    input = new Float32Array(gens.HEAPF32.buffer, gens._get_input_buffer_ref(), GAMEPAD_API_INDEX);
    // game loop
    then = Date.now();
    loop();
};

const keyscan = function() {
    input.fill(0);
    let gamepads = navigator.getGamepads();
    if(gamepads.length == 0) return;
    let gamepad = gamepads[0];
    if(gamepad == null) return;
    // for Microsoft XBOX ONE
    if(gamepad.id.match(/Microsoft/)) {
        // axes 0 - 7
        gamepad.axes.forEach((value, index) => {
            input[index] = value;
        });
    } else {
        // UP - DOWN
        input[7] = gamepad.axes[1];
        // LEFT - RIGHT
        input[6] = gamepad.axes[0];
    }
    // button 0 - 10
    gamepad.buttons.forEach((button, index) => {
        input[index + 8] = button.value;
    });
};

const sound = function(audioBuffer) {
    let currentSoundTime = audioContext.currentTime;
    let source = audioContext.createBufferSource();
    source.buffer = audioBuffer;
    source.connect(audioContext.destination);
    if(currentSoundTime < scheduledSoundTime) {
        source.start(scheduledSoundTime);
        scheduledSoundTime += audioBuffer.duration;
    } else {
        source.start(currentSoundTime);
        scheduledSoundTime = currentSoundTime + audioBuffer.duration + delaySoundTime;
    }
};

const loop = function() {
    requestAnimationFrame(loop);
    now = Date.now();
    delta = now - then;
    if (delta > INTERVAL && !pause) {
        keyscan();
        // update
        gens._tick();
        then = now - (delta % INTERVAL);
        // sound
        gens._sound();
        let audioBuffer = audioContext.createBuffer(2, SAMPLING_PER_FPS, SOUND_FREQUENCY);
        audioBuffer.getChannelData(0).set(audio_l);
        audioBuffer.getChannelData(1).set(audio_r);
        sound(audioBuffer);
        // draw
        canvasImageData.data.set(vram);
        canvasContext.putImageData(canvasImageData, 0, 0);
        // show fps
        frame++;
        if(new Date().getTime() - startTime >= 1000) {
            fps = frame;
            frame = 0;
            startTime = new Date().getTime();
        }
        canvasContext.fillText("FPS " + fps, 0, 480 - 16);
    }
};

// canvas setting
(function() {
    canvas = document.getElementById('screen');
    canvas.setAttribute('width', CANVAS_WIDTH);
    canvas.setAttribute('height', CANVAS_HEIGHT);
    let pixelRatio = window.devicePixelRatio ? window.devicePixelRatio : 1;
    if(pixelRatio > 1 && window.screen.width < CANVAS_WIDTH) {
        canvas.style.width = CANVAS_WIDTH + "px";
        canvas.style.heigth = CANVAS_HEIGHT + "px";
    }
    canvasContext = canvas.getContext('2d');
    canvasImageData = canvasContext.createImageData(CANVAS_WIDTH, CANVAS_HEIGHT);
    // for iOS audio context
    let click = function() {
        canvas.removeEventListener('click', click, false);
        // audio init
        audioContext = new (window.AudioContext || window.webkitAudioContext)({
            sampleRate: SOUND_FREQUENCY
        });
        // for iOS dummy audio
        let audioBuffer = audioContext.createBuffer(2, SAMPLING_PER_FPS, SOUND_FREQUENCY);
        let dummy = new Float32Array(SAMPLING_PER_FPS);
        dummy.fill(0);
        audioBuffer.getChannelData(0).set(dummy);
        audioBuffer.getChannelData(1).set(dummy);
        sound(audioBuffer);
        // start
        start();
    };
    canvas.addEventListener('click', click, false);
    // start screen
    canvasContext.font = "24px monospace";
    canvasContext.fillStyle = "#fff";
    canvasContext.fillText("TOUCH HERE!", 250, 250);
    // for fps print
    canvasContext.font = "12px monospace";
    canvasContext.fillStyle = "#0f0";
    fps = 0;
    frame = 0;
    startTime = new Date().getTime();
})();
