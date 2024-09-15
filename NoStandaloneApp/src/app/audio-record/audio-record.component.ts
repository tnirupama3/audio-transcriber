import { Component, Inject, PLATFORM_ID } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';

@Component({
  selector: 'app-audio-record',
  templateUrl: './audio-record.component.html',
  styleUrls: ['./audio-record.component.css']
})
export class AudioRecordComponent {
  mediaRecorder: any;
  recordedChunks: any[] = [];
  isRecording: boolean = false;
  transcription: string = '';
  isBrowser: boolean;

  constructor(@Inject(PLATFORM_ID) private platformId: object) {
    // Check if we are in the browser (not SSR)
    this.isBrowser = isPlatformBrowser(this.platformId);
    
    // Load the MediaRecorder and WAV encoder only in the browser
    if (this.isBrowser) {
      this.initializeMediaRecorder();
    }
  }

  async initializeMediaRecorder() {
    try {
      // Import and register the WAV encoder
      const { MediaRecorder, register } = await import('extendable-media-recorder');
      const { connect } = await import('extendable-media-recorder-wav-encoder');
      await register(await connect());
      console.log('WAV encoder initialized.');
    } catch (error) {
      console.error('Error initializing MediaRecorder or WAV encoder:', error);
    }
  }

  async startRecording() {
    if (!this.isBrowser) return;  // Ensure it's only executed in the browser

    try {
      // Get the audio stream
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });

      // Set up the AudioContext with a sample rate of 16000Hz (or modify as needed)
      const audioContext = new AudioContext({ sampleRate: 16000 });
      const mediaStreamAudioSourceNode = new MediaStreamAudioSourceNode(audioContext, { mediaStream: stream });
      const mediaStreamAudioDestinationNode = new MediaStreamAudioDestinationNode(audioContext);

      // Connect the source to the destination
      mediaStreamAudioSourceNode.connect(mediaStreamAudioDestinationNode);

      // Use the destination's stream for MediaRecorder
      this.mediaRecorder = new MediaRecorder(mediaStreamAudioDestinationNode.stream, { mimeType: 'audio/wav' });

      // Start recording
      this.mediaRecorder.start();
      this.isRecording = true;

      // Collect the recorded chunks
      this.mediaRecorder.ondataavailable = (event: any) => {
        if (event.data.size > 0) {
          this.recordedChunks.push(event.data);
        }
      };

      // Handle stopping of the recorder
      this.mediaRecorder.onstop = () => {
        this.isRecording = false;
        this.uploadRecording();  // Automatically upload the recording
      };

    } catch (error) {
      console.error('Error starting recording:', error);
    }
  }

  stopRecording() {
    if (this.mediaRecorder && this.isRecording) {
      this.mediaRecorder.stop();
    }
  }

  uploadRecording() {
    const blob = new Blob(this.recordedChunks, { type: 'audio/wav' });
    const formData = new FormData();
    formData.append('audio_file', blob, 'recording.wav');
  
    fetch('http://127.0.0.1:8000/vad/', {
      method: 'POST',
      body: formData,
    })
    .then(response => response.json())
    .then(data => {
      console.log('Transcription:', data);
      if (data.transcription) {
        this.transcription = data.transcription;
      } else {
        console.error('No transcription received');
      }
    })
    .catch(error => {
      console.error('Error uploading audio:', error);
    });
  }

  downloadRecording() {
    const blob = new Blob(this.recordedChunks, { type: 'audio/wav' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.style.display = 'none';
    a.href = url;
    a.download = 'recording.wav';
    document.body.appendChild(a);
    a.click();
    window.URL.revokeObjectURL(url);
  }
}
