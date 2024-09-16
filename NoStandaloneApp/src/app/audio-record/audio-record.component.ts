import { Component, ChangeDetectorRef } from '@angular/core';

@Component({
  selector: 'app-audio-record',
  templateUrl: './audio-record.component.html',
  styleUrls: ['./audio-record.component.css']
})
export class AudioRecordComponent {
  mediaRecorder: MediaRecorder | null = null;
  recordedChunks: Blob[] = [];
  isRecording: boolean = false;
  transcription: string = '';

  constructor(private cd: ChangeDetectorRef) {}

  // Start recording using the MediaRecorder API
  startRecording() {
    this.recordedChunks = [];
    this.transcription = '';  // Clear previous transcription when starting a new recording

    navigator.mediaDevices.getUserMedia({ audio: true })
      .then((stream) => {
        this.mediaRecorder = new MediaRecorder(stream);
        this.isRecording = true;
        this.mediaRecorder.start();

        // Collect audio data when available
        this.mediaRecorder.ondataavailable = (event: any) => {
          if (event.data.size > 0) {
            this.recordedChunks.push(event.data);
          }
        };

        this.mediaRecorder.onstop = async () => {
          this.isRecording = false;
          const wavBlob = await this.convertToWav(new Blob(this.recordedChunks, { type: this.mediaRecorder?.mimeType }));
          this.uploadRecording(wavBlob);  // Immediately upload after stopping recording
          this.cd.detectChanges();  // Trigger change detection to update the UI
        };
      })
      .catch((err) => {
        console.error('Error accessing microphone:', err);
      });
  }

  // Stop the recording process
  stopRecording() {
    if (this.mediaRecorder && this.isRecording) {
      this.mediaRecorder.stop();  // Stop the media recorder
    }
  }

  // Upload the WAV file to the backend and display transcription on the frontend
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
        this.transcription = data.transcription;  // Set transcription to display
        this.cd.detectChanges();  // Manually trigger change detection
        console.log('Transcription received:', this.transcription);
      } else {
        console.error('No transcription received');
      }
    })
    .catch(error => {
      console.error('Error uploading audio:', error);
    });
  }

  // Convert the recorded audio Blob to WAV format for compatibility
  async convertToWav(audioBlob: Blob): Promise<Blob> {
    const audioContext = new AudioContext();  // Initialize AudioContext for decoding
    const audioBuffer = await audioContext.decodeAudioData(await audioBlob.arrayBuffer());

    const wavBuffer = this.audioBufferToWav(audioBuffer);  // Convert AudioBuffer to WAV format
    return new Blob([wavBuffer], { type: 'audio/wav' });
  }

  // Helper function to convert AudioBuffer to WAV format
  audioBufferToWav(buffer: AudioBuffer): ArrayBuffer {
    const numOfChannels = buffer.numberOfChannels;
    const length = buffer.length * numOfChannels * 2 + 44;  // WAV header is 44 bytes
    const arrayBuffer = new ArrayBuffer(length);
    const view = new DataView(arrayBuffer);
    const channels: Float32Array[] = [];

    let offset = 0;
    let position = 0;

    // Write WAV file header
    this.writeString(view, position, 'RIFF'); position += 4;
    view.setUint32(position, length - 8, true); position += 4;
    this.writeString(view, position, 'WAVE'); position += 4;
    this.writeString(view, position, 'fmt '); position += 4;
    view.setUint32(position, 16, true); position += 4;  // Size of the fmt chunk
    view.setUint16(position, 1, true); position += 2;  // Audio format (PCM)
    view.setUint16(position, numOfChannels, true); position += 2;  // Number of channels
    view.setUint32(position, buffer.sampleRate, true); position += 4;  // Sample rate
    view.setUint32(position, buffer.sampleRate * numOfChannels * 2, true); position += 4;  // Byte rate
    view.setUint16(position, numOfChannels * 2, true); position += 2;  // Block align
    view.setUint16(position, 16, true); position += 2;  // Bits per sample
    this.writeString(view, position, 'data'); position += 4;
    view.setUint32(position, length - position - 4, true); position += 4;

    // Convert audio data to 16-bit PCM
    for (let i = 0; i < numOfChannels; i++) {
      channels.push(buffer.getChannelData(i));
    }

    while (offset < buffer.length) {
      for (let i = 0; i < numOfChannels; i++) {
        const sample = Math.max(-1, Math.min(1, channels[i][offset]));  // Clamp to avoid overflow
        view.setInt16(position, sample < 0 ? sample * 0x8000 : sample * 0x7FFF, true);
        position += 2;
      }
      offset++;
    }

    return arrayBuffer;
  }

  // Utility function to write a string into a DataView
  writeString(view: DataView, offset: number, string: string) {
    for (let i = 0; i < string.length; i++) {
      view.setUint8(offset + i, string.charCodeAt(i));
    }
  }

  // Download the recorded audio as a file
  downloadRecording() {
    if (this.recordedChunks.length) {
      const blob = new Blob(this.recordedChunks, { type: this.mediaRecorder?.mimeType });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.style.display = 'none';
      a.href = url;
      a.download = 'recording.' + this.mediaRecorder?.mimeType.split('/')[1];  // Use correct file extension
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
    }
  }
}
