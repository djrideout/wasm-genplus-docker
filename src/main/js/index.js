import wasm from './genplus.js';
import './genplus.wasm';
import process from 'process'

const ROM_PATH = process.env['ROM_PATH'];
const CANVAS_WIDTH = 320;
const CANVAS_HEIGHT = 224;
const SOUND_FREQUENCY = 44100;
const SAMPLING_PER_FPS = 736;
const GAMEPAD_API_INDEX = 32;

// emulator
let gens;
let romdata;
let vram;
let input;
let keysPrev = {};
let keysCurr = {};
let keysNext = {};
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
const SOUND_DELAY_FRAME = 8;
let audioContext;
let audio_l;
let audio_r;
let soundShedTime = 0;
let soundDelayTime = SAMPLING_PER_FPS * SOUND_DELAY_FRAME / SOUND_FREQUENCY;

// for iOS
let isSafari = false;

const message = function(mes) {
    canvasContext.clearRect(0, 0, canvas.width, canvas.height);
    canvasContext.font = "24px monospace";
    canvasContext.fillStyle = "#fff";
    canvasContext.fillText(mes, 90, 110);
    canvasContext.font = "12px monospace";
    canvasContext.fillStyle = "#0f0";
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
    let keydown = function (e) {
        keysNext[e.code] = true;
    }
    canvas.addEventListener('keydown', keydown);
    let keyup = function (e) {
        keysNext[e.code] = false;
    }
    canvas.addEventListener('keyup', keyup);
    // start screen
    message("NOW LOADING");
    // for fps print
    fps = 0;
    frame = FPS;
    startTime = new Date().getTime();
})();

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
        message("TOUCH HERE!");
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
    // iOS
    let ua = navigator.userAgent
    if(ua.match(/Safari/) && !ua.match(/Chrome/) && !ua.match(/Edge/)) {
        isSafari = true;
    }
    // game loop
    then = Date.now();
    loop();
};

const GenButtons = {
    UP_DOWN:     7,
    LEFT_RIGHT:  6,
    INPUT_A:     10,
    INPUT_B:     11,
    INPUT_C:     9,
    INPUT_START: 15,
    INPUT_X:     8,
    INPUT_Y:     12,
    INPUT_Z:     13,
    INPUT_MODE:  14
};

const Keymap = {
    ["ArrowUp"]:    { index: GenButtons.UP_DOWN, value: -1 },
    ["ArrowDown"]:  { index: GenButtons.UP_DOWN, value: 1 },
    ["ArrowLeft"]:  { index: GenButtons.LEFT_RIGHT, value: -1 },
    ["ArrowRight"]: { index: GenButtons.LEFT_RIGHT, value: 1 },
    ["KeyZ"]:       { index: GenButtons.INPUT_A, value: 1 },
    ["KeyX"]:       { index: GenButtons.INPUT_B, value: 1 },
    ["KeyC"]:       { index: GenButtons.INPUT_C, value: 1 },
    ["KeyA"]:       { index: GenButtons.INPUT_X, value: 1 },
    ["KeyS"]:       { index: GenButtons.INPUT_Y, value: 1 },
    ["KeyD"]:       { index: GenButtons.INPUT_Z, value: 1 },
    ["Enter"]:      { index: GenButtons.INPUT_START, value: 1 },
    ["Backspace"]:  { index: GenButtons.INPUT_MODE, value: 1 }
};
const Keys = Object.keys(Keymap);

const keyscan = function() {
    for (let key of Keys) {
        if (input[Keymap[key].index] + Keymap[key].value === 0) {
            // Prevent L+R/U+D
            continue;
        }
        keysPrev[key] = keysCurr[key];
        keysCurr[key] = keysNext[key];
        if (!keysPrev[key] && keysCurr[key]) {
            input[Keymap[key].index] = Keymap[key].value;
        } else if (keysPrev[key] && !keysCurr[key]) {
            input[Keymap[key].index] = 0;
        }
    }
    let gamepads = navigator.getGamepads();
    if (gamepads.length && gamepads[0] !== null) {
        let gamepad = gamepads[0];
        if(isSafari) {
            // for iOS Microsoft XBOX ONE
            // UP - DOWN
            input[7] |= gamepad.axes[5] * -1;
            // LEFT - RIGHT
            input[6] |= gamepad.axes[4];
        } else if(gamepad.id.match(/Microsoft/)) {
            // for Microsoft XBOX ONE
            // axes 0 - 7
            gamepad.axes.forEach((value, index) => {
                input[index] |= value;
            });
        } else {
            // UP - DOWN
            input[7] |= gamepad.axes[1];
            // LEFT - RIGHT
            input[6] |= gamepad.axes[0];
        }
        gamepad.buttons.forEach((button, index) => {
            input[index + 8] |= button.value;
        });
    }
};

const sound = function(audioBuffer) {
    let source = audioContext.createBufferSource();
    source.buffer = audioBuffer;
    source.connect(audioContext.destination);
    let currentSoundTime = audioContext.currentTime;
    if(currentSoundTime < soundShedTime) {
        source.start(soundShedTime);
        soundShedTime += audioBuffer.duration;
    } else {
        source.start(currentSoundTime);
        soundShedTime = currentSoundTime + audioBuffer.duration + soundDelayTime;
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
        // draw
        canvasImageData.data.set(vram);
        canvasContext.putImageData(canvasImageData, 0, 0);
        // fps
        frame++;
        if(new Date().getTime() - startTime >= 1000) {
            fps = frame;
            frame = 0;
            startTime = new Date().getTime();
        }
        // sound
        gens._sound();
        // sound hack
        if(fps < FPS) {
            soundShedTime = 0;
        } else {
            let audioBuffer = audioContext.createBuffer(2, SAMPLING_PER_FPS, SOUND_FREQUENCY);
            audioBuffer.getChannelData(0).set(audio_l);
            audioBuffer.getChannelData(1).set(audio_r);
            sound(audioBuffer);
        }
    }
};
