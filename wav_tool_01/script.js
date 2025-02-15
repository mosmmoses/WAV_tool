let waveformChart = null;
let frequencyChart = null;

document.getElementById('file-input').addEventListener('change', function (event) {
  const file = event.target.files[0];
  if (file && file.type === 'audio/wav') {
    const reader = new FileReader();
    reader.onload = function (e) {
      const arrayBuffer = e.target.result;
      processAudio(arrayBuffer, file);
    };
    reader.readAsArrayBuffer(file);
  } else {
    alert('Please upload a valid WAV file.');
  }
});

function processAudio(arrayBuffer, file) {
  const audioContext = new (window.AudioContext || window.webkitAudioContext)();
  audioContext.decodeAudioData(arrayBuffer, function (audioBuffer) {
    const waveform = audioBuffer.getChannelData(0);
    drawWaveform(waveform, audioBuffer.sampleRate);
    drawFrequencyResponse(waveform, audioBuffer.sampleRate);
    playAudio(file);
  });
}

function drawWaveform(waveform, sampleRate) {
  const ctx = document.getElementById('waveformChart').getContext('2d');
  const data = waveform.slice(0, 1000); // Display first 1000 samples
  const t = data.map((_, index) => index / sampleRate); // Create time vector

  if (waveformChart) {
    waveformChart.destroy();
  }

  waveformChart = new Chart(ctx, {
    type: 'line',
    data: {
      labels: t,
      datasets: [{
        label: 'Waveform',
        data: data,
        borderColor: 'blue',
        borderWidth: 1,
        pointRadius: 0
      }]
    },
    options: {
      scales: {
        x: {
          title: {
            display: true,
            text: 'Time (s)'
          },
          ticks: {
            callback: function (value, index, values) {
              return (value / sampleRate).toFixed(3); // Time with 3 decimal places
            }
          }
        },
        y: {
          title: {
            display: true,
            text: 'Amplitude'
          }
        }
      }
    }
  });
}

function drawFrequencyResponse(signal, sampleRate) {
  const fftSize = 2048;
  const buffer = new Float32Array(fftSize);
  buffer.set(signal.slice(0, fftSize));

  const fft = new FFT(fftSize, sampleRate);
  const spectrum = fft.forward(buffer);

  const f = Array.from({ length: spectrum.length }, (_, i) => i * sampleRate / fftSize);
  const P1 = spectrum.map(value => 20 * Math.log10(value));

  const ctx = document.getElementById('frequencyChart').getContext('2d');

  if (frequencyChart) {
    frequencyChart.destroy();
  }

  frequencyChart = new Chart(ctx, {
    type: 'line',
    data: {
      labels: f,
      datasets: [{
        label: 'Frequency Response',
        data: P1,
        borderColor: 'red',
        borderWidth: 1,
        pointRadius: 0
      }]
    },
    options: {
      scales: {
        x: {
          type: 'logarithmic',
          title: {
            display: true,
            text: 'Frequency (Hz)'
          }
        },
        y: {
          title: {
            display: true,
            text: '|P1(f)| (dB)'
          }
        }
      }
    }
  });
}

function playAudio(file) {
  const audioPlayer = document.getElementById('audioPlayer');
  const url = URL.createObjectURL(file);
  audioPlayer.src = url;
  audioPlayer.play();
}

// Additional functionality for wavefile processing
var reader = new FileReader();
var firName = '';

var wav_in = new wavefile.WaveFile();

reader.onload = (function (e) {
  // Reset
  document.getElementById('saveWAV_disclaimer').hidden = true;
  document.getElementById('saveWAV_button').hidden = true;
  document.getElementById('file-input-filename').textContent = '';
  document.getElementById('wavfile_info').textContent = '';

  // Parse wav
  try {
    wav_in.fromDataURI(e.target.result.replace('audio/x-wav', 'audio/wav')); // Подмена заголовка файла для браузеров в макоси
  }
  catch (err) {
    SL_readfile_msg(false, err.message);
    return;
  }

  SL_readfile_msg(true);

  // File info
  document.getElementById('wavfile_info').innerHTML = SL_getwavinfo(wav_in);

  // If format OK show save btn
  if (wav_in.bitDepth == "24" &&
    wav_in.fmt.sampleRate == "48000" &&
    wav_in.fmt.numChannels == "1") {
    document.getElementById('saveWAV_button').hidden = false;
    return;
  } else { // Show disclaimer if format is incorrect
    document.getElementById('saveWAV_disclaimer').hidden = false;
  }
});

document.getElementById('file-input').addEventListener('change', function (e) {
  try {
    reader.readAsDataURL(e.target.files[0]);
    firName = e.target.files[0].name.split('.').slice(0, -1).join('.');
  }
  catch (err) {
    SL_readfile_msg(false, '');
  }
});

function SL_getwavinfo(wav) {
  if (!wav) return null;

  let txt = '';
  txt += "Channels: " + wav.fmt.numChannels + "<br>";
  txt += "Bit depth: " + wav.bitDepth + "<br>";
  txt += "Sample rate: " + wav.fmt.sampleRate + "<br>";
  if (wav.chunkSize != wav.data.chunkSize + wav.fmt.chunkSize + 20) txt += "Metadata: YES" + "<br>"; // Сработает с любым заголовком и без метаданных
  else txt += "Metadata: no" + "<br>";
  if (wav.fmt.chunkSize == 16) txt += "Header length: 16 bytes (short)" + "<br>";
  else txt += "Header length: " + wav.fmt.chunkSize + " bytes (long)" + "<br>";
  return txt;
}

