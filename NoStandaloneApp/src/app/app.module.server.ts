import { NgModule } from '@angular/core';
import { ServerModule } from '@angular/platform-server';

import { AppModule } from './app.module';
import { AppComponent } from './app.component';

@NgModule({
  imports: [
    AppModule,   // Ensure this is correctly imported
    ServerModule
  ],
  bootstrap: [AppComponent],
})
export class AppServerModule {}
