import { BrowserModule } from '@angular/platform-browser';
import { NgModule } from '@angular/core';

import { AppComponent } from './app.component';
// Routing
import { AppRoutingModule } from './app.routing.module';
import { FormsModule, ReactiveFormsModule } from '@angular/forms';
import { HttpClientModule } from '@angular/common/http';
// Angular animations
import { BrowserAnimationsModule } from '@angular/platform-browser/animations';
// Components
import { DashboardComponent } from './components/dashboard/dashboard.component';
import { CarouselComponent } from './components/carousel/carousel.component';
import { LightboxComponent } from './components/lightbox/lightbox.component';
import { MapComponent } from './components/map/map.component';
import { MapClusterTooltipComponent } from './components/map-cluster-tooltip/map-cluster-tooltip.component';
import { MiniMapComponent } from './components/minimap/minimap.component';
import { ModalDialogComponent } from './components/modal/modal.component';
import { MusicMapComponent } from './components/music-map/music-map.component';
import { NetworkComponent } from './components/network/network.component';
import { PreviewComponent } from './components/preview-panel/preview-panel.component';
import { SearchComponent } from './components/search/search.component';
import { ThemeComponent } from './components/themes/themes.component';
import { TimelineComponent } from './components/timeline/timeline.component';
import { PeopleTimelineComponent } from './components/people-timeline/people-timeline.component';
import { BiographicalComponent } from './components/biographical.component/biographical.component';
// Services
import { EventService } from './services/event.service';
import { LocationService } from './services/location.service';
import { PersonOrganizationService } from './services/people.organizations.service';
import { SourceService } from './services/sources.service';
import { ThemeService } from './services/themes.service';
import { MusicMapService } from './services/musicmap.service';
import { GoogleService } from './services/google.service';
// import { ColorService } from './services/color.service';
import { DatabaseService } from './services/db.service';
// Resize module
import { AngularResizedEventModule } from 'angular-resize-event';
// Pipes
import { MapValuesPipe } from './pipes/map.pipe/map.pipe';
import { SafeHtmlPipe } from './pipes/safe-html.pipe/safehtml.pipe';
import { SafeResourcePipe } from './pipes/safe-resource.pipe/saferesource.pipe';
// Angular material
import {
  MatAutocompleteModule,
  MatButtonModule,
  MatButtonToggleModule,
  MatCardModule,
  MatCheckboxModule,
  MatChipsModule,
  MatDatepickerModule,
  MatDialogModule,
  MatExpansionModule,
  MatGridListModule,
  MatIconModule,
  MatInputModule,
  MatListModule,
  MatMenuModule,
  MatNativeDateModule,
  MatPaginatorModule,
  MatProgressBarModule,
  MatProgressSpinnerModule,
  MatRadioModule,
  MatRippleModule,
  MatSelectModule,
  MatSidenavModule,
  MatSliderModule,
  MatSlideToggleModule,
  MatSnackBarModule,
  MatSortModule,
  MatTableModule,
  MatTabsModule,
  MatToolbarModule,
  MatTooltipModule,
  MatStepperModule,
} from '@angular/material';
import { CdkTableModule } from '@angular/cdk/table';
export const APP_ID = 'my-app';

@NgModule({
  declarations: [
    AppComponent,
    DashboardComponent,
    CarouselComponent,
    LightboxComponent,
    MapComponent,
    MapClusterTooltipComponent,
    MiniMapComponent,
    ModalDialogComponent, 
    MusicMapComponent,
    NetworkComponent,
    PreviewComponent,
    SearchComponent,
    ThemeComponent,
    TimelineComponent,
    PeopleTimelineComponent,
    BiographicalComponent,
    MapValuesPipe,
    SafeHtmlPipe,
    SafeResourcePipe
  ],
  imports: [
    BrowserModule.withServerTransition({ appId: APP_ID }),
    FormsModule,
    ReactiveFormsModule,
    AppRoutingModule,
    BrowserAnimationsModule,
    HttpClientModule,
    CdkTableModule,
    MatAutocompleteModule,
    MatButtonModule,
    MatButtonToggleModule,
    MatCardModule,
    MatCheckboxModule,
    MatChipsModule,
    MatStepperModule,
    MatDatepickerModule,
    MatDialogModule,
    MatExpansionModule,
    MatGridListModule,
    MatIconModule,
    MatInputModule,
    MatListModule,
    MatMenuModule,
    MatNativeDateModule,
    MatPaginatorModule,
    MatProgressBarModule,
    MatProgressSpinnerModule,
    MatRadioModule,
    MatRippleModule,
    MatSelectModule,
    MatSidenavModule,
    MatSliderModule,
    MatSlideToggleModule,
    MatSnackBarModule,
    MatSortModule,
    MatTableModule,
    MatTabsModule,
    MatToolbarModule,
    MatTooltipModule,
    AngularResizedEventModule
  ],
  entryComponents: [
    ModalDialogComponent,
    LightboxComponent,
    MapClusterTooltipComponent
  ],
  providers: [
    EventService,
    LocationService,
    PersonOrganizationService,
    SourceService,
    ThemeService,
    MusicMapService,
    // ColorService,
    GoogleService,
    DatabaseService,
    MapValuesPipe,
    SafeHtmlPipe,
    SafeResourcePipe,
    { provide: 'WINDOW', useFactory: getWindow },
    { provide: 'DOCUMENT', useFactory: getDocument }
  ],
  bootstrap: [ AppComponent ]
})
export class AppModule { }

export function getWindow() {
  return (typeof window !== "undefined") ? window : null;
}

export function getDocument() {
  return (typeof document !== "undefined") ? document : null;
}