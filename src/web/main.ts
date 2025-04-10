import { bootstrapApplication } from '@angular/platform-browser';
import { appConfig } from './app/app.config';
import { AppComponent } from './app/app.component';
import { CodeBrowserComponent } from './app/code-browser/code-browser.component';
// import { MonacoEditorModule } from 'ngx-monaco-editor-v2';
import { importProvidersFrom } from '@angular/core';
// import { CodeEditorModule } from '@ngstack/code-editor';
// import * as Utils from '../Utils';

bootstrapApplication(AppComponent, appConfig)
  .catch((err) => console.error(err));

// bootstrapApplication(CodeBrowserComponent, {
//     providers : [importProvidersFrom(CodeEditorModule.forRoot({}))]
// }).catch((err) => console.error(err));

