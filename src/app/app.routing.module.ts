import { NgModule }             from '@angular/core';
import { RouterModule, Routes } from '@angular/router';

import { DashboardComponent }   from './components/dashboard/dashboard.component';
import { ThemeComponent }       from './components/themes/themes.component';
import { MusicMapComponent }    from './components/music-map/music-map.component';
import { PersonOrganizationComponent } from './components/personorganization/personorganization.component';
import { PeopleTimelineComponent } from './components/people-timeline/people-timeline.component';
import { RadialTimelineComponent } from './components/radial.timeline.component/radial.timeline.component';
import { TestComponent } from './components/test.component/test.component';

const routes: Routes = [
  { path: 'dashboard', component: DashboardComponent },
  { path: 'music-map', component: MusicMapComponent },
  { path: 'people', component: PersonOrganizationComponent },
  { path: 'themes', component: ThemeComponent },
  { path: 'radial', component: RadialTimelineComponent },
  { path: 'test/:preset', component: TestComponent },
  { path: 'test', component: TestComponent },
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
