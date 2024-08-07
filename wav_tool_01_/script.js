let waveformChart = null;
let frequencyChart = null;
let originalWaveform = null;
let adjustedWaveform = null;
let audioContext = null;
let source = null;

var reader = new FileReader();
var firName = '';
var wav_in = new wavefile.WaveFile();

// Обработчик события 'change' для элемента input с id 'file-input'
// Срабатывает при выборе wav - файла
// @event - Событие изменения input элемента
document.getElementById('file-input').addEventListener('change', function (event) {
  const file = event.target.files[0];
  if (file && (file.type === 'audio/wav' || file.type === 'audio/x-wav')) { //макось, курва, и её x-wav
    // Обработчик загрузки файла
    reader.onload = function (e) {
      try {
        // Чтение файла и замена 'audio/x-wav' (для mac)
        wav_in.fromDataURI(e.target.result.replace('audio/x-wav', 'audio/wav'));
        SL_readfile_msg(true);
        // Извлечение данных файла
        const arrayBuffer = e.target.result.split(',')[1];
        // Создание "аудиоконтекста"
        audioContext = new (window.AudioContext || window.webkitAudioContext)();
        // Декодирование аудиофайла
        audioContext.decodeAudioData(processAudio(arrayBuffer), function (buffer) {
          originalWaveform = buffer.getChannelData(0);
          // Корректировка громкости
          //adjustedWaveform = adjustVolume(originalWaveform, 0);
          // drawWaveform(originalWaveform, buffer.sampleRate);
          // drawFrequencyResponse(originalWaveform, buffer.sampleRate);
          // playAudio(originalWaveform, buffer.sampleRate);

          // Передача данных в функцию отображения информации о загруженном файле
          displayFileInfo(wav_in, buffer.sampleRate, originalWaveform);
        });

      } catch (err) {
        // Обработчик ошибок при чтении файла
        SL_readfile_msg(false, err.message);
      }
    };
    reader.readAsDataURL(file);
    // Получение имени файла без расширения
    firName = file.name.split('.').slice(0, -1).join('.');
  } else {
    alert('Please upload a valid WAV file.');
  }
});

