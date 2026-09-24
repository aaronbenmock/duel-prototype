import './style.css';
import { AudioEngine } from './audio/audio';
import { MotionSensors } from './input/motion';
import { installRotateOverlay, ScreenAwake } from './platform/platform';
import { mountSensorCheck } from './render/sensorCheck';

const sensors = new MotionSensors();
const audio = new AudioEngine();
const awake = new ScreenAwake();

installRotateOverlay();
mountSensorCheck(document.getElementById('app')!, sensors, audio, awake);
