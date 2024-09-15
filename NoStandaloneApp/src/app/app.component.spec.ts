import { HttpClient } from '@angular/common/http';
import { Component } from '@angular/core';

@Component({
  selector: 'app-audio-record',
  templateUrl: './audio-record.component.html',
  styleUrls: ['./audio-record.component.css']
})
export class AudioRecordComponent {
  mediaRecorder: any;
  recordedChunks: Blob[] = [];
  isRecording = false;

  constructor(private http: HttpClient) {}

  startRecording() {
    navigator.mediaDevices.getUserMedia({ audio: true }).then((stream) => {
      this.mediaRecorder = new MediaRecorder(stream);
      this.mediaRecorder.start();

      this.mediaRecorder.ondataavailable = (e: any) => {
        this.recordedChunks.push(e.data);
      };

      this.mediaRecorder.onstop = () => {
        const blob = new Blob(this.recordedChunks, { type: 'audio/wav' });
        this.sendToBackend(blob);
        this.recordedChunks = []; // Clear recorded chunks after upload
      };

      this.isRecording = true;
    });
  }

  stopRecording() {
    if (this.mediaRecorder && this.mediaRecorder.state !== 'inactive') {
      this.mediaRecorder.stop();
      this.isRecording = false;
    }
  }

  sendToBackend(blob: Blob) {
    const formData = new FormData();
    formData.append('audio_file', blob, 'recording.wav');

    // POST the audio file to the backend
    this.http.post('http://127.0.0.1:8000/vad/', formData).subscribe(
      (response) => {
        console.log('Transcription result:', response);
      },
      (error) => {
        console.error('Error uploading audio:', error);
      }
    );
  }
}