// processAudio Преобразует аудио в массив данных для дальнейшей обработки
// Возвращает массив байтов
// @arrayBuffer - Содержит данные аудио файла в виде строки base64
function processAudio(arrayBuffer) {
  const binaryString = window.atob(arrayBuffer);
  const len = binaryString.length;
  const bytes = new Uint8Array(len);
  for (let i = 0; i < len; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  return bytes.buffer;
}

// displayFileInfo Отображает информацию о загруженном файле, выводит графики формы волны и АЧХ
// Возвращает void
// @wav - Объект WaveFile с информацией о файле
// @sampleRate - Частота дискретизации файла
// @waveform - Данные аудиофайла: Float32Array, содержащий данные PCM
function displayFileInfo(wav, sampleRate, waveform) {
  const infoBox = document.getElementById('wavfile_info');
  const saveButton = document.getElementById('saveWAV_button');
  const disclaimer = document.getElementById('saveWAV_disclaimer');

  const sampleRateError = (wav.fmt.sampleRate !== 48000) ? " (Error, 48kHz only)" : "";
  const bitDepthError = (wav.bitDepth !== '24') ? " (Error, 24bit only)" : "";
  const channelsError = (wav.fmt.numChannels !== 1) ? " (Error, mono only)" : "";
  const metadataDisplay = (wav.chunkSize !== wav.data.chunkSize + wav.fmt.chunkSize + 20) ? "YES" : "NO";
  const headerLengthDisplay = (wav.fmt.chunkSize === 16) ? "16 (short)" : `${wav.fmt.chunkSize} (long)`;
  const samplesCount = wav.getSamples(true).length;

  //вывод рмс громкости исходного файла
  const rmsValue = calculateRMS(wav.getSamples(true));
  const dBValue = rmsToDb(rmsValue);

  //вывод пиковой громкости исходного файла
  let samples = wav.getSamples(true);
  const peaklev = Math.max.apply(null, samples); 
  const peaklevdb = rmsToDb(peaklev/Math.pow(2, wav.bitDepth));

  infoBox.innerHTML = `
    <p>Sample rate: ${wav.fmt.sampleRate}Hz${sampleRateError}</p>
    <p>Bit Depth: ${wav.bitDepth}bit${bitDepthError}</p>
    <p>Channels: ${wav.fmt.numChannels}${channelsError}</p>
    <p>Metadata: ${metadataDisplay}</p>
    <p>Header length: ${headerLengthDisplay}</p>
    <p>Samples: ${samplesCount}</p>
    <p>RMS level [dB]: ${dBValue.toFixed(3)} </p>   
    <p>Peak level [dB]: ${peaklevdb.toFixed(3)} </p>   
  `;

  if (wav.fmt.numChannels === 1 && wav.fmt.sampleRate === 48000 && wav.bitDepth === '24') {
    // Отображение элементов управления и плеера
    disclaimer.style.display = 'none'; // Скрытие дисклеймера
    saveButton.style.display = 'block';
    volumeControls.hidden = false;
    audioPlayer.hidden = false;
    // Только если формат файла соответствует требованиям, вызываем функции отображения графиков и плеера
    drawWaveform(waveform, sampleRate);
    drawFrequencyResponse(waveform, sampleRate);
    playAudio(waveform, sampleRate);
  } else {
    disclaimer.style.display = 'block';
    saveButton.style.display = 'none';
    volumeControls.hidden = true;
    audioPlayer.hidden = true;
    clearVisualization();  // Очистка визуала при неподходящем файле
  }
}

// clearVisualization Очищает графики и останавливает аудиоплеер
// Возвращает void
function clearVisualization() {
  const waveformChartCanvas = document.getElementById('waveformChart').getContext('2d');
  const frequencyChartCanvas = document.getElementById('frequencyChart').getContext('2d');
  const audioPlayer = document.getElementById('audioPlayer');
  // Очищаем канвасы
  if (waveformChart) {
    waveformChart.destroy();
  }
  if (frequencyChart) {
    frequencyChart.destroy();
  }
  // Остановка и скрытие аудиоплеера
  if (audioPlayer) {
    audioPlayer.pause();
    audioPlayer.src = '';
  }
  // Очистка изображений на канвасах, если графики были удалены
  waveformChartCanvas.clearRect(0, 0, waveformChartCanvas.canvas.width, waveformChartCanvas.canvas.height);
  frequencyChartCanvas.clearRect(0, 0, frequencyChartCanvas.canvas.width, frequencyChartCanvas.canvas.height);
}

// drawWaveform Рисует график формы волны
// Возвращает void
// @waveform - Данные аудиофайла: Float32Array, содержащий данные PCM
// @sampleRate - Частота дискретизации файла
function drawWaveform(waveform, sampleRate) {
  const ctx = document.getElementById('waveformChart').getContext('2d');
  const data = waveform.slice(0, waveform.length);
  let t = data.map((_, index) => index / sampleRate);

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
            callback: function (value) {
              return (value / sampleRate).toFixed(3);
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

// drawFrequencyResponse Рисует график АЧХ
// Возвращает void
// @signal - Данные аудиофайла: Float32Array, содержащий данные PCM
// @sampleRate - Частота дискретизации файла
function drawFrequencyResponse(signal, sampleRate) {
  const fftSize = 1024;
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

// playAudio Проигрывает аудио через Web Audio API
// Возвращает void
// @waveform - Данные аудиофайла: Float32Array, содержащий данные PCM
// @sampleRate - Частота дискретизации файла
function playAudio(waveform, sampleRate) {
  if (source) {
    source.stop();
  }

  const audioBuffer = audioContext.createBuffer(1, waveform.length, sampleRate);
  audioBuffer.getChannelData(0).set(waveform);

  source = audioContext.createBufferSource();
  source.buffer = audioBuffer;
  source.connect(audioContext.destination);
  source.start(0);

  const audioPlayer = document.getElementById('audioPlayer');
  const wavBlob = new Blob([wav_in.toBuffer()], { type: 'audio/wav' });
  audioPlayer.src = URL.createObjectURL(wavBlob);
}

// adjustVolume Регулирует громкость до заданного уровня RMS
// Возвращает новый буфер с измененной громкостью
// @waveform - Исходный буфер данных аудио: Float32Array, содержащий данные PCM
// @targetRMS - Целевой уровень RMS в дБ
function adjustVolume(waveform, targetRMS) {
  const targetAmplitude = Math.pow(10, targetRMS / 20);
  const currentRMS = calculateRMS(waveform.slice(0, waveform.length));
  // const currentRMS = calculateRMS(waveform.slice(0, 1000));
  const currentAmplitude = Math.pow(10, rmsToDb(currentRMS) / 20);
  const scaleFactor = (targetAmplitude / currentAmplitude);
  return waveform.map(sample => sample * scaleFactor);
}

// то же, что adjust volume, но без автоуровня, просто аттенюация
function SL_attenuate(waveform, levdb) {
  //так как нет функции дб в амплитуду, то буду считать сам тут. Надо будет переделать

  const gain = Math.pow(10, levdb/20); // опять же 20 захардкожена, исправить потом
  const scaleFactor = (targetAmplitude / currentAmplitude);
  return waveform.map(sample => sample * scaleFactor);
}

// function dBReduction(waveform, dB) {
//   const factor = Math.pow(10, dB / 20);
//   return waveform.map(sample => sample * factor);
// }

// calculateRMS Вычисляет RMS waveform
// Возвращает RMS значение
// @waveform - Данные аудиофайла: Float32Array, содержащий данные PCM
function calculateRMS(waveform) {
  const sampleLength = waveform.length;
  let sumOfSquares = 0;

  for (let i = 0; i < waveform.length; i++) {
    sumOfSquares += waveform[i] * waveform[i] / Math.pow(Math.pow(2, 24), 2); //битность 24 хардкод, надо брать из файла
  }

  return Math.sqrt(sumOfSquares / sampleLength);
}


/*
2DO: не рмс, а любое знаение в дб. Дб это как бы относительное значение, а функция преобразует
абсолютные в относительные - и должна быть функция наоборот еще. 
И должен быть выбор амплитуда у нас или мощность, там разные формулы (20 или 10 в коэффициенте), от этого зависит результат, и децибелы для рмс и для пик-громкостей разные!
ссыль https://sengpielaudio.com/calculator-gainloss.htm
*/
// rmsToDb Преобразует RMS значение в дБ
// Возвращает значение в дБ
function rmsToDb(rms) {
  return 20 * Math.log10(rms);
}

//2DO: дописать
//value/db - исходные данные
//eference - относительно чего считаем децибелы
//type - амплитуда или мощность
function ValueToDb(value, reference, type) { return; }
function DbToValue(db, reference, type) { return; }

// Обработчик изменения громкости через радио кнопки
document.querySelectorAll('input[name="volume"]').forEach(radio => {
  radio.addEventListener('change', function (event) {
    const dBValue = parseFloat(event.target.value);
    adjustedWaveform = adjustVolume(originalWaveform, dBValue);
    drawWaveform(adjustedWaveform, audioContext.sampleRate);
    drawFrequencyResponse(adjustedWaveform, audioContext.sampleRate);
    playAudio(adjustedWaveform, audioContext.sampleRate);
  });
});

// SL_readfile_msg Отображает сообщение о состоянии чтения файла
// Возвращает void
// @success - Указывает, успешно ли было чтение файла: bool
// @message - Сообщение об ошибке (если есть)
function SL_readfile_msg(success, message) {
  const filenameDisplay = document.getElementById('file-input-filename');
  if (success) {
    filenameDisplay.textContent = firName;
    filenameDisplay.style.color = '#555d6c';
  } else {
    if (message == '') {
      message = "Ошибка открытия файла!";
    }
    filenameDisplay.textContent = message;
    filenameDisplay.style.color = 'red';
    firName = '';
  }
}

// function SL_getcleanwav(wav) {
//   if (wav) {
//     let wav_out = new wavefile.WaveFile();
//     wav_out.fromScratch(wav.fmt.numChannels, wav.fmt.sampleRate, wav.bitDepth, wav.getSamples());
//     return wav_out;
//   } else {
//     return null;
//   }
// }

// SL_save_wav Сохраняет текущий измененный буфер с аудиоданными в файл WAV
// Возвращает void
function SL_save_wav() {
  try {
    // Новый буфер
    const saveBuffer = audioContext.createBuffer(1, adjustedWaveform.length, audioContext.sampleRate);
    saveBuffer.getChannelData(0).set(adjustedWaveform);
    // Новый объект WaveFile для сохранения результатов
    let wav_out = new wavefile.WaveFile();
    wav_out.fromScratch(1, audioContext.sampleRate, '24', saveBuffer.getChannelData(0));
    // Установка параметров выгружаемого файла
    wav_out.fromScratch(1, audioContext.sampleRate, '24', adjustedWaveform);
    wav_out.toBitDepth('24');
    const outputWav = wav_out.toBuffer();
    SL_Saver(outputWav, firName + "_clean", "wav");
  } catch (err) {
    SL_readfile_msg(false, err.message);
  }
}

// SL_Saver Сохраняет Blob объект как файл на локальном устройстве
// Возвращает void
// @o - Blob объект для сохранения
// @name - Имя файла без расширения
// @ext - Расширение файла
function SL_Saver(o, name, ext) {
  name = name.replace(/[^a-zA-Z0-9]/g, '_');
  var a = document.createElement("a");
  document.body.appendChild(a);
  a.style = "display: none";
  var blob = new Blob([o], { type: "audio/wav" }),
    url = window.URL.createObjectURL(blob);
  a.href = url;
  a.download = name + "." + ext;
  a.click();
  window.URL.revokeObjectURL(url);
  document.body.removeChild(a);
}


// FFT definition
// Source: https://gist.github.com/corbanbrook/4ef7ce98fe4453d754cd7e4a341d6e5b
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