function SL_readfile_msg(success, message) {
  if (success) {
    document.getElementById('file-input-filename').textContent = firName;
    document.getElementById('file-input-filename').style.color = '#555d6c';
  } else {
    if (message == '') {
      message = "Ошибка открытия файла!";
    }
    document.getElementById('file-input-filename').textContent = message;
    document.getElementById('file-input-filename').style.color = 'red';
    firName = '';
  }
}

function SL_getcleanwav(wav) {
  if (wav) {
    let wav_out = new wavefile.WaveFile();

    wav_out.fromScratch(wav.fmt.numChannels, wav.fmt.sampleRate, wav.bitDepth, wav.getSamples());

    return wav_out;
  } else {
    return null;
  }
}

function SL_save_wav() {
  try {
    wav = SL_getcleanwav(wav_in);
  } catch (err) {
    SL_readfile_msg(false, err.message);
    return;
  }
  if (wav) {
    SL_Saver(wav.toBuffer(), firName + "_clean", "wav");
    return;
  }
}

function readSingleFile(e) {
  var file = e.target.files[0];
  if (!file) {
    SL_readfile_msg(false, '');
    firName = '';
    return;
  }
  reader.readAsBinaryString(file);
  firName = file.name.split('.').slice(0, -1).join('.');
}

function SL_Saver(o, name, ext) {
  name = name.replace(/[^a-zA-Z0-9]/g, '_');
  var saveByteArray = (function () {
    var a = document.createElement("a");
    document.body.appendChild(a);
    a.style = "display: none";
    return function (data, name) {
      var blob = new Blob(data, { type: "octet/stream" }),
        url = window.URL.createObjectURL(blob);
      a.href = url;
      a.download = name;
      a.click();
      window.URL.revokeObjectURL(url);
    };
  }());
  saveByteArray([o], name + "." + ext);
}

// FFT definition
class FFT {
  constructor(bufferSize, sampleRate) {
    this.bufferSize = bufferSize;
    this.sampleRate = sampleRate;
    this.spectrum = new Float32Array(bufferSize / 2);
    this.real = new Float32Array(bufferSize);
    this.imag = new Float32Array(bufferSize);
    this.reverseTable = new Uint32Array(bufferSize);
    this.sinTable = new Float32Array(bufferSize);
    this.cosTable = new Float32Array(bufferSize);

    let limit = 1;
    let bit = bufferSize >> 1;

    while (limit < bufferSize) {
      for (let i = 0; i < limit; i++) {
        this.reverseTable[i + limit] = this.reverseTable[i] + bit;
      }
      limit = limit << 1;
      bit = bit >> 1;
    }

    for (let i = 0; i < bufferSize; i++) {
      this.sinTable[i] = Math.sin(-Math.PI / i);
      this.cosTable[i] = Math.cos(-Math.PI / i);
    }
  }

  forward(buffer) {
    const bufferSize = this.bufferSize;
    const cosTable = this.cosTable;
    const sinTable = this.sinTable;
    const reverseTable = this.reverseTable;
    const real = this.real;
    const imag = this.imag;
    const spectrum = this.spectrum;

    if (buffer.length !== bufferSize) {
      throw new Error('Buffer size mismatch');
    }

    for (let i = 0; i < bufferSize; i++) {
      real[i] = buffer[reverseTable[i]];
      imag[i] = 0;
    }

    let halfSize = 1;
    while (halfSize < bufferSize) {
      const phaseShiftStepReal = cosTable[halfSize];
      const phaseShiftStepImag = sinTable[halfSize];
      let currentPhaseShiftReal = 1.0;
      let currentPhaseShiftImag = 0.0;

      for (let fftStep = 0; fftStep < halfSize; fftStep++) {
        let i = fftStep;

        while (i < bufferSize) {
          const off = i + halfSize;
          const tr = (currentPhaseShiftReal * real[off]) - (currentPhaseShiftImag * imag[off]);
          const ti = (currentPhaseShiftReal * imag[off]) + (currentPhaseShiftImag * real[off]);

          real[off] = real[i] - tr;
          imag[off] = imag[i] - ti;
          real[i] += tr;
          imag[i] += ti;

          i += halfSize << 1;
        }

        const tmpReal = currentPhaseShiftReal;
        currentPhaseShiftReal = (tmpReal * phaseShiftStepReal) - (currentPhaseShiftImag * phaseShiftStepImag);
        currentPhaseShiftImag = (tmpReal * phaseShiftStepImag) + (currentPhaseShiftImag * phaseShiftStepReal);
      }

      halfSize = halfSize << 1;
    }

    for (let i = 0; i < bufferSize / 2; i++) {
      spectrum[i] = 2 * Math.sqrt(real[i] * real[i] + imag[i] * imag[i]) / bufferSize;
    }

    return spectrum;
  }
}