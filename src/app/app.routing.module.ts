import { NgModule }             from '@angular/core';
import { RouterModule, Routes } from '@angular/router';

import { DashboardComponent }   from './components/dashboard/dashboard.component';
import { ThemeComponent }       from './components/themes/themes.component';
import { MusicMapComponent }    from './components/music-map/music-map.component';
import { PersonOrganizationComponent } from './components/personorganization/personorganization.component';
import { PeopleTimelineComponent } from './components/people-timeline/people-timeline.component';
import { BiographicalComponent } from './components/biographical.component/biographical.component';

const routes: Routes = [
  { path: 'dashboard', component: DashboardComponent },
  { path: 'music-map', component: MusicMapComponent },
  { path: 'people', component: PersonOrganizationComponent },
  { path: 'themes', component: ThemeComponent },
  { path: 'biographical/:preset', component: BiographicalComponent },
  { path: 'biographical', component: BiographicalComponent },
  { path: 'chrono', component: PeopleTimelineComponent },
  { path: '', redirectTo: '/dashboard', pathMatch: 'full' },
  { path: '**', redirectTo: '/dashboard'},
];

@NgModule({
  imports: [ RouterModule.forRoot(routes) ],
  exports: [ RouterModule ]
})
export class AppRoutingModule {

}
