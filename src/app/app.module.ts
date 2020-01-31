import { NgModule } from '@angular/core';
import { BrowserModule } from '@angular/platform-browser';

import { AppRoutingModule } from './app-routing.module';
import { AppComponent } from './app.component';
import { NotFoundComponent } from './not-found.component';

import { FormsModule, ReactiveFormsModule } from '@angular/forms';
import { HttpClientModule } from '@angular/common/http';
import { PLATFORM_ID, APP_ID, Inject } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';

// Components
import { DashboardComponent } from './components/dashboard/dashboard.component';
import { CarouselComponent } from './components/carousel/carousel.component';
import { LightboxComponent } from './components/lightbox/lightbox.component';
import { MapComponent } from './components/map/map.component';
import { MapClusterTooltipComponent } from './components/map-cluster-tooltip/map-cluster-tooltip.component';
import { MiniMapComponent } from './components/minimap/minimap.component';
import { MusicMapComponent } from './components/music-map/music-map.component';
import { NetworkComponent } from './components/network/network.component';
import { PreviewComponent } from './components/preview-panel/preview-panel.component';
import { SearchComponent } from './components/search/search.component';
import { ThemeComponent } from './components/themes/themes.component';
import { TimelineComponent } from './components/timeline/timeline.component';
import { PeopleTimelineComponent } from './components/people-timeline/people-timeline.component';
import { BiographicalComponent } from './components/biographical.component/biographical.component';
// Pipes
import { MapValuesPipe } from './pipes/map.pipe/map.pipe';
import { SafeHtmlPipe } from './pipes/safe-html.pipe/safehtml.pipe';
import { SafeResourcePipe } from './pipes/safe-resource.pipe/saferesource.pipe';
// Services
import { MusicMapService } from './services/musicmap.service';
import { GoogleService } from './services/google.service';
import { DatabaseService } from './services/db.service';
import { ThemeService } from './services/theme.service';
import { GeoLocationService } from './services/geolocation.service';
// Angular material
import { MatAutocompleteModule } from '@angular/material/autocomplete';
import { MatButtonModule } from '@angular/material/button';
import { MatButtonToggleModule } from '@angular/material/button-toggle';
import { MatCardModule } from '@angular/material/card';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { MatChipsModule } from '@angular/material/chips';
import { MatNativeDateModule, MatRippleModule } from '@angular/material/core';
import { MatDatepickerModule } from '@angular/material/datepicker';
import { MatDialogModule } from '@angular/material/dialog';
import { MatExpansionModule } from '@angular/material/expansion';
import { MatGridListModule } from '@angular/material/grid-list';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatListModule } from '@angular/material/list';
import { MatMenuModule } from '@angular/material/menu';
import { MatPaginatorModule } from '@angular/material/paginator';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatRadioModule } from '@angular/material/radio';
import { MatSelectModule } from '@angular/material/select';
import { MatSidenavModule } from '@angular/material/sidenav';
import { MatSlideToggleModule } from '@angular/material/slide-toggle';
import { MatSliderModule } from '@angular/material/slider';
import { MatSnackBarModule } from '@angular/material/snack-bar';
import { MatSortModule } from '@angular/material/sort';
import { MatStepperModule } from '@angular/material/stepper';
import { MatTableModule } from '@angular/material/table';
import { MatTabsModule } from '@angular/material/tabs';
import { MatToolbarModule } from '@angular/material/toolbar';
import { MatTooltipModule } from '@angular/material/tooltip';
import { CdkTableModule } from '@angular/cdk/table';

// Angular animations
import { BrowserAnimationsModule } from '@angular/platform-browser/animations';


@NgModule({
  declarations: [
    AppComponent,
    NotFoundComponent,
    DashboardComponent,
    CarouselComponent,
    LightboxComponent,
    MapComponent,
    MapClusterTooltipComponent,
    MiniMapComponent,
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
    BrowserModule.withServerTransition({ appId: 'immv-app' }),
    AppRoutingModule,
    FormsModule,
    ReactiveFormsModule,
    HttpClientModule,
    BrowserAnimationsModule,
    HttpClientModule,
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
    CdkTableModule
  ],
  providers: [
    ThemeService,
    MusicMapService,
    GeoLocationService,
    GoogleService,
    DatabaseService,
    MapValuesPipe,
    SafeHtmlPipe,
    SafeResourcePipe,
    { provide: 'WINDOW', useFactory: getWindow },
    { provide: 'DOCUMENT', useFactory: getDocument }
  ],
  bootstrap: [ AppComponent ],
  entryComponents: [
    // LightboxComponent,
    // MapClusterTooltipComponent
  ]
})
export class AppModule { 
  constructor(
    @Inject(PLATFORM_ID) private platformId: Object,
    @Inject(APP_ID) private appId: string) {
    const platform = isPlatformBrowser(platformId) ?
      'in the browser' : 'on the server';
    console.log(`Running ${platform} with appId=${appId}`);
  }
}


export function getWindow() {
  return (typeof window !== "undefined") ? window : null;
}

export function getDocument() {
  return (typeof document !== "undefined") ? document : null;
}