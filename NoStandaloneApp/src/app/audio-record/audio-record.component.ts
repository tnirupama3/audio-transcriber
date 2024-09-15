import { Component } from '@angular/core';

@Component({
  selector: 'app-audio-record',
  templateUrl: './audio-record.component.html',
  styleUrls: ['./audio-record.component.css']
})
export class AudioRecordComponent {
  mediaRecorder: MediaRecorder | null = null;
  recordedChunks: any[] = [];
  isRecording: boolean = false;
  transcription: string = '';

  constructor() {}

  // Start recording using the MediaRecorder API
  startRecording() {
    this.recordedChunks = [];
    navigator.mediaDevices.getUserMedia({ audio: true })
      .then((stream) => {
        this.mediaRecorder = new MediaRecorder(stream);  // Default format is webm/ogg
        this.mediaRecorder.start();
        this.isRecording = true;

        this.mediaRecorder.ondataavailable = (event: any) => {
          if (event.data.size > 0) {
            this.recordedChunks.push(event.data);
          }
        };

        this.mediaRecorder.onstop = async () => {
          this.isRecording = false;
          console.log('Recording stopped. Converting to WAV...');
          const wavBlob = await this.convertToWav(new Blob(this.recordedChunks, { type: this.mediaRecorder?.mimeType }));
          this.uploadRecording(wavBlob);
        };
      })
      .catch((err) => {
        console.error('Error accessing microphone:', err);
      });
  }

  // Stop the recording process
  stopRecording() {
    if (this.mediaRecorder) {
      this.mediaRecorder.stop();
    }
  }

  // Upload the WAV file to the backend
  uploadRecording(wavBlob: Blob) {
    const formData = new FormData();
    formData.append('audio_file', wavBlob, 'recording.wav');

    fetch('http://127.0.0.1:8000/vad/', {
      method: 'POST',
      body: formData,
    })
    .then(response => response.json())
    .then(data => {
      if (data.transcription) {
        this.transcription = data.transcription;
        console.log('Transcription:', this.transcription);
      } else {
        console.error('No transcription received');
      }
    })
    .catch(error => {
      console.error('Error uploading audio:', error);
    });
  }

  // Method to convert the recorded audio Blob to WAV format
  async convertToWav(audioBlob: Blob): Promise<Blob> {
    const audioContext = new AudioContext();  // Standardized AudioContext
    const audioBuffer = await audioContext.decodeAudioData(await audioBlob.arrayBuffer());

    const wavBuffer = this.audioBufferToWav(audioBuffer);
    return new Blob([wavBuffer], { type: 'audio/wav' });
  }

  // Helper function to convert AudioBuffer to WAV format
  audioBufferToWav(buffer: AudioBuffer): ArrayBuffer {
    const numOfChannels = buffer.numberOfChannels;
    const length = buffer.length * numOfChannels * 2 + 44;
    const arrayBuffer = new ArrayBuffer(length);
    const view = new DataView(arrayBuffer);
    const channels = [];

    let offset = 0;
    let position = 0;

    // Write WAV header
    this.writeString(view, position, 'RIFF'); position += 4;
    view.setUint32(position, length - 8, true); position += 4;
    this.writeString(view, position, 'WAVE'); position += 4;
    this.writeString(view, position, 'fmt '); position += 4;
    view.setUint32(position, 16, true); position += 4;
    view.setUint16(position, 1, true); position += 2;
    view.setUint16(position, numOfChannels, true); position += 2;
    view.setUint32(position, buffer.sampleRate, true); position += 4;
    view.setUint32(position, buffer.sampleRate * numOfChannels * 2, true); position += 4;
    view.setUint16(position, numOfChannels * 2, true); position += 2;
    view.setUint16(position, 16, true); position += 2;
    this.writeString(view, position, 'data'); position += 4;
    view.setUint32(position, length - position - 4, true); position += 4;

    // Interleave audio data
    for (let i = 0; i < numOfChannels; i++) {
      channels.push(buffer.getChannelData(i));
    }

    while (offset < buffer.length) {
      for (let i = 0; i < numOfChannels; i++) {
        const sample = Math.max(-1, Math.min(1, channels[i][offset]));
        view.setInt16(position, sample < 0 ? sample * 0x8000 : sample * 0x7FFF, true);
        position += 2;
      }
      offset++;
    }

    return arrayBuffer;
  }

  // Helper function to write string data
  writeString(view: DataView, offset: number, string: string) {
    for (let i = 0; i < string.length; i++) {
      view.setUint8(offset + i, string.charCodeAt(i));
    }
  }

  // Download the recorded audio as a file
  downloadRecording() {
    const blob = new Blob(this.recordedChunks, { type: this.mediaRecorder?.mimeType });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.style.display = 'none';
    a.href = url;
    a.download = 'recording.' + this.mediaRecorder?.mimeType.split('/')[1];
    document.body.appendChild(a);
    a.click();
    window.URL.revokeObjectURL(url);
  }
}
