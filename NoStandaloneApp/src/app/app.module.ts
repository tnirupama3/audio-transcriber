import { NgModule } from '@angular/core';
import { BrowserModule } from '@angular/platform-browser';
import { HttpClientModule, provideHttpClient, withFetch } from '@angular/common/http'; // Import withFetch

import { AppComponent } from './app.component';
import { AudioRecordComponent } from './audio-record/audio-record.component';

@NgModule({
  declarations: [
    AppComponent,
    AudioRecordComponent
  ],
  imports: [
    BrowserModule,
    HttpClientModule
  ],
  providers: [
    provideHttpClient(withFetch())  // Enable fetch in HttpClient
  ],
  bootstrap: [AppComponent]
})
export class AppModule { }
