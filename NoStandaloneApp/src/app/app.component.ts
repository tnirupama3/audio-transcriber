import { Component } from '@angular/core';

@Component({
  selector: 'app-root',
  templateUrl: './app.component.html',  // Linking the HTML file here
  styleUrls: ['./app.component.css']
})
export class AppComponent {
  title = 'NoStandaloneApp';
  isRecording = false;

  startRecording() {
    this.isRecording = true;
    console.log('Recording started...');
  }

  stopRecording() {
    this.isRecording = false;
    console.log('Recording stopped...');
  }
}